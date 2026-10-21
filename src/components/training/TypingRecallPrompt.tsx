import React, { useState, useEffect, useRef } from 'react';
import { Country } from '../../core/types';
import { Send, HelpCircle, ArrowRight, Volume2, Compass, Flag } from 'lucide-react';
import { speechEngine } from '../../core/speechEngine';

interface TypingRecallPromptProps {
  country: Country;
  attributeId?: string;
  promptText: string;
  correctAnswer: string;
  isSubmitted: boolean;
  userAnswer: string;
  isCorrect?: boolean;
  matchedFeedback?: string;
  onSubmitAnswer: (input: string) => void;
  onNextQuestion: () => void;
  onGiveUp?: () => void;
}

export const TypingRecallPrompt: React.FC<TypingRecallPromptProps> = ({
  country,
  attributeId = 'capital',
  promptText,
  correctAnswer,
  isSubmitted,
  userAnswer,
  isCorrect,
  matchedFeedback,
  onSubmitAnswer,
  onNextQuestion,
  onGiveUp
}) => {
  const [inputValue, setInputValue] = useState('');
  const [hintCount, setHintCount] = useState(0);
  const [flagImageError, setFlagImageError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isMapCountryIdentify = attributeId === 'country';
  const isFlagIdentify = attributeId === 'flag';
  const isCountryNameTarget = isMapCountryIdentify || isFlagIdentify;
  const flagImgUrl =
    country.iso2 && country.iso2 !== 'WB'
      ? `https://flagcdn.com/w320/${country.iso2.toLowerCase()}.png`
      : null;

  // Auto-clear input on question transition (safeguard against sticking values)
  useEffect(() => {
    setInputValue('');
    setHintCount(0);
    setFlagImageError(false);
  }, [country.id, promptText, attributeId]);

  // Auto focus input when active
  useEffect(() => {
    if (!isSubmitted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSubmitted]);

  // Handle submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitted && inputValue.trim()) {
      onSubmitAnswer(inputValue.trim());
    }
  };

  // Keyboard Enter / Space listener after submission to proceed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
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
    <div className="flex flex-col gap-2.5 sm:gap-4 w-full max-w-xl mx-auto">
      {/* Header Card */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col items-center text-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-2">
          {isMapCountryIdentify && !isSubmitted ? (
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
          ) : isFlagIdentify && !isSubmitted ? (
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-400">
              <Flag className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
          ) : (
            <span className="text-2xl sm:text-3xl">{country.flagEmoji}</span>
          )}
          <span className="text-[11px] sm:text-xs uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-800/60">
            {country.continent} • {country.subregion}
          </span>
        </div>

        {/* Prominent Flag Plate for Flag-to-Country questions */}
        {isFlagIdentify && (
          <div className="my-1.5 flex flex-col items-center justify-center">
            {flagImgUrl && !flagImageError ? (
              <div className="rounded-xl overflow-hidden border-2 border-slate-600/80 bg-slate-950/80 shadow-xl p-1">
                <img
                  src={flagImgUrl}
                  alt={isSubmitted ? `${country.name} flag` : 'Mystery national flag'}
                  draggable={false}
                  onError={() => setFlagImageError(true)}
                  className="h-16 sm:h-24 w-auto object-contain rounded-lg select-none"
                />
              </div>
            ) : (
              <div className="px-5 py-2 rounded-2xl bg-slate-800/80 border border-slate-700 text-5xl sm:text-6xl leading-none select-none shadow-inner">
                {country.flagEmoji}
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight mt-0.5 sm:mt-1">
          {promptText}
        </h2>

        {isSubmitted && isCountryNameTarget ? (
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>{country.flagEmoji}</span>
            <span className="font-bold text-white">{country.name}</span>
            <span>•</span>
            <span>
              Capital: <strong className="text-sky-300">{country.capital}</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-sky-400 font-medium">
            <span>
              {isMapCountryIdentify
                ? 'Highlighted in gold on the map • Type the country name'
                : isFlagIdentify
                ? 'National Flag Recall • Type the country name'
                : 'Active Recall (Direct Memory Retrieval)'}
            </span>
          </div>
        )}
      </div>

      {/* Typing Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:gap-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            disabled={isSubmitted}
            value={isSubmitted && userAnswer === '__DONT_KNOW__' ? '' : inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isSubmitted && userAnswer === '__DONT_KNOW__'
                ? `Did not know (Answer: ${correctAnswer})`
                : isCountryNameTarget
                ? 'Type country name...'
                : 'Type answer here...'
            }
            className={`w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-medium bg-slate-900/90 border transition-all outline-none shadow-xl ${
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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setHintCount((c) => Math.min(2, c + 1))}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Need a hint?</span>
                </button>
                {onGiveUp && (
                  <button
                    type="button"
                    onClick={onGiveUp}
                    className="text-xs text-rose-400/90 hover:text-rose-300 font-medium px-2.5 py-1 rounded-lg border border-rose-900/50 bg-rose-950/30 hover:bg-rose-950/60 transition-colors flex items-center gap-1"
                  >
                    <span>🤷 Don't Know</span>
                  </button>
                )}
              </div>
              {getHintText() && (
                <span className="text-amber-400 font-mono bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/50">
                  {getHintText()}
                </span>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`font-semibold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {userAnswer === '__DONT_KNOW__'
                    ? `Correct Answer: ${correctAnswer}`
                    : matchedFeedback || (isCorrect ? 'Correct!' : `Answer: ${correctAnswer}`)}
                </span>
                {country.capital && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speechEngine.speak(country.capital);
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-sky-400 hover:text-sky-300 transition-colors inline-flex items-center active:scale-95"
                    title="Hear capital pronunciation"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-slate-400 hidden sm:inline">Press Enter or Space for next</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
