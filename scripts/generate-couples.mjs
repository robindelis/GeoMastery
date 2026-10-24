import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(ROOT_DIR, 'src', 'assets', 'data', 'countries.ts');
const COUNTRIES_AUDIO_DIR = path.join(ROOT_DIR, 'src', 'assets', 'audio', 'countries');
const CAPITALS_AUDIO_DIR = path.join(ROOT_DIR, 'src', 'assets', 'audio', 'capitals');
const COUPLES_AUDIO_DIR = path.join(ROOT_DIR, 'src', 'assets', 'audio', 'couples');

export function normalizeKey(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractAllPairs() {
  const content = fs.readFileSync(COUNTRIES_PATH, 'utf-8');
  const pairs = [];
  const matches = content.matchAll(/\"name\":\s*\"([^\"]+)\"[\s\S]*?\"capital\":\s*\"([^\"]+)\"/g);
  for (const m of matches) {
    if (m[1] && m[2] && m[1].trim() && m[2].trim()) {
      pairs.push({ country: m[1].trim(), capital: m[2].trim() });
    }
  }
  return pairs;
}

function getSilences(filePath) {
  const output = execSync(`ffmpeg -i "${filePath}" -af silencedetect=noise=-30dB:d=0.03 -f null - 2>&1`, {
    encoding: 'utf-8'
  });
  let leadingSilence = 0;
  let trailingSilence = 0;
  let duration = 0;

  const durMatch = output.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (durMatch) {
    duration = parseFloat(durMatch[1]) * 3600 + parseFloat(durMatch[2]) * 60 + parseFloat(durMatch[3]);
  }

  const leadMatch = output.match(/silence_start:\s*0[\s\S]*?silence_end:\s*([\d.]+)/);
  if (leadMatch) {
    leadingSilence = parseFloat(leadMatch[1]);
  }

  const starts = [...output.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));
  if (starts.length > 0) {
    const lastStart = starts[starts.length - 1];
    if (lastStart > leadingSilence && duration - lastStart < 0.8) {
      trailingSilence = duration - lastStart;
    }
  }

  return { duration, leadingSilence, trailingSilence };
}

async function main() {
  fs.mkdirSync(COUPLES_AUDIO_DIR, { recursive: true });
  const pairs = extractAllPairs();
  console.log(`🎙️  Generating Tailored Accelerated Audio Pairs (1.3x) for ${pairs.length} Country-Capital Couples...\n`);

  const manifest = [];
  let generated = 0;

  for (let i = 0; i < pairs.length; i++) {
    const { country, capital } = pairs[i];
    const cKey = normalizeKey(country);
    const capKey = normalizeKey(capital);

    const cFile = path.join(COUNTRIES_AUDIO_DIR, `${cKey}_fenrir.wav`);
    const capFile = path.join(CAPITALS_AUDIO_DIR, `${capKey}_fenrir.wav`);
    const targetFile = `${cKey}_${capKey}_fenrir.wav`;
    const targetPath = path.join(COUPLES_AUDIO_DIR, targetFile);

    if (!fs.existsSync(cFile) || !fs.existsSync(capFile)) {
      console.warn(`[${i + 1}/${pairs.length}] Skipping "${country} - ${capital}": source audio missing.`);
      continue;
    }

    const cSil = getSilences(cFile);
    const capSil = getSilences(capFile);

    const silenceSumAt13 = (cSil.trailingSilence + capSil.leadingSilence) / 1.3;
    const targetGap = 0.085; // 85ms target gap between spoken words
    let overlapD = silenceSumAt13 - targetGap;
    const maxD = Math.min((cSil.duration / 1.3) * 0.75, (capSil.duration / 1.3) * 0.75);
    overlapD = Math.max(0.05, Math.min(maxD, overlapD));

    const cmd = `ffmpeg -y -i "${cFile}" -i "${capFile}" -filter_complex "[0:a]atempo=1.3[a0];[1:a]atempo=1.3[a1];[a0][a1]acrossfade=d=${overlapD.toFixed(3)}:c1=tri:c2=tri[out]" -map "[out]" "${targetPath}" 2>&1`;

    try {
      execSync(cmd);
      generated++;
      const size = fs.statSync(targetPath).size;

      manifest.push({
        country,
        capital,
        countryKey: cKey,
        capitalKey: capKey,
        file: targetFile,
        size,
        overlapSeconds: parseFloat(overlapD.toFixed(3)),
        expectedGapMs: Math.round((silenceSumAt13 - overlapD) * 1000)
      });

      if ((i + 1) % 25 === 0 || i === pairs.length - 1) {
        console.log(`[${i + 1}/${pairs.length}] Processed "${country} - ${capital}" (overlap: ${(overlapD * 1000).toFixed(0)}ms, gap: ~${Math.round((silenceSumAt13 - overlapD) * 1000)}ms)`);
      }
    } catch (err) {
      console.error(`Failed for "${country} - ${capital}":`, err.message);
    }
  }

  const manifestPath = path.join(COUPLES_AUDIO_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`\n🎉 Generated ${generated}/${pairs.length} tailored couple audio files in ${COUPLES_AUDIO_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
