import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Country, Continent, TrainingCategory, SRSItem, MapViewMode } from '../../core/types';
import { COUNTRIES, COUNTRIES_BY_ID } from '../../assets/data/countries';
import {
  TrainingQuestion,
  prepareSessionQueue,
  replenishStreamQueue,
  scheduleInStreamFollowUp,
  processAnswer,
  buildQuestion,
  createInitialSRSItem,
  waterBodyToCountry,
  inferStability,
  buildFlagStudyCohort,
  buildFlagCohortQuestions
} from '../../core/srsEngine';
import { getWaterBodyById } from '../../assets/data/waterBodies';
import { ATTRIBUTE_REGISTRY, validateCountryNameAnswer } from '../../core/attributes';
import { StorageService } from '../../core/storage';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';
import { MapContainer } from '../map/MapContainer';
import { MultipleChoicePrompt } from './MultipleChoicePrompt';
import { TypingRecallPrompt } from './TypingRecallPrompt';
import { MapClickPrompt } from './MapClickPrompt';
import { FlagStudyRecap } from './FlagStudyRecap';
import { Flame, Sparkles, Zap, Flag, BarChart3, CheckCircle2, TrendingUp } from 'lucide-react';
import { AmbientBackground } from '../common/AmbientBackground';
import { SessionCompletedView, SessionAnswerRecord } from './SessionCompletedView';

interface TrainingSessionProps {
  continentFilter: TrainingCategory;
  attributeFilter: string[];
  initialPracticeMode?: boolean;
  targetCountryId?: string | null;
  mapMode: MapViewMode;
  onToggleMapMode: (mode: MapViewMode) => void;
  onFinishSession: () => void;
}

const STREAM_INITIAL_CHUNK = 24;
const STREAM_LOW_WATERMARK = 12;
const STREAM_REPLENISH_CHUNK = 18;

function createInitialStreamQueue(
  items: Map<string, SRSItem>,
  continentFilter: TrainingCategory,
  attributeFilter: string[],
  isPracticeMode: boolean,
  targetCountryId?: string | null,
  allowedFlagCountryIds?: Set<string>
): { queue: TrainingQuestion[]; enteredRetentionStream: boolean } {
  if (targetCountryId) {
    const wb = getWaterBodyById(targetCountryId);
    const c = wb ? waterBodyToCountry(wb) : COUNTRIES_BY_ID.get(targetCountryId);
    if (c) {
      const countryContext = COUNTRIES;
      const activeAttrs = attributeFilter.length > 0 ? attributeFilter : ['capital', 'location'];
      const targetedQueue = activeAttrs.map((attrId) => {
        const item = items.get(`${c.id}:${attrId}`) || createInitialSRSItem(c.id, attrId);
        return buildQuestion(item, c, countryContext);
      });
      if (targetedQueue.length > 0) {
        // Follow targeted country cards with the broader continuous stream
        const replenished = replenishStreamQueue(
          targetedQueue,
          -1,
          items,
          continentFilter,
          attributeFilter,
          STREAM_INITIAL_CHUNK,
          isPracticeMode,
          allowedFlagCountryIds
        );
        return replenished;
      }
    }
  }
  return replenishStreamQueue(
    [],
    -1,
    items,
    continentFilter,
    attributeFilter,
    STREAM_INITIAL_CHUNK,
    isPracticeMode,
    allowedFlagCountryIds
  );
}

export const TrainingSession: React.FC<TrainingSessionProps> = ({
  continentFilter,
  attributeFilter,
  initialPracticeMode = false,
  targetCountryId = null,
  mapMode,
  onToggleMapMode,
  onFinishSession
}) => {
  // Persistent SRS map loaded synchronously
  const [srsItemsMap, setSrsItemsMap] = useState<Map<string, SRSItem>>(() => StorageService.loadSRSItems());

  const canStudyFlags = attributeFilter.includes('flag') && continentFilter !== 'Oceans';

  // Generate the 50-flag cohort FIRST so the continuous stream exclusively asks flags from this 50-flag cohort
  const initialFlagCohortRef = useRef<Country[]>(
    canStudyFlags ? buildFlagStudyCohort(srsItemsMap, continentFilter, [], 50, targetCountryId) : []
  );
  const flagStudyCohortIdsRef = useRef<Set<string>>(
    new Set(initialFlagCohortRef.current.map((c) => c.id))
  );

  // Build initial continuous stream synchronously using the session's 50-flag cohort
  const initialStreamState = useRef(
    createInitialStreamQueue(
      srsItemsMap,
      continentFilter,
      attributeFilter,
      initialPracticeMode,
      targetCountryId,
      flagStudyCohortIdsRef.current
    )
  );

  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(
    initialPracticeMode || initialStreamState.current.enteredRetentionStream
  );
  const isPracticeModeRef = useRef<boolean>(isPracticeMode);
  isPracticeModeRef.current = isPracticeMode;

  const [enteredRetentionNotice, setEnteredRetentionNotice] = useState<boolean>(
    !initialPracticeMode && initialStreamState.current.enteredRetentionStream
  );

  const [queue, setQueue] = useState<TrainingQuestion[]>(() => initialStreamState.current.queue);

  // On-demand Flag Study Reference: starts closed so continuous stream begins immediately
  const [isStudyingFlags, setIsStudyingFlags] = useState<boolean>(false);
  const [flagStudyCohort, setFlagStudyCohort] = useState<Country[]>(() => initialFlagCohortRef.current);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCurrentCorrect, setIsCurrentCorrect] = useState<boolean | undefined>(undefined);
  const [feedbackState, setFeedbackState] = useState<'correct' | 'incorrect' | 'neutral' | null>(null);
  const [selectedMapCountry, setSelectedMapCountry] = useState<Country | null>(null);

  // Continuous run analytics & optional recap state
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [graduatedCount, setGraduatedCount] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [isCompleted, setIsCompleted] = useState(false);
  const [finalDurationMs, setFinalDurationMs] = useState<number>(0);
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswerRecord[]>([]);

  const currentQuestion = queue[currentIndex];
  const currentQuestionRef = useRef<TrainingQuestion | undefined>(currentQuestion);
  currentQuestionRef.current = currentQuestion;

  const isSubmittedRef = useRef(isSubmitted);
  isSubmittedRef.current = isSubmitted;

  const srsItemsMapRef = useRef(srsItemsMap);
  srsItemsMapRef.current = srsItemsMap;

  const questionStartTimeRef = useRef(questionStartTime);
  questionStartTimeRef.current = questionStartTime;

  const attrKey = attributeFilter.join(',');
  const prevConfigRef = useRef({
    continentFilter,
    attrKey,
    initialPracticeMode,
    targetCountryId
  });

  // Re-initialize stream only when filter props actually change after mount
  useEffect(() => {
    const prev = prevConfigRef.current;
    if (
      prev.continentFilter === continentFilter &&
      prev.attrKey === attrKey &&
      prev.initialPracticeMode === initialPracticeMode &&
      prev.targetCountryId === targetCountryId
    ) {
      return;
    }
    prevConfigRef.current = {
      continentFilter,
      attrKey,
      initialPracticeMode,
      targetCountryId
    };

    const items = StorageService.loadSRSItems();
    setSrsItemsMap(items);
    const nextCohort =
      attributeFilter.includes('flag') && continentFilter !== 'Oceans'
        ? buildFlagStudyCohort(items, continentFilter, [], 50, targetCountryId)
        : [];
    const nextCohortIds = new Set(nextCohort.map((c) => c.id));
    flagStudyCohortIdsRef.current = nextCohortIds;
    setFlagStudyCohort(nextCohort);

    const nextStream = createInitialStreamQueue(
      items,
      continentFilter,
      attributeFilter,
      initialPracticeMode,
      targetCountryId,
      nextCohortIds
    );
    const nextPractice = initialPracticeMode || nextStream.enteredRetentionStream;
    setIsPracticeMode(nextPractice);
    isPracticeModeRef.current = nextPractice;
    setEnteredRetentionNotice(!initialPracticeMode && nextStream.enteredRetentionStream);

    setQueue(nextStream.queue);
    setIsStudyingFlags(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setIsCompleted(false);
    setIsSubmitted(false);
    isSubmittedRef.current = false;
    setUserAnswer('');
    setIsCurrentCorrect(undefined);
    setFeedbackState(null);
    setSelectedMapCountry(null);
    setCorrectCount(0);
    setGraduatedCount(0);
    setStreak(0);
    setSessionAnswers([]);
    setSessionStartTime(Date.now());
    setFinalDurationMs(0);
    setQuestionStartTime(Date.now());
    questionStartTimeRef.current = Date.now();
  }, [continentFilter, attrKey, attributeFilter, initialPracticeMode, targetCountryId]);

  // If queue started empty while async disk/cloud storage was still rehydrating, auto-populate on storage update
  useEffect(() => {
    if (queue.length > 0 || isCompleted) return;
    return StorageService.subscribe(() => {
      const items = StorageService.loadSRSItems();
      setSrsItemsMap(items);
      let cohortIds = flagStudyCohortIdsRef.current;
      if (attributeFilter.includes('flag') && continentFilter !== 'Oceans' && cohortIds.size === 0) {
        const nextCohort = buildFlagStudyCohort(items, continentFilter, [], 50, targetCountryId);
        cohortIds = new Set(nextCohort.map((c) => c.id));
        flagStudyCohortIdsRef.current = cohortIds;
        setFlagStudyCohort(nextCohort);
      }
      const refreshed = createInitialStreamQueue(
        items,
        continentFilter,
        attributeFilter,
        isPracticeModeRef.current,
        targetCountryId,
        cohortIds
      );
      if (refreshed.queue.length > 0) {
        setQueue(refreshed.queue);
        setCurrentIndex(0);
        currentIndexRef.current = 0;
        setQuestionStartTime(Date.now());
        questionStartTimeRef.current = Date.now();
      }
    });
  }, [queue.length, isCompleted, continentFilter, attributeFilter, targetCountryId]);

  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup speech synthesis on component unmount
  useEffect(() => {
    return () => {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }
      speechEngine.cancel();
    };
  }, []);

  // Process Answer submission (immune to closure staleness)
  const handleAnswer = useCallback((answer: string, selectedCountryId?: string) => {
    const question = currentQuestionRef.current;
    if (isSubmittedRef.current || !question) return;

    const timeSpentMs = Date.now() - questionStartTimeRef.current;
    const attrDef = ATTRIBUTE_REGISTRY.get(question.attributeId);
    let correct = false;
    let feedback = '';

    if (answer === '__DONT_KNOW__') {
      correct = false;
      feedback = question.expectedInputMode === 'map_click'
        ? `Target was ${question.country.name}`
        : `Answer: ${question.correctAnswer}`;
    } else if (question.expectedInputMode === 'map_click') {
      const targetId = question.country.id?.trim().toUpperCase();
      const clickedId = selectedCountryId?.trim().toUpperCase();
      const targetName = question.country.name?.trim().toLowerCase();
      const clickedName = answer?.trim().toLowerCase();

      correct = Boolean(
        (clickedId && targetId && clickedId === targetId) ||
        (clickedName && targetName && clickedName === targetName)
      );
      feedback = correct ? 'Correct location!' : `Target was ${question.country.name}`;
    } else if (question.expectedInputMode === 'multiple_choice') {
      correct = answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    } else {
      // Typing active recall
      const settings = StorageService.loadSettings();
      if (question.questionDirection === 'capital_to_country') {
        const valRes = validateCountryNameAnswer(
          answer,
          question.correctAnswer,
          question.country,
          settings.typingFuzzyTolerance
        );
        correct = valRes.isCorrect;
        feedback = valRes.feedback || (correct ? 'Correct!' : `Answer: ${question.correctAnswer}`);
      } else if (attrDef) {
        const valRes = attrDef.validateAnswer(answer, question.correctAnswer, question.country, settings.typingFuzzyTolerance);
        correct = valRes.isCorrect;
        feedback = valRes.feedback || (correct ? 'Correct!' : `Answer: ${question.correctAnswer}`);
      } else {
        correct = answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      }
    }

    setIsSubmitted(true);
    isSubmittedRef.current = true;
    setUserAnswer(answer);
    setIsCurrentCorrect(correct);
    setFeedbackState(correct ? 'correct' : 'incorrect');

    let promotedToLearning = false;
    let promotedToMastered = false;
    let effectiveUpdatedItem: SRSItem =
      srsItemsMapRef.current.get(question.srsItemId) ||
      createInitialSRSItem(question.country.id, question.attributeId);

    // If a card was queued as a fallback retry earlier, check if its real wall-clock nextDueAt timer has now matured
    const existingForCheck = srsItemsMapRef.current.get(question.srsItemId);
    const isNowGenuinelyDue =
      !existingForCheck || existingForCheck.nextDueAt <= new Date().toISOString();
    const isEffectiveRetry = Boolean(question.isRetry) && !isNowGenuinelyDue;

    // Update SRS Record (Only in standard spaced repetition mode, NOT in free practice mode or in-session retries!)
    if (!isPracticeModeRef.current && !isEffectiveRetry) {
      let existingItem = existingForCheck;
      if (!existingItem) {
        existingItem = {
          id: question.srsItemId,
          countryId: question.country.id,
          attributeId: question.attributeId,
          stage: question.stage,
          step: 0,
          easeFactor: 2.5,
          intervalDays: 0,
          reps: 0,
          lapses: 0,
          lastReviewedAt: null,
          nextDueAt: new Date().toISOString(),
          history: []
        };
      }

      const res = processAnswer(
        existingItem,
        correct,
        question.expectedInputMode,
        answer,
        timeSpentMs,
        selectedCountryId
      );
      effectiveUpdatedItem = res.updatedItem;
      promotedToLearning = res.promotedToLearning;
      promotedToMastered = res.promotedToMastered;

      // Save back to storage
      const newMap = new Map(srsItemsMapRef.current);
      newMap.set(effectiveUpdatedItem.id, effectiveUpdatedItem);
      srsItemsMapRef.current = newMap;
      setSrsItemsMap(newMap);
      StorageService.saveSRSItems(newMap);

      if (correct) {
        if (promotedToMastered) {
          setGraduatedCount((g) => g + 1);
          soundFx.playLevelUp();
          confetti({
            particleCount: 80,
            spread: 75,
            origin: { y: 0.7 }
          });
        } else if (promotedToLearning) {
          setGraduatedCount((g) => g + 1);
          soundFx.playLevelUp();
          confetti({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.8 }
          });
        }
      }
    } else if (isPracticeModeRef.current) {
      // In Free Practice Mode: celebrate great streaks without altering SRS scheduling
      if (correct && (streak + 1) > 0 && (streak + 1) % 5 === 0) {
        confetti({
          particleCount: 35,
          spread: 50,
          origin: { y: 0.8 }
        });
      }
    }

    // Only record review count and streak for real scheduled reviews (not practice or in-session retries)
    if (!isPracticeModeRef.current && !isEffectiveRetry) {
      StorageService.recordReviewEvent(correct);
    }

    // Record answer attempt in continuous run history
    const answerRecord: SessionAnswerRecord = {
      question,
      userAnswer: answer,
      isCorrect: correct,
      timeSpentMs,
      feedback,
      promotedToLearning,
      promotedToMastered
    };
    setSessionAnswers((prev) => [...prev, answerRecord]);

    if (correct) {
      soundFx.playSuccess();
      setStreak((s) => s + 1);
      setCorrectCount((c) => c + 1);
    } else {
      soundFx.playError();
      setStreak(0);
    }

    // Continuous Stream Expanding Spacing & Rolling Horizon Replenisher:
    // 1. Inject expanding retrieval follow-ups (L0 -> L1 at +8, L1 -> L2 at +15, or missed recovery at +4 & +11)
    // 2. If the upcoming buffer drops below STREAM_LOW_WATERMARK, replenish seamlessly
    setQueue((prevQueue) => {
      const idx = currentIndexRef.current;
      let nextQueue = scheduleInStreamFollowUp(
        prevQueue,
        idx,
        question,
        effectiveUpdatedItem,
        correct,
        Boolean(question.isRetry)
      );

      const remainingAhead = nextQueue.length - (idx + 1);
      if (remainingAhead < STREAM_LOW_WATERMARK) {
        const replenished = replenishStreamQueue(
          nextQueue,
          idx,
          srsItemsMapRef.current,
          continentFilter,
          attributeFilter,
          STREAM_REPLENISH_CHUNK,
          isPracticeModeRef.current,
          flagStudyCohortIdsRef.current
        );
        nextQueue = replenished.queue;
        if (replenished.enteredRetentionStream && !isPracticeModeRef.current) {
          setEnteredRetentionNotice(true);
        }
      }
      return nextQueue;
    });

    // Vocal reading of the capital city when asking for capital, location, country, or flag
    const shouldSpeakCapital =
      question.attributeId === 'capital' ||
      question.attributeId === 'location' ||
      question.attributeId === 'country' ||
      question.attributeId === 'flag';
    const isCountry = Boolean(question.country && !question.country.id?.startsWith('WATER_'));
    const capitalToSpeak = isCountry ? question.country.capital : null;

    if (shouldSpeakCapital && capitalToSpeak) {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
      }
      speechTimerRef.current = setTimeout(() => {
        speechEngine.speak(capitalToSpeak);
        speechTimerRef.current = null;
      }, 200);
    }
  }, [streak, continentFilter, attributeFilter]);

  // Next Question in the Continuous Stream (Never hits a 15-card wall)
  const handleNext = useCallback(() => {
    if (!isSubmittedRef.current) {
      return;
    }

    isSubmittedRef.current = false;

    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();

    setQueue((prevQueue) => {
      const idx = currentIndexRef.current;
      if (prevQueue.length - (idx + 1) < STREAM_LOW_WATERMARK) {
        const replenished = replenishStreamQueue(
          prevQueue,
          idx,
          srsItemsMapRef.current,
          continentFilter,
          attributeFilter,
          STREAM_REPLENISH_CHUNK,
          isPracticeModeRef.current,
          flagStudyCohortIdsRef.current
        );
        if (replenished.enteredRetentionStream && !isPracticeModeRef.current) {
          setEnteredRetentionNotice(true);
        }
        return replenished.queue;
      }
      return prevQueue;
    });

    setCurrentIndex((i) => {
      const nextIdx = i + 1;
      currentIndexRef.current = nextIdx;
      return nextIdx;
    });
    setIsSubmitted(false);
    setUserAnswer('');
    setIsCurrentCorrect(undefined);
    setFeedbackState(null);
    setSelectedMapCountry(null);
    setQuestionStartTime(Date.now());
    questionStartTimeRef.current = Date.now();
  }, [continentFilter, attributeFilter]);

  // Give up / reveal answer handler
  const handleGiveUp = useCallback(() => {
    if (isSubmittedRef.current) return;
    handleAnswer('__DONT_KNOW__');
  }, [handleAnswer]);

  // Open on-demand Run Recap modal/screen
  const handleOpenRecap = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();
    setFinalDurationMs(Date.now() - sessionStartTime);
    setIsCompleted(true);
    soundFx.playClick();
  }, [sessionStartTime]);

  // Resume stream from Run Recap without losing place
  const handleResumeStream = useCallback(() => {
    setIsCompleted(false);
    setQuestionStartTime(Date.now());
    questionStartTimeRef.current = Date.now();
    soundFx.playClick();
  }, []);

  // Open on-demand Flag Study Reference (preserves the current continuous session's 50-flag cohort)
  const handleOpenFlagStudy = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();
    if (flagStudyCohort.length === 0 && attributeFilter.includes('flag') && continentFilter !== 'Oceans') {
      const nextCohort = buildFlagStudyCohort(
        srsItemsMapRef.current,
        continentFilter,
        [],
        50,
        targetCountryId
      );
      flagStudyCohortIdsRef.current = new Set(nextCohort.map((c) => c.id));
      setFlagStudyCohort(nextCohort);
    }
    setIsStudyingFlags(true);
    soundFx.playClick();
  }, [flagStudyCohort.length, attributeFilter, continentFilter, targetCountryId]);

  // Explicitly resample a brand-new 50-flag cohort and refresh upcoming flag questions in the stream
  const handleResampleFlagCohort = useCallback(() => {
    const items = StorageService.loadSRSItems();
    setSrsItemsMap(items);
    srsItemsMapRef.current = items;

    const freshCohort = buildFlagStudyCohort(items, continentFilter, [], 50, targetCountryId);
    const freshCohortIds = new Set(freshCohort.map((c) => c.id));
    flagStudyCohortIdsRef.current = freshCohortIds;
    setFlagStudyCohort(freshCohort);

    setQueue((prevQueue) => {
      const idx = currentIndexRef.current;
      const prefix = prevQueue.slice(0, idx);
      // Keep non-flag questions in upcoming tail or rebuild from currentIndex using the new 50-flag cohort
      const nonFlagTail = prevQueue
        .slice(idx)
        .filter((q) => q.attributeId !== 'flag' || freshCohortIds.has(q.country.id));
      const replenished = replenishStreamQueue(
        [...prefix, ...nonFlagTail],
        idx - 1,
        items,
        continentFilter,
        attributeFilter,
        STREAM_INITIAL_CHUNK,
        isPracticeModeRef.current,
        freshCohortIds
      );
      return replenished.queue;
    });
  }, [continentFilter, attributeFilter, targetCountryId]);

  // Map Click Handler during training
  const handleMapCountrySelect = useCallback((country: Country) => {
    setSelectedMapCountry(country);
    if (!isSubmittedRef.current && currentQuestionRef.current && currentQuestionRef.current.expectedInputMode === 'map_click') {
      handleAnswer(country.name, country.id);
    }
  }, [handleAnswer]);

  // Handler to restart stream with a fresh 50-flag cohort, fresh queue, and reset sitting stats
  const handleRestart = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();

    const items = StorageService.loadSRSItems();
    setSrsItemsMap(items);
    srsItemsMapRef.current = items;

    const nextCohort =
      attributeFilter.includes('flag') && continentFilter !== 'Oceans'
        ? buildFlagStudyCohort(items, continentFilter, [], 50, targetCountryId)
        : [];
    const nextCohortIds = new Set(nextCohort.map((c) => c.id));
    flagStudyCohortIdsRef.current = nextCohortIds;
    setFlagStudyCohort(nextCohort);

    const freshStream = replenishStreamQueue(
      [],
      -1,
      items,
      continentFilter,
      attributeFilter,
      STREAM_INITIAL_CHUNK,
      isPracticeMode,
      nextCohortIds
    );
    setQueue(freshStream.queue);
    setIsStudyingFlags(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setIsCompleted(false);
    setIsSubmitted(false);
    isSubmittedRef.current = false;
    setCorrectCount(0);
    setGraduatedCount(0);
    setStreak(0);
    setSessionAnswers([]);
    setSessionStartTime(Date.now());
    setFinalDurationMs(0);
    setQuestionStartTime(Date.now());
    questionStartTimeRef.current = Date.now();
    soundFx.playClick();
  }, [continentFilter, attributeFilter, isPracticeMode, targetCountryId]);

  // Handler to focus-drill missed questions and then seamlessly continue the infinite stream
  const handleRetryMissed = useCallback((missedQuestions: TrainingQuestion[]) => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();

    const items = StorageService.loadSRSItems();
    setSrsItemsMap(items);
    srsItemsMapRef.current = items;

    const uniqueMap = new Map<string, TrainingQuestion>();
    missedQuestions.forEach((q) => {
      if (!uniqueMap.has(q.srsItemId)) {
        const srsItem = items.get(q.srsItemId) || createInitialSRSItem(q.country.id, q.attributeId);
        const freshQ = buildQuestion(srsItem, q.country, COUNTRIES, q.questionDirection);
        freshQ.isRetry = false;
        uniqueMap.set(q.srsItemId, freshQ);
      }
    });
    const retryPrefix = Array.from(uniqueMap.values());
    const replenished = replenishStreamQueue(
      retryPrefix,
      -1,
      items,
      continentFilter,
      attributeFilter,
      STREAM_REPLENISH_CHUNK,
      isPracticeModeRef.current,
      flagStudyCohortIdsRef.current
    );

    setQueue(replenished.queue);
    setIsStudyingFlags(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setIsCompleted(false);
    setIsSubmitted(false);
    isSubmittedRef.current = false;
    setUserAnswer('');
    setIsCurrentCorrect(undefined);
    setFeedbackState(null);
    setSelectedMapCountry(null);
    setQuestionStartTime(Date.now());
    questionStartTimeRef.current = Date.now();
    soundFx.playClick();
  }, [continentFilter, attributeFilter]);

  // Handler to start Practice Drill when no reviews are due
  const handleStartPracticeDrill = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();

    const items = StorageService.loadSRSItems();
    const practiceStream = replenishStreamQueue(
      [],
      -1,
      items,
      continentFilter,
      attributeFilter,
      STREAM_INITIAL_CHUNK,
      true,
      flagStudyCohortIdsRef.current
    );
    setQueue(practiceStream.queue);
    setIsStudyingFlags(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setIsPracticeMode(true);
    isPracticeModeRef.current = true;
    setIsCompleted(false);
    setIsSubmitted(false);
    isSubmittedRef.current = false;
    setCorrectCount(0);
    setGraduatedCount(0);
    setStreak(0);
    setSessionAnswers([]);
    setSessionStartTime(Date.now());
    setFinalDurationMs(0);
    setQuestionStartTime(Date.now());
    questionStartTimeRef.current = Date.now();
    soundFx.playClick();
  }, [continentFilter, attributeFilter]);

  if (!currentQuestion && !isCompleted) {
    return (
      <AmbientBackground
        className="flex-1"
        contentClassName="flex items-center justify-center p-6 text-center overflow-y-auto"
      >
        <div className="bg-slate-900/95 border border-slate-700/80 p-8 sm:p-10 rounded-3xl max-w-lg w-full shadow-2xl backdrop-blur-xl flex flex-col items-center gap-6 glass-card">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              Region Horizon Cleared!
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              No cards are currently due for <span className="text-emerald-400 font-bold">{continentFilter}</span>.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Launch the <strong>Continuous Practice Stream</strong> to keep training indefinitely without altering your spaced repetition intervals.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2">
            <button
              onClick={handleStartPracticeDrill}
              className="w-full sm:flex-1 py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Start Continuous Stream</span>
            </button>

            <button
              onClick={onFinishSession}
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </AmbientBackground>
    );
  }

  // On-Demand Flag Study Reference Drawer / Screen
  if (isStudyingFlags && flagStudyCohort.length > 0 && !isCompleted && currentQuestion) {
    const upcomingFlagIds = new Set(
      queue.slice(currentIndex, currentIndex + 25).filter((q) => q.attributeId === 'flag').map((q) => q.country.id)
    );
    const isOnlyFlagAttribute = attributeFilter.length === 1 && attributeFilter[0] === 'flag';

    return (
      <FlagStudyRecap
        continentFilter={continentFilter}
        cohortCountries={flagStudyCohort}
        sessionFlagCountryIds={upcomingFlagIds}
        srsItemsMap={srsItemsMap}
        sessionQueueLength={flagStudyCohort.length}
        isOnlyFlagAttribute={isOnlyFlagAttribute}
        onResampleCohort={handleResampleFlagCohort}
        onStartRollThroughAll={(selectedCountries) => {
          const items = StorageService.loadSRSItems();
          const rollQuestions = buildFlagCohortQuestions(items, selectedCountries);
          // Splice studied flag questions right at currentIndex and replenish tail behind them
          setQueue((prevQueue) => {
            const prefix = prevQueue.slice(0, currentIndex);
            const studiedIds = new Set(rollQuestions.map((q) => q.srsItemId));
            const remainingTail = prevQueue.slice(currentIndex).filter((q) => !studiedIds.has(q.srsItemId));
            return [...prefix, ...rollQuestions, ...remainingTail];
          });
          setIsStudyingFlags(false);
          setIsSubmitted(false);
          isSubmittedRef.current = false;
          setUserAnswer('');
          setIsCurrentCorrect(undefined);
          setFeedbackState(null);
          setSelectedMapCountry(null);
          const now = Date.now();
          setQuestionStartTime(now);
          questionStartTimeRef.current = now;
        }}
        onStartStandardQueue={() => {
          setIsStudyingFlags(false);
          const now = Date.now();
          setQuestionStartTime(now);
          questionStartTimeRef.current = now;
        }}
        onExit={onFinishSession}
      />
    );
  }

  // Optional Training Run Recap Screen
  if (isCompleted) {
    return (
      <AmbientBackground
        className="flex-1"
        contentClassName="flex items-center justify-center p-4 sm:p-8 overflow-y-auto"
      >
        <SessionCompletedView
          continent={continentFilter}
          isPracticeMode={isPracticeMode}
          results={
            sessionAnswers.length > 0
              ? sessionAnswers
              : queue.slice(0, Math.max(1, currentIndex)).map((q) => ({
                  question: q,
                  userAnswer: '',
                  isCorrect: true,
                  timeSpentMs: 2000
                }))
          }
          sessionDurationMs={finalDurationMs || Math.max(1000, Date.now() - sessionStartTime)}
          onRestart={handleRestart}
          onResumeStream={handleResumeStream}
          onRetryMissed={handleRetryMissed}
          onDashboard={onFinishSession}
        />
      </AmbientBackground>
    );
  }

  const reviewedCount = sessionAnswers.length;
  const liveAccuracy = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 100;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0f172a]">
      {/* Continuous Stream Top Telemetry Bar */}
      <div className="h-12 sm:h-14 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 z-30 shrink-0">
        {/* Left Cluster: Direct Exit + Optional Recap + Region Scope */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onFinishSession}
            className="text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer shrink-0"
            title="Exit directly to Dashboard"
          >
            ← Exit
          </button>

          {reviewedCount > 0 && (
            <button
              type="button"
              onClick={handleOpenRecap}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/60 transition-colors cursor-pointer shrink-0"
              title="Open Training Run Recap"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Recap</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-200">
                {reviewedCount}
              </span>
            </button>
          )}

          <span className="text-xs text-slate-400 font-medium hidden md:inline truncate">
            Scope: <span className="text-slate-200 font-semibold">{continentFilter === 'All' ? 'World' : continentFilter}</span>
          </span>

          {enteredRetentionNotice && !isPracticeMode && (
            <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-300">
              <Sparkles className="w-3 h-3" />
              <span>Horizon Cleared · Continuous Retention</span>
            </span>
          )}
        </div>

        {/* Center Cluster: Live Sitting Telemetry Strip (Replaces fixed 1/15 bar) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Cards Reviewed in Sitting */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-xs"
            title="Cards reviewed in this continuous sitting"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-mono font-bold text-white tabular-nums">{reviewedCount}</span>
            <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">Reviewed</span>
          </div>

          {/* Live Sitting Accuracy */}
          {reviewedCount > 0 && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-mono font-bold tabular-nums ${
                liveAccuracy >= 85
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : liveAccuracy >= 65
                  ? 'bg-sky-950/60 border-sky-700/60 text-sky-300'
                  : 'bg-amber-950/60 border-amber-700/60 text-amber-300'
              }`}
              title={`Current run accuracy: ${correctCount}/${reviewedCount} correct`}
            >
              <span>{liveAccuracy}%</span>
              <span className="text-[10px] font-sans font-semibold opacity-80 hidden md:inline">Acc</span>
            </div>
          )}

          {/* Live Promotions Counter */}
          {graduatedCount > 0 && (
            <div
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950/50 border border-amber-700/50 text-xs font-bold text-amber-300"
              title="Cards promoted to Active Recall or Mastered during this run"
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono tabular-nums">+{graduatedCount}</span>
            </div>
          )}

          {/* Active Streak Flame */}
          {streak > 1 && (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 sm:px-2.5 py-1 rounded-full animate-bounce">
              <Flame className="w-3.5 h-3.5 fill-amber-400" />
              <span className="font-mono tabular-nums">x{streak}</span>
            </div>
          )}
        </div>

        {/* Right Cluster: On-Demand Flag Study Button & Active Card Stage Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {canStudyFlags && (
            <button
              type="button"
              onClick={handleOpenFlagStudy}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-slate-950 bg-amber-500/15 hover:bg-amber-400 border border-amber-400/40 px-2.5 py-1 rounded-full transition-all cursor-pointer"
              title="Open this session's 50-Flag Study Cohort"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Study Flags</span>
              {flagStudyCohort.length > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-200">
                  {flagStudyCohort.length}
                </span>
              )}
            </button>
          )}

          {(() => {
            const item = srsItemsMap.get(currentQuestion.srsItemId);
            const isStillOnCooldown =
              Boolean(currentQuestion.isRetry) &&
              Boolean(item && item.nextDueAt > new Date().toISOString());
            if (isPracticeMode || isStillOnCooldown) {
              return (
                <span
                  className="text-[10px] font-bold tracking-wider px-2 sm:px-3 py-1 rounded-full border bg-violet-950/60 border-violet-700/60 text-violet-300 flex items-center gap-1 shadow-sm"
                  title="Reinforcement or practice card — does not alter your spaced repetition intervals"
                >
                  <Zap className="w-3 h-3 fill-violet-400 text-violet-400" />
                  <span className="hidden xs:inline">
                    {isStillOnCooldown && !isPracticeMode ? 'REINFORCEMENT' : 'PRACTICE'}
                  </span>
                  <span className="text-[9px] text-violet-300/80 font-normal hidden sm:inline">(SRS Paused)</span>
                </span>
              );
            }
            const liveStage = item ? item.stage : currentQuestion.stage;
            if (liveStage === 0) {
              return (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-1 rounded-full border bg-amber-950/50 border-amber-700/50 text-amber-300">
                  <span className="sm:hidden">L0</span>
                  <span className="hidden sm:inline">
                    {currentQuestion.expectedInputMode === 'map_click'
                      ? 'L0 Recognition (Map)'
                      : currentQuestion.expectedInputMode === 'typing'
                      ? 'L0 Initial Recall (Type)'
                      : 'L0 Recognition (MCQ)'}
                  </span>
                </span>
              );
            }
            if (liveStage === 2) {
              return (
                <span className="text-[10px] font-bold tracking-wider px-2 sm:px-2.5 py-1 rounded-full border bg-emerald-950/50 border-emerald-700/50 text-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span className="hidden sm:inline">MASTERED</span>
                  <span className="sm:hidden">L2</span>
                </span>
              );
            }
            const cardStability = inferStability(item);
            return (
              <span className="text-[10px] font-bold tracking-wider px-2 sm:px-2.5 py-1 rounded-full border bg-sky-950/50 border-sky-700/50 text-sky-300 flex items-center gap-1">
                <span className="hidden sm:inline">L1 Active Recall</span>
                <span className="sm:hidden">L1</span>
                <span className="text-emerald-400 font-mono">
                  (S:{cardStability.toFixed(1)}d<span className="hidden sm:inline"> / 6d Master</span>)
                </span>
              </span>
            );
          })()}
        </div>
      </div>

      {/* Main Workspace (Map + Floating Prompt Overlay) */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Interactive Map */}
        <MapContainer
          mapMode={mapMode}
          onToggleMapMode={onToggleMapMode}
          targetCountryId={
            isSubmitted || currentQuestion.attributeId === 'country' ? currentQuestion.country.id : null
          }
          selectedCountryId={selectedMapCountry?.id || null}
          feedbackState={feedbackState}
          disableAutoZoom={!(isSubmitted || currentQuestion.attributeId === 'country')}
          hideHoverTooltip={!isSubmitted}
          srsItemsMap={srsItemsMap}
          onSelectCountry={handleMapCountrySelect}
        />

        {/* Floating Question UI Panel */}
        <div className="absolute bottom-3 sm:bottom-6 inset-x-3 sm:inset-x-4 z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl">
            {currentQuestion.expectedInputMode === 'multiple_choice' ? (
              <MultipleChoicePrompt
                key={`${currentQuestion.srsItemId}-${currentIndex}`}
                country={currentQuestion.country}
                promptText={currentQuestion.prompt}
                options={currentQuestion.options || []}
                selectedOption={userAnswer}
                correctAnswer={currentQuestion.correctAnswer}
                isSubmitted={isSubmitted}
                questionDirection={currentQuestion.questionDirection}
                onSelectOption={(opt) => {
                  handleAnswer(opt);
                }}
                onGiveUp={handleGiveUp}
                onNextQuestion={handleNext}
              />
            ) : currentQuestion.expectedInputMode === 'typing' ? (
              <TypingRecallPrompt
                key={`${currentQuestion.srsItemId}-${currentIndex}`}
                country={currentQuestion.country}
                attributeId={currentQuestion.attributeId}
                questionDirection={currentQuestion.questionDirection}
                promptText={currentQuestion.prompt}
                correctAnswer={currentQuestion.correctAnswer}
                isSubmitted={isSubmitted}
                userAnswer={userAnswer}
                isCorrect={isCurrentCorrect}
                onSubmitAnswer={(val) => handleAnswer(val)}
                onNextQuestion={handleNext}
                onGiveUp={handleGiveUp}
              />
            ) : (
              <MapClickPrompt
                key={`${currentQuestion.srsItemId}-${currentIndex}`}
                country={currentQuestion.country}
                isSubmitted={isSubmitted}
                selectedCountryName={selectedMapCountry?.name}
                isCorrect={isCurrentCorrect}
                onNextQuestion={handleNext}
                onSkip={handleGiveUp}
                onGiveUp={handleGiveUp}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
