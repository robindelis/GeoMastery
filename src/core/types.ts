export type Continent = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania';
export type TrainingCategory = 'All' | Continent | 'Oceans';

export type { WaterBody, WaterBodyType } from '../assets/data/waterBodies';

export interface Country {
  id: string; // ISO 3166-1 alpha-3, e.g. "FRA"
  numericId: string; // ISO 3166-1 numeric, e.g. "250"
  iso2: string; // ISO 3166-1 alpha-2, e.g. "FR"
  name: string; // Common English name
  officialName: string;
  continent: Continent | 'Oceans';
  subregion: string;
  capital: string;
  coordinates: [number, number]; // [lng, lat]
  capitalCoordinates: [number, number]; // [lng, lat]
  flagEmoji: string;
  facts: {
    politicalRegime?: string;
    leader?: string;
    headOfState?: string;
    headOfGovernment?: string;
    cuisine?: string;
    currency?: string;
    languages?: string[];
    [key: string]: any;
  };
  areaKm2?: number;
  population?: number;
}

export type InputMode = 'multiple_choice' | 'typing' | 'map_click';

export interface AttributeValidationResult {
  isCorrect: boolean;
  score: number; // 0 to 1
  matchedText?: string;
  feedback?: string;
}

export interface AttributeDefinition<T = any> {
  id: string;
  label: string;
  category: 'geography' | 'politics' | 'culture' | 'economics';
  icon: string;
  description: string;
  activeByDefault: boolean;
  supportsMultipleChoice: boolean;
  supportsTypingRecall: boolean;
  supportsMapClick: boolean;
  promptTemplate: (country: Country) => string;
  getValue: (country: Country) => T;
  renderValue: (val: T) => string;
  generateDistractors: (target: Country, all: Country[], count?: number) => string[];
  validateAnswer: (userAnswer: string, correctValue: T, targetCountry?: Country, tolerance?: number) => AttributeValidationResult;
}

export type SRSStage = 0 | 1 | 2; // 0: New / Multiple-Choice Scaffolding; 1: Learning / Typing Active Recall; 2: Mastered

/**
 * FSRS / ACT-R implicit retrieval grade derived from accuracy + response latency:
 * 1 = Again (Fail)
 * 2 = Hard (Correct, high latency / effortful recall)
 * 3 = Good (Correct, normal latency)
 * 4 = Easy (Correct, fast automatic fluency)
 */
export type FSRSGrade = 1 | 2 | 3 | 4;

export interface SRSHistoryEntry {
  timestamp: string;
  inputMode: InputMode;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
  grade?: FSRSGrade;
}

export interface SRSItem {
  id: string; // `${countryId}:${attributeId}`
  countryId: string;
  attributeId: string;
  stage: SRSStage;
  step: number;
  consecutiveRecallCorrect?: number; // Consecutive successful active recall answers (needs 2 to master)
  easeFactor: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  lastReviewedAt: string | null;
  nextDueAt: string;
  history: SRSHistoryEntry[];
  /** FSRS-6 DSR Memory Difficulty D in [1, 10] (optional for backwards compatibility) */
  difficulty?: number;
  /** FSRS-6 DSR Memory Stability S in days at 90% retrievability (optional for backwards compatibility) */
  stability?: number;
  /** ACT-R latency-derived grade on the most recent review */
  lastLatencyGrade?: FSRSGrade;
  /** IDs of countries or capitals confused with this card (LECTOR spatial/semantic interference) */
  confusedWith?: string[];
}

export type MapViewMode = '2d' | '3d';

export interface UserStats {
  totalReviews: number;
  totalCorrect: number;
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  updatedAt?: string;
  continentMastery: Record<Continent, { total: number; mastered: number; learning: number }>;
  timeAttackRecords: Record<string, { highStreak: number; bestTimeSeconds: number; date: string }>;
}

export type TTSProvider = 'google-stream' | 'gemini-tts' | 'web-speech';

export interface AppSettings {
  audioEnabled: boolean;
  soundVolume: number;
  mapMode: MapViewMode;
  autoRotateGlobe: boolean;
  showMapCountryLabels: boolean;
  typingFuzzyTolerance: number; // 0 (strict) to 2
  ttsProvider?: TTSProvider;
  geminiApiKey?: string;
  geminiVoice?: string;
  githubSyncToken?: string;
}
