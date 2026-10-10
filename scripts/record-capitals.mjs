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

async function recordViaGemini(apiKey, capital, maxRetries = 5) {
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

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
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

    const errorText = await res.text();
    if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < maxRetries) {
      const delay = attempt * 3000;
      process.stdout.write(`[retry ${attempt} in ${delay}ms] `);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Gemini HTTP ${res.status}: ${errorText}`);
  }
}

async function main() {
  const apiKey = loadApiKey();
  const capitals = extractAllCapitals();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`🎙️  Batch Recording All 196 Capital Cities via Gemini 3.8 Flash TTS (Fenrir)...`);
  console.log(`Total capitals in dataset: ${capitals.length}`);
  console.log(`Target directory: ${OUTPUT_DIR}\n`);

  let geminiCount = 0;
  let skippedCount = 0;
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  let existingManifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {}
  }
  const manifestMap = new Map(existingManifest.map((m) => [m.normKey, m]));

  for (let i = 0; i < capitals.length; i++) {
    const capital = capitals[i];
    const normKey = normalizeCapitalKey(capital);
    const targetFile = `${normKey}_fenrir.wav`;
    const targetPath = path.join(OUTPUT_DIR, targetFile);

    const existingEntry = manifestMap.get(normKey);
    // Skip only if already recorded with genuine Gemini 3.8 Flash TTS
    if (
      existingEntry?.source === 'gemini-3.8-flash-tts-fenrir' &&
      fs.existsSync(targetPath) &&
      fs.statSync(targetPath).size > 1000 &&
      !process.argv.includes('--force')
    ) {
      skippedCount++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${capitals.length}] Recording "${capital}" via Gemini 3.8 Flash TTS (Fenrir)... `);

    if (!apiKey) {
      throw new Error(`GEMINI_API_KEY is not defined in .env! Cannot record capitals.`);
    }

    try {
      const wavBuffer = await recordViaGemini(apiKey, capital);
      fs.writeFileSync(targetPath, wavBuffer);
      geminiCount++;
      console.log(`✅ Saved (${wavBuffer.length} bytes)`);
      manifestMap.set(normKey, {
        capital,
        normKey,
        file: targetFile,
        size: wavBuffer.length,
        source: 'gemini-3.8-flash-tts-fenrir'
      });
      // Save manifest progress incrementally
      fs.writeFileSync(manifestPath, JSON.stringify(Array.from(manifestMap.values()), null, 2), 'utf-8');
      await new Promise((r) => setTimeout(r, 4100));
    } catch (geminiErr) {
      console.log(`\n❌ Gemini TTS API failed: ${geminiErr.message}`);
      throw geminiErr;
    }
  }

  // Final manifest save
  fs.writeFileSync(manifestPath, JSON.stringify(Array.from(manifestMap.values()), null, 2), 'utf-8');

  console.log(`\n🎉 Complete!`);
  console.log(`- Already existing: ${skippedCount}`);
  console.log(`- Recorded via Gemini 3.8 Flash TTS: ${geminiCount}`);
  console.log(`- Total local audio files on disk: ${fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.wav')).length}`);
}

if (process.argv[1] && process.argv[1].endsWith('record-capitals.mjs')) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
