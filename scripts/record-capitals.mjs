import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'assets', 'audio', 'capitals');
const COUNTRIES_PATH = path.join(ROOT_DIR, 'src', 'assets', 'data', 'countries.ts');

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (!fs.existsSync(ENV_PATH)) return '';
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const match = content.match(/^(?:(?:VITE_)?GEMINI_API_KEY=)?\s*(.+)$/m);
  return match && match[1] ? match[1].trim() : '';
}

export function normalizeCapitalKey(capital) {
  return capital
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractAllCapitals() {
  const content = fs.readFileSync(COUNTRIES_PATH, 'utf-8');
  const capitals = [];
  const matches = content.matchAll(/\"capital\":\s*\"([^\"]+)\"/g);
  for (const m of matches) {
    if (m[1] && m[1].trim()) {
      capitals.push(m[1].trim());
    }
  }
  return [...new Set(capitals)];
}

function pcmToWavBuffer(base64Pcm, sampleRate = 24000) {
  const pcmBuffer = Buffer.from(base64Pcm, 'base64');
  const pcmLen = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmLen, 4);
  header.write('WAVE', 8);

  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);

  header.write('data', 36);
  header.writeUInt32LE(pcmLen, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function recordViaGemini(apiKey, capital) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${encodeURIComponent(apiKey)}`;
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
            voiceName: 'Fenrir'
          }
        }
      }
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errorText}`);
  }

  const json = await res.json();
  const inlineData = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    throw new Error(`No inline audio data returned`);
  }

  const mimeType = inlineData.mimeType || 'audio/wav';
  if (mimeType.includes('pcm') || mimeType.includes('l16')) {
    return pcmToWavBuffer(inlineData.data, 24000);
  } else {
    return Buffer.from(inlineData.data, 'base64');
  }
}

async function recordViaHighQualityStream(capital, targetWavPath) {
  const tmpMp3 = targetWavPath.replace(/\.wav$/, '.tmp.mp3');
  const streamUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(capital)}`;

  const res = await fetch(streamUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });

  if (!res.ok) {
    throw new Error(`Stream HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(tmpMp3, Buffer.from(arrayBuffer));

  // Convert to clean standard 24kHz mono 16-bit WAV with ffmpeg
  try {
    execSync(`ffmpeg -y -v quiet -i "${tmpMp3}" -ar 24000 -ac 1 -c:a pcm_s16le "${targetWavPath}"`);
  } finally {
    if (fs.existsSync(tmpMp3)) fs.unlinkSync(tmpMp3);
  }
}

async function main() {
  const apiKey = loadApiKey();
  const capitals = extractAllCapitals();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`🎙️  Batch Recording All 196 Capital Cities for Local Storage...`);
  console.log(`Total capitals in dataset: ${capitals.length}`);
  console.log(`Target directory: ${OUTPUT_DIR}\n`);

  let geminiCount = 0;
  let streamCount = 0;
  let skippedCount = 0;
  const manifest = [];

  for (let i = 0; i < capitals.length; i++) {
    const capital = capitals[i];
    const normKey = normalizeCapitalKey(capital);
    const targetFile = `${normKey}_fenrir.wav`;
    const targetPath = path.join(OUTPUT_DIR, targetFile);

    // Skip if already recorded
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 1000 && !process.argv.includes('--force')) {
      skippedCount++;
      manifest.push({ capital, normKey, file: targetFile, size: fs.statSync(targetPath).size });
      continue;
    }

    process.stdout.write(`[${i + 1}/${capitals.length}] Recording "${capital}"... `);

    let recorded = false;

    // 1. Try Gemini 3.8 Flash TTS with Fenrir first if API key present
    if (apiKey) {
      try {
        const wavBuffer = await recordViaGemini(apiKey, capital);
        fs.writeFileSync(targetPath, wavBuffer);
        geminiCount++;
        recorded = true;
        console.log(`✅ Saved via Gemini TTS (${wavBuffer.length} bytes)`);
        manifest.push({ capital, normKey, file: targetFile, size: wavBuffer.length, source: 'gemini-fenrir' });
        await new Promise((r) => setTimeout(r, 600));
      } catch (geminiErr) {
        // Fall back to stream
      }
    }

    // 2. If Gemini unavailable or quota limit reached, record via high-quality audio stream converted to WAV
    if (!recorded) {
      try {
        await recordViaHighQualityStream(capital, targetPath);
        const size = fs.statSync(targetPath).size;
        streamCount++;
        console.log(`✅ Saved local WAV (${size} bytes)`);
        manifest.push({ capital, normKey, file: targetFile, size, source: 'local-stream' });
        await new Promise((r) => setTimeout(r, 120));
      } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
      }
    }
  }

  // Write manifest
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`\n🎉 Complete!`);
  console.log(`- Already existing: ${skippedCount}`);
  console.log(`- Recorded via Gemini: ${geminiCount}`);
  console.log(`- Recorded via local stream: ${streamCount}`);
  console.log(`- Total local audio files on disk: ${fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.wav')).length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
