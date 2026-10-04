import { describe, it, expect } from 'vitest';
import { normalizeString, fuzzyMatch, levenshteinDistance } from './fuzzyMatch';

describe('fuzzyMatch', () => {
  it('normalizes diacritics and accents correctly', () => {
    expect(normalizeString('Bogotá')).toBe('bogota');
    expect(normalizeString('São Tomé')).toBe('sao tome');
    expect(normalizeString('Reykjavík')).toBe('reykjavik');
    expect(normalizeString('Chișinău')).toBe('chisinau');
    expect(normalizeString("N'Djamena")).toBe('n djamena');
  });

  it('matches exact answers regardless of case or accents', () => {
    expect(fuzzyMatch('paris', 'Paris').isMatch).toBe(true);
    expect(fuzzyMatch('BOGOTA', 'Bogotá').isMatch).toBe(true);
    expect(fuzzyMatch('Reykjavik', 'Reykjavík').isMatch).toBe(true);
  });

  it('tolerates small typos in typing recall', () => {
    // 1 typo in longer word
    expect(fuzzyMatch('Washingtn', 'Washington, D.C.').isMatch).toBe(true);
    expect(fuzzyMatch('Stockhlm', 'Stockholm').isMatch).toBe(true);
    expect(fuzzyMatch('Amsterdamn', 'Amsterdam').isMatch).toBe(true);
  });

  it('rejects incorrect answers', () => {
    expect(fuzzyMatch('Berlin', 'Paris').isMatch).toBe(false);
    expect(fuzzyMatch('Tokyo', 'Beijing').isMatch).toBe(false);
  });
});
