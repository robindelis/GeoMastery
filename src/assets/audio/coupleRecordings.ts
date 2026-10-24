// Static registry and resolver for tailored accelerated Country-Capital audio pairs (Fenrir).
// All world sovereign country-capital pairs are pre-spliced with precision silence analysis
// to achieve a natural, instant speech transition (~85ms gap) at 1.3x speed.

import { normalizeCountryKey } from './countryRecordings';
import { normalizeCapitalKey } from './capitalRecordings';

export { normalizeCountryKey, normalizeCapitalKey };

// Vite imports all .wav files in the couples directory as asset URLs
const localCoupleRecordings = import.meta.glob<{ default: string }>('./couples/*.wav', {
  eager: true,
  import: 'default'
});

/**
 * Returns the local audio URL for a tailored country-capital pair file.
 */
export function getLocalCoupleAudioUrl(country: string, capital: string): string | null {
  if (!country || typeof country !== 'string' || !capital || typeof capital !== 'string') {
    return null;
  }

  const cKey = normalizeCountryKey(country);
  const capKey = normalizeCapitalKey(capital);

  // 1. Direct match: ./couples/<cKey>_<capKey>_fenrir.wav
  const primaryKey = `./couples/${cKey}_${capKey}_fenrir.wav`;
  if (localCoupleRecordings[primaryKey]) {
    return localCoupleRecordings[primaryKey] as unknown as string;
  }

  // 2. Fallback prefix search
  for (const [filePath, fileUrl] of Object.entries(localCoupleRecordings)) {
    if (filePath.startsWith(`./couples/${cKey}_${capKey}`) && filePath.endsWith('.wav')) {
      return fileUrl as unknown as string;
    }
  }

  return null;
}

/**
 * Checks if a tailored country-capital pair recording is available.
 */
export function hasLocalCoupleAudio(country: string, capital: string): boolean {
  return getLocalCoupleAudioUrl(country, capital) !== null;
}

/**
 * Returns the total count of pre-recorded couple audio files.
 */
export function getLocalCoupleRecordingsCount(): number {
  return Object.keys(localCoupleRecordings).length;
}
