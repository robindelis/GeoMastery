import React, { useState, useEffect } from 'react';
import { Continent, TrainingCategory, MapViewMode, Country } from './core/types';
import { StorageService } from './core/storage';
import { soundFx } from './core/soundFx';
import { Dashboard } from './components/dashboard/Dashboard';
import { TrainingSession } from './components/training/TrainingSession';
import { ExplorerAtlas } from './components/atlas/ExplorerAtlas';
import { TimeAttack } from './components/arcade/TimeAttack';
import { LayoutDashboard, Compass, Zap, Play, Volume2, VolumeX } from 'lucide-react';

type AppView = 'dashboard' | 'training' | 'atlas' | 'arcade';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [mapMode, setMapMode] = useState<MapViewMode>(() => StorageService.loadSettings().mapMode);
  const [selectedContinent, setSelectedContinent] = useState<TrainingCategory>('All');
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(['capital', 'location']);
  const [initialPracticeMode, setInitialPracticeMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => StorageService.loadSettings().audioEnabled);

  // Sync sound settings with engine
  useEffect(() => {
    soundFx.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Initialize persistent disk sync on boot
  useEffect(() => {
    StorageService.initPersistentSync().then((restored) => {
      if (restored) {
        setMapMode(StorageService.loadSettings().mapMode);
        setSoundEnabled(StorageService.loadSettings().audioEnabled);
      }
    });
  }, []);

  const handleStartSession = (
    continent: TrainingCategory,
    attributes: string[],
    practiceMode: boolean = false
  ) => {
    setSelectedContinent(continent);
    setSelectedAttributes(attributes);
    setInitialPracticeMode(practiceMode);
    setCurrentView('training');
    soundFx.playClick();
  };

  const handleToggleMapMode = (mode: MapViewMode) => {
    setMapMode(mode);
    const settings = StorageService.loadSettings();
    StorageService.saveSettings({ ...settings, mapMode: mode });
    soundFx.playClick();
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.setEnabled(next);
    const settings = StorageService.loadSettings();
    StorageService.saveSettings({ ...settings, audioEnabled: next });
    if (next) soundFx.playClick();
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0f172a] text-slate-100 font-sans select-none">
      {/* Top Application Navbar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <button
            onClick={() => {
              setCurrentView('dashboard');
              soundFx.playClick();
            }}
            className="flex items-center gap-2.5 text-left group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">🌍</span>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-base tracking-tight">GeoMastery</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>
          </button>

          {/* Navigation Items */}
          <nav className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => {
                setCurrentView('dashboard');
                soundFx.playClick();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'dashboard'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('atlas');
                soundFx.playClick();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'atlas'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Atlas</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('arcade');
                soundFx.playClick();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'arcade'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Arcade</span>
            </button>
          </nav>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleStartSession('All', ['capital', 'location'])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Quick Train</span>
          </button>

          <button
            onClick={handleToggleSound}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentView === 'dashboard' && (
          <Dashboard
            onStartSession={handleStartSession}
            onOpenAtlas={() => {
              setCurrentView('atlas');
              soundFx.playClick();
            }}
            onOpenArcade={() => {
              setCurrentView('arcade');
              soundFx.playClick();
            }}
            mapMode={mapMode}
            onToggleMapMode={handleToggleMapMode}
          />
        )}

        {currentView === 'training' && (
          <TrainingSession
            continentFilter={selectedContinent}
            attributeFilter={selectedAttributes}
            initialPracticeMode={initialPracticeMode}
            mapMode={mapMode}
            onToggleMapMode={handleToggleMapMode}
            onFinishSession={() => {
              setCurrentView('dashboard');
              soundFx.playClick();
            }}
          />
        )}

        {currentView === 'atlas' && (
          <ExplorerAtlas
            mapMode={mapMode}
            onToggleMapMode={handleToggleMapMode}
            onStartSpecificDrill={(country: Country) => {
              setSelectedContinent(country.continent);
              setCurrentView('training');
              soundFx.playClick();
            }}
          />
        )}

        {currentView === 'arcade' && (
          <TimeAttack
            mapMode={mapMode}
            onToggleMapMode={handleToggleMapMode}
            onExit={() => {
              setCurrentView('dashboard');
              soundFx.playClick();
            }}
          />
        )}
      </main>
    </div>
  );
};
