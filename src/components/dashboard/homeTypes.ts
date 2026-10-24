import type { MapViewMode, SRSItem, AppSettings, UserStats, TrainingCategory } from '../../core/types';

/** Card attributes the learner can focus a session on. */
export type FocusAttribute = 'capital' | 'capital_to_country' | 'location' | 'country' | 'flag';

/**
 * Every home-page template receives exactly the same props, so a template can be
 * swapped without touching a single line of the surrounding app shell.
 */
export interface HomeViewProps {
  /** Raw SRS card map (key: `${countryId}:${attributeId}`) */
  srsItemsMap: Map<string, SRSItem>;
  /** Aggregate user statistics */
  stats: UserStats;
  /** Persisted app settings */
  settings: AppSettings;
  mapMode: MapViewMode;
  onToggleMapMode: (mode: MapViewMode) => void;
  /** Currently focused attributes (drives the queue composition) */
  selectedAttributes: string[];
  isSyncing: boolean;
  syncStatusMessage: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  onStartSession: (continent: TrainingCategory, attributes: string[], practiceMode?: boolean) => void;
  onOpenAtlas: () => void;
  onOpenArcade: () => void;
  onToggleAttribute: (attribute: FocusAttribute) => void;
  onToggleSound: () => void;
  onSyncGitHub: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onSaveGithubToken: (token: string) => void;
}

/** A drill target rendered by every template as a card / row / tile. */
export interface RegionModel {
  id: TrainingCategory;
  name: string;
  /** Short label used on tight layouts */
  shortName: string;
  emblem: string;
  subtitle: string;
  /** Tightest form of the subtitle, for narrow tiles (e.g. "45 nations") */
  shortSubtitle: string;
  total: number;
  mastered: number;
  recall: number;
  fresh: number;
  /** 0–100 share of mastered cards */
  masteredPct: number;
  /** 0–100 share of cards in active recall */
  recallPct: number;
  isWater: boolean;
  /** True when nothing is due — the template should offer a practice drill instead */
  caughtUp: boolean;
  dueCount: number;
  /** Granular card counts for rich status pills */
  unseenCards: number;
  stage0Cards: number;
  recall0Cards: number;
  recall1Cards: number;
  unlearnedCount: number;
}

export type SpotlightTone = 'mastered' | 'recall' | 'recognition' | 'uncharted';

export interface HomeData {
  mastery: ReturnType<typeof import('../../core/srsEngine').computeMasteryStats>;
  regions: RegionModel[];
  totalDueCount: number;
  isCaughtUp: (category: TrainingCategory) => boolean;
  dueCountFor: (category: TrainingCategory) => number;
  priorityRegion: RegionModel;
  pipeline: {
    mastered: number;
    recall: number;
    recognition: number;
    uncharted: number;
    total: number;
  };
  spotlight: import('../../core/types').Country;
  spotlightStatus: { label: string; tone: SpotlightTone; hint: string };
  totalWorldEntities: number;
  entitiesInMemory: number;
  accuracy: number;
  rank: {
    title: string;
    level: number;
    xp: number;
    nextXP: number;
    /** 0–100 progress towards the next rank */
    progress: number;
  };
  reviewsToday: number;
}

