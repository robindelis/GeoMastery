import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SRSItem, UserStats, AppSettings } from './types';

const STORAGE_KEYS = {
  SRS_ITEMS: 'geomastery_srs_items_v1',
  STATS: 'geomastery_user_stats_v1',
  SETTINGS: 'geomastery_settings_v1'
};

const DEFAULT_SETTINGS: AppSettings = {
  audioEnabled: true,
  soundVolume: 0.6,
  mapMode: '2d',
  autoRotateGlobe: false,
  showMapCountryLabels: false,
  typingFuzzyTolerance: 1,
  ttsProvider: 'google-stream',
  geminiApiKey: '',
  geminiVoice: 'Kore'
};

const DEFAULT_STATS: UserStats = {
  totalReviews: 0,
  totalCorrect: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastReviewDate: null,
  continentMastery: {
    Africa: { total: 0, mastered: 0, learning: 0 },
    Americas: { total: 0, mastered: 0, learning: 0 },
    Asia: { total: 0, mastered: 0, learning: 0 },
    Europe: { total: 0, mastered: 0, learning: 0 },
    Oceania: { total: 0, mastered: 0, learning: 0 }
  },
  timeAttackRecords: {}
};

export class StorageService {
  private static subscribers: Set<() => void> = new Set();
  private static syncTimeout: any = null;

  public static subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public static notifySubscribers(): void {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Error in storage subscriber:', e);
      }
    });
  }

  private static hasNativeStorageBridge(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.electronAPI?.loadStorageData) || Capacitor.isNativePlatform();
  }

  private static async loadNativeData(): Promise<{ success: boolean; data?: any; recoveredFromBackup?: boolean }> {
    if (typeof window === 'undefined') return { success: false };

    if (window.electronAPI?.loadStorageData) {
      return window.electronAPI.loadStorageData();
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const res = await Filesystem.readFile({
          path: 'geomastery_data.json',
          directory: Directory.Data,
          encoding: Encoding.UTF8
        });
        if (typeof res.data === 'string' && res.data.trim()) {
          return { success: true, data: JSON.parse(res.data) };
        }
      } catch {
        // Primary file may not exist yet or was unreadable; fall back to safeguard backup
      }

      try {
        const backupRes = await Filesystem.readFile({
          path: 'user_progress_backup.json',
          directory: Directory.Data,
          encoding: Encoding.UTF8
        });
        if (typeof backupRes.data === 'string' && backupRes.data.trim()) {
          return {
            success: true,
            data: JSON.parse(backupRes.data),
            recoveredFromBackup: true
          };
        }
      } catch {
        // Backup also does not exist yet
      }
    }

    return { success: false };
  }

  private static async saveNativeData(payload: any): Promise<void> {
    if (typeof window === 'undefined') return;

    if (window.electronAPI?.saveStorageData) {
      await window.electronAPI.saveStorageData(payload);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      const serialized = JSON.stringify(payload, null, 2);
      await Filesystem.writeFile({
        path: 'geomastery_data.json',
        data: serialized,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });

      const hasProgress =
        (Array.isArray(payload?.srsItems) && payload.srsItems.length > 0) ||
        (payload?.stats && payload.stats.totalReviews > 0);

      if (hasProgress) {
        await Filesystem.writeFile({
          path: 'user_progress_backup.json',
          data: serialized,
          directory: Directory.Data,
          encoding: Encoding.UTF8
        });
      }
    }
  }

  /**
   * Initializes persistent sync between disk file (Electron or Android native storage) and LocalStorage.
   * Ensures user progress is never lost even if LocalStorage partition changes.
   */
  public static async initPersistentSync(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (this.hasNativeStorageBridge()) {
      try {
        const res = await this.loadNativeData();
        if (res.success && res.data) {
          const diskData = res.data;
          const localItems = this.loadSRSItems();
          const diskItems = diskData.srsItems
            ? new Map<string, SRSItem>(diskData.srsItems)
            : new Map<string, SRSItem>();

          const diskStats: UserStats | undefined = diskData.stats;
          const localStats = this.loadStats();

          // If disk has items but local is completely empty, restore from disk!
          if (diskItems.size > 0 && localItems.size === 0) {
            this.saveSRSItems(diskItems);
            if (diskData.stats) this.saveStats(diskData.stats);
            if (diskData.settings) this.saveSettings(diskData.settings);
            this.notifySubscribers();
            return true;
          }

          // If both have progress, reconcile item-by-item to preserve whichever is more advanced
          if (diskItems.size > 0 && localItems.size > 0) {
            let changed = false;
            const mergedItems = new Map<string, SRSItem>(localItems);

            diskItems.forEach((diskItem, id) => {
              const localItem = mergedItems.get(id);
              if (!localItem) {
                mergedItems.set(id, diskItem);
                changed = true;
              } else {
                const diskTime = diskItem.lastReviewedAt ? new Date(diskItem.lastReviewedAt).getTime() : 0;
                const localTime = localItem.lastReviewedAt ? new Date(localItem.lastReviewedAt).getTime() : 0;
                if (diskTime > localTime || diskItem.reps > localItem.reps) {
                  mergedItems.set(id, diskItem);
                  changed = true;
                }
              }
            });

            // Reconcile stats: pick higher review count
            const diskReviews = diskStats?.totalReviews || 0;
            const localReviews = localStats.totalReviews || 0;
            if (diskReviews > localReviews && diskStats) {
              this.saveStats(diskStats);
              changed = true;
            }

            if (changed) {
              this.saveSRSItems(mergedItems);
              this.notifySubscribers();
            }

            // Sync reconciled state back to disk
            this.syncToDiskNow();
            return changed;
          }

          // If local has progress but disk is empty, push local to disk
          if (localItems.size > 0 && diskItems.size === 0) {
            this.syncToDiskNow();
          }
        } else {
          // If disk file doesn't exist yet, save current local state to disk
          this.syncToDiskNow();
        }
      } catch (err) {
        console.error('Failed to sync persistent disk storage:', err);
      }
    }
    return false;
  }

  private static syncToDiskNow(): void {
    if (this.hasNativeStorageBridge()) {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        srsItems: Array.from(this.loadSRSItems().entries()),
        stats: this.loadStats(),
        settings: this.loadSettings()
      };
      this.saveNativeData(payload).catch((err) => {
        console.error('Error writing to native disk storage:', err);
      });
    }
  }

  private static scheduleDiskSync(): void {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncToDiskNow();
    }, 200);
  }

  /**
   * Loads all SRS items from persistent storage.
   */
  public static loadSRSItems(): Map<string, SRSItem> {
    try {
      if (typeof localStorage === 'undefined') return new Map();
      const data = localStorage.getItem(STORAGE_KEYS.SRS_ITEMS);
      if (!data) return new Map();
      const parsed: [string, SRSItem][] = JSON.parse(data);
      return new Map(parsed);
    } catch (e) {
      console.error('Failed to load SRS items from storage:', e);
      return new Map();
    }
  }

  /**
   * Saves all SRS items to persistent storage.
   * Caps each item's history array to 15 entries to prevent localStorage quota exhaustion.
   */
  public static saveSRSItems(itemsMap: Map<string, SRSItem>): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const cappedEntries: [string, SRSItem][] = [];
        itemsMap.forEach((item, id) => {
          if (item.history && item.history.length > 15) {
            cappedEntries.push([id, { ...item, history: item.history.slice(-15) }]);
          } else {
            cappedEntries.push([id, item]);
          }
        });

        const serialized = JSON.stringify(cappedEntries);
        localStorage.setItem(STORAGE_KEYS.SRS_ITEMS, serialized);
        // Automated web fallback mirror
        localStorage.setItem('geomastery_user_progress_backup_v1', serialized);
      }
      this.scheduleDiskSync();
    } catch (e) {
      console.error('Failed to save SRS items to storage:', e);
    }
  }

  /**
   * Loads user stats with safe deep-merge of nested records.
   */
  public static loadStats(): UserStats {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STATS);
      if (!data) return { ...DEFAULT_STATS };
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_STATS,
        ...parsed,
        continentMastery: {
          ...DEFAULT_STATS.continentMastery,
          ...(parsed.continentMastery || {})
        },
        timeAttackRecords: {
          ...DEFAULT_STATS.timeAttackRecords,
          ...(parsed.timeAttackRecords || {})
        }
      };
    } catch (e) {
      return { ...DEFAULT_STATS };
    }
  }

  /**
   * Saves user stats.
   */
  public static saveStats(stats: UserStats): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
      }
      this.scheduleDiskSync();
    } catch (e) {
      console.error('Failed to save stats:', e);
    }
  }

  /**
   * Loads app settings.
   */
  public static loadSettings(): AppSettings {
    try {
      if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Saves app settings.
   */
  public static saveSettings(settings: AppSettings): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      }
      this.scheduleDiskSync();
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  /**
   * Records a completed review to update daily streaks and review counts.
   * Uses local calendar date string to prevent UTC/DST boundary discrepancies.
   */
  public static recordReviewEvent(isCorrect: boolean): UserStats {
    const stats = this.loadStats();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastDate = stats.lastReviewDate;

    stats.totalReviews += 1;
    if (isCorrect) stats.totalCorrect += 1;

    if (lastDate !== today) {
      if (lastDate) {
        const last = new Date(lastDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          stats.currentStreak += 1;
        } else if (diffDays > 1) {
          stats.currentStreak = 1;
        }
      } else {
        stats.currentStreak = 1;
      }
      stats.lastReviewDate = today;
      if (stats.currentStreak > stats.longestStreak) {
        stats.longestStreak = stats.currentStreak;
      }
    }

    this.saveStats(stats);
    return stats;
  }

  /**
   * Exports full user backup JSON.
   */
  public static exportBackupJSON(): string {
    const srsItems = Array.from(this.loadSRSItems().entries());
    const stats = this.loadStats();
    const settings = this.loadSettings();
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      srsItems,
      stats,
      settings
    }, null, 2);
  }

  /**
   * Exports user backup via native dialog (Electron), native share sheet (Android), or browser download (Web).
   */
  public static async exportBackupFile(): Promise<boolean> {
    const jsonStr = this.exportBackupJSON();
    const fileName = `geomastery-backup-${new Date().toISOString().split('T')[0]}.json`;

    if (typeof window !== 'undefined' && window.electronAPI?.saveBackup) {
      try {
        const res = await window.electronAPI.saveBackup(jsonStr);
        return Boolean(res.success);
      } catch (err) {
        console.error('Electron save dialog error, falling back to download:', err);
      }
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const writeRes = await Filesystem.writeFile({
          path: fileName,
          data: jsonStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        await Share.share({
          title: 'GeoMastery Backup',
          text: 'GeoMastery Spaced Repetition Progress Backup',
          url: writeRes.uri,
          dialogTitle: 'Save or Share GeoMastery Backup'
        });
        return true;
      } catch (err) {
        console.error('Android native share error, falling back to web download:', err);
      }
    }

    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }

    return false;
  }

  /**
   * Imports backup JSON with schema and type validation.
   */
  public static importBackupJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== 'object') return false;

      let importedAny = false;

      if (Array.isArray(data.srsItems)) {
        // Validate items structure
        const validatedItems = new Map<string, SRSItem>();
        for (const entry of data.srsItems) {
          if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string') {
            const [id, item] = entry;
            if (item && typeof item === 'object' && 'stage' in item && 'countryId' in item) {
              validatedItems.set(id, item as SRSItem);
            }
          }
        }
        if (validatedItems.size > 0) {
          this.saveSRSItems(validatedItems);
          importedAny = true;
        }
      }
      if (data.stats && typeof data.stats === 'object' && typeof data.stats.totalReviews === 'number') {
        this.saveStats(data.stats);
        importedAny = true;
      }
      if (data.settings && typeof data.settings === 'object' && typeof data.settings.audioEnabled === 'boolean') {
        this.saveSettings(data.settings);
        importedAny = true;
      }

      if (!importedAny) {
        return false;
      }

      this.notifySubscribers();
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  }
}
