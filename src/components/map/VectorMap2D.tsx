import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import worldData50m from '../../assets/geo/countries-50m.json';
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

interface FrameState {
  W: number;
  H: number;
  dpr: number;
  t: d3.ZoomTransform;
  moving: boolean;
  oceans: PolyItem[];
  seas: PolyItem[];
  straits: PolyItem[];
  countries: PolyItem[];
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
  fill: d3.interpolateRgb('#10b981', '#059669'),
  stroke: d3.interpolateRgb('#34d399', '#6ee7b7'),
};
const pulseRose = {
  fill: d3.interpolateRgb('#f43f5e', '#e11d48'),
  stroke: d3.interpolateRgb('#fb7185', '#fda4af'),
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
  let fill = isStrait ? '#06b6d4' : isOcean ? '#38bdf8' : '#0ea5e9';
  let stroke = isSelected || isTarget ? '#ffffff' : '#e0f2fe';
  if (s.feedbackState === 'correct' && (isSelected || isTarget)) {
    fill = '#10b981';
    stroke = '#ffffff';
  } else if (s.feedbackState === 'incorrect' && isSelected) {
    fill = '#f43f5e';
    stroke = '#ffffff';
  } else if (s.feedbackState === 'incorrect' && isTarget) {
    fill = '#10b981';
    stroke = '#ffffff';
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

  const drawWater = (items: PolyItem[], fills: string[], strokes: string[], width: number) => {
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
  drawWater(s.oceans, s.oceanFills, s.oceanStrokes, 0.8);
  drawWater(s.seas, s.seaFills, s.seaStrokes, 0.8);
  drawWater(s.straits, s.straitFills, s.straitStrokes, 1);

  for (let i = 0; i < s.countries.length; i++) {
    const it = s.countries[i];
    if (!isVisible(it.bbox, vx0, vy0, vx1, vy1)) continue;
    const path = lod ? it.lod : it.full;
    ctx.fillStyle = s.countryFills[i];
    ctx.fill(path);
    const active = it.country && (it.country.id === s.selectedId || it.country.id === s.targetId);
    ctx.lineWidth = (active ? 1.5 : 0.8) / k;
    ctx.strokeStyle = active ? '#38bdf8' : '#64748b';
    ctx.stroke(path);
  }

  // Microstate beacons
  ctx.lineWidth = 1 / k;
  for (let i = 0; i < s.micro.length; i++) {
    const m = s.micro[i];
    if (m.cx < vx0 - 20 / k || m.cx > vx1 + 20 / k || m.cy < vy0 - 20 / k || m.cy > vy1 + 20 / k) continue;
    const active = m.country.id === s.selectedId || m.country.id === s.targetId;
    ctx.beginPath();
    ctx.arc(m.cx, m.cy, 3.5 / k, 0, Math.PI * 2);
    ctx.fillStyle = s.microFills[i];
    ctx.strokeStyle = active ? '#ffffff' : '#38bdf8';
    ctx.fill();
    ctx.stroke();
  }

  // Maritime beacons
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
      let stroke = '#38bdf8';
      let width = 1.5;
      if (fb === 'correct' && (isSelected || isTarget)) {
        fill = 'rgba(16, 185, 129, 0.5)';
        stroke = '#10b981';
        width = 2;
      } else if (fb === 'incorrect' && isTarget) {
        fill = 'rgba(16, 185, 129, 0.5)';
        stroke = '#10b981';
        width = 2;
      } else if (fb === 'incorrect' && isSelected) {
        fill = 'rgba(244, 63, 94, 0.5)';
        stroke = '#f43f5e';
        width = 2;
      } else if (isSelected || isTarget) {
        fill = 'rgba(2, 132, 199, 0.45)';
        width = 1.8;
      } else if (isHovered) {
        fill = 'rgba(14, 165, 233, 0.4)';
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
    } else if (fb === 'incorrect' && isSelected) {
      ctx.fillStyle = pulseRose.fill(pulse);
      ctx.strokeStyle = pulseRose.stroke(pulse);
      ctx.lineWidth = (2 + 2 * pulse) / k;
    } else if (isHovered) {
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = isSelected || isTarget ? '#38bdf8' : '#64748b';
      ctx.lineWidth = (isSelected || isTarget ? 1.5 : 0.8) / k;
    } else if (isSelected || isTarget) {
      const idx = s.countries.indexOf(poly);
      ctx.fillStyle = idx >= 0 ? s.countryFills[idx] : '#334155';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 / k;
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
        ? '#f43f5e'
        : '#38bdf8';
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, (baseR / k) * (1 + eased), 0, Math.PI * 2);
    ctx.globalAlpha = 0.75 * (1 - eased);
    ctx.strokeStyle = color;
    ctx.lineWidth = width / k;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  for (const m of s.micro) ring(m, 8, 1.2);
  for (const w of s.waterBeacons) if (w.wb) ring(w, waterBeaconRadii(w.wb).pulse, 1.4);

  // Labels live in screen space so text stays crisp and constant-size
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#090e1a';
  ctx.fillStyle = '#ffffff';
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

export const VectorMap2D: React.FC<VectorMap2DProps> = ({
  selectedCountryId,
  targetCountryId,
  feedbackState,
  highlightedCountryIds = [],
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

  const [dimensions, setDimensions] = useState({ width: 960, height: 540 });

  // Convert TopoJSON to GeoJSON features once
  const geoFeatures = useMemo(() => {
    try {
      const geo = feature(worldData50m as any, (worldData50m as any).objects.countries) as any;
      return (geo.features as any[]) || [];
    } catch (e) {
      console.error('Failed to parse TopoJSON:', e);
      return [];
    }
  }, []);

  // Convert water bodies TopoJSON to GeoJSON features once
  const waterGeoFeatures = useMemo(() => {
    try {
      const geo = feature(waterBodies50m as any, (waterBodies50m as any).objects.water_bodies) as any;
      const rawFeatures = (geo.features as any[]) || [];
      return densifyGeoFeatures(rawFeatures);
    } catch (e) {
      console.error('Failed to parse water bodies TopoJSON:', e);
      return [];
    }
  }, []);

  // Window resize observer
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions((prev) =>
            prev.width === clientWidth && prev.height === clientHeight
              ? prev
              : { width: clientWidth, height: clientHeight }
          );
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const projection = useMemo(
    () =>
      d3
        .geoNaturalEarth1()
        .scale(dimensions.width / 5.8)
        .translate([dimensions.width / 2, dimensions.height / 2 + 10]),
    [dimensions]
  );

  // Precompute Path2D geometry (full + decimated LOD) once per projection: zero path work while interacting
  const geometry = useMemo(() => {
    const boundsGen = d3.geoPath(projection);
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
    for (let i = 0; i < geoFeatures.length; i++) {
      const feat = geoFeatures[i];
      const country = COUNTRIES_BY_NUMERIC.get(String(feat.id));
      const item = build(feat, country ? country.id : `__unmapped_${feat.id ?? i}`, country);
      if (item) countries.push(item);
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

    return { countries, oceans, seas, straits, polyById };
  }, [geoFeatures, waterGeoFeatures, projection]);

  // Projected microstate anchor points
  const microstateItems = useMemo<BeaconItem[]>(() => {
    return getMicrostateList()
      .map((country) => {
        const coords = projection(country.coordinates);
        return { country, cx: coords ? coords[0] : NaN, cy: coords ? coords[1] : NaN };
      })
      .filter((item) => !isNaN(item.cx) && !isNaN(item.cy));
  }, [projection]);

  // Projected anchor points for all hydrographic bodies
  const waterBodyItems = useMemo<BeaconItem[]>(() => {
    return WATER_BODIES.map((wb) => {
      const coords = projection(wb.coordinates);
      return {
        wb,
        country: waterBodyToCountry(wb),
        cx: coords ? coords[0] : NaN,
        cy: coords ? coords[1] : NaN,
      };
    }).filter((item) => !isNaN(item.cx) && !isNaN(item.cy));
  }, [projection]);

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

  const getCountryFill = useCallback(
    (country?: Country) => {
      if (!country) return '#334155';

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
          return '#f43f5e';
        }
      }

      if (country.id === selectedCountryId) {
        return '#0284c7';
      }

      if (highlightedSet.has(country.id)) {
        return '#38bdf8';
      }

      if (showHeatmap && srsItemsMap) {
        const capItem = srsItemsMap.get(`${country.id}:capital`);
        const locItem = srsItemsMap.get(`${country.id}:location`);
        const score = (capItem?.stage || 0) + (locItem?.stage || 0);
        if (score >= 3) return '#059669';
        if (score === 2) return '#10b981';
        if (score === 1) return '#d97706';
        return '#334155';
      }

      return '#334155';
    },
    [feedbackState, targetCountryId, selectedCountryId, highlightedSet, showHeatmap, srsItemsMap]
  );

  const getWaterBodyFill = useCallback(
    (wb: WaterBody) => {
      const isSelected = wb.id === selectedCountryId;
      const isTarget = wb.id === targetCountryId;

      if (feedbackState === 'correct' && (isSelected || isTarget)) {
        return 'rgba(16, 185, 129, 0.45)';
      }
      if (feedbackState === 'incorrect') {
        if (isTarget) return 'rgba(16, 185, 129, 0.45)';
        if (isSelected) return 'rgba(244, 63, 94, 0.45)';
      }

      if (isSelected || isTarget) {
        return 'rgba(2, 132, 199, 0.45)';
      }

      if (highlightedSet.has(wb.id)) {
        return 'rgba(56, 189, 248, 0.35)';
      }

      if (showHeatmap && srsItemsMap) {
        const item = srsItemsMap.get(`${wb.id}:location`);
        if (item?.stage === 2) return 'rgba(16, 185, 129, 0.25)';
        if (item?.stage === 1) return 'rgba(217, 119, 6, 0.25)';
      }

      if (wb.type === 'strait' || wb.type === 'channel') {
        return 'rgba(14, 165, 233, 0.18)';
      }
      if (wb.type === 'ocean') {
        return 'rgba(3, 105, 161, 0.05)';
      }
      return 'rgba(14, 165, 233, 0.09)';
    },
    [selectedCountryId, targetCountryId, feedbackState, highlightedSet, showHeatmap, srsItemsMap]
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
        if (isSelected) return '#f43f5e';
      }

      if (isSelected || isTarget) {
        return '#38bdf8';
      }

      if (wb.type === 'strait' || wb.type === 'channel') {
        return 'rgba(56, 189, 248, 0.35)';
      }
      if (wb.type === 'ocean') {
        return 'none';
      }
      return 'rgba(56, 189, 248, 0.18)';
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
  useLayoutEffect(() => {
    stateRef.current = {
      W: dimensions.width,
      H: dimensions.height,
      dpr: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
      t: zoomTransformRef.current,
      moving: movingRef.current,
      oceans: geometry.oceans,
      seas: geometry.seas,
      straits: geometry.straits,
      countries: geometry.countries,
      ...styles,
      micro: microstateItems,
      waterBeacons: waterBodyItems,
      polyById: geometry.polyById,
      selectedId: selectedCountryId,
      targetId: targetCountryId,
      feedbackState,
      hideHoverTooltip,
    };
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
  ]);

  const frameRef = useRef<(now: number) => void>(() => {});
  frameRef.current = (now: number) => {
    frameRafRef.current = null;
    const base = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    const s = stateRef.current;
    if (!base || !overlay || !s) return;

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

  // Redraw whenever props/geometry/size change
  useEffect(() => {
    scheduleFrame(true);
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
    const targetScale = wb ? (wb.type === 'strait' || wb.type === 'channel' ? 5.5 : 3.0) : 3.5;
    const transform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
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
      className={`relative w-full h-full overflow-hidden bg-[#090e1a] select-none touch-none ${className}`}
    >
      {/* Background soft ambient radial gradient */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(20,32,54,0.6)_0%,rgba(9,14,26,1)_100%)]" />

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
        className="fixed pointer-events-none z-50 px-3 py-1.5 rounded-lg bg-slate-900/95 border border-slate-700/90 shadow-2xl backdrop-blur-md -translate-x-1/2 -translate-y-full text-xs flex items-center gap-2 transition-opacity duration-150 opacity-0"
        style={{ left: 0, top: 0, willChange: 'transform' }}
      >
        <span ref={flagRef} className="text-base" />
        <div>
          <div ref={nameRef} className="font-bold text-white tracking-wide" />
          <div ref={capRef} className="text-[10px] text-emerald-400" />
        </div>
      </div>
    </div>
  );
};
