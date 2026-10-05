import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  Home,
  CheckCircle2,
  XCircle,
  Timer,
  Flame,
  Zap,
  MapPin,
  Building2,
  Target,
  Award,
  Compass,
  Star,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Continent, TrainingCategory } from '../../core/types';
import { TrainingQuestion } from '../../core/srsEngine';
import { COUNTRIES_BY_ID } from '../../assets/data/countries';

export interface SessionAnswerRecord {
  question: TrainingQuestion;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
  feedback?: string;
  promotedToLearning?: boolean;
  promotedToMastered?: boolean;
}

interface SessionCompletedViewProps {
  continent: TrainingCategory;
  isPracticeMode: boolean;
  results: SessionAnswerRecord[];
  sessionDurationMs: number;
  onRestart: () => void;
  onRetryMissed?: (missedQuestions: TrainingQuestion[]) => void;
  onDashboard: () => void;
}

export const SessionCompletedView: React.FC<SessionCompletedViewProps> = ({
  continent,
  isPracticeMode,
  results,
  sessionDurationMs,
  onRestart,
  onRetryMissed,
  onDashboard
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'missed'>('all');

  const totalQuestions = results.length;
  const correctCount = results.filter((r) => r.isCorrect).length;
  const missedResults = results.filter((r) => !r.isCorrect);
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 100;

  const totalTimeSpentMs = results.reduce((acc, r) => acc + (r.timeSpentMs || 0), 0);
  const avgSpeedSec = totalQuestions > 0 ? (totalTimeSpentMs / totalQuestions / 1000).toFixed(1) : '0.0';

  // Calculate highest consecutive correct streak
  let currentStreak = 0;
  let maxStreak = 0;
  for (const r of results) {
    if (r.isCorrect) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  // Count promotions
  const learningPromotions = results.filter((r) => r.promotedToLearning).length;
  const masteredPromotions = results.filter((r) => r.promotedToMastered).length;
  const totalGraduated = learningPromotions + masteredPromotions;

  // Calculate session XP
  const baseScore = correctCount * 20;
  const streakBonus = maxStreak * 10;
  const speedBonus = Number(avgSpeedSec) < 3.0 ? correctCount * 5 : 0;
  const totalXp = baseScore + streakBonus + speedBonus;

  // Format session duration
  const minutes = Math.floor(sessionDurationMs / 60000);
  const seconds = Math.floor((sessionDurationMs % 60000) / 1000);
  const durationFormatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  // Celebratory confetti sequence on mount
  useEffect(() => {
    const end = Date.now() + 700;
    const colors = ['#10b981', '#38bdf8', '#fbbf24', '#a855f7', '#34d399'];

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 55,
        spread: 60,
        origin: { x: 0.05, y: 0.7 },
        colors,
        zIndex: 100
      });
      confetti({
        particleCount: 4,
        angle: 125,
        spread: 60,
        origin: { x: 0.95, y: 0.7 },
        colors,
        zIndex: 100
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    const burstTimeout = setTimeout(() => {
      confetti({
        particleCount: accuracy === 100 ? 120 : 70,
        spread: 100,
        origin: { y: 0.4 },
        colors,
        zIndex: 100
      });
    }, 280);

    return () => clearTimeout(burstTimeout);
  }, [accuracy]);

  // Filtered results for review shelf
  const displayedResults = results.filter((r) => {
    if (filterMode === 'correct') return r.isCorrect;
    if (filterMode === 'missed') return !r.isCorrect;
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto my-auto flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500 py-4">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl glass-card flex flex-col items-center text-center">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-emerald-500/10 via-sky-500/5 to-transparent pointer-events-none" />

        {/* Hero Trophy Icon with Orbital Ring */}
        <div className="relative flex items-center justify-center mb-4">
          {/* Subtle spinning orbital ring */}
          <div className="absolute w-24 h-24 rounded-full border border-dashed border-emerald-400/30 animate-[spin_25s_linear_infinite] pointer-events-none" />
          <div className="absolute w-20 h-20 rounded-full border border-sky-400/20 pointer-events-none" />

          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform ${
              accuracy >= 80
                ? 'bg-gradient-to-br from-emerald-500/25 to-teal-500/20 border border-emerald-400/50 text-emerald-400 shadow-emerald-500/20'
                : accuracy >= 60
                ? 'bg-gradient-to-br from-sky-500/25 to-indigo-500/20 border border-sky-400/50 text-sky-400 shadow-sky-500/20'
                : 'bg-gradient-to-br from-amber-500/25 to-orange-500/20 border border-amber-400/50 text-amber-400 shadow-amber-500/20'
            }`}
          >
            {accuracy === 100 ? (
              <CrownIcon className="w-8 h-8 text-amber-400 animate-bounce" />
            ) : accuracy >= 80 ? (
              <Trophy className="w-8 h-8 text-emerald-400" />
            ) : (
              <Compass className="w-8 h-8 text-sky-400" />
            )}
          </div>
        </div>

        {/* Dynamic Congratulatory Heading */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {accuracy === 100
            ? 'Cartographic Perfection!'
            : accuracy >= 80
            ? 'Masterful Recall!'
            : accuracy >= 60
            ? 'Solid Practice Session!'
            : 'Drill Completed!'}
        </h1>

        {/* Context Eyebrow / Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-xs">
          <span className="bg-slate-800/90 border border-slate-700/80 px-3 py-1 rounded-full text-slate-300 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Region: <strong className="text-white">{continent === 'Oceans' ? 'Oceans & Straits' : continent}</strong>
          </span>

          {isPracticeMode ? (
            <span className="bg-violet-950/70 border border-violet-700/70 px-3 py-1 rounded-full text-violet-300 font-semibold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 fill-violet-400 text-violet-400" />
              Practice Drill <span className="text-[10px] text-violet-300/80 font-normal">(SRS Timers Frozen)</span>
            </span>
          ) : (
            <span className="bg-sky-950/70 border border-sky-700/70 px-3 py-1 rounded-full text-sky-300 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Spaced Repetition Review
            </span>
          )}

          <span className="bg-slate-800/90 border border-slate-700/80 px-3 py-1 rounded-full text-slate-300 font-medium flex items-center gap-1">
            <Timer className="w-3.5 h-3.5 text-slate-400" />
            <span>{durationFormatted}</span>
          </span>
        </div>

        {/* 4 Performance Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full mt-6">
          {/* 1. Accuracy */}
          <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-slate-600 transition-all">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>Accuracy</span>
            </div>
            <span
              className={`text-3xl font-black ${
                accuracy >= 80 ? 'text-emerald-400' : accuracy >= 60 ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {accuracy}%
            </span>
            <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  accuracy >= 80 ? 'bg-emerald-400' : accuracy >= 60 ? 'bg-sky-400' : 'bg-amber-400'
                }`}
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1.5">
              {correctCount} / {totalQuestions} correct
            </span>
          </div>

          {/* 2. Speed / Pace */}
          <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-slate-600 transition-all">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
              <Timer className="w-3.5 h-3.5 text-sky-400" />
              <span>Speed Pace</span>
            </div>
            <span className="text-3xl font-black text-sky-400">{avgSpeedSec}s</span>
            <div className="mt-2.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-950/60 border border-sky-800/60 text-sky-300">
                {Number(avgSpeedSec) < 2.5
                  ? '⚡ Lightning Fast'
                  : Number(avgSpeedSec) < 4.5
                  ? '🎯 Sharp & Steady'
                  : '🧠 Deliberate'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">avg per question</span>
          </div>

          {/* 3. Mastery & Streak */}
          <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-slate-600 transition-all">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
              {isPracticeMode ? (
                <>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Best Streak</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>SRS Progress</span>
                </>
              )}
            </div>
            <span className="text-3xl font-black text-amber-400">
              {isPracticeMode ? `x${maxStreak}` : `+${totalGraduated}`}
            </span>
            <div className="mt-2.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/60 text-amber-300">
                {isPracticeMode
                  ? 'Max In Session'
                  : masteredPromotions > 0
                  ? `+${masteredPromotions} Mastered!`
                  : `+${learningPromotions} To Active Recall`}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              {isPracticeMode ? 'consecutive correct' : 'promotions locked in'}
            </span>
          </div>

          {/* 4. Experience & XP */}
          <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-slate-600 transition-all">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              <span>Session Score</span>
            </div>
            <span className="text-3xl font-black text-purple-400">+{totalXp}</span>
            <div className="mt-2.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/60 text-purple-300">
                ⭐ Cartographer XP
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">mastery reward</span>
          </div>
        </div>
      </div>

      {/* Question Review Shelf */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl glass-card flex flex-col gap-4">
        {/* Shelf Header & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Question Breakdown</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                {totalQuestions}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterMode === 'all'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({totalQuestions})
            </button>
            <button
              onClick={() => setFilterMode('correct')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                filterMode === 'correct'
                  ? 'bg-emerald-950/70 border border-emerald-700/70 text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Correct ({correctCount})</span>
            </button>
            <button
              onClick={() => setFilterMode('missed')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                filterMode === 'missed'
                  ? 'bg-rose-950/70 border border-rose-700/70 text-rose-300 shadow-sm'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Need Review ({missedResults.length})</span>
            </button>
          </div>
        </div>

        {/* Scrollable Country Items */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {displayedResults.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No questions found in this view.
            </div>
          ) : (
            displayedResults.map((record, idx) => {
              const { question, isCorrect, userAnswer, timeSpentMs, feedback } = record;
              const country = question.country;
              const isLocationQuestion = question.attributeId === 'location';

              // Format answer labels
              let displayUserAnswer = userAnswer;
              if (isLocationQuestion) {
                // If map click, lookup clicked country name if available
                const clickedCountry = COUNTRIES_BY_ID.get(userAnswer.toUpperCase());
                if (clickedCountry) {
                  displayUserAnswer = clickedCountry.name;
                } else if (userAnswer === 'skip') {
                  displayUserAnswer = 'Skipped';
                }
              }

              return (
                <div
                  key={`${question.srsItemId}-${idx}`}
                  className={`p-3 sm:p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isCorrect
                      ? 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/60'
                      : 'bg-rose-950/20 border-rose-800/40 hover:bg-rose-950/30'
                  }`}
                >
                  {/* Left: Flag & Country Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl select-none flex-shrink-0" role="img" aria-label={country.name}>
                      {country.flagEmoji || '🏳️'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{country.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/80">
                          {country.subregion || country.continent}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-slate-300">
                          {isLocationQuestion ? (
                            <>
                              <MapPin className="w-3 h-3 text-sky-400" />
                              <span>Map Location</span>
                            </>
                          ) : (
                            <>
                              <Building2 className="w-3 h-3 text-amber-400" />
                              <span>Capital: {country.capital}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: User Answer & Outcome Status */}
                  <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                    {/* Time taken */}
                    {timeSpentMs > 0 && (
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <Timer className="w-3 h-3 text-slate-500" />
                        {(timeSpentMs / 1000).toFixed(1)}s
                      </span>
                    )}

                    {/* Status Badge */}
                    {isCorrect ? (
                      <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Correct</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 bg-rose-950/70 border border-rose-700/70 text-rose-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Missed</span>
                        </div>
                        <span className="text-[11px] text-rose-300/80 mt-1 max-w-[200px] truncate text-right">
                          You: <span className="font-semibold text-rose-200">{displayUserAnswer || 'None'}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2 border-t border-slate-800">
          {/* Instant Retry Missed Button (Only shown if user missed questions) */}
          {missedResults.length > 0 && onRetryMissed && (
            <button
              onClick={() => onRetryMissed(missedResults.map((r) => r.question))}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry {missedResults.length} Missed {missedResults.length === 1 ? 'Country' : 'Countries'}</span>
            </button>
          )}

          {/* Drill Again */}
          <button
            onClick={onRestart}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span>{isPracticeMode ? 'Drill Continent Again (15)' : 'Next Review Batch (15)'}</span>
          </button>

          {/* Return to Dashboard */}
          <button
            onClick={onDashboard}
            className="w-full sm:w-auto py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Crown SVG icon component for 100% score celebration
const CrownIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);
