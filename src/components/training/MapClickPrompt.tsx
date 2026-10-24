import React, { useEffect } from 'react';
import { Country } from '../../core/types';
import { MapPin, ArrowRight, Waves, Volume2, CheckCircle2 } from 'lucide-react';
import { speechEngine } from '../../core/speechEngine';

interface MapClickPromptProps {
  country: Country;
  isSubmitted: boolean;
  selectedCountryName?: string;
  isCorrect?: boolean;
  onNextQuestion: () => void;
  onSkip?: () => void;
  onGiveUp?: () => void;
  onOverrideCorrect?: () => void;
}

export const MapClickPrompt: React.FC<MapClickPromptProps> = ({
  country,
  isSubmitted,
  selectedCountryName,
  isCorrect,
  onNextQuestion,
  onSkip,
  onGiveUp,
  onOverrideCorrect
}) => {
  const isWater = country.id.startsWith('WATER_');

  // Keyboard Enter or Space listener to advance when submitted, or W to override
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (isSubmitted) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onNextQuestion();
        } else if ((e.key === 'w' || e.key === 'W') && !isCorrect && onOverrideCorrect) {
          e.preventDefault();
          onOverrideCorrect();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitted, isCorrect, onNextQuestion, onOverrideCorrect]);

  const handleConcede = () => {
    if (onGiveUp) onGiveUp();
    else if (onSkip) onSkip();
  };

  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full max-w-xl mx-auto">
      {/* Target Card */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col items-center text-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl sm:text-3xl">{country.flagEmoji}</span>
          <span className="text-[11px] sm:text-xs uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
            {isWater ? `🌊 Oceans & Straits • ${country.subregion}` : `${country.continent} • ${country.subregion}`}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
            {country.name}
          </h2>
        </div>

        {isWater ? (
          <div className="text-xs text-slate-300 max-w-md line-clamp-2 px-2">
            {country.facts?.significance || country.capital}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Capital:</span>
            <span className="text-slate-200 font-semibold">{country.capital}</span>
            {country.capital && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  speechEngine.speakCountryAndCapital(country.name, country.capital);
                }}
                className="p-1 rounded hover:bg-slate-800 text-sky-400 hover:text-sky-300 transition-colors inline-flex items-center active:scale-95"
                title="Hear country and capital pronunciation"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-emerald-400 font-medium mt-0.5 sm:mt-1">
          {isWater ? <Waves className="w-3.5 h-3.5 text-sky-400 shrink-0" /> : <MapPin className="w-3.5 h-3.5 shrink-0" />}
          <span>
            {isWater
              ? 'Tap this strait or body of water on the map above'
              : 'Tap this country on the map above'}
          </span>
        </div>
      </div>

      {/* Action / Feedback row */}
      {isSubmitted ? (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 shadow-xl">
          <div className="text-sm">
            {isCorrect ? (
              <span className="text-emerald-400 font-bold">
                {selectedCountryName && selectedCountryName !== country.name
                  ? '🎯 Marked as correct!'
                  : '🎯 Spot on! Perfect location!'}
              </span>
            ) : (
              <span className="text-rose-400 font-bold">
                {selectedCountryName
                  ? `You clicked: ${selectedCountryName}`
                  : `Target: ${country.name} (shown on map)`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isCorrect && onOverrideCorrect && (
              <button
                type="button"
                onClick={onOverrideCorrect}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1.5 text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Miss-clicked? Count this answer as correct and update spaced repetition (Shortcut: W)"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>I was right</span>
                <kbd className="hidden sm:inline font-mono text-[10px] bg-amber-950/70 border border-amber-600/40 px-1 py-0.2 rounded text-amber-300/90">
                  W
                </kbd>
              </button>
            )}
            <span className="text-xs text-slate-400 hidden sm:inline">Press Enter or Space</span>
            <button
              onClick={onNextQuestion}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1 text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        (onGiveUp || onSkip) && (
          <div className="flex justify-center">
            <button
              onClick={handleConcede}
              className="text-xs text-rose-400/90 hover:text-rose-300 font-medium px-3.5 py-1.5 rounded-xl border border-rose-900/50 bg-rose-950/30 hover:bg-rose-950/60 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>🤷 Don't Know / Show Location</span>
            </button>
          </div>
        )
      )}
    </div>
  );
};
