import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'assets', 'audio', 'countries');
const COUNTRIES_PATH = path.join(ROOT_DIR, 'src', 'assets', 'data', 'countries.ts');

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (!fs.existsSync(ENV_PATH)) return '';
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const match = content.match(/^(?:(?:VITE_)?GEMINI_API_KEY=)\s*(.+)$/m);
  return match && match[1] ? match[1].trim() : '';
}

export function normalizeCountryKey(country) {
  return country
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractAllCountries() {
  const content = fs.readFileSync(COUNTRIES_PATH, 'utf-8');
  const countries = [];
  const matches = content.matchAll(/\"name\":\s*\"([^\"]+)\"/g);
  for (const m of matches) {
    if (m[1] && m[1].trim()) {
      countries.push(m[1].trim());
    }
  }
  return [...new Set(countries)];
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

async function recordViaGemini(apiKey, text, modelName, maxRetries = 5) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text }]
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
        return { buffer: pcmToWavBuffer(inlineData.data, 24000), model: modelName };
      } else {
        return { buffer: Buffer.from(inlineData.data, 'base64'), model: modelName };
      }
    }

    const errorText = await res.text();
    const isDailyQuota =
      res.status === 429 &&
      (errorText.includes('free_tier_requests') || errorText.includes('ResourceExhausted') || errorText.includes('limit: 100'));

    if (isDailyQuota) {
      const err = new Error(`DAILY_QUOTA_EXHAUSTED: ${errorText}`);
      err.isDailyQuota = true;
      throw err;
    }

    if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < maxRetries) {
      const delay = attempt * 4000 + 2000;
      process.stdout.write(`[retry ${attempt} for ${modelName} in ${delay}ms] `);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Gemini HTTP ${res.status} (${modelName}): ${errorText}`);
  }
}

async function recordCountryWithFallback(apiKey, country, preferredModel, fallbackModel) {
  try {
    return await recordViaGemini(apiKey, country, preferredModel);
  } catch (err) {
    if (err.isDailyQuota && fallbackModel && fallbackModel !== preferredModel) {
      console.log(`\n⚠️  ${preferredModel} quota reached, switching immediately to fallback ${fallbackModel}...`);
      return await recordViaGemini(apiKey, country, fallbackModel);
    }
    throw err;
  }
}

async function main() {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error(`GEMINI_API_KEY is not defined in .env! Cannot record countries.`);
  }

  const countries = extractAllCountries();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`🎙️  Batch Recording Sovereign Countries via Gemini 3.8 Flash & Lite TTS (Fenrir)...`);
  console.log(`Total countries in dataset: ${countries.length}`);
  console.log(`Target directory: ${OUTPUT_DIR}\n`);

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  let existingManifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {}
  }
  const manifestMap = new Map(existingManifest.map((m) => [m.normKey, m]));

  let flashCount = 0;
  let flashLiteCount = 0;
  let skippedCount = 0;

  // Split: first 96 to gemini-3.8-flash-tts, rest to gemini-3.8-flash-lite-tts
  // Automatically failover to the other if quota is reached
  const SPLIT_INDEX = 96;

  for (let i = 0; i < countries.length; i++) {
    const country = countries[i];
    const normKey = normalizeCountryKey(country);
    const targetFile = `${normKey}_fenrir.wav`;
    const targetPath = path.join(OUTPUT_DIR, targetFile);

    const existingEntry = manifestMap.get(normKey);
    const isRecorded =
      (existingEntry?.source === 'gemini-3.8-flash-tts-fenrir' ||
        existingEntry?.source === 'gemini-3.8-flash-lite-tts-fenrir') &&
      fs.existsSync(targetPath) &&
      fs.statSync(targetPath).size > 1000 &&
      !process.argv.includes('--force');

    if (isRecorded) {
      skippedCount++;
      continue;
    }

    const preferredModel = i < SPLIT_INDEX ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts';
    const fallbackModel = i < SPLIT_INDEX ? 'gemini-3.8-flash-lite-tts' : 'gemini-3.8-flash-tts';

    process.stdout.write(`[${i + 1}/${countries.length}] Recording "${country}" (${preferredModel})... `);

    try {
      const { buffer, model } = await recordCountryWithFallback(apiKey, country, preferredModel, fallbackModel);
      fs.writeFileSync(targetPath, buffer);

      if (model === 'gemini-3.8-flash-tts') flashCount++;
      else flashLiteCount++;

      console.log(`✅ Saved (${buffer.length} bytes, ${model})`);

      manifestMap.set(normKey, {
        country,
        normKey,
        file: targetFile,
        size: buffer.length,
        source: `${model}-fenrir`
      });

      // Save manifest progress incrementally
      fs.writeFileSync(manifestPath, JSON.stringify(Array.from(manifestMap.values()), null, 2), 'utf-8');

      // Rate limit safe pause (15 RPM -> 4.1s)
      await new Promise((r) => setTimeout(r, 4100));
    } catch (err) {
      console.log(`\n❌ Recording failed for "${country}": ${err.message}`);
      throw err;
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(Array.from(manifestMap.values()), null, 2), 'utf-8');

  console.log(`\n🎉 Complete!`);
  console.log(`- Already existing: ${skippedCount}`);
  console.log(`- Recorded via gemini-3.8-flash-tts: ${flashCount}`);
  console.log(`- Recorded via gemini-3.8-flash-lite-tts: ${flashLiteCount}`);
  console.log(`- Total country audio files: ${fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.wav')).length}`);
}

if (process.argv[1] && process.argv[1].endsWith('record-countries.mjs')) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
