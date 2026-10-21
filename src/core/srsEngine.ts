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

export const MASTERY_STABILITY_DAYS = 6.0;
export const RECALL_STABILITY_DAYS = 2.2;

export type HorizonBucket = 'mastered' | 'recall' | 'learning' | 'unseen';

/**
 * Calibrates / infers FSRS Stability (S in days at 90% retrievability) from a card's current state.
 * Seamlessly migrates existing user cards based on their current stage, interval, reps, and lapses.
 */
export function inferStability(item?: SRSItem): number {
  if (!item) return 0;
  if (typeof item.stability === 'number' && item.stability > 0) {
    if (item.stage === 2 && item.stability < MASTERY_STABILITY_DAYS) {
      return Math.max(MASTERY_STABILITY_DAYS, item.intervalDays || 7.0);
    }
    return item.stability;
  }
  if (item.stage === 2) {
    return Math.max(7.0, item.intervalDays || 7.0);
  }
  if (item.stage === 1) {
    if (item.intervalDays >= 2) return item.intervalDays;
    // Migrate existing cards that were already in consolidating recall vs fresh acquisition
    const legacyStreak = (item as any).consecutiveRecallCorrect || 0;
    if (legacyStreak >= 1 || (item.reps >= 2 && item.lapses === 0)) {
      return 2.8;
    }
    return 1.2;
  }
  return 0.4;
}

/**
 * Calibrates / infers FSRS Difficulty D in [1, 10] from a card's current state.
 */
export function inferDifficulty(item?: SRSItem): number {
  if (!item) return 5.0;
  if (typeof item.difficulty === 'number' && item.difficulty >= 1 && item.difficulty <= 10) {
    return item.difficulty;
  }
  // Derive from existing easeFactor, lapses, and average response latency in history
  const fromEase = 10 - ((Math.min(3.0, Math.max(1.3, item.easeFactor || 2.5)) - 1.3) / 1.7) * 7.5;
  const lapseBump = Math.min(2.2, (item.lapses || 0) * 0.45);
  let latencyAdj = 0;
  if (item.history && item.history.length > 0) {
    const avgMs =
      item.history.reduce((acc, h) => acc + (h.timeSpentMs || 3000), 0) / item.history.length;
    if (avgMs < 2400) latencyAdj = -0.5;
    else if (avgMs > 7500) latencyAdj = 0.6;
  }
  return Math.min(10, Math.max(1, Number((fromEase + lapseBump + latencyAdj).toFixed(2))));
}

/**
 * Classifies any card into one of the 4 Memory Horizon buckets based purely on its FSRS state:
 * - 'unseen': never reviewed (!item)
 * - 'mastered': long-term memory (stage === 2 or Stability S >= 6.0d)
 * - 'recall': consolidating active recall (stage === 1 and Stability S in [2.2d, 6.0d))
 * - 'learning': initial acquisition (stage === 0 or stage === 1 with Stability S < 2.2d)
 */
export function classifyCardHorizon(item?: SRSItem): HorizonBucket {
  if (!item) return 'unseen';
  const S = inferStability(item);
  if (item.stage === 2 || S >= MASTERY_STABILITY_DAYS) return 'mastered';
  if (item.stage === 1 && S >= RECALL_STABILITY_DAYS) return 'recall';
  return 'learning';
}

/**
 * Non-destructively populates calibrated FSRS parameters (`stability`, `difficulty`, `stage`)
 * on an existing SRSItem based on its current state.
 */
export function calibrateSRSItem(item: SRSItem): SRSItem {
  const S = Number(inferStability(item).toFixed(2));
  const D = inferDifficulty(item);
  const stage: SRSStage =
    item.stage === 0 ? 0 : S >= MASTERY_STABILITY_DAYS || item.stage === 2 ? 2 : 1;
  return {
    ...item,
    stage,
    stability: S,
    difficulty: D
  };
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
    stage: 0, // Starts at Stage 0 (Multiple Choice / Recognition Scaffolding)
    step: 0,
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
 * Updates an SRS item after an answer attempt using the pure FSRS-6 DSR + ACT-R Latency model.
 * - Stage 0 (Recognition Scaffolding): First correct answer transitions to Stage 1 (Active Recall)
 *   with initial FSRS Stability S calibrated by ACT-R response latency.
 * - Stage 1+ (Active Recall): Stability S and Difficulty D evolve continuously via FSRS-6 equations.
 *   When S >= MASTERY_STABILITY_DAYS (6.0d), the card is promoted to Stage 2 (Mastered).
 * - Any lapse computes post-lapse stability S'_f (< 6.0d), demoting Stage 2 back to Stage 1
 *   for immediate reinforcement while preserving a partial memory trace.
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
  let promotedToLearning = false;
  let promotedToMastered = false;

  // 1. Derive ACT-R latency grade (1=Again, 2=Hard, 3=Good, 4=Easy)
  const grade = deriveActRGrade(isCorrect, inputMode, timeSpentMs);

  // 2. Compute prior FSRS Difficulty (D), Stability (S), and Retrievability (R)
  const prevD = inferDifficulty(item);
  const prevS = Math.max(0.25, inferStability(item));
  const lastMs = item.lastReviewedAt ? new Date(item.lastReviewedAt).getTime() : NaN;
  const elapsedDays = !Number.isNaN(lastMs) ? Math.max(0, (nowMs - lastMs) / 86400000) : 0;
  // Use effective retrievability (bounded <= 0.92 on scheduled reviews so desirable-difficulty gain applies)
  const rawR = item.lastReviewedAt ? computeRetrievability(item, nowMs) : 0.85;
  const R = Math.min(0.92, rawR);

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

    if (stage === 0) {
      // First exposure answered correctly -> Graduate to Stage 1 (Active Recall)
      stage = 1;
      step = 1;
      nextStability = grade === 4 ? 1.9 : grade === 3 ? 1.4 : 1.0;
      intervalDays = 1;
      promotedToLearning = true;
    } else {
      // Active Recall (Stage 1 or Stage 2): pure FSRS-6 DSR stability growth
      step += 1;
      const hardMod = grade === 2 ? FSRS_W.hardPenalty : 1.0;
      const easyMod = grade === 4 ? FSRS_W.easyBonus : 1.0;

      if (elapsedDays < 0.25 && item.lastReviewedAt) {
        // Same-session / same-day review: controlled stability boost scaled by ACT-R latency grade
        const sameDayMult = grade === 4 ? 2.55 : grade === 3 ? 2.15 : 1.5;
        nextStability = Math.min(365, Math.max(RECALL_STABILITY_DAYS + 0.3, prevS * sameDayMult));
      } else {
        const inc =
          Math.exp(FSRS_W.sRecallExp) *
          (11 - nextDifficulty) *
          Math.pow(prevS, -FSRS_W.sDecayPower) *
          (Math.exp(FSRS_W.sRetrievabilityGain * (1 - R)) - 1) *
          hardMod *
          easyMod;
        const minGrowth = grade === 4 ? 2.55 : grade === 3 ? 2.15 : 1.5;
        nextStability = Math.min(365, Math.max(prevS * minGrowth, prevS * (1 + inc)));
      }

      if (stage === 1 && nextStability >= MASTERY_STABILITY_DAYS) {
        stage = 2;
        promotedToMastered = true;
        intervalDays = Math.max(7, Math.min(365, Math.round(nextStability)));
        nextStability = Math.max(nextStability, intervalDays);
      } else if (stage === 2) {
        intervalDays = Math.max(14, Math.min(365, Math.round(nextStability)));
        nextStability = Math.max(nextStability, intervalDays);
      } else {
        // Consolidating in Stage 1 (S in [2.2d, 6.0d))
        nextStability = Math.max(RECALL_STABILITY_DAYS, nextStability);
        intervalDays = Math.max(1, Math.round(nextStability));
      }
    }

    // Latency-sensitive ease factor adjustment
    const easeDelta = grade === 4 ? 0.08 : grade === 3 ? 0.05 : -0.02;
    easeFactor = Number(Math.min(3.0, Math.max(1.3, easeFactor + easeDelta)).toFixed(2));
  } else {
    // Incorrect answer (Grade 1 Again):
    lapses += 1;
    step = 0;
    easeFactor = Number(Math.max(1.3, easeFactor - 0.2).toFixed(2));
    intervalDays = 0; // Due immediately for reinforcement

    // FSRS post-lapse stability S'_f (bounded < RECALL_STABILITY_DAYS so it re-enters acquisition learning)
    const rawPostLapse =
      FSRS_W.sForgetBase *
      Math.pow(nextDifficulty, -FSRS_W.sForgetDiffPow) *
      (Math.pow(prevS + 1, FSRS_W.sForgetStabPow) - 1) *
      Math.exp(FSRS_W.sForgetRetGain * (1 - R));
    nextStability = Math.max(0.6, Math.min(RECALL_STABILITY_DAYS - 0.2, rawPostLapse, prevS * 0.45));

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
    } else if (srsItem.attributeId === 'country' || srsItem.attributeId === 'flag') {
      expectedInputMode = 'typing';
      options = undefined;
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
    } else if (classifyCardHorizon(item) === 'mastered') {
      if (item.nextDueAt <= now || item.intervalDays === 0) {
        dueMasteredPool.push(cand);
      } else {
        retentionMasteredPool.push(cand);
      }
    } else {
      if (item.nextDueAt <= now || item.intervalDays === 0) {
        if (classifyCardHorizon(item) === 'learning') {
          dueRecallZeroPool.push(cand);
        } else {
          dueRecallOnePool.push(cand);
        }
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
    const siblingAttrs = ['capital', 'location', 'country', 'flag'].filter((a) => a !== cand.attributeId);
    const hasSiblingInLearning = siblingAttrs.some(
      (attr) => existingItemsMap.get(`${cand.country.id}:${attr}`)?.stage === 1
    );

    // Paivio Dual-Coding Synergy: boost if sibling attribute is in active learning or in session
    const hasDualCodingSynergy = selectedCountryIds.has(cand.country.id) || hasSiblingInLearning;
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
 * Builds a pre-session Flag Study Cohort of up to `limit` (default 50) countries.
 * Guarantees that every country with a `'flag'` question in `sessionQueue` is included first,
 * then fills remaining slots up to `limit` with due/unseen `'flag'` cards from `continentFilter`.
 */
export function buildFlagStudyCohort(
  existingItemsMap: Map<string, SRSItem>,
  continentFilter: TrainingCategory,
  sessionQueue: TrainingQuestion[],
  limit: number = 50
): Country[] {
  if (continentFilter === 'Oceans') return [];

  const eligibleCountries =
    continentFilter === 'All'
      ? COUNTRIES
      : COUNTRIES.filter((c) => c.continent === continentFilter);

  const targetCount = Math.min(limit, eligibleCountries.length);
  const selectedMap = new Map<string, Country>();

  // 1. Always include all countries that appear as flag questions in the upcoming session queue
  for (const q of sessionQueue) {
    if (q.attributeId === 'flag' && !q.country.id.startsWith('WATER_')) {
      selectedMap.set(q.country.id, q.country);
      if (selectedMap.size >= targetCount) break;
    }
  }

  // 2. Also include other countries in the session queue if space remains
  if (selectedMap.size < targetCount) {
    for (const q of sessionQueue) {
      if (!q.country.id.startsWith('WATER_') && !selectedMap.has(q.country.id)) {
        selectedMap.set(q.country.id, q.country);
        if (selectedMap.size >= targetCount) break;
      }
    }
  }

  if (selectedMap.size >= targetCount) {
    return Array.from(selectedMap.values());
  }

  // 3. Fill remaining slots up to `targetCount` prioritizing learning/unseen/due flag cards
  const now = new Date().toISOString();
  const learningPool: Country[] = [];
  const unseenPool: Country[] = [];
  const recallDuePool: Country[] = [];
  const otherPool: Country[] = [];

  for (const c of shuffleArray(eligibleCountries)) {
    if (selectedMap.has(c.id)) continue;
    const item = existingItemsMap.get(`${c.id}:flag`);
    if (!item) {
      unseenPool.push(c);
    } else if (item.stage === 0 || classifyCardHorizon(item) === 'learning') {
      learningPool.push(c);
    } else if (item.nextDueAt <= now || item.intervalDays === 0) {
      recallDuePool.push(c);
    } else {
      otherPool.push(c);
    }
  }

  for (const pool of [learningPool, unseenPool, recallDuePool, otherPool]) {
    for (const c of pool) {
      selectedMap.set(c.id, c);
      if (selectedMap.size >= targetCount) break;
    }
    if (selectedMap.size >= targetCount) break;
  }

  return Array.from(selectedMap.values());
}

/**
 * Builds an active-recall Flag question queue from a studied cohort of countries.
 */
export function buildFlagCohortQuestions(
  existingItemsMap: Map<string, SRSItem>,
  cohortCountries: Country[]
): TrainingQuestion[] {
  const questions = cohortCountries.map((country) => {
    const item = existingItemsMap.get(`${country.id}:flag`) || createInitialSRSItem(country.id, 'flag');
    return buildQuestion(item, country, COUNTRIES);
  });
  return shuffleArray(questions);
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
      if (classifyCardHorizon(item) === 'mastered') return 2;
      return 1;
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
    } else if (classifyCardHorizon(item) === 'mastered') {
      waterBreakdown.stage2++;
      globalStage2++;
    } else {
      waterBreakdown.stage1++;
      globalStage1++;
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
