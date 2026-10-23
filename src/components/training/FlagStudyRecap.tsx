import React, { useState, useMemo, useEffect } from 'react';
import {
  Flag,
  Grid,
  Layers,
  Eye,
  EyeOff,
  Shuffle,
  Play,
  Zap,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Sparkles,
  Compass,
  RefreshCw
} from 'lucide-react';
import { Country, SRSItem, TrainingCategory } from '../../core/types';
import { classifyCardHorizon, shuffleArray } from '../../core/srsEngine';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';

interface FlagStudyRecapProps {
  continentFilter: TrainingCategory;
  cohortCountries: Country[];
  sessionFlagCountryIds: Set<string>;
  srsItemsMap: Map<string, SRSItem>;
  sessionQueueLength: number;
  isOnlyFlagAttribute: boolean;
  onStartRollThroughAll: (selectedCountries: Country[]) => void;
  onStartStandardQueue: () => void;
  onResampleCohort?: () => void;
  onExit: () => void;
}

export const FlagStudyRecap: React.FC<FlagStudyRecapProps> = ({
  continentFilter,
  cohortCountries,
  sessionFlagCountryIds,
  srsItemsMap,
  onStartRollThroughAll,
  onStartStandardQueue,
  onResampleCohort
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'flashcard'>('grid');
  const [orderMode, setOrderMode] = useState<'subregion' | 'shuffled'>('subregion');
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [hideNames, setHideNames] = useState<boolean>(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [failedImgIds, setFailedImgIds] = useState<Set<string>>(() => new Set());
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Reset active flashcard index and revealed states if the session cohort changes
  useEffect(() => {
    setActiveIndex(0);
    setRevealedIds(new Set());
  }, [cohortCountries]);

  // Cohort breakdown stats (Unmastered push vs Mastered memory maintenance)
  const cohortBreakdown = useMemo(() => {
    let mastered = 0;
    let recall = 0;
    let learning = 0;
    let unseen = 0;
    for (const c of cohortCountries) {
      const item = srsItemsMap.get(`${c.id}:flag`);
      const bucket = classifyCardHorizon(item);
      if (bucket === 'mastered') mastered++;
      else if (bucket === 'recall') recall++;
      else if (bucket === 'learning') learning++;
      else unseen++;
    }
    return {
      mastered,
      unmastered: recall + learning + unseen,
      recall,
      learning,
      unseen
    };
  }, [cohortCountries, srsItemsMap]);

  // Sort by subregion (for visual comparison of regional flag families) or shuffle (for self-testing)
  const displayedCountries = useMemo(() => {
    if (orderMode === 'shuffled') {
      return shuffleArray(cohortCountries);
    }
    return [...cohortCountries].sort((a, b) => {
      const contCmp = a.continent.localeCompare(b.continent);
      if (contCmp !== 0) return contCmp;
      const subCmp = (a.subregion || '').localeCompare(b.subregion || '');
      if (subCmp !== 0) return subCmp;
      return a.name.localeCompare(b.name);
    });
  }, [cohortCountries, orderMode, shuffleSeed]);

  const toggleRevealCard = (id: string) => {
    soundFx.playClick();
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Keyboard navigation in Flashcard mode (Left/Right arrows, Space to peek/flip)
  useEffect(() => {
    if (viewMode !== 'flashcard') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        soundFx.playClick();
        setActiveIndex((i) => (i + 1) % Math.max(1, displayedCountries.length));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        soundFx.playClick();
        setActiveIndex((i) => (i - 1 + displayedCountries.length) % Math.max(1, displayedCountries.length));
      } else if (e.key === ' ') {
        e.preventDefault();
        const curr = displayedCountries[activeIndex];
        if (curr) {
          if (hideNames) {
            toggleRevealCard(curr.id);
          } else {
            setHideNames(true);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, displayedCountries, activeIndex, hideNames]);

  const getCardStatusBadge = (countryId: string) => {
    const item = srsItemsMap.get(`${countryId}:flag`);
    if (!item) {
      return {
        label: 'New',
        cls: 'bg-sky-950/90 text-sky-300 border-sky-700/60'
      };
    }
    const bucket = classifyCardHorizon(item);
    if (bucket === 'mastered') {
      return {
        label: 'Mastered',
        cls: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60'
      };
    }
    if (bucket === 'recall') {
      return {
        label: 'Recall',
        cls: 'bg-amber-950/90 text-amber-300 border-amber-700/60'
      };
    }
    return {
      label: 'Learning',
      cls: 'bg-orange-950/90 text-orange-300 border-orange-700/60'
    };
  };

  const activeFlashcardCountry = displayedCountries[activeIndex] || displayedCountries[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0B1C2A] text-[#F6EFE2]">
      {/* Top Study Control Bar */}
      <div className="border-b border-[#F6EFE2]/12 bg-[#102637]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 z-30 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onStartStandardQueue}
            className="text-xs text-[#D6CBB9] hover:text-white px-2.5 py-1.5 rounded-lg bg-[#0B1C2A] border border-[#F6EFE2]/15 transition-colors cursor-pointer"
          >
            ← Back to Stream
          </button>

          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#E9C46A]/20 border border-[#E9C46A]/45 flex items-center justify-center text-[#E9C46A]">
              <Flag className="w-4 h-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-[family-name:var(--font-fraunces)] text-sm sm:text-base font-black text-[#F6EFE2] tracking-tight">
                  Session Flag Cohort
                </h1>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E9C46A]/20 text-[#E9C46A] border border-[#E9C46A]/40">
                  {continentFilter === 'All' ? 'World' : continentFilter} · {displayedCountries.length} Flags
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0B1C2A] border border-[#F6EFE2]/15 text-[#D6CBB9]">
                  <span className="text-amber-300">{cohortBreakdown.unmastered} to Master</span>
                  <span className="text-[#8FA6B8]">·</span>
                  <span className="text-emerald-300">{cohortBreakdown.mastered} Mastered Review</span>
                </span>
              </div>
              <p className="text-[11px] text-[#9FB3C4] hidden sm:block">
                Exclusively sampled for this continuous session — every flag question in your stream comes from this {displayedCountries.length}-flag set.
              </p>
            </div>
          </div>
        </div>

        {/* Right Controls: Resample Cohort, View Mode, Ordering, Self-Test Toggle */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onResampleCohort && (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onResampleCohort();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#F6EFE2]/15 bg-[#0B1C2A] text-[#D6CBB9] hover:text-white hover:border-[#E9C46A]/50 text-xs font-bold transition-all cursor-pointer"
              title="Generate a fresh smart-sampled set of 50 flags for this session"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>New {displayedCountries.length}-Flag Set</span>
            </button>
          )}

          {/* Grid vs Flashcard Roll-Through Switcher */}
          <div className="flex items-center rounded-xl bg-[#0B1C2A] border border-[#F6EFE2]/15 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setViewMode('grid');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#F6EFE2] text-[#142534]' : 'text-[#9FB3C4] hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setViewMode('flashcard');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'flashcard' ? 'bg-[#F6EFE2] text-[#142534]' : 'text-[#9FB3C4] hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcards</span>
            </button>
          </div>

          {/* Group by Subregion vs Shuffle */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              if (orderMode === 'subregion') {
                setOrderMode('shuffled');
                setShuffleSeed((s) => s + 1);
              } else {
                setOrderMode('subregion');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              orderMode === 'shuffled'
                ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]'
                : 'border-[#F6EFE2]/15 bg-[#0B1C2A] text-[#D6CBB9] hover:text-white'
            }`}
            title="Toggle between regional grouping and shuffled order"
          >
            {orderMode === 'shuffled' ? <Shuffle className="w-3.5 h-3.5" /> : <Compass className="w-3.5 h-3.5" />}
            <span>{orderMode === 'shuffled' ? 'Shuffled' : 'By Region'}</span>
          </button>

          {/* Hide Names (Self-Test) Toggle */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setHideNames((h) => !h);
              setRevealedIds(new Set());
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
              hideNames
                ? 'border-[#E9C46A] bg-[#E9C46A]/20 text-[#E9C46A]'
                : 'border-[#F6EFE2]/15 bg-[#0B1C2A] text-[#D6CBB9] hover:text-white'
            }`}
          >
            {hideNames ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{hideNames ? 'Names Hidden (Tap to Peek)' : 'Self-Test (Hide Names)'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Grid Sheet OR Flashcard Roll-Through */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6">
        {viewMode === 'grid' ? (
          <div className="max-w-[1720px] mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {displayedCountries.map((country, idx) => {
              const badge = getCardStatusBadge(country.id);
              const isRevealed = !hideNames || revealedIds.has(country.id);
              const isSessionTarget = sessionFlagCountryIds.has(country.id);
              const flagUrl =
                country.iso2 && country.iso2 !== 'WB'
                  ? `https://flagcdn.com/w320/${country.iso2.toLowerCase()}.png`
                  : null;
              const imgFailed = failedImgIds.has(country.id);

              return (
                <div
                  key={country.id}
                  onClick={() => {
                    if (hideNames) {
                      toggleRevealCard(country.id);
                    } else {
                      setActiveIndex(idx);
                      setViewMode('flashcard');
                      soundFx.playClick();
                    }
                  }}
                  title={
                    hideNames
                      ? 'Click to reveal country name'
                      : `${country.name} · Capital: ${country.capital} (Click to inspect)`
                  }
                  className={`group relative rounded-2xl border p-2.5 flex flex-col justify-between gap-2 transition-all cursor-pointer select-none ${
                    isSessionTarget
                      ? 'bg-[#143146]/95 border-[#E9C46A]/45 hover:border-[#E9C46A] shadow-md'
                      : 'bg-[#11283A]/90 border-[#F6EFE2]/12 hover:border-[#F6EFE2]/40'
                  }`}
                >
                  {/* Top Meta Row: Index + SRS Stage Badge */}
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="font-mono font-bold text-[#8FA6B8]">#{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      {isSessionTarget && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#E9C46A]"
                          title="Queued in upcoming training stream"
                        />
                      )}
                      <span className={`px-1.5 py-0.5 rounded-md border font-bold text-[9px] ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Flag Plate */}
                  <div className="relative w-full aspect-[3/2] rounded-xl bg-[#091622] border border-[#F6EFE2]/10 flex items-center justify-center overflow-hidden p-1.5 shadow-inner">
                    {flagUrl && !imgFailed ? (
                      <img
                        src={flagUrl}
                        alt={isRevealed ? `${country.name} flag` : 'National flag'}
                        loading="lazy"
                        draggable={false}
                        onError={() =>
                          setFailedImgIds((prev) => {
                            const next = new Set(prev);
                            next.add(country.id);
                            return next;
                          })
                        }
                        className="w-full h-full object-contain rounded transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-5xl leading-none">{country.flagEmoji}</span>
                    )}
                  </div>

                  {/* Country Identity Footer */}
                  <div className="min-h-[38px] flex flex-col justify-center text-center px-1">
                    {isRevealed ? (
                      <>
                        <div className="font-[family-name:var(--font-fraunces)] text-xs sm:text-sm font-black text-[#F6EFE2] leading-tight truncate">
                          {country.name}
                        </div>
                        <div className="text-[10px] text-[#9FB3C4] truncate mt-0.5">
                          {country.subregion} · <span className="text-[#E9C46A]">{country.capital}</span>
                        </div>
                      </>
                    ) : (
                      <div className="py-1 rounded-lg bg-[#091622]/90 border border-dashed border-[#E9C46A]/35 text-[10px] font-bold uppercase tracking-wider text-[#E9C46A]/90 group-hover:bg-[#E9C46A]/15 transition-colors">
                        Tap to Reveal Name
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Flashcard Roll-Through Mode */
          activeFlashcardCountry && (
            <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-between gap-4 py-2">
              {/* Progress Indicator */}
              <div className="w-full flex items-center justify-between text-xs text-[#9FB3C4]">
                <span className="font-mono font-bold text-[#E9C46A]">
                  Card {activeIndex + 1} of {displayedCountries.length}
                </span>
                <span>Use ← / → arrows to step through · Space to toggle name</span>
              </div>

              {/* Large Flashcard */}
              <div
                onClick={() => {
                  if (hideNames) toggleRevealCard(activeFlashcardCountry.id);
                }}
                className="w-full flex-1 max-h-[430px] rounded-3xl border-2 border-[#E9C46A]/45 bg-gradient-to-b from-[#153348] to-[#0E2233] p-6 sm:p-8 shadow-2xl flex flex-col items-center justify-between text-center cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest px-3 py-1 rounded-full bg-[#0B1C2A] text-[#E9C46A] font-bold border border-[#E9C46A]/30">
                    {activeFlashcardCountry.continent} • {activeFlashcardCountry.subregion}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${
                      getCardStatusBadge(activeFlashcardCountry.id).cls
                    }`}
                  >
                    {getCardStatusBadge(activeFlashcardCountry.id).label}
                  </span>
                </div>

                {/* High-Res Flag */}
                <div className="my-2 flex-1 flex items-center justify-center w-full max-h-52">
                  {activeFlashcardCountry.iso2 && !failedImgIds.has(activeFlashcardCountry.id) ? (
                    <div className="h-full max-h-48 aspect-[3/2] rounded-2xl bg-[#091622] border-2 border-[#F6EFE2]/20 p-2 flex items-center justify-center shadow-xl">
                      <img
                        src={`https://flagcdn.com/w320/${activeFlashcardCountry.iso2.toLowerCase()}.png`}
                        alt="National flag"
                        draggable={false}
                        onError={() =>
                          setFailedImgIds((prev) => {
                            const next = new Set(prev);
                            next.add(activeFlashcardCountry.id);
                            return next;
                          })
                        }
                        className="max-h-full max-w-full object-contain rounded-lg"
                      />
                    </div>
                  ) : (
                    <span className="text-7xl sm:text-8xl">{activeFlashcardCountry.flagEmoji}</span>
                  )}
                </div>

                {/* Revealed or Hidden Country Name */}
                {!hideNames || revealedIds.has(activeFlashcardCountry.id) ? (
                  <div className="flex flex-col items-center gap-1">
                    <h2 className="font-[family-name:var(--font-fraunces)] text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {activeFlashcardCountry.name}
                    </h2>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[#D6CBB9]">
                      <span>
                        Capital: <strong className="text-[#E9C46A]">{activeFlashcardCountry.capital}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speechEngine.speak(activeFlashcardCountry.capital);
                        }}
                        className="p-1 rounded-lg bg-[#0B1C2A] text-[#38BDF8] hover:text-white border border-[#F6EFE2]/15"
                        title="Pronounce capital"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRevealCard(activeFlashcardCountry.id);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#E9C46A]/20 border border-[#E9C46A]/50 text-[#E9C46A] font-extrabold text-sm hover:bg-[#E9C46A]/30 transition-all"
                  >
                    Tap or Press Space to Reveal Country Name
                  </button>
                )}
              </div>

              {/* Prev / Next Controls */}
              <div className="flex items-center gap-3 w-full justify-center">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setActiveIndex((i) => (i - 1 + displayedCountries.length) % displayedCountries.length);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#143146] hover:bg-[#1B405B] border border-[#F6EFE2]/15 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setViewMode('grid');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#0B1C2A] hover:bg-[#143146] border border-[#F6EFE2]/15 text-xs font-bold text-[#9FB3C4] hover:text-white cursor-pointer"
                >
                  Back to {displayedCountries.length}-Flag Sheet
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setActiveIndex((i) => (i + 1) % displayedCountries.length);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#143146] hover:bg-[#1B405B] border border-[#F6EFE2]/15 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Bottom Launch Bar */}
      <div className="border-t border-[#F6EFE2]/12 bg-[#102637]/95 backdrop-blur-md px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-30 shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#D6CBB9]">
          <Sparkles className="w-4 h-4 text-[#E9C46A] shrink-0" />
          <span>
            Resume your continuous stream anytime, or inject all <strong>{displayedCountries.length} studied flags</strong> at the front of your stream.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onStartStandardQueue();
            }}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#143146] hover:bg-[#1C435F] border border-[#F6EFE2]/20 text-[#F6EFE2] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-[#E9C46A]" />
            <span>Resume Continuous Stream</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onStartRollThroughAll(displayedCountries);
            }}
            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E05A3D] via-[#D94E34] to-[#BB3D24] hover:brightness-110 text-[#FFF8E7] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Drill All {displayedCountries.length} Flags in Stream</span>
          </button>
        </div>
      </div>
    </div>
  );
};
