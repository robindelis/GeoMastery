import React, { useState, useEffect, useRef } from 'react';
import { Country } from '../../core/types';
import { Send, HelpCircle, ArrowRight } from 'lucide-react';

interface TypingRecallPromptProps {
  country: Country;
  promptText: string;
  correctAnswer: string;
  isSubmitted: boolean;
  userAnswer: string;
  isCorrect?: boolean;
  matchedFeedback?: string;
  onSubmitAnswer: (input: string) => void;
  onNextQuestion: () => void;
}

export const TypingRecallPrompt: React.FC<TypingRecallPromptProps> = ({
  country,
  promptText,
  correctAnswer,
  isSubmitted,
  userAnswer,
  isCorrect,
  matchedFeedback,
  onSubmitAnswer,
  onNextQuestion
}) => {
  const [inputValue, setInputValue] = useState('');
  const [hintCount, setHintCount] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto focus input when active
  useEffect(() => {
    if (!isSubmitted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSubmitted]);

  // Handle submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitted) {
      onNextQuestion();
    } else if (inputValue.trim()) {
      onSubmitAnswer(inputValue.trim());
    }
  };

  // Keyboard Enter listener after submission to proceed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitted && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onNextQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitted, onNextQuestion]);

  // Progressive Hint generator
  const getHintText = () => {
    if (hintCount === 0) return null;
    const clean = correctAnswer.trim();
    if (hintCount === 1) {
      return `Starts with "${clean[0]}" (${clean.length} letters)`;
    }
    return `Starts with "${clean.slice(0, 3)}..."`;
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
      {/* Header Card */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col items-center text-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{country.flagEmoji}</span>
          <span className="text-xs uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-800/60">
            {country.continent} • {country.subregion}
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
          {promptText}
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
          <span>Level 1: Active Recall (Direct Memory Retrieval)</span>
        </div>
      </div>

      {/* Typing Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            disabled={isSubmitted}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type answer here..."
            className={`w-full px-5 py-4 rounded-xl text-lg font-medium bg-slate-900/90 border transition-all outline-none shadow-xl ${
              isSubmitted
                ? isCorrect
                  ? 'border-emerald-500 text-emerald-300 bg-emerald-950/30'
                  : 'border-rose-500 text-rose-300 bg-rose-950/30'
                : 'border-slate-700 text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30'
            }`}
          />

          {!isSubmitted ? (
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500 text-slate-950 font-bold transition-all shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onNextQuestion}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1 text-sm transition-all shadow-md"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Hints & Feedback Area */}
        <div className="flex items-center justify-between text-xs px-1">
          {!isSubmitted ? (
            <>
              <button
                type="button"
                onClick={() => setHintCount((c) => Math.min(2, c + 1))}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Need a hint?</span>
              </button>
              {getHintText() && (
                <span className="text-amber-400 font-mono bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/50">
                  {getHintText()}
                </span>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-between text-xs">
              <span className={`font-semibold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                {matchedFeedback || (isCorrect ? 'Correct!' : `Answer: ${correctAnswer}`)}
              </span>
              <span className="text-slate-400">Press Enter or Space for next</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
