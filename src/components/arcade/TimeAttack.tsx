import React, { useState, useEffect } from 'react';
import { Zap, Timer, Flame, Trophy, RotateCcw, Home } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Country, Continent, MapViewMode } from '../../core/types';
import { COUNTRIES } from '../../assets/data/countries';
import { soundFx } from '../../core/soundFx';
import { StorageService } from '../../core/storage';
import { MapContainer } from '../map/MapContainer';

interface TimeAttackProps {
  mapMode: MapViewMode;
  onToggleMapMode: (mode: MapViewMode) => void;
  onExit: () => void;
}

export const TimeAttack: React.FC<TimeAttackProps> = ({
  mapMode,
  onToggleMapMode,
  onExit
}) => {
  const [selectedContinent, setSelectedContinent] = useState<'All' | Continent>('Europe');
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [currentCountry, setCurrentCountry] = useState<Country | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);

  // Pool of countries based on continent
  const countryPool = React.useMemo(() => {
    return selectedContinent === 'All'
      ? COUNTRIES
      : COUNTRIES.filter((c) => c.continent === selectedContinent);
  }, [selectedContinent]);

  // Pick next random question
  const nextQuestion = () => {
    if (countryPool.length === 0) return;
    const target = countryPool[Math.floor(Math.random() * countryPool.length)];
    setCurrentCountry(target);

    // Pick 3 distractors
    const otherCapitals = countryPool
      .filter((c) => c.id !== target.id)
      .map((c) => c.capital)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const shuffled = [target.capital, ...otherCapitals].sort(() => Math.random() - 0.5);
    setOptions(shuffled);
  };

  // Start game
  const startGame = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setTimeLeft(60);
    setScore(0);
    setStreak(0);
    setMultiplier(1);
    nextQuestion();
  };

  // Countdown timer
  useEffect(() => {
    if (!isPlaying) return;

    if (timeLeft <= 0) {
      setIsPlaying(false);
      setIsGameOver(true);
      soundFx.playLevelUp();
      confetti({ particleCount: 100, spread: 70 });

      // Save high score
      const stats = StorageService.loadStats();
      const existing = stats.timeAttackRecords[selectedContinent];
      if (!existing || score > existing.highStreak) {
        stats.timeAttackRecords[selectedContinent] = {
          highStreak: score,
          bestTimeSeconds: 60,
          date: new Date().toISOString()
        };
        StorageService.saveStats(stats);
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, timeLeft, score, selectedContinent]);

  // Handle choice
  const handleAnswer = (choice: string) => {
    if (!isPlaying || !currentCountry) return;

    if (choice === currentCountry.capital) {
      soundFx.playSuccess();
      const newStreak = streak + 1;
      const newMult = Math.min(4, Math.floor(newStreak / 3) + 1);
      setStreak(newStreak);
      setMultiplier(newMult);
      setScore((s) => s + 100 * newMult);
    } else {
      soundFx.playError();
      setStreak(0);
      setMultiplier(1);
    }

    nextQuestion();
  };

  // Keyboard 1-4 shortcuts
  useEffect(() => {
    if (!isPlaying) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (['1', '2', '3', '4'].includes(key)) {
        const index = parseInt(key, 10) - 1;
        if (options[index]) {
          handleAnswer(options[index]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, options, currentCountry]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0f172a]">
      {/* Top Header */}
      <div className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          >
            ← Exit Arcade
          </button>
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
            <Zap className="w-4 h-4 fill-amber-400" />
            <span>Time-Attack Blitz</span>
          </div>
        </div>

        {isPlaying && (
          <div className="flex items-center gap-6">
            {/* Timer */}
            <div className="flex items-center gap-2 bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-700">
              <Timer className="w-4 h-4 text-rose-400 animate-pulse" />
              <span className={`font-mono text-base font-bold ${timeLeft <= 10 ? 'text-rose-400 animate-ping' : 'text-white'}`}>
                {timeLeft}s
              </span>
            </div>

            {/* Multiplier */}
            <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-700/60 px-3 py-1 rounded-xl text-amber-300 font-bold text-sm">
              <Flame className="w-4 h-4 fill-amber-400" />
              <span>x{multiplier}</span>
            </div>

            {/* Score */}
            <div className="text-xl font-black font-mono text-emerald-400">
              {score} pts
            </div>
          </div>
        )}
      </div>

      {/* Main Play Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Background Map */}
        <MapContainer
          mapMode={mapMode}
          onToggleMapMode={onToggleMapMode}
          targetCountryId={currentCountry?.id}
          className="opacity-70"
        />

        {/* Start Game Modal */}
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-40">
            <div className="bg-slate-900 border border-slate-700/80 p-8 rounded-3xl max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                <Zap className="w-8 h-8 fill-amber-400" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-white">60-Second Capital Sprint</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Answer as many capitals as you can before the clock runs out! Build streaks to unlock 4x point multipliers.
                </p>
              </div>

              {/* Continent Select */}
              <div className="w-full flex flex-col gap-2 text-left">
                <label className="text-xs font-semibold text-slate-300">Select Region:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Europe', 'Asia', 'Africa', 'Americas', 'Oceania', 'All'] as const).map((cont) => (
                    <button
                      key={cont}
                      onClick={() => setSelectedContinent(cont)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedContinent === cont
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cont}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-base shadow-xl transition-all"
              >
                START CHALLENGE
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6 z-40">
            <div className="bg-slate-900 border border-slate-700/80 p-8 rounded-3xl max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-6">
              <Trophy className="w-16 h-16 text-amber-400" />
              <div>
                <h2 className="text-2xl font-black text-white">Time's Up!</h2>
                <div className="text-4xl font-extrabold font-mono text-emerald-400 mt-2">
                  {score} pts
                </div>
                <p className="text-xs text-slate-400 mt-1">Region: {selectedContinent}</p>
              </div>

              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={startGame}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Play Again</span>
                </button>
                <button
                  onClick={onExit}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  <span>Exit</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Question Floating Card */}
        {isPlaying && currentCountry && (
          <div className="absolute bottom-8 inset-x-4 z-40 flex justify-center pointer-events-none">
            <div className="pointer-events-auto w-full max-w-lg bg-slate-900/95 border border-slate-700/90 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{currentCountry.flagEmoji}</span>
                  <span className="text-xl font-bold text-white tracking-tight">{currentCountry.name}</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">Keys: 1-4</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {options.map((opt, idx) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-sm flex items-center justify-between text-left transition-all active:scale-95"
                  >
                    <span className="truncate pr-1">{opt}</span>
                    <span className="w-5 h-5 rounded bg-slate-700 text-slate-400 text-xs font-mono font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
