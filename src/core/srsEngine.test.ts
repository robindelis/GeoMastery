import { describe, it, expect } from 'vitest';
import {
  createInitialSRSItem,
  processAnswer,
  buildQuestion,
  computeMasteryStats,
  prepareSessionQueue,
  shuffleArray,
  computeRetrievability,
  deriveActRGrade,
  interleaveSessionQueue,
  classifyCardHorizon,
  calibrateSRSItem,
  MASTERY_STABILITY_DAYS,
  buildFlagStudyCohort,
  buildFlagCohortQuestions
} from './srsEngine';
import { COUNTRIES, COUNTRIES_BY_ID } from '../assets/data/countries';
import { WATER_BODIES } from '../assets/data/waterBodies';

describe('srsEngine Hybrid Geo-FSRS + ACT-R Latency & State Calibration', () => {
  it('initializes items in Stage 0 (Multiple Choice Scaffolding) with FSRS parameters', () => {
    const item = createInitialSRSItem('FRA', 'capital');
    expect(item.stage).toBe(0);
    expect(item.reps).toBe(0);
    expect(item.stability).toBe(0.4);
    expect(item.difficulty).toBe(5.0);

    const country = COUNTRIES_BY_ID.get('FRA')!;
    const q = buildQuestion(item, country, COUNTRIES);
    expect(q.expectedInputMode).toBe('multiple_choice');
    expect(q.options).toBeDefined();
    expect(q.options?.length).toBe(4);
    expect(q.options).toContain('Paris');
  });

  it('correctly calculates mastery statistics across all continents and oceans', () => {
    const itemsMap = new Map();
    const stats = computeMasteryStats(itemsMap);
    expect(stats.grandTotal).toBe(COUNTRIES.length * 2 + WATER_BODIES.length);
    expect(stats.masteryPercentage).toBe(0);
  });

  it('graduates from Stage 0 to Stage 1 on first correct answer with calibrated FSRS stability', () => {
    const initial = createInitialSRSItem('FRA', 'capital');
    const { updatedItem, promotedToLearning, promotedToMastered } = processAnswer(
      initial,
      true,
      'multiple_choice',
      'Paris',
      1200
    );

    expect(promotedToLearning).toBe(true);
    expect(promotedToMastered).toBe(false);
    expect(updatedItem.stage).toBe(1);
    expect(updatedItem.stability).toBeGreaterThan(1.0);
    expect(classifyCardHorizon(updatedItem)).toBe('learning');
  });

  it('progresses Stability S through consolidating recall into Mastered (Stage 2) via FSRS-6 DSR', () => {
    let item = createInitialSRSItem('ITA', 'capital');
    // 1. Initial MCQ -> Graduates to Stage 1 (Acquisition Learning)
    item = processAnswer(item, true, 'multiple_choice', 'Rome', 1500).updatedItem;
    expect(item.stage).toBe(1);
    expect(classifyCardHorizon(item)).toBe('learning');

    // 2. Active recall 1st success -> Enters Consolidating Recall (S >= 2.2d)
    const res1 = processAnswer(item, true, 'typing', 'Rome', 4200);
    item = res1.updatedItem;
    expect(item.stage).toBe(1);
    expect(classifyCardHorizon(item)).toBe('recall');
    expect(res1.promotedToMastered).toBe(false);

    // 3. Next active recall success -> Crosses MASTERY_STABILITY_DAYS (S >= 6.0d), promoted to Stage 2!
    const res2 = processAnswer(item, true, 'typing', 'Rome', 2500);
    item = res2.updatedItem;
    expect(item.stage).toBe(2);
    expect(item.stability).toBeGreaterThanOrEqual(MASTERY_STABILITY_DAYS);
    expect(classifyCardHorizon(item)).toBe('mastered');
    expect(res2.promotedToMastered).toBe(true);
    expect(item.intervalDays).toBeGreaterThanOrEqual(7);
  });

  it('reduces stability to post-lapse S_f upon failure in Stage 1 and requires re-stabilization', () => {
    let item = createInitialSRSItem('ESP', 'capital');
    item = processAnswer(item, true, 'multiple_choice', 'Madrid', 1200).updatedItem;
    item = processAnswer(item, true, 'typing', 'Madrid', 3500).updatedItem;
    expect(classifyCardHorizon(item)).toBe('recall');

    // Fail active recall -> post-lapse stability drops back into learning (< 2.2d)
    item = processAnswer(item, false, 'typing', 'Barcelona', 2000).updatedItem;
    expect(item.stage).toBe(1);
    expect(classifyCardHorizon(item)).toBe('learning');
    expect(item.intervalDays).toBe(0);

    // Recover through active recall back to Mastered
    item = processAnswer(item, true, 'typing', 'Madrid', 3500).updatedItem;
    expect(classifyCardHorizon(item)).toBe('recall');
    item = processAnswer(item, true, 'typing', 'Madrid', 2000).updatedItem;
    expect(item.stage).toBe(2);
    expect(classifyCardHorizon(item)).toBe('mastered');
  });

  it('demotes Mastered (Stage 2) card back to Stage 1 with post-lapse stability if missed later', () => {
    let item = createInitialSRSItem('JPN', 'location');
    item = processAnswer(item, true, 'multiple_choice', 'Japan', 1000).updatedItem;
    item = processAnswer(item, true, 'map_click', 'Japan', 1800).updatedItem;
    item = processAnswer(item, true, 'map_click', 'Japan', 1800).updatedItem;
    expect(item.stage).toBe(2);

    // Fail during long-term review
    item = processAnswer(item, false, 'map_click', 'Korea', 1500).updatedItem;
    expect(item.stage).toBe(1);
    expect(item.stability).toBeLessThan(MASTERY_STABILITY_DAYS);
    expect(item.intervalDays).toBe(0);
  });

  it('calibrates FSRS stability and difficulty automatically for legacy cards based on their state', () => {
    const legacyMastered: any = {
      id: 'BEL:capital',
      countryId: 'BEL',
      attributeId: 'capital',
      stage: 2,
      step: 3,
      easeFactor: 2.6,
      intervalDays: 14,
      reps: 4,
      lapses: 0,
      lastReviewedAt: new Date().toISOString(),
      nextDueAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      history: []
    };
    const calibrated = calibrateSRSItem(legacyMastered);
    expect(calibrated.stability).toBeGreaterThanOrEqual(14);
    expect(calibrated.difficulty).toBeGreaterThanOrEqual(1);
    expect(classifyCardHorizon(calibrated)).toBe('mastered');
  });

  it('correctly generates and verifies Slovakia location question', () => {
    const slovakia = COUNTRIES_BY_ID.get('SVK')!;
    expect(slovakia).toBeDefined();
    expect(slovakia.id).toBe('SVK');
    expect(slovakia.numericId).toBe('703');
    expect(slovakia.name).toBe('Slovakia');

    const item = createInitialSRSItem('SVK', 'location');
    const q = buildQuestion(item, slovakia, COUNTRIES);
    expect(q.expectedInputMode).toBe('map_click');
    expect(q.country.id).toBe('SVK');
    expect(q.country.name).toBe('Slovakia');
  });

  it('allows practice drill even when all cards are scheduled in the future', () => {
    // Simulate all European countries reviewed and scheduled for next week
    const itemsMap = new Map();
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const europeCountries = COUNTRIES.filter((c) => c.continent === 'Europe');

    for (const country of europeCountries) {
      for (const attr of ['capital', 'location']) {
        const item = createInitialSRSItem(country.id, attr);
        item.nextDueAt = futureDate;
        item.intervalDays = 7;
        item.stage = 1;
        itemsMap.set(item.id, item);
      }
    }

    // Normal queue should be empty (all caught up!)
    const normalQueue = prepareSessionQueue(itemsMap, 'Europe', ['capital', 'location'], 15, false);
    expect(normalQueue.length).toBe(0);

    // Practice drill queue should successfully generate questions from Europe!
    const practiceQueue = prepareSessionQueue(itemsMap, 'Europe', ['capital', 'location'], 15, true);
    expect(practiceQueue.length).toBe(15);
    for (const q of practiceQueue) {
      expect(q.country.continent).toBe('Europe');
    }
  });

  it('correctly distinguishes Stage 0 recognition vs Stage 1+ active recall for map placement questions', () => {
    const france = COUNTRIES_BY_ID.get('FRA')!;
    let item = createInitialSRSItem('FRA', 'location');
    expect(item.stage).toBe(0);

    // Initial Stage 0 question
    const q0 = buildQuestion(item, france, COUNTRIES);
    expect(q0.stage).toBe(0);
    expect(q0.expectedInputMode).toBe('map_click');

    // Answer correctly the first time -> graduates to Stage 1 (Active Recall)
    const res = processAnswer(item, true, 'map_click', 'France', 1500);
    expect(res.promotedToLearning).toBe(true);
    item = res.updatedItem;
    expect(item.stage).toBe(1);

    // Now in Stage 1 Active Recall stage:
    const q1 = buildQuestion(item, france, COUNTRIES);
    expect(q1.stage).toBe(1);
    expect(q1.stage >= 1).toBe(true);
    expect(q1.expectedInputMode).toBe('map_click');
  });

  it('includes oceans and straits in World review queue when location attribute is active', () => {
    const itemsMap = new Map();
    // Mark several water bodies as due
    for (const wb of WATER_BODIES.slice(0, 5)) {
      const item = createInitialSRSItem(wb.id, 'location');
      itemsMap.set(item.id, item);
    }

    const queue = prepareSessionQueue(itemsMap, 'All', ['location'], 15, false);
    const hasWaterQuestion = queue.some((q) => q.country.id.startsWith('WATER_'));
    expect(hasWaterQuestion).toBe(true);
  });

  it('includes oceans and straits in World practice drill mode when location is active', () => {
    const itemsMap = new Map();
    const queue = prepareSessionQueue(itemsMap, 'All', ['location'], 236, true);
    const waterQuestions = queue.filter((q) => q.country.id.startsWith('WATER_'));
    expect(waterQuestions.length).toBe(WATER_BODIES.length);
  });

  it('uniformly randomizes due items in World quiz to prevent being stuck in a single continent', () => {
    const itemsMap = new Map();
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const olderDate = new Date(Date.now() - 172800000).toISOString();

    // Give all 14 Oceania countries the OLDEST timestamps (simulating recent Oceania batch practice)
    const oceaniaCountries = COUNTRIES.filter((c) => c.continent === 'Oceania');
    for (const c of oceaniaCountries) {
      const itemCap = createInitialSRSItem(c.id, 'capital');
      itemCap.nextDueAt = olderDate;
      itemsMap.set(itemCap.id, itemCap);

      const itemLoc = createInitialSRSItem(c.id, 'location');
      itemLoc.nextDueAt = olderDate;
      itemsMap.set(itemLoc.id, itemLoc);
    }

    // Add 100 other due items from Europe, Asia, Africa with slightly newer timestamps
    const otherCountries = COUNTRIES.filter((c) => c.continent !== 'Oceania').slice(0, 50);
    for (const c of otherCountries) {
      const itemCap = createInitialSRSItem(c.id, 'capital');
      itemCap.nextDueAt = pastDate;
      itemsMap.set(itemCap.id, itemCap);

      const itemLoc = createInitialSRSItem(c.id, 'location');
      itemLoc.nextDueAt = pastDate;
      itemsMap.set(itemLoc.id, itemLoc);
    }

    // Draw a batch of 15 World questions
    const queue = prepareSessionQueue(itemsMap, 'All', ['capital', 'location'], 15, false);
    expect(queue.length).toBe(15);

    // Because the queue is uniformly randomized, it must NOT be 100% Oceania
    const nonOceaniaCount = queue.filter((q) => q.country.continent !== 'Oceania').length;
    expect(nonOceaniaCount).toBeGreaterThan(0);
  });

  it('shuffles arrays uniformly using Fisher-Yates shuffleArray without modifying original', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffleArray(original);
    expect(shuffled).toHaveLength(original.length);
    expect(new Set(shuffled)).toEqual(new Set(original));
    // Original array must be unchanged
    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('actively includes unseen Americas cards in global sessions instead of starving them behind hundreds of due Stage 1 cards', () => {
    const itemsMap = new Map();
    const pastDate = new Date(Date.now() - 86400000).toISOString();

    // Populate 200+ due Stage 1 cards in Europe, Asia, and Africa
    const otherCountries = COUNTRIES.filter((c) => c.continent === 'Europe' || c.continent === 'Asia' || c.continent === 'Africa');
    for (const c of otherCountries) {
      for (const attr of ['capital', 'location']) {
        const item = createInitialSRSItem(c.id, attr);
        item.stage = 1;
        item.stability = 3.2;
        item.nextDueAt = pastDate;
        item.intervalDays = 1;
        itemsMap.set(item.id, item);
      }
    }

    // Leave Americas countries completely unseen (!itemsMap.has(c.id))
    const americasCountries = COUNTRIES.filter((c) => c.continent === 'Americas');
    expect(americasCountries.length).toBeGreaterThanOrEqual(30);

    // Run 5 sessions of 15 cards
    let totalAmericasCardsDrawn = 0;
    for (let i = 0; i < 5; i++) {
      const queue = prepareSessionQueue(itemsMap, 'All', ['capital', 'location'], 15, false);
      expect(queue.length).toBe(15);
      const americasCount = queue.filter((q) => q.country.continent === 'Americas').length;
      totalAmericasCardsDrawn += americasCount;
    }

    // Unseen Americas cards must NOT be starved (should average several per session)
    expect(totalAmericasCardsDrawn).toBeGreaterThanOrEqual(10);
  });

  it('includes 1-2 Mastered cards for retention checking even when scheduled in the future, and demotes upon incorrect answer', () => {
    const itemsMap = new Map();
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const futureDate = new Date(Date.now() + 14 * 86400000).toISOString();

    // Create 15 Mastered cards scheduled in the future
    const masteredCountries = COUNTRIES.slice(0, 15);
    for (const c of masteredCountries) {
      const item = createInitialSRSItem(c.id, 'capital');
      item.stage = 2;
      item.stability = 14;
      item.intervalDays = 14;
      item.nextDueAt = futureDate;
      item.lastReviewedAt = new Date(Date.now() - 3 * 86400000).toISOString();
      itemsMap.set(item.id, item);
    }

    // Add some due Stage 1 cards
    const dueCountries = COUNTRIES.slice(15, 30);
    for (const c of dueCountries) {
      const item = createInitialSRSItem(c.id, 'capital');
      item.stage = 1;
      item.stability = 1.4;
      item.intervalDays = 1;
      item.nextDueAt = pastDate;
      itemsMap.set(item.id, item);
    }

    const queue = prepareSessionQueue(itemsMap, 'All', ['capital'], 15, false);
    expect(queue.length).toBe(15);

    // Verify retention check: at least 1-2 Mastered cards should appear in the queue
    const masteredInQueue = queue.filter((q) => {
      const item = itemsMap.get(q.srsItemId);
      return item && item.stage === 2;
    });
    expect(masteredInQueue.length).toBeGreaterThanOrEqual(1);
    expect(masteredInQueue.length).toBeLessThanOrEqual(2);

    // Verify that answering a Mastered card incorrectly demotes it to Stage 1 with post-lapse stability
    const masteredCard = itemsMap.get(masteredInQueue[0].srsItemId)!;
    expect(masteredCard.stage).toBe(2);
    expect(masteredCard.stability).toBe(14);

    const { updatedItem } = processAnswer(masteredCard, false, 'typing', 'WrongAnswer', 2000);
    expect(updatedItem.stage).toBe(1);
    expect(updatedItem.stability).toBeLessThan(MASTERY_STABILITY_DAYS);
    expect(updatedItem.intervalDays).toBe(0);
  });

  it('computes FSRS-6 power-law retrievability R(t, S) = 90% when elapsed time equals stability S', () => {
    const item = createInitialSRSItem('FRA', 'capital');
    item.stability = 10;
    const nowMs = Date.now();
    item.lastReviewedAt = new Date(nowMs - 10 * 86400000).toISOString();

    const R = computeRetrievability(item, nowMs);
    expect(R).toBeCloseTo(0.9, 3);
  });

  it('differentiates intervals and stability via ACT-R response latency grades (Fast Easy vs Slow Hard)', () => {
    expect(deriveActRGrade(true, 'typing', 1500)).toBe(4); // Easy
    expect(deriveActRGrade(true, 'typing', 5000)).toBe(3); // Good
    expect(deriveActRGrade(true, 'typing', 11000)).toBe(2); // Hard
    expect(deriveActRGrade(false, 'typing', 1500)).toBe(1); // Again

    // Fast fluent learner vs slow hesitant learner on the exact same card
    let fastItem = createInitialSRSItem('DEU', 'capital');
    fastItem = processAnswer(fastItem, true, 'multiple_choice', 'Berlin', 1100).updatedItem;
    fastItem = processAnswer(fastItem, true, 'typing', 'Berlin', 1600).updatedItem;
    fastItem = processAnswer(fastItem, true, 'typing', 'Berlin', 1500).updatedItem;

    let slowItem = createInitialSRSItem('DEU', 'capital');
    slowItem = processAnswer(slowItem, true, 'multiple_choice', 'Berlin', 7000).updatedItem;
    slowItem = processAnswer(slowItem, true, 'typing', 'Berlin', 11000).updatedItem;
    slowItem = processAnswer(slowItem, true, 'typing', 'Berlin', 12000).updatedItem;

    expect(fastItem.stage).toBe(2);
    expect(slowItem.stage).toBe(1); // Slow Hard recall stays in consolidating recall longer
    expect(fastItem.stability!).toBeGreaterThan(slowItem.stability!);
    expect(fastItem.intervalDays).toBeGreaterThan(slowItem.intervalDays);
    expect(fastItem.difficulty!).toBeLessThan(slowItem.difficulty!);
  });

  it('tracks LECTOR confused country pairs and injects them as high-salience distractors', () => {
    let item = createInitialSRSItem('SVK', 'capital');
    // Learner confuses Slovakia with Slovenia's capital (Ljubljana)
    item = processAnswer(item, false, 'typing', 'Ljubljana', 3500).updatedItem;
    expect(item.confusedWith).toContain('SVN');

    // When building a Stage 0 recognition question, Ljubljana must appear in the 4 options
    item.stage = 0;
    const slovakia = COUNTRIES_BY_ID.get('SVK')!;
    const q = buildQuestion(item, slovakia, COUNTRIES);
    expect(q.options).toContain('Bratislava');
    expect(q.options).toContain('Ljubljana');
  });

  it('interleaves same-country capital and location cards at least 4 questions apart', () => {
    const sampleCountries = COUNTRIES.slice(0, 8);
    const questions = [
      buildQuestion(createInitialSRSItem(sampleCountries[0].id, 'capital'), sampleCountries[0], COUNTRIES),
      buildQuestion(createInitialSRSItem(sampleCountries[0].id, 'location'), sampleCountries[0], COUNTRIES),
      ...sampleCountries.slice(1).map((c) => buildQuestion(createInitialSRSItem(c.id, 'capital'), c, COUNTRIES))
    ];

    const interleaved = interleaveSessionQueue(questions, 4);
    const indices = interleaved
      .map((q, idx) => (q.country.id === sampleCountries[0].id ? idx : -1))
      .filter((idx) => idx !== -1);

    expect(indices.length).toBe(2);
    expect(indices[1] - indices[0]).toBeGreaterThanOrEqual(4);
  });

  it('always uses typing recall for country (Map -> Name) and flag (Flag -> Name) questions across all stages', () => {
    const france = COUNTRIES_BY_ID.get('FRA')!;
    let countryItem = createInitialSRSItem('FRA', 'country');
    let flagItem = createInitialSRSItem('FRA', 'flag');

    const qCountry0 = buildQuestion(countryItem, france, COUNTRIES);
    expect(qCountry0.expectedInputMode).toBe('typing');
    expect(qCountry0.options).toBeUndefined();
    expect(qCountry0.correctAnswer).toBe('France');
    expect(qCountry0.prompt).toContain('highlighted on the map');

    const qFlag0 = buildQuestion(flagItem, france, COUNTRIES);
    expect(qFlag0.expectedInputMode).toBe('typing');
    expect(qFlag0.options).toBeUndefined();
    expect(qFlag0.correctAnswer).toBe('France');
    expect(qFlag0.prompt).toContain('flag');

    // Progress through Stage 0 -> Stage 1 -> Stage 2 via typing answers
    countryItem = processAnswer(countryItem, true, 'typing', 'France', 1800).updatedItem;
    expect(countryItem.stage).toBe(1);
    countryItem = processAnswer(countryItem, true, 'typing', 'France', 2000).updatedItem;
    countryItem = processAnswer(countryItem, true, 'typing', 'France', 1800).updatedItem;
    expect(countryItem.stage).toBe(2);
  });

  it('builds a 50-flag study cohort that includes all upcoming session flag questions and generates roll-through questions', () => {
    const itemsMap = new Map();
    const sessionQueue = prepareSessionQueue(itemsMap, 'All', ['capital', 'flag'], 15, false);
    const cohort = buildFlagStudyCohort(itemsMap, 'All', sessionQueue, 50);

    expect(cohort.length).toBe(50);

    const cohortIds = new Set(cohort.map((c) => c.id));
    for (const q of sessionQueue) {
      if (q.attributeId === 'flag') {
        expect(cohortIds.has(q.country.id)).toBe(true);
      }
    }

    const rollQueue = buildFlagCohortQuestions(itemsMap, cohort);
    expect(rollQueue.length).toBe(50);
    for (const q of rollQueue) {
      expect(q.attributeId).toBe('flag');
      expect(q.expectedInputMode).toBe('typing');
    }
  });
});


