import { useMemo } from 'react';
import {
  Continent,
  TrainingCategory,
  SRSItem,
  UserStats,
  Country
} from '../../core/types';
import { COUNTRIES } from '../../assets/data/countries';
import { WATER_BODIES } from '../../assets/data/waterBodies';
import { computeMasteryStats } from '../../core/srsEngine';
import type { HomeData, RegionModel, SpotlightTone } from './homeTypes';

const CONTINENT_EMBLEMS: Record<Continent, string> = {
  Europe: '🏛️',
  Asia: '⛩️',
  Africa: '🦁',
  Americas: '🌎',
  Oceania: '🏝️'
};

const CONTINENT_ORDER: Continent[] = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'];

export const TOTAL_WORLD_ENTITIES = COUNTRIES.length + WATER_BODIES.length;

const SPOTLIGHT_COPY: Record<SpotlightTone, { label: string; hint: string }> = {
  mastered: { label: 'Mastered', hint: 'Both cards have graduated to active recall.' },
  recall: { label: 'Active recall', hint: 'One card is being drilled from memory.' },
  recognition: { label: 'Recognition', hint: 'Still on multiple-choice scaffolding.' },
  uncharted: { label: 'Uncharted', hint: 'No card has been drawn for this nation yet.' }
};

/**
 * Splits the due queue by card attribute — used by templates that show a
 * "12 capitals · 6 locations" style breakdown under the launch button.
 */
const isDue = (item: SRSItem | undefined, now: string): boolean => {
  if (!item) return true;
  return item.nextDueAt <= now || item.intervalDays === 0;
};

/**
 * Splits the due queue by card attribute — used by templates that show a
 * "12 capitals · 6 locations" style breakdown under the launch button.
 */
export const useDueBreakdown = (
  srsItemsMap: Map<string, SRSItem>,
  selectedAttributes: string[]
): { capital: number; location: number; total: number } => {
  return useMemo(() => {
    const now = new Date().toISOString();
    let capital = 0;
    let location = 0;
    srsItemsMap.forEach((item) => {
      if (!selectedAttributes.includes(item.attributeId)) return;
      if (!(item.nextDueAt <= now || item.intervalDays === 0)) return;
      if (item.attributeId === 'capital') capital++;
      else if (item.attributeId === 'location') location++;
    });
    return { capital, location, total: capital + location };
  }, [srsItemsMap, selectedAttributes]);
};

/**
 * Derives every number the home page displays from raw persisted state.
 * Templates stay presentational — all business logic lives here.
 */
export const useHomeData = (
  srsItemsMap: Map<string, SRSItem>,
  stats: UserStats,
  selectedAttributes: string[]
): HomeData => {
  return useMemo(() => {
    const now = new Date().toISOString();
    const mastery = computeMasteryStats(srsItemsMap);

    // ── Due counts ───────────────────────────────────────────────────────────
    const dueCountFor = (category: TrainingCategory): number => {
      if (category === 'All') {
        let due = 0;
        srsItemsMap.forEach((item) => {
          if (selectedAttributes.includes(item.attributeId) && isDue(item, now)) due++;
        });
        return due;
      }
      if (category === 'Oceans') {
        let due = 0;
        for (const wb of WATER_BODIES) {
          if (isDue(srsItemsMap.get(`${wb.id}:location`), now)) due++;
        }
        return due;
      }
      let due = 0;
      for (const country of COUNTRIES) {
        if (country.continent !== category) continue;
        for (const attrId of selectedAttributes) {
          if (isDue(srsItemsMap.get(`${country.id}:${attrId}`), now)) due++;
        }
      }
      return due;
    };

    const isCaughtUp = (category: TrainingCategory): boolean => dueCountFor(category) === 0;

    // ── Regional drill models ────────────────────────────────────────────────
    const buildRegion = (
      id: TrainingCategory,
      name: string,
      shortName: string,
      emblem: string,
      subtitle: string,
      shortSubtitle: string,
      counts: { total: number; stage0: number; stage1: number; stage2: number },
      isWater: boolean
    ): RegionModel => {
      const mastered = counts.stage2;
      const recall = counts.stage1;
      const fresh = counts.stage0;
      const pct = (n: number) => (counts.total > 0 ? Math.round((n / counts.total) * 100) : 0);
      return {
        id,
        name,
        shortName,
        emblem,
        subtitle,
        shortSubtitle,
        total: counts.total,
        mastered,
        recall,
        fresh,
        masteredPct: pct(mastered),
        recallPct: pct(recall),
        isWater,
        caughtUp: isCaughtUp(id),
        dueCount: dueCountFor(id)
      };
    };

    const regions: RegionModel[] = [
      ...CONTINENT_ORDER.map((continent) => {
        const b = mastery.breakdown[continent];
        const nations = COUNTRIES.filter((c) => c.continent === continent).length;
        return buildRegion(
          continent,
          continent,
          continent,
          CONTINENT_EMBLEMS[continent] || '🌍',
          `${nations} nations · ${b.total} cards`,
          `${nations} nations`,
          b,
          false
        );
      }),
      buildRegion(
        'Oceans',
        'Oceans & Straits',
        'Oceans',
        '🌊',
        `${WATER_BODIES.length} maritime bodies`,
        `${WATER_BODIES.length} seas`,
        mastery.waterBreakdown || {
          total: WATER_BODIES.length,
          stage0: WATER_BODIES.length,
          stage1: 0,
          stage2: 0
        },
        true
      )
    ];

    // ── Memory pipeline (unique entities by best stage) ───────────────────────
    const entityStages = new Map<string, number>();
    srsItemsMap.forEach((item) => {
      entityStages.set(item.countryId, Math.max(entityStages.get(item.countryId) ?? 0, item.stage));
    });
    let pipMastered = 0;
    let pipRecall = 0;
    let pipRecognition = 0;
    entityStages.forEach((stage) => {
      if (stage === 2) pipMastered++;
      else if (stage === 1) pipRecall++;
      else pipRecognition++;
    });

    // ── Entities the learner has touched at least once ───────────────────────
    const memorySet = new Set<string>();
    srsItemsMap.forEach((item) => {
      if (item.stage > 0) memorySet.add(item.countryId);
    });
    const entitiesInMemory = memorySet.size;

    // ── Daily spotlight nation ───────────────────────────────────────────────
    const activeRecallIds = new Set<string>();
    srsItemsMap.forEach((item) => {
      if (item.stage === 1) activeRecallIds.add(item.countryId);
    });
    const activeList = COUNTRIES.filter((c) => activeRecallIds.has(c.id));
    const dayIndex = Math.floor(Date.now() / 86400000);
    const spotlight: Country =
      activeList.length > 0
        ? activeList[dayIndex % activeList.length]
        : (() => {
            const dayOfYear = Math.floor(
              (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
            );
            return COUNTRIES[dayOfYear % COUNTRIES.length];
          })();

    const capItem = srsItemsMap.get(`${spotlight.id}:capital`);
    const locItem = srsItemsMap.get(`${spotlight.id}:location`);
    const maxStage = Math.max(capItem?.stage ?? -1, locItem?.stage ?? -1);
    const spotlightTone: SpotlightTone =
      maxStage === 2 ? 'mastered' : maxStage === 1 ? 'recall' : maxStage === 0 ? 'recognition' : 'uncharted';

    // ── Rank & XP ────────────────────────────────────────────────────────────
    const xp = stats.totalCorrect * 15 + stats.totalReviews * 5;
    const rank =
      xp > 2500
        ? { title: 'Grand Cartographer', level: 5, nextXP: 5000 }
        : xp > 1200
        ? { title: 'Senior Navigator', level: 4, nextXP: 2500 }
        : xp > 600
        ? { title: 'Lead Explorer', level: 3, nextXP: 1200 }
        : xp > 200
        ? { title: 'Apprentice Surveyor', level: 2, nextXP: 600 }
        : { title: 'Cadet Cartographer', level: 1, nextXP: 200 };

    // ── Cards reviewed in the last 24h ───────────────────────────────────────
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    let reviewsToday = 0;
    srsItemsMap.forEach((item) => {
      if (item.lastReviewedAt && item.lastReviewedAt >= dayAgo) reviewsToday++;
    });

    const totalDueCount = dueCountFor('All');
    const accuracy = stats.totalReviews > 0 ? Math.round((stats.totalCorrect / stats.totalReviews) * 100) : 100;

    return {
      mastery,
      regions,
      totalDueCount,
      isCaughtUp,
      dueCountFor,
      pipeline: {
        mastered: pipMastered,
        recall: pipRecall,
        recognition: pipRecognition,
        uncharted: Math.max(0, TOTAL_WORLD_ENTITIES - (pipMastered + pipRecall + pipRecognition)),
        total: TOTAL_WORLD_ENTITIES
      },
      spotlight,
      spotlightStatus: { ...SPOTLIGHT_COPY[spotlightTone], tone: spotlightTone },
      totalWorldEntities: TOTAL_WORLD_ENTITIES,
      entitiesInMemory,
      accuracy,
      rank: {
        title: rank.title,
        level: rank.level,
        xp,
        nextXP: rank.nextXP,
        progress: Math.min(100, Math.round((xp / rank.nextXP) * 100))
      },
      reviewsToday
    };
  }, [srsItemsMap, stats, selectedAttributes]);
};
