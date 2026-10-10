import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'assets', 'audio', 'capitals');

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (!fs.existsSync(ENV_PATH)) return '';
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const match = content.match(/^(?:(?:VITE_)?GEMINI_API_KEY=)?\s*(.+)$/m);
  return match && match[1] ? match[1].trim() : '';
}

export function normalizeCapitalKey(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pcmToWavBuffer(base64Pcm, sampleRate = 24000) {
  const pcmBuffer = Buffer.from(base64Pcm, 'base64');
  const pcmLen = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmLen, 4);
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(1, 22); // NumChannels (1 = mono)
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  header.writeUInt16LE(2, 32); // BlockAlign
  header.writeUInt16LE(16, 34); // BitsPerSample

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(pcmLen, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function recordCapital(apiKey, capital, voice) {
  const models = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'];
  let lastError = null;

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: capital }]
        }
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        }
      }
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        lastError = new Error(`${model} HTTP ${res.status}: ${errorText}`);
        if (res.status === 429) {
          const matchSeconds =
            errorText.match(/retryDelay":\s*"(\d+)s"/i) ||
            errorText.match(/retry in (\d+(?:\.\d+)?)s/i);
          const waitSec = matchSeconds ? Math.ceil(parseFloat(matchSeconds[1])) : 0;
          if (waitSec > 0 && waitSec <= 35) {
            console.log(`     ⏳ Per-minute rate limit on ${model}, waiting ${waitSec + 1}s to retry...`);
            await new Promise((r) => setTimeout(r, (waitSec + 1) * 1000));
            // Retry the same model once
            const retryRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (retryRes.ok) {
              const retryJson = await retryRes.json();
              const inlineData = retryJson?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
              if (inlineData?.data) {
                const mimeType = inlineData.mimeType || 'audio/wav';
                if (mimeType.includes('pcm') || mimeType.includes('l16')) {
                  return pcmToWavBuffer(inlineData.data, 24000);
                } else {
                  return Buffer.from(inlineData.data, 'base64');
                }
              }
            }
          }
          // Otherwise try next model in fallback list
          continue;
        }
        throw lastError;
      }

      const json = await res.json();
      const inlineData = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data) {
        throw new Error(`No inline audio data returned: ${JSON.stringify(json)}`);
      }

      const mimeType = inlineData.mimeType || 'audio/wav';
      if (mimeType.includes('pcm') || mimeType.includes('l16')) {
        return pcmToWavBuffer(inlineData.data, 24000);
      } else {
        return Buffer.from(inlineData.data, 'base64');
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All TTS models failed');
}

async function main() {
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY not found in .env or environment!');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const capitals = ['Paris', 'Washington, D.C.', 'Buenos Aires', 'Tokyo', 'Reykjavik'];
  const voices = ['Kore', 'Aoede', 'Puck', 'Fenrir', 'Charon'];

  console.log(`🎙️ Starting Gemini 3.8 Flash TTS batch recorder...`);
  console.log(`Target: ${capitals.length} capitals × ${voices.length} voices = ${capitals.length * voices.length} audio files.`);
  console.log(`Output Directory: ${OUTPUT_DIR}\n`);

  let count = 0;
  const manifest = [];

  for (const capital of capitals) {
    const normKey = normalizeCapitalKey(capital);
    for (const voice of voices) {
      count++;
      const filename = `${normKey}_${voice.toLowerCase()}.wav`;
      const filePath = path.join(OUTPUT_DIR, filename);

      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100 && !process.argv.includes('--force')) {
        console.log(`[${count}/${capitals.length * voices.length}] ⏭️  Skipping existing: ${filename}`);
        manifest.push({ capital, voice, normKey, filename, sizeBytes: fs.statSync(filePath).size });
        continue;
      }

      console.log(`[${count}/${capitals.length * voices.length}] 🔊 Recording "${capital}" (${voice}) -> ${filename}...`);
      try {
        const audioBuffer = await recordCapital(apiKey, capital, voice);
        fs.writeFileSync(filePath, audioBuffer);
        console.log(`     ✅ Saved (${audioBuffer.length} bytes)`);
        manifest.push({ capital, voice, normKey, filename, sizeBytes: audioBuffer.length });
      } catch (err) {
        console.error(`     ❌ Failed to record "${capital}" with ${voice}:`, err.message);
      }

      // Respect rate limits with a small breather
      await new Promise((r) => setTimeout(r, 750));
    }
  }

  // Write manifest JSON
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n🎉 Complete! Recorded ${manifest.length} audio files.`);
  console.log(`Manifest written to: ${manifestPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
