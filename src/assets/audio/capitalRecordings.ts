// Static registry and resolver for pre-recorded local capital city audio files (Fenrir).
// All world capitals are pre-recorded locally to provide zero-latency, zero-API-call speech.

export function normalizeCapitalKey(capital: string): string {
  return capital
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Vite imports all .wav files in the capitals directory as asset URLs
const localRecordings = import.meta.glob<{ default: string }>('./capitals/*.wav', {
  eager: true,
  import: 'default'
});

/**
 * Returns the local audio URL for a recorded capital using the Fenrir voice.
 */
export function getLocalCapitalAudioUrl(capital: string): string | null {
  if (!capital || typeof capital !== 'string') return null;

  const normKey = normalizeCapitalKey(capital);

  // 1. Fenrir recording: ./capitals/<normKey>_fenrir.wav
  const fenrirKey = `./capitals/${normKey}_fenrir.wav`;
  if (localRecordings[fenrirKey]) {
    return localRecordings[fenrirKey] as unknown as string;
  }

  // 2. Plain key: ./capitals/<normKey>.wav
  const plainKey = `./capitals/${normKey}.wav`;
  if (localRecordings[plainKey]) {
    return localRecordings[plainKey] as unknown as string;
  }

  // 3. Fallback to any variant for this capital
  for (const [filePath, fileUrl] of Object.entries(localRecordings)) {
    if (filePath.startsWith(`./capitals/${normKey}_`) && filePath.endsWith('.wav')) {
      return fileUrl as unknown as string;
    }
  }

  return null;
}

/**
 * Checks if a capital has a local audio file available.
 */
export function hasLocalCapitalAudio(capital: string): boolean {
  return getLocalCapitalAudioUrl(capital) !== null;
}

/**
 * Returns the total count of pre-recorded capital audio files.
 */
export function getLocalRecordingsCount(): number {
  return Object.keys(localRecordings).length;
}
