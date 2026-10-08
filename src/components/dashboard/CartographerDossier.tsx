import React, { useState, useMemo } from 'react';
import {
  Compass,
  Sparkles,
  Target,
  Flame,
  Zap,
  CheckCircle2,
  Award,
  Radio,
  Eye,
  ArrowRight,
  Plane,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import { Continent, TrainingCategory, SRSItem, UserStats, Country } from '../../core/types';
import { COUNTRIES } from '../../assets/data/countries';
import { WATER_BODIES } from '../../assets/data/waterBodies';
import { soundFx } from '../../core/soundFx';

interface CartographerDossierProps {
  srsItemsMap: Map<string, SRSItem>;
  stats: UserStats;
  onOpenAtlas: () => void;
  onStartSession: (continent: TrainingCategory, attributes: string[], practiceMode?: boolean) => void;
}

export const CartographerDossier: React.FC<CartographerDossierProps> = ({
  srsItemsMap,
  stats,
  onOpenAtlas,
  onStartSession
}) => {
  const [showAnswer, setShowAnswer] = useState(false);

  // Deterministic "Spotlight Nation" based on day-of-year or prioritize active recall nations
  const spotlightCountry: Country = useMemo(() => {
    // Collect countries in active recall (Stage 1)
    const activeRecallCountryIds = new Set<string>();
    srsItemsMap.forEach((item) => {
      if (item.stage === 1) activeRecallCountryIds.add(item.countryId);
    });

    const activeList = COUNTRIES.filter((c) => activeRecallCountryIds.has(c.id));
    if (activeList.length > 0) {
      // Pick one deterministically by day
      const dayIndex = Math.floor(Date.now() / 86400000);
      return activeList[dayIndex % activeList.length];
    }

    // Fallback: Pick a notable nation
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return COUNTRIES[dayOfYear % COUNTRIES.length];
  }, [srsItemsMap]);

  // Memory Pipeline breakdown across 236 nations & maritime bodies
  const pipeline = useMemo(() => {
    let masteredCount = 0;
    let recallCount = 0;
    let recognitionCount = 0;

    const entityStages = new Map<string, number>();
    srsItemsMap.forEach((item) => {
      const current = entityStages.get(item.countryId) || 0;
      entityStages.set(item.countryId, Math.max(current, item.stage));
    });

    entityStages.forEach((stage) => {
      if (stage === 2) masteredCount++;
      else if (stage === 1) recallCount++;
      else if (stage === 0) recognitionCount++;
    });

    const totalEntities = COUNTRIES.length + WATER_BODIES.length; // 236 (196 nations + 40 oceans & straits)
    const unexplored = Math.max(0, totalEntities - (masteredCount + recallCount + recognitionCount));

    return {
      masteredCount,
      recallCount,
      recognitionCount,
      unexplored,
      totalEntities
    };
  }, [srsItemsMap]);

  // Spotlight country user progress status
  const countryStatus = useMemo(() => {
    const capItem = srsItemsMap.get(`${spotlightCountry.id}:capital`);
    const locItem = srsItemsMap.get(`${spotlightCountry.id}:location`);
    const maxStage = Math.max(capItem?.stage ?? -1, locItem?.stage ?? -1);

    if (maxStage === 2) {
      return { label: 'Mastered', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40' };
    }
    if (maxStage === 1) {
      return { label: 'Active Recall', color: 'text-amber-400 bg-amber-500/20 border-amber-500/40' };
    }
    if (maxStage === 0) {
      return { label: 'Recognition', color: 'text-sky-400 bg-sky-500/20 border-sky-500/40' };
    }
    return { label: 'Uncharted', color: 'text-slate-400 bg-slate-800/60 border-slate-700/60' };
  }, [spotlightCountry, srsItemsMap]);

  // User Rank & XP calculated from stats
  const cartographerXP = stats.totalCorrect * 15 + stats.totalReviews * 5;
  const rank = useMemo(() => {
    if (cartographerXP > 2500) return { title: 'Grand Cartographer', level: 5, nextXP: 5000 };
    if (cartographerXP > 1200) return { title: 'Senior Navigator', level: 4, nextXP: 2500 };
    if (cartographerXP > 600) return { title: 'Lead Explorer', level: 3, nextXP: 1200 };
    if (cartographerXP > 200) return { title: 'Apprentice Surveyor', level: 2, nextXP: 600 };
    return { title: 'Cadet Cartographer', level: 1, nextXP: 200 };
  }, [cartographerXP]);

  const levelProgress = Math.min(100, Math.round((cartographerXP / rank.nextXP) * 100));

  const handleToggleAnswer = () => {
    setShowAnswer((prev) => {
      const next = !prev;
      if (next) soundFx.playSuccess();
      else soundFx.playClick();
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* 1. Daily Nation Spotlight Dossier */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/85 border border-slate-700/80 p-5 shadow-2xl backdrop-blur-xl glass-card transition-all hover:border-slate-600">
        {/* Subtle ambient cyan glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs tracking-wider uppercase">
            <Radio className="w-3.5 h-3.5 animate-pulse text-sky-400" />
            <span>Spotlight Dossier</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${countryStatus.color}`}>
            {countryStatus.label}
          </span>
        </div>

        {/* Main Country Identification */}
        <div className="mt-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-4xl shadow-inner select-none flex-shrink-0">
            {spotlightCountry.flagEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-white truncate tracking-tight">
              {spotlightCountry.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">{spotlightCountry.subregion}</span>
              <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                {spotlightCountry.continent}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Quick Recall Flashcard */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Capital Question:</span>
            <span className="text-[10px] text-amber-300 font-mono">Active Recall</span>
          </div>

          <div className="flex items-center justify-between bg-slate-900/90 rounded-lg p-2.5 border border-slate-800">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Capital City</span>
              <span className="text-sm font-bold font-mono text-white">
                {showAnswer ? spotlightCountry.capital : '••••••••••••'}
              </span>
            </div>
            <button
              onClick={handleToggleAnswer}
              className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 text-xs font-semibold transition-all active:scale-95 flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showAnswer ? 'Hide' : 'Reveal'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={onOpenAtlas}
            className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Atlas Dossier</span>
          </button>
          <button
            onClick={() => onStartSession(spotlightCountry.continent, ['capital', 'location'], true)}
            className="py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all border border-emerald-500/50 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 fill-emerald-300" />
            <span>Drill Region</span>
          </button>
        </div>
      </div>

      {/* 2. Global Memory Pipeline (236 Nations & Maritime Bodies Horizon) */}
      <div className="rounded-2xl bg-slate-900/85 border border-slate-700/80 p-5 shadow-2xl backdrop-blur-xl glass-card">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs tracking-wider uppercase">
            <Target className="w-3.5 h-3.5" />
            <span>Memory Retention Horizon</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-300">
            {pipeline.masteredCount + pipeline.recallCount} / {pipeline.totalEntities}
          </span>
        </div>

        {/* Visual Segmented Progress Bar */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="h-3 rounded-full bg-slate-950 overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(pipeline.masteredCount / pipeline.totalEntities) * 100}%` }}
              title={`Mastered: ${pipeline.masteredCount}`}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${(pipeline.recallCount / pipeline.totalEntities) * 100}%` }}
              title={`Active Recall: ${pipeline.recallCount}`}
            />
            <div
              className="h-full bg-sky-500 transition-all duration-500"
              style={{ width: `${(pipeline.recognitionCount / pipeline.totalEntities) * 100}%` }}
              title={`Recognition: ${pipeline.recognitionCount}`}
            />
          </div>

          {/* Breakdown Legend */}
          <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Mastered
              </span>
              <span className="font-mono font-bold text-emerald-400">{pipeline.masteredCount}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Recall (L1)
              </span>
              <span className="font-mono font-bold text-amber-400">{pipeline.recallCount}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Scaffold (L0)
              </span>
              <span className="font-mono font-bold text-sky-400">{pipeline.recognitionCount}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                Uncharted
              </span>
              <span className="font-mono font-bold text-slate-400">{pipeline.unexplored}</span>
            </div>
          </div>
        </div>

        {/* Retention Quality Indicator */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Retention Health
          </span>
          <span className="font-mono font-bold text-emerald-400">
            {stats.totalReviews > 0 ? `${Math.round((stats.totalCorrect / stats.totalReviews) * 100)}%` : '100%'}
          </span>
        </div>
      </div>

      {/* 3. Daily Cartographer Expedition Goals */}
      <div className="rounded-2xl bg-slate-900/85 border border-slate-700/80 p-5 shadow-2xl backdrop-blur-xl glass-card">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs tracking-wider uppercase">
            <Award className="w-3.5 h-3.5" />
            <span>Expedition Rank & Quests</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
            LVL {rank.level}
          </span>
        </div>

        {/* Rank Title & XP Meter */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">{rank.title}</span>
            <span className="text-slate-400 font-mono text-[11px]">{cartographerXP} / {rank.nextXP} XP</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-950 mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>

        {/* Daily Quests Checklist */}
        <div className="mt-4 flex flex-col gap-2.5">
          {/* Quest 1: Daily Reviews */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200">Daily World Review</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-400">+50 XP</span>
          </div>

          {/* Quest 2: Continental Drill */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200">1 Continental Drill</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-sky-400">+30 XP</span>
          </div>

          {/* Quest 3: Streak Protector */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Flame className="w-3.5 h-3.5 fill-amber-400" />
              </div>
              <span className="text-xs text-slate-200">{stats.currentStreak}d Streak Active</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-400">Protected</span>
          </div>
        </div>
      </div>

      {/* 4. Active Geodesic Flight Corridors Telemetry */}
      <div className="rounded-2xl bg-slate-900/85 border border-slate-700/80 p-4 shadow-xl backdrop-blur-xl glass-card">
        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/80">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-sky-400">
            <Plane className="w-3.5 h-3.5" />
            Knowledge Corridors
          </span>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            LIVE
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              Paris ↔ Tokyo
            </span>
            <span className="font-mono text-[11px] text-slate-400">9,714 km</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              New York ↔ London
            </span>
            <span className="font-mono text-[11px] text-slate-400">5,570 km</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Singapore ↔ Sydney
            </span>
            <span className="font-mono text-[11px] text-slate-400">6,305 km</span>
          </div>
        </div>
      </div>
    </div>
  );
};
