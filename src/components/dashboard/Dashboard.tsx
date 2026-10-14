import React, { useState, useEffect, useCallback } from 'react';
import { TrainingCategory, MapViewMode, SRSItem, UserStats, AppSettings } from '../../core/types';
import { StorageService } from '../../core/storage';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';
import { prewarmVectorMap } from '../map/VectorMap2D';
import VelocityHome from './VelocityHome';
import type { HomeViewProps, FocusAttribute } from './homeTypes';

/* ────────────────────────────────────────────────────────────────────────────
 * HOME PAGE
 *
 * This shell owns every piece of persisted state and every handler; the
 * Velocity Deck component underneath is pure presentation driven by
 * `useHomeData`.
 * ──────────────────────────────────────────────────────────────────────────── */

interface DashboardProps {
  onStartSession: (continent: TrainingCategory, attributes: string[], practiceMode?: boolean) => void;
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

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
    applySettings({ ...settings, audioEnabled: next });
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
      applySettings({ ...settings, githubSyncToken: token });
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
      if (StorageService.importBackupJSON(content)) {
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

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden">
      <VelocityHome {...viewProps} />
    </div>
  );
};
