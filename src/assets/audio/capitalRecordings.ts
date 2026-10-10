// Static registry and resolver for pre-recorded local capital city audio files.
// Avoids repeated API calls by serving local high-fidelity audio recordings.

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
 * Returns the local audio URL for a recorded capital and voice persona, or null if not yet recorded.
 */
export function getLocalCapitalAudioUrl(capital: string, voice: string = 'Kore'): string | null {
  if (!capital || typeof capital !== 'string') return null;

  const normKey = normalizeCapitalKey(capital);
  const voiceKey = (voice || 'kore').toLowerCase();

  // 1. Exact match: <capital>_<voice>.wav
  const exactKey = `./capitals/${normKey}_${voiceKey}.wav`;
  if (localRecordings[exactKey]) {
    return localRecordings[exactKey] as unknown as string;
  }

  // 2. Fallback to any recorded voice variant for this capital
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
export function hasLocalCapitalAudio(capital: string, voice?: string): boolean {
  return getLocalCapitalAudioUrl(capital, voice) !== null;
}

/**
 * Returns the total count of pre-recorded capital audio files.
 */
export function getLocalRecordingsCount(): number {
  return Object.keys(localRecordings).length;
}
