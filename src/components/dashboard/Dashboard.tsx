import React, { useState, useEffect } from 'react';
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
  Play
} from 'lucide-react';
import { Continent, MapViewMode, SRSItem, UserStats, AppSettings } from '../../core/types';
import { COUNTRIES } from '../../assets/data/countries';
import { computeMasteryStats } from '../../core/srsEngine';
import { StorageService } from '../../core/storage';
import { soundFx } from '../../core/soundFx';
import { AmbientBackground } from '../common/AmbientBackground';

interface DashboardProps {
  onStartSession: (continent: 'All' | Continent, attributes: string[], practiceMode?: boolean) => void;
  onOpenAtlas: () => void;
  onOpenArcade: () => void;
  mapMode: MapViewMode;
  onToggleMapMode: (mode: MapViewMode) => void;
}

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

  const mastery = computeMasteryStats(srsItemsMap);

  // Check if a continent has 0 due cards and 0 new cards
  const isContinentCaughtUp = (continent: Continent) => {
    const now = new Date().toISOString();
    const countries = COUNTRIES.filter((c) => c.continent === continent);
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
    if (next) soundFx.playClick();
  };

  const handleExportBackup = () => {
    const jsonStr = StorageService.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geomastery-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    soundFx.playClick();
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

  return (
    <AmbientBackground className="flex-1 flex flex-col h-full overflow-y-auto text-slate-100 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-8 pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-sky-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 text-2xl">
              🌍
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                GeoMastery
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 font-semibold">
                  Desktop
                </span>
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                World Geography, Capitals & Map Location Spaced Repetition
              </p>
            </div>
          </div>

          {/* Quick Settings & Streak Bar */}
          <div className="flex items-center gap-3">
            {/* Streak Counter */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 text-amber-300 font-bold text-xs shadow-md">
              <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{stats.currentStreak} Day Streak</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-200 transition-colors shadow-md"
              title={settings.audioEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
            >
              {settings.audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Backup Export */}
            <button
              onClick={handleExportBackup}
              className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-200 transition-colors shadow-md"
              title="Export JSON Backup"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Backup Import */}
            <label className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-200 transition-colors cursor-pointer shadow-md">
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        </div>

        {/* Hero Global Mastery Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-800/95 via-slate-800/90 to-emerald-950/40 border border-slate-700/80 p-7 sm:p-9 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md">
          <div className="flex flex-col gap-2.5 max-w-lg">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs tracking-wider uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Progressive Cognitive Scaffolding Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
              Ready for your daily review?
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              New nations start in multiple-choice recognition. Once you answer correctly, they automatically graduate to active recall typing!
            </p>

            {/* Attribute Filter Toggles */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-300 font-semibold">Training:</span>
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
                    ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200 shadow-sm'
                    : 'bg-slate-700/60 border-slate-600/80 text-slate-300 hover:text-white'
                }`}
              >
                Capitals
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
                    ? 'bg-sky-500/25 border-sky-400/60 text-sky-200 shadow-sm'
                    : 'bg-slate-700/60 border-slate-600/80 text-slate-300 hover:text-white'
                }`}
              >
                Map Locations
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto">
            {/* Mastery Dial / Percent */}
            <div className="bg-slate-900/85 border border-slate-700/80 p-6 rounded-2xl flex flex-col items-center justify-center min-w-[150px] shadow-xl">
              <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
                {mastery.masteryPercentage}%
              </span>
              <span className="text-[11px] text-slate-300 font-bold uppercase tracking-wider mt-1">World Mastered</span>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-semibold mt-1">
                <span>{mastery.learningPercentage}% in Recall</span>
              </div>
            </div>

            {/* Launch Daily SRS Session Button */}
            <button
              onClick={() => onStartSession('All', selectedAttributeFilter)}
              className="w-full sm:w-auto px-8 py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3 transition-all transform active:scale-95"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>TRAIN WORLD</span>
            </button>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Atlas Explorer */}
          <button
            onClick={onOpenAtlas}
            className="group p-6 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 flex items-center justify-between text-left transition-all shadow-xl glass-card-hover"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/35 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Interactive World Atlas</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Free-roam 2D vector map & 3D globe with search and country dossiers
                </p>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
          </button>

          {/* Time Attack Arcade */}
          <button
            onClick={onOpenArcade}
            className="group p-6 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 flex items-center justify-between text-left transition-all shadow-xl glass-card-hover"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/35 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 fill-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Time-Attack Blitz</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  60-second speedrun challenge with streak combo multipliers
                </p>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
          </button>
        </div>

        {/* Continent Drill Cards */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-emerald-400" />
              <span>Targeted Continental Drills</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Click a continent to start dedicated session</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {continents.map((continent) => {
              const b = mastery.breakdown[continent];
              const pct = b.total > 0 ? Math.round((b.stage2 / b.total) * 100) : 0;
              const learningPct = b.total > 0 ? Math.round((b.stage1 / b.total) * 100) : 0;
              const caughtUp = isContinentCaughtUp(continent);

              return (
                <div
                  key={continent}
                  className="bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all shadow-lg glass-card-hover group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white text-sm">{continent}</h4>
                        {caughtUp && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Caught Up
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">{pct}%</span>
                    </div>

                    {/* Progress bars */}
                    <div className="h-2 rounded-full bg-slate-900/80 mt-2.5 overflow-hidden flex">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                      <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${learningPct}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2">
                      <span>{Math.round(b.total / 2)} nations</span>
                      <span className="text-amber-300 font-semibold">{b.stage1} in recall</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onStartSession(continent, selectedAttributeFilter, caughtUp)}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                      caughtUp
                        ? 'bg-violet-950/60 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-700/50'
                        : 'bg-slate-700/80 hover:bg-emerald-500 hover:text-slate-950 text-slate-100'
                    }`}
                  >
                    {caughtUp ? (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-violet-400 text-violet-400" />
                        <span>Practice {continent}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Train {continent}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Statistics Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Total Reviews</span>
            <span className="text-xl font-bold font-mono text-white mt-1">{stats.totalReviews}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Total Correct</span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-1">{stats.totalCorrect}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Overall Accuracy</span>
            <span className="text-xl font-bold font-mono text-sky-400 mt-1">
              {stats.totalReviews > 0 ? Math.round((stats.totalCorrect / stats.totalReviews) * 100) : 100}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Longest Streak</span>
            <span className="text-xl font-bold font-mono text-amber-400 mt-1">{stats.longestStreak} days</span>
          </div>
        </div>
      </div>
    </AmbientBackground>
  );
};
