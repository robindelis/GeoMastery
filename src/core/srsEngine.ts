import {
  Country,
  Continent,
  SRSItem,
  SRSStage,
  InputMode,
  TrainingCategory,
  SRSHistoryEntry,
  FSRSGrade
} from './types';
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

/* ────────────────────────────────────────────────────────────────────────────
 * HYBRID GEO-FSRS + ACT-R + LECTOR SPATIAL MEMORY ENGINE
 *
 * Combines four evidence-based cognitive memory architectures:
 * 1. FSRS-6 DSR Model (Difficulty, Stability, Retrievability):
 *    Power-law forgetting curve R(t, S) = (1 + (19/81) * t / S)^(-0.5)
 *    with Bjork's Desirable Difficulty stability boost when recalling at lower R.
 * 2. ACT-R / ARTS Latency-to-Grade Inference (Pavlik & Anderson / Kellman):
 *    Maps response time (timeSpentMs) and input modality into an objective
 *    4-point FSRS grade (1=Again, 2=Hard, 3=Good, 4=Easy) without manual buttons.
 * 3. LECTOR Confusion-Pair Interference Tracking:
 *    Records countries/capitals confused by the learner (`confusedWith`) and
 *    prioritizes them as high-salience distractors and review targets.
 * 4. Paivio Dual-Coding Coupling & Anti-Priming Interleaving:
 *    Synergizes `location` and `capital` acquisition for the same nation while
 *    spacing same-entity cards >= 4 items apart inside each 15-card session.
 * ──────────────────────────────────────────────────────────────────────────── */

const FSRS_DECAY = -0.5;
const FSRS_FACTOR = 19 / 81;

// Calibrated FSRS-6 default weights
const FSRS_W = {
  s0Again: 0.4,
  s0Hard: 1.29,
  s0Good: 2.31,
  s0Easy: 8.3,
  d0Base: 6.4133,
  d0Exp: 0.8334,
  dDelta: 1.4604,
  dMeanRev: 0.08,
  sRecallExp: 1.8722,
  sDecayPower: 0.1666,
  sRetrievabilityGain: 0.796,
  sForgetBase: 1.4835,
  sForgetDiffPow: 0.0614,
  sForgetStabPow: 0.2629,
  sForgetRetGain: 1.6483,
  hardPenalty: 0.6014,
  easyBonus: 1.35,
  sameDayGain: 0.5425,
  sameDayOffset: 0.0912,
  sameDayPow: 0.0658
};

/**
 * Infers baseline FSRS Stability (S in days at 90% retrievability) for legacy or new items.
 */
export function inferStability(item?: SRSItem): number {
  if (!item) return 0;
  if (typeof item.stability === 'number' && item.stability > 0) {
    return item.stability;
  }
  if (item.intervalDays > 0) {
    return item.intervalDays;
  }
  if (item.stage === 2) return 7;
  if (item.stage === 1) return (item.consecutiveRecallCorrect || 0) >= 1 ? 1.8 : 1.0;
  return 0.4;
}

/**
 * Infers baseline FSRS Difficulty D in [1, 10] for legacy or new items.
 */
export function inferDifficulty(item?: SRSItem): number {
  if (!item) return 5.0;
  if (typeof item.difficulty === 'number' && item.difficulty >= 1 && item.difficulty <= 10) {
    return item.difficulty;
  }
  // Map legacy SM-2 easeFactor [1.3, 3.0] to Difficulty [1, 10]
  const fromEase = 10 - ((Math.min(3.0, Math.max(1.3, item.easeFactor || 2.5)) - 1.3) / 1.7) * 7.5;
  const lapseBump = Math.min(2.0, (item.lapses || 0) * 0.4);
  return Math.min(10, Math.max(1, Number((fromEase + lapseBump).toFixed(2))));
}

/**
 * Computes real-time FSRS Retrievability R(t, S) in (0, 1] using the power-law forgetting curve.
 * At t = 0, R = 1.0 (100%). At t = S days, R = 0.90 (90%).
 */
export function computeRetrievability(item?: SRSItem, nowMs: number = Date.now()): number {
  if (!item || !item.lastReviewedAt) return 0;
  const lastMs = new Date(item.lastReviewedAt).getTime();
  if (Number.isNaN(lastMs)) return 0;
  const elapsedDays = Math.max(0, (nowMs - lastMs) / 86400000);
  const S = Math.max(0.25, inferStability(item));
  return Math.pow(1 + FSRS_FACTOR * (elapsedDays / S), FSRS_DECAY);
}

/**
 * ACT-R / ARTS Latency-to-Grade Mapping:
 * Infers FSRS Grade (1=Again, 2=Hard, 3=Good, 4=Easy) from response accuracy,
 * input modality, and retrieval latency in milliseconds.
 */
export function deriveActRGrade(
  isCorrect: boolean,
  inputMode: InputMode,
  timeSpentMs: number
): FSRSGrade {
  if (!isCorrect) return 1;
  const t = Math.max(100, timeSpentMs || 2500);

  if (inputMode === 'typing') {
    if (t <= 3200) return 4; // Easy: automatic lexical + motor retrieval
    if (t <= 8500) return 3; // Good: solid active recall
    return 2; // Hard: high-latency effortful recall
  }

  if (inputMode === 'map_click') {
    if (t <= 2400) return 4; // Easy: instant spatial pinpoint
    if (t <= 6200) return 3; // Good: normal spatial scan
    return 2; // Hard: prolonged visual search
  }

  // multiple_choice (Stage 0 recognition)
  if (t <= 2200) return 4;
  if (t <= 5500) return 3;
  return 2;
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
    history: [],
    difficulty: 5.0,
    stability: 0.4,
    confusedWith: []
  };
}

/**
 * Updates an SRS item after an answer attempt using the Hybrid Geo-FSRS + ACT-R model.
 * Preserves strict 3-Stage Cognitive Scaffolding invariants:
 * - Stage 0: Multiple choice recognition -> 1 correct answer graduates to Active Recall (Stage 1, 0/2 streak).
 * - Stage 1 (Active recall without propositions): Requires 2 consecutive correct answers to reach Mastered (Stage 2).
 * - Any failure resets `consecutiveRecallCorrect` to 0 and demotes Stage 2 back to Stage 1.
 */
export function processAnswer(
  item: SRSItem,
  isCorrect: boolean,
  inputMode: InputMode,
  userAnswer: string,
  timeSpentMs: number,
  confusedEntityId?: string
): { updatedItem: SRSItem; promotedToLearning: boolean; promotedToMastered: boolean } {
  const now = new Date();
  const nowMs = now.getTime();
  let stage = item.stage;
  let step = item.step;
  let easeFactor = item.easeFactor;
  let intervalDays = item.intervalDays;
  let reps = item.reps;
  let lapses = item.lapses;
  let consecutiveRecallCorrect = item.consecutiveRecallCorrect || 0;
  let promotedToLearning = false;
  let promotedToMastered = false;

  // 1. Derive ACT-R latency grade (1=Again, 2=Hard, 3=Good, 4=Easy)
  const grade = deriveActRGrade(isCorrect, inputMode, timeSpentMs);

  // 2. Compute prior FSRS Difficulty (D), Stability (S), and Retrievability (R)
  const prevD = inferDifficulty(item);
  const prevS = Math.max(0.25, inferStability(item));
  const lastMs = item.lastReviewedAt ? new Date(item.lastReviewedAt).getTime() : NaN;
  const elapsedDays = !Number.isNaN(lastMs) ? Math.max(0, (nowMs - lastMs) / 86400000) : 0;
  const R = item.lastReviewedAt ? computeRetrievability(item, nowMs) : 0.9;

  // 3. Update FSRS Difficulty D in [1, 10] with linear damping & mean reversion
  const d0Easy = Math.min(10, Math.max(1, FSRS_W.d0Base - Math.exp(FSRS_W.d0Exp * (4 - 1)) + 1));
  const deltaD = -FSRS_W.dDelta * (grade - 3);
  const dampedD = prevD + deltaD * ((10 - prevD) / 9);
  const nextDifficulty = Number(
    Math.min(10, Math.max(1, FSRS_W.dMeanRev * d0Easy + (1 - FSRS_W.dMeanRev) * dampedD)).toFixed(2)
  );

  let nextStability = prevS;
  let confusedWith = [...(item.confusedWith || [])];

  if (isCorrect) {
    reps += 1;

    // Update FSRS Stability S on successful recall (Desirable Difficulty equation)
    if (reps === 1 || !item.lastReviewedAt) {
      nextStability = grade === 4 ? 2.4 : grade === 3 ? 1.6 : 1.1;
    } else if (elapsedDays < 0.5) {
      // Same-day review stability scaling (prevents cramming inflation)
      const sameDayFactor =
        Math.exp(FSRS_W.sameDayGain * (grade - 3 + FSRS_W.sameDayOffset)) *
        Math.pow(prevS, -FSRS_W.sameDayPow);
      nextStability = Math.max(prevS * 1.05, prevS * sameDayFactor);
    } else {
      const hardMod = grade === 2 ? FSRS_W.hardPenalty : 1.0;
      const easyMod = grade === 4 ? FSRS_W.easyBonus : 1.0;
      const inc =
        Math.exp(FSRS_W.sRecallExp) *
        (11 - nextDifficulty) *
        Math.pow(prevS, -FSRS_W.sDecayPower) *
        (Math.exp(FSRS_W.sRetrievabilityGain * (1 - R)) - 1) *
        hardMod *
        easyMod;
      nextStability = Math.min(365, prevS * (1 + Math.max(0.15, inc)));
    }

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
        // Scale initial Mastered interval using FSRS stability & latency grade (at least 7 days)
        const baseMasteredInterval = grade === 4 ? 10 : grade === 3 ? 8 : 7;
        intervalDays = Math.max(7, Math.min(21, Math.round(Math.max(baseMasteredInterval, nextStability))));
        nextStability = Math.max(nextStability, intervalDays);
        promotedToMastered = true;
      } else {
        // First successful recall (1/2): 1 day (or 2 days on fast fluent recall)
        intervalDays = grade === 4 ? 2 : 1;
        nextStability = Math.max(nextStability, intervalDays);
      }
    } else {
      // Stage 2 (Mastered): Long-term FSRS + ease hybrid interval
      step += 1;
      consecutiveRecallCorrect += 1;
      const latencyMod = grade === 4 ? 1.15 : grade === 2 ? 0.85 : 1.0;
      const sm2Candidate = Math.round(intervalDays * easeFactor * latencyMod);
      const fsrsCandidate = Math.round(nextStability);
      intervalDays = Math.min(365, Math.max(14, Math.max(sm2Candidate, fsrsCandidate)));
      nextStability = Math.max(nextStability, intervalDays);
    }

    // Latency-sensitive ease factor adjustment
    const easeDelta = grade === 4 ? 0.08 : grade === 3 ? 0.05 : -0.02;
    easeFactor = Number(Math.min(3.0, Math.max(1.3, easeFactor + easeDelta)).toFixed(2));
  } else {
    // Incorrect answer: immediately reset streak counter!
    lapses += 1;
    step = 0;
    consecutiveRecallCorrect = 0; // Reset counter
    easeFactor = Number(Math.max(1.3, easeFactor - 0.2).toFixed(2));
    intervalDays = 0; // Due immediately for reinforcement

    // FSRS post-lapse stability S'_f (retains partial memory trace for faster re-stabilization)
    nextStability = Math.max(
      0.5,
      Math.min(
        prevS * 0.65,
        FSRS_W.sForgetBase *
          Math.pow(nextDifficulty, -FSRS_W.sForgetDiffPow) *
          (Math.pow(prevS + 1, FSRS_W.sForgetStabPow) - 1) *
          Math.exp(FSRS_W.sForgetRetGain * (1 - R))
      )
    );

    // Record LECTOR confusion pair if user clicked/typed another known entity
    const resolvedConfusion = confusedEntityId || resolveConfusedCountryId(userAnswer, item.countryId);
    if (resolvedConfusion && resolvedConfusion !== item.countryId) {
      confusedWith = [resolvedConfusion, ...confusedWith.filter((id) => id !== resolvedConfusion)].slice(0, 4);
    }

    // If lapsed while in Stage 2 (Mastered), drop back to Stage 1
    if (stage === 2) {
      stage = 1;
    }
  }

  // Calculate next due date
  const nextDueDate = new Date(nowMs + intervalDays * 24 * 60 * 60 * 1000);

  const newHistoryEntry: SRSHistoryEntry = {
    timestamp: now.toISOString(),
    inputMode,
    userAnswer,
    isCorrect,
    timeSpentMs,
    grade
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
    history: [...(item.history || []).slice(-14), newHistoryEntry],
    difficulty: nextDifficulty,
    stability: Number(nextStability.toFixed(2)),
    lastLatencyGrade: grade,
    confusedWith
  };

  return { updatedItem, promotedToLearning, promotedToMastered };
}

/**
 * Resolves a wrong user answer (country name or capital city) to a Country ID
 * so LECTOR interference tracking can pair the two confused nations.
 */
function resolveConfusedCountryId(userAnswer: string, targetCountryId: string): string | undefined {
  const clean = (userAnswer || '').trim().toLowerCase();
  if (!clean || clean === '__dont_know__' || clean.length < 3) return undefined;
  for (const c of COUNTRIES) {
    if (c.id === targetCountryId) continue;
    if (
      c.name.toLowerCase() === clean ||
      c.capital.toLowerCase() === clean ||
      c.id.toLowerCase() === clean
    ) {
      return c.id;
    }
  }
  return undefined;
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
        const uniqueOpts = new Set<string>([correctAnswer]);

        // LECTOR Interference Resolution: inject previously confused entities as high-salience distractors
        if (srsItem.confusedWith && srsItem.confusedWith.length > 0) {
          for (const confId of srsItem.confusedWith) {
            const confCountry = COUNTRIES_BY_ID.get(confId);
            if (confCountry) {
              const confVal = String(attrDef.getValue(confCountry));
              if (confVal && !uniqueOpts.has(confVal)) {
                uniqueOpts.add(confVal);
                if (uniqueOpts.size >= 4) break;
              }
            }
          }
        }

        const distractors = attrDef.generateDistractors(country, allCountries, 5);
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

  const nowMs = Date.now();

  // Sort Mastered retention candidates by lowest FSRS Retrievability R(t, S) first
  retentionMasteredPool.sort((a, b) => {
    const rA = computeRetrievability(a.existing, nowMs);
    const rB = computeRetrievability(b.existing, nowMs);
    if (Math.abs(rA - rB) > 0.005) return rA - rB;
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
  const selectedCountryIds = new Set<string>(selectedMastered.map((c) => c.country.id));

  const getRegion = (c: QueueCandidate) => c.country.continent || 'Oceans';

  // Hybrid Geo-FSRS + ACT-R + Dual-Coding + Interference Candidate Weight
  const computeCandidateWeight = (cand: QueueCandidate): number => {
    const base = Math.max(0.15, regionWeights.get(getRegion(cand)) ?? 1);
    const item = cand.existing;
    const siblingAttr = cand.attributeId === 'capital' ? 'location' : 'capital';
    const siblingItem = existingItemsMap.get(`${cand.country.id}:${siblingAttr}`);

    // Paivio Dual-Coding Synergy: boost if sibling attribute is in active learning or in session
    const hasDualCodingSynergy =
      selectedCountryIds.has(cand.country.id) || Boolean(siblingItem && siblingItem.stage === 1);
    const dualCodingBoost = hasDualCodingSynergy ? 1.55 : 1.0;

    if (!item) {
      return base * dualCodingBoost;
    }

    const R = computeRetrievability(item, nowMs);
    const forgettingUrgency = 1 + Math.max(0, 1 - R) * 1.4;
    const lapseBoost = item.lapses > 0 ? 1 + Math.min(item.lapses, 3) * 0.5 : 1.0;
    const interferenceBoost = item.confusedWith && item.confusedWith.length > 0 ? 1.35 : 1.0;
    const difficultyBoost = 1 + ((inferDifficulty(item) - 5) / 10) * 0.25;

    return Math.max(
      0.15,
      base * forgettingUrgency * lapseBoost * interferenceBoost * dualCodingBoost * difficultyBoost
    );
  };

  // 1. Stage 0 Due: target up to ceil(learningBudget * 0.45)
  const targetStage0 = Math.ceil(learningBudget * 0.45);
  const pickedStage0 = selectWeightedByRegion(
    dueStage0Pool,
    targetStage0,
    getRegion,
    regionWeights,
    computeCandidateWeight
  );
  for (const c of pickedStage0) {
    selectedLearning.push(c);
    selectedKeys.add(`${c.country.id}:${c.attributeId}`);
    selectedCountryIds.add(c.country.id);
  }

  // 2. Unseen Pool: target Math.max(0, Math.ceil(learningBudget * 0.45) - pickedStage0.length)
  const targetUnseen = Math.max(0, Math.ceil(learningBudget * 0.45) - pickedStage0.length);
  if (targetUnseen > 0) {
    const pickedUnseen = selectWeightedByRegion(
      unseenPool,
      targetUnseen,
      getRegion,
      regionWeights,
      computeCandidateWeight
    );
    for (const c of pickedUnseen) {
      selectedLearning.push(c);
      selectedKeys.add(`${c.country.id}:${c.attributeId}`);
      selectedCountryIds.add(c.country.id);
    }
  }

  // 3. Due Recall 0/2 Pool: target ceil(learningBudget * 0.35)
  const targetRecallZero = Math.ceil(learningBudget * 0.35);
  const pickedRecallZero = selectWeightedByRegion(
    dueRecallZeroPool,
    targetRecallZero,
    getRegion,
    regionWeights,
    computeCandidateWeight
  );
  for (const c of pickedRecallZero) {
    selectedLearning.push(c);
    selectedKeys.add(`${c.country.id}:${c.attributeId}`);
    selectedCountryIds.add(c.country.id);
  }

  // 4. Due Recall 1/2 Pool: target remaining slots
  const targetRecallOne = Math.max(0, learningBudget - selectedLearning.length);
  if (targetRecallOne > 0) {
    const pickedRecallOne = selectWeightedByRegion(
      dueRecallOnePool,
      targetRecallOne,
      getRegion,
      regionWeights,
      computeCandidateWeight
    );
    for (const c of pickedRecallOne) {
      selectedLearning.push(c);
      selectedKeys.add(`${c.country.id}:${c.attributeId}`);
      selectedCountryIds.add(c.country.id);
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
      const picked = selectWeightedByRegion(
        remainingInPool,
        needed,
        getRegion,
        regionWeights,
        computeCandidateWeight
      );
      for (const c of picked) {
        selectedLearning.push(c);
        selectedKeys.add(`${c.country.id}:${c.attributeId}`);
        selectedCountryIds.add(c.country.id);
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

  return interleaveSessionQueue(shuffleArray(sessionQueue), 4);
}

/**
 * Anti-Priming Interleaved Session Scheduler:
 * Ensures that two cards for the same entity (e.g. `FRA:location` and `FRA:capital`)
 * are separated by at least `minGap` intervening questions so one does not
 * trivially giveaway the other in short-term working memory.
 */
export function interleaveSessionQueue(
  questions: TrainingQuestion[],
  minGap: number = 4
): TrainingQuestion[] {
  if (questions.length <= 2) return [...questions];
  const pool = [...questions];
  const result: TrainingQuestion[] = [];

  while (pool.length > 0) {
    const recentEntityIds = new Set<string>(
      result.slice(Math.max(0, result.length - minGap)).map((q) => q.country.id)
    );
    const nonCollidingIdx = pool.findIndex((q) => !recentEntityIds.has(q.country.id));
    if (nonCollidingIdx !== -1) {
      result.push(pool.splice(nonCollidingIdx, 1)[0]);
    } else {
      result.push(pool.shift()!);
    }
  }

  return result;
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
