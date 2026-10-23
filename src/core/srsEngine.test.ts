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
  buildFlagCohortQuestions,
  scheduleInStreamFollowUp,
  replenishStreamQueue
} from './srsEngine';
import { COUNTRIES, COUNTRIES_BY_ID } from '../assets/data/countries';
import { WATER_BODIES } from '../assets/data/waterBodies';
import { SRSItem } from './types';

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

  it('progresses Stability S through consolidating recall into Mastered (Stage 2) via time-gated FSRS-6 DSR', () => {
    let item = createInitialSRSItem('ITA', 'capital');
    // 1. Initial MCQ -> Graduates to Stage 1 (Acquisition Learning, due in 15m)
    item = processAnswer(item, true, 'multiple_choice', 'Rome', 1500).updatedItem;
    expect(item.stage).toBe(1);
    expect(classifyCardHorizon(item)).toBe('learning');

    // Simulate 15 minutes of elapsed intraday time before active recall verification
    item.lastReviewedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // 2. Active recall 1st success (after 15m) -> Enters Consolidating Recall (S >= 2.2d, due tomorrow)
    const res1 = processAnswer(item, true, 'typing', 'Rome', 4200);
    item = res1.updatedItem;
    expect(item.stage).toBe(1);
    expect(classifyCardHorizon(item)).toBe('recall');
    expect(res1.promotedToMastered).toBe(false);

    // Simulate 1 day (24h) of overnight consolidation before next review
    item.lastReviewedAt = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // 3. Next active recall success on subsequent day -> Crosses MASTERY_STABILITY_DAYS (S >= 6.0d), promoted to Stage 2!
    const res2 = processAnswer(item, true, 'typing', 'Rome', 2500);
    item = res2.updatedItem;
    expect(item.stage).toBe(2);
    expect(item.stability).toBeGreaterThanOrEqual(MASTERY_STABILITY_DAYS);
    expect(classifyCardHorizon(item)).toBe('mastered');
    expect(res2.promotedToMastered).toBe(true);
    expect(item.intervalDays).toBeGreaterThanOrEqual(7);
  });

  it('reduces stability to post-lapse S_f upon failure in Stage 1 and requires time-spaced re-stabilization', () => {
    let item = createInitialSRSItem('ESP', 'capital');
    item = processAnswer(item, true, 'multiple_choice', 'Madrid', 1200).updatedItem;
    item.lastReviewedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    item = processAnswer(item, true, 'typing', 'Madrid', 3500).updatedItem;
    expect(classifyCardHorizon(item)).toBe('recall');

    // Fail active recall -> post-lapse stability drops back into learning (< 2.2d), scheduled in 10 minutes
    item = processAnswer(item, false, 'typing', 'Barcelona', 2000).updatedItem;
    expect(item.stage).toBe(1);
    expect(classifyCardHorizon(item)).toBe('learning');
    expect(item.intervalDays).toBeLessThan(1);

    // Recover through time-spaced active recall (after 15 minutes, then next day) back to Mastered
    item.lastReviewedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    item = processAnswer(item, true, 'typing', 'Madrid', 3500).updatedItem;
    expect(classifyCardHorizon(item)).toBe('recall');

    item.lastReviewedAt = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    item = processAnswer(item, true, 'typing', 'Madrid', 2000).updatedItem;
    expect(item.stage).toBe(2);
    expect(classifyCardHorizon(item)).toBe('mastered');
  });

  it('demotes Mastered (Stage 2) card back to Stage 1 with post-lapse stability if missed later', () => {
    let item = createInitialSRSItem('JPN', 'location');
    item = processAnswer(item, true, 'multiple_choice', 'Japan', 1000).updatedItem;
    item.lastReviewedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    item = processAnswer(item, true, 'map_click', 'Japan', 1800).updatedItem;
    item.lastReviewedAt = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    item = processAnswer(item, true, 'map_click', 'Japan', 1800).updatedItem;
    expect(item.stage).toBe(2);

    // Fail during long-term review
    item = processAnswer(item, false, 'map_click', 'Korea', 1500).updatedItem;
    expect(item.stage).toBe(1);
    expect(item.stability).toBeLessThan(MASTERY_STABILITY_DAYS);
    expect(item.intervalDays).toBeLessThan(1);
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
    expect(updatedItem.intervalDays).toBeLessThan(1);
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

    // Fast fluent learner vs slow hesitant learner on the exact same card across spaced reviews
    let fastItem = createInitialSRSItem('DEU', 'capital');
    fastItem = processAnswer(fastItem, true, 'multiple_choice', 'Berlin', 1100).updatedItem;
    fastItem.lastReviewedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    fastItem = processAnswer(fastItem, true, 'typing', 'Berlin', 1600).updatedItem;
    fastItem.lastReviewedAt = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    fastItem = processAnswer(fastItem, true, 'typing', 'Berlin', 1500).updatedItem;

    let slowItem = createInitialSRSItem('DEU', 'capital');
    slowItem = processAnswer(slowItem, true, 'multiple_choice', 'Berlin', 7000).updatedItem;
    slowItem.lastReviewedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    slowItem = processAnswer(slowItem, true, 'typing', 'Berlin', 11000).updatedItem;
    slowItem.lastReviewedAt = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
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

    // Progress through Stage 0 -> Stage 1 -> Stage 2 via time-spaced typing answers
    countryItem = processAnswer(countryItem, true, 'typing', 'France', 1800).updatedItem;
    expect(countryItem.stage).toBe(1);
    countryItem.lastReviewedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    countryItem = processAnswer(countryItem, true, 'typing', 'France', 2000).updatedItem;
    countryItem.lastReviewedAt = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    countryItem = processAnswer(countryItem, true, 'typing', 'France', 1800).updatedItem;
    expect(countryItem.stage).toBe(2);
  });

  it('builds a smart 50-flag study cohort (pushing unmastered flags with a small subset of mastered flags) and exclusively restricts continuous stream flag questions to that 50-flag cohort', () => {
    const itemsMap = new Map<string, SRSItem>();
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const tenDaysFuture = new Date(Date.now() + 10 * 86400000).toISOString();

    // Seed 25 Mastered flags and 20 in-progress unmastered flags across the world
    COUNTRIES.slice(0, 25).forEach((c) => {
      const m = createInitialSRSItem(c.id, 'flag');
      m.stage = 2;
      m.stability = 14;
      m.intervalDays = 14;
      m.lastReviewedAt = threeDaysAgo;
      m.nextDueAt = tenDaysFuture;
      itemsMap.set(m.id, m);
    });

    COUNTRIES.slice(25, 45).forEach((c, idx) => {
      const l = createInitialSRSItem(c.id, 'flag');
      l.stage = 1;
      l.stability = idx % 2 === 0 ? 1.4 : 2.8;
      l.intervalDays = 1;
      l.lastReviewedAt = threeDaysAgo;
      l.nextDueAt = new Date(Date.now() - 3600000).toISOString(); // Due now
      itemsMap.set(l.id, l);
    });

    // 1. Build the 50-flag cohort for a new continuous session
    const cohort = buildFlagStudyCohort(itemsMap, 'All', [], 50);
    expect(cohort.length).toBe(50);

    const cohortIds = new Set(cohort.map((c) => c.id));
    expect(cohortIds.size).toBe(50);

    // Verify smart composition: pushes unmastered flags (~86%) with a small subset of mastered flags (~14%, ~7 flags)
    const masteredInCohort = cohort.filter(
      (c) => classifyCardHorizon(itemsMap.get(`${c.id}:flag`)) === 'mastered'
    );
    const unmasteredInCohort = cohort.filter(
      (c) => classifyCardHorizon(itemsMap.get(`${c.id}:flag`)) !== 'mastered'
    );
    expect(masteredInCohort.length).toBeGreaterThanOrEqual(3);
    expect(masteredInCohort.length).toBeLessThanOrEqual(10);
    expect(unmasteredInCohort.length).toBeGreaterThanOrEqual(40);

    // 2. Verify that initial stream and multiple replenishments ONLY suggest flag questions from cohortIds
    let stream = replenishStreamQueue([], -1, itemsMap, 'All', ['flag'], 24, false, cohortIds);
    expect(stream.queue.length).toBe(24);
    for (const q of stream.queue) {
      expect(q.attributeId).toBe('flag');
      expect(cohortIds.has(q.country.id)).toBe(true);
    }

    // Replenish again mid-stream
    stream = replenishStreamQueue(stream.queue, 15, itemsMap, 'All', ['flag'], 18, false, cohortIds);
    for (const q of stream.queue) {
      expect(cohortIds.has(q.country.id)).toBe(true);
    }

    // Even in practice/fallback mode, 100% of flag questions must come from cohortIds
    const practiceStream = replenishStreamQueue([], -1, itemsMap, 'All', ['flag'], 30, true, cohortIds);
    expect(practiceStream.queue.length).toBe(30);
    for (const q of practiceStream.queue) {
      expect(cohortIds.has(q.country.id)).toBe(true);
    }

    const rollQueue = buildFlagCohortQuestions(itemsMap, cohort);
    expect(rollQueue.length).toBe(50);
    for (const q of rollQueue) {
      expect(q.attributeId).toBe('flag');
      expect(q.expectedInputMode).toBe('typing');
      expect(cohortIds.has(q.country.id)).toBe(true);
    }
  });

  it('enforces real wall-clock time spacing: never re-queues correct cards immediately and blocks rapid 5-minute promotions to Recall or Mastered', () => {
    const itemsMap = new Map();
    const initialStream = replenishStreamQueue([], -1, itemsMap, 'Europe', ['capital'], 24, false);
    let queue = initialStream.queue;
    expect(queue.length).toBe(24);

    const firstQ = queue[0];
    expect(firstQ.stage).toBe(0);

    // 1. Answer Stage 0 correctly -> Graduates to Stage 1 Learning, scheduled 15 minutes in the future
    const item0 = createInitialSRSItem(firstQ.country.id, firstQ.attributeId);
    const res1 = processAnswer(item0, true, firstQ.expectedInputMode, firstQ.correctAnswer, 1400);
    itemsMap.set(res1.updatedItem.id, res1.updatedItem);
    expect(classifyCardHorizon(res1.updatedItem)).toBe('learning');
    expect(new Date(res1.updatedItem.nextDueAt).getTime()).toBeGreaterThan(Date.now() + 10 * 60 * 1000);

    // Verify scheduleInStreamFollowUp does NOT re-insert a correctly answered card into the upcoming queue
    queue = scheduleInStreamFollowUp(queue, 0, firstQ, res1.updatedItem, true, false);
    const duplicateIdx = queue.findIndex((q, idx) => idx > 0 && q.srsItemId === firstQ.srsItemId);
    expect(duplicateIdx).toBe(-1);

    // 2. Even if the user somehow answers the card again 2 minutes later and 4 minutes later,
    // it MUST stay in 'learning' and CANNOT jump to 'recall' or 'mastered' without real elapsed time!
    let rapidItem: SRSItem = {
      ...res1.updatedItem,
      lastReviewedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
    };
    rapidItem = processAnswer(rapidItem, true, 'typing', firstQ.correctAnswer, 1400).updatedItem;
    expect(classifyCardHorizon(rapidItem)).toBe('learning');
    expect(rapidItem.stage).toBe(1);

    rapidItem = {
      ...rapidItem,
      lastReviewedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString()
    };
    rapidItem = processAnswer(rapidItem, true, 'typing', firstQ.correctAnswer, 1200).updatedItem;
    expect(classifyCardHorizon(rapidItem)).toBe('learning');
    expect(rapidItem.stage).toBe(1);

    // 3. Even after 20 minutes (which allows advancing from Learning -> Recall),
    // answering again 30 minutes later on the same day CANNOT jump to Mastered without >=8h overnight consolidation!
    let intradayItem: SRSItem = {
      ...res1.updatedItem,
      lastReviewedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString()
    };
    intradayItem = processAnswer(intradayItem, true, 'typing', firstQ.correctAnswer, 1400).updatedItem;
    expect(classifyCardHorizon(intradayItem)).toBe('recall');
    expect(intradayItem.stage).toBe(1);

    intradayItem = {
      ...intradayItem,
      lastReviewedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
    };
    intradayItem = processAnswer(intradayItem, true, 'typing', firstQ.correctAnswer, 1400).updatedItem;
    expect(classifyCardHorizon(intradayItem)).toBe('recall');
    expect(intradayItem.stage).toBe(1);
  });

  it('replenishes the continuous stream without duplicating upcoming cards and marks non-due fallback cards as non-mutating retries', () => {
    const itemsMap = new Map();
    const initial = replenishStreamQueue([], -1, itemsMap, 'Oceania', ['capital'], 10, false);
    expect(initial.queue.length).toBe(10);

    const replenished = replenishStreamQueue(initial.queue, 4, itemsMap, 'Oceania', ['capital'], 8, false);
    expect(replenished.queue.length).toBeGreaterThan(10);

    // Ensure no duplicate srsItemId in the active upcoming window [5..end]
    const upcomingSlice = replenished.queue.slice(5);
    const uniqueUpcoming = new Set(upcomingSlice.map((q) => q.srsItemId));
    expect(uniqueUpcoming.size).toBe(upcomingSlice.length);
  });

  it('generates bidirectional Capital -> Country questions with Stage 0 4-country recognition, LECTOR distractors, and Stage 1+ country typing recall', () => {
    const slovakia = COUNTRIES_BY_ID.get('SVK')!;
    let item = createInitialSRSItem('SVK', 'capital');
    item.confusedWith = ['SVN'];

    // Stage 0: 4-choice country recognition with LECTOR distractor (Slovenia)
    const q0 = buildQuestion(item, slovakia, COUNTRIES, 'capital_to_country');
    expect(q0.questionDirection).toBe('capital_to_country');
    expect(q0.expectedInputMode).toBe('multiple_choice');
    expect(q0.correctAnswer).toBe('Slovakia');
    expect(q0.prompt).toContain('Bratislava');
    expect(q0.options).toHaveLength(4);
    expect(q0.options).toContain('Slovakia');
    expect(q0.options).toContain('Slovenia');

    // Graduate to Stage 1 -> Active typing recall of the country name
    item = processAnswer(item, true, 'multiple_choice', 'Slovakia', 1400).updatedItem;
    expect(item.stage).toBe(1);

    const q1 = buildQuestion(item, slovakia, COUNTRIES, 'capital_to_country');
    expect(q1.questionDirection).toBe('capital_to_country');
    expect(q1.expectedInputMode).toBe('typing');
    expect(q1.options).toBeUndefined();
    expect(q1.correctAnswer).toBe('Slovakia');
    expect(q1.prompt).toContain('Bratislava');

    // Verify prepareSessionQueue alternates both directions for capital questions
    const queue = prepareSessionQueue(new Map(), 'Europe', ['capital'], 10, true);
    const countryToCap = queue.filter((q) => q.questionDirection === 'country_to_capital');
    const capToCountry = queue.filter((q) => q.questionDirection === 'capital_to_country');
    expect(countryToCap.length).toBeGreaterThan(0);
    expect(capToCountry.length).toBeGreaterThan(0);
  });
});




