import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Country, Continent, TrainingCategory, SRSItem, MapViewMode } from '../../core/types';
import { COUNTRIES, COUNTRIES_BY_ID } from '../../assets/data/countries';
import {
  TrainingQuestion,
  prepareSessionQueue,
  processAnswer,
  buildQuestion,
  createInitialSRSItem,
  waterBodyToCountry
} from '../../core/srsEngine';
import { getWaterBodyById } from '../../assets/data/waterBodies';
import { ATTRIBUTE_REGISTRY } from '../../core/attributes';
import { StorageService } from '../../core/storage';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';
import { MapContainer } from '../map/MapContainer';
import { MultipleChoicePrompt } from './MultipleChoicePrompt';
import { TypingRecallPrompt } from './TypingRecallPrompt';
import { MapClickPrompt } from './MapClickPrompt';
import { Flame, Sparkles, Zap } from 'lucide-react';
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

function createInitialSessionQueue(
  items: Map<string, SRSItem>,
  continentFilter: TrainingCategory,
  attributeFilter: string[],
  isPracticeMode: boolean,
  targetCountryId?: string | null
): TrainingQuestion[] {
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
        return targetedQueue;
      }
    }
  }
  return prepareSessionQueue(items, continentFilter, attributeFilter, 15, isPracticeMode);
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
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(initialPracticeMode);
  const isPracticeModeRef = useRef<boolean>(isPracticeMode);
  isPracticeModeRef.current = isPracticeMode;

  // Persistent SRS map loaded synchronously
  const [srsItemsMap, setSrsItemsMap] = useState<Map<string, SRSItem>>(() => StorageService.loadSRSItems());

  // Synchronously build initial session queue so the first render never flashes "All Caught Up!"
  const [queue, setQueue] = useState<TrainingQuestion[]>(() =>
    createInitialSessionQueue(srsItemsMap, continentFilter, attributeFilter, initialPracticeMode, targetCountryId)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCurrentCorrect, setIsCurrentCorrect] = useState<boolean | undefined>(undefined);
  const [feedbackState, setFeedbackState] = useState<'correct' | 'incorrect' | 'neutral' | null>(null);
  const [selectedMapCountry, setSelectedMapCountry] = useState<Country | null>(null);

  // Session analytics
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

  // Re-initialize session queue only when session filter props actually change after mount
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
    setIsPracticeMode(initialPracticeMode);
    isPracticeModeRef.current = initialPracticeMode;
    const newQueue = createInitialSessionQueue(
      items,
      continentFilter,
      attributeFilter,
      initialPracticeMode,
      targetCountryId
    );

    setQueue(newQueue);
    setCurrentIndex(0);
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
      const refreshedQueue = createInitialSessionQueue(
        items,
        continentFilter,
        attributeFilter,
        isPracticeModeRef.current,
        targetCountryId
      );
      if (refreshedQueue.length > 0) {
        setQueue(refreshedQueue);
        setCurrentIndex(0);
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

  // Process Answer submission (immune to any closure staleness)
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
      if (attrDef) {
        const settings = StorageService.loadSettings();
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

    // Update SRS Record (Only in standard spaced repetition mode, NOT in free practice mode or in-session retries!)
    if (!isPracticeModeRef.current && !question.isRetry) {
      let existingItem = srsItemsMapRef.current.get(question.srsItemId);
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
        timeSpentMs
      );
      const updatedItem = res.updatedItem;
      promotedToLearning = res.promotedToLearning;
      promotedToMastered = res.promotedToMastered;

      // Save back to storage
      const newMap = new Map(srsItemsMapRef.current);
      newMap.set(updatedItem.id, updatedItem);
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
    if (!isPracticeModeRef.current && !question.isRetry) {
      StorageService.recordReviewEvent(correct);
    }

    // Record answer attempt in session history
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
      // Re-queue missed question at end of session for reinforcement (capped at 2 retries per card)
      setQueue((prevQueue) => {
        const retryCount = prevQueue.filter((q) => q.srsItemId === question.srsItemId && q.isRetry).length;
        if (retryCount < 2) {
          const liveItem = srsItemsMap.get(question.srsItemId) || {
            ...createInitialSRSItem(question.country.id, question.attributeId),
            stage: 1,
            consecutiveRecallCorrect: 0
          };
          const freshRetry = buildQuestion(liveItem, question.country, COUNTRIES);
          return [...prevQueue, { ...freshRetry, isRetry: true }];
        }
        return prevQueue;
      });
    }

    // Vocal reading of the capital city when asking for capital or location on the map
    const isCapitalOrLocation =
      question.attributeId === 'capital' || question.attributeId === 'location';
    const isCountry = Boolean(question.country && !question.country.id?.startsWith('WATER_'));
    const capitalToSpeak = isCountry ? question.country.capital : null;

    if (isCapitalOrLocation && capitalToSpeak) {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
      }
      speechTimerRef.current = setTimeout(() => {
        speechEngine.speak(capitalToSpeak);
        speechTimerRef.current = null;
      }, 200);
    }
  }, [streak]);

  // Next Question
  const handleNext = useCallback(() => {
    // Guard: Never advance to next question if current question is unsubmitted
    if (!isSubmittedRef.current) {
      return;
    }

    // Synchronously disarm submitted flag to prevent any subsequent events,
    // double clicks, or key repeat from advancing past the next question.
    isSubmittedRef.current = false;

    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
      setIsSubmitted(false);
      setUserAnswer('');
      setIsCurrentCorrect(undefined);
      setFeedbackState(null);
      setSelectedMapCountry(null);
      setQuestionStartTime(Date.now());
      questionStartTimeRef.current = Date.now();
    } else {
      setIsCompleted(true);
      setFinalDurationMs(Date.now() - sessionStartTime);
      soundFx.playLevelUp();
    }
  }, [currentIndex, queue.length, sessionStartTime]);

  // Give up / reveal answer handler
  const handleGiveUp = useCallback(() => {
    if (isSubmittedRef.current) return;
    handleAnswer('__DONT_KNOW__');
  }, [handleAnswer]);

  // Map Click Handler during training
  const handleMapCountrySelect = useCallback((country: Country) => {
    setSelectedMapCountry(country);
    if (!isSubmittedRef.current && currentQuestionRef.current && currentQuestionRef.current.expectedInputMode === 'map_click') {
      handleAnswer(country.name, country.id);
    }
  }, [handleAnswer]);

  // Handler to restart session with fresh queue
  const handleRestart = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();

    const items = StorageService.loadSRSItems();
    const newQueue = prepareSessionQueue(items, continentFilter, attributeFilter, 15, isPracticeMode);
    setQueue(newQueue);
    setCurrentIndex(0);
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
  }, [continentFilter, attributeFilter, isPracticeMode]);

  // Handler to retry only the missed questions from this session
  const handleRetryMissed = useCallback((missedQuestions: TrainingQuestion[]) => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();

    // Reload latest persistent items to guarantee accurate stage & recall streak
    const items = StorageService.loadSRSItems();

    // Deduplicate by srsItemId and rebuild each question fresh with isRetry: false
    const uniqueMap = new Map<string, TrainingQuestion>();
    missedQuestions.forEach((q) => {
      if (!uniqueMap.has(q.srsItemId)) {
        const srsItem = items.get(q.srsItemId) || createInitialSRSItem(q.country.id, q.attributeId);
        const freshQ = buildQuestion(srsItem, q.country, COUNTRIES);
        freshQ.isRetry = false;
        uniqueMap.set(q.srsItemId, freshQ);
      }
    });
    const retryQueue = Array.from(uniqueMap.values());

    setQueue(retryQueue);
    setCurrentIndex(0);
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
  }, []);

  // Handler to start Practice Drill when no reviews are due
  const handleStartPracticeDrill = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    speechEngine.cancel();

    const items = StorageService.loadSRSItems();
    const practiceQueue = prepareSessionQueue(items, continentFilter, attributeFilter, 15, true);
    setQueue(practiceQueue);
    setCurrentIndex(0);
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
              All Caught Up on Scheduled Reviews!
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              No cards are due for <span className="text-emerald-400 font-bold">{continentFilter}</span> right now based on your spaced repetition intervals.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Want to train anyway? You can jump straight into a <strong>Practice Drill</strong> to challenge your recall without altering your spaced repetition intervals.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2">
            <button
              onClick={handleStartPracticeDrill}
              className="w-full sm:flex-1 py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Start Practice Drill (15)</span>
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

  // Session Completed Screen
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
              : queue.map((q) => ({
                  question: q,
                  userAnswer: '',
                  isCorrect: true,
                  timeSpentMs: 2000
                }))
          }
          sessionDurationMs={finalDurationMs || Math.max(1000, Date.now() - sessionStartTime)}
          onRestart={handleRestart}
          onRetryMissed={handleRetryMissed}
          onDashboard={onFinishSession}
        />
      </AmbientBackground>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0f172a]">
      {/* Top Session Progress Bar */}
      <div className="h-12 sm:h-14 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onFinishSession}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          >
            ← Exit<span className="hidden sm:inline"> Session</span>
          </button>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Focus: <span className="text-slate-200 font-semibold">{continentFilter}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 sm:gap-3 max-w-xs w-full mx-2 sm:mx-4">
          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${Math.round(((currentIndex + 1) / queue.length) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-300">
            {currentIndex + 1}/{queue.length}
          </span>
        </div>

        {/* Streak & Stage badge */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {streak > 1 && (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 sm:px-2.5 py-1 rounded-full animate-bounce">
              <Flame className="w-3.5 h-3.5 fill-amber-400" />
              <span>x{streak}</span>
            </div>
          )}
          {isPracticeMode ? (
            <span className="text-[10px] font-bold tracking-wider px-2 sm:px-3 py-1 rounded-full border bg-violet-950/60 border-violet-700/60 text-violet-300 flex items-center gap-1 shadow-sm">
              <Zap className="w-3 h-3 fill-violet-400 text-violet-400" />
              <span className="hidden xs:inline">PRACTICE</span>
              <span className="text-[9px] text-violet-300/80 font-normal hidden sm:inline">(SRS Paused)</span>
            </span>
          ) : (() => {
            const item = srsItemsMap.get(currentQuestion.srsItemId);
            const liveStage = item ? item.stage : currentQuestion.stage;
            if (liveStage === 0) {
              return (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-1 rounded-full border bg-amber-950/50 border-amber-700/50 text-amber-300">
                  <span className="sm:hidden">L0</span>
                  <span className="hidden sm:inline">
                    {currentQuestion.expectedInputMode === 'map_click' ? 'L0 Recognition (Map)' : 'L0 Recognition (MCQ)'}
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
            const recallStreak = item?.consecutiveRecallCorrect || 0;
            return (
              <span className="text-[10px] font-bold tracking-wider px-2 sm:px-2.5 py-1 rounded-full border bg-sky-950/50 border-sky-700/50 text-sky-300 flex items-center gap-1">
                <span className="hidden sm:inline">L1 Active Recall</span>
                <span className="sm:hidden">L1</span>
                <span className="text-emerald-400 font-mono">({recallStreak}/2<span className="hidden sm:inline"> to Master</span>)</span>
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
          targetCountryId={isSubmitted ? currentQuestion.country.id : null}
          selectedCountryId={selectedMapCountry?.id || null}
          feedbackState={feedbackState}
          disableAutoZoom={!isSubmitted}
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
