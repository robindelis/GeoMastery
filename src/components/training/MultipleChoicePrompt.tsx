import React, { useEffect } from 'react';
import { Country } from '../../core/types';

interface MultipleChoicePromptProps {
  country: Country;
  promptText: string;
  options: string[];
  selectedOption: string | null;
  correctAnswer: string;
  isSubmitted: boolean;
  onSelectOption: (option: string) => void;
}

export const MultipleChoicePrompt: React.FC<MultipleChoicePromptProps> = ({
  country,
  promptText,
  options,
  selectedOption,
  correctAnswer,
  isSubmitted,
  onSelectOption
}) => {
  // Keyboard listener for 1, 2, 3, 4
  useEffect(() => {
    if (isSubmitted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (['1', '2', '3', '4'].includes(key)) {
        const index = parseInt(key, 10) - 1;
        if (options[index]) {
          onSelectOption(options[index]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, isSubmitted, onSelectOption]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
      {/* Question Header Card */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col items-center text-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{country.flagEmoji}</span>
          <span className="text-xs uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
            {country.continent} • {country.subregion}
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
          {promptText}
        </h2>
        <div className="text-xs text-emerald-400/90 font-medium">
          Stage 0: Recognition Phase (Keyboard: 1-4)
        </div>
      </div>

      {/* 4 Multiple Choice Option Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option, idx) => {
          const isSelected = selectedOption === option;
          const isCorrect = option === correctAnswer;

          let btnStyle = 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-700 text-slate-100';

          if (isSubmitted) {
            if (isCorrect) {
              btnStyle = 'bg-emerald-600/90 border-emerald-400 text-white font-bold ring-2 ring-emerald-400/50';
            } else if (isSelected && !isCorrect) {
              btnStyle = 'bg-rose-600/90 border-rose-400 text-white font-bold ring-2 ring-rose-400/50';
            } else {
              btnStyle = 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-50';
            }
          } else if (isSelected) {
            btnStyle = 'bg-sky-600 border-sky-400 text-white font-semibold ring-2 ring-sky-400/50';
          }

          return (
            <button
              key={option}
              disabled={isSubmitted}
              onClick={() => onSelectOption(option)}
              className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all duration-150 transform active:scale-[0.98] ${btnStyle}`}
            >
              <span className="text-base font-semibold truncate pr-2">{option}</span>
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-800/80 border border-slate-600/60 text-xs font-mono font-bold text-slate-300">
                {idx + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
