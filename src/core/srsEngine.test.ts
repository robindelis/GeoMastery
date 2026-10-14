import { describe, it, expect } from 'vitest';
import {
  createInitialSRSItem,
  processAnswer,
  buildQuestion,
  computeMasteryStats,
  prepareSessionQueue,
  shuffleArray
} from './srsEngine';
import { COUNTRIES, COUNTRIES_BY_ID } from '../assets/data/countries';
import { WATER_BODIES } from '../assets/data/waterBodies';

describe('srsEngine Cognitive Scaffolding & 2-Streak Mastery', () => {
  it('initializes items in Stage 0 (Multiple Choice Scaffolding)', () => {
    const item = createInitialSRSItem('FRA', 'capital');
    expect(item.stage).toBe(0);
    expect(item.reps).toBe(0);
    expect(item.consecutiveRecallCorrect).toBe(0);

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

  it('graduates from Stage 0 to Stage 1 on first correct answer with 0 recall streak', () => {
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
    expect(updatedItem.consecutiveRecallCorrect).toBe(0); // Not yet tested in recall
  });

  it('requires 2 consecutive correct active recall answers to become Mastered', () => {
    let item = createInitialSRSItem('ITA', 'capital');
    // 1. Initial MCQ -> Correct
    item = processAnswer(item, true, 'multiple_choice', 'Rome', 1000).updatedItem;
    expect(item.stage).toBe(1);
    expect(item.consecutiveRecallCorrect).toBe(0);

    // 2. Active recall 1st success -> consecutive = 1, stays in Stage 1
    const res1 = processAnswer(item, true, 'typing', 'Rome', 1000);
    item = res1.updatedItem;
    expect(item.stage).toBe(1);
    expect(item.consecutiveRecallCorrect).toBe(1);
    expect(res1.promotedToMastered).toBe(false);

    // 3. Active recall 2nd consecutive success -> consecutive = 2, promoted to Stage 2 (Mastered)!
    const res2 = processAnswer(item, true, 'typing', 'Rome', 1000);
    item = res2.updatedItem;
    expect(item.stage).toBe(2);
    expect(item.consecutiveRecallCorrect).toBe(2);
    expect(res2.promotedToMastered).toBe(true);
    expect(item.intervalDays).toBeGreaterThanOrEqual(7);
  });

  it('resets the consecutive counter to 0 upon failure in Stage 1', () => {
    let item = createInitialSRSItem('ESP', 'capital');
    // MCQ correct -> Stage 1
    item = processAnswer(item, true, 'multiple_choice', 'Madrid', 1000).updatedItem;
    expect(item.stage).toBe(1);

    // 1st active recall -> Correct
    item = processAnswer(item, true, 'typing', 'Madrid', 1000).updatedItem;
    expect(item.consecutiveRecallCorrect).toBe(1);

    // 2nd active recall -> Failed!
    item = processAnswer(item, false, 'typing', 'Barcelona', 1000).updatedItem;
    expect(item.consecutiveRecallCorrect).toBe(0); // Reset to 0!
    expect(item.stage).toBe(1);

    // 3rd active recall -> Correct again (only 1st in new streak)
    const res3 = processAnswer(item, true, 'typing', 'Madrid', 1000);
    item = res3.updatedItem;
    expect(item.consecutiveRecallCorrect).toBe(1);
    expect(item.stage).toBe(1); // Not mastered yet!

    // 4th active recall -> Correct again (2nd in new streak) -> Promoted!
    const res4 = processAnswer(item, true, 'typing', 'Madrid', 1000);
    item = res4.updatedItem;
    expect(item.consecutiveRecallCorrect).toBe(2);
    expect(item.stage).toBe(2); // Now Mastered!
  });

  it('drops out of Mastered (Stage 2) back to Stage 1 with 0 streak if missed later', () => {
    let item = createInitialSRSItem('JPN', 'location');
    // Pass MCQ
    item = processAnswer(item, true, 'multiple_choice', 'Japan', 1000).updatedItem;
    // Pass 2 recalls
    item = processAnswer(item, true, 'map_click', 'Japan', 1000).updatedItem;
    item = processAnswer(item, true, 'map_click', 'Japan', 1000).updatedItem;
    expect(item.stage).toBe(2);

    // Now fail during long-term review
    item = processAnswer(item, false, 'map_click', 'Korea', 1000).updatedItem;
    expect(item.stage).toBe(1); // Dropped back to Learning
    expect(item.consecutiveRecallCorrect).toBe(0); // Streak reset
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
        item.consecutiveRecallCorrect = 1;
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

    // Create 15 Mastered (2/2) cards scheduled in the future
    const masteredCountries = COUNTRIES.slice(0, 15);
    for (const c of masteredCountries) {
      const item = createInitialSRSItem(c.id, 'capital');
      item.stage = 2;
      item.consecutiveRecallCorrect = 2;
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
      item.consecutiveRecallCorrect = 0;
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

    // Verify that answering a Mastered card incorrectly demotes it to Stage 1 with 0 recall streak
    const masteredCard = itemsMap.get(masteredInQueue[0].srsItemId)!;
    expect(masteredCard.stage).toBe(2);
    expect(masteredCard.consecutiveRecallCorrect).toBe(2);

    const { updatedItem } = processAnswer(masteredCard, false, 'typing', 'WrongAnswer', 2000);
    expect(updatedItem.stage).toBe(1);
    expect(updatedItem.consecutiveRecallCorrect).toBe(0);
    expect(updatedItem.intervalDays).toBe(0);
  });
});


