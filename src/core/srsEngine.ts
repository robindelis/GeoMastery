import { Country, Continent, SRSItem, SRSStage, InputMode, TrainingCategory, SRSHistoryEntry } from './types';
import { COUNTRIES, COUNTRIES_BY_ID } from '../assets/data/countries';
import { WATER_BODIES, getWaterBodyById, WaterBody } from '../assets/data/waterBodies';
import { ATTRIBUTE_REGISTRY } from './attributes';

export interface TrainingQuestion {
  srsItemId: string;
  country: Country;
  attributeId: string;
  stage: SRSStage;
  expectedInputMode: InputMode;
  prompt: string;
  correctAnswer: string;
  options?: string[]; // Populated when expectedInputMode === 'multiple_choice'
  waterBody?: WaterBody;
  isRetry?: boolean;
}

/**
 * Unbiased Fisher-Yates (Knuth) array shuffle.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Creates an initial SRS item for a given country and attribute.
 */
export function createInitialSRSItem(countryId: string, attributeId: string): SRSItem {
  return {
    id: `${countryId}:${attributeId}`,
    countryId,
    attributeId,
    stage: 0, // Starts at Stage 0 (Multiple Choice Scaffolding)
    step: 0,
    consecutiveRecallCorrect: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    nextDueAt: new Date(0).toISOString(), // Immediately due
    history: []
  };
}

/**
 * Updates an SRS item after an answer attempt.
 * Implements cognitive scaffolding:
 * - 1st time: Multiple choice recognition -> 1 correct answer graduates to Active Recall (Stage 1).
 * - Stage 1 (Active recall without propositions): Requires getting it right 2 times in a row to reach Mastered (Stage 2).
 * - Any failure resets the consecutive streak counter to 0 (and drops Stage 2 back to Stage 1).
 */
export function processAnswer(
  item: SRSItem,
  isCorrect: boolean,
  inputMode: InputMode,
  userAnswer: string,
  timeSpentMs: number
): { updatedItem: SRSItem; promotedToLearning: boolean; promotedToMastered: boolean } {
  const now = new Date();
  let stage = item.stage;
  let step = item.step;
  let easeFactor = item.easeFactor;
  let intervalDays = item.intervalDays;
  let reps = item.reps;
  let lapses = item.lapses;
  let consecutiveRecallCorrect = item.consecutiveRecallCorrect || 0;
  let promotedToLearning = false;
  let promotedToMastered = false;

  if (isCorrect) {
    reps += 1;
    if (stage === 0) {
      // First time answered correctly -> Graduate to Stage 1 (Learning / Active Recall)
      stage = 1;
      step = 1;
      intervalDays = 1;
      consecutiveRecallCorrect = 0; // Has not yet been tested in active recall mode
      promotedToLearning = true;
    } else if (stage === 1) {
      // Stage 1 (Active Recall - no propositions):
      // Must be answered correctly 2 times in a row to achieve Mastered status
      step += 1;
      consecutiveRecallCorrect += 1;

      if (consecutiveRecallCorrect >= 2) {
        stage = 2; // Mastered!
        intervalDays = 7;
        promotedToMastered = true;
      } else {
        // First successful recall
        intervalDays = 1;
      }
    } else {
      // Stage 2 (Mastered): Long-term spaced review
      step += 1;
      consecutiveRecallCorrect += 1;
      intervalDays = Math.max(14, Math.round(intervalDays * easeFactor));
    }

    // Gentle ease factor scaling
    easeFactor = Math.min(3.0, easeFactor + 0.05);
  } else {
    // Incorrect answer: immediately reset streak counter!
    lapses += 1;
    step = 0;
    consecutiveRecallCorrect = 0; // Reset counter
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    intervalDays = 0; // Due immediately for reinforcement

    // If lapsed while in Stage 2 (Mastered), drop back to Stage 1
    if (stage === 2) {
      stage = 1;
    }
  }

  // Calculate next due date
  const nextDueDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  const newHistoryEntry: SRSHistoryEntry = {
    timestamp: now.toISOString(),
    inputMode,
    userAnswer,
    isCorrect,
    timeSpentMs
  };

  const updatedItem: SRSItem = {
    ...item,
    stage,
    step,
    consecutiveRecallCorrect,
    easeFactor,
    intervalDays,
    reps,
    lapses,
    lastReviewedAt: now.toISOString(),
    nextDueAt: nextDueDate.toISOString(),
    history: [...(item.history || []).slice(-14), newHistoryEntry]
  };

  return { updatedItem, promotedToLearning, promotedToMastered };
}

/**
 * Converts a WaterBody to a synthetic Country object for unified UI & question compatibility.
 */
export function waterBodyToCountry(wb: WaterBody): Country {
  const flag = wb.type === 'strait' || wb.type === 'channel' ? '⚓' : wb.type === 'ocean' ? '🌐' : '🌊';
  const typeLabel = wb.type.toUpperCase();
  return {
    id: wb.id,
    numericId: wb.id,
    iso2: 'WB',
    name: wb.name,
    officialName: wb.name,
    continent: 'Oceans',
    subregion: typeLabel,
    capital: wb.significance,
    coordinates: wb.coordinates,
    capitalCoordinates: wb.coordinates,
    flagEmoji: flag,
    facts: {
      significance: wb.significance,
      type: wb.type
    }
  };
}

/**
 * Builds an interactive question from an SRSItem and country data.
 */
export function buildQuestion(
  srsItem: SRSItem,
  country: Country,
  allCountries: Country[]
): TrainingQuestion {
  // If it's a water body item (Oceans, Seas, Straits, Gulfs)
  if (srsItem.countryId.startsWith('WATER_') || country.id.startsWith('WATER_')) {
    const wb = getWaterBodyById(country.id) || getWaterBodyById(srsItem.countryId);
    const typeName = wb?.type === 'strait' || wb?.type === 'channel'
      ? 'Strait'
      : wb?.type === 'ocean'
      ? 'Ocean'
      : wb?.type === 'gulf'
      ? 'Gulf'
      : wb?.type === 'bay'
      ? 'Bay'
      : 'Sea';
    const prompt = wb ? `Locate ${typeName}: ${wb.name}` : `Locate on map: ${country.name}`;
    const correctAnswer = wb ? wb.name : country.name;

    let options: string[] | undefined = undefined;
    if (srsItem.stage === 0) {
      // 4 choices from other water bodies (guaranteed unique)
      const otherWbs = WATER_BODIES.filter((w) => w.id !== (wb?.id || country.id));
      const shuffledOthers = shuffleArray(otherWbs);
      const uniqueOpts = new Set<string>([correctAnswer]);
      for (const other of shuffledOthers) {
        if (!uniqueOpts.has(other.name)) {
          uniqueOpts.add(other.name);
          if (uniqueOpts.size >= 4) break;
        }
      }
      options = shuffleArray(Array.from(uniqueOpts));
    }

    return {
      srsItemId: srsItem.id,
      country: wb ? waterBodyToCountry(wb) : country,
      attributeId: 'location',
      stage: srsItem.stage,
      expectedInputMode: 'map_click',
      prompt,
      correctAnswer,
      options,
      waterBody: wb
    };
  }

  const attrDef = ATTRIBUTE_REGISTRY.get(srsItem.attributeId);
  const prompt = attrDef ? attrDef.promptTemplate(country) : `Question about ${country.name}`;
  const correctAnswer = attrDef ? String(attrDef.getValue(country)) : country.capital;

  // Determine input mode:
  // If Stage 0:
  //   - For Location: map click (or Multiple Choice if map is hidden)
  //   - For Capitals/other: Multiple Choice (4 propositions)
  // If Stage 1 or 2:
  //   - For Location: Direct map click with zero propositions, or blank map identification
  //   - For Capitals/other: Typing Active Recall (no propositions)
  let expectedInputMode: InputMode = 'typing';
  let options: string[] | undefined = undefined;

  if (srsItem.stage === 0) {
    if (srsItem.attributeId === 'location') {
      expectedInputMode = 'map_click';
    } else {
      expectedInputMode = 'multiple_choice';
      if (attrDef) {
        const distractors = attrDef.generateDistractors(country, allCountries, 5);
        const uniqueOpts = new Set<string>([correctAnswer]);
        for (const dist of distractors) {
          if (dist && !uniqueOpts.has(dist)) {
            uniqueOpts.add(dist);
            if (uniqueOpts.size >= 4) break;
          }
        }
        options = shuffleArray(Array.from(uniqueOpts));
      }
    }
  } else {
    // Stage 1+: Active recall typing or map click
    if (srsItem.attributeId === 'location') {
      expectedInputMode = 'map_click';
    } else {
      expectedInputMode = 'typing';
      options = undefined; // Strictly NO propositions for active recall!
    }
  }

  return {
    srsItemId: srsItem.id,
    country,
    attributeId: srsItem.attributeId,
    stage: srsItem.stage,
    expectedInputMode,
    prompt,
    correctAnswer,
    options
  };
}

/**
 * Selects a session queue of questions based on filters:
 * - Prioritizes due review items
 * - Fills remainder with new items from selected continent & attributes
 */
export function prepareSessionQueue(
  existingItemsMap: Map<string, SRSItem>,
  continentFilter: 'All' | Continent | 'Oceans',
  attributeFilter: string[],
  batchSize: number = 15,
  practiceMode: boolean = false
): TrainingQuestion[] {
  const now = new Date().toISOString();
  const activeAttrIds = attributeFilter.length > 0 ? attributeFilter : ['capital', 'location'];
  const includeWater = (continentFilter === 'All' || continentFilter === 'Oceans') && activeAttrIds.includes('location');

  // If drilling Oceans, Seas & Straits exclusively:
  if (continentFilter === 'Oceans') {
    const waterCountries = WATER_BODIES.map(waterBodyToCountry);
    if (practiceMode) {
      const candidates = WATER_BODIES.map((wb) => {
        const id = `${wb.id}:location`;
        const existing = existingItemsMap.get(id);
        const itemToUse = existing || createInitialSRSItem(wb.id, 'location');
        return buildQuestion(itemToUse, waterBodyToCountry(wb), waterCountries);
      });
      return shuffleArray(candidates).slice(0, batchSize);
    }

    const dueItems: SRSItem[] = [];
    const newCandidates: WaterBody[] = [];
    for (const wb of WATER_BODIES) {
      const id = `${wb.id}:location`;
      const existing = existingItemsMap.get(id);
      if (existing) {
        if (existing.nextDueAt <= now || existing.intervalDays === 0) {
          dueItems.push(existing);
        }
      } else {
        newCandidates.push(wb);
      }
    }

    // Fully randomized sampling from due pool
    const shuffledDue = shuffleArray(dueItems);
    const sessionQueue: TrainingQuestion[] = [];
    for (const srsItem of shuffledDue.slice(0, batchSize)) {
      const wb = getWaterBodyById(srsItem.countryId);
      if (wb) {
        sessionQueue.push(buildQuestion(srsItem, waterBodyToCountry(wb), waterCountries));
      }
    }

    const remainingSlots = batchSize - sessionQueue.length;
    if (remainingSlots > 0 && newCandidates.length > 0) {
      const shuffledNew = shuffleArray(newCandidates).slice(0, remainingSlots);
      for (const cand of shuffledNew) {
        const initItem = createInitialSRSItem(cand.id, 'location');
        sessionQueue.push(buildQuestion(initItem, waterBodyToCountry(cand), waterCountries));
      }
    }
    return shuffleArray(sessionQueue);
  }

  // Continental or Global World Training:
  const eligibleCountries = continentFilter === 'All'
    ? COUNTRIES
    : COUNTRIES.filter((c) => c.continent === continentFilter);

  const waterCountries = WATER_BODIES.map(waterBodyToCountry);
  const allContextCountries = includeWater ? [...COUNTRIES, ...waterCountries] : COUNTRIES;

  // If in Free Practice Drill Mode:
  if (practiceMode) {
    const practiceCandidates: TrainingQuestion[] = [];
    for (const country of eligibleCountries) {
      for (const attrId of activeAttrIds) {
        const id = `${country.id}:${attrId}`;
        const existing = existingItemsMap.get(id);
        const itemToUse = existing || createInitialSRSItem(country.id, attrId);
        practiceCandidates.push(buildQuestion(itemToUse, country, allContextCountries));
      }
    }

    // Include water bodies if training World with location enabled
    if (includeWater) {
      for (const wb of WATER_BODIES) {
        const id = `${wb.id}:location`;
        const existing = existingItemsMap.get(id);
        const itemToUse = existing || createInitialSRSItem(wb.id, 'location');
        practiceCandidates.push(buildQuestion(itemToUse, waterBodyToCountry(wb), allContextCountries));
      }
    }

    // Unbiased Fisher-Yates shuffle
    return shuffleArray(practiceCandidates).slice(0, batchSize);
  }

  // Standard Spaced Repetition Review Mode:
  const dueItems: SRSItem[] = [];
  type NewCandidate = { country: Country; attributeId: string };
  const newCandidates: NewCandidate[] = [];

  for (const country of eligibleCountries) {
    for (const attrId of activeAttrIds) {
      const id = `${country.id}:${attrId}`;
      const existing = existingItemsMap.get(id);

      if (existing) {
        if (existing.nextDueAt <= now || existing.intervalDays === 0) {
          dueItems.push(existing);
        }
      } else {
        newCandidates.push({ country, attributeId: attrId });
      }
    }
  }

  // Include water bodies in dueItems & newCandidates if training World with location active
  if (includeWater) {
    for (const wb of WATER_BODIES) {
      const id = `${wb.id}:location`;
      const existing = existingItemsMap.get(id);

      if (existing) {
        if (existing.nextDueAt <= now || existing.intervalDays === 0) {
          dueItems.push(existing);
        }
      } else {
        newCandidates.push({ country: waterBodyToCountry(wb), attributeId: 'location' });
      }
    }
  }

  // Unbiased Fisher-Yates shuffle across ALL due items globally:
  // Eliminates chronological/geographic clustering (prevents getting stuck in any single continent like Oceania)
  const shuffledDue = shuffleArray(dueItems);
  const sessionQueue: TrainingQuestion[] = [];

  // Add due reviews first
  for (const srsItem of shuffledDue.slice(0, batchSize)) {
    if (srsItem.countryId.startsWith('WATER_')) {
      const wb = getWaterBodyById(srsItem.countryId);
      if (wb) {
        sessionQueue.push(buildQuestion(srsItem, waterBodyToCountry(wb), allContextCountries));
      }
    } else {
      const country = COUNTRIES_BY_ID.get(srsItem.countryId);
      if (country) {
        sessionQueue.push(buildQuestion(srsItem, country, allContextCountries));
      }
    }
  }

  // If room left, introduce new items
  const remainingSlots = batchSize - sessionQueue.length;
  if (remainingSlots > 0 && newCandidates.length > 0) {
    const shuffledNew = shuffleArray(newCandidates).slice(0, remainingSlots);
    for (const cand of shuffledNew) {
      const initItem = createInitialSRSItem(cand.country.id, cand.attributeId);
      sessionQueue.push(buildQuestion(initItem, cand.country, allContextCountries));
    }
  }

  // Final uniform shuffle to randomize order of due and new items
  return shuffleArray(sessionQueue);
}

/**
 * Calculates global and continental mastery statistics.
 */
export function computeMasteryStats(itemsMap: Map<string, SRSItem>) {
  const continents: Continent[] = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
  const breakdown: Record<Continent, { total: number; stage0: number; stage1: number; stage2: number }> = {
    Africa: { total: 0, stage0: 0, stage1: 0, stage2: 0 },
    Americas: { total: 0, stage0: 0, stage1: 0, stage2: 0 },
    Asia: { total: 0, stage0: 0, stage1: 0, stage2: 0 },
    Europe: { total: 0, stage0: 0, stage1: 0, stage2: 0 },
    Oceania: { total: 0, stage0: 0, stage1: 0, stage2: 0 }
  };

  let globalStage0 = 0;
  let globalStage1 = 0;
  let globalStage2 = 0;

  for (const country of COUNTRIES) {
    const cont = country.continent as Continent;
    breakdown[cont].total += 2; // capital + location
    
    const capItem = itemsMap.get(`${country.id}:capital`);
    const locItem = itemsMap.get(`${country.id}:location`);

    const assess = (item?: SRSItem) => {
      if (!item || item.stage === 0) return 0;
      if (item.stage === 1) return 1;
      return 2;
    };

    const sCap = assess(capItem);
    const sLoc = assess(locItem);

    if (sCap === 0) { globalStage0++; breakdown[cont].stage0++; }
    else if (sCap === 1) { globalStage1++; breakdown[cont].stage1++; }
    else { globalStage2++; breakdown[cont].stage2++; }

    if (sLoc === 0) { globalStage0++; breakdown[cont].stage0++; }
    else if (sLoc === 1) { globalStage1++; breakdown[cont].stage1++; }
    else { globalStage2++; breakdown[cont].stage2++; }
  }

  // Dedicated Water Bodies & Straits breakdown (40 location cards)
  const waterBreakdown = { total: WATER_BODIES.length, stage0: 0, stage1: 0, stage2: 0 };
  for (const wb of WATER_BODIES) {
    const item = itemsMap.get(`${wb.id}:location`);
    if (!item || item.stage === 0) {
      waterBreakdown.stage0++;
      globalStage0++;
    } else if (item.stage === 1) {
      waterBreakdown.stage1++;
      globalStage1++;
    } else {
      waterBreakdown.stage2++;
      globalStage2++;
    }
  }

  const grandTotal = (COUNTRIES.length * 2) + WATER_BODIES.length;
  const masteryPercentage = Math.round((globalStage2 / grandTotal) * 100);
  const learningPercentage = Math.round((globalStage1 / grandTotal) * 100);

  return {
    grandTotal,
    globalStage0,
    globalStage1,
    globalStage2,
    masteryPercentage,
    learningPercentage,
    breakdown,
    waterBreakdown
  };
}
