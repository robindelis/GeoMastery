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
import { computeMasteryStats, classifyCardHorizon } from '../../core/srsEngine';
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
 * 10-Tier Cartographic Progression System with dynamic high-level scaling.
 */
export function calculateCartographerRank(xp: number): {
  title: string;
  level: number;
  xp: number;
  nextXP: number;
  progress: number;
} {
  const TIERS = [
    { level: 1, minXP: 0, nextXP: 200, title: 'Cadet Cartographer' },
    { level: 2, minXP: 200, nextXP: 600, title: 'Apprentice Surveyor' },
    { level: 3, minXP: 600, nextXP: 1500, title: 'Field Topographer' },
    { level: 4, minXP: 1500, nextXP: 3000, title: 'Senior Navigator' },
    { level: 5, minXP: 3000, nextXP: 6000, title: 'Master Mariner' },
    { level: 6, minXP: 6000, nextXP: 10000, title: 'Royal Geographer' },
    { level: 7, minXP: 10000, nextXP: 15000, title: 'Grand Cartographer' },
    { level: 8, minXP: 15000, nextXP: 22500, title: 'Imperial Cosmographer' },
    { level: 9, minXP: 22500, nextXP: 32000, title: 'Arch-Atlas Laureate' }
  ];

  for (const tier of TIERS) {
    if (xp < tier.nextXP) {
      const progress = Math.min(
        100,
        Math.max(4, Math.round(((xp - tier.minXP) / (tier.nextXP - tier.minXP)) * 100))
      );
      return {
        title: tier.title,
        level: tier.level,
        xp,
        nextXP: tier.nextXP,
        progress
      };
    }
  }

  // Level 10+: Above 32,000 XP scale dynamically every 15,000 XP
  const overflow = xp - 32000;
  const extraLevels = Math.floor(overflow / 15000);
  const level = 10 + extraLevels;
  const minXP = 32000 + extraLevels * 15000;
  const nextXP = minXP + 15000;
  const progress = Math.min(100, Math.max(4, Math.round(((xp - minXP) / 15000) * 100)));

  return {
    title: 'Sovereign of the Meridian',
    level,
    xp,
    nextXP,
    progress
  };
}

/**
 * Splits the due queue by card attribute — used by templates that show a
 * "12 capitals · 6 locations" style breakdown under the launch button.
 * Matches regional due count calculations by inspecting all eligible entities.
 */
export const useDueBreakdown = (
  srsItemsMap: Map<string, SRSItem>,
  selectedAttributes: string[]
): { capital: number; location: number; total: number } => {
  return useMemo(() => {
    const now = new Date().toISOString();
    let capital = 0;
    let location = 0;

    for (const country of COUNTRIES) {
      if (
        selectedAttributes.includes('capital') &&
        isDue(srsItemsMap.get(`${country.id}:capital`), now)
      ) {
        capital++;
      }
      if (
        selectedAttributes.includes('location') &&
        isDue(srsItemsMap.get(`${country.id}:location`), now)
      ) {
        location++;
      }
    }

    if (selectedAttributes.includes('location')) {
      for (const wb of WATER_BODIES) {
        if (isDue(srsItemsMap.get(`${wb.id}:location`), now)) {
          location++;
        }
      }
    }

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
        for (const country of COUNTRIES) {
          for (const attrId of selectedAttributes) {
            if (isDue(srsItemsMap.get(`${country.id}:${attrId}`), now)) due++;
          }
        }
        if (selectedAttributes.includes('location')) {
          for (const wb of WATER_BODIES) {
            if (isDue(srsItemsMap.get(`${wb.id}:location`), now)) due++;
          }
        }
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
      isWater: boolean,
      granular: {
        unseenCards: number;
        stage0Cards: number;
        recall0Cards: number;
        recall1Cards: number;
      }
    ): RegionModel => {
      const mastered = counts.stage2;
      const recall = counts.stage1;
      const fresh = counts.stage0;
      const pct = (n: number) => (counts.total > 0 ? Math.round((n / counts.total) * 100) : 0);
      const unlearnedCount = granular.unseenCards + granular.stage0Cards + granular.recall0Cards;

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
        dueCount: dueCountFor(id),
        unseenCards: granular.unseenCards,
        stage0Cards: granular.stage0Cards,
        recall0Cards: granular.recall0Cards,
        recall1Cards: granular.recall1Cards,
        unlearnedCount
      };
    };

    const regions: RegionModel[] = [
      ...CONTINENT_ORDER.map((continent) => {
        const b = mastery.breakdown[continent];
        const continentCountries = COUNTRIES.filter((c) => c.continent === continent);
        const nations = continentCountries.length;

        let unseenCards = 0;
        let stage0Cards = 0;
        let recall0Cards = 0;
        let recall1Cards = 0;

        for (const country of continentCountries) {
          for (const attrId of ['capital', 'location']) {
            const item = srsItemsMap.get(`${country.id}:${attrId}`);
            const bucket = classifyCardHorizon(item);
            if (bucket === 'unseen') {
              unseenCards++;
            } else if (item && item.stage === 0) {
              stage0Cards++;
            } else if (bucket === 'learning') {
              recall0Cards++;
            } else if (bucket === 'recall') {
              recall1Cards++;
            }
          }
        }

        return buildRegion(
          continent,
          continent,
          continent,
          CONTINENT_EMBLEMS[continent] || '🌍',
          `${nations} nations · ${b.total} cards`,
          `${nations} nations`,
          b,
          false,
          { unseenCards, stage0Cards, recall0Cards, recall1Cards }
        );
      }),
      (() => {
        let unseenCards = 0;
        let stage0Cards = 0;
        let recall0Cards = 0;
        let recall1Cards = 0;

        for (const wb of WATER_BODIES) {
          const item = srsItemsMap.get(`${wb.id}:location`);
          const bucket = classifyCardHorizon(item);
          if (bucket === 'unseen') {
            unseenCards++;
          } else if (item && item.stage === 0) {
            stage0Cards++;
          } else if (bucket === 'learning') {
            recall0Cards++;
          } else if (bucket === 'recall') {
            recall1Cards++;
          }
        }

        return buildRegion(
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
          true,
          { unseenCards, stage0Cards, recall0Cards, recall1Cards }
        );
      })()
    ];

    // Priority Region: Find region with most unlearned cards (or lowest mastery %)
    let priorityRegion = regions[0];
    let highestDeficit = -1;
    for (const reg of regions) {
      if (reg.unlearnedCount > highestDeficit) {
        highestDeficit = reg.unlearnedCount;
        priorityRegion = reg;
      }
    }

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
    const rank = calculateCartographerRank(xp);

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
      priorityRegion,
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
      rank,
      reviewsToday
    };
  }, [srsItemsMap, stats, selectedAttributes]);
};

