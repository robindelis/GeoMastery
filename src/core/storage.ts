import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SRSItem, UserStats, AppSettings } from './types';
import { computeMasteryStats, calibrateSRSItem } from './srsEngine';

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
  private static cloudSyncTimeout: any = null;
  private static focusListenerAttached = false;

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

  /**
   * Resolves the GitHub token from user settings or build-time obfuscated mask (.env.local)
   * so both Phone -> Desktop and Desktop -> Phone two-way sync work out of the box.
   */
  private static getResolvedGitHubToken(overrideToken?: string): string {
    const explicit = (overrideToken ?? this.loadSettings().githubSyncToken ?? '').trim();
    if (explicit) return explicit;

    try {
      const mask = (import.meta as any)?.env?.VITE_GH_SYNC_MASK;
      if (typeof mask === 'string' && mask.length > 0 && mask.length % 2 === 0) {
        const key = 'geomastery-sync-2026';
        let out = '';
        for (let i = 0; i < mask.length; i += 2) {
          const byte = parseInt(mask.slice(i, i + 2), 16);
          const kChar = key.charCodeAt((i / 2) % key.length);
          out += String.fromCharCode(byte ^ kChar);
        }
        return out.trim();
      }
    } catch {
      // Ignore if env not present
    }
    return '';
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
   * Returns the exact millisecond timestamp of the most recent review event for an SRSItem.
   * Uses both `lastReviewedAt` and the `history` log.
   */
  public static getItemEventTimestamp(item?: SRSItem): number {
    if (!item) return 0;
    let maxTs = 0;
    if (item.lastReviewedAt) {
      const parsed = Date.parse(item.lastReviewedAt);
      if (!Number.isNaN(parsed) && parsed > maxTs) {
        maxTs = parsed;
      }
    }
    if (Array.isArray(item.history)) {
      for (const entry of item.history) {
        if (entry?.timestamp) {
          const parsedHist = Date.parse(entry.timestamp);
          if (!Number.isNaN(parsedHist) && parsedHist > maxTs) {
            maxTs = parsedHist;
          }
        }
      }
    }
    return maxTs;
  }

  /**
   * Returns the latest event timestamp across an entire dataset (all SRS items + stats.updatedAt).
   */
  public static getDatasetEventTimestamp(itemsMap: Map<string, SRSItem>, stats?: UserStats): number {
    let maxTs = 0;
    if (stats?.updatedAt) {
      const parsed = Date.parse(stats.updatedAt);
      if (!Number.isNaN(parsed) && parsed > maxTs) {
        maxTs = parsed;
      }
    }
    itemsMap.forEach((item) => {
      const ts = this.getItemEventTimestamp(item);
      if (ts > maxTs) maxTs = ts;
    });
    return maxTs;
  }

  /**
   * Recomputes continentMastery counts directly from the given SRS items map so that
   * promotions AND demotions (e.g., 1/2 -> 0/2 or Stage 2 -> Stage 1) are always reflected accurately.
   */
  private static buildContinentMasteryFromItems(itemsMap: Map<string, SRSItem>): UserStats['continentMastery'] {
    const mastery = computeMasteryStats(itemsMap);
    return {
      Africa: {
        total: mastery.breakdown.Africa.total,
        mastered: mastery.breakdown.Africa.stage2,
        learning: mastery.breakdown.Africa.stage1
      },
      Americas: {
        total: mastery.breakdown.Americas.total,
        mastered: mastery.breakdown.Americas.stage2,
        learning: mastery.breakdown.Americas.stage1
      },
      Asia: {
        total: mastery.breakdown.Asia.total,
        mastered: mastery.breakdown.Asia.stage2,
        learning: mastery.breakdown.Asia.stage1
      },
      Europe: {
        total: mastery.breakdown.Europe.total,
        mastered: mastery.breakdown.Europe.stage2,
        learning: mastery.breakdown.Europe.stage1
      },
      Oceania: {
        total: mastery.breakdown.Oceania.total,
        mastered: mastery.breakdown.Oceania.stage2,
        learning: mastery.breakdown.Oceania.stage1
      }
    };
  }

  /**
   * Reconciles an external progress payload (from disk, bundled cloud-progress.json, or GitHub)
   * item-by-item with local storage using STRICT EVENT TIMESTAMPS (Last-Write-Wins per card).
   *
   * Crucial rule: A more recent review event ALWAYS wins, even if it demoted a card's stage
   * (Stage 2 -> 1) or reset `consecutiveRecallCorrect` from 1/2 back to 0/2.
   */
  public static reconcileExternalData(externalData: any): boolean {
    if (!externalData || typeof externalData !== 'object') return false;

    const localItems = this.loadSRSItems();
    const extItems = Array.isArray(externalData.srsItems)
      ? new Map<string, SRSItem>(externalData.srsItems)
      : new Map<string, SRSItem>();

    const extStats: UserStats | undefined = externalData.stats;
    const localStats = this.loadStats();

    if (extItems.size > 0 && localItems.size === 0) {
      this.saveSRSItems(extItems);
      const baseStats = extStats ? { ...localStats, ...extStats } : localStats;
      baseStats.continentMastery = this.buildContinentMasteryFromItems(extItems);
      this.saveStats(baseStats);
      if (externalData.settings) {
        const currentSettings = this.loadSettings();
        this.saveSettings({
          ...externalData.settings,
          geminiApiKey: currentSettings.geminiApiKey || externalData.settings.geminiApiKey || '',
          githubSyncToken: currentSettings.githubSyncToken || externalData.settings.githubSyncToken || ''
        });
      }
      this.notifySubscribers();
      return true;
    }

    const localDatasetTimeBefore = this.getDatasetEventTimestamp(localItems, localStats);
    const extDatasetTime = this.getDatasetEventTimestamp(extItems, extStats);

    let changed = false;
    const mergedItems = new Map<string, SRSItem>(localItems);

    extItems.forEach((extItem, id) => {
      if (!extItem || typeof extItem !== 'object' || !('stage' in extItem)) return;
      const localItem = mergedItems.get(id);
      if (!localItem) {
        mergedItems.set(id, extItem);
        changed = true;
        return;
      }

      const extTime = this.getItemEventTimestamp(extItem);
      const localTime = this.getItemEventTimestamp(localItem);

      if (extTime > 0 || localTime > 0) {
        // Strict event-time comparison: most recent review event wins unconditionally
        if (extTime > localTime) {
          mergedItems.set(id, extItem);
          changed = true;
        } else if (extTime === localTime) {
          // Tie-breaker only if millisecond timestamps are identical: total review events (reps + lapses)
          const extEvents = (extItem.reps || 0) + (extItem.lapses || 0);
          const localEvents = (localItem.reps || 0) + (localItem.lapses || 0);
          if (extEvents > localEvents) {
            mergedItems.set(id, extItem);
            changed = true;
          }
        }
        // When extTime < localTime, localItem is newer -> keep localItem untouched!
      } else {
        // Legacy fallback when neither item has any timestamp at all
        const extEvents = (extItem.reps || 0) + (extItem.lapses || 0);
        const localEvents = (localItem.reps || 0) + (localItem.lapses || 0);
        if (extEvents > localEvents) {
          mergedItems.set(id, extItem);
          changed = true;
        }
      }
    });

    if (extStats && typeof extStats.totalReviews === 'number') {
      const extReviews = extStats.totalReviews || 0;
      const localReviews = localStats.totalReviews || 0;
      const extIsMoreRecent = extDatasetTime > localDatasetTimeBefore;

      if (extIsMoreRecent || extReviews > localReviews) {
        const newerStats = extIsMoreRecent ? extStats : localStats;
        const mergedTimeAttack = {
          ...(localStats.timeAttackRecords || {}),
          ...(extStats.timeAttackRecords || {})
        };
        const updatedStats: UserStats = {
          ...localStats,
          ...extStats,
          currentStreak: newerStats.currentStreak ?? Math.max(localStats.currentStreak || 0, extStats.currentStreak || 0),
          lastReviewDate: newerStats.lastReviewDate ?? localStats.lastReviewDate ?? extStats.lastReviewDate,
          updatedAt:
            extDatasetTime > localDatasetTimeBefore
              ? extStats.updatedAt || new Date(extDatasetTime).toISOString()
              : localStats.updatedAt,
          totalReviews: Math.max(localReviews, extReviews),
          totalCorrect: Math.max(localStats.totalCorrect || 0, extStats.totalCorrect || 0),
          longestStreak: Math.max(localStats.longestStreak || 0, extStats.longestStreak || 0),
          continentMastery: this.buildContinentMasteryFromItems(mergedItems),
          timeAttackRecords: mergedTimeAttack
        };
        this.saveStats(updatedStats);
        changed = true;
      } else if (changed) {
        this.saveStats({
          ...localStats,
          continentMastery: this.buildContinentMasteryFromItems(mergedItems)
        });
      }
    } else if (changed) {
      this.saveStats({
        ...localStats,
        continentMastery: this.buildContinentMasteryFromItems(mergedItems)
      });
    }

    if (changed) {
      this.saveSRSItems(mergedItems);
      this.notifySubscribers();
    }

    return changed;
  }

  /**
   * Determines whether local storage contains any item or stat event more recent than `remoteData`.
   */
  public static hasLocalNewerEvents(remoteData: any): boolean {
    if (!remoteData || typeof remoteData !== 'object') return true;

    const localItems = this.loadSRSItems();
    const remoteItems = Array.isArray(remoteData.srsItems)
      ? new Map<string, SRSItem>(remoteData.srsItems)
      : new Map<string, SRSItem>();

    if (localItems.size > remoteItems.size) return true;

    for (const [id, localItem] of localItems.entries()) {
      const rItem = remoteItems.get(id);
      if (!rItem) return true;
      const localTime = this.getItemEventTimestamp(localItem);
      const remoteTime = this.getItemEventTimestamp(rItem);
      if (localTime > remoteTime) return true;
      if (localTime === remoteTime) {
        const localEvents = (localItem.reps || 0) + (localItem.lapses || 0);
        const remoteEvents = (rItem.reps || 0) + (rItem.lapses || 0);
        if (localEvents > remoteEvents) return true;
      }
    }

    const localStats = this.loadStats();
    const remoteStats: UserStats | undefined = remoteData.stats;
    if ((localStats.totalReviews || 0) > (remoteStats?.totalReviews || 0)) {
      return true;
    }

    return false;
  }

  /**
   * Initializes persistent sync between disk file (Electron or Android native storage),
   * bundled offline seed, and live two-way GitHub cloud progress.
   */
  public static async initPersistentSync(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    let anyChanged = false;

    if (this.hasNativeStorageBridge()) {
      try {
        const res = await this.loadNativeData();
        if (res.success && res.data) {
          const changed = this.reconcileExternalData(res.data);
          if (changed) anyChanged = true;
          this.syncToDiskNow();
        } else {
          this.syncToDiskNow();
        }
      } catch (err) {
        console.error('Failed to sync persistent disk storage:', err);
      }
    }

    // In real browser / Android WebView / Electron environments:
    if (typeof window.location?.href === 'string' && typeof fetch !== 'undefined') {
      // Only load the static ./cloud-progress.json bundle as an initial offline seed if storage is completely empty
      if (this.loadSRSItems().size === 0) {
        try {
          const bundledRes = await fetch('./cloud-progress.json', { cache: 'no-store' });
          if (bundledRes.ok) {
            const bundledData = await bundledRes.json();
            if (this.reconcileExternalData(bundledData)) {
              anyChanged = true;
            }
          }
        } catch {
          // Ignore if offline or bundled file unavailable
        }
      }

      // Live two-way GitHub sync on boot (pulls newer remote events AND pushes any newer local events)
      this.syncWithGitHub().catch(() => {});

      // Attach window focus / visibility listener once so switching between Phone and Desktop auto-syncs
      if (!this.focusListenerAttached && typeof window.addEventListener === 'function') {
        this.focusListenerAttached = true;
        window.addEventListener('focus', () => {
          this.syncWithGitHub().catch(() => {});
        });
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              this.syncWithGitHub().catch(() => {});
            }
          });
        }
      }
    }

    return anyChanged;
  }

  /**
   * Two-way time-based synchronization with GitHub (robindelis/GeoMastery/public/cloud-progress.json).
   * 1. Pulls the latest remote progress via the real-time GitHub Contents API (zero CDN lag).
   * 2. Reconciles item-by-item using strict event timestamps (`lastReviewedAt`).
   * 3. If local storage has any newer review events than GitHub, pushes the merged state back to GitHub.
   */
  public static async syncWithGitHub(options?: {
    pullOnly?: boolean;
    githubToken?: string;
  }): Promise<{
    success: boolean;
    pulledChanged: boolean;
    pushed: boolean;
    totalItems: number;
    totalReviews: number;
    message: string;
  }> {
    const GITHUB_RAW_URL = `https://raw.githubusercontent.com/robindelis/GeoMastery/main/public/cloud-progress.json?t=${Date.now()}`;
    const GITHUB_API_URL = 'https://api.github.com/repos/robindelis/GeoMastery/contents/public/cloud-progress.json';

    let pulledChanged = false;
    let remoteSha: string | undefined;
    let remoteData: any = null;
    let pullSucceeded = false;

    const token = this.getResolvedGitHubToken(options?.githubToken);

    // 1. Pull latest from GitHub Contents API (real-time, no CDN cache lag)
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json'
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const apiRes = await fetch(`${GITHUB_API_URL}?t=${Date.now()}`, {
        headers,
        cache: 'no-store'
      });
      if (apiRes.ok) {
        const meta = await apiRes.json();
        remoteSha = meta.sha;
        if (typeof meta.content === 'string') {
          const binary = atob(meta.content.replace(/\s/g, ''));
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          const jsonText = new TextDecoder('utf-8').decode(bytes);
          remoteData = JSON.parse(jsonText);
          pulledChanged = this.reconcileExternalData(remoteData);
          pullSucceeded = true;
        }
      }
    } catch {
      // Fallback to raw.githubusercontent.com below
    }

    if (!pullSucceeded) {
      try {
        const rawRes = await fetch(GITHUB_RAW_URL, { cache: 'no-store' });
        if (rawRes.ok) {
          remoteData = await rawRes.json();
          pulledChanged = this.reconcileExternalData(remoteData);
          pullSucceeded = true;
        }
      } catch (err) {
        console.warn('GitHub raw pull failed:', err);
      }
    }

    const currentItems = this.loadSRSItems();
    const currentStats = this.loadStats();

    if (options?.pullOnly) {
      return {
        success: pullSucceeded,
        pulledChanged,
        pushed: false,
        totalItems: currentItems.size,
        totalReviews: currentStats.totalReviews,
        message: pullSucceeded
          ? `Synced with GitHub (${currentItems.size} items • ${currentStats.totalReviews} reviews)`
          : 'Offline — using local progress'
      };
    }

    // Check if our merged local state has any events newer than what was on GitHub
    const localHasNewer = this.hasLocalNewerEvents(remoteData);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      srsItems: Array.from(currentItems.entries()),
      stats: currentStats,
      settings: {
        ...this.loadSettings(),
        geminiApiKey: '',
        githubSyncToken: ''
      }
    };

    // 2. Push merged state to GitHub via REST Contents API (works on both Android Phone and Desktop!)
    if (token && remoteSha && localHasNewer) {
      try {
        const jsonStr = JSON.stringify(payload, null, 2);
        const utf8Bytes = new TextEncoder().encode(jsonStr);
        let binary = '';
        for (let i = 0; i < utf8Bytes.length; i++) {
          binary += String.fromCharCode(utf8Bytes[i]);
        }
        const base64Content = btoa(binary);

        const putRes = await fetch(GITHUB_API_URL, {
          method: 'PUT',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Sync user progression data (${currentStats.totalReviews} reviews)`,
            content: base64Content,
            sha: remoteSha,
            branch: 'main'
          })
        });

        if (putRes.ok) {
          return {
            success: true,
            pulledChanged,
            pushed: true,
            totalItems: currentItems.size,
            totalReviews: currentStats.totalReviews,
            message: `Synced & pushed to GitHub (${currentItems.size} items • ${currentStats.totalReviews} reviews)`
          };
        }
      } catch (err) {
        console.error('GitHub API push failed:', err);
      }
    }

    // 3. Fallback push via Electron git bridge on Desktop if REST push wasn't used
    if (localHasNewer && typeof window !== 'undefined' && window.electronAPI?.syncGitHubProgress) {
      try {
        const pushRes = await window.electronAPI.syncGitHubProgress(payload);
        if (pushRes.success) {
          return {
            success: true,
            pulledChanged,
            pushed: Boolean(pushRes.pushed),
            totalItems: currentItems.size,
            totalReviews: currentStats.totalReviews,
            message: pushRes.pushed
              ? `Synced & pushed to GitHub (${currentItems.size} items • ${currentStats.totalReviews} reviews)`
              : `Up to date with GitHub (${currentItems.size} items • ${currentStats.totalReviews} reviews)`
          };
        }
      } catch (err) {
        console.error('Electron GitHub push failed:', err);
      }
    }

    return {
      success: pullSucceeded,
      pulledChanged,
      pushed: false,
      totalItems: currentItems.size,
      totalReviews: currentStats.totalReviews,
      message: pullSucceeded
        ? pulledChanged
          ? `Pulled latest from GitHub (${currentItems.size} items • ${currentStats.totalReviews} reviews)`
          : `Up to date with GitHub (${currentItems.size} items • ${currentStats.totalReviews} reviews)`
        : 'Could not reach GitHub — check internet connection'
    };
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

  private static scheduleCloudSync(): void {
    if (typeof window === 'undefined' || typeof window.location?.href !== 'string') return;
    if (this.cloudSyncTimeout) clearTimeout(this.cloudSyncTimeout);
    this.cloudSyncTimeout = setTimeout(() => {
      this.syncWithGitHub().catch(() => {});
    }, 2500);
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
      return new Map(parsed.map(([id, item]) => [id, calibrateSRSItem(item)]));
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
      this.notifySubscribers();
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
    stats.updatedAt = now.toISOString();
    stats.continentMastery = this.buildContinentMasteryFromItems(this.loadSRSItems());

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
    this.scheduleCloudSync();
    return stats;
  }

  /**
   * Reconciles a previously recorded incorrect review into a correct one
   * (e.g. user miss-clicked and chose 'I was right').
   * Increments totalCorrect (capped at totalReviews) and recomputes continent mastery.
   */
  public static correctLastReviewEvent(): UserStats {
    const stats = this.loadStats();
    const now = new Date();
    if (stats.totalCorrect < stats.totalReviews) {
      stats.totalCorrect += 1;
    }
    stats.updatedAt = now.toISOString();
    stats.continentMastery = this.buildContinentMasteryFromItems(this.loadSRSItems());

    this.saveStats(stats);
    this.scheduleCloudSync();
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
