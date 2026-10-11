import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe2,
  Flame,
  Sparkles,
  Zap,
  Compass,
  Download,
  Upload,
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  Target,
  Award
} from 'lucide-react';
import { Continent, TrainingCategory, MapViewMode, SRSItem, UserStats, AppSettings } from '../../core/types';
import { COUNTRIES } from '../../assets/data/countries';
import { WATER_BODIES } from '../../assets/data/waterBodies';
import { computeMasteryStats } from '../../core/srsEngine';
import { StorageService } from '../../core/storage';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';
import { PlanetaryBackground } from '../common/PlanetaryBackground';
import { CartographerDossier } from './CartographerDossier';

interface DashboardProps {
  onStartSession: (continent: TrainingCategory, attributes: string[], practiceMode?: boolean) => void;
  onOpenAtlas: () => void;
  onOpenArcade: () => void;
  mapMode: MapViewMode;
  onToggleMapMode: (mode: MapViewMode) => void;
}

const CONTINENT_EMBLEMS: Record<Continent, string> = {
  Europe: '🏛️',
  Asia: '⛩️',
  Africa: '🦁',
  Americas: '🌎',
  Oceania: '🏝️'
};

export const Dashboard: React.FC<DashboardProps> = ({
  onStartSession,
  onOpenAtlas,
  onOpenArcade,
  mapMode,
  onToggleMapMode
}) => {
  const [srsItemsMap, setSrsItemsMap] = useState<Map<string, SRSItem>>(() => StorageService.loadSRSItems());
  const [stats, setStats] = useState<UserStats>(() => StorageService.loadStats());
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.loadSettings());
  const [selectedAttributeFilter, setSelectedAttributeFilter] = useState<string[]>(['capital', 'location']);

  // Subscribe to storage updates (e.g. disk rehydration on launch)
  useEffect(() => {
    const unsubscribe = StorageService.subscribe(() => {
      setSrsItemsMap(StorageService.loadSRSItems());
      setStats(StorageService.loadStats());
      setSettings(StorageService.loadSettings());
    });
    return unsubscribe;
  }, []);

  const mastery = useMemo(() => computeMasteryStats(srsItemsMap), [srsItemsMap]);

  const TOTAL_WORLD_ENTITIES = COUNTRIES.length + WATER_BODIES.length;

  // Total unique countries & maritime bodies with progress (Stage 1 or Stage 2)
  const uniqueEntitiesCount = useMemo(() => {
    const set = new Set<string>();
    srsItemsMap.forEach((item) => {
      if (item.stage > 0) set.add(item.countryId);
    });
    return set.size;
  }, [srsItemsMap]);

  // Total cards currently due for review
  const totalDueCount = useMemo(() => {
    const now = new Date().toISOString();
    let due = 0;
    srsItemsMap.forEach((item) => {
      if (selectedAttributeFilter.includes(item.attributeId) && (item.nextDueAt <= now || item.intervalDays === 0)) {
        due++;
      }
    });
    return due;
  }, [srsItemsMap, selectedAttributeFilter]);

  // Check if a continent or category has 0 due cards and 0 new cards
  const isContinentCaughtUp = (category: TrainingCategory) => {
    const now = new Date().toISOString();
    if (category === 'Oceans') {
      for (const wb of WATER_BODIES) {
        const existing = srsItemsMap.get(`${wb.id}:location`);
        if (!existing || existing.nextDueAt <= now || existing.intervalDays === 0) {
          return false;
        }
      }
      return true;
    }
    if (category === 'All') {
      for (const country of COUNTRIES) {
        for (const attrId of selectedAttributeFilter) {
          const existing = srsItemsMap.get(`${country.id}:${attrId}`);
          if (!existing || existing.nextDueAt <= now || existing.intervalDays === 0) {
            return false;
          }
        }
      }
      if (selectedAttributeFilter.includes('location')) {
        for (const wb of WATER_BODIES) {
          const existing = srsItemsMap.get(`${wb.id}:location`);
          if (!existing || existing.nextDueAt <= now || existing.intervalDays === 0) {
            return false;
          }
        }
      }
      return true;
    }
    const countries = COUNTRIES.filter((c) => c.continent === category);
    for (const country of countries) {
      for (const attrId of selectedAttributeFilter) {
        const existing = srsItemsMap.get(`${country.id}:${attrId}`);
        if (!existing || existing.nextDueAt <= now || existing.intervalDays === 0) {
          return false;
        }
      }
    }
    return true;
  };

  const toggleSound = () => {
    const next = !settings.audioEnabled;
    const updated = { ...settings, audioEnabled: next };
    setSettings(updated);
    StorageService.saveSettings(updated);
    soundFx.setEnabled(next);
    speechEngine.setEnabled(next);
    if (next) soundFx.playClick();
  };

  const handleExportBackup = async () => {
    const ok = await StorageService.exportBackupFile();
    if (ok) {
      soundFx.playLevelUp();
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = StorageService.importBackupJSON(content);
        if (success) {
          setSrsItemsMap(StorageService.loadSRSItems());
          setStats(StorageService.loadStats());
          setSettings(StorageService.loadSettings());
          soundFx.playLevelUp();
          alert('Backup restored successfully!');
        } else {
          alert('Invalid backup file format.');
        }
      }
    };
    reader.readAsText(file);
  };

  const continents: Continent[] = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'];

  const regionalCategories = useMemo(() => {
    return [
      ...continents.map((continent) => {
        const b = mastery.breakdown[continent];
        return {
          id: continent as TrainingCategory,
          name: continent,
          emblem: CONTINENT_EMBLEMS[continent] || '🌍',
          subtitle: `${Math.round(b.total / 2)} nations`,
          b,
          isWater: false
        };
      }),
      {
        id: 'Oceans' as TrainingCategory,
        name: 'Oceans & Straits',
        emblem: '🌊',
        subtitle: `${WATER_BODIES.length} maritime bodies`,
        b: mastery.waterBreakdown || { total: WATER_BODIES.length, stage0: WATER_BODIES.length, stage1: 0, stage2: 0 },
        isWater: true
      }
    ];
  }, [continents, mastery]);

  // Circular Dial Math (Radius = 46, Circumference = 289.02)
  const dialRadius = 46;
  const dialCircumference = 2 * Math.PI * dialRadius;
  const learningOffset = dialCircumference - (mastery.learningPercentage / 100) * dialCircumference;
  const masteryOffset = dialCircumference - (mastery.masteryPercentage / 100) * dialCircumference;

  return (
    <PlanetaryBackground className="flex-1 flex flex-col h-full overflow-y-auto text-slate-100 p-4 sm:p-8 lg:p-10">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-6 sm:gap-8 pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-sky-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/25 text-2xl select-none">
              🌍
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                GeoMastery
                <span className="text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 font-bold">
                  {typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() ? 'Android' : 'Pro'}
                </span>
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Cartography Command & Spaced Repetition Memory Engine
              </p>
            </div>
          </div>

          {/* Quick Settings & Streak Bar */}
          <div className="flex items-center gap-2.5">
            {/* Streak Counter */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-amber-300 font-bold text-xs shadow-md backdrop-blur-md">
              <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{stats.currentStreak} Day Streak</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors shadow-md backdrop-blur-md"
              title={settings.audioEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
            >
              {settings.audioEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Backup Export */}
            <button
              onClick={handleExportBackup}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors shadow-md backdrop-blur-md"
              title="Export JSON Backup"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Backup Import */}
            <label className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors cursor-pointer shadow-md backdrop-blur-md">
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        </div>

        {/* Main Dashboard Responsive Matrix */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Left Wing: Cartographer Dossier */}
          <div className="xl:col-span-4 2xl:col-span-4 flex flex-col gap-6 order-2 xl:order-1">
            <CartographerDossier
              srsItemsMap={srsItemsMap}
              stats={stats}
              onOpenAtlas={onOpenAtlas}
              onStartSession={onStartSession}
            />
          </div>

          {/* Right Wing: Primary Command Center & Operations */}
          <div className="xl:col-span-8 2xl:col-span-8 flex flex-col gap-8 order-1 xl:order-2">
            {/* Hero Command Center Card ("Daily Master Hub") */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-700/80 p-6 sm:p-9 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 glass-card">
          {/* Subtle Top Ambient Gradient */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-emerald-500/10 via-sky-500/5 to-transparent pointer-events-none" />

          {/* Left Column: Briefing & Controls */}
          <div className="flex flex-col gap-3 max-w-lg relative z-10">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Sparkles className="w-3.5 h-3.5" />
              <span>Spaced Repetition Mission Control</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
              Ready for your daily review?
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              Progressive cognitive scaffolding: new nations start in multiple choice and graduate to active recall. Requires 2 consecutive correct answers to master.
            </p>

            {/* Training Mode Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-slate-400 font-semibold mr-1">Focus:</span>
              <button
                onClick={() => {
                  setSelectedAttributeFilter((prev) =>
                    prev.includes('capital')
                      ? prev.length > 1
                        ? prev.filter((a) => a !== 'capital')
                        : prev
                      : [...prev, 'capital']
                  );
                }}
                className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                  selectedAttributeFilter.includes('capital')
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-white'
                }`}
              >
                🏛️ Capital Cities
              </button>
              <button
                onClick={() => {
                  setSelectedAttributeFilter((prev) =>
                    prev.includes('location')
                      ? prev.length > 1
                        ? prev.filter((a) => a !== 'location')
                        : prev
                      : [...prev, 'location']
                  );
                }}
                className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                  selectedAttributeFilter.includes('location')
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-white'
                }`}
              >
                📍 Map Locations
              </button>
            </div>

            {/* Status Breakdown Pills */}
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <strong className="text-amber-300">{mastery.globalStage1}</strong> in active recall
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <strong className="text-emerald-300">{mastery.globalStage2}</strong> mastered
              </span>
            </div>
          </div>

          {/* Right Column: Circular SVG Mastery Dial & Big CTA */}
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto relative z-10">
            {/* Precision Circular SVG Mastery Dial */}
            <div className="relative flex items-center justify-center">
              <svg className="w-32 h-32 -rotate-90 transform" viewBox="0 0 120 120">
                {/* Background Track */}
                <circle
                  cx="60"
                  cy="60"
                  r={dialRadius}
                  className="stroke-slate-800"
                  strokeWidth="8"
                  fill="transparent"
                />

                {/* Learning / Active Recall Ring (Amber) */}
                <circle
                  cx="60"
                  cy="60"
                  r={dialRadius}
                  className="stroke-amber-400 transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray={dialCircumference}
                  strokeDashoffset={learningOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  opacity="0.85"
                />

                {/* Mastered Ring (Emerald) */}
                <circle
                  cx="60"
                  cy="60"
                  r={dialRadius}
                  className="stroke-emerald-400 transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray={dialCircumference}
                  strokeDashoffset={masteryOffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              {/* Dial Center Info */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-white font-mono tracking-tight">
                  {mastery.masteryPercentage}%
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Mastered
                </span>
                <span className="text-[9px] font-semibold text-amber-300">
                  {mastery.learningPercentage}% recall
                </span>
              </div>
            </div>

            {/* Launch Daily World Review Button */}
            <button
              onClick={() => onStartSession('All', selectedAttributeFilter, totalDueCount === 0)}
              className="w-full sm:w-auto px-7 py-4.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 flex flex-col items-center justify-center gap-0.5 transition-all transform active:scale-95"
            >
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 fill-slate-950" />
                <span>TRAIN WORLD</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-900/80">
                {totalDueCount > 0 ? `${totalDueCount} Reviews Due` : '15 Mixed Reviews'}
              </span>
            </button>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Atlas Explorer */}
          <button
            onClick={onOpenAtlas}
            className="group p-6 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 flex items-center justify-between text-left transition-all shadow-xl backdrop-blur-md glass-card-hover"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/35 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Interactive World Atlas</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-700/60 text-sky-300">
                    Free-Roam
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Explore 196 sovereign nations on 2D vector map & 3D globe with search and country dossiers
                </p>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all text-lg font-bold">
              →
            </span>
          </button>

          {/* Time Attack Arcade */}
          <button
            onClick={onOpenArcade}
            className="group p-6 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 flex items-center justify-between text-left transition-all shadow-xl backdrop-blur-md glass-card-hover"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/35 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 fill-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Time-Attack Blitz</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-700/60 text-amber-300">
                    Arcade Speedrun
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  60-second capital challenge with combo streak multipliers and personal records
                </p>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all text-lg font-bold">
              →
            </span>
          </button>
        </div>

        {/* Continent & Hydrography Drill Cards */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-emerald-400" />
              <span>Targeted Regional & Maritime Drills</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Click a region or maritime category to launch dedicated practice</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {regionalCategories.map((cat) => {
              const pct = cat.b.total > 0 ? Math.round((cat.b.stage2 / cat.b.total) * 100) : 0;
              const learningPct = cat.b.total > 0 ? Math.round((cat.b.stage1 / cat.b.total) * 100) : 0;
              const caughtUp = isContinentCaughtUp(cat.id);

              return (
                <div
                  key={cat.id}
                  className={`rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all shadow-lg backdrop-blur-md glass-card-hover group border ${
                    cat.isWater
                      ? 'bg-slate-900/85 border-sky-500/40 hover:border-sky-400'
                      : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg select-none">{cat.emblem}</span>
                        <h4 className="font-bold text-white text-sm">{cat.name}</h4>
                      </div>
                      <span className={`text-xs font-mono font-bold ${cat.isWater ? 'text-sky-400' : 'text-emerald-400'}`}>
                        {pct}%
                      </span>
                    </div>

                    {/* Dual-layer progress bar: Emerald/Sky (Mastered) + Amber (Learning) */}
                    <div className="h-2 rounded-full bg-slate-950 mt-3 overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-300 ${cat.isWater ? 'bg-sky-400' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                        title={`${pct}% Mastered`}
                      />
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${learningPct}%` }}
                        title={`${learningPct}% Active Recall`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2">
                      <span>{cat.subtitle}</span>
                      <span className="text-amber-300 font-semibold">{cat.b.stage1} in recall</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onStartSession(cat.id, cat.isWater ? ['location'] : selectedAttributeFilter, caughtUp)}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                      caughtUp
                        ? 'bg-violet-950/70 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-700/50 shadow-violet-950/30'
                        : cat.isWater
                        ? 'bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-100 border border-slate-700 hover:border-sky-400'
                        : 'bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-100 border border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    {caughtUp ? (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-violet-400 text-violet-400" />
                        <span>Practice {cat.id === 'Oceans' ? 'Oceans' : cat.name}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Train {cat.id === 'Oceans' ? 'Oceans' : cat.name}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Statistics Telemetry Pods */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-900/80 border border-slate-700/80 rounded-2xl p-5 shadow-xl backdrop-blur-md">
          {/* 1. Total Reviews */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">Total Reviews</span>
              <span className="text-xl font-bold font-mono text-white mt-0.5">{stats.totalReviews}</span>
            </div>
          </div>

          {/* 2. Overall Accuracy */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">Overall Accuracy</span>
              <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {stats.totalReviews > 0 ? Math.round((stats.totalCorrect / stats.totalReviews) * 100) : 100}%
              </span>
            </div>
          </div>

          {/* 3. Streaks */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5 fill-amber-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">Streak Milestone</span>
              <span className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                {stats.currentStreak} Days <span className="text-xs text-slate-400 font-normal">(Record: {stats.longestStreak}d)</span>
              </span>
            </div>
          </div>

          {/* 4. Nations & Seas in Memory */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-400">
              <Award className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">Nations & Seas in Memory</span>
              <span className="text-xl font-bold font-mono text-purple-300 mt-0.5">
                {uniqueEntitiesCount} <span className="text-xs text-slate-400 font-normal">/ {TOTAL_WORLD_ENTITIES} World</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</PlanetaryBackground>
);
};
