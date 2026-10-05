import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import waterBodies50m from '../assets/geo/water-bodies-50m.json';
import { WATER_BODIES, getWaterBodyById, WATER_BODIES_BY_ID } from '../assets/data/waterBodies';
import {
  waterBodyToCountry,
  buildQuestion,
  prepareSessionQueue,
  computeMasteryStats,
  createInitialSRSItem,
  processAnswer
} from './srsEngine';
import { SRSItem } from './types';

describe('Water Bodies & Maritime Hydrography Dataset', () => {
  it('contains exactly 40 curated major oceans, seas, straits, and gulfs', () => {
    expect(WATER_BODIES.length).toBe(40);
  });

  it('contains all 5 global oceans', () => {
    const oceans = WATER_BODIES.filter((w) => w.type === 'ocean');
    expect(oceans.length).toBe(5);
    const names = oceans.map((o) => o.name);
    expect(names).toContain('Pacific Ocean');
    expect(names).toContain('Atlantic Ocean');
    expect(names).toContain('Indian Ocean');
    expect(names).toContain('Arctic Ocean');
    expect(names).toContain('Southern Ocean');
  });

  it('contains critical straits and canals', () => {
    const straits = WATER_BODIES.filter((w) => w.type === 'strait' || w.type === 'channel');
    expect(straits.length).toBeGreaterThanOrEqual(12);
    const names = straits.map((s) => s.name);
    expect(names).toContain('Strait of Gibraltar');
    expect(names).toContain('Strait of Hormuz');
    expect(names).toContain('Strait of Malacca');
    expect(names).toContain('Bosporus Strait');
    expect(names).toContain('Dardanelles Strait');
    expect(names).toContain('Bab-el-Mandeb Strait');
    expect(names).toContain('English Channel');
    expect(names).toContain('Suez Canal');
    expect(names).toContain('Panama Canal');
  });

  it('has valid coordinates for all water bodies within [-180, 180] lng and [-90, 90] lat', () => {
    for (const wb of WATER_BODIES) {
      expect(wb.id).toMatch(/^WATER_/);
      expect(wb.coordinates).toHaveLength(2);
      const [lng, lat] = wb.coordinates;
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(wb.name.length).toBeGreaterThan(0);
      expect(wb.significance.length).toBeGreaterThan(0);
    }
  });

  it('guarantees unique IDs across all entries', () => {
    const idSet = new Set(WATER_BODIES.map((w) => w.id));
    expect(idSet.size).toBe(WATER_BODIES.length);
  });

  it('retrieves entries accurately via getWaterBodyById', () => {
    const gibraltar = getWaterBodyById('WATER_STRAIT_GIBRALTAR');
    expect(gibraltar).toBeDefined();
    expect(gibraltar?.name).toBe('Strait of Gibraltar');
    expect(gibraltar?.type).toBe('strait');
    expect(gibraltar?.significance).toContain('Atlantic Ocean');
  });

  it('provides authentic boundary-accurate TopoJSON polygons for all 40 water bodies in water-bodies-50m.json', () => {
    const geo = feature(waterBodies50m as any, (waterBodies50m as any).objects.water_bodies) as any;
    expect(geo.features.length).toBe(40);

    const proj = d3.geoNaturalEarth1().scale(960 / 5.8).translate([960 / 2, 540 / 2 + 10]);
    const pathGen = d3.geoPath().projection(proj);

    const featureMap = new Map<string, any>(geo.features.map((f: any) => [f.id, f]));

    for (const wb of WATER_BODIES) {
      const feat = featureMap.get(wb.id);
      expect(feat, `Feature for ${wb.id} (${wb.name}) should exist in TopoJSON`).toBeDefined();
      expect(['Polygon', 'MultiPolygon']).toContain(feat.geometry.type);
      expect(feat.geometry.coordinates.length).toBeGreaterThan(0);

      // Verify no coordinates exceed geographic spherical limits [-180, 180] and [-90, 90]
      const checkCoords = (coords: any) => {
        if (typeof coords[0] === 'number') {
          const [lng, lat] = coords;
          expect(lng).toBeGreaterThanOrEqual(-180);
          expect(lng).toBeLessThanOrEqual(180);
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
        } else {
          coords.forEach(checkCoords);
        }
      };
      checkCoords(feat.geometry.coordinates);

      // Verify D3 Natural Earth SVG path generation
      const pathD = pathGen(feat);
      expect(pathD, `D3 path for ${wb.id} should generate a valid SVG path`).toBeTruthy();
      expect(pathD!.length).toBeGreaterThan(10);

      // Strict boundaries verification:
      // Arctic Ocean must be strictly bounded in the far north (Y <= 150 on 960x540 viewport, lat >= 60°N)
      // and must never span across the prime meridian down to the South Pole (Y > 200).
      if (wb.id === 'WATER_OCEAN_ARCTIC') {
        const matches = [...pathD!.matchAll(/([0-9.-]+),([0-9.-]+)/g)];
        const highYPoints = matches.filter((m) => parseFloat(m[2]) > 200);
        const maxY = Math.max(...matches.map((m) => parseFloat(m[2])));
        expect(highYPoints.length, 'Arctic Ocean SVG path must have zero points with Y > 200').toBe(0);
        expect(maxY, 'Arctic Ocean SVG path maxY must stay in the northern hemisphere').toBeLessThan(150);
        const bounds = d3.geoBounds(feat);
        expect(bounds[0][1], 'Arctic Ocean minLat must be strictly in northern high latitudes').toBeGreaterThanOrEqual(60);
      }

      // Indian Ocean, Pacific Ocean, and Atlantic Ocean must strictly stay north of 60.5°S and not spill into Antarctica
      if (wb.id === 'WATER_OCEAN_INDIAN' || wb.id === 'WATER_OCEAN_PACIFIC' || wb.id === 'WATER_OCEAN_ATLANTIC') {
        const matches = [...pathD!.matchAll(/([0-9.-]+),([0-9.-]+)/g)];
        const maxY = Math.max(...matches.map((m) => parseFloat(m[2])));
        expect(maxY, `${wb.id} SVG path maxY must not bleed into Antarctica (< 456)`).toBeLessThanOrEqual(456);
        const bounds = d3.geoBounds(feat);
        expect(bounds[0][1], `${wb.id} minLat must not bleed into Antarctica (>= -61°)`).toBeGreaterThanOrEqual(-61);
      }

      // Southern Ocean must strictly stay in Antarctic waters south of 60°S (minY >= 453, maxLat <= -60)
      if (wb.id === 'WATER_OCEAN_SOUTHERN') {
        const matches = [...pathD!.matchAll(/([0-9.-]+),([0-9.-]+)/g)];
        const minY = Math.min(...matches.map((m) => parseFloat(m[2])));
        expect(minY, 'Southern Ocean SVG path minY must stay in southern polar region (>= 453)').toBeGreaterThanOrEqual(453);
        const bounds = d3.geoBounds(feat);
        expect(bounds[1][1], 'Southern Ocean maxLat must stay south of 60°S').toBeLessThanOrEqual(-60);
      }

      // Mediterranean Sea must not leak into Japan / Eastern Asia (X <= 600)
      if (wb.id === 'WATER_SEA_MEDITERRANEAN') {
        const matches = [...pathD!.matchAll(/([0-9.-]+),([0-9.-]+)/g)];
        const maxX = Math.max(...matches.map((m) => parseFloat(m[1])));
        expect(maxX, 'Mediterranean Sea SVG path maxX must stay in Europe/Levant (< 600)').toBeLessThan(600);
      }
    }
  });

  it('guarantees zero mutual polygon overlap among all 5 global oceans across a global grid', () => {
    const geo = feature(waterBodies50m as any, (waterBodies50m as any).objects.water_bodies) as any;
    const oceans = geo.features
      .filter((f: any) => f.id.startsWith('WATER_OCEAN_'))
      .map((f: any) => {
        const b = d3.geoBounds(f);
        return {
          id: f.id,
          feat: f,
          bbox: [b[0][0], b[0][1], b[1][0], b[1][1]],
          cross: b[0][0] > b[1][0]
        };
      });
    expect(oceans.length).toBe(5);

    let overlapCount = 0;
    for (let lat = -86; lat <= 86; lat += 3) {
      for (let lng = -177; lng <= 177; lng += 3) {
        const hits = oceans
          .filter((o: any) => {
            if (lat < o.bbox[1] || lat > o.bbox[3]) return false;
            if (o.cross ? (lng < o.bbox[0] && lng > o.bbox[2]) : (lng < o.bbox[0] || lng > o.bbox[2])) return false;
            return d3.geoContains(o.feat, [lng, lat]);
          })
          .map((o: any) => o.id);
        if (hits.length > 1) {
          overlapCount++;
        }
      }
    }
    expect(overlapCount, 'Oceans must not overlap with one another anywhere on Earth').toBe(0);
  });

  it('correctly verifies point-in-polygon containment with d3.geoContains across water bodies', () => {
    const geo = feature(waterBodies50m as any, (waterBodies50m as any).objects.water_bodies) as any;
    const featureMap = new Map<string, any>(geo.features.map((f: any) => [f.id, f]));

    // Mediterranean Sea [15°E, 35°N]
    const med = featureMap.get('WATER_SEA_MEDITERRANEAN');
    expect(d3.geoContains(med, [15, 35])).toBe(true);
    // Must NOT contain Seto Inland Sea / Japan [133.5°E, 34.2°N]
    expect(d3.geoContains(med, [133.5, 34.2])).toBe(false);

    // Arctic Ocean [0°E, 85°N]
    const arctic = featureMap.get('WATER_OCEAN_ARCTIC');
    expect(d3.geoContains(arctic, [0, 85])).toBe(true);
    // Must NOT contain Indian Ocean [70°E, -20°S] or Gulf of Guinea [0°E, 0°N]
    expect(d3.geoContains(arctic, [70, -20])).toBe(false);
    expect(d3.geoContains(arctic, [0, 0])).toBe(false);
    expect(d3.geoContains(arctic, [0, -40])).toBe(false);

    // Indian Ocean [75°E, -20°S]
    const indian = featureMap.get('WATER_OCEAN_INDIAN');
    expect(d3.geoContains(indian, [75, -20])).toBe(true);
    // Must NOT contain Antarctica [75°E, -80°S] or Arctic [0°E, 85°N]
    expect(d3.geoContains(indian, [75, -80])).toBe(false);
    expect(d3.geoContains(indian, [0, 85])).toBe(false);

    // Southern Ocean [0°E, -65°S]
    const southern = featureMap.get('WATER_OCEAN_SOUTHERN');
    expect(d3.geoContains(southern, [0, -65])).toBe(true);
    // Must NOT contain Equator [0°E, 0°N] or Indian Ocean center [75°E, -20°S]
    expect(d3.geoContains(southern, [0, 0])).toBe(false);
    expect(d3.geoContains(southern, [75, -20])).toBe(false);

    // North Sea [3°E, 56°N]
    const northSea = featureMap.get('WATER_SEA_NORTH');
    expect(d3.geoContains(northSea, [3, 56])).toBe(true);

    // Gulf of Mexico [-90°W, 25°N]
    const gulfMex = featureMap.get('WATER_GULF_MEXICO');
    expect(d3.geoContains(gulfMex, [-90, 25])).toBe(true);

    // Atlantic Ocean [-30°W, 25°N]
    const atlantic = featureMap.get('WATER_OCEAN_ATLANTIC');
    expect(d3.geoContains(atlantic, [-30, 25])).toBe(true);
    expect(d3.geoContains(atlantic, [-20, -80])).toBe(false);

    // Pacific Ocean [-160°W, 0°N]
    const pacific = featureMap.get('WATER_OCEAN_PACIFIC');
    expect(d3.geoContains(pacific, [-160, 0])).toBe(true);
    expect(d3.geoContains(pacific, [-120, -80])).toBe(false);
  });

  it('guarantees pure English naming without parenthesis translations across all water bodies', () => {
    for (const wb of WATER_BODIES) {
      expect(wb.name).not.toMatch(/\(.*\)/);
    }
  });
});

describe('Water Bodies SRS & Question Integration', () => {
  it('converts a WaterBody into a valid synthetic Country object', () => {
    const wb = getWaterBodyById('WATER_STRAIT_GIBRALTAR')!;
    const country = waterBodyToCountry(wb);
    expect(country.id).toBe('WATER_STRAIT_GIBRALTAR');
    expect(country.name).toBe('Strait of Gibraltar');
    expect(country.flagEmoji).toBe('⚓');
    expect(country.coordinates).toEqual(wb.coordinates);
    expect(country.subregion).toBe('STRAIT');
  });

  it('builds a map click question for water bodies', () => {
    const wb = getWaterBodyById('WATER_SEA_MEDITERRANEAN')!;
    const country = waterBodyToCountry(wb);
    const item = createInitialSRSItem(wb.id, 'location');
    const question = buildQuestion(item, country, [country]);

    expect(question.expectedInputMode).toBe('map_click');
    expect(question.prompt).toContain('Mediterranean Sea');
    expect(question.correctAnswer).toBe('Mediterranean Sea');
    expect(question.waterBody).toBeDefined();
    // In Stage 0, options are populated with 4 choices
    expect(question.options).toBeDefined();
    expect(question.options?.length).toBe(4);
    expect(question.options).toContain('Mediterranean Sea');
  });

  it('prepares an Oceans training session queue correctly', () => {
    const emptyMap = new Map<string, SRSItem>();
    const queue = prepareSessionQueue(emptyMap, 'Oceans', ['location'], 10, false);

    expect(queue.length).toBe(10);
    for (const q of queue) {
      expect(q.waterBody).toBeDefined();
      expect(q.country.id).toMatch(/^WATER_/);
      expect(q.expectedInputMode).toBe('map_click');
    }
  });

  it('prepares an Oceans practice drill queue correctly', () => {
    const emptyMap = new Map<string, SRSItem>();
    const queue = prepareSessionQueue(emptyMap, 'Oceans', ['location'], 15, true);

    expect(queue.length).toBe(15);
    for (const q of queue) {
      expect(q.waterBody).toBeDefined();
      expect(q.country.id).toMatch(/^WATER_/);
    }
  });

  it('computes mastery stats including dedicated waterBreakdown', () => {
    const itemsMap = new Map<string, SRSItem>();
    // Master Gibraltar
    const itemGibraltar = createInitialSRSItem('WATER_STRAIT_GIBRALTAR', 'location');
    itemGibraltar.stage = 2;
    itemsMap.set(itemGibraltar.id, itemGibraltar);

    // Learning Mediterranean
    const itemMed = createInitialSRSItem('WATER_SEA_MEDITERRANEAN', 'location');
    itemMed.stage = 1;
    itemsMap.set(itemMed.id, itemMed);

    const stats = computeMasteryStats(itemsMap);
    expect(stats.waterBreakdown).toBeDefined();
    expect(stats.waterBreakdown.total).toBe(40);
    expect(stats.waterBreakdown.stage2).toBe(1);
    expect(stats.waterBreakdown.stage1).toBe(1);
    expect(stats.waterBreakdown.stage0).toBe(38);
  });

  it('handles surrender (__DONT_KNOW__) correctly via processAnswer', () => {
    const wb = getWaterBodyById('WATER_STRAIT_HORMUZ')!;
    const item = createInitialSRSItem(wb.id, 'location');
    item.stage = 2; // Was mastered
    item.intervalDays = 6;
    item.consecutiveRecallCorrect = 2;

    const res = processAnswer(item, false, 'map_click', '__DONT_KNOW__', 1500);
    expect(res.updatedItem.stage).toBe(1); // demoted from 2 to 1
    expect(res.updatedItem.intervalDays).toBe(0); // reset interval
    expect(res.updatedItem.consecutiveRecallCorrect).toBe(0); // reset streak
    expect(res.updatedItem.lapses).toBe(1);
  });
});
