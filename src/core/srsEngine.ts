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
 * Performs weighted random sampling without replacement by region.
 */
export function selectWeightedByRegion<T>(
  pool: T[],
  count: number,
  getRegion: (item: T) => string,
  regionWeights: Map<string, number>,
  getCustomWeight?: (item: T) => number
): T[] {
  if (pool.length <= count) {
    return shuffleArray(pool);
  }

  const remaining = [...pool];
  const selected: T[] = [];

  for (let step = 0; step < count; step++) {
    if (remaining.length === 0) break;

    let totalWeight = 0;
    const weights: number[] = new Array(remaining.length);
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const w = getCustomWeight
        ? getCustomWeight(item)
        : Math.max(0.15, regionWeights.get(getRegion(item)) ?? 1);
      weights[i] = w;
      totalWeight += w;
    }

    if (totalWeight <= 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(idx, 1)[0]);
      continue;
    }

    let r = Math.random() * totalWeight;
    let chosenIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        chosenIdx = i;
        break;
      }
    }
    selected.push(remaining.splice(chosenIdx, 1)[0]);
  }

  return selected;
}

type QueueCandidate = {
  country: Country;
  attributeId: string;
  existing?: SRSItem;
};

/**
 * Selects a session queue of questions based on filters:
 * - Prioritizes due review items and balances 0/2 vs 1/2 recall
 * - Prioritizes unlearned/unseen cards so regions like the Americas are not starved
 * - Injects rare Mastered (2/2) retention checks
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
  const includeWater =
    (continentFilter === 'All' || continentFilter === 'Oceans') && activeAttrIds.includes('location');

  const waterCountries = WATER_BODIES.map(waterBodyToCountry);
  const allContextCountries = includeWater ? [...COUNTRIES, ...waterCountries] : COUNTRIES;

  const eligibleCandidates: QueueCandidate[] = [];

  if (continentFilter === 'Oceans') {
    for (const wb of WATER_BODIES) {
      const id = `${wb.id}:location`;
      eligibleCandidates.push({
        country: waterBodyToCountry(wb),
        attributeId: 'location',
        existing: existingItemsMap.get(id)
      });
    }
  } else {
    const eligibleCountries =
      continentFilter === 'All'
        ? COUNTRIES
        : COUNTRIES.filter((c) => c.continent === continentFilter);

    for (const country of eligibleCountries) {
      for (const attrId of activeAttrIds) {
        const id = `${country.id}:${attrId}`;
        eligibleCandidates.push({
          country,
          attributeId: attrId,
          existing: existingItemsMap.get(id)
        });
      }
    }

    if (includeWater) {
      for (const wb of WATER_BODIES) {
        const id = `${wb.id}:location`;
        eligibleCandidates.push({
          country: waterBodyToCountry(wb),
          attributeId: 'location',
          existing: existingItemsMap.get(id)
        });
      }
    }
  }

  // If in Free Practice Drill Mode:
  if (practiceMode) {
    const practiceQuestions = eligibleCandidates.map((cand) => {
      const itemToUse = cand.existing || createInitialSRSItem(cand.country.id, cand.attributeId);
      return buildQuestion(itemToUse, cand.country, allContextCountries);
    });
    return shuffleArray(practiceQuestions).slice(0, batchSize);
  }

  // Standard Spaced Repetition Review Mode:
  const regionsList = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Oceans'];
  const regionTotals = new Map<string, number>();
  const regionUnseen = new Map<string, number>();
  const regionMastered = new Map<string, number>();

  for (const cand of eligibleCandidates) {
    const reg = cand.country.continent || 'Oceans';
    regionTotals.set(reg, (regionTotals.get(reg) || 0) + 1);
    if (!cand.existing) {
      regionUnseen.set(reg, (regionUnseen.get(reg) || 0) + 1);
    } else if (cand.existing.stage === 2) {
      regionMastered.set(reg, (regionMastered.get(reg) || 0) + 1);
    }
  }

  const regionWeights = new Map<string, number>();
  for (const reg of regionsList) {
    const total = regionTotals.get(reg) || 0;
    if (total === 0) {
      regionWeights.set(reg, 1);
      continue;
    }
    const unseenRatio = (regionUnseen.get(reg) || 0) / total;
    const unmasteredRatio = (total - (regionMastered.get(reg) || 0)) / total;
    const weight = 1 + unseenRatio * 3.0 + unmasteredRatio * 1.5;
    regionWeights.set(reg, weight);
  }

  const dueStage0Pool: QueueCandidate[] = [];
  const unseenPool: QueueCandidate[] = [];
  const dueRecallZeroPool: QueueCandidate[] = [];
  const dueRecallOnePool: QueueCandidate[] = [];
  const dueMasteredPool: QueueCandidate[] = [];
  const retentionMasteredPool: QueueCandidate[] = [];

  for (const cand of eligibleCandidates) {
    const item = cand.existing;
    if (!item) {
      unseenPool.push(cand);
    } else if (item.stage === 0) {
      if (item.nextDueAt <= now || item.intervalDays === 0) {
        dueStage0Pool.push(cand);
      }
    } else if (item.stage === 1) {
      if (item.nextDueAt <= now || item.intervalDays === 0) {
        if ((item.consecutiveRecallCorrect || 0) === 0) {
          dueRecallZeroPool.push(cand);
        } else {
          dueRecallOnePool.push(cand);
        }
      }
    } else if (item.stage === 2) {
      if (item.nextDueAt <= now || item.intervalDays === 0) {
        dueMasteredPool.push(cand);
      } else {
        retentionMasteredPool.push(cand);
      }
    }
  }

  retentionMasteredPool.sort((a, b) => {
    const aRev = a.existing?.lastReviewedAt ? new Date(a.existing.lastReviewedAt).getTime() : 0;
    const bRev = b.existing?.lastReviewedAt ? new Date(b.existing.lastReviewedAt).getTime() : 0;
    if (aRev !== bRev) return aRev - bRev;
    const aDue = a.existing?.nextDueAt ? new Date(a.existing.nextDueAt).getTime() : 0;
    const bDue = b.existing?.nextDueAt ? new Date(b.existing.nextDueAt).getTime() : 0;
    return aDue - bDue;
  });

  // All-Caught-Up Guard:
  const totalActiveDueOrUnseen =
    dueStage0Pool.length +
    unseenPool.length +
    dueRecallZeroPool.length +
    dueRecallOnePool.length +
    dueMasteredPool.length;

  if (totalActiveDueOrUnseen === 0) {
    return [];
  }

  // Step A — Mastered Retention Slots (1-2 cards)
  const selectedMastered: QueueCandidate[] = [];
  const nonMasteredActiveCount =
    dueStage0Pool.length +
    unseenPool.length +
    dueRecallZeroPool.length +
    dueRecallOnePool.length;

  if (nonMasteredActiveCount === 0) {
    selectedMastered.push(...shuffleArray(dueMasteredPool).slice(0, batchSize));
  } else {
    const totalMasteredCount = dueMasteredPool.length + retentionMasteredPool.length;
    if (totalMasteredCount > 0) {
      const targetMasteredCount =
        totalMasteredCount >= 8
          ? Math.max(1, Math.min(2, Math.round(batchSize * 0.13)))
          : 1;

      // Pick from dueMasteredPool first
      const pickedDue = shuffleArray(dueMasteredPool).slice(0, targetMasteredCount);
      selectedMastered.push(...pickedDue);

      const neededRetention = targetMasteredCount - selectedMastered.length;
      if (neededRetention > 0 && retentionMasteredPool.length > 0) {
        const halfSliceCount = Math.max(neededRetention, Math.ceil(retentionMasteredPool.length * 0.5));
        const poolSlice = retentionMasteredPool.slice(0, halfSliceCount);
        const pickedRetention = shuffleArray(poolSlice).slice(0, neededRetention);
        selectedMastered.push(...pickedRetention);
      }
    }
  }

  // Step B — Learning & Unlearned Slots
  const learningBudget = batchSize - selectedMastered.length;
  const selectedLearning: QueueCandidate[] = [];
  const selectedKeys = new Set<string>(
    selectedMastered.map((c) => `${c.country.id}:${c.attributeId}`)
  );

  const getRegion = (c: QueueCandidate) => c.country.continent || 'Oceans';

  // 1. Stage 0 Due: target up to ceil(learningBudget * 0.45)
  const targetStage0 = Math.ceil(learningBudget * 0.45);
  const pickedStage0 = selectWeightedByRegion(
    dueStage0Pool,
    targetStage0,
    getRegion,
    regionWeights
  );
  for (const c of pickedStage0) {
    selectedLearning.push(c);
    selectedKeys.add(`${c.country.id}:${c.attributeId}`);
  }

  // 2. Unseen Pool: target Math.max(0, Math.ceil(learningBudget * 0.45) - pickedStage0.length)
  const targetUnseen = Math.max(0, Math.ceil(learningBudget * 0.45) - pickedStage0.length);
  if (targetUnseen > 0) {
    const pickedUnseen = selectWeightedByRegion(
      unseenPool,
      targetUnseen,
      getRegion,
      regionWeights
    );
    for (const c of pickedUnseen) {
      selectedLearning.push(c);
      selectedKeys.add(`${c.country.id}:${c.attributeId}`);
    }
  }

  // 3. Due Recall 0/2 Pool: target ceil(learningBudget * 0.35)
  const targetRecallZero = Math.ceil(learningBudget * 0.35);
  const pickedRecallZero = selectWeightedByRegion(
    dueRecallZeroPool,
    targetRecallZero,
    getRegion,
    regionWeights,
    (item) => {
      const base = Math.max(0.15, regionWeights.get(getRegion(item)) ?? 1);
      return item.existing && item.existing.lapses > 0
        ? base * (1 + Math.min(item.existing.lapses, 3) * 0.5)
        : base;
    }
  );
  for (const c of pickedRecallZero) {
    selectedLearning.push(c);
    selectedKeys.add(`${c.country.id}:${c.attributeId}`);
  }

  // 4. Due Recall 1/2 Pool: target remaining slots
  const targetRecallOne = Math.max(0, learningBudget - selectedLearning.length);
  if (targetRecallOne > 0) {
    const pickedRecallOne = selectWeightedByRegion(
      dueRecallOnePool,
      targetRecallOne,
      getRegion,
      regionWeights
    );
    for (const c of pickedRecallOne) {
      selectedLearning.push(c);
      selectedKeys.add(`${c.country.id}:${c.attributeId}`);
    }
  }

  // Step C — Rollover if any pool had fewer items than its target
  if (selectedLearning.length < learningBudget) {
    const fillFrom = (pool: QueueCandidate[]) => {
      const remainingInPool = pool.filter(
        (c) => !selectedKeys.has(`${c.country.id}:${c.attributeId}`)
      );
      const needed = learningBudget - selectedLearning.length;
      if (needed <= 0 || remainingInPool.length === 0) return;
      const picked = selectWeightedByRegion(remainingInPool, needed, getRegion, regionWeights);
      for (const c of picked) {
        selectedLearning.push(c);
        selectedKeys.add(`${c.country.id}:${c.attributeId}`);
      }
    };

    fillFrom(dueStage0Pool);
    fillFrom(unseenPool);
    fillFrom(dueRecallZeroPool);
    fillFrom(dueRecallOnePool);
    fillFrom(dueMasteredPool);
  }

  const allSelected = [...selectedMastered, ...selectedLearning];
  const sessionQueue: TrainingQuestion[] = allSelected.map((cand) => {
    const itemToUse = cand.existing || createInitialSRSItem(cand.country.id, cand.attributeId);
    return buildQuestion(itemToUse, cand.country, allContextCountries);
  });

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
