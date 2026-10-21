import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import worldData50m from '../../assets/geo/countries-50m.json';
import worldData110m from '../../assets/geo/countries-110m.json';
import waterBodies50m from '../../assets/geo/water-bodies-50m.json';
import { Country, SRSItem } from '../../core/types';
import { COUNTRIES_BY_ID, COUNTRIES_BY_NUMERIC } from '../../assets/data/countries';
import { WATER_BODIES, getWaterBodyById, WaterBody } from '../../assets/data/waterBodies';
import { waterBodyToCountry } from '../../core/srsEngine';
import { getMicrostateList } from '../../core/microstates';
import { densifyGeoFeatures } from '../../core/geoUtils';

interface VectorMap2DProps {
  selectedCountryId?: string | null;
  targetCountryId?: string | null;
  feedbackState?: 'correct' | 'incorrect' | 'neutral' | null;
  highlightedCountryIds?: string[];
  srsItemsMap?: Map<string, SRSItem>;
  showHeatmap?: boolean;
  disableAutoZoom?: boolean;
  hideHoverTooltip?: boolean;
  onSelectCountry?: (country: Country) => void;
  className?: string;
}

type BBox = [number, number, number, number];

interface PolyItem {
  id: string;
  country?: Country;
  wb?: WaterBody;
  full: Path2D;
  lod: Path2D;
  bbox: BBox;
}

interface BeaconItem {
  country: Country;
  wb?: WaterBody;
  cx: number;
  cy: number;
}

interface HoverState {
  country: Country;
  poly?: PolyItem;
}

interface CountryLabelItem {
  country: Country;
  cx: number;
  cy: number;
  capX: number;
  capY: number;
  spanPx: number;
}

interface FrameState {
  W: number;
  H: number;
  dpr: number;
  t: d3.ZoomTransform;
  moving: boolean;
  sphereOutline: Path2D | null;
  graticulePath: Path2D | null;
  tropicsPath: Path2D | null;
  coastalShelfPath: Path2D | null;
  oceans: PolyItem[];
  seas: PolyItem[];
  straits: PolyItem[];
  countries: PolyItem[];
  labelItems: CountryLabelItem[];
  oceanFills: string[];
  seaFills: string[];
  straitFills: string[];
  oceanStrokes: string[];
  seaStrokes: string[];
  straitStrokes: string[];
  countryFills: string[];
  micro: BeaconItem[];
  microFills: string[];
  waterBeacons: BeaconItem[];
  polyById: Map<string, PolyItem>;
  selectedId?: string | null;
  targetId?: string | null;
  feedbackState?: 'correct' | 'incorrect' | 'neutral' | null;
  hideHoverTooltip?: boolean;
}

// Curated 12-tone sovereign vintage political atlas palette
export const ATLAS_LAND_PALETTE = [
  '#EADBC0', // Sunlit Parchment Sand
  '#DF9A84', // Warm Terracotta Apricot
  '#A5BEA0', // Sage Olive
  '#E8C67A', // Golden Saffron Ochre
  '#D9A5A0', // Dusty Coral Rose
  '#CBB592', // Travertine Buff
  '#B8CCB6', // Celadon Lichen
  '#E5B383', // Warm Amber Clay
  '#D4A577', // Ochre Sienna
  '#9EC0C8', // Verdigris Mist
  '#DEB3A0', // Rose Terracotta
  '#C9C4A5', // Warm Limestone
];

export function getAtlasCountryColor(countryId: string): string {
  let h = 2166136261;
  for (let i = 0; i < countryId.length; i++) {
    h ^= countryId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ATLAS_LAND_PALETTE[(h >>> 0) % ATLAS_LAND_PALETTE.length];
}

// Polygons below this zoom level are drawn with a decimated outline while the camera is moving
const LOD_MAX_ZOOM = 3;
const LOD_MIN_SEGMENT_PX = 1.5;
const PULSE_PERIOD_MS = 1200;
const PING_PERIOD_MS = 1000;

// Path context that drops vertices closer than a threshold to the previous one
class DecimatingContext {
  private lx = 0;
  private ly = 0;
  constructor(private target: Path2D, private minDist2: number) {}
  moveTo(x: number, y: number) {
    this.target.moveTo(x, y);
    this.lx = x;
    this.ly = y;
  }
  lineTo(x: number, y: number) {
    const dx = x - this.lx;
    const dy = y - this.ly;
    if (dx * dx + dy * dy < this.minDist2) return;
    this.target.lineTo(x, y);
    this.lx = x;
    this.ly = y;
  }
  closePath() {
    this.target.closePath();
  }
  arc() {}
  rect() {}
}

const pulseEmerald = {
  fill: d3.interpolateRgb('#2a9d8f', '#10b981'),
  stroke: d3.interpolateRgb('#a7f3d0', '#ecfdf5'),
};
const pulseRose = {
  fill: d3.interpolateRgb('#e63946', '#f43f5e'),
  stroke: d3.interpolateRgb('#fecdd3', '#fff1f2'),
};
const pulseAmber = {
  fill: d3.interpolateRgb('#d97706', '#fbbf24'),
  stroke: d3.interpolateRgb('#fef08a', '#ffffff'),
};

const isVisible = (b: BBox, x0: number, y0: number, x1: number, y1: number) =>
  b[2] >= x0 && b[0] <= x1 && b[3] >= y0 && b[1] <= y1;

const waterBeaconRadii = (wb: WaterBody) => {
  const isStrait = wb.type === 'strait' || wb.type === 'channel';
  const isOcean = wb.type === 'ocean';
  return {
    isStrait,
    isOcean,
    dot: isStrait ? 4 : isOcean ? 6 : 5,
    hit: isStrait ? 20 : isOcean ? 32 : 24,
    pulse: isStrait ? 10 : isOcean ? 16 : 12,
  };
};

const waterBeaconColors = (
  wb: WaterBody,
  s: Pick<FrameState, 'selectedId' | 'targetId' | 'feedbackState'>
) => {
  const { isStrait, isOcean } = waterBeaconRadii(wb);
  const isSelected = wb.id === s.selectedId;
  const isTarget = wb.id === s.targetId;
  let fill = isStrait ? '#48cae4' : isOcean ? '#90e0ef' : '#00b4d8';
  let stroke = isSelected || isTarget ? '#fff8e7' : '#14293a';
  if (s.feedbackState === 'correct' && (isSelected || isTarget)) {
    fill = '#10b981';
    stroke = '#fff8e7';
  } else if (s.feedbackState === 'incorrect' && isSelected) {
    fill = '#e63946';
    stroke = '#fff8e7';
  } else if (s.feedbackState === 'incorrect' && isTarget) {
    fill = '#10b981';
    stroke = '#fff8e7';
  }
  return { fill, stroke };
};

function drawBase(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { W, H, dpr, t, moving } = s;
  const k = t.k;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * t.x, dpr * t.y);
  ctx.lineJoin = 'round';

  const vx0 = -t.x / k;
  const vy0 = -t.y / k;
  const vx1 = (W - t.x) / k;
  const vy1 = (H - t.y) / k;
  const lod = moving && k < LOD_MAX_ZOOM;

  // 1. Cartographic Sphere Basin, Graticules & Equator/Tropics
  if (s.sphereOutline) {
    ctx.fillStyle = '#153B52';
    ctx.fill(s.sphereOutline);
    if (!moving) {
      ctx.lineWidth = 2.2 / k;
      ctx.strokeStyle = 'rgba(233, 196, 106, 0.5)';
      ctx.stroke(s.sphereOutline);
    }
  }
  if (!moving) {
    if (s.graticulePath) {
      ctx.lineWidth = 0.5 / k;
      ctx.strokeStyle = 'rgba(246, 239, 226, 0.1)';
      ctx.stroke(s.graticulePath);
    }
    if (s.tropicsPath) {
      ctx.save();
      ctx.setLineDash([4 / k, 4 / k]);
      ctx.lineWidth = 0.75 / k;
      ctx.strokeStyle = 'rgba(233, 196, 106, 0.32)';
      ctx.stroke(s.tropicsPath);
      ctx.restore();
    }
    // 2. Two-tier Turquoise Coastal Bathymetry Shelf around all landmasses
    if (s.coastalShelfPath) {
      ctx.lineWidth = 9 / k;
      ctx.strokeStyle = 'rgba(72, 202, 228, 0.13)';
      ctx.stroke(s.coastalShelfPath);
      ctx.lineWidth = 3.8 / k;
      ctx.strokeStyle = 'rgba(144, 224, 239, 0.22)';
      ctx.stroke(s.coastalShelfPath);
    }
  }

  // 3. Water bodies (skip passive ocean/sea fills during fast pan/zoom for zero lag)
  const drawWater = (items: PolyItem[], fills: string[], strokes: string[], width: number, skipWhenMoving: boolean) => {
    if (moving && skipWhenMoving) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!isVisible(it.bbox, vx0, vy0, vx1, vy1)) continue;
      ctx.fillStyle = fills[i];
      ctx.fill(lod ? it.lod : it.full);
      if (!moving && strokes[i] !== 'none') {
        ctx.lineWidth = width / k;
        ctx.strokeStyle = strokes[i];
        ctx.stroke(it.full);
      }
    }
  };
  const hasActiveWater = Boolean(s.selectedId?.startsWith('WATER_') || s.targetId?.startsWith('WATER_'));
  drawWater(s.oceans, s.oceanFills, s.oceanStrokes, 0.8, !hasActiveWater);
  drawWater(s.seas, s.seaFills, s.seaStrokes, 0.8, !hasActiveWater);
  drawWater(s.straits, s.straitFills, s.straitStrokes, 1, false);

  // 4. Sovereign Landmasses with Inner Sunlit Bevel & Crisp Ink Borders
  for (let i = 0; i < s.countries.length; i++) {
    const it = s.countries[i];
    if (!isVisible(it.bbox, vx0, vy0, vx1, vy1)) continue;
    const path = lod ? it.lod : it.full;
    ctx.fillStyle = s.countryFills[i];
    ctx.fill(path);

    const active = it.country && (it.country.id === s.selectedId || it.country.id === s.targetId);
    if (!moving && !active) {
      ctx.lineWidth = 1.6 / k;
      ctx.strokeStyle = 'rgba(255, 250, 240, 0.28)';
      ctx.stroke(path);
    }
    ctx.lineWidth = (active ? 1.6 : 0.8) / k;
    ctx.strokeStyle = active ? '#fff8e7' : '#112433';
    ctx.stroke(path);
  }

  // 5. Microstate beacons
  ctx.lineWidth = 1.1 / k;
  for (let i = 0; i < s.micro.length; i++) {
    const m = s.micro[i];
    if (m.cx < vx0 - 20 / k || m.cx > vx1 + 20 / k || m.cy < vy0 - 20 / k || m.cy > vy1 + 20 / k) continue;
    const active = m.country.id === s.selectedId || m.country.id === s.targetId;
    ctx.beginPath();
    ctx.arc(m.cx, m.cy, 3.6 / k, 0, Math.PI * 2);
    ctx.fillStyle = s.microFills[i];
    ctx.strokeStyle = active ? '#fff8e7' : '#112433';
    ctx.fill();
    ctx.stroke();
  }

  // 6. Maritime beacons
  ctx.lineWidth = 1.2 / k;
  for (let i = 0; i < s.waterBeacons.length; i++) {
    const w = s.waterBeacons[i];
    if (!w.wb) continue;
    if (w.cx < vx0 - 20 / k || w.cx > vx1 + 20 / k || w.cy < vy0 - 20 / k || w.cy > vy1 + 20 / k) continue;
    const { dot } = waterBeaconRadii(w.wb);
    const { fill, stroke } = waterBeaconColors(w.wb, s);
    ctx.beginPath();
    ctx.arc(w.cx, w.cy, dot / k, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.fill();
    ctx.stroke();
  }
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  s: FrameState,
  hover: HoverState | null,
  now: number
) {
  const { W, H, dpr, t } = s;
  const k = t.k;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * t.x, dpr * t.y);
  ctx.lineJoin = 'round';

  const pulse = 0.5 - 0.5 * Math.cos((2 * Math.PI * (now % PULSE_PERIOD_MS)) / PULSE_PERIOD_MS);
  const fb = s.feedbackState;

  const highlight = (poly: PolyItem | undefined, isHovered: boolean) => {
    if (!poly) return;
    const id = poly.id;
    const isSelected = id === s.selectedId;
    const isTarget = id === s.targetId;
    const path = poly.full;

    if (poly.wb) {
      let fill: string | null = null;
      let stroke = '#e9c46a';
      let width = 1.5;
      if (fb === 'correct' && (isSelected || isTarget)) {
        fill = 'rgba(42, 157, 143, 0.55)';
        stroke = '#10b981';
        width = 2;
      } else if (fb === 'incorrect' && isTarget) {
        fill = 'rgba(42, 157, 143, 0.55)';
        stroke = '#10b981';
        width = 2;
      } else if (fb === 'incorrect' && isSelected) {
        fill = 'rgba(230, 57, 70, 0.55)';
        stroke = '#e63946';
        width = 2;
      } else if (isSelected || isTarget) {
        fill = 'rgba(233, 196, 106, 0.38)';
        width = 1.8;
      } else if (isHovered) {
        fill = 'rgba(72, 202, 228, 0.34)';
      }
      if (!fill) return;
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width / k;
      ctx.stroke(path);
      return;
    }

    if (fb === 'correct' && (isSelected || isTarget)) {
      ctx.fillStyle = pulseEmerald.fill(pulse);
      ctx.strokeStyle = pulseEmerald.stroke(pulse);
      ctx.lineWidth = (2 + 2 * pulse) / k;
    } else if (fb === 'incorrect' && isTarget) {
      ctx.fillStyle = pulseEmerald.fill(pulse);
      ctx.strokeStyle = pulseEmerald.stroke(pulse);
      ctx.lineWidth = (2 + 2 * pulse) / k;
    } else if (fb === 'incorrect' && isSelected) {
      ctx.fillStyle = pulseRose.fill(pulse);
      ctx.strokeStyle = pulseRose.stroke(pulse);
      ctx.lineWidth = (2 + 2 * pulse) / k;
    } else if (!fb && isTarget) {
      ctx.fillStyle = pulseAmber.fill(pulse);
      ctx.strokeStyle = pulseAmber.stroke(pulse);
      ctx.lineWidth = (2.2 + 1.8 * pulse) / k;
    } else if (isHovered) {
      ctx.fillStyle = '#fff3b0';
      ctx.strokeStyle = '#d94e34';
      ctx.lineWidth = (isSelected || isTarget ? 2.0 : 1.5) / k;
    } else if (isSelected || isTarget) {
      const idx = s.countries.indexOf(poly);
      ctx.fillStyle = idx >= 0 ? s.countryFills[idx] : '#f4a261';
      ctx.strokeStyle = '#fff8e7';
      ctx.lineWidth = 1.6 / k;
    } else {
      return;
    }
    ctx.fill(path);
    ctx.stroke(path);
  };

  const hoveredPoly = hover?.poly;
  const drawn = new Set<PolyItem>();
  for (const id of [s.selectedId, s.targetId]) {
    if (!id) continue;
    const poly = s.polyById.get(id);
    if (poly && !drawn.has(poly)) {
      drawn.add(poly);
      highlight(poly, poly === hoveredPoly);
    }
  }
  if (hoveredPoly && !drawn.has(hoveredPoly)) highlight(hoveredPoly, true);

  // Expanding ping rings for the active beacons
  const ping = (now % PING_PERIOD_MS) / PING_PERIOD_MS;
  const eased = 1 - Math.pow(1 - ping, 3);
  const ring = (b: BeaconItem, baseR: number, width: number) => {
    const isSelected = b.country.id === s.selectedId;
    const isTarget = b.country.id === s.targetId;
    if (!isSelected && !isTarget) return;
    const color =
      fb === 'correct'
        ? '#10b981'
        : fb === 'incorrect' && isSelected
        ? '#e63946'
        : '#e9c46a';
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, (baseR / k) * (1 + eased), 0, Math.PI * 2);
    ctx.globalAlpha = 0.8 * (1 - eased);
    ctx.strokeStyle = color;
    ctx.lineWidth = width / k;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  for (const m of s.micro) ring(m, 8, 1.2);
  for (const w of s.waterBeacons) if (w.wb) ring(w, waterBeaconRadii(w.wb).pulse, 1.4);

  // Screen-space cartographic typography & capital bullseye pins (skipped while moving for 144fps pan/zoom)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';

  if (!s.moving && !s.hideHoverTooltip) {
    // 1. Capital City Pinpoints & Engraved Country Names
    for (let i = 0; i < s.labelItems.length; i++) {
      const lbl = s.labelItems[i];
      const screenSpan = lbl.spanPx * k;
      if (screenSpan < 44) continue;

      const sx = lbl.cx * k + t.x;
      const sy = lbl.cy * k + t.y;
      if (sx < -80 || sx > W + 80 || sy < -30 || sy > H + 30) continue;

      // Capital City Bullseye Marker
      const capSx = lbl.capX * k + t.x;
      const capSy = lbl.capY * k + t.y;
      if (capSx >= 0 && capSx <= W && capSy >= 0 && capSy <= H) {
        ctx.fillStyle = '#fff8e7';
        ctx.strokeStyle = '#142534';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(capSx, capSy, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#d94e34';
        ctx.beginPath();
        ctx.arc(capSx, capSy, 1.4, 0, Math.PI * 2);
        ctx.fill();

        if (screenSpan >= 145 && k >= 2.2) {
          ctx.font = '600 9.5px "Plus Jakarta Sans", sans-serif';
          ctx.lineWidth = 2.6;
          ctx.strokeStyle = 'rgba(246, 239, 226, 0.85)';
          ctx.fillStyle = '#142534';
          ctx.strokeText(lbl.country.capital, capSx, capSy - 5);
          ctx.fillText(lbl.country.capital, capSx, capSy - 5);
        }
      }

      // Country Engraving Label
      if (screenSpan >= 58) {
        const fontSize = Math.min(13, Math.max(8.5, Math.round(screenSpan * 0.085)));
        ctx.font = `800 ${fontSize}px "Fraunces", Georgia, serif`;
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = 'rgba(246, 239, 226, 0.78)';
        ctx.fillStyle = '#10212f';
        const text = lbl.country.name.toUpperCase();
        ctx.strokeText(text, sx, sy + 3);
        ctx.fillText(text, sx, sy + 3);
      }
    }
  }

  // 2. Active & Zoomed Water Body Labels
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#0e2433';
  ctx.fillStyle = '#fff8e7';
  for (const w of s.waterBeacons) {
    if (!w.wb) continue;
    const { isStrait, dot } = waterBeaconRadii(w.wb);
    const active = w.wb.id === s.selectedId || w.wb.id === s.targetId;
    if (!active && !(isStrait && k >= 3.5 && !s.hideHoverTooltip)) continue;
    const sx = w.cx * k + t.x;
    const sy = w.cy * k + t.y;
    if (sx < -100 || sx > W + 100 || sy < -20 || sy > H + 20) continue;
    ctx.strokeText(w.wb.name, sx, sy - dot - 4);
    ctx.fillText(w.wb.name, sx, sy - dot - 4);
  }
}

const EMPTY_HIGHLIGHTED_IDS: string[] = [];

interface ProjectionGeometry {
  sphereOutline: Path2D | null;
  graticulePath: Path2D | null;
  tropicsPath: Path2D | null;
  coastalShelfPath: Path2D | null;
  countries: PolyItem[];
  labelItems: CountryLabelItem[];
  oceans: PolyItem[];
  seas: PolyItem[];
  straits: PolyItem[];
  polyById: Map<string, PolyItem>;
}

interface CachedProjectionBundle {
  key: string;
  projection: d3.GeoProjection;
  geometry: ProjectionGeometry;
  microstateItems: BeaconItem[];
  waterBodyItems: BeaconItem[];
}

const EMPTY_GEOMETRY: ProjectionGeometry = {
  sphereOutline: null,
  graticulePath: null,
  tropicsPath: null,
  coastalShelfPath: null,
  countries: [],
  labelItems: [],
  oceans: [],
  seas: [],
  straits: [],
  polyById: new Map(),
};

let cachedGeoFeatures: any[] | null = null;
export function getCachedGeoFeatures(): any[] {
  if (!cachedGeoFeatures) {
    try {
      const geo = feature(worldData50m as any, (worldData50m as any).objects.countries) as any;
      cachedGeoFeatures = (geo.features as any[]) || [];
    } catch (e) {
      console.error('Failed to parse TopoJSON:', e);
      cachedGeoFeatures = [];
    }
  }
  return cachedGeoFeatures;
}

let cachedWaterGeoFeatures: any[] | null = null;
export function getCachedWaterGeoFeatures(): any[] {
  if (!cachedWaterGeoFeatures) {
    try {
      const geo = feature(waterBodies50m as any, (waterBodies50m as any).objects.water_bodies) as any;
      const rawFeatures = (geo.features as any[]) || [];
      cachedWaterGeoFeatures = densifyGeoFeatures(rawFeatures);
    } catch (e) {
      console.error('Failed to parse water bodies TopoJSON:', e);
      cachedWaterGeoFeatures = [];
    }
  }
  return cachedWaterGeoFeatures;
}

let cachedBundle: CachedProjectionBundle | null = null;
let lastKnownDimensions: { width: number; height: number } | null = null;

function getOrBuildProjectionBundle(width: number, height: number): CachedProjectionBundle {
  const key = `${width}x${height}`;
  if (cachedBundle && cachedBundle.key === key) {
    return cachedBundle;
  }

  const projection = d3
    .geoNaturalEarth1()
    .scale(Math.max(1, width) / 5.8)
    .translate([width / 2, height / 2 + 10]);

  if (width <= 0 || height <= 0 || typeof Path2D === 'undefined') {
    return {
      key,
      projection,
      geometry: EMPTY_GEOMETRY,
      microstateItems: [],
      waterBodyItems: [],
    };
  }

  const geoFeatures = getCachedGeoFeatures();
  const waterGeoFeatures = getCachedWaterGeoFeatures();

  const boundsGen = d3.geoPath(projection);
  const sphereOutline = new Path2D();
  d3.geoPath(projection, sphereOutline as any)({ type: 'Sphere' } as any);
  const graticulePath = new Path2D();
  d3.geoPath(projection, graticulePath as any)(d3.geoGraticule10());

  const tropicsPath = new Path2D();
  const specialLats = [0, 23.436, -23.436, 66.563, -66.563];
  for (const lat of specialLats) {
    const coords = d3.range(-180, 181, 4).map((lng) => [lng, lat]);
    d3.geoPath(projection, tropicsPath as any)({ type: 'LineString', coordinates: coords } as any);
  }

  let coastalShelfPath: Path2D | null = null;
  try {
    const landGeo = feature(worldData110m as any, (worldData110m as any).objects.land) as any;
    coastalShelfPath = new Path2D();
    d3.geoPath(projection, coastalShelfPath as any)(landGeo);
  } catch {
    coastalShelfPath = null;
  }

  const build = (feat: any, id: string, country?: Country, wb?: WaterBody): PolyItem | null => {
    const b = boundsGen.bounds(feat);
    if (!b || !isFinite(b[0][0]) || !isFinite(b[1][1])) return null;
    const full = new Path2D();
    d3.geoPath(projection, full as any)(feat);
    const lod = new Path2D();
    d3.geoPath(projection, new DecimatingContext(lod, LOD_MIN_SEGMENT_PX ** 2) as any)(feat);
    return { id, country, wb, full, lod, bbox: [b[0][0], b[0][1], b[1][0], b[1][1]] };
  };

  const countries: PolyItem[] = [];
  const labelItems: CountryLabelItem[] = [];
  for (let i = 0; i < geoFeatures.length; i++) {
    const feat = geoFeatures[i];
    const country = COUNTRIES_BY_NUMERIC.get(String(feat.id));
    const item = build(feat, country ? country.id : `__unmapped_${feat.id ?? i}`, country);
    if (item) {
      countries.push(item);
      if (country) {
        const cPt = projection(country.coordinates);
        const capPt = projection(country.capitalCoordinates || country.coordinates);
        if (cPt && capPt) {
          const spanPx = Math.hypot(item.bbox[2] - item.bbox[0], item.bbox[3] - item.bbox[1]);
          labelItems.push({
            country,
            cx: cPt[0],
            cy: cPt[1],
            capX: capPt[0],
            capY: capPt[1],
            spanPx,
          });
        }
      }
    }
  }

  const oceans: PolyItem[] = [];
  const seas: PolyItem[] = [];
  const straits: PolyItem[] = [];
  for (const feat of waterGeoFeatures) {
    const wb = getWaterBodyById(feat.id);
    if (!wb) continue;
    const item = build(feat, wb.id, waterBodyToCountry(wb), wb);
    if (!item) continue;
    if (wb.type === 'ocean') oceans.push(item);
    else if (wb.type === 'strait' || wb.type === 'channel') straits.push(item);
    else seas.push(item);
  }

  const polyById = new Map<string, PolyItem>();
  for (const p of [...oceans, ...seas, ...straits, ...countries]) polyById.set(p.id, p);

  const microstateItems: BeaconItem[] = getMicrostateList()
    .map((country) => {
      const coords = projection(country.coordinates);
      return { country, cx: coords ? coords[0] : NaN, cy: coords ? coords[1] : NaN };
    })
    .filter((item) => !isNaN(item.cx) && !isNaN(item.cy));

  const waterBodyItems: BeaconItem[] = WATER_BODIES.map((wb) => {
    const coords = projection(wb.coordinates);
    return {
      wb,
      country: waterBodyToCountry(wb),
      cx: coords ? coords[0] : NaN,
      cy: coords ? coords[1] : NaN,
    };
  }).filter((item) => !isNaN(item.cx) && !isNaN(item.cy));

  cachedBundle = {
    key,
    projection,
    geometry: {
      sphereOutline,
      graticulePath,
      tropicsPath,
      coastalShelfPath,
      countries,
      labelItems,
      oceans,
      seas,
      straits,
      polyById,
    },
    microstateItems,
    waterBodyItems,
  };
  return cachedBundle;
}

/**
 * Prewarms the TopoJSON features and densified water body polygons so that
 * mounting the map at the start of a session is instantaneous.
 */
export function prewarmVectorMap(): void {
  getCachedGeoFeatures();
  getCachedWaterGeoFeatures();
  if (lastKnownDimensions && typeof Path2D !== 'undefined') {
    getOrBuildProjectionBundle(lastKnownDimensions.width, lastKnownDimensions.height);
  }
}

export const VectorMap2D: React.FC<VectorMap2DProps> = ({
  selectedCountryId,
  targetCountryId,
  feedbackState,
  highlightedCountryIds = EMPTY_HIGHLIGHTED_IDS,
  srsItemsMap,
  showHeatmap = false,
  disableAutoZoom = false,
  hideHoverTooltip = false,
  onSelectCountry,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const flagRef = useRef<HTMLSpanElement | null>(null);
  const nameRef = useRef<HTMLDivElement | null>(null);
  const capRef = useRef<HTMLDivElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const hitCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(
    () => lastKnownDimensions ?? { width: 0, height: 0 }
  );

  // Measure container synchronously before first paint so the map never draws at a warped/fake aspect ratio
  useLayoutEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          lastKnownDimensions = { width: clientWidth, height: clientHeight };
          setDimensions((prev) =>
            prev.width === clientWidth && prev.height === clientHeight
              ? prev
              : { width: clientWidth, height: clientHeight }
          );
        }
      }
    };
    updateSize();

    const ro =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(updateSize)
        : null;
    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', updateSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const { projection, geometry, microstateItems, waterBodyItems } = useMemo(
    () => getOrBuildProjectionBundle(dimensions.width, dimensions.height),
    [dimensions.width, dimensions.height]
  );

  const handleCountryHover = useCallback(
    (country?: Country) => {
      if (!country || !tooltipRef.current) return;
      if (hideHoverTooltip) {
        tooltipRef.current.style.opacity = '0';
        return;
      }
      if (flagRef.current) flagRef.current.textContent = country.flagEmoji;
      if (nameRef.current) nameRef.current.textContent = country.officialName || country.name;
      if (capRef.current) {
        if (country.id.startsWith('WATER_')) {
          capRef.current.textContent = `${country.subregion} • ${country.facts?.significance || ''}`;
        } else {
          capRef.current.textContent = `Capital: ${country.capital}`;
        }
      }
      tooltipRef.current.style.opacity = '1';
    },
    [hideHoverTooltip]
  );

  useEffect(() => {
    if (hideHoverTooltip && tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
    }
  }, [hideHoverTooltip]);

  const handleCountryLeave = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
    }
  }, []);

  // Stable ref for onSelectCountry to guarantee zero stale closures across renders
  const onSelectCountryRef = useRef(onSelectCountry);
  useEffect(() => {
    onSelectCountryRef.current = onSelectCountry;
  }, [onSelectCountry]);

  const handleCountrySelect = useCallback((country: Country) => {
    onSelectCountryRef.current?.(country);
  }, []);

  const highlightedSet = useMemo(() => new Set(highlightedCountryIds), [highlightedCountryIds]);
  const heatmapItemsMap = showHeatmap ? srsItemsMap : undefined;

  const getCountryFill = useCallback(
    (country?: Country) => {
      if (!country) return highlightedSet.size > 0 ? '#2b4355' : '#c6bba5';

      if (feedbackState === 'correct') {
        if (country.id === targetCountryId || country.id === selectedCountryId) {
          return '#10b981';
        }
      }
      if (feedbackState === 'incorrect') {
        if (country.id === targetCountryId) {
          return '#10b981';
        }
        if (country.id === selectedCountryId) {
          return '#e63946';
        }
      }

      if (country.id === selectedCountryId || country.id === targetCountryId) {
        return '#f59e0b';
      }

      if (heatmapItemsMap) {
        const capItem = heatmapItemsMap.get(`${country.id}:capital`);
        const locItem = heatmapItemsMap.get(`${country.id}:location`);
        const score = (capItem?.stage || 0) + (locItem?.stage || 0);
        if (score >= 3) return '#2a9d8f';
        if (score === 2) return '#52b788';
        if (score === 1) return '#e9c46a';
        return '#2f495c';
      }

      if (highlightedSet.size > 0) {
        return highlightedSet.has(country.id) ? getAtlasCountryColor(country.id) : '#263f52';
      }

      return getAtlasCountryColor(country.id);
    },
    [feedbackState, targetCountryId, selectedCountryId, highlightedSet, heatmapItemsMap]
  );

  const getWaterBodyFill = useCallback(
    (wb: WaterBody) => {
      const isSelected = wb.id === selectedCountryId;
      const isTarget = wb.id === targetCountryId;

      if (feedbackState === 'correct' && (isSelected || isTarget)) {
        return 'rgba(16, 185, 129, 0.48)';
      }
      if (feedbackState === 'incorrect') {
        if (isTarget) return 'rgba(16, 185, 129, 0.48)';
        if (isSelected) return 'rgba(230, 57, 70, 0.48)';
      }

      if (isSelected || isTarget) {
        return 'rgba(233, 196, 106, 0.36)';
      }

      if (highlightedSet.has(wb.id)) {
        return 'rgba(72, 202, 228, 0.34)';
      }

      if (heatmapItemsMap) {
        const item = heatmapItemsMap.get(`${wb.id}:location`);
        if (item?.stage === 2) return 'rgba(42, 157, 143, 0.3)';
        if (item?.stage === 1) return 'rgba(233, 196, 106, 0.28)';
      }

      if (wb.type === 'strait' || wb.type === 'channel') {
        return 'rgba(72, 202, 228, 0.2)';
      }
      if (wb.type === 'ocean') {
        return 'rgba(29, 78, 107, 0.12)';
      }
      return 'rgba(56, 163, 195, 0.13)';
    },
    [selectedCountryId, targetCountryId, feedbackState, highlightedSet, heatmapItemsMap]
  );

  const getWaterBodyStroke = useCallback(
    (wb: WaterBody) => {
      const isSelected = wb.id === selectedCountryId;
      const isTarget = wb.id === targetCountryId;

      if (feedbackState === 'correct' && (isSelected || isTarget)) {
        return '#10b981';
      }
      if (feedbackState === 'incorrect') {
        if (isTarget) return '#10b981';
        if (isSelected) return '#e63946';
      }

      if (isSelected || isTarget) {
        return '#e9c46a';
      }

      if (wb.type === 'strait' || wb.type === 'channel') {
        return 'rgba(144, 224, 239, 0.38)';
      }
      if (wb.type === 'ocean') {
        return 'none';
      }
      return 'rgba(144, 224, 239, 0.2)';
    },
    [selectedCountryId, targetCountryId, feedbackState]
  );

  // Styles are resolved once per prop change, never per frame
  const styles = useMemo(() => {
    const wbFills = (items: PolyItem[]) => items.map((p) => getWaterBodyFill(p.wb!));
    const wbStrokes = (items: PolyItem[]) => items.map((p) => getWaterBodyStroke(p.wb!));
    return {
      countryFills: geometry.countries.map((p) => getCountryFill(p.country)),
      oceanFills: wbFills(geometry.oceans),
      seaFills: wbFills(geometry.seas),
      straitFills: wbFills(geometry.straits),
      oceanStrokes: wbStrokes(geometry.oceans),
      seaStrokes: wbStrokes(geometry.seas),
      straitStrokes: wbStrokes(geometry.straits),
      microFills: microstateItems.map((m) => getCountryFill(m.country)),
    };
  }, [geometry, microstateItems, getCountryFill, getWaterBodyFill, getWaterBodyStroke]);

  // --- Frame loop -------------------------------------------------------------------------------
  const movingRef = useRef(false);
  const moveEndTimerRef = useRef<number | null>(null);
  const hoverRef = useRef<HoverState | null>(null);
  const baseDirtyRef = useRef(true);
  const frameRafRef = useRef<number | null>(null);
  const lastOverlayRef = useRef(0);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  const stateRef = useRef<FrameState | null>(null);
  const frameRef = useRef<(now: number) => void>(() => {});
  frameRef.current = (now: number) => {
    frameRafRef.current = null;
    const base = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    const s = stateRef.current;
    if (!base || !overlay || !s || s.W <= 0 || s.H <= 0) return;

    s.t = zoomTransformRef.current;
    s.moving = movingRef.current;

    const pw = Math.round(s.W * s.dpr);
    const ph = Math.round(s.H * s.dpr);
    if (base.width !== pw || base.height !== ph) {
      base.width = overlay.width = pw;
      base.height = overlay.height = ph;
      baseDirtyRef.current = true;
    }

    const animating = Boolean(s.selectedId || s.targetId);
    if (baseDirtyRef.current) {
      baseDirtyRef.current = false;
      const ctx = base.getContext('2d');
      if (ctx) drawBase(ctx, s);
    }

    // Idle pulse animations are capped at ~30fps; interaction runs at full rate
    if (animating && !s.moving && now - lastOverlayRef.current < 32) {
      frameRafRef.current = requestAnimationFrame((n) => frameRef.current(n));
      return;
    }
    lastOverlayRef.current = now;
    const octx = overlay.getContext('2d');
    if (octx) drawOverlay(octx, s, hoverRef.current, now);

    if (animating) {
      frameRafRef.current = requestAnimationFrame((n) => frameRef.current(n));
    }
  };

  const scheduleFrame = useCallback((baseChanged: boolean) => {
    if (baseChanged) baseDirtyRef.current = true;
    if (frameRafRef.current == null) {
      frameRafRef.current = requestAnimationFrame((n) => frameRef.current(n));
    }
  }, []);

  useLayoutEffect(() => {
    if (dimensions.width <= 0 || dimensions.height <= 0) return;
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    stateRef.current = {
      W: dimensions.width,
      H: dimensions.height,
      dpr,
      t: zoomTransformRef.current,
      moving: movingRef.current,
      sphereOutline: geometry.sphereOutline,
      graticulePath: geometry.graticulePath,
      tropicsPath: geometry.tropicsPath,
      coastalShelfPath: geometry.coastalShelfPath,
      oceans: geometry.oceans,
      seas: geometry.seas,
      straits: geometry.straits,
      countries: geometry.countries,
      labelItems: geometry.labelItems,
      ...styles,
      micro: microstateItems,
      waterBeacons: waterBodyItems,
      polyById: geometry.polyById,
      selectedId: selectedCountryId,
      targetId: targetCountryId,
      feedbackState,
      hideHoverTooltip,
    };

    const base = baseCanvasRef.current;
    const pw = Math.round(dimensions.width * dpr);
    const ph = Math.round(dimensions.height * dpr);
    // Draw synchronously before paint on mount or resize so the canvas never flashes blank or warps
    if (base && (base.width !== pw || base.height !== ph)) {
      baseDirtyRef.current = true;
      if (frameRafRef.current != null) {
        cancelAnimationFrame(frameRafRef.current);
        frameRafRef.current = null;
      }
      frameRef.current(performance.now());
    } else {
      scheduleFrame(true);
    }
  }, [
    dimensions,
    geometry,
    styles,
    microstateItems,
    waterBodyItems,
    selectedCountryId,
    targetCountryId,
    feedbackState,
    hideHoverTooltip,
    scheduleFrame,
  ]);

  useEffect(() => {
    return () => {
      if (frameRafRef.current) cancelAnimationFrame(frameRafRef.current);
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      if (moveEndTimerRef.current) clearTimeout(moveEndTimerRef.current);
    };
  }, []);

  // --- Hit testing ------------------------------------------------------------------------------
  const isCoarsePointer = useMemo(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)')?.matches),
    []
  );

  const hitTest = useCallback(
    (px: number, py: number): HoverState | null => {
      const t = zoomTransformRef.current;
      const k = t.k;
      const wx = (px - t.x) / k;
      const wy = (py - t.y) / k;

      // 1. Microstates first (16px desktop / 24px coarse touch interactive beacons)
      const microHitRadius = isCoarsePointer ? 24 : 16;
      for (const m of microstateItems) {
        if (Math.hypot((wx - m.cx) * k, (wy - m.cy) * k) <= microHitRadius) return { country: m.country };
      }

      if (!hitCtxRef.current) {
        hitCtxRef.current = document.createElement('canvas').getContext('2d');
      }
      const hctx = hitCtxRef.current;
      if (!hctx) return null;

      const test = (items: PolyItem[]): HoverState | null => {
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          const b = it.bbox;
          if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) continue;
          if (hctx.isPointInPath(it.full, wx, wy)) {
            const country = it.country;
            return country ? { country, poly: it } : null;
          }
        }
        return null;
      };

      // 2. Land countries (exact land polygon boundaries)
      const landHit = test(geometry.countries);
      if (landHit) return landHit;

      // 3. Straits and inland seas
      const straitHit = test(geometry.straits);
      if (straitHit) return straitHit;

      const seaHit = test(geometry.seas);
      if (seaHit) return seaHit;

      // 4. Water body beacons (dots for straits/seas/oceans)
      const waterHitScale = isCoarsePointer ? 1.35 : 1;
      for (const w of waterBodyItems) {
        if (!w.wb) continue;
        const hit = waterBeaconRadii(w.wb).hit * waterHitScale;
        if (Math.hypot((wx - w.cx) * k, (wy - w.cy) * k) <= hit) return { country: w.country };
      }

      // 5. Broad ocean polygons
      return test(geometry.oceans);
    },
    [geometry, microstateItems, waterBodyItems, isCoarsePointer]
  );

  const updateHover = useCallback(() => {
    hoverRafRef.current = null;
    if (isCoarsePointer) return;
    const p = lastPointerRef.current;
    if (!p || movingRef.current) return;
    const hit = p ? hitTest(p.x, p.y) : null;
    const prev = hoverRef.current;
    if (prev?.country.id === hit?.country.id) return;
    hoverRef.current = hit;
    if (hit) handleCountryHover(hit.country);
    else handleCountryLeave();
    if (overlayCanvasRef.current) overlayCanvasRef.current.style.cursor = hit ? 'pointer' : '';
    scheduleFrame(false);
  }, [hitTest, handleCountryHover, handleCountryLeave, scheduleFrame, isCoarsePointer]);

  const requestHoverUpdate = useCallback(() => {
    if (hoverRafRef.current == null) {
      hoverRafRef.current = requestAnimationFrame(updateHover);
    }
  }, [updateHover]);

  const requestHoverUpdateRef = useRef(requestHoverUpdate);
  requestHoverUpdateRef.current = requestHoverUpdate;

  // --- Zoom behaviour ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 24])
      .wheelDelta((event) => {
        return -event.deltaY * (event.deltaMode === 1 ? 0.03 : event.deltaMode ? 0.5 : 0.0015);
      })
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;

        if (!movingRef.current) {
          movingRef.current = true;
          if (hoverRef.current) {
            hoverRef.current = null;
            handleCountryLeave();
            canvas.style.cursor = '';
          }
        }
        if (moveEndTimerRef.current) clearTimeout(moveEndTimerRef.current);
        moveEndTimerRef.current = window.setTimeout(() => {
          movingRef.current = false;
          scheduleFrame(true);
          requestHoverUpdateRef.current();
        }, 120);

        scheduleFrame(true);
      });

    zoomBehaviorRef.current = zoom;
    d3.select(canvas).call(zoom);

    return () => {
      d3.select(canvas).on('.zoom', null);
    };
  }, [scheduleFrame, handleCountryLeave]);

  const wasAutoZoomedRef = useRef(false);

  // Programmatic camera focus (Smooth, cinematic auto-zoom when revealing answers / selecting locations)
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !zoomBehaviorRef.current) return;

    if (disableAutoZoom) {
      if (wasAutoZoomedRef.current) {
        wasAutoZoomedRef.current = false;
        d3.select(canvas)
          .transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
      }
      return;
    }

    const countryToFocus = selectedCountryId || targetCountryId;
    if (!countryToFocus) {
      if (wasAutoZoomedRef.current) {
        wasAutoZoomedRef.current = false;
        d3.select(canvas)
          .transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
      }
      return;
    }

    const wb = getWaterBodyById(countryToFocus);
    const c = wb ? waterBodyToCountry(wb) : COUNTRIES_BY_ID.get(countryToFocus);
    if (!c || !c.coordinates) return;

    const coords = projection(c.coordinates);
    if (!coords) return;

    const [cx, cy] = coords;
    const poly = geometry.polyById.get(c.id);
    const span = poly ? Math.hypot(poly.bbox[2] - poly.bbox[0], poly.bbox[3] - poly.bbox[1]) : 0;
    const adaptiveLandScale =
      span > 180 ? 2.4 : span > 80 ? 3.2 : span > 25 ? 4.2 : 5.5;
    const targetScale = wb
      ? wb.type === 'strait' || wb.type === 'channel'
        ? 5.5
        : 3.0
      : adaptiveLandScale;
    const transform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height * 0.42)
      .scale(targetScale)
      .translate(-cx, -cy);

    wasAutoZoomedRef.current = true;
    d3.select(canvas)
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .call(zoomBehaviorRef.current.transform, transform);
  }, [selectedCountryId, targetCountryId, disableAutoZoom, projection, dimensions]);

  // High-performance direct DOM tooltip tracking (Zero React re-renders during mouse movements)
  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isCoarsePointer) return;
      if (tooltipRef.current) {
        tooltipRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY - 12}px, 0)`;
      }
    },
    [isCoarsePointer]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isCoarsePointer) return;
      const rect = e.currentTarget.getBoundingClientRect();
      lastPointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!movingRef.current) requestHoverUpdate();
    },
    [requestHoverUpdate, isCoarsePointer]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    lastPointerRef.current = null;
    if (hoverRef.current) {
      hoverRef.current = null;
      handleCountryLeave();
      if (overlayCanvasRef.current) overlayCanvasRef.current.style.cursor = '';
      scheduleFrame(false);
    }
  }, [handleCountryLeave, scheduleFrame]);

  // Click: direct hit first, then open-ocean proximity assist (snaps to nearest microstate or water body)
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const direct = hitTest(px, py);
      if (direct) {
        handleCountrySelect(direct.country);
        return;
      }

      const t = zoomTransformRef.current;
      const k = t.k;
      const wx = (px - t.x) / k;
      const wy = (py - t.y) / k;

      let minScreenDist = Infinity;
      let nearestCountry: Country | null = null;
      for (const m of microstateItems) {
        const dist = Math.hypot((wx - m.cx) * k, (wy - m.cy) * k);
        if (dist < minScreenDist) {
          minScreenDist = dist;
          nearestCountry = m.country;
        }
      }
      const microSnapThreshold = isCoarsePointer ? 38 : 28;
      if (minScreenDist <= microSnapThreshold && nearestCountry) {
        handleCountrySelect(nearestCountry);
        return;
      }

      let minWaterDist = Infinity;
      let nearestWater: Country | null = null;
      const isWaterDrill = Boolean(targetCountryId?.startsWith('WATER_'));

      for (const w of waterBodyItems) {
        if (!w.wb) continue;
        const dist = Math.hypot((wx - w.cx) * k, (wy - w.cy) * k);
        const threshold =
          w.wb.type === 'strait' || w.wb.type === 'channel'
            ? 35
            : w.wb.type === 'sea' || w.wb.type === 'gulf' || w.wb.type === 'bay'
            ? 65
            : 120;
        if (dist < threshold && dist < minWaterDist) {
          minWaterDist = dist;
          nearestWater = w.country;
        }
      }

      if (nearestWater) {
        handleCountrySelect(nearestWater);
      } else if (isWaterDrill) {
        let closestWb: Country | null = null;
        let closestDist = Infinity;
        for (const w of waterBodyItems) {
          const dist = Math.hypot((wx - w.cx) * k, (wy - w.cy) * k);
          if (dist < closestDist) {
            closestDist = dist;
            closestWb = w.country;
          }
        }
        if (closestWb && closestDist < 250) {
          handleCountrySelect(closestWb);
        }
      }
    },
    [hitTest, microstateItems, waterBodyItems, handleCountrySelect, targetCountryId, isCoarsePointer]
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleContainerMouseMove}
      className={`relative w-full h-full overflow-hidden bg-[#102a3c] select-none touch-none ${className}`}
    >
      {/* Background warm Aegean-Prussian radial depth */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,#1b4662_0%,#0f293b_65%,#0a1d2b_100%)]" />

      {/* Static map layer: water bodies, countries, beacons */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Dynamic layer: hover, selection, feedback pulses, labels. Receives all pointer input. */}
      <canvas
        ref={overlayCanvasRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onClick={handleCanvasClick}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing block touch-none"
      />

      {/* High-Performance Direct Tooltip (Zero React re-renders during cursor movements) */}
      <div
        ref={tooltipRef}
        className="fixed pointer-events-none z-50 px-3.5 py-2 rounded-xl bg-[#f6efe2] border-2 border-[#162938] shadow-2xl -translate-x-1/2 -translate-y-full text-xs flex items-center gap-2.5 transition-opacity duration-150 opacity-0"
        style={{ left: 0, top: 0, willChange: 'transform' }}
      >
        <span ref={flagRef} className="text-lg" />
        <div>
          <div ref={nameRef} className="font-extrabold text-[#162938] tracking-tight" />
          <div ref={capRef} className="text-[10px] font-bold text-[#c84b31]" />
        </div>
      </div>
    </div>
  );
};
