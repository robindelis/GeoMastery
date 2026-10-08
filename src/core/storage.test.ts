import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from './storage';
import { SRSItem } from './types';

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear()
};

// Polyfill globalThis.localStorage for Node environment in Vitest
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});

describe('StorageService Persistence & Schema Integrity', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('caps review history to the latest 15 entries to avoid storage quota overflow', () => {
    const dummyItem: SRSItem = {
      id: 'FRA:capital',
      countryId: 'FRA',
      attributeId: 'capital',
      stage: 2,
      step: 3,
      reps: 20,
      lapses: 0,
      easeFactor: 2.5,
      intervalDays: 14,
      consecutiveRecallCorrect: 2,
      lastReviewedAt: new Date(Date.now() - 3600000).toISOString(),
      nextDueAt: new Date(Date.now() + 86400000).toISOString(),
      history: Array.from({ length: 30 }, (_, i) => ({
        timestamp: new Date(Date.now() - (30 - i) * 1000).toISOString(),
        inputMode: 'typing' as const,
        userAnswer: 'Paris',
        isCorrect: true,
        timeSpentMs: 1200
      }))
    };

    const map = new Map<string, SRSItem>();
    map.set('FRA:capital', dummyItem);

    StorageService.saveSRSItems(map);
    const loaded = StorageService.loadSRSItems();
    const item = loaded.get('FRA:capital');
    expect(item).toBeDefined();
    expect(item?.history.length).toBe(15);
    // Preserves the latest entries
    expect(item?.history[14].timestamp).toBe(dummyItem.history[29].timestamp);
  });

  it('deep-merges stats to prevent clobbering nested continentMastery or timeAttackRecords', () => {
    // Save partial stats missing some nested continent records
    const partialStats = {
      totalReviews: 42,
      currentStreak: 3,
      continentMastery: {
        Europe: { mastered: 10, total: 44, learning: 5 }
      }
    };
    localStorageMock.setItem('geomastery_user_stats_v1', JSON.stringify(partialStats));

    const loaded = StorageService.loadStats();
    expect(loaded.totalReviews).toBe(42);
    expect(loaded.currentStreak).toBe(3);
    // Default continents should still exist
    expect(loaded.continentMastery.Asia).toBeDefined();
    expect(loaded.continentMastery.Africa).toBeDefined();
    // Overridden continent is preserved
    expect(loaded.continentMastery.Europe.mastered).toBe(10);
    expect(loaded.timeAttackRecords).toBeDefined();
  });

  it('safely validates JSON schema during backup import and rejects corrupted structures', () => {
    // Invalid schema (empty object, null, or wrong fields)
    expect(StorageService.importBackupJSON('invalid-json')).toBe(false);
    expect(StorageService.importBackupJSON('{}')).toBe(false);
    expect(StorageService.importBackupJSON(JSON.stringify({ stats: null, srsItems: null }))).toBe(false);

    // Valid backup structure
    const validBackup = JSON.stringify({
      version: 1,
      stats: {
        totalReviews: 10,
        currentStreak: 2,
        longestStreak: 5,
        totalCorrect: 9,
        lastReviewDate: '2026-10-08',
        continentMastery: {
          Europe: { total: 44, mastered: 10, learning: 5 }
        },
        timeAttackRecords: {}
      },
      srsItems: [
        [
          'DEU:capital',
          {
            id: 'DEU:capital',
            countryId: 'DEU',
            attributeId: 'capital',
            stage: 1,
            step: 1,
            reps: 1,
            lapses: 0,
            easeFactor: 2.5,
            intervalDays: 1,
            consecutiveRecallCorrect: 0,
            lastReviewedAt: new Date(1000).toISOString(),
            nextDueAt: new Date(2000).toISOString(),
            history: []
          }
        ]
      ]
    });

    expect(StorageService.importBackupJSON(validBackup)).toBe(true);
    const loaded = StorageService.loadSRSItems();
    expect(loaded.has('DEU:capital')).toBe(true);
  });
});
