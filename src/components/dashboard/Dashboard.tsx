import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LayoutTemplate, Eye, EyeOff, X } from 'lucide-react';
import { Continent, TrainingCategory, MapViewMode, SRSItem, UserStats, AppSettings } from '../../core/types';
import { StorageService } from '../../core/storage';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';
import { prewarmVectorMap } from '../map/VectorMap2D';
import FlightDeckHome from './templates/FlightDeckHome';
import AtlasPlateHome from './templates/AtlasPlateHome';
import VelocityHome from './templates/VelocityHome';
import type { HomeViewProps, FocusAttribute } from './homeTypes';

/* ────────────────────────────────────────────────────────────────────────────
 * HOME PAGE SHELL
 *
 * The home page is a set of interchangeable templates. All persisted state,
 * derived data and handlers live here; each template is pure presentation and
 * receives exactly the same props. Use the template lab (bottom of the screen,
 * or Alt+1/2/3) to compare looks.
 * ──────────────────────────────────────────────────────────────────────────── */

export type HomeTemplateId = 'flight-deck' | 'atlas-plate' | 'velocity';

export interface HomeTemplateDef {
  id: HomeTemplateId;
  name: string;
  hint: string;
  Component: React.ComponentType<HomeViewProps>;
}

export const HOME_TEMPLATES: HomeTemplateDef[] = [
  { id: 'flight-deck', name: 'Flight Deck', hint: 'Dark instrument console', Component: FlightDeckHome },
  { id: 'atlas-plate', name: 'Atlas Plate', hint: 'Light editorial atlas', Component: AtlasPlateHome },
  { id: 'velocity', name: 'Velocity Deck', hint: 'Arcade scoreboard', Component: VelocityHome }
];

const TEMPLATE_KEY = 'geomastery.homeTemplate';
const LAB_KEY = 'geomastery.homeTemplateLab';

const readTemplate = (): HomeTemplateId => {
  try {
    const stored = localStorage.getItem(TEMPLATE_KEY);
    const match = HOME_TEMPLATES.find((t) => t.id === stored);
    if (match) return match.id;
  } catch {
    /* storage unavailable — fall through to default */
  }
  return 'flight-deck';
};

const readLabVisible = (): boolean => {
  try {
    return localStorage.getItem(LAB_KEY) !== 'hidden';
  } catch {
    return true;
  }
};

interface DashboardProps {
  onStartSession: (continent: TrainingCategory, attributes: string[], practiceMode?: boolean) => void;
  onOpenAtlas: () => void;
  onOpenArcade: () => void;
  mapMode: MapViewMode;
  onToggleMapMode: (mode: MapViewMode) => void;
}

const TemplateLab: React.FC<{
  active: HomeTemplateId;
  onSelect: (id: HomeTemplateId) => void;
  onDismiss: () => void;
}> = ({ active, onSelect, onDismiss }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-[4.75rem] z-50 flex justify-center px-3 sm:bottom-5">
    <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/12 bg-slate-950/90 p-1.5 shadow-2xl backdrop-blur-xl">
      <span className="hidden items-center gap-1.5 pl-2 pr-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:flex">
        <LayoutTemplate className="h-3.5 w-3.5" />
        Template
      </span>
      {HOME_TEMPLATES.map((template, index) => {
        const isActive = template.id === active;
        return (
          <button
            key={template.id}
            data-template-btn={template.id}
            onClick={() => onSelect(template.id)}
            title={`${template.name} — ${template.hint} (Alt+${index + 1})`}
            aria-pressed={isActive}
            className={`rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
              isActive ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
            }`}
          >
            <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.14em] opacity-70">
              <span className="hidden lg:inline">Alt+{index + 1} · </span>
              {template.hint}
            </span>
            <span className="block text-[12px] font-bold leading-tight">{template.name}</span>
          </button>
        );
      })}
      <button
        onClick={onDismiss}
        title="Hide the template lab"
        aria-label="Hide the template lab"
        className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  </div>
);

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<HomeTemplateId>(readTemplate);
  const [labVisible, setLabVisible] = useState<boolean>(readLabVisible);

  // Subscribe to storage updates (disk rehydration on launch) & prewarm map geometry
  useEffect(() => {
    const unsubscribe = StorageService.subscribe(() => {
      setSrsItemsMap(StorageService.loadSRSItems());
      setStats(StorageService.loadStats());
      setSettings(StorageService.loadSettings());
    });
    const idleTimer = setTimeout(() => prewarmVectorMap(), 50);
    return () => {
      unsubscribe();
      clearTimeout(idleTimer);
    };
  }, []);

  const applySettings = useCallback((next: AppSettings) => {
    setSettings(next);
    StorageService.saveSettings(next);
  }, []);

  const handleToggleAttribute = useCallback((attribute: FocusAttribute) => {
    setSelectedAttributeFilter((prev) => {
      if (prev.includes(attribute)) {
        if (prev.length <= 1) return prev; // never leave a session with no focus
        return prev.filter((a) => a !== attribute);
      }
      return [...prev, attribute];
    });
  }, []);

  const handleToggleSound = useCallback(() => {
    const next = !settings.audioEnabled;
    const updated = { ...settings, audioEnabled: next };
    applySettings(updated);
    soundFx.setEnabled(next);
    speechEngine.setEnabled(next);
    if (next) soundFx.playClick();
  }, [settings, applySettings]);

  const handleGitHubSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMessage('Syncing with GitHub…');
    try {
      const result = await StorageService.syncWithGitHub();
      setSrsItemsMap(StorageService.loadSRSItems());
      setStats(StorageService.loadStats());
      setSettings(StorageService.loadSettings());
      if (result.success) soundFx.playLevelUp();
      setSyncStatusMessage(result.message);
    } catch {
      setSyncStatusMessage('GitHub sync failed — check network');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMessage(null), 4500);
    }
  }, [isSyncing]);

  const handleSaveGithubToken = useCallback(
    (token: string) => {
      const updated = { ...settings, githubSyncToken: token };
      applySettings(updated);
      setSyncStatusMessage(token ? 'GitHub token saved for two-way sync' : 'GitHub token cleared (pull-only)');
      setTimeout(() => setSyncStatusMessage(null), 3500);
    },
    [settings, applySettings]
  );

  const handleExportBackup = useCallback(async () => {
    const ok = await StorageService.exportBackupFile();
    if (ok) soundFx.playLevelUp();
  }, []);

  const handleImportBackup = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
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
    };
    reader.readAsText(file);
  }, []);

  const selectTemplate = useCallback((id: HomeTemplateId) => {
    setTemplateId(id);
    try {
      localStorage.setItem(TEMPLATE_KEY, id);
    } catch {
      /* storage unavailable — keep in-memory selection only */
    }
    soundFx.playClick();
  }, []);

  // Alt+1/2/3 switches template, Alt+H toggles the lab
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const index = ['1', '2', '3'].indexOf(e.key);
      if (index >= 0) {
        e.preventDefault();
        selectTemplate(HOME_TEMPLATES[index].id);
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setLabVisible((prev) => {
          const next = !prev;
          try {
            localStorage.setItem(LAB_KEY, next ? 'visible' : 'hidden');
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectTemplate]);

  const template = useMemo(
    () => HOME_TEMPLATES.find((t) => t.id === templateId) ?? HOME_TEMPLATES[0],
    [templateId]
  );

  const viewProps: HomeViewProps = {
    srsItemsMap,
    stats,
    settings,
    mapMode,
    onToggleMapMode,
    selectedAttributes: selectedAttributeFilter,
    isSyncing,
    syncStatusMessage,
    onStartSession,
    onOpenAtlas,
    onOpenArcade,
    onToggleAttribute: handleToggleAttribute,
    onToggleSound: handleToggleSound,
    onSyncGitHub: handleGitHubSync,
    onExportBackup: handleExportBackup,
    onImportBackup: handleImportBackup,
    onSaveGithubToken: handleSaveGithubToken
  };

  const ActiveTemplate = template.Component;

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden">
      <ActiveTemplate {...viewProps} />

      {labVisible ? (
        <TemplateLab active={templateId} onSelect={selectTemplate} onDismiss={() => {
          setLabVisible(false);
          try {
            localStorage.setItem(LAB_KEY, 'hidden');
          } catch {
            /* ignore */
          }
        }} />
      ) : (
        <button
          onClick={() => {
            setLabVisible(true);
            try {
              localStorage.setItem(LAB_KEY, 'visible');
            } catch {
              /* ignore */
            }
          }}
          title="Show the template lab (Alt+H)"
          className="absolute bottom-[4.75rem] right-4 z-50 flex items-center gap-1.5 rounded-2xl border border-white/12 bg-slate-950/90 px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300 shadow-2xl backdrop-blur-xl transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:bottom-5 sm:right-5"
        >
          {labVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          Templates
        </button>
      )}
    </div>
  );
};
