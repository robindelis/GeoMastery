import React, { useState, useEffect } from 'react';
import { Continent, TrainingCategory, MapViewMode, Country } from './core/types';
import { StorageService } from './core/storage';
import { soundFx } from './core/soundFx';
import { speechEngine } from './core/speechEngine';
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
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([
    'capital',
    'capital_to_country',
    'location',
    'country',
    'flag'
  ]);
  const [initialPracticeMode, setInitialPracticeMode] = useState<boolean>(false);
  const [targetCountryId, setTargetCountryId] = useState<string | undefined>(undefined);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => StorageService.loadSettings().audioEnabled);

  // Sync sound settings with audio & speech engines
  useEffect(() => {
    soundFx.setEnabled(soundEnabled);
    speechEngine.setEnabled(soundEnabled);
    const settings = StorageService.loadSettings();
    if (settings.ttsProvider) speechEngine.setProvider(settings.ttsProvider);
    if (settings.geminiApiKey) speechEngine.setGeminiApiKey(settings.geminiApiKey);
    if (settings.geminiVoice) speechEngine.setGeminiVoice(settings.geminiVoice);
  }, [soundEnabled]);

  // Initialize persistent disk sync on boot & subscribe to storage changes
  useEffect(() => {
    StorageService.initPersistentSync().then((restored) => {
      if (restored) {
        const s = StorageService.loadSettings();
        setMapMode(s.mapMode);
        setSoundEnabled(s.audioEnabled);
        if (s.ttsProvider) speechEngine.setProvider(s.ttsProvider);
        if (s.geminiApiKey) speechEngine.setGeminiApiKey(s.geminiApiKey);
        if (s.geminiVoice) speechEngine.setGeminiVoice(s.geminiVoice);
      }
    });

    return StorageService.subscribe(() => {
      const s = StorageService.loadSettings();
      setMapMode(s.mapMode);
      setSoundEnabled(s.audioEnabled);
      if (s.ttsProvider) speechEngine.setProvider(s.ttsProvider);
      if (s.geminiApiKey) speechEngine.setGeminiApiKey(s.geminiApiKey);
      if (s.geminiVoice) speechEngine.setGeminiVoice(s.geminiVoice);
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
    setTargetCountryId(undefined);
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
    speechEngine.setEnabled(next);
    const settings = StorageService.loadSettings();
    StorageService.saveSettings({ ...settings, audioEnabled: next });
    if (next) soundFx.playClick();
  };

  return (
    <div className="flex flex-col h-dvh w-dvw overflow-hidden bg-[#0F2536] text-[#F6EFE2] font-sans select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Top Application Navbar */}
      <header className="h-14 border-b border-[#F6EFE2]/12 bg-[#0B1C2A]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-50 shrink-0">
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
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-fraunces)] font-black text-[#F6EFE2] text-lg tracking-tight">
                GeoMastery
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#E9C46A]/20 text-[#E9C46A] border border-[#E9C46A]/40 uppercase tracking-wider">
                Atlas
              </span>
            </div>
          </button>

          {/* Navigation Items (Tablet & Desktop) */}
          <nav className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => {
                setCurrentView('dashboard');
                soundFx.playClick();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentView === 'dashboard'
                  ? 'bg-[#F6EFE2] text-[#142534] shadow-sm'
                  : 'text-[#D6CBB9] hover:text-white'
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentView === 'atlas'
                  ? 'bg-[#F6EFE2] text-[#142534] shadow-sm'
                  : 'text-[#D6CBB9] hover:text-white'
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentView === 'arcade'
                  ? 'bg-[#F6EFE2] text-[#142534] shadow-sm'
                  : 'text-[#D6CBB9] hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-[#E9C46A] text-[#E9C46A]" />
              <span>Arcade</span>
            </button>
          </nav>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => handleStartSession('All', selectedAttributes)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#D94E34] hover:bg-[#C54128] text-[#FFF8E7] font-extrabold text-xs shadow-md transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Quick Study</span>
          </button>

          <button
            onClick={handleToggleSound}
            className="p-2 rounded-full border border-[#F6EFE2]/15 bg-[#143146] text-[#D6CBB9] hover:text-white transition-colors"
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#E9C46A]" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
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
            targetCountryId={targetCountryId}
            mapMode={mapMode}
            onToggleMapMode={handleToggleMapMode}
            onFinishSession={() => {
              setTargetCountryId(undefined);
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
              setTargetCountryId(country.id);
              setInitialPracticeMode(false);
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

      {/* Mobile Bottom Navigation Bar (< 640px) */}
      {currentView !== 'training' && (
        <nav className="flex sm:hidden h-14 border-t border-[#F6EFE2]/12 bg-[#0B1C2A]/95 backdrop-blur-md items-center justify-around px-2 z-50 shrink-0">
          <button
            onClick={() => {
              setCurrentView('dashboard');
              soundFx.playClick();
            }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
              currentView === 'dashboard' ? 'text-[#E9C46A]' : 'text-[#D6CBB9]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Atelier</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('atlas');
              soundFx.playClick();
            }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
              currentView === 'atlas' ? 'text-[#E9C46A]' : 'text-[#D6CBB9]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>World Map</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('arcade');
              soundFx.playClick();
            }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
              currentView === 'arcade' ? 'text-[#E9C46A]' : 'text-[#D6CBB9]'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Arcade</span>
          </button>
        </nav>
      )}
    </div>
  );
};
