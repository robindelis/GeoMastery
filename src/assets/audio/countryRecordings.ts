// Static registry and resolver for pre-recorded local sovereign country audio files (Fenrir).
// All world sovereign countries are pre-recorded locally to provide zero-latency, zero-API-call speech.

export function normalizeCountryKey(country: string): string {
  return country
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Vite imports all .wav files in the countries directory as asset URLs
const localCountryRecordings = import.meta.glob<{ default: string }>('./countries/*.wav', {
  eager: true,
  import: 'default'
});

/**
 * Returns the local audio URL for a recorded country using the Fenrir voice.
 */
export function getLocalCountryAudioUrl(country: string): string | null {
  if (!country || typeof country !== 'string') return null;

  const normKey = normalizeCountryKey(country);

  // 1. Fenrir recording: ./countries/<normKey>_fenrir.wav
  const fenrirKey = `./countries/${normKey}_fenrir.wav`;
  if (localCountryRecordings[fenrirKey]) {
    return localCountryRecordings[fenrirKey] as unknown as string;
  }

  // 2. Plain key: ./countries/<normKey>.wav
  const plainKey = `./countries/${normKey}.wav`;
  if (localCountryRecordings[plainKey]) {
    return localCountryRecordings[plainKey] as unknown as string;
  }

  // 3. Fallback to any variant for this country
  for (const [filePath, fileUrl] of Object.entries(localCountryRecordings)) {
    if (filePath.startsWith(`./countries/${normKey}_`) && filePath.endsWith('.wav')) {
      return fileUrl as unknown as string;
    }
  }

  return null;
}

/**
 * Checks if a country has a local audio file available.
 */
export function hasLocalCountryAudio(country: string): boolean {
  return getLocalCountryAudioUrl(country) !== null;
}

/**
 * Returns the total count of pre-recorded country audio files.
 */
export function getLocalCountryRecordingsCount(): number {
  return Object.keys(localCountryRecordings).length;
}
