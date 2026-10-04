import React from 'react';
import { Country } from '../../core/types';
import { MapPin, ArrowRight } from 'lucide-react';

interface MapClickPromptProps {
  country: Country;
  isSubmitted: boolean;
  selectedCountryName?: string;
  isCorrect?: boolean;
  onNextQuestion: () => void;
  onSkip?: () => void;
}

export const MapClickPrompt: React.FC<MapClickPromptProps> = ({
  country,
  isSubmitted,
  selectedCountryName,
  isCorrect,
  onNextQuestion,
  onSkip
}) => {
  return (
    <div className="flex flex-col gap-3 w-full max-w-xl mx-auto">
      {/* Target Card */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col items-center text-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{country.flagEmoji}</span>
          <span className="text-xs uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
            {country.continent} • {country.subregion}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {country.name}
          </h2>
        </div>

        <div className="text-xs text-slate-400">
          Capital: <span className="text-slate-200 font-semibold">{country.capital}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-1">
          <MapPin className="w-3.5 h-3.5" />
          <span>Click this country on the map or globe above</span>
        </div>
      </div>

      {/* Action / Feedback row */}
      {isSubmitted ? (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 shadow-xl">
          <div className="text-sm">
            {isCorrect ? (
              <span className="text-emerald-400 font-bold">🎯 Spot on! Perfect location!</span>
            ) : (
              <span className="text-rose-400 font-bold">
                You clicked: {selectedCountryName || 'another country'}
              </span>
            )}
          </div>
          <button
            onClick={onNextQuestion}
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1 text-sm shadow-md transition-all"
          >
            <span>Next</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        onSkip && (
          <div className="flex justify-center">
            <button
              onClick={onSkip}
              className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
            >
              Skip / Show location
            </button>
          </div>
        )
      )}
    </div>
  );
};
