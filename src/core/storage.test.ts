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

  it('correctLastReviewEvent reconciles an incorrect review into a correct one without inflating totalReviews', () => {
    // Record an initial incorrect review
    const afterIncorrect = StorageService.recordReviewEvent(false);
    expect(afterIncorrect.totalReviews).toBe(1);
    expect(afterIncorrect.totalCorrect).toBe(0);

    // User triggers 'I was right' override
    const afterOverride = StorageService.correctLastReviewEvent();
    expect(afterOverride.totalReviews).toBe(1);
    expect(afterOverride.totalCorrect).toBe(1);
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

  it('reconciles native disk storage and localStorage by preserving whichever item has more advanced progress', async () => {
    const localMap = new Map<string, SRSItem>([
      [
        'FRA:capital',
        {
          id: 'FRA:capital',
          countryId: 'FRA',
          attributeId: 'capital',
          stage: 1,
          step: 1,
          reps: 2,
          lapses: 0,
          easeFactor: 2.5,
          intervalDays: 1,
          consecutiveRecallCorrect: 1,
          lastReviewedAt: new Date(1000).toISOString(),
          nextDueAt: new Date(2000).toISOString(),
          history: []
        }
      ]
    ]);
    StorageService.saveSRSItems(localMap);

    // Mock window.electronAPI with more advanced progress for FRA:capital and a new item JPN:capital
    const mockSavedPayloads: any[] = [];
    (globalThis as any).window = {
      electronAPI: {
        loadStorageData: async () => ({
          success: true,
          data: {
            srsItems: [
              [
                'FRA:capital',
                {
                  id: 'FRA:capital',
                  countryId: 'FRA',
                  attributeId: 'capital',
                  stage: 2,
                  step: 2,
                  reps: 5,
                  lapses: 0,
                  easeFactor: 2.6,
                  intervalDays: 7,
                  consecutiveRecallCorrect: 2,
                  lastReviewedAt: new Date(5000).toISOString(),
                  nextDueAt: new Date(9000).toISOString(),
                  history: []
                }
              ],
              [
                'JPN:capital',
                {
                  id: 'JPN:capital',
                  countryId: 'JPN',
                  attributeId: 'capital',
                  stage: 1,
                  step: 1,
                  reps: 1,
                  lapses: 0,
                  easeFactor: 2.5,
                  intervalDays: 1,
                  consecutiveRecallCorrect: 0,
                  lastReviewedAt: new Date(3000).toISOString(),
                  nextDueAt: new Date(6000).toISOString(),
                  history: []
                }
              ]
            ],
            stats: {
              totalReviews: 25,
              totalCorrect: 23,
              currentStreak: 4,
              longestStreak: 4,
              lastReviewDate: '2026-10-11',
              continentMastery: {},
              timeAttackRecords: {}
            }
          }
        }),
        saveStorageData: async (payload: any) => {
          mockSavedPayloads.push(payload);
          return { success: true };
        }
      }
    };

    const changed = await StorageService.initPersistentSync();
    expect(changed).toBe(true);

    const reconciled = StorageService.loadSRSItems();
    expect(reconciled.get('FRA:capital')?.stage).toBe(2);
    expect(reconciled.get('FRA:capital')?.reps).toBe(5);
    expect(reconciled.has('JPN:capital')).toBe(true);
    expect(StorageService.loadStats().totalReviews).toBe(25);

    delete (globalThis as any).window;
  });

  it('strictly prioritizes more recent event timestamps even when a card regresses (1/2 -> 0/2 or Stage 2 -> Stage 1)', () => {
    // Desktop state at t = 1000: FRA is 1/2 in recall, ESP is Stage 2 (Mastered)
    const olderLocalMap = new Map<string, SRSItem>([
      [
        'FRA:capital',
        {
          id: 'FRA:capital',
          countryId: 'FRA',
          attributeId: 'capital',
          stage: 1,
          step: 2,
          reps: 2,
          lapses: 0,
          easeFactor: 2.55,
          intervalDays: 1,
          consecutiveRecallCorrect: 1,
          lastReviewedAt: new Date(1000).toISOString(),
          nextDueAt: new Date(86401000).toISOString(),
          history: []
        }
      ],
      [
        'ESP:capital',
        {
          id: 'ESP:capital',
          countryId: 'ESP',
          attributeId: 'capital',
          stage: 2,
          step: 3,
          reps: 3,
          lapses: 0,
          easeFactor: 2.6,
          intervalDays: 7,
          consecutiveRecallCorrect: 2,
          lastReviewedAt: new Date(1000).toISOString(),
          nextDueAt: new Date(604801000).toISOString(),
          history: []
        }
      ]
    ]);
    StorageService.saveSRSItems(olderLocalMap);

    // Phone state at t = 5000: User failed both cards on phone, so FRA went 1/2 -> 0/2 and ESP went Stage 2 -> Stage 1 (0/2)
    // Note that reps does NOT increase on failure, only lapses and lastReviewedAt!
    const newerPhonePayload = {
      srsItems: [
        [
          'FRA:capital',
          {
            id: 'FRA:capital',
            countryId: 'FRA',
            attributeId: 'capital',
            stage: 1,
            step: 0,
            reps: 2,
            lapses: 1,
            easeFactor: 2.35,
            intervalDays: 0,
            consecutiveRecallCorrect: 0,
            lastReviewedAt: new Date(5000).toISOString(),
            nextDueAt: new Date(5000).toISOString(),
            history: []
          }
        ],
        [
          'ESP:capital',
          {
            id: 'ESP:capital',
            countryId: 'ESP',
            attributeId: 'capital',
            stage: 1,
            step: 0,
            reps: 3,
            lapses: 1,
            easeFactor: 2.4,
            intervalDays: 0,
            consecutiveRecallCorrect: 0,
            lastReviewedAt: new Date(5000).toISOString(),
            nextDueAt: new Date(5000).toISOString(),
            history: []
          }
        ]
      ],
      stats: {
        totalReviews: 7,
        totalCorrect: 5,
        currentStreak: 2,
        longestStreak: 2,
        lastReviewDate: '2026-10-11',
        updatedAt: new Date(5000).toISOString(),
        continentMastery: {},
        timeAttackRecords: {}
      }
    };

    const changed = StorageService.reconcileExternalData(newerPhonePayload);
    expect(changed).toBe(true);

    const afterPull = StorageService.loadSRSItems();
    expect(afterPull.get('FRA:capital')?.consecutiveRecallCorrect).toBe(0);
    expect(afterPull.get('ESP:capital')?.stage).toBe(1);
    expect(afterPull.get('ESP:capital')?.consecutiveRecallCorrect).toBe(0);

    // Continent mastery must also reflect that Europe now has 0 mastered and 2 learning
    const statsAfterPull = StorageService.loadStats();
    expect(statsAfterPull.continentMastery.Europe.mastered).toBe(0);
    expect(statsAfterPull.continentMastery.Europe.learning).toBe(2);

    // Conversely, if an OLDER external payload (t = 1000, where FRA was 1/2 and ESP was Stage 2)
    // is reconciled against the NEWER local state (t = 5000, where both are 0/2),
    // the older 1/2 or Stage 2 state must NEVER overwrite the newer 0/2 state!
    const olderSnapshotPayload = {
      srsItems: Array.from(olderLocalMap.entries()),
      stats: {
        totalReviews: 5,
        totalCorrect: 5,
        currentStreak: 1,
        longestStreak: 1,
        lastReviewDate: '2026-10-10',
        updatedAt: new Date(1000).toISOString(),
        continentMastery: {},
        timeAttackRecords: {}
      }
    };

    const overwrittenByOld = StorageService.reconcileExternalData(olderSnapshotPayload);
    expect(overwrittenByOld).toBe(false);

    const stillNewer = StorageService.loadSRSItems();
    expect(stillNewer.get('FRA:capital')?.consecutiveRecallCorrect).toBe(0);
    expect(stillNewer.get('ESP:capital')?.stage).toBe(1);
    expect(stillNewer.get('ESP:capital')?.consecutiveRecallCorrect).toBe(0);

    // And hasLocalNewerEvents must detect that local has newer events than the older remote snapshot so it pushes to GitHub
    expect(StorageService.hasLocalNewerEvents(olderSnapshotPayload)).toBe(true);
    expect(StorageService.hasLocalNewerEvents(newerPhonePayload)).toBe(false);
  });
});

