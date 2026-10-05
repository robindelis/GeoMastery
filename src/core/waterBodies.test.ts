import { describe, it, expect } from 'vitest';
import { WATER_BODIES, getWaterBodyById, WATER_BODIES_BY_ID } from '../assets/data/waterBodies';
import {
  waterBodyToCountry,
  buildQuestion,
  prepareSessionQueue,
  computeMasteryStats,
  createInitialSRSItem,
  processAnswer
} from './srsEngine';
import { SRSItem } from './types';

describe('Water Bodies & Maritime Hydrography Dataset', () => {
  it('contains exactly 40 curated major oceans, seas, straits, and gulfs', () => {
    expect(WATER_BODIES.length).toBe(40);
  });

  it('contains all 5 global oceans', () => {
    const oceans = WATER_BODIES.filter((w) => w.type === 'ocean');
    expect(oceans.length).toBe(5);
    const names = oceans.map((o) => o.name);
    expect(names).toContain('Pacific Ocean');
    expect(names).toContain('Atlantic Ocean');
    expect(names).toContain('Indian Ocean');
    expect(names).toContain('Arctic Ocean');
    expect(names).toContain('Southern Ocean');
  });

  it('contains critical straits and canals', () => {
    const straits = WATER_BODIES.filter((w) => w.type === 'strait' || w.type === 'channel');
    expect(straits.length).toBeGreaterThanOrEqual(12);
    const names = straits.map((s) => s.name);
    expect(names).toContain('Strait of Gibraltar');
    expect(names).toContain('Strait of Hormuz');
    expect(names).toContain('Strait of Malacca');
    expect(names).toContain('Bosporus Strait');
    expect(names).toContain('Dardanelles Strait');
    expect(names).toContain('Bab-el-Mandeb Strait');
    expect(names).toContain('English Channel');
    expect(names).toContain('Suez Canal');
    expect(names).toContain('Panama Canal');
  });

  it('has valid coordinates for all water bodies within [-180, 180] lng and [-90, 90] lat', () => {
    for (const wb of WATER_BODIES) {
      expect(wb.id).toMatch(/^WATER_/);
      expect(wb.coordinates).toHaveLength(2);
      const [lng, lat] = wb.coordinates;
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(wb.name.length).toBeGreaterThan(0);
      expect(wb.significance.length).toBeGreaterThan(0);
    }
  });

  it('guarantees unique IDs across all entries', () => {
    const idSet = new Set(WATER_BODIES.map((w) => w.id));
    expect(idSet.size).toBe(WATER_BODIES.length);
  });

  it('retrieves entries accurately via getWaterBodyById', () => {
    const gibraltar = getWaterBodyById('WATER_STRAIT_GIBRALTAR');
    expect(gibraltar).toBeDefined();
    expect(gibraltar?.name).toBe('Strait of Gibraltar');
    expect(gibraltar?.type).toBe('strait');
    expect(gibraltar?.frenchName).toBe('Détroit de Gibraltar');
  });
});

describe('Water Bodies SRS & Question Integration', () => {
  it('converts a WaterBody into a valid synthetic Country object', () => {
    const wb = getWaterBodyById('WATER_STRAIT_GIBRALTAR')!;
    const country = waterBodyToCountry(wb);
    expect(country.id).toBe('WATER_STRAIT_GIBRALTAR');
    expect(country.name).toBe('Strait of Gibraltar');
    expect(country.flagEmoji).toBe('⚓');
    expect(country.coordinates).toEqual(wb.coordinates);
    expect(country.subregion).toBe('STRAIT');
  });

  it('builds a map click question for water bodies', () => {
    const wb = getWaterBodyById('WATER_SEA_MEDITERRANEAN')!;
    const country = waterBodyToCountry(wb);
    const item = createInitialSRSItem(wb.id, 'location');
    const question = buildQuestion(item, country, [country]);

    expect(question.expectedInputMode).toBe('map_click');
    expect(question.prompt).toContain('Mediterranean Sea');
    expect(question.correctAnswer).toBe('Mediterranean Sea');
    expect(question.waterBody).toBeDefined();
    // In Stage 0, options are populated with 4 choices
    expect(question.options).toBeDefined();
    expect(question.options?.length).toBe(4);
    expect(question.options).toContain('Mediterranean Sea');
  });

  it('prepares an Oceans training session queue correctly', () => {
    const emptyMap = new Map<string, SRSItem>();
    const queue = prepareSessionQueue(emptyMap, 'Oceans', ['location'], 10, false);

    expect(queue.length).toBe(10);
    for (const q of queue) {
      expect(q.waterBody).toBeDefined();
      expect(q.country.id).toMatch(/^WATER_/);
      expect(q.expectedInputMode).toBe('map_click');
    }
  });

  it('prepares an Oceans practice drill queue correctly', () => {
    const emptyMap = new Map<string, SRSItem>();
    const queue = prepareSessionQueue(emptyMap, 'Oceans', ['location'], 15, true);

    expect(queue.length).toBe(15);
    for (const q of queue) {
      expect(q.waterBody).toBeDefined();
      expect(q.country.id).toMatch(/^WATER_/);
    }
  });

  it('computes mastery stats including dedicated waterBreakdown', () => {
    const itemsMap = new Map<string, SRSItem>();
    // Master Gibraltar
    const itemGibraltar = createInitialSRSItem('WATER_STRAIT_GIBRALTAR', 'location');
    itemGibraltar.stage = 2;
    itemsMap.set(itemGibraltar.id, itemGibraltar);

    // Learning Mediterranean
    const itemMed = createInitialSRSItem('WATER_SEA_MEDITERRANEAN', 'location');
    itemMed.stage = 1;
    itemsMap.set(itemMed.id, itemMed);

    const stats = computeMasteryStats(itemsMap);
    expect(stats.waterBreakdown).toBeDefined();
    expect(stats.waterBreakdown.total).toBe(40);
    expect(stats.waterBreakdown.stage2).toBe(1);
    expect(stats.waterBreakdown.stage1).toBe(1);
    expect(stats.waterBreakdown.stage0).toBe(38);
  });

  it('handles surrender (__DONT_KNOW__) correctly via processAnswer', () => {
    const wb = getWaterBodyById('WATER_STRAIT_HORMUZ')!;
    const item = createInitialSRSItem(wb.id, 'location');
    item.stage = 2; // Was mastered
    item.intervalDays = 6;
    item.consecutiveRecallCorrect = 2;

    const res = processAnswer(item, false, 'map_click', '__DONT_KNOW__', 1500);
    expect(res.updatedItem.stage).toBe(1); // demoted from 2 to 1
    expect(res.updatedItem.intervalDays).toBe(0); // reset interval
    expect(res.updatedItem.consecutiveRecallCorrect).toBe(0); // reset streak
    expect(res.updatedItem.lapses).toBe(1);
  });
});
