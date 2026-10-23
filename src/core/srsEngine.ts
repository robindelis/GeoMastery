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

export type CapitalQuestionDirection = 'country_to_capital' | 'capital_to_country';

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
  questionDirection?: CapitalQuestionDirection;
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
export const INTRADAY_LEARNING_STEP_MINUTES = 15;
export const LAPSE_RECOVERY_STEP_MINUTES = 10;
export const MIN_intraday_TO_RECALL_MINUTES = 10;
export const MIN_CONSOLIDATION_HOURS_FOR_MASTERY = 8;

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

  // 2. Compute prior FSRS Difficulty (D), Stability (S), and real elapsed time
  const prevD = inferDifficulty(item);
  const prevS = Math.max(0.25, inferStability(item));
  const lastMs = item.lastReviewedAt ? new Date(item.lastReviewedAt).getTime() : NaN;
  const hasPriorReview = !Number.isNaN(lastMs);
  const elapsedMs = hasPriorReview ? Math.max(0, nowMs - lastMs) : Infinity;
  const elapsedMinutes = hasPriorReview ? elapsedMs / 60000 : Infinity;
  const elapsedHours = hasPriorReview ? elapsedMs / 3600000 : Infinity;

  // True FSRS-6 power-law retrievability R(t, S) based on actual wall-clock elapsed time
  const rawR = hasPriorReview ? computeRetrievability(item, nowMs) : 0.85;
  const R = elapsedHours >= MIN_CONSOLIDATION_HOURS_FOR_MASTERY ? Math.min(0.92, rawR) : rawR;

  // 3. Update FSRS Difficulty D in [1, 10] with linear damping & mean reversion
  const d0Easy = Math.min(10, Math.max(1, FSRS_W.d0Base - Math.exp(FSRS_W.d0Exp * (4 - 1)) + 1));
  const deltaD = -FSRS_W.dDelta * (grade - 3);
  const dampedD = prevD + deltaD * ((10 - prevD) / 9);
  const nextDifficulty = Number(
    Math.min(10, Math.max(1, FSRS_W.dMeanRev * d0Easy + (1 - FSRS_W.dMeanRev) * dampedD)).toFixed(2)
  );

  let nextStability = prevS;
  let nextDueDate = new Date(nowMs);
  let confusedWith = [...(item.confusedWith || [])];

  if (isCorrect) {
    reps += 1;

    if (stage === 0) {
      // First exposure answered correctly -> Graduate to Stage 1 (Intraday Learning Step)
      // Scheduled for a 15-minute intraday spacing interval before active-recall verification
      stage = 1;
      step = 1;
      nextStability = grade === 4 ? 1.4 : grade === 3 ? 1.1 : 0.85;
      intervalDays = Number((INTRADAY_LEARNING_STEP_MINUTES / 1440).toFixed(4));
      nextDueDate = new Date(nowMs + INTRADAY_LEARNING_STEP_MINUTES * 60 * 1000);
      promotedToLearning = true;
    } else if (elapsedMinutes < MIN_intraday_TO_RECALL_MINUTES) {
      // Massed / too-early repeat (< 10 minutes since last review):
      // Real spaced repetition requires time between exposures. Do NOT jump horizon buckets!
      if (prevS < RECALL_STABILITY_DAYS) {
        nextStability = Math.min(RECALL_STABILITY_DAYS - 0.15, prevS + 0.1);
        intervalDays = Number((INTRADAY_LEARNING_STEP_MINUTES / 1440).toFixed(4));
        const existingDueMs = item.nextDueAt ? new Date(item.nextDueAt).getTime() : 0;
        nextDueDate = new Date(
          Math.max(existingDueMs, nowMs + INTRADAY_LEARNING_STEP_MINUTES * 60 * 1000)
        );
      } else {
        // Already in Recall or Mastered: preserve stability and future due date
        nextStability = prevS;
        intervalDays = Math.max(1, item.intervalDays || Math.round(prevS));
        const existingDueMs = item.nextDueAt ? new Date(item.nextDueAt).getTime() : 0;
        nextDueDate = new Date(Math.max(existingDueMs, nowMs + intervalDays * 86400000));
      }
    } else if (elapsedHours < MIN_CONSOLIDATION_HOURS_FOR_MASTERY) {
      // Intraday Spaced Review (10 minutes <= elapsed < 8 hours):
      // Can graduate a Learning card (S < 2.2d) into Recall (S in [2.2d, 2.9d], due tomorrow),
      // but CANNOT promote to Mastered (S >= 6.0d) without overnight / >=8h consolidation!
      step += 1;
      if (prevS < RECALL_STABILITY_DAYS) {
        nextStability = grade === 4 ? 2.8 : grade === 3 ? 2.45 : 2.2;
      } else {
        // Already in Recall on the same day: modest intraday reinforcement, strictly capped below Mastered
        const intradayFraction = Math.min(1, elapsedHours / MIN_CONSOLIDATION_HOURS_FOR_MASTERY);
        const maxIntradayGain = grade === 4 ? 0.75 : grade === 3 ? 0.5 : 0.25;
        nextStability = Math.min(
          MASTERY_STABILITY_DAYS - 0.3,
          prevS + maxIntradayGain * intradayFraction
        );
      }
      if (stage === 2) {
        nextStability = Math.max(MASTERY_STABILITY_DAYS, prevS);
        intervalDays = Math.max(7, Math.round(nextStability));
      } else {
        stage = 1;
        intervalDays = Math.max(1, Math.round(nextStability));
      }
      nextDueDate = new Date(nowMs + intervalDays * 86400000);
    } else {
      // Multi-Hour / Multi-Day Spaced Review (elapsed >= 8 hours):
      // True FSRS-6 DSR stability growth with desirable-difficulty gain
      step += 1;
      const hardMod = grade === 2 ? FSRS_W.hardPenalty : 1.0;
      const easyMod = grade === 4 ? FSRS_W.easyBonus : 1.0;

      const inc =
        Math.exp(FSRS_W.sRecallExp) *
        (11 - nextDifficulty) *
        Math.pow(prevS, -FSRS_W.sDecayPower) *
        (Math.exp(FSRS_W.sRetrievabilityGain * (1 - R)) - 1) *
        hardMod *
        easyMod;
      const minGrowth = grade === 4 ? 2.55 : grade === 3 ? 2.15 : 1.5;
      nextStability = Math.min(365, Math.max(prevS * minGrowth, prevS * (1 + inc)));

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
      nextDueDate = new Date(nowMs + intervalDays * 86400000);
    }

    // Latency-sensitive ease factor adjustment
    const easeDelta = grade === 4 ? 0.08 : grade === 3 ? 0.05 : -0.02;
    easeFactor = Number(Math.min(3.0, Math.max(1.3, easeFactor + easeDelta)).toFixed(2));
  } else {
    // Incorrect answer (Grade 1 Again):
    lapses += 1;
    step = 0;
    easeFactor = Number(Math.max(1.3, easeFactor - 0.2).toFixed(2));
    // Schedule real SRS re-test after LAPSE_RECOVERY_STEP_MINUTES (10 minutes)
    intervalDays = 0;
    nextDueDate = new Date(nowMs + LAPSE_RECOVERY_STEP_MINUTES * 60 * 1000);

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
  allCountries: Country[],
  explicitDirection?: CapitalQuestionDirection
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

  // Bidirectional Capital Questioning: Country -> Capital OR Capital -> Country
  const questionDirection: CapitalQuestionDirection | undefined =
    srsItem.attributeId === 'capital'
      ? explicitDirection ?? 'country_to_capital'
      : undefined;

  if (srsItem.attributeId === 'capital' && questionDirection === 'capital_to_country') {
    const prompt = `Which country has ${country.capital} as its capital?`;
    const correctAnswer = country.name;
    let expectedInputMode: InputMode = 'typing';
    let options: string[] | undefined = undefined;

    if (srsItem.stage === 0) {
      expectedInputMode = 'multiple_choice';
      const uniqueOpts = new Set<string>([correctAnswer]);

      // LECTOR Interference Resolution: inject previously confused nations first
      if (srsItem.confusedWith && srsItem.confusedWith.length > 0) {
        for (const confId of srsItem.confusedWith) {
          const confCountry = COUNTRIES_BY_ID.get(confId);
          if (confCountry && confCountry.name && !uniqueOpts.has(confCountry.name)) {
            uniqueOpts.add(confCountry.name);
            if (uniqueOpts.size >= 4) break;
          }
        }
      }

      const countryDef = ATTRIBUTE_REGISTRY.get('country');
      const distractors = countryDef
        ? countryDef.generateDistractors(country, allCountries, 5)
        : allCountries
            .filter((c) => c.id !== country.id && c.continent === country.continent)
            .slice(0, 5)
            .map((c) => c.name);

      for (const dist of distractors) {
        if (dist && !uniqueOpts.has(dist)) {
          uniqueOpts.add(dist);
          if (uniqueOpts.size >= 4) break;
        }
      }
      options = shuffleArray(Array.from(uniqueOpts));
    } else {
      expectedInputMode = 'typing';
      options = undefined;
    }

    return {
      srsItemId: srsItem.id,
      country,
      attributeId: srsItem.attributeId,
      stage: srsItem.stage,
      expectedInputMode,
      prompt,
      correctAnswer,
      options,
      questionDirection: 'capital_to_country'
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
    options,
    questionDirection
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
  practiceMode: boolean = false,
  allowedFlagCountryIds?: Set<string>
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
        // Strictly restrict 'flag' questions to the current continuous session's 50-flag cohort when provided
        if (
          attrId === 'flag' &&
          allowedFlagCountryIds &&
          allowedFlagCountryIds.size > 0 &&
          !allowedFlagCountryIds.has(country.id)
        ) {
          continue;
        }
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

  // If in Free Practice Drill Mode (or fallback reinforcement):
  // Prioritize unmastered cards (~85%) while keeping a small subset (~15%) of mastered cards
  if (practiceMode) {
    const unmasteredPool: QueueCandidate[] = [];
    const masteredPool: QueueCandidate[] = [];
    for (const cand of eligibleCandidates) {
      if (cand.existing && classifyCardHorizon(cand.existing) === 'mastered') {
        masteredPool.push(cand);
      } else {
        unmasteredPool.push(cand);
      }
    }

    const targetMastered =
      unmasteredPool.length === 0
        ? Math.min(batchSize, masteredPool.length)
        : masteredPool.length > 0
        ? Math.min(masteredPool.length, Math.max(1, Math.round(batchSize * 0.15)))
        : 0;
    const pickedMastered = shuffleArray(masteredPool).slice(0, targetMastered);
    const neededUnmastered = Math.max(0, batchSize - pickedMastered.length);
    const pickedUnmastered = shuffleArray(unmasteredPool).slice(0, neededUnmastered);

    let combined = [...pickedUnmastered, ...pickedMastered];
    if (combined.length < batchSize && masteredPool.length > pickedMastered.length) {
      const pickedIds = new Set(combined.map((c) => `${c.country.id}:${c.attributeId}`));
      const extraMastered = shuffleArray(
        masteredPool.filter((c) => !pickedIds.has(`${c.country.id}:${c.attributeId}`))
      ).slice(0, batchSize - combined.length);
      combined = [...combined, ...extraMastered];
    }

    let capCount = 0;
    const practiceQuestions = shuffleArray(combined).map((cand) => {
      const itemToUse = cand.existing || createInitialSRSItem(cand.country.id, cand.attributeId);
      const direction: CapitalQuestionDirection | undefined =
        cand.attributeId === 'capital'
          ? (capCount++ + (itemToUse.reps || 0)) % 2 === 1
            ? 'capital_to_country'
            : 'country_to_capital'
          : undefined;
      return buildQuestion(itemToUse, cand.country, allContextCountries, direction);
    });
    return interleaveSessionQueue(practiceQuestions, 4);
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

  const nowMs = Date.now();

  for (const cand of eligibleCandidates) {
    const item = cand.existing;
    if (!item) {
      unseenPool.push(cand);
    } else if (item.stage === 0) {
      if (item.nextDueAt <= now) {
        dueStage0Pool.push(cand);
      }
    } else if (classifyCardHorizon(item) === 'mastered') {
      if (item.nextDueAt <= now || item.intervalDays === 0) {
        dueMasteredPool.push(cand);
      } else {
        // Include Mastered cards in retention spot-checks if they haven't already been reviewed in the current sitting (last 2 hours)
        const lastRevMs = item.lastReviewedAt ? new Date(item.lastReviewedAt).getTime() : 0;
        if (!lastRevMs || nowMs - lastRevMs >= 2 * 3600000) {
          retentionMasteredPool.push(cand);
        }
      }
    } else {
      if (item.nextDueAt <= now) {
        if (classifyCardHorizon(item) === 'learning') {
          dueRecallZeroPool.push(cand);
        } else {
          dueRecallOnePool.push(cand);
        }
      }
    }
  }

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

  // Step A — Mastered Retention Slots (1-2 cards per batch, ~13-15%)
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
        totalMasteredCount >= 4
          ? Math.max(1, Math.min(3, Math.round(batchSize * 0.14)))
          : 1;

      // Pick from dueMasteredPool first
      const pickedDue = shuffleArray(dueMasteredPool).slice(0, targetMasteredCount);
      selectedMastered.push(...pickedDue);

      const neededRetention = targetMasteredCount - selectedMastered.length;
      if (neededRetention > 0 && retentionMasteredPool.length > 0) {
        const halfSliceCount = Math.max(neededRetention, Math.ceil(retentionMasteredPool.length * 0.6));
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
    fillFrom(retentionMasteredPool);
  }

  const allSelected = [...selectedMastered, ...selectedLearning];
  let capCount = 0;
  const sessionQueue: TrainingQuestion[] = allSelected.map((cand) => {
    const itemToUse = cand.existing || createInitialSRSItem(cand.country.id, cand.attributeId);
    const direction: CapitalQuestionDirection | undefined =
      cand.attributeId === 'capital'
        ? (capCount++ + (itemToUse.reps || 0)) % 2 === 1
          ? 'capital_to_country'
          : 'country_to_capital'
        : undefined;
    return buildQuestion(itemToUse, cand.country, allContextCountries, direction);
  });

  return interleaveSessionQueue(shuffleArray(sessionQueue), 4);
}

/**
 * Builds a smartly-sampled 50-Flag Study Cohort for a continuous session:
 * - Exclusively defines the 50 flags that can be asked during the continuous session.
 * - Includes a small maintenance subset of Mastered flags (~14%, e.g. 7 out of 50) weighted by
 *   lowest FSRS retrievability R(t, S) and time since last review so mastered flags stay in memory.
 * - Fills the remaining ~86% (e.g. 43 out of 50) by pushing unmastered flags:
 *   1. Due in-progress flags (Active Recall 1/2 & Learning 0/2 & Lapsed Stage 0)
 *   2. Consolidating in-progress flags (so active learning cards stay in the session cohort)
 *   3. Unseen flags sampled with regional balance and dual-coding synergy
 */
export function buildFlagStudyCohort(
  existingItemsMap: Map<string, SRSItem>,
  continentFilter: TrainingCategory,
  sessionQueue: TrainingQuestion[] = [],
  limit: number = 50,
  targetCountryId?: string | null
): Country[] {
  if (continentFilter === 'Oceans') return [];

  const eligibleCountries =
    continentFilter === 'All'
      ? COUNTRIES
      : COUNTRIES.filter((c) => c.continent === continentFilter);

  const targetCount = Math.min(limit, eligibleCountries.length);
  if (eligibleCountries.length <= targetCount) {
    return shuffleArray(eligibleCountries);
  }

  const selectedMap = new Map<string, Country>();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  // 1. If a specific target country was requested, include it first
  if (targetCountryId && !targetCountryId.startsWith('WATER_')) {
    const targetCountry = eligibleCountries.find((c) => c.id === targetCountryId);
    if (targetCountry) {
      selectedMap.set(targetCountry.id, targetCountry);
    }
  }

  // 2. If a pre-built sessionQueue was passed, include any explicit flag questions in it
  for (const q of sessionQueue) {
    if (q.attributeId === 'flag' && !q.country.id.startsWith('WATER_')) {
      if (eligibleCountries.some((c) => c.id === q.country.id)) {
        selectedMap.set(q.country.id, q.country);
        if (selectedMap.size >= targetCount) {
          return Array.from(selectedMap.values());
        }
      }
    }
  }

  // Compute regional balance weights for flag mastery across continents
  const regionTotals = new Map<string, number>();
  const regionUnmastered = new Map<string, number>();
  for (const c of eligibleCountries) {
    const reg = c.continent;
    regionTotals.set(reg, (regionTotals.get(reg) || 0) + 1);
    const item = existingItemsMap.get(`${c.id}:flag`);
    if (!item || classifyCardHorizon(item) !== 'mastered') {
      regionUnmastered.set(reg, (regionUnmastered.get(reg) || 0) + 1);
    }
  }

  const regionWeights = new Map<string, number>();
  for (const [reg, total] of regionTotals.entries()) {
    const unmasteredRatio = (regionUnmastered.get(reg) || 0) / Math.max(1, total);
    regionWeights.set(reg, 1 + unmasteredRatio * 2.5);
  }

  // Partition remaining eligible countries by Flag SRS Horizon
  const dueInProgressPool: Country[] = [];
  const consolidatingInProgressPool: Country[] = [];
  const unseenPool: Country[] = [];
  const masteredPool: Country[] = [];

  for (const c of eligibleCountries) {
    if (selectedMap.has(c.id)) continue;
    const item = existingItemsMap.get(`${c.id}:flag`);
    if (!item) {
      unseenPool.push(c);
    } else if (classifyCardHorizon(item) === 'mastered') {
      masteredPool.push(c);
    } else if (item.nextDueAt <= now || item.intervalDays === 0) {
      dueInProgressPool.push(c);
    } else {
      consolidatingInProgressPool.push(c);
    }
  }

  const getRegion = (c: Country) => c.continent;

  // 3. Sample a small subset of Mastered flags (~14%, e.g. 7 out of 50) for long-term memory maintenance
  const totalUnmasteredAvailable =
    dueInProgressPool.length + consolidatingInProgressPool.length + unseenPool.length;
  const remainingSlotsAfterMandatory = Math.max(0, targetCount - selectedMap.size);

  const baseMasteredTarget =
    masteredPool.length > 0
      ? Math.min(masteredPool.length, Math.max(3, Math.round(targetCount * 0.14)))
      : 0;
  const targetMasteredCount = Math.min(
    masteredPool.length,
    Math.max(baseMasteredTarget, remainingSlotsAfterMandatory - totalUnmasteredAvailable)
  );

  if (targetMasteredCount > 0) {
    const pickedMastered = selectWeightedByRegion(
      masteredPool,
      targetMasteredCount,
      getRegion,
      regionWeights,
      (c) => {
        const item = existingItemsMap.get(`${c.id}:flag`);
        if (!item) return 1;
        const R = computeRetrievability(item, nowMs);
        const lastRevMs = item.lastReviewedAt ? new Date(item.lastReviewedAt).getTime() : 0;
        const elapsedHours = lastRevMs ? Math.max(0, (nowMs - lastRevMs) / 3600000) : 72;
        // Deprioritize mastered flags reviewed within the last 2 hours so new sessions rotate fresh mastered flags
        if (elapsedHours < 2) return 0.12;
        const isDueNow = item.nextDueAt <= now;
        const dueBoost = isDueNow ? 4.0 : 1.0;
        const forgettingBoost = 1 + Math.max(0, 1 - R) * 3.0;
        const ageBoost = Math.min(2.0, elapsedHours / 48);
        return dueBoost * forgettingBoost + ageBoost;
      }
    );
    for (const c of pickedMastered) {
      selectedMap.set(c.id, c);
    }
  }

  // 4. Fill the unmastered budget by pushing in-progress flags first, then introducing unseen flags
  const unmasteredBudget = Math.max(0, targetCount - selectedMap.size);

  // 4a. Due In-Progress Flags (Recall 1/2, Learning 0/2, Lapsed Stage 0) — up to 55% of unmasteredBudget
  const targetDueInProgress = Math.min(
    dueInProgressPool.length,
    Math.ceil(unmasteredBudget * 0.55)
  );
  if (targetDueInProgress > 0) {
    const pickedDueInProgress = selectWeightedByRegion(
      dueInProgressPool,
      targetDueInProgress,
      getRegion,
      regionWeights,
      (c) => {
        const base = regionWeights.get(c.continent) ?? 1;
        const item = existingItemsMap.get(`${c.id}:flag`);
        if (!item) return base;
        const horizon = classifyCardHorizon(item);
        // Strong push for 'recall' cards (1 step away from Mastery) and lapsed cards
        const horizonBoost = horizon === 'recall' ? 1.65 : 1.25;
        const lapseBoost = item.lapses > 0 ? 1 + Math.min(item.lapses, 3) * 0.45 : 1.0;
        const interferenceBoost = item.confusedWith && item.confusedWith.length > 0 ? 1.35 : 1.0;
        const R = computeRetrievability(item, nowMs);
        const urgencyBoost = 1 + Math.max(0, 1 - R) * 1.5;
        return base * horizonBoost * lapseBoost * interferenceBoost * urgencyBoost;
      }
    );
    for (const c of pickedDueInProgress) {
      selectedMap.set(c.id, c);
    }
  }

  // 4b. Consolidating In-Progress Flags — up to 20% of unmasteredBudget so active learning cards stay in cohort
  const remainingForConsolidating = Math.max(0, targetCount - selectedMap.size);
  const targetConsolidating = Math.min(
    consolidatingInProgressPool.length,
    Math.min(remainingForConsolidating, Math.ceil(unmasteredBudget * 0.2))
  );
  if (targetConsolidating > 0) {
    const pickedConsolidating = selectWeightedByRegion(
      consolidatingInProgressPool,
      targetConsolidating,
      getRegion,
      regionWeights,
      (c) => {
        const base = regionWeights.get(c.continent) ?? 1;
        const item = existingItemsMap.get(`${c.id}:flag`);
        if (!item) return base;
        const horizon = classifyCardHorizon(item);
        const horizonBoost = horizon === 'recall' ? 1.5 : 1.2;
        const dueMs = item.nextDueAt ? new Date(item.nextDueAt).getTime() : nowMs;
        const hoursUntilDue = Math.max(0.1, (dueMs - nowMs) / 3600000);
        // Prefer cards whose consolidation timer will unlock soonest
        const proximityBoost = 1 + 1 / (1 + hoursUntilDue);
        return base * horizonBoost * proximityBoost;
      }
    );
    for (const c of pickedConsolidating) {
      selectedMap.set(c.id, c);
    }
  }

  // 4c. Unseen Flags — fill remaining slots with regional balance & Dual-Coding synergy
  const remainingForUnseen = Math.max(0, targetCount - selectedMap.size);
  if (remainingForUnseen > 0 && unseenPool.length > 0) {
    const pickedUnseen = selectWeightedByRegion(
      unseenPool,
      remainingForUnseen,
      getRegion,
      regionWeights,
      (c) => {
        const base = regionWeights.get(c.continent) ?? 1;
        // Boost unseen flags for countries the learner has already encountered in Capital/Location/Map
        const hasKnownSibling = ['capital', 'location', 'country'].some((attr) =>
          existingItemsMap.has(`${c.id}:${attr}`)
        );
        return base * (hasKnownSibling ? 1.45 : 1.0);
      }
    );
    for (const c of pickedUnseen) {
      selectedMap.set(c.id, c);
    }
  }

  // 5. Rollover if any pool had fewer items than its quota so we always reach targetCount (50)
  if (selectedMap.size < targetCount) {
    for (const pool of [
      dueInProgressPool,
      consolidatingInProgressPool,
      unseenPool,
      masteredPool
    ]) {
      const remaining = pool.filter((c) => !selectedMap.has(c.id));
      const needed = targetCount - selectedMap.size;
      if (needed <= 0) break;
      if (remaining.length === 0) continue;
      const picked = selectWeightedByRegion(remaining, needed, getRegion, regionWeights);
      for (const c of picked) {
        selectedMap.set(c.id, c);
      }
    }
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
 * Inserts a question into a continuous stream queue at or after `desiredOffset` cards ahead
 * of `currentIndex`, respecting the `minGap` anti-priming spacing between same-country cards.
 */
function insertQuestionWithAntiPriming(
  queue: TrainingQuestion[],
  currentIndex: number,
  questionToInsert: TrainingQuestion,
  desiredOffset: number,
  minGap: number = 4
): TrainingQuestion[] {
  const nextQueue = [...queue];
  const startIdx = Math.min(nextQueue.length, Math.max(currentIndex + 1, currentIndex + 1 + desiredOffset));

  let chosenIdx = startIdx;
  for (let pos = startIdx; pos <= nextQueue.length; pos++) {
    const winStart = Math.max(currentIndex + 1, pos - minGap);
    const winEnd = Math.min(nextQueue.length, pos + minGap);
    let hasCollision = false;
    for (let i = winStart; i < winEnd; i++) {
      if (nextQueue[i].country.id === questionToInsert.country.id) {
        hasCollision = true;
        break;
      }
    }
    if (!hasCollision) {
      chosenIdx = pos;
      break;
    }
  }

  nextQueue.splice(chosenIdx, 0, questionToInsert);
  return nextQueue;
}

/**
 * Continuous Stream Error-Scaffolding & Time-Respecting Queue Manager:
 * - Real Spaced Repetition is governed by wall-clock time (`nextDueAt`), NOT card count!
 * - When a card is answered correctly (`isCorrect === true`), it is NEVER artificially re-inserted
 *   into the stream a few cards later. Instead, its real `nextDueAt` (15 minutes for L0->L1 intraday
 *   learning, 24 hours for Recall, 7+ days for Mastered) determines when it can next appear.
 * - When a card is missed (`!isCorrect`), we insert at most ONE short-term scaffolding retry
 *   (`+6` cards ahead, `isRetry: true`) that does NOT mutate SRS progress, while its real SRS re-test
 *   waits for the 10-minute `nextDueAt` timer.
 */
export function scheduleInStreamFollowUp(
  queue: TrainingQuestion[],
  currentIndex: number,
  answeredQuestion: TrainingQuestion,
  updatedItem: SRSItem,
  isCorrect: boolean,
  wasRetry: boolean = false
): TrainingQuestion[] {
  const waterCountries = WATER_BODIES.map(waterBodyToCountry);
  const allContextCountries = answeredQuestion.country.id.startsWith('WATER_')
    ? [...COUNTRIES, ...waterCountries]
    : COUNTRIES;

  // Always strip any duplicate occurrences of this srsItemId from the upcoming lookahead buffer
  // so the user never gets the same card twice in a short window
  const prefix = queue.slice(0, currentIndex + 1);
  const cleanTail = queue
    .slice(currentIndex + 1)
    .filter((q) => q.srsItemId !== answeredQuestion.srsItemId);
  let nextQueue = [...prefix, ...cleanTail];

  // If missed on a normal question (not already a retry), insert a single non-mutating scaffolding retry (+6 cards)
  if (!isCorrect && !wasRetry) {
    const retryQuestion: TrainingQuestion = {
      ...buildQuestion(
        updatedItem,
        answeredQuestion.country,
        allContextCountries,
        answeredQuestion.questionDirection
      ),
      isRetry: true
    };
    nextQueue = insertQuestionWithAntiPriming(nextQueue, currentIndex, retryQuestion, 6, 4);
  }

  return nextQueue;
}

/**
 * Rolling Horizon Stream Replenisher:
 * Continuously stocks the upcoming training stream when the lookahead buffer runs low.
 * - Strictly respects `nextDueAt` wall-clock timestamps: never pulls cards scheduled in the future
 *   as SRS-mutating cards.
 * - Strictly restricts `'flag'` questions to `allowedFlagCountryIds` (the session's 50-flag cohort).
 * - Deduplicates against cards already waiting in `currentQueue.slice(currentIndex + 1)`.
 * - If all due & unseen cards in the filtered region/cohort are currently waiting for future `nextDueAt`
 *   timers, seamlessly serves non-mutating retention/practice cards (`isRetry: true`) from the same
 *   cohort until real-time due timestamps arrive.
 */
export function replenishStreamQueue(
  currentQueue: TrainingQuestion[],
  currentIndex: number,
  existingItemsMap: Map<string, SRSItem>,
  continentFilter: 'All' | Continent | 'Oceans',
  attributeFilter: string[],
  chunkSize: number = 18,
  practiceMode: boolean = false,
  allowedFlagCountryIds?: Set<string>
): { queue: TrainingQuestion[]; enteredRetentionStream: boolean } {
  const upcoming = currentQueue.slice(Math.max(0, currentIndex + 1));
  const upcomingIds = new Set<string>(upcoming.map((q) => q.srsItemId));

  // Create a filtered view of itemsMap that temporarily marks already-queued items as far-future mastered
  // so prepareSessionQueue naturally skips them and selects fresh complementary cards
  const maskedMap = new Map<string, SRSItem>(existingItemsMap);
  const farFuture = new Date(Date.now() + 180 * 86400000).toISOString();

  for (const queuedId of upcomingIds) {
    const orig =
      existingItemsMap.get(queuedId) ||
      createInitialSRSItem(queuedId.split(':')[0], queuedId.split(':')[1] || 'capital');
    maskedMap.set(queuedId, {
      ...orig,
      stage: 2,
      stability: 90,
      intervalDays: 90,
      nextDueAt: farFuture,
      lastReviewedAt: new Date().toISOString()
    });
  }

  let freshBatch: TrainingQuestion[] = [];
  let enteredRetentionStream = false;

  if (!practiceMode) {
    // Only pull cards that are genuinely due right now (`nextDueAt <= now`) or unseen within the cohort
    freshBatch = prepareSessionQueue(
      maskedMap,
      continentFilter,
      attributeFilter,
      chunkSize * 2,
      false,
      allowedFlagCountryIds
    ).filter((q) => !upcomingIds.has(q.srsItemId));
  }

  // If all due & unseen cards in this filter/cohort are currently scheduled in the future (`nextDueAt > now`),
  // serve non-mutating practice/retention cards (`isRetry: true`) exclusively from the same cohort
  // so the stream continues smoothly without artificially advancing SRS stages before real time has elapsed!
  if (freshBatch.length === 0) {
    if (!practiceMode) {
      enteredRetentionStream = true;
    }
    const nowMs = Date.now();
    const fallbackPool = prepareSessionQueue(
      existingItemsMap,
      continentFilter,
      attributeFilter,
      chunkSize * 3,
      true,
      allowedFlagCountryIds
    ).map((q) => ({
      ...q,
      isRetry: !practiceMode ? true : q.isRetry
    }));

    // Prioritize cards that were NOT reviewed in the last 5 minutes so we don't repeat just-seen cards
    const notJustReviewed = fallbackPool.filter((q) => {
      if (upcomingIds.has(q.srsItemId)) return false;
      const item = existingItemsMap.get(q.srsItemId);
      if (!item || !item.lastReviewedAt) return true;
      const elapsedMin = (nowMs - new Date(item.lastReviewedAt).getTime()) / 60000;
      return elapsedMin >= 5;
    });

    const nonDuplicate = fallbackPool.filter((q) => !upcomingIds.has(q.srsItemId));
    freshBatch =
      notJustReviewed.length > 0
        ? notJustReviewed
        : nonDuplicate.length > 0
        ? nonDuplicate
        : fallbackPool;
  }

  const selectedChunk = freshBatch.slice(0, chunkSize);
  if (selectedChunk.length === 0) {
    return { queue: currentQueue, enteredRetentionStream };
  }

  // Interleave the boundary between existing queue tail and the newly appended chunk
  const tailWindow = currentQueue.slice(Math.max(0, currentQueue.length - 4));
  const combinedForInterleave = [...tailWindow, ...selectedChunk];
  const interleaved = interleaveSessionQueue(combinedForInterleave, 4);

  // Extract only the newly added items in their anti-primed order
  const tailCounts = new Map<string, number>();
  for (const t of tailWindow) {
    tailCounts.set(t.srsItemId, (tailCounts.get(t.srsItemId) || 0) + 1);
  }
  const appended: TrainingQuestion[] = [];
  for (const q of interleaved) {
    const rem = tailCounts.get(q.srsItemId) || 0;
    if (rem > 0) {
      tailCounts.set(q.srsItemId, rem - 1);
    } else {
      appended.push(q);
    }
  }

  return {
    queue: [...currentQueue, ...appended],
    enteredRetentionStream
  };
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
