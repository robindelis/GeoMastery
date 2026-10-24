import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import {
  Play,
  Compass,
  Zap,
  Flame,
  RefreshCw,
  KeyRound,
  Download,
  Upload,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Trophy,
  Target,
  Gauge,
  ChevronRight,
  Globe2,
  Map as MapIcon,
  Crosshair,
  Scale,
  UserCheck,
  Utensils,
  Coins,
  BookOpen,
  Sparkles,
  Search,
  X,
  Maximize2,
  Layers,
  TrendingUp
} from 'lucide-react';
import worldData110m from '../../assets/geo/countries-110m.json';
import { COUNTRIES, COUNTRIES_BY_NUMERIC } from '../../assets/data/countries';
import { WATER_BODIES } from '../../assets/data/waterBodies';
import { getAtlasCountryColor } from '../map/VectorMap2D';
import { useHomeData, useDueBreakdown } from './homeData';
import { useCountUp } from './useCountUp';
import type { HomeViewProps } from './homeTypes';
import type { TrainingCategory, SRSItem } from '../../core/types';
import { classifyCardHorizon, inferStability, computeRetrievability } from '../../core/srsEngine';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';
import { formatCoordinates } from '../../core/geoUtils';

/* ────────────────────────────────────────────────────────────────────────────
 * L'ATELIER DU MONDE — Viewport-Locked Single-Screen Grand Atlas Deck
 *
 * Strictly zero vertical scroll (h-full overflow-hidden): every control,
 * the sunlit vellum hero folio, the interactive 3D political globe, the
 * spotlight nation dispatch, lifetime telemetry, and all 6 regional folio
 * plates fit in a single 12-column viewport-locked Bento grid.
 * ──────────────────────────────────────────────────────────────────────────── */

const JADE = '#2A9D8F';

interface RegionAtelierMeta {
  accent: string;
  coords: [number, number];
  coordLabel: string;
  plateNumber: string;
}

const REGION_META: Record<string, RegionAtelierMeta> = {
  Europe: {
    accent: '#E07A5F',
    coords: [15, 50],
    coordLabel: '50°N · 15°E',
    plateNumber: 'I'
  },
  Asia: {
    accent: '#E9C46A',
    coords: [95, 32],
    coordLabel: '32°N · 95°E',
    plateNumber: 'II'
  },
  Africa: {
    accent: '#F4A261',
    coords: [20, 4],
    coordLabel: '04°N · 20°E',
    plateNumber: 'III'
  },
  Americas: {
    accent: '#2A9D8F',
    coords: [-74, 8],
    coordLabel: '08°N · 74°W',
    plateNumber: 'IV'
  },
  Oceania: {
    accent: '#81B29A',
    coords: [148, -22],
    coordLabel: '22°S · 148°E',
    plateNumber: 'V'
  },
  Oceans: {
    accent: '#48CAE4',
    coords: [-145, -5],
    coordLabel: '05°S · 145°W',
    plateNumber: 'VI'
  }
};

const VOYAGE_ROUTES: Array<[[number, number], [number, number]]> = [
  [[2.3522, 48.8566], [-74.006, 40.7128]],
  [[-9.1393, 38.7223], [-47.8825, -15.7942]],
  [[31.2357, 30.0444], [77.209, 28.6139]],
  [[103.8198, 1.3521], [139.6917, 35.6895]]
];

const serifDisplay = 'font-[family-name:var(--font-fraunces)]';

type HorizonCategory = 'mastered' | 'recall' | 'learning' | 'unseen';

interface HorizonCardEntry {
  id: string;
  entityId: string;
  entityName: string;
  plateCode: string;
  flagOrEmblem: string;
  continent: TrainingCategory;
  subregion: string;
  coordText: string;
  attribute: 'capital' | 'capital_to_country' | 'location' | 'country' | 'flag';
  attributeGlyph: string;
  attributeLabel: string;
  answerText: string;
  capitalText?: string;
  coordinates: [number, number];
  category: HorizonCategory;
  statusBadge: string;
  shortBadge: string;
  trophyGlyph: string;
  isDue: boolean;
  lastReviewedAt: string | null;
  reps: number;
  intervalDays: number;
}

const HORIZON_CATEGORY_ORDER: HorizonCategory[] = ['mastered', 'recall', 'learning', 'unseen'];

/* Card-deck peek geometry (px): fully visible top card + readable card tops behind it */
const DECK_FACE_HEIGHT = 60;
const DECK_MAX_CARDS = 5;
const DECK_MIN_PEEK = 16;

/** Copy for a drawer that holds no card yet — it advertises the card next in line instead. */
const DECK_EMPTY_LABEL: Record<HorizonCategory, string> = {
  mastered: 'Next to master',
  recall: 'Next to advance',
  learning: 'Next to introduce',
  unseen: 'All discovered'
};

const HORIZON_CATEGORY_META: Record<
  HorizonCategory,
  {
    label: string;
    subtitle: string;
    description: string;
    color: string;
    dotCls: string;
    textCls: string;
    tileIdleCls: string;
    tileActiveCls: string;
    badgeCls: string;
  }
> = {
  mastered: {
    label: 'Mastered',
    subtitle: 'S ≥ 6d Stability',
    description: 'High-stability long-term memory plates (FSRS Stability S ≥ 6 days at 90% retrievability).',
    color: '#10B981',
    dotCls: 'bg-[#10B981]',
    textCls: 'text-[#10B981]',
    tileIdleCls: 'bg-[#0C1D2B]/85 border-[#10B981]/30 hover:border-[#10B981]/75 hover:bg-[#10B981]/10',
    tileActiveCls: 'bg-[#10B981]/20 border-[#10B981] ring-1 ring-[#10B981]/50 shadow-md',
    badgeCls: 'border-[#10B981]/35 bg-[#10B981]/15 text-[#10B981]'
  },
  recall: {
    label: 'Recall',
    subtitle: 'S 2–6d Horizon',
    description: 'Consolidating active recall plates building stability toward the 6-day mastery horizon.',
    color: '#E9C46A',
    dotCls: 'bg-[#E9C46A]',
    textCls: 'text-[#E9C46A]',
    tileIdleCls: 'bg-[#0C1D2B]/85 border-[#E9C46A]/30 hover:border-[#E9C46A]/75 hover:bg-[#E9C46A]/10',
    tileActiveCls: 'bg-[#E9C46A]/20 border-[#E9C46A] ring-1 ring-[#E9C46A]/50 shadow-md',
    badgeCls: 'border-[#E9C46A]/35 bg-[#E9C46A]/15 text-[#E9C46A]'
  },
  learning: {
    label: 'Learning',
    subtitle: 'S < 2.2d Acquire',
    description: 'In active FSRS acquisition (initial recognition or short-horizon active recall).',
    color: '#F4A261',
    dotCls: 'bg-[#F4A261]',
    textCls: 'text-[#F4A261]',
    tileIdleCls: 'bg-[#0C1D2B]/85 border-[#F4A261]/30 hover:border-[#F4A261]/75 hover:bg-[#F4A261]/10',
    tileActiveCls: 'bg-[#F4A261]/20 border-[#F4A261] ring-1 ring-[#F4A261]/50 shadow-md',
    badgeCls: 'border-[#F4A261]/35 bg-[#F4A261]/15 text-[#F4A261]'
  },
  unseen: {
    label: 'Unseen',
    subtitle: 'Fresh Cards',
    description: 'Uncharted cards waiting to enter your spaced repetition horizon.',
    color: '#38BDF8',
    dotCls: 'bg-[#38BDF8]',
    textCls: 'text-[#38BDF8]',
    tileIdleCls: 'bg-[#0C1D2B]/85 border-[#38BDF8]/30 hover:border-[#38BDF8]/75 hover:bg-[#38BDF8]/10',
    tileActiveCls: 'bg-[#38BDF8]/20 border-[#38BDF8] ring-1 ring-[#38BDF8]/50 shadow-md',
    badgeCls: 'border-[#38BDF8]/35 bg-[#38BDF8]/15 text-[#38BDF8]'
  }
};

/* ── On-Demand Interactive 3D Political Atelier Globe ──────────────────── */

interface AtelierGlobeProps {
  targetCoords: [number, number] | null;
  targetLabel: string;
  spotlightCoords: [number, number];
  spotlightName: string;
  spotlightId: string;
}

const InteractiveAtelierGlobe: React.FC<AtelierGlobeProps> = ({
  targetCoords,
  targetLabel,
  spotlightCoords,
  spotlightName,
  spotlightId
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState(240);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number }>({
    x: 0,
    y: 0,
    yaw: -spotlightCoords[0],
    pitch: -Math.max(-55, Math.min(55, spotlightCoords[1]))
  });

  const rotationRef = useRef<{ yaw: number; pitch: number }>({
    yaw: -spotlightCoords[0],
    pitch: -Math.max(-55, Math.min(55, spotlightCoords[1]))
  });

  const animFrameRef = useRef<number | null>(null);
  const drawFrameRef = useRef<(() => void) | null>(null);

  const [hudBearing, setHudBearing] = useState<{ lat: string; lng: string }>(() => {
    const lat = spotlightCoords[1];
    const lng = spotlightCoords[0];
    return {
      lat: `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}`,
      lng: `${Math.abs(lng).toFixed(1).padStart(5, '0')}° ${lng >= 0 ? 'E' : 'W'}`
    };
  });

  // Measure available container space so the globe never overflows vertically
  useEffect(() => {
    const update = () => {
      if (!wrapperRef.current) return;
      const { clientWidth, clientHeight } = wrapperRef.current;
      const next = Math.max(180, Math.min(clientWidth - 20, clientHeight - 16, 520));
      setCanvasSize((prev) => (Math.abs(prev - next) > 2 ? next : prev));
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' && wrapperRef.current ? new ResizeObserver(update) : null;
    if (ro && wrapperRef.current) ro.observe(wrapperRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const countryFeatures = useMemo(() => {
    try {
      const geo = feature(worldData110m as any, (worldData110m as any).objects.countries) as any;
      const raw = (geo.features as any[]) || [];
      return raw.map((feat) => {
        const c = COUNTRIES_BY_NUMERIC.get(String(feat.id));
        return {
          feat,
          id: c?.id || '',
          fill: c ? getAtlasCountryColor(c.id) : '#C6BBA5'
        };
      });
    } catch {
      return [];
    }
  }, []);

  const landGeo = useMemo(() => {
    try {
      return feature(worldData110m as any, (worldData110m as any).objects.land) as any;
    } catch {
      return null;
    }
  }, []);

  const routeFeatures = useMemo(() => {
    return VOYAGE_ROUTES.map(([src, dst]) => ({
      type: 'LineString',
      coordinates: d3.range(0, 1.05, 0.08).map((t) => d3.geoInterpolate(src, dst)(t))
    }));
  }, []);

  const activeGoalCoords = targetCoords || spotlightCoords;
  const activeGoalLabel = targetCoords ? targetLabel : spotlightName;

  const targetRef = useRef({
    goalCoords: activeGoalCoords,
    goalLabel: activeGoalLabel,
    spotlightId
  });
  targetRef.current = {
    goalCoords: activeGoalCoords,
    goalLabel: activeGoalLabel,
    spotlightId
  };

  const scheduleDraw = useCallback(() => {
    if (animFrameRef.current == null && drawFrameRef.current) {
      animFrameRef.current = requestAnimationFrame(drawFrameRef.current);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || countryFeatures.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvasSize;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.42;

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([cx, cy])
      .clipAngle(90);

    const path = d3.geoPath(projection, ctx);
    const graticule = d3.geoGraticule10();

    const render = () => {
      animFrameRef.current = null;
      const { goalCoords, goalLabel, spotlightId: activeSpotlightId } = targetRef.current;

      let needsMoreFrames = false;

      if (!isDraggingRef.current) {
        const desiredYaw = -goalCoords[0];
        const desiredPitch = -Math.max(-65, Math.min(65, goalCoords[1]));
        const deltaYaw = ((desiredYaw - rotationRef.current.yaw + 540) % 360) - 180;
        const deltaPitch = desiredPitch - rotationRef.current.pitch;

        if (Math.abs(deltaYaw) > 0.15 || Math.abs(deltaPitch) > 0.15) {
          rotationRef.current.yaw += deltaYaw * 0.14;
          rotationRef.current.pitch += deltaPitch * 0.14;
          needsMoreFrames = true;
        } else {
          rotationRef.current.yaw = desiredYaw;
          rotationRef.current.pitch = desiredPitch;
        }
      }

      projection.rotate([rotationRef.current.yaw, rotationRef.current.pitch, 0]);
      ctx.clearRect(0, 0, size, size);

      // 1. Warm Sunlit Brass Outer Halo
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.15);
      halo.addColorStop(0, 'rgba(233, 196, 106, 0.24)');
      halo.addColorStop(1, 'rgba(14, 34, 49, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // 2. Aegean-Prussian Ocean Sphere
      const oceanGrad = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.08,
        cx,
        cy,
        radius
      );
      oceanGrad.addColorStop(0, '#22597A');
      oceanGrad.addColorStop(0.65, '#163D56');
      oceanGrad.addColorStop(1, '#0C2333');
      ctx.fillStyle = oceanGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Warm Ivory Graticule
      ctx.strokeStyle = 'rgba(246, 239, 226, 0.11)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      path(graticule);
      ctx.stroke();

      // 4. Turquoise Coastal Bathymetry Shelf
      if (landGeo) {
        ctx.beginPath();
        path(landGeo);
        ctx.strokeStyle = 'rgba(72, 202, 228, 0.2)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // 5. Multi-tonal Political Atlas Countries
      ctx.lineWidth = 0.65;
      ctx.strokeStyle = '#112433';
      for (let i = 0; i < countryFeatures.length; i++) {
        const item = countryFeatures[i];
        ctx.fillStyle = item.id === activeSpotlightId ? '#FFF3B0' : item.fill;
        ctx.beginPath();
        path(item.feat);
        ctx.fill();
        ctx.stroke();
      }

      // 6. Classic Dashed Trade Routes
      ctx.save();
      ctx.setLineDash([2.5, 3.5]);
      ctx.strokeStyle = 'rgba(246, 239, 226, 0.28)';
      ctx.lineWidth = 0.9;
      for (const route of routeFeatures) {
        ctx.beginPath();
        path(route as any);
        ctx.stroke();
      }
      ctx.restore();

      // 7. Active Compass Target Pin & Callout Flag
      const centerGeo: [number, number] = [-rotationRef.current.yaw, -rotationRef.current.pitch];
      if (d3.geoDistance(goalCoords, centerGeo) < Math.PI / 2) {
        const pt = projection(goalCoords);
        if (pt) {
          const [rx, ry] = pt;

          ctx.strokeStyle = '#D94E34';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rx, ry, 8.5, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#D94E34';
          ctx.strokeStyle = '#FFF8E7';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(rx, ry, 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.font = '700 9.5px "Plus Jakarta Sans", sans-serif';
          const tw = ctx.measureText(goalLabel).width;
          const bx = Math.min(size - tw - 22, Math.max(8, rx + 10));
          const by = Math.max(22, ry - 7);

          ctx.fillStyle = '#F6EFE2';
          ctx.strokeStyle = '#142534';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.roundRect(bx, by - 12, tw + 14, 18, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#142534';
          ctx.fillText(goalLabel, bx + 7, by + 0.5);
        }
      }

      // 8. Engraved Brass Globe Meridian Rim
      const rimGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      rimGrad.addColorStop(0, '#F3D999');
      rimGrad.addColorStop(0.5, '#C8963E');
      rimGrad.addColorStop(1, '#7E571E');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (needsMoreFrames) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        const centerLng = ((-rotationRef.current.yaw + 540) % 360) - 180;
        const centerLat = -rotationRef.current.pitch;
        setHudBearing({
          lat: `${Math.abs(centerLat).toFixed(1)}° ${centerLat >= 0 ? 'N' : 'S'}`,
          lng: `${Math.abs(centerLng).toFixed(1).padStart(5, '0')}° ${centerLng >= 0 ? 'E' : 'W'}`
        });
      }
    };

    drawFrameRef.current = render;
    render();

    return () => {
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [canvasSize, countryFeatures, landGeo, routeFeatures]);

  useEffect(() => {
    scheduleDraw();
  }, [activeGoalCoords[0], activeGoalCoords[1], activeGoalLabel, spotlightId, scheduleDraw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      yaw: rotationRef.current.yaw,
      pitch: rotationRef.current.pitch
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    rotationRef.current.yaw = dragStartRef.current.yaw + dx * 0.45;
    rotationRef.current.pitch = Math.max(-70, Math.min(70, dragStartRef.current.pitch - dy * 0.45));
    scheduleDraw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const centerLng = ((-rotationRef.current.yaw + 540) % 360) - 180;
    const centerLat = -rotationRef.current.pitch;
    setHudBearing({
      lat: `${Math.abs(centerLat).toFixed(1)}° ${centerLat >= 0 ? 'N' : 'S'}`,
      lng: `${Math.abs(centerLng).toFixed(1).padStart(5, '0')}° ${centerLng >= 0 ? 'E' : 'W'}`
    });
  };

  return (
    <div ref={wrapperRef} className="relative flex flex-1 min-h-0 w-full items-center justify-center select-none">
      {/* Static Engraved Brass Meridian & Compass Rose SVG Frame */}
      <svg
        aria-hidden="true"
        viewBox="0 0 420 420"
        style={{ width: canvasSize * 1.08, height: canvasSize * 1.08 }}
        className="pointer-events-none absolute"
      >
        <circle
          cx="210"
          cy="210"
          r="194"
          fill="none"
          stroke="rgba(233, 196, 106, 0.35)"
          strokeWidth="1.2"
          strokeDasharray="4 8"
        />
        <polygon points="210,8 214,18 206,18" fill="#E9C46A" />
        <polygon points="412,210 402,214 402,206" fill="#E9C46A" />
        <polygon points="210,412 214,402 206,402" fill="#E9C46A" />
        <polygon points="8,210 18,214 18,206" fill="#E9C46A" />
        <circle cx="210" cy="210" r="178" fill="none" stroke="rgba(246, 239, 226, 0.16)" strokeWidth="1" />
        <text x="210" y="29" textAnchor="middle" className="fill-[#E9C46A] font-serif text-[11px] font-bold">
          N
        </text>
        <text x="395" y="213" textAnchor="middle" className="fill-[#F6EFE2]/60 font-serif text-[11px] font-bold">
          E
        </text>
        <text x="210" y="401" textAnchor="middle" className="fill-[#F6EFE2]/60 font-serif text-[11px] font-bold">
          S
        </text>
        <text x="25" y="213" textAnchor="middle" className="fill-[#F6EFE2]/60 font-serif text-[11px] font-bold">
          W
        </text>
      </svg>

      {/* Interactive 3D Political Globe Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Drag to spin the political globe"
        style={{ width: canvasSize, height: canvasSize }}
        className="relative z-10 cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Bearing Tag */}
      <div className="pointer-events-none absolute left-2 top-1.5 z-20 rounded-xl border border-[#E9C46A]/35 bg-[#102637] px-2.5 py-1">
        <span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-[#E9C46A]">
          {targetCoords ? `Sector · ${targetLabel}` : `Spotlight · ${spotlightName}`}
        </span>
        <span className="font-mono text-[10px] font-semibold tabular-nums text-[#F6EFE2]">
          {hudBearing.lat} · {hudBearing.lng}
        </span>
      </div>

      <div className="pointer-events-none absolute right-2 bottom-1.5 z-20 rounded-full border border-[#F6EFE2]/20 bg-[#102637] px-2.5 py-0.5 text-[9px] font-semibold text-[#F6EFE2]/80">
        Drag to spin
      </div>
    </div>
  );
};

/* ── Main Viewport-Locked Front Page Component ──────────────────────────── */

const VelocityHome: React.FC<HomeViewProps> = (props) => {
  const {
    srsItemsMap,
    stats,
    settings,
    mapMode,
    onToggleMapMode,
    selectedAttributes,
    isSyncing,
    syncStatusMessage,
    onStartSession,
    onOpenAtlas,
    onOpenArcade,
    onToggleAttribute,
    onToggleSound,
    onSyncGitHub,
    onExportBackup,
    onImportBackup,
    onSaveGithubToken
  } = props;

  const data = useHomeData(srsItemsMap, stats, selectedAttributes);
  const due = useDueBreakdown(srsItemsMap, [
    'capital',
    'capital_to_country',
    'location',
    'country',
    'flag'
  ]);

  const [revealCapital, setRevealCapital] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(settings.githubSyncToken || '');

  const [activeRegionLock, setActiveRegionLock] = useState<{
    id: string;
    label: string;
    coords: [number, number];
  } | null>(null);

  const dueValue = useCountUp(data.totalDueCount, 650);

  const [selectedHorizonCategory, setSelectedHorizonCategory] = useState<HorizonCategory | null>(null);
  const [horizonAttrFilter, setHorizonAttrFilter] = useState<
    'all' | 'capital' | 'capital_to_country' | 'location' | 'country' | 'flag'
  >('all');
  const [horizonSearch, setHorizonSearch] = useState('');
  const [revealHorizonCapitals, setRevealHorizonCapitals] = useState(false);
  const [isHorizonModalOpen, setIsHorizonModalOpen] = useState(false);
  const [modalContinentFilter, setModalContinentFilter] = useState<TrainingCategory>('All');
  const [albumPage, setAlbumPage] = useState(1);
  const albumScrollRef = useRef<HTMLDivElement | null>(null);

  // 4-Stage Remembrance Progression Timeline state
  const [timelineAttrFilter, setTimelineAttrFilter] = useState<
    'all' | 'capital' | 'capital_to_country' | 'location' | 'country' | 'flag'
  >('all');
  const [timelineRange, setTimelineRange] = useState<'7d' | '14d' | '30d' | 'all'>('14d');
  const [timelineScaleMode, setTimelineScaleMode] = useState<'full' | 'active'>('full');
  const [hoveredTimelineIdx, setHoveredTimelineIdx] = useState<number | null>(null);

  const timelinePlotRef = useRef<HTMLDivElement | null>(null);
  const [timelinePlotSize, setTimelinePlotSize] = useState<{ width: number; height: number }>({
    width: 420,
    height: 150
  });

  useEffect(() => {
    const el = timelinePlotRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.max(200, Math.round(el.clientWidth));
      const h = Math.max(90, Math.round(el.clientHeight));
      setTimelinePlotSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * Card-deck peek: how much room each category drawer has to work with.
   * The five showcased cards share that height, so their tops stay readable.
   */
  const deckStackRef = useRef<HTMLDivElement | null>(null);
  const [deckAreaHeight, setDeckAreaHeight] = useState(0);

  useEffect(() => {
    const el = deckStackRef.current;
    if (!el) return;
    const measure = () => setDeckAreaHeight(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const openTrophyAlbum = useCallback((cat: HorizonCategory | null) => {
    soundFx.playClick();
    setSelectedHorizonCategory(cat);
    setAlbumPage(1);
    setIsHorizonModalOpen(true);
    requestAnimationFrame(() => {
      if (albumScrollRef.current) albumScrollRef.current.scrollTop = 0;
    });
  }, []);

  const horizonCatalog = useMemo(() => {
    const nowIso = new Date().toISOString();
    const byCategory: Record<HorizonCategory, HorizonCardEntry[]> = {
      mastered: [],
      recall: [],
      learning: [],
      unseen: []
    };

    const nowMs = Date.now();
    const categorizeItem = (item?: SRSItem): {
      category: HorizonCategory;
      statusBadge: string;
      shortBadge: string;
      trophyGlyph: string;
      isDue: boolean;
    } => {
      if (!item) {
        return {
          category: 'unseen',
          statusBadge: 'Unseen',
          shortBadge: 'New',
          trophyGlyph: '✨',
          isDue: true
        };
      }
      const isDue = item.nextDueAt <= nowIso || item.intervalDays === 0;
      const bucket = classifyCardHorizon(item);
      const S = inferStability(item);
      const R = Math.round(computeRetrievability(item, nowMs) * 100);

      if (bucket === 'mastered') {
        return {
          category: 'mastered',
          statusBadge: `S:${Math.round(S)}d · R:${R}%`,
          shortBadge: `S:${Math.round(S)}d`,
          trophyGlyph: '🏆',
          isDue
        };
      }
      if (bucket === 'recall') {
        return {
          category: 'recall',
          statusBadge: `S:${S.toFixed(1)}d · R:${R}%`,
          shortBadge: `S:${S.toFixed(1)}d`,
          trophyGlyph: '⚡',
          isDue
        };
      }
      if (item.stage === 1) {
        return {
          category: 'learning',
          statusBadge: `S:${S.toFixed(1)}d Recall`,
          shortBadge: `S:${S.toFixed(1)}d`,
          trophyGlyph: '🧭',
          isDue
        };
      }
      return {
        category: 'learning',
        statusBadge: 'L0 Recognition',
        shortBadge: 'L0',
        trophyGlyph: '🧭',
        isDue
      };
    };

    for (const country of COUNTRIES) {
      for (const attr of ['capital', 'capital_to_country', 'location', 'country', 'flag'] as const) {
        const cardId = `${country.id}:${attr}`;
        const item = srsItemsMap.get(cardId);
        const { category, statusBadge, shortBadge, trophyGlyph, isDue } = categorizeItem(item);
        const attributeGlyph =
          attr === 'capital'
            ? '🏛️'
            : attr === 'capital_to_country'
            ? '🏙️'
            : attr === 'location'
            ? '🧭'
            : attr === 'country'
            ? '🗺️'
            : '🏳️';
        const attributeLabel =
          attr === 'capital'
            ? 'Country → Capital'
            : attr === 'capital_to_country'
            ? 'Capital → Country'
            : attr === 'location'
            ? 'Name → Map'
            : attr === 'country'
            ? 'Map → Name'
            : 'Flag';
        byCategory[category].push({
          id: cardId,
          entityId: country.id,
          entityName: country.name,
          plateCode: `#${country.numericId} · ${country.id}`,
          flagOrEmblem: country.flagEmoji,
          continent: country.continent,
          subregion: country.subregion || country.continent,
          coordText: formatCoordinates(country.coordinates),
          attribute: attr,
          attributeGlyph,
          attributeLabel,
          answerText:
            attr === 'capital'
              ? country.capital
              : attr === 'capital_to_country'
              ? `${country.capital} → ${country.name}`
              : attr === 'location'
              ? country.subregion || country.continent
              : country.name,
          capitalText: country.capital,
          coordinates: country.coordinates,
          category,
          statusBadge,
          shortBadge,
          trophyGlyph,
          isDue,
          lastReviewedAt: item?.lastReviewedAt || null,
          reps: item?.reps || 0,
          intervalDays: item?.intervalDays || 0
        });
      }
    }

    for (const wb of WATER_BODIES) {
      const cardId = `${wb.id}:location`;
      const item = srsItemsMap.get(cardId);
      const { category, statusBadge, shortBadge, trophyGlyph, isDue } = categorizeItem(item);
      const typeLabel = wb.type.charAt(0).toUpperCase() + wb.type.slice(1);
      byCategory[category].push({
        id: cardId,
        entityId: wb.id,
        entityName: wb.name,
        plateCode: `SEA · ${wb.type.toUpperCase()}`,
        flagOrEmblem: '🌊',
        continent: 'Oceans',
        subregion: `${typeLabel} · Oceans`,
        coordText: formatCoordinates(wb.coordinates),
        attribute: 'location',
        attributeGlyph: '🌊',
        attributeLabel: 'Maritime',
        answerText: typeLabel,
        coordinates: wb.coordinates,
        category,
        statusBadge,
        shortBadge,
        trophyGlyph,
        isDue,
        lastReviewedAt: item?.lastReviewedAt || null,
        reps: item?.reps || 0,
        intervalDays: item?.intervalDays || 0
      });
    }

    const sortActive = (a: HorizonCardEntry, b: HorizonCardEntry) => {
      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
      const tA = a.lastReviewedAt || '';
      const tB = b.lastReviewedAt || '';
      if (tA !== tB) return tB.localeCompare(tA);
      return a.entityName.localeCompare(b.entityName);
    };

    byCategory.recall.sort(sortActive);
    byCategory.learning.sort(sortActive);
    byCategory.mastered.sort((a, b) => {
      const tA = a.lastReviewedAt || '';
      const tB = b.lastReviewedAt || '';
      if (tA !== tB) return tB.localeCompare(tA);
      return a.entityName.localeCompare(b.entityName);
    });
    byCategory.unseen.sort((a, b) => a.entityName.localeCompare(b.entityName));

    const allCards = [
      ...byCategory.mastered,
      ...byCategory.recall,
      ...byCategory.learning,
      ...byCategory.unseen
    ];

    return {
      byCategory,
      allCards
    };
  }, [srsItemsMap]);

  const cardTelemetry = useMemo(() => {
    const byCategory: Record<
      HorizonCategory,
      {
        capital: number;
        capital_to_country: number;
        location: number;
        country: number;
        flag: number;
        total: number;
      }
    > = {
      mastered: { capital: 0, capital_to_country: 0, location: 0, country: 0, flag: 0, total: 0 },
      recall: { capital: 0, capital_to_country: 0, location: 0, country: 0, flag: 0, total: 0 },
      learning: { capital: 0, capital_to_country: 0, location: 0, country: 0, flag: 0, total: 0 },
      unseen: { capital: 0, capital_to_country: 0, location: 0, country: 0, flag: 0, total: 0 }
    };

    for (const cat of HORIZON_CATEGORY_ORDER) {
      for (const card of horizonCatalog.byCategory[cat]) {
        byCategory[cat][card.attribute] += 1;
        byCategory[cat].total += 1;
      }
    }

    const mastered = byCategory.mastered.total;
    const recall = byCategory.recall.total;
    const learning = byCategory.learning.total;
    const unseen = byCategory.unseen.total;
    const total = horizonCatalog.allCards.length;

    return {
      mastered,
      recall,
      learning,
      unseen,
      total,
      byCategory
    };
  }, [horizonCatalog]);

  const horizonMasteryPct =
    cardTelemetry.total > 0 ? Math.round((cardTelemetry.mastered / cardTelemetry.total) * 100) : 0;
  const masteryValue = useCountUp(horizonMasteryPct);

  const ringRadius = 28;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (masteryValue / 100) * ringCircumference;

  /**
   * Card-deck peek per category drawer.
   * Non-empty drawers expose the top edges of their next cards; an empty drawer
   * surfaces the card that is next in line to enter it (recall -> mastered,
   * learning -> recall, unseen -> learning) so the column never reads as broken.
   */
  const deckSlotCount = useMemo(
    () => Math.max(DECK_MAX_CARDS, Math.min(9, Math.round(deckAreaHeight / 58))),
    [deckAreaHeight]
  );

  const horizonDeckPeek = useMemo(
    () =>
      HORIZON_CATEGORY_ORDER.map((category) => {
        const cards = horizonCatalog.byCategory[category];
        const nextInLine =
          category === 'mastered'
            ? horizonCatalog.byCategory.recall[0] ?? null
            : category === 'recall'
              ? horizonCatalog.byCategory.learning[0] ?? null
              : category === 'learning'
                ? horizonCatalog.byCategory.unseen[0] ?? null
                : null;

        return {
          category,
          cards: cards.slice(0, deckSlotCount),
          hasCards: cards.length > 0,
          nextInLine
        };
      }),
    [horizonCatalog, deckSlotCount]
  );

  const modalHorizonCards = useMemo(() => {
    const query = horizonSearch.trim().toLowerCase();
    const baseList =
      selectedHorizonCategory !== null
        ? horizonCatalog.byCategory[selectedHorizonCategory]
        : horizonCatalog.allCards;

    return baseList.filter((card) => {
      if (modalContinentFilter !== 'All' && card.continent !== modalContinentFilter) return false;
      if (horizonAttrFilter !== 'all' && card.attribute !== horizonAttrFilter) return false;
      if (query.length > 0) {
        const matchEntity = card.entityName.toLowerCase().includes(query);
        const matchSub = card.subregion.toLowerCase().includes(query);
        const matchAnswer = card.answerText.toLowerCase().includes(query);
        if (!matchEntity && !matchSub && !matchAnswer) return false;
      }
      return true;
    });
  }, [horizonCatalog, selectedHorizonCategory, modalContinentFilter, horizonAttrFilter, horizonSearch]);

  const spotlightCapItem = srsItemsMap.get(`${data.spotlight.id}:capital`);
  const spotlightLocItem = srsItemsMap.get(`${data.spotlight.id}:location`);

  const getSpotlightCardBadge = (item?: SRSItem) => {
    if (!item) {
      return {
        label: 'Unseen',
        cls: 'border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]'
      };
    }
    const bucket = classifyCardHorizon(item);
    const S = inferStability(item);
    if (bucket === 'mastered') {
      return {
        label: `Mastered (S:${Math.round(S)}d)`,
        cls: 'border-[#10B981]/30 bg-[#10B981]/15 text-[#10B981]'
      };
    }
    if (bucket === 'recall') {
      return {
        label: `Recall (S:${S.toFixed(1)}d)`,
        cls: 'border-[#E9C46A]/30 bg-[#E9C46A]/15 text-[#E9C46A]'
      };
    }
    return {
      label: item.stage === 0 ? 'L0 Recognition' : `Learning (S:${S.toFixed(1)}d)`,
      cls: 'border-[#F4A261]/30 bg-[#F4A261]/10 text-[#F4A261]'
    };
  };

  const capBadge = getSpotlightCardBadge(spotlightCapItem);
  const locBadge = getSpotlightCardBadge(spotlightLocItem);

  const attributeTelemetry = useMemo(() => {
    const buildAttrStats = (
      attr: 'capital' | 'capital_to_country' | 'location' | 'country' | 'flag',
      total: number
    ) => {
      const mastered = cardTelemetry.byCategory.mastered[attr];
      const recall = cardTelemetry.byCategory.recall[attr];
      const learning = cardTelemetry.byCategory.learning[attr];
      const unseen = cardTelemetry.byCategory.unseen[attr];
      return {
        mastered,
        recall,
        learning,
        unseen,
        total,
        pct: Math.round((mastered / total) * 100)
      };
    };

    const capTotal = COUNTRIES.length;
    const locTotal = COUNTRIES.length + WATER_BODIES.length;
    return {
      capital: buildAttrStats('capital', capTotal),
      capital_to_country: buildAttrStats('capital_to_country', capTotal),
      location: buildAttrStats('location', locTotal),
      country: buildAttrStats('country', capTotal),
      flag: buildAttrStats('flag', capTotal)
    };
  }, [cardTelemetry]);

  /**
   * Reconstructs the longitudinal 4-stage remembrance progression (Mastered, Recall, Learning, Unseen)
   * across the selected time window and attribute filter directly from persisted SRS history & timestamps.
   */
  const remembranceTimeline = useMemo(() => {
    const targetAttrs: Array<'capital' | 'capital_to_country' | 'location' | 'country' | 'flag'> =
      timelineAttrFilter === 'all'
        ? ['capital', 'capital_to_country', 'location', 'country', 'flag']
        : [timelineAttrFilter];

    const cardIds: string[] = [];
    for (const c of COUNTRIES) {
      for (const attr of targetAttrs) {
        cardIds.push(`${c.id}:${attr}`);
      }
    }
    if (targetAttrs.includes('location')) {
      for (const wb of WATER_BODIES) {
        cardIds.push(`${wb.id}:location`);
      }
    }

    const totalCards = cardIds.length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    let numDays = timelineRange === '7d' ? 7 : timelineRange === '14d' ? 14 : timelineRange === '30d' ? 30 : 14;
    if (timelineRange === 'all') {
      let earliestMs = todayStartMs;
      for (const id of cardIds) {
        const item = srsItemsMap.get(id);
        if (!item) continue;
        if (item.history && item.history.length > 0) {
          const t0 = Date.parse(item.history[0].timestamp);
          if (!Number.isNaN(t0) && t0 < earliestMs) earliestMs = t0;
        } else if (item.lastReviewedAt) {
          const tl = Date.parse(item.lastReviewedAt);
          if (!Number.isNaN(tl)) {
            const est = tl - Math.max(1, (item.reps || 1) - 1) * 86400000;
            if (est < earliestMs) earliestMs = est;
          }
        }
      }
      const spanDays = Math.ceil((todayStartMs - earliestMs) / 86400000) + 2;
      numDays = Math.max(10, Math.min(45, spanDays));
    }

    const points = Array.from({ length: numDays }, (_, idx) => {
      const dayStartMs = todayStartMs - (numDays - 1 - idx) * 86400000;
      const dayEndMs = dayStartMs + 86400000 - 1;
      const d = new Date(dayStartMs);
      const isToday = idx === numDays - 1;
      const shortMonthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        idx,
        dayStartMs,
        dayEndMs,
        dateLabel: isToday ? `Today · ${shortMonthDay}` : shortMonthDay,
        shortLabel: isToday ? 'Today' : shortMonthDay,
        mastered: 0,
        recall: 0,
        learning: 0,
        unseen: 0,
        reviews: 0
      };
    });

    for (const id of cardIds) {
      const item = srsItemsMap.get(id);
      if (!item) {
        for (let i = 0; i < numDays; i++) {
          points[i].unseen += 1;
        }
        continue;
      }

      const finalBucket = classifyCardHorizon(item);
      const histTimes = (item.history || [])
        .map((h) => Date.parse(h.timestamp))
        .filter((t) => !Number.isNaN(t))
        .sort((a, b) => a - b);
      const lastRevMs = item.lastReviewedAt ? Date.parse(item.lastReviewedAt) : NaN;

      // Count daily reviews in window
      if (histTimes.length > 0) {
        for (const t of histTimes) {
          const dayOffset = Math.floor((t - points[0].dayStartMs) / 86400000);
          if (dayOffset >= 0 && dayOffset < numDays) {
            points[dayOffset].reviews += 1;
          }
        }
      } else if (!Number.isNaN(lastRevMs)) {
        const dayOffset = Math.floor((lastRevMs - points[0].dayStartMs) / 86400000);
        if (dayOffset >= 0 && dayOffset < numDays) {
          points[dayOffset].reviews += 1;
        }
      }

      const firstSeenMs =
        histTimes.length > 0
          ? histTimes[0]
          : !Number.isNaN(lastRevMs)
          ? lastRevMs - Math.max(1, (item.reps || 1) - 1) * 86400000 * 1.25
          : todayStartMs;

      const masteredMs =
        !Number.isNaN(lastRevMs)
          ? lastRevMs
          : histTimes.length > 0
          ? histTimes[histTimes.length - 1]
          : todayStartMs;

      const recallMs =
        histTimes.length >= 2
          ? histTimes[1]
          : firstSeenMs + Math.max(0, (masteredMs - firstSeenMs) * 0.45);

      for (let i = 0; i < numDays; i++) {
        if (i === numDays - 1) {
          points[i][finalBucket] += 1;
        } else {
          const t = points[i].dayEndMs;
          if (t < firstSeenMs) {
            points[i].unseen += 1;
          } else if (finalBucket === 'mastered' && t >= masteredMs) {
            points[i].mastered += 1;
          } else if ((finalBucket === 'mastered' || finalBucket === 'recall') && t >= recallMs) {
            points[i].recall += 1;
          } else {
            points[i].learning += 1;
          }
        }
      }
    }

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const masteredDelta = lastPt.mastered - firstPt.mastered;
    const recallDelta = lastPt.recall - firstPt.recall;
    const learningDelta = lastPt.learning - firstPt.learning;
    const unseenDelta = lastPt.unseen - firstPt.unseen;
    const activeTotal = lastPt.mastered + lastPt.recall + lastPt.learning;
    const maxActiveInWindow = Math.max(
      ...points.map((p) => p.mastered + p.recall + p.learning),
      Math.ceil(totalCards * 0.15)
    );
    const maxReviews = Math.max(1, ...points.map((p) => p.reviews));
    const totalReviewsInWindow = points.reduce((acc, p) => acc + p.reviews, 0);

    return {
      points,
      totalCards,
      masteredDelta,
      recallDelta,
      learningDelta,
      unseenDelta,
      activeTotal,
      maxActiveInWindow,
      maxReviews,
      totalReviewsInWindow
    };
  }, [srsItemsMap, timelineAttrFilter, timelineRange]);

  const focusOptions = [
    {
      attr: 'capital' as const,
      label: 'Country → Capital',
      subtitle: 'Name the capital city',
      detail: `${due.capital} due`,
      glyph: '🏛️',
      spanCls: 'col-span-3',
      ...attributeTelemetry.capital
    },
    {
      attr: 'capital_to_country' as const,
      label: 'Capital → Country',
      subtitle: 'Name nation from capital',
      detail: `${due.capital_to_country} due`,
      glyph: '🏙️',
      spanCls: 'col-span-3',
      ...attributeTelemetry.capital_to_country
    },
    {
      attr: 'location' as const,
      label: 'Name → Map',
      subtitle: 'Pinpoint on map',
      detail: `${due.location} due`,
      glyph: '🧭',
      spanCls: 'col-span-2',
      ...attributeTelemetry.location
    },
    {
      attr: 'country' as const,
      label: 'Map → Name',
      subtitle: 'Name highlighted nation',
      detail: `${due.country} due`,
      glyph: '🗺️',
      spanCls: 'col-span-2',
      ...attributeTelemetry.country
    },
    {
      attr: 'flag' as const,
      label: 'Flags',
      subtitle: 'Name nation from flag',
      detail: `${due.flag} due`,
      glyph: '🏳️',
      spanCls: 'col-span-2',
      ...attributeTelemetry.flag
    }
  ];

  const handlePronounceSpotlightCapital = () => {
    soundFx.playClick();
    if (data.spotlight.name && data.spotlight.capital) {
      speechEngine.speakCountryAndCapital(data.spotlight.name, data.spotlight.capital);
    } else {
      speechEngine.speak(data.spotlight.capital);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0F2536] text-[#F6EFE2] selection:bg-[#D94E34]/30 selection:text-[#F6EFE2] flex flex-col">
      {/* Pure CSS radial gradient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,#1D4763_0%,#112A3D_55%,#0B1C2A_100%)]"
      />

      {/* ══ LOCKED VIEWPORT CONTAINER (Zero Vertical Scroll) ══════════════ */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1840px] flex-col justify-between gap-2.5 px-4 py-2.5 sm:px-6 overflow-hidden">
        {/* ── 1. TOP ATELIER RIBBON (Shrink-0) ─────────────────────────── */}
        <header className="relative shrink-0 flex items-center justify-between gap-3 rounded-2xl border border-[#F6EFE2]/15 bg-[#153348] px-4 py-2 shadow-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#E9C46A]" />
              <span className={`${serifDisplay} text-sm font-bold italic text-[#F6EFE2]`}>
                L’Atelier Cartographique
              </span>
            </div>

            <span className="hidden h-4 w-px bg-[#F6EFE2]/15 sm:block" />

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#E9C46A]/20 border border-[#E9C46A]/45 px-2.5 py-0.5 text-[11px] font-bold text-[#F6EFE2]">
                Rank {data.rank.level} · {data.rank.title}
              </span>
              <div className="hidden items-center gap-2 md:flex">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-[#0C1F2D]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#E9C46A] to-[#D94E34] transition-all duration-700"
                    style={{ width: `${data.rank.progress}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] font-semibold text-[#D6CBB9]">
                  {data.rank.xp.toLocaleString()} / {data.rank.nextXP.toLocaleString()} XP
                </span>
              </div>
            </div>

            {syncStatusMessage && (
              <span className="rounded-full bg-[#2A9D8F]/25 border border-[#2A9D8F]/50 px-3 py-0.5 text-[11px] font-bold text-[#A7F3D0]">
                {syncStatusMessage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Streak Pill */}
            <div className="flex items-center gap-1.5 rounded-full bg-[#D94E34] px-3 py-1 text-xs font-extrabold text-[#FFF8E7] shadow-sm">
              <Flame className="h-3.5 w-3.5 fill-current" />
              <span>{stats.currentStreak}d Streak</span>
            </div>

            {/* 2D / 3D Map Projection Switcher */}
            <div className="flex items-center rounded-full border border-[#F6EFE2]/15 bg-[#0E2231] p-0.5">
              <button
                onClick={() => onToggleMapMode('2d')}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                  mapMode === '2d'
                    ? 'bg-[#F6EFE2] text-[#142534] shadow-sm'
                    : 'text-[#D6CBB9] hover:text-white'
                }`}
                title="Use 2D Flat Map Projection"
              >
                <MapIcon className="h-3 w-3" />
                <span>2D Map</span>
              </button>
              <button
                onClick={() => onToggleMapMode('3d')}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                  mapMode === '3d'
                    ? 'bg-[#F6EFE2] text-[#142534] shadow-sm'
                    : 'text-[#D6CBB9] hover:text-white'
                }`}
                title="Use 3D Rotating Globe"
              >
                <Globe2 className="h-3 w-3" />
                <span>3D Globe</span>
              </button>
            </div>

            {/* Sync & Backup Controls */}
            <button
              onClick={onSyncGitHub}
              title={isSyncing ? 'Syncing…' : 'Sync progress with GitHub'}
              aria-label="Sync progress with GitHub"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] transition-colors hover:border-[#E9C46A] hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-[#E9C46A]' : ''}`} />
            </button>

            <button
              onClick={() => setShowToken((v) => !v)}
              title="GitHub cloud sync token"
              aria-label="GitHub cloud sync token"
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                settings.githubSyncToken
                  ? 'border-[#E9C46A] bg-[#E9C46A]/20 text-[#E9C46A]'
                  : 'border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] hover:border-[#F6EFE2]/40 hover:text-white'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={onExportBackup}
              title="Export backup (JSON)"
              aria-label="Export backup"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] transition-colors hover:border-[#F6EFE2]/40 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            <label
              title="Import backup (JSON)"
              aria-label="Import backup"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] transition-colors hover:border-[#F6EFE2]/40 hover:text-white"
            >
              <Upload className="h-3.5 w-3.5" />
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportBackup(file);
                }}
              />
            </label>
          </div>

          {/* Floating Popover for GitHub Token (Never shifts page height) */}
          {showToken && (
            <div className="absolute right-4 top-12 z-50 w-96 rounded-2xl border-2 border-[#E9C46A] bg-[#153348] p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#E9C46A]">
                  GitHub Two-Way Sync Token
                </span>
                <button
                  onClick={() => setShowToken(false)}
                  className="text-xs font-semibold text-[#D6CBB9] hover:text-white"
                >
                  Close
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#D6CBB9]">
                Add a Personal Access Token (<code className="font-mono text-[#E9C46A]">repo</code> scope) to push
                progress updates from any device.
              </p>
              <div className="mt-2.5 flex gap-2">
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  className="flex-1 rounded-xl border border-[#F6EFE2]/20 bg-[#0E2231] px-3 py-1.5 font-mono text-xs text-white placeholder:text-slate-500 focus:border-[#E9C46A] focus:outline-none"
                />
                <button
                  onClick={() => {
                    onSaveGithubToken(tokenDraft.trim());
                    setShowToken(false);
                  }}
                  className="rounded-xl bg-[#D94E34] px-4 py-1.5 text-xs font-extrabold text-white hover:bg-[#E05A47]"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </header>

        {/* ── 2. MAIN 12-COLUMN BENTO GRID (Fits 100% in Remaining Height) ═ */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-3.5 overflow-hidden">
          {/* ══ LEFT COLUMN (5 Cols): 3 PURPOSEFUL STACKED SECTIONS ══ */}
          <div className="col-span-12 lg:col-span-5 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden">
            {/* Section 1: Expedition Launch Deck (Content-Sized, Zero Dead Space) */}
            <div className="relative flex shrink-0 flex-col gap-3 overflow-hidden rounded-[1.4rem] border border-[#F6EFE2]/15 bg-gradient-to-b from-[#132D42] to-[#0E2233] p-4 text-[#F6EFE2] shadow-xl">
              {/* Top Header */}
              <div className="shrink-0">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D94E34]/35 bg-[#D94E34]/15 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F4A261]">
                  <Sparkles className="h-3 w-3 text-[#E9C46A]" />
                  <span>
                    {data.totalDueCount > 0
                      ? `${dueValue} Unlearned & Due Cards Ready · Smart SRS Active`
                      : 'Spaced Queue Caught Up · Free Practice Active'}
                  </span>
                </div>

                <h1 className={`${serifDisplay} mt-1.5 text-2xl xl:text-[1.75rem] font-black leading-tight tracking-tight text-[#F6EFE2]`}>
                  Learn the World <span className="italic font-bold text-[#E9C46A]">by Heart.</span>
                </h1>

                <p className="mt-1 text-xs font-medium leading-snug text-[#9FB3C4]">
                  FSRS-6 DSR & ACT-R latency scheduling adapts stability (S) and retrievability (R) per card while weaving in long-term retention checks.
                </p>
              </div>

              {/* 5-Mode Interactive Study Focus Deck (2-Row Paired Grid) */}
              <div className="grid shrink-0 grid-cols-6 gap-1.5">
                {focusOptions.map((opt) => {
                  const active = selectedAttributes.includes(opt.attr);
                  return (
                    <button
                      key={opt.attr}
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        onToggleAttribute(opt.attr);
                      }}
                      aria-pressed={active}
                      className={`${opt.spanCls} group relative flex flex-col justify-between gap-1.5 overflow-hidden rounded-xl border px-2.5 py-1.5 text-left transition-all cursor-pointer active:scale-[0.98] ${
                        active
                          ? 'border-[#E9C46A]/65 bg-gradient-to-b from-[#E9C46A]/18 to-[#0C1D2B]/90 text-[#F6EFE2] shadow-sm'
                          : 'border-[#F6EFE2]/15 bg-[#0C1D2B]/70 text-[#9FB3C4] opacity-75 hover:border-[#F6EFE2]/35 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-sm ${
                              active
                                ? 'border-[#E9C46A]/50 bg-[#091622] shadow-inner'
                                : 'border-[#F6EFE2]/10 bg-[#091622]/60'
                            }`}
                          >
                            {opt.glyph}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="truncate text-xs font-extrabold text-[#F6EFE2]">
                                {opt.label}
                              </span>
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                  active ? 'bg-[#E9C46A]' : 'bg-[#8FA6B8]/40'
                                }`}
                              />
                            </div>
                            <p className="truncate text-[9px] font-medium text-[#9FB3C4]">
                              {opt.subtitle}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-extrabold ${
                            active
                              ? 'bg-[#E9C46A] text-[#142534]'
                              : 'bg-[#153247] text-[#9FB3C4]'
                          }`}
                        >
                          {opt.detail}
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-2"
                        title={`Mastered: ${opt.mastered} · Recall: ${opt.recall} · Learning: ${opt.learning} · Unseen: ${opt.unseen}`}
                      >
                        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-[#091622] p-[1px]">
                          <div
                            className="h-full bg-[#10B981] transition-all duration-500"
                            style={{ width: `${(opt.mastered / opt.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-[#E9C46A] transition-all duration-500"
                            style={{ width: `${(opt.recall / opt.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-[#F4A261] transition-all duration-500"
                            style={{ width: `${(opt.learning / opt.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-[#38BDF8]/40 transition-all duration-500"
                            style={{ width: `${(opt.unseen / opt.total) * 100}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-[9px] font-bold text-[#9FB3C4]">
                          {opt.mastered}/{opt.total} ({opt.pct}%)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Primary Hero CTA: Start Training */}
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                }}
                className="group shrink-0 flex w-full items-center justify-center gap-3 rounded-xl border border-[#F4A261]/55 bg-gradient-to-r from-[#E05A3D] via-[#D94E34] to-[#BB3D24] px-5 py-3 text-sm xl:text-base font-black uppercase tracking-[0.07em] text-[#FFF8E7] shadow-[0_10px_24px_-10px_rgba(217,78,52,0.95)] transition-all hover:brightness-110 hover:shadow-[0_12px_28px_-8px_rgba(217,78,52,1)] active:scale-[0.985] cursor-pointer"
              >
                <Play className="h-4 w-4 xl:h-5 xl:w-5 shrink-0 fill-current transition-transform group-hover:translate-x-0.5" />
                <span>{data.isCaughtUp('All') ? 'Practice World' : 'Start Training'}</span>
                <span className="rounded-full bg-black/30 px-2.5 py-0.5 font-mono text-xs font-bold">
                  {data.isCaughtUp('All') ? data.totalWorldEntities : dueValue}
                </span>
              </button>

              {/* Secondary Deck Shortcuts */}
              <div className="shrink-0 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenAtlas}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#F6EFE2]/15 bg-[#0C1D2B] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.05em] text-[#F6EFE2] transition-colors hover:border-[#E9C46A] hover:text-[#E9C46A] cursor-pointer"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Atlas</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenArcade}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D94E34]/40 bg-[#D94E34]/15 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.05em] text-[#F6EFE2] transition-colors hover:bg-[#D94E34]/30 cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 fill-[#D94E34] text-[#D94E34]" />
                  <span>Arcade</span>
                </button>
              </div>
            </div>

            {/* Section 2: Memory Horizon & Smart Queue Intelligence Card (Flex-1, Absorbs Free Height) */}
            <div className="relative flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden rounded-[1.4rem] border border-[#F6EFE2]/15 bg-gradient-to-b from-[#132D42] to-[#0E2233] p-4 text-[#F6EFE2] shadow-xl">
              {/* Header + Mastery Ring */}
              <div className="shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Compact SVG Ring */}
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                    <svg className="h-11 w-11 -rotate-90" viewBox="0 0 68 68">
                      <circle cx="34" cy="34" r={ringRadius} stroke="#0C1D2B" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="34"
                        cy="34"
                        r={ringRadius}
                        stroke="#10B981"
                        strokeWidth="6"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-xs font-extrabold leading-none text-[#F6EFE2]">
                        {masteryValue}%
                      </span>
                      <span className="text-[7px] font-extrabold uppercase tracking-wider text-[#10B981]">
                        Mastery
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-[#F6EFE2] flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-[#10B981]" />
                      Global Memory Horizon
                    </span>
                    <p className="text-[11px] font-medium text-[#9FB3C4]">
                      {cardTelemetry.mastered} of {cardTelemetry.total} cards mastered in long-term memory
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-[#10B981] px-2.5 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/30">
                    {cardTelemetry.mastered + cardTelemetry.recall}/{cardTelemetry.total}
                  </span>
                  <button
                    type="button"
                    onClick={() => openTrophyAlbum(selectedHorizonCategory || 'mastered')}
                    title="Open Cartographer's Trophy Album"
                    className="flex items-center gap-1 rounded-full border border-[#E9C46A]/40 bg-[#E9C46A]/15 px-2.5 py-1 text-[10px] font-extrabold text-[#E9C46A] transition-all hover:bg-[#E9C46A] hover:text-[#142534] active:scale-95 cursor-pointer"
                  >
                    <Trophy className="h-3 w-3" />
                    <span className="hidden sm:inline">Album</span>
                  </button>
                </div>
              </div>

              {/* 4-Stage Segmented Progress Bar + Clickable Category Tiles (Opens Trophy Album) */}
              <div className="shrink-0 flex flex-col gap-1.5">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-[#0C1D2B] p-0.5 shadow-inner">
                  <div
                    onClick={() => openTrophyAlbum('mastered')}
                    className="h-full cursor-pointer rounded-l-full bg-[#10B981] transition-all duration-500 hover:brightness-110"
                    style={{ width: `${(cardTelemetry.mastered / cardTelemetry.total) * 100}%` }}
                    title={`Click to open Mastered Trophy Album (${cardTelemetry.mastered} cards)`}
                  />
                  <div
                    onClick={() => openTrophyAlbum('recall')}
                    className="h-full cursor-pointer bg-[#E9C46A] transition-all duration-500 hover:brightness-110"
                    style={{ width: `${(cardTelemetry.recall / cardTelemetry.total) * 100}%` }}
                    title={`Click to open Recall Trophy Album (${cardTelemetry.recall} cards)`}
                  />
                  <div
                    onClick={() => openTrophyAlbum('learning')}
                    className="h-full cursor-pointer bg-[#F4A261] transition-all duration-500 hover:brightness-110"
                    style={{ width: `${(cardTelemetry.learning / cardTelemetry.total) * 100}%` }}
                    title={`Click to open Learning Trophy Album (${cardTelemetry.learning} cards)`}
                  />
                  <div
                    onClick={() => openTrophyAlbum('unseen')}
                    className="h-full cursor-pointer rounded-r-full bg-[#38BDF8]/40 transition-all duration-500 hover:brightness-110"
                    style={{ width: `${(cardTelemetry.unseen / cardTelemetry.total) * 100}%` }}
                    title={`Click to open Unseen Trophy Album (${cardTelemetry.unseen} cards)`}
                  />
                </div>

                {/* 4 Interactive Category Mini-Tiles -> Click Opens Trophy Album Sub-Window */}
                <div className="grid grid-cols-4 gap-1.5">
                  {HORIZON_CATEGORY_ORDER.map((cat) => {
                    const meta = HORIZON_CATEGORY_META[cat];
                    const catCounts = cardTelemetry.byCategory[cat];

                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => openTrophyAlbum(cat)}
                        title={`Click to open ${meta.label} Trophy Album (${catCounts.capital} Country → Capital, ${catCounts.capital_to_country} Capital → Country, ${catCounts.location} Name → Map, ${catCounts.country} Map → Name, ${catCounts.flag} Flags)`}
                        className={`group rounded-xl border px-2 py-1.5 text-left flex flex-col justify-between gap-1.5 transition-all cursor-pointer active:scale-[0.97] ${meta.tileIdleCls}`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className={`text-[10px] font-bold ${meta.textCls} flex items-center gap-1 min-w-0 truncate`}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotCls}`} />
                            <span className="truncate">{meta.label}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-0.5 text-[8px] font-extrabold uppercase tracking-wider text-[#9FB3C4] opacity-75 group-hover:opacity-100 group-hover:text-[#F6EFE2] transition-opacity">
                            <span>{meta.subtitle}</span>
                            <Maximize2 className="h-2 w-2" />
                          </span>
                        </div>
                        <div className="grid grid-cols-6 gap-1 w-full">
                          <div
                            title="Country → Capital"
                            className="col-span-3 flex items-center justify-between gap-1 rounded-md border border-[#F6EFE2]/10 bg-[#07131D]/80 px-1.5 py-0.5"
                          >
                            <span className="flex items-center gap-1 text-[8px] font-bold text-[#9FB3C4] truncate">
                              <span>🏛️</span>
                              <span className="truncate">C→Cap</span>
                            </span>
                            <span className="font-mono text-[10px] font-black leading-none text-[#F6EFE2]">
                              {catCounts.capital}
                            </span>
                          </div>
                          <div
                            title="Capital → Country"
                            className="col-span-3 flex items-center justify-between gap-1 rounded-md border border-[#F6EFE2]/10 bg-[#07131D]/80 px-1.5 py-0.5"
                          >
                            <span className="flex items-center gap-1 text-[8px] font-bold text-[#9FB3C4] truncate">
                              <span>🏙️</span>
                              <span className="truncate">Cap→C</span>
                            </span>
                            <span className="font-mono text-[10px] font-black leading-none text-[#F6EFE2]">
                              {catCounts.capital_to_country}
                            </span>
                          </div>
                          <div
                            title="Name → Map"
                            className="col-span-2 flex items-center justify-between gap-0.5 rounded-md border border-[#F6EFE2]/10 bg-[#07131D]/80 px-1 py-0.5"
                          >
                            <span className="text-[8px] font-bold text-[#9FB3C4]">🧭</span>
                            <span className="font-mono text-[9.5px] font-black leading-none text-[#F6EFE2]">
                              {catCounts.location}
                            </span>
                          </div>
                          <div
                            title="Map → Name"
                            className="col-span-2 flex items-center justify-between gap-0.5 rounded-md border border-[#F6EFE2]/10 bg-[#07131D]/80 px-1 py-0.5"
                          >
                            <span className="text-[8px] font-bold text-[#9FB3C4]">🗺️</span>
                            <span className="font-mono text-[9.5px] font-black leading-none text-[#F6EFE2]">
                              {catCounts.country}
                            </span>
                          </div>
                          <div
                            title="Flags"
                            className="col-span-2 flex items-center justify-between gap-0.5 rounded-md border border-[#F6EFE2]/10 bg-[#07131D]/80 px-1 py-0.5"
                          >
                            <span className="text-[8px] font-bold text-[#9FB3C4]">🏳️</span>
                            <span className="font-mono text-[9.5px] font-black leading-none text-[#F6EFE2]">
                              {catCounts.flag}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card-Deck Peek: top edges of the next cards in each category drawer.
                  The stack is clipped by the drawer height, so it always fills the space;
                  empty drawers advertise the card next in line instead of reading as broken. */}
              <div ref={deckStackRef} className="relative flex-1 min-h-0 grid grid-cols-4 gap-1.5">
                {horizonDeckPeek.map(({ category, cards, hasCards, nextInLine }) => {
                  const meta = HORIZON_CATEGORY_META[category];
                  const faceCard = hasCards ? cards[0] : nextInLine;
                  const sliverCards = hasCards ? cards.slice(1) : [];
                  const isGhostFace = !hasCards;
                  const isGlobeLocked = faceCard ? activeRegionLock?.id === faceCard.entityId : false;
                  const showAnswer =
                    faceCard?.attribute === 'location' || category === 'mastered' || revealHorizonCapitals;

                  /* The showcased cards share the drawer height, so cards stay readable */
                  const following = sliverCards.length;
                  const cardHeight = Math.min(
                    72,
                    Math.max(DECK_FACE_HEIGHT, Math.ceil(deckAreaHeight / deckSlotCount))
                  );
                  const peek =
                    following > 0
                      ? Math.min(
                          cardHeight,
                          Math.max(
                            DECK_MIN_PEEK,
                            Math.ceil((deckAreaHeight - cardHeight) / following)
                          )
                        )
                      : 0;
                  const showDissolve =
                    hasCards && following > 0 && cardHeight + following * peek >= deckAreaHeight - 6;

                  return (
                    <div key={category} className="relative min-h-0 flex flex-col overflow-hidden">
                      {faceCard ? (
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setActiveRegionLock({
                              id: faceCard.entityId,
                              label: faceCard.entityName,
                              coords: faceCard.coordinates
                            });
                          }}
                          title={
                            isGhostFace
                              ? `${DECK_EMPTY_LABEL[category]}: ${faceCard.entityName} · Click to center on Globe`
                              : `${faceCard.entityName} (${faceCard.attributeLabel}) · ${faceCard.answerText} · Click to center on Globe`
                          }
                          className={`relative flex w-full shrink-0 flex-col overflow-hidden rounded-t-xl border border-b-0 text-left transition-all ${
                            isGhostFace ? 'border-dashed' : 'hover:brightness-110'
                          } ${isGlobeLocked ? 'ring-1 ring-[#E9C46A]' : ''}`}
                          style={{
                            height: cardHeight,
                            borderColor: isGhostFace ? `${meta.color}40` : `${meta.color}66`,
                            background: isGhostFace
                              ? 'rgba(12,29,43,0.6)'
                              : `linear-gradient(180deg, ${meta.color}26, ${meta.color}0A)`
                          }}
                        >
                          {/* Category pigment spine */}
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
                            style={{ background: isGhostFace ? `${meta.color}55` : meta.color }}
                          />

                          <div className="flex h-[22px] shrink-0 items-center gap-1.5 pl-2.5 pr-2">
                            <span className={`text-[13px] leading-none ${isGhostFace ? 'opacity-70' : ''}`}>
                              {faceCard.flagOrEmblem}
                            </span>
                            <span
                              className={`${serifDisplay} min-w-0 truncate text-[11px] font-black leading-none text-[#F6EFE2] ${
                                isGhostFace ? 'opacity-60' : ''
                              }`}
                            >
                              {faceCard.entityName}
                            </span>
                          </div>

                          <div className="flex min-h-0 flex-1 items-center pl-2.5 pr-2">
                            <span className="min-w-0 truncate text-[9px] font-bold text-[#9FB3C4]">
                              {faceCard.attributeGlyph} {showAnswer ? faceCard.answerText : '• • • • • •'}
                            </span>
                          </div>

                          <div className="flex min-h-0 flex-1 items-center gap-1.5 pl-2.5 pr-2">
                            <span
                              className={`min-w-0 truncate text-[8px] font-bold uppercase tracking-wider ${
                                isGhostFace ? meta.textCls : 'text-[#8FA6B8]'
                              }`}
                            >
                              {isGhostFace
                                ? `${category === 'unseen' ? '✓' : '→'} ${DECK_EMPTY_LABEL[category]}`
                                : faceCard.continent}
                            </span>
                            <span
                              className={`ml-auto shrink-0 rounded-md border px-1.5 py-[1px] font-mono text-[7px] font-extrabold ${
                                isGhostFace ? 'border-[#F6EFE2]/15 text-[#8FA6B8]' : meta.badgeCls
                              }`}
                            >
                              {faceCard.trophyGlyph} {faceCard.shortBadge}
                            </span>
                          </div>
                        </button>
                      ) : (
                        <div
                          className="relative flex w-full shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-t-xl border border-dashed border-[#F6EFE2]/20 bg-[#0C1D2B]/60"
                          style={{ height: cardHeight }}
                        >
                          <span className={`text-[10px] font-extrabold uppercase tracking-wider ${meta.textCls}`}>
                            {DECK_EMPTY_LABEL[category]}
                          </span>
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#8FA6B8]">
                            Drawer empty
                          </span>
                        </div>
                      )}

                      {/* Following card tops: each one shares the drawer height so it stays readable */}
                      {sliverCards.map((card, index) => (
                        <div
                          key={card.id}
                          className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-t-lg border border-b-0"
                          style={{
                            height: cardHeight,
                            marginTop: index === 0 ? 0 : -(cardHeight - peek),
                            borderColor: `${meta.color}3A`,
                            background: `linear-gradient(180deg, ${meta.color}1C, ${meta.color}06)`
                          }}
                        >
                          <div className="flex h-[22px] shrink-0 items-center gap-1.5 pl-2.5 pr-2">
                            <span className="text-[11px] leading-none opacity-90">{card.flagOrEmblem}</span>
                            <span
                              className={`${serifDisplay} min-w-0 truncate text-[10px] font-black leading-none text-[#F6EFE2] opacity-90`}
                            >
                              {card.entityName}
                            </span>
                            <span
                              className={`ml-auto shrink-0 font-mono text-[7px] font-extrabold ${meta.textCls} opacity-85`}
                            >
                              {card.shortBadge}
                            </span>
                          </div>
                          <div className="flex min-h-0 flex-1 items-center pl-2.5 pr-2">
                            <span className="truncate text-[8px] font-bold text-[#9FB3C4]">
                              {card.attributeGlyph} {showAnswer ? card.answerText : '• • • • • •'}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Rest of the drawer: empty slots waiting for the next card (collapses when the deck fills it) */}
                      <div
                        aria-hidden="true"
                        className="relative min-h-0 w-full flex-1 overflow-hidden rounded-t-md border border-dashed"
                        style={{ borderColor: `${meta.color}1F`, background: `${meta.color}05` }}
                      >
                        <span
                          className={`${serifDisplay} pointer-events-none absolute inset-0 flex select-none items-center justify-center text-xl font-black opacity-[0.06] ${meta.textCls}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      {/* Deck dissolve: the stack fades out into the card floor */}
                      {showDissolve && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#0E2233] via-[#0E2233]/60 to-transparent"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: 4-Card Lifetime Telemetry Strip (Shrink-0) */}
            <div className="shrink-0 grid grid-cols-4 gap-2.5">
              <div className="rounded-2xl border border-[#F6EFE2]/15 bg-[#143146] p-3 shadow-md">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#D6CBB9]">
                  <Target className="h-3 w-3 text-[#48CAE4]" />
                  Total Reviews
                </span>
                <p className={`${serifDisplay} mt-1 text-xl font-black leading-none text-[#F6EFE2]`}>
                  {stats.totalReviews.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-[#8FA6B8]">{data.reviewsToday} today</p>
              </div>

              <div className="rounded-2xl border border-[#F6EFE2]/15 bg-[#143146] p-3 shadow-md">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#D6CBB9]">
                  <Gauge className="h-3 w-3 text-[#2A9D8F]" />
                  Accuracy
                </span>
                <p className={`${serifDisplay} mt-1 text-xl font-black leading-none text-[#6EE7B7]`}>
                  {data.accuracy}%
                </p>
                <p className="mt-1 text-[10px] text-[#8FA6B8]">all-time</p>
              </div>

              <div className="rounded-2xl border border-[#F6EFE2]/15 bg-[#143146] p-3 shadow-md">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#D6CBB9]">
                  <Flame className="h-3 w-3 text-[#E07A5F]" />
                  Best Streak
                </span>
                <p className={`${serifDisplay} mt-1 text-xl font-black leading-none text-[#E9C46A]`}>
                  {stats.longestStreak}d
                </p>
                <p className="mt-1 text-[10px] text-[#8FA6B8]">now {stats.currentStreak}d</p>
              </div>

              <div className="rounded-2xl border border-[#F6EFE2]/15 bg-[#143146] p-3 shadow-md">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#D6CBB9]">
                  <Trophy className="h-3 w-3 text-[#E9C46A]" />
                  Charted
                </span>
                <p className={`${serifDisplay} mt-1 text-xl font-black leading-none text-[#F6EFE2]`}>
                  {data.entitiesInMemory}
                  <span className="text-xs font-normal text-[#8FA6B8]">/{data.totalWorldEntities}</span>
                </p>
                <p className="mt-1 text-[10px] text-[#8FA6B8]">{data.pipeline.uncharted} left</p>
              </div>
            </div>
          </div>

          {/* ══ CENTER COLUMN (3 Cols): 3D POLITICAL GLOBE + DARK DOSSIER ══════ */}
          <div className="col-span-12 lg:col-span-3 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden">
            {/* Interactive 3D Political Globe Dome */}
            <div className="relative flex-1 min-h-0 flex flex-col items-center justify-between overflow-hidden rounded-[1.4rem] border-2 border-[#E9C46A]/35 bg-gradient-to-b from-[#173A52] via-[#112C3F] to-[#0C202E] p-3 shadow-2xl">
              <InteractiveAtelierGlobe
                targetCoords={activeRegionLock ? activeRegionLock.coords : null}
                targetLabel={activeRegionLock ? activeRegionLock.label : data.spotlight.name}
                spotlightCoords={data.spotlight.coordinates}
                spotlightName={data.spotlight.name}
                spotlightId={data.spotlight.id}
              />

              {/* Quick Globe Sector Pills */}
              <div className="mt-1.5 shrink-0 flex flex-wrap items-center justify-center gap-1">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setActiveRegionLock(null);
                  }}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold transition-all ${
                    activeRegionLock === null
                      ? 'border-[#E9C46A] bg-[#E9C46A] text-[#142534]'
                      : 'border-[#F6EFE2]/20 bg-[#0E2231] text-[#D6CBB9] hover:text-white'
                  }`}
                >
                  <Crosshair className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[90px]">{data.spotlight.name}</span>
                </button>

                {data.regions.map((reg) => {
                  const meta = REGION_META[reg.id] || REGION_META.Europe;
                  const isLocked = activeRegionLock?.id === reg.id;
                  return (
                    <button
                      key={reg.id}
                      onClick={() => {
                        soundFx.playClick();
                        setActiveRegionLock(
                          isLocked
                            ? null
                            : {
                                id: reg.id,
                                label: reg.shortName,
                                coords: meta.coords
                              }
                        );
                      }}
                      className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold transition-all ${
                        isLocked
                          ? 'border-[#F6EFE2] bg-[#F6EFE2] text-[#142534]'
                          : 'border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] hover:text-white'
                      }`}
                    >
                      {reg.shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Country in Focus Dossier (Shrink-0, Dark Naval Theme) */}
            <div className="shrink-0 rounded-[1.4rem] border border-[#F6EFE2]/15 bg-gradient-to-b from-[#132D42] to-[#0E2233] p-3 text-[#F6EFE2] shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between gap-1 border-b border-[#F6EFE2]/10 pb-1.5">
                <span className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-[#E9C46A] truncate">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D94E34]" />
                  <span className="truncate">Focus · #{data.spotlight.numericId}</span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full border ${capBadge.cls}`}>
                    Cap: {capBadge.label}
                  </span>
                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full border ${locBadge.cls}`}>
                    Loc: {locBadge.label}
                  </span>
                </div>
              </div>

              {/* Identification & Capital Reveal */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#F6EFE2]/15 bg-[#0C1D2B] text-xl shadow-inner select-none">
                    {data.spotlight.flagEmoji}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`${serifDisplay} truncate text-sm font-black leading-tight text-[#F6EFE2]`}>
                      {data.spotlight.name}
                    </h3>
                    <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[#9FB3C4]">
                      {data.spotlight.subregion} · {formatCoordinates(data.spotlight.coordinates)}
                    </p>
                  </div>
                </div>

                {/* Capital Reveal + Audio */}
                <div className="flex items-center gap-1 rounded-xl border border-[#F6EFE2]/15 bg-[#0C1D2B]/90 px-2 py-1 shrink-0">
                  <div className="pr-0.5">
                    <span className="block text-[7.5px] font-extrabold uppercase tracking-wider text-[#9FB3C4]">
                      Capital
                    </span>
                    <span className={`${serifDisplay} block text-xs font-black text-[#F6EFE2]`}>
                      {revealCapital ? data.spotlight.capital : '• • • • • •'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setRevealCapital((v) => !v);
                      soundFx.playClick();
                    }}
                    className="rounded-lg bg-[#143146] p-1 text-[10px] font-extrabold text-[#F6EFE2] hover:bg-[#1A3E58]"
                    title={revealCapital ? 'Hide Capital' : 'Reveal Capital'}
                  >
                    {revealCapital ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={handlePronounceSpotlightCapital}
                    title="Pronounce capital"
                    className="rounded-lg border border-[#F6EFE2]/15 bg-[#143146] p-1 text-[#F6EFE2] hover:bg-[#D94E34] transition-colors"
                  >
                    <Volume2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* 2x2 Field Notes */}
              {data.spotlight.facts && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#0C1D2B]/80 border border-[#F6EFE2]/10 px-2 py-1">
                    <Scale className="h-3 w-3 shrink-0 text-[#E07A5F]" />
                    <span className="truncate font-bold text-[#F6EFE2]">
                      {data.spotlight.facts.politicalRegime || 'Republic'}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 truncate rounded-lg bg-[#0C1D2B]/80 border border-[#F6EFE2]/10 px-2 py-1"
                    title={
                      data.spotlight.facts.headOfGovernment && data.spotlight.facts.headOfGovernment !== (data.spotlight.facts.headOfState || data.spotlight.facts.leader)
                        ? `Head of State: ${data.spotlight.facts.headOfState || data.spotlight.facts.leader} | Head of Govt: ${data.spotlight.facts.headOfGovernment}`
                        : (data.spotlight.facts.headOfState || data.spotlight.facts.leader || 'Head of State')
                    }
                  >
                    <UserCheck className="h-3 w-3 shrink-0 text-[#10B981]" />
                    <span className="truncate font-bold text-[#F6EFE2]">
                      {data.spotlight.facts.headOfState || data.spotlight.facts.leader || 'Head of State'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#0C1D2B]/80 border border-[#F6EFE2]/10 px-2 py-1">
                    <Utensils className="h-3 w-3 shrink-0 text-[#E9C46A]" />
                    <span className="truncate font-bold text-[#F6EFE2]">
                      {data.spotlight.facts.cuisine || 'Cuisine'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#0C1D2B]/80 border border-[#F6EFE2]/10 px-2 py-1">
                    <Coins className="h-3 w-3 shrink-0 text-[#38BDF8]" />
                    <span className="truncate font-bold text-[#F6EFE2]">
                      {data.spotlight.facts.currency || 'Currency'}
                    </span>
                  </div>
                </div>
              )}

              {/* Footer buttons */}
              <div className="mt-2 flex items-center justify-between pt-1 border-t border-[#F6EFE2]/10">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setActiveRegionLock({
                      id: data.spotlight.id,
                      label: data.spotlight.name,
                      coords: data.spotlight.coordinates
                    });
                  }}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-[#D6CBB9] hover:text-[#E9C46A] transition-colors"
                >
                  <Crosshair className="h-3 w-3" />
                  <span>Center on Globe</span>
                </button>

                <button
                  onClick={() =>
                    onStartSession(
                      data.spotlight.continent,
                      ['capital', 'location'],
                      data.isCaughtUp(data.spotlight.continent)
                    )
                  }
                  className="flex items-center gap-1 rounded-lg bg-[#D94E34] px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-[#C54128] transition-colors shadow-sm"
                >
                  <span>Drill {data.spotlight.continent}</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN (4 Cols): COMPACT 2×3 REGIONAL MATRIX + 4-STAGE REMEMBRANCE TIMELINE ══ */}
          <div className="col-span-12 lg:col-span-4 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden">
            {/* Top Section: Compact 2×3 Regional Folios Matrix (Zero Dead Space) */}
            <div className="shrink-0 flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-[#E9C46A]">
                  Regional Folios ({data.regions.length})
                </span>
                <span className="text-[9.5px] font-semibold text-[#8FA6B8]">Hover to turn globe · Click to drill</span>
              </div>

              <div className="grid grid-cols-2 grid-rows-3 gap-2">
                {data.regions.map((region) => {
                  const meta = REGION_META[region.id] || REGION_META.Europe;
                  const isHovered = activeRegionLock?.id === region.id;

                  return (
                    <button
                      key={region.id}
                      onMouseEnter={() =>
                        setActiveRegionLock({
                          id: region.id,
                          label: region.name,
                          coords: meta.coords
                        })
                      }
                      onMouseLeave={() => setActiveRegionLock(null)}
                      onClick={() => {
                        soundFx.playClick();
                        onStartSession(
                          region.id as TrainingCategory,
                          region.isWater ? ['location'] : selectedAttributes,
                          region.caughtUp
                        );
                      }}
                      className={`group relative flex flex-col justify-between gap-1.5 overflow-hidden rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer ${
                        isHovered
                          ? 'border-[#E9C46A] bg-[#1A3E58] shadow-lg'
                          : 'border-[#F6EFE2]/15 bg-[#143146] hover:border-[#E9C46A]/65 hover:bg-[#193B54]'
                      }`}
                    >
                      {/* Top-Right Subtle Accent Indicator */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-[#F6EFE2]/15 bg-[#0C1D2B] text-xs">
                            {region.emblem}
                          </span>
                          <span className={`${serifDisplay} truncate text-xs font-black leading-none text-[#F6EFE2]`}>
                            {region.shortName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`${serifDisplay} font-mono text-xs font-black leading-none tabular-nums`}
                            style={{ color: meta.accent }}
                          >
                            {region.masteredPct}%
                          </span>
                          <span className="flex items-center gap-0.5 rounded-md bg-[#0C1D2B] px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold text-[#F6EFE2] transition-colors group-hover:bg-[#F6EFE2] group-hover:text-[#142534] tabular-nums">
                            <Play className="h-2 w-2 fill-current" />
                            {region.caughtUp ? 'Drill' : `${region.dueCount}`}
                          </span>
                        </div>
                      </div>

                      {/* Compact Stage Breakdown Row */}
                      <div className="flex items-center justify-between gap-1 font-mono text-[8.5px] font-bold tabular-nums">
                        <span className="text-[#10B981]" title="Mastered cards">
                          {region.mastered}M
                        </span>
                        <span className="text-[#8FA6B8]/50">·</span>
                        <span className="text-[#E9C46A]" title="Recall & Learning cards">
                          {region.recall0Cards + region.recall1Cards}R
                        </span>
                        <span className="text-[#8FA6B8]/50">·</span>
                        <span className="text-[#38BDF8]" title="Unseen & L0 cards">
                          {region.unseenCards + region.stage0Cards}U
                        </span>
                        <span className="ml-auto text-[8px] font-normal text-[#8FA6B8]">
                          {meta.coordLabel.split(' · ')[0]}
                        </span>
                      </div>

                      {/* Segmented Progress Bar */}
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-[#0C1D2B]">
                        <span
                          className="h-full rounded-l-full transition-all duration-500"
                          style={{ width: `${region.masteredPct}%`, background: meta.accent }}
                        />
                        <span
                          className="h-full bg-[#E9C46A]/80 transition-all duration-500"
                          style={{ width: `${region.recallPct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Section (Flex-1): Interactive 4-Stage Remembrance Progression Timeline */}
            <div className="relative flex-1 min-h-0 flex flex-col justify-between gap-2.5 overflow-hidden rounded-[1.4rem] border border-[#F6EFE2]/15 bg-gradient-to-b from-[#132D42] to-[#0E2233] p-4 text-[#F6EFE2] shadow-xl">
              {/* Row 1: Header + Scale & Horizon Controls */}
              <div className="shrink-0 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#F6EFE2] truncate">
                      Remembrance Timeline
                    </span>
                    <span className="hidden sm:inline font-mono text-[10px] font-semibold text-[#8FA6B8] tabular-nums">
                      · {remembranceTimeline.activeTotal}/{remembranceTimeline.totalCards} active
                    </span>
                  </div>
                  <p className="truncate text-[10.5px] font-medium text-[#9FB3C4]">
                    Cumulative 4-stage memory horizon & daily review cadence
                  </p>
                </div>

                {/* Timeframe & Scale Switchers */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setTimelineScaleMode((m) => (m === 'full' ? 'active' : 'full'));
                    }}
                    title={
                      timelineScaleMode === 'full'
                        ? 'Showing 100% total card horizon (click to zoom into active strata)'
                        : 'Zoomed to active strata (click for 100% total horizon)'
                    }
                    className={`rounded-lg border px-2 py-1 text-[9.5px] font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                      timelineScaleMode === 'active'
                        ? 'border-[#10B981]/60 bg-[#10B981]/20 text-[#10B981]'
                        : 'border-[#F6EFE2]/15 bg-[#0C1D2B] text-[#9FB3C4] hover:text-white'
                    }`}
                  >
                    {timelineScaleMode === 'active' ? 'Zoom: Active' : '100% Scale'}
                  </button>

                  <div className="flex items-center rounded-lg border border-[#F6EFE2]/15 bg-[#0C1D2B] p-0.5">
                    {(['7d', '14d', '30d', 'all'] as const).map((rng) => (
                      <button
                        key={rng}
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setTimelineRange(rng);
                          setHoveredTimelineIdx(null);
                        }}
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold uppercase transition-colors cursor-pointer ${
                          timelineRange === rng
                            ? 'bg-[#E9C46A] text-[#142534]'
                            : 'text-[#9FB3C4] hover:text-white'
                        }`}
                      >
                        {rng}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Interactive Attribute Filter Tabs with Mini 4-Stage Progress Bar */}
              <div className="shrink-0 grid grid-cols-6 gap-1 rounded-xl border border-[#F6EFE2]/10 bg-[#0A1824] p-1">
                {(
                  [
                    {
                      id: 'all',
                      label: 'All',
                      glyph: '🌍',
                      pct: horizonMasteryPct,
                      m: cardTelemetry.mastered,
                      r: cardTelemetry.recall,
                      l: cardTelemetry.learning,
                      t: Math.max(1, cardTelemetry.total)
                    },
                    {
                      id: 'capital',
                      label: 'C→Cap',
                      glyph: '🏛️',
                      pct: attributeTelemetry.capital.pct,
                      m: attributeTelemetry.capital.mastered,
                      r: attributeTelemetry.capital.recall,
                      l: attributeTelemetry.capital.learning,
                      t: Math.max(1, attributeTelemetry.capital.total)
                    },
                    {
                      id: 'capital_to_country',
                      label: 'Cap→C',
                      glyph: '🏙️',
                      pct: attributeTelemetry.capital_to_country.pct,
                      m: attributeTelemetry.capital_to_country.mastered,
                      r: attributeTelemetry.capital_to_country.recall,
                      l: attributeTelemetry.capital_to_country.learning,
                      t: Math.max(1, attributeTelemetry.capital_to_country.total)
                    },
                    {
                      id: 'location',
                      label: 'Name→Map',
                      glyph: '🧭',
                      pct: attributeTelemetry.location.pct,
                      m: attributeTelemetry.location.mastered,
                      r: attributeTelemetry.location.recall,
                      l: attributeTelemetry.location.learning,
                      t: Math.max(1, attributeTelemetry.location.total)
                    },
                    {
                      id: 'country',
                      label: 'Map→Name',
                      glyph: '🗺️',
                      pct: attributeTelemetry.country.pct,
                      m: attributeTelemetry.country.mastered,
                      r: attributeTelemetry.country.recall,
                      l: attributeTelemetry.country.learning,
                      t: Math.max(1, attributeTelemetry.country.total)
                    },
                    {
                      id: 'flag',
                      label: 'Flags',
                      glyph: '🏳️',
                      pct: attributeTelemetry.flag.pct,
                      m: attributeTelemetry.flag.mastered,
                      r: attributeTelemetry.flag.recall,
                      l: attributeTelemetry.flag.learning,
                      t: Math.max(1, attributeTelemetry.flag.total)
                    }
                  ] as const
                ).map((tab) => {
                  const active = timelineAttrFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setTimelineAttrFilter(tab.id);
                      }}
                      className={`flex flex-col justify-between gap-1 rounded-lg px-1.5 py-1.5 transition-all cursor-pointer ${
                        active
                          ? 'bg-[#173A52] text-[#F6EFE2] ring-1 ring-[#E9C46A]/65 shadow-sm'
                          : 'text-[#9FB3C4] hover:bg-[#132E42]/60 hover:text-[#F6EFE2]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5 w-full">
                        <span className="flex items-center gap-0.5 min-w-0">
                          <span className="text-[9.5px] leading-none">{tab.glyph}</span>
                          <span className="truncate text-[9px] font-extrabold leading-none">{tab.label}</span>
                        </span>
                        <span
                          className={`font-mono text-[8.5px] font-extrabold leading-none tabular-nums ${
                            active ? 'text-[#E9C46A]' : 'text-[#8FA6B8]'
                          }`}
                        >
                          {tab.pct}%
                        </span>
                      </div>
                      <div className="flex h-1 w-full overflow-hidden rounded-full bg-[#07111A]">
                        <span className="h-full bg-[#10B981]" style={{ width: `${(tab.m / tab.t) * 100}%` }} />
                        <span className="h-full bg-[#E9C46A]" style={{ width: `${(tab.r / tab.t) * 100}%` }} />
                        <span className="h-full bg-[#F4A261]" style={{ width: `${(tab.l / tab.t) * 100}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Row 3 & 4: 4-Stage KPI Cards + 1:1 Pixel Topographic Horizon Chart + Daily Cadence */}
              {(() => {
                const pts = remembranceTimeline.points;
                const total = Math.max(1, remembranceTimeline.totalCards);
                const activeIdx =
                  hoveredTimelineIdx !== null && hoveredTimelineIdx < pts.length
                    ? hoveredTimelineIdx
                    : pts.length - 1;
                const activePt = pts[activeIdx] || pts[pts.length - 1];

                const yMax =
                  timelineScaleMode === 'active'
                    ? Math.max(12, Math.min(total, Math.ceil(remembranceTimeline.maxActiveInWindow * 1.12)))
                    : total;

                // True 1:1 pixel dimensions measured from DOM container (Zero distortion)
                const W = timelinePlotSize.width;
                const H = timelinePlotSize.height;
                const padL = 2;
                const padR = 2;
                const padT = 8;
                const padB = 2;
                const plotW = Math.max(10, W - padL - padR);
                const plotH = Math.max(10, H - padT - padB);
                const baseLineY = padT + plotH;

                const xFor = (i: number) =>
                  pts.length <= 1 ? padL + plotW / 2 : padL + (i / (pts.length - 1)) * plotW;
                const yFor = (val: number) =>
                  baseLineY - Math.min(1, Math.max(0, val / yMax)) * plotH;

                // Smooth horizontal cubic bezier curve generator (prevents jagged kinks and never overshoots Y)
                const buildSmoothPoints = (vals: number[]) =>
                  pts.map((_, i) => ({ x: xFor(i), y: yFor(vals[i]) }));

                const buildSmoothLine = (coords: Array<{ x: number; y: number }>) => {
                  if (coords.length === 0) return '';
                  if (coords.length === 1) return `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
                  let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
                  for (let i = 0; i < coords.length - 1; i++) {
                    const p0 = coords[i];
                    const p1 = coords[i + 1];
                    const cpx1 = p0.x + (p1.x - p0.x) * 0.42;
                    const cpx2 = p1.x - (p1.x - p0.x) * 0.42;
                    d += ` C ${cpx1.toFixed(1)},${p0.y.toFixed(1)} ${cpx2.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
                  }
                  return d;
                };

                const buildSmoothArea = (topVals: number[], botVals: number[]) => {
                  if (pts.length === 0) return '';
                  const topPts = buildSmoothPoints(topVals);
                  const botPts = buildSmoothPoints(botVals).reverse();
                  const topCurve = buildSmoothLine(topPts);
                  let botCurve = ` L ${botPts[0].x.toFixed(1)},${botPts[0].y.toFixed(1)}`;
                  for (let i = 0; i < botPts.length - 1; i++) {
                    const p0 = botPts[i];
                    const p1 = botPts[i + 1];
                    const cpx1 = p0.x + (p1.x - p0.x) * 0.42;
                    const cpx2 = p1.x - (p1.x - p0.x) * 0.42;
                    botCurve += ` C ${cpx1.toFixed(1)},${p0.y.toFixed(1)} ${cpx2.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
                  }
                  return `${topCurve}${botCurve} Z`;
                };

                const zeros = pts.map(() => 0);
                const sMastered = pts.map((p) => p.mastered);
                const sRecall = pts.map((p) => p.mastered + p.recall);
                const sLearning = pts.map((p) => p.mastered + p.recall + p.learning);

                const masteredArea = buildSmoothArea(sMastered, zeros);
                const recallArea = buildSmoothArea(sRecall, sMastered);
                const learningArea = buildSmoothArea(sLearning, sRecall);

                const masteredLine = buildSmoothLine(buildSmoothPoints(sMastered));
                const recallLine = buildSmoothLine(buildSmoothPoints(sRecall));
                const learningLine = buildSmoothLine(buildSmoothPoints(sLearning));

                const hoverX = xFor(activeIdx);

                // Select 5 evenly spaced X-axis tick indices for crisp HTML date labels
                const tickIndices: number[] = [];
                if (pts.length <= 7) {
                  for (let i = 0; i < pts.length; i++) tickIndices.push(i);
                } else {
                  const steps = 4;
                  for (let s = 0; s <= steps; s++) {
                    tickIndices.push(Math.round((s / steps) * (pts.length - 1)));
                  }
                }

                const stageCards = [
                  {
                    id: 'mastered' as const,
                    label: 'Mastered',
                    count: activePt.mastered,
                    pct: Math.round((activePt.mastered / total) * 100),
                    delta: remembranceTimeline.masteredDelta,
                    dotCls: 'bg-[#10B981]',
                    textCls: 'text-[#34D399]',
                    borderCls: 'border-[#10B981]/30 bg-[#10B981]/10 hover:border-[#10B981]/60'
                  },
                  {
                    id: 'recall' as const,
                    label: 'Recall',
                    count: activePt.recall,
                    pct: Math.round((activePt.recall / total) * 100),
                    delta: remembranceTimeline.recallDelta,
                    dotCls: 'bg-[#E9C46A]',
                    textCls: 'text-[#FDE047]',
                    borderCls: 'border-[#E9C46A]/30 bg-[#E9C46A]/10 hover:border-[#E9C46A]/60'
                  },
                  {
                    id: 'learning' as const,
                    label: 'Learning',
                    count: activePt.learning,
                    pct: Math.round((activePt.learning / total) * 100),
                    delta: remembranceTimeline.learningDelta,
                    dotCls: 'bg-[#F4A261]',
                    textCls: 'text-[#FB923C]',
                    borderCls: 'border-[#F4A261]/30 bg-[#F4A261]/10 hover:border-[#F4A261]/60'
                  },
                  {
                    id: 'unseen' as const,
                    label: 'Unseen',
                    count: activePt.unseen,
                    pct: Math.round((activePt.unseen / total) * 100),
                    delta: remembranceTimeline.unseenDelta,
                    dotCls: 'bg-[#38BDF8]',
                    textCls: 'text-[#38BDF8]',
                    borderCls: 'border-[#38BDF8]/25 bg-[#38BDF8]/8 hover:border-[#38BDF8]/55'
                  }
                ];

                return (
                  <div className="flex-1 min-h-0 flex flex-col justify-between gap-2">
                    {/* 4-Stage Interactive Readout Strip (Click any stage to open Trophy Album) */}
                    <div className="shrink-0 grid grid-cols-4 gap-1.5">
                      {stageCards.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setHorizonAttrFilter(timelineAttrFilter);
                            openTrophyAlbum(st.id);
                          }}
                          title={`Click to inspect ${st.label} cards in Trophy Album`}
                          className={`flex flex-col justify-between rounded-xl border px-2.5 py-1.5 text-left transition-all cursor-pointer ${st.borderCls}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${st.dotCls}`} />
                              <span className="truncate text-[9.5px] font-extrabold uppercase tracking-wider text-[#F6EFE2]">
                                {st.label}
                              </span>
                            </span>
                            <span className="font-mono text-[9px] font-bold text-[#9FB3C4] tabular-nums">
                              {st.pct}%
                            </span>
                          </div>

                          <div className="mt-1 flex items-baseline justify-between gap-1">
                            <span className={`${serifDisplay} font-mono text-sm font-black leading-none text-[#F6EFE2] tabular-nums`}>
                              {st.count}
                            </span>
                            {st.delta !== 0 && (
                              <span
                                className={`font-mono text-[8.5px] font-extrabold tabular-nums ${
                                  st.id === 'unseen'
                                    ? st.delta < 0
                                      ? 'text-[#38BDF8]'
                                      : 'text-[#8FA6B8]'
                                    : st.delta > 0
                                    ? st.textCls
                                    : 'text-[#8FA6B8]'
                                }`}
                              >
                                {st.delta > 0 ? `+${st.delta}` : st.delta}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Main Chart Frame: Left Y-Axis + Right 1:1 Pixel Plot + Daily Review Spark-Bars + HTML X-Axis */}
                    <div className="relative flex-1 min-h-0 flex flex-col justify-between rounded-xl border border-[#F6EFE2]/12 bg-[#07131E] p-2.5">
                      {/* Top Scrubber Status Bar inside Chart */}
                      <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 border-b border-[#F6EFE2]/8">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-extrabold text-[#E9C46A] tabular-nums">
                            {activePt.dateLabel}
                          </span>
                          <span className="text-[10px] text-[#8FA6B8]">·</span>
                          <span className="font-mono text-[10px] font-bold text-[#6EE7B7] tabular-nums">
                            {activePt.reviews} {activePt.reviews === 1 ? 'review' : 'reviews'}
                          </span>
                        </div>
                        <span className="font-mono text-[9.5px] font-medium text-[#8FA6B8] tabular-nums">
                          Window total: {remembranceTimeline.totalReviewsInWindow.toLocaleString()} rev
                        </span>
                      </div>

                      {/* Middle Plot Area: Y-Axis Ticks + 1:1 Pixel SVG Horizon Canvas */}
                      <div className="flex-1 min-h-0 flex items-stretch gap-2 pt-1.5">
                        {/* Crisp HTML Y-Axis Labels (Never stretched) */}
                        <div className="shrink-0 flex flex-col justify-between py-0.5 text-right font-mono text-[9px] font-semibold text-[#7E99AE] tabular-nums select-none w-7">
                          <span>{yMax}</span>
                          <span>{Math.round(yMax * 0.75)}</span>
                          <span>{Math.round(yMax * 0.5)}</span>
                          <span>{Math.round(yMax * 0.25)}</span>
                          <span>0</span>
                        </div>

                        {/* 1:1 Pixel SVG Plot Container */}
                        <div
                          ref={timelinePlotRef}
                          className="relative flex-1 min-h-0 overflow-hidden rounded-lg bg-[#050E17] border border-[#F6EFE2]/8 cursor-crosshair"
                          onMouseLeave={() => setHoveredTimelineIdx(null)}
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                            const idx = Math.round(relX * (pts.length - 1));
                            if (idx !== hoveredTimelineIdx) {
                              setHoveredTimelineIdx(idx);
                            }
                          }}
                        >
                          <svg
                            viewBox={`0 0 ${W} ${H}`}
                            className="block h-full w-full select-none"
                          >
                            <defs>
                              <linearGradient id="tlMasteredFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.58" />
                                <stop offset="100%" stopColor="#059669" stopOpacity="0.20" />
                              </linearGradient>
                              <linearGradient id="tlRecallFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#E9C46A" stopOpacity="0.56" />
                                <stop offset="100%" stopColor="#D4A338" stopOpacity="0.22" />
                              </linearGradient>
                              <linearGradient id="tlLearningFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#F4A261" stopOpacity="0.56" />
                                <stop offset="100%" stopColor="#E07A5F" stopOpacity="0.22" />
                              </linearGradient>
                            </defs>

                            {/* Crisp 1px Horizontal Reference Grid Lines */}
                            {[0.25, 0.5, 0.75, 1].map((ratio) => {
                              const gy = Math.round(padT + plotH * (1 - ratio)) + 0.5;
                              return (
                                <line
                                  key={ratio}
                                  x1={padL}
                                  y1={gy}
                                  x2={W - padR}
                                  y2={gy}
                                  stroke="rgba(246, 239, 226, 0.07)"
                                  strokeDasharray="3 4"
                                  strokeWidth="1"
                                />
                              );
                            })}

                            {/* Stacked Smooth Stage Strata */}
                            <path d={learningArea} fill="url(#tlLearningFill)" />
                            <path d={recallArea} fill="url(#tlRecallFill)" />
                            <path d={masteredArea} fill="url(#tlMasteredFill)" />

                            {/* Crisp Uniform Stage Crest Lines */}
                            <path
                              d={learningLine}
                              fill="none"
                              stroke="#FB923C"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                            />
                            <path
                              d={recallLine}
                              fill="none"
                              stroke="#FDE047"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                            />
                            <path
                              d={masteredLine}
                              fill="none"
                              stroke="#34D399"
                              strokeWidth="2.25"
                              strokeLinecap="round"
                            />

                            {/* Scrubber Vertical Hairline & True Circular Node Rings */}
                            <line
                              x1={hoverX}
                              y1={padT}
                              x2={hoverX}
                              y2={baseLineY}
                              stroke="rgba(246, 239, 226, 0.55)"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            <circle
                              cx={hoverX}
                              cy={yFor(sLearning[activeIdx])}
                              r="3.5"
                              fill="#FB923C"
                              stroke="#050E17"
                              strokeWidth="1.5"
                            />
                            <circle
                              cx={hoverX}
                              cy={yFor(sRecall[activeIdx])}
                              r="3.5"
                              fill="#FDE047"
                              stroke="#050E17"
                              strokeWidth="1.5"
                            />
                            <circle
                              cx={hoverX}
                              cy={yFor(sMastered[activeIdx])}
                              r="4"
                              fill="#34D399"
                              stroke="#050E17"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Bottom Daily Review Cadence Spark-Bars + Crisp HTML X-Axis Dates */}
                      <div className="shrink-0 pl-9 pt-1.5 flex flex-col gap-1">
                        {/* Daily Review Activity Bars */}
                        <div className="flex h-4 items-end gap-1 border-b border-[#F6EFE2]/10 pb-0.5">
                          {pts.map((pt, i) => {
                            const isSelected = i === activeIdx;
                            const barHeightPct =
                              pt.reviews > 0
                                ? Math.max(18, Math.round((pt.reviews / remembranceTimeline.maxReviews) * 100))
                                : 6;
                            return (
                              <div
                                key={pt.idx}
                                onMouseEnter={() => setHoveredTimelineIdx(i)}
                                onMouseLeave={() => setHoveredTimelineIdx(null)}
                                title={`${pt.shortLabel}: ${pt.reviews} reviews`}
                                className="flex-1 h-full flex items-end cursor-pointer"
                              >
                                <div
                                  className={`w-full rounded-t-[2px] transition-all ${
                                    isSelected
                                      ? 'bg-[#E9C46A]'
                                      : pt.reviews > 0
                                      ? 'bg-[#38BDF8]/55 hover:bg-[#38BDF8]'
                                      : 'bg-[#F6EFE2]/8'
                                  }`}
                                  style={{ height: `${barHeightPct}%` }}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Razor-Sharp HTML X-Axis Date Labels (Never blurry or stretched) */}
                        <div className="flex items-center justify-between font-mono text-[10px] font-semibold text-[#8FA6B8] tabular-nums select-none">
                          {tickIndices.map((idx) => {
                            const pt = pts[idx];
                            if (!pt) return null;
                            const isCurrent = idx === activeIdx;
                            return (
                              <span
                                key={pt.idx}
                                className={
                                  isCurrent
                                    ? 'text-[#E9C46A] font-extrabold'
                                    : idx === pts.length - 1
                                    ? 'text-[#F6EFE2] font-bold'
                                    : 'text-[#8FA6B8]'
                                }
                              >
                                {pt.shortLabel}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── ANIMATED HIGH-DEFINITION TROPHY ALBUM SUB-WINDOW (15 Cards / View) ── */}
      {isHorizonModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040B11]/85 backdrop-blur-md p-3 sm:p-5"
          style={{ animation: 'trophyBackdropIn 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          onClick={() => setIsHorizonModalOpen(false)}
        >
          <style>{`
            @keyframes trophyBackdropIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes trophyWindowPopIn {
              0% {
                opacity: 0;
                transform: scale(0.92) translateY(18px);
              }
              100% {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
            @keyframes trophyCardReveal {
              0% {
                opacity: 0;
                transform: translateY(10px) scale(0.97);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>

          <div
            className="relative flex h-[88vh] max-h-[860px] w-full max-w-[1440px] flex-col justify-between overflow-hidden rounded-[1.75rem] border-2 border-[#E9C46A]/45 bg-gradient-to-b from-[#16364D] via-[#102739] to-[#0A1824] p-5 text-[#F6EFE2] shadow-[0_25px_80px_rgba(0,0,0,0.75)]"
            style={{ animation: 'trophyWindowPopIn 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Gold & Emerald Trophy Vault Glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/3 h-56 w-96 rounded-full bg-[#E9C46A]/10 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 right-1/4 h-56 w-96 rounded-full bg-[#10B981]/10 blur-3xl"
            />

            {/* 1. Trophy Album Top Header */}
            <div className="relative z-10 shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-[#F6EFE2]/12 pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#E9C46A]/45 bg-gradient-to-br from-[#E9C46A]/25 to-[#D94E34]/20 text-[#E9C46A] shadow-inner">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className={`${serifDisplay} text-xl font-black tracking-tight text-[#F6EFE2]`}>
                      Cartographer’s Trophy Album
                    </h2>
                    <span className="rounded-full border border-[#E9C46A]/40 bg-[#E9C46A]/15 px-3 py-0.5 font-mono text-xs font-extrabold text-[#E9C46A]">
                      {modalHorizonCards.length} Cards
                    </span>
                    <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-[#F6EFE2]/15 bg-[#0C1D2B] px-2.5 py-0.5 text-[10px] font-bold text-[#9FB3C4]">
                      15 High-Def Plates / View · Scrollable
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-[#9FB3C4]">
                    {selectedHorizonCategory
                      ? HORIZON_CATEGORY_META[selectedHorizonCategory].description
                      : 'Complete world collection across all 4 memory horizon stages. Click any plate to lock onto the 3D Globe.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setRevealHorizonCapitals((v) => !v);
                  }}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                    revealHorizonCapitals
                      ? 'border-[#E9C46A] bg-[#E9C46A]/20 text-[#E9C46A]'
                      : 'border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] hover:text-white'
                  }`}
                >
                  {revealHorizonCapitals ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{revealHorizonCapitals ? 'Hide Unmastered Capitals' : 'Reveal All Capitals'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setIsHorizonModalOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F6EFE2]/20 bg-[#0E2231] text-[#D6CBB9] hover:border-[#D94E34] hover:bg-[#D94E34] hover:text-white transition-all cursor-pointer"
                  title="Close Trophy Album"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 2. Stage Category Tabs + Continent & Search Filter Bar */}
            <div className="relative z-10 shrink-0 my-2.5 flex flex-col gap-2">
              {/* 5 Stage Vault Selector Tabs */}
              <div className="grid grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedHorizonCategory(null);
                    setAlbumPage(1);
                    if (albumScrollRef.current) albumScrollRef.current.scrollTop = 0;
                  }}
                  className={`rounded-xl border px-3 py-2 text-left transition-all cursor-pointer ${
                    selectedHorizonCategory === null
                      ? 'border-[#E9C46A] bg-[#E9C46A]/20 ring-1 ring-[#E9C46A]/50 shadow-md'
                      : 'border-[#F6EFE2]/15 bg-[#0C1D2B]/85 hover:border-[#F6EFE2]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#E9C46A]">
                      All Stages
                    </span>
                    <span className="text-[9px] font-bold text-[#9FB3C4]">Full Vault</span>
                  </div>
                  <span className="font-mono text-lg font-black text-[#F6EFE2]">
                    {cardTelemetry.total}
                  </span>
                </button>

                {HORIZON_CATEGORY_ORDER.map((cat) => {
                  const meta = HORIZON_CATEGORY_META[cat];
                  const active = selectedHorizonCategory === cat;
                  const catCounts = cardTelemetry.byCategory[cat];
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setSelectedHorizonCategory(cat);
                        setAlbumPage(1);
                        if (albumScrollRef.current) albumScrollRef.current.scrollTop = 0;
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition-all cursor-pointer ${
                        active ? meta.tileActiveCls : meta.tileIdleCls
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider ${meta.textCls}`}>
                          <span className={`h-2 w-2 rounded-full ${meta.dotCls}`} />
                          {meta.label}
                        </span>
                        <span className="text-[9px] font-semibold text-[#9FB3C4]">{meta.subtitle}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-5 gap-1 font-mono text-[9.5px] font-extrabold text-[#F6EFE2]">
                        <span title="Country → Capital">🏛️{catCounts.capital}</span>
                        <span title="Capital → Country">🏙️{catCounts.capital_to_country}</span>
                        <span title="Name → Map">🧭{catCounts.location}</span>
                        <span title="Map → Name">🗺️{catCounts.country}</span>
                        <span title="Flags">🏳️{catCounts.flag}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Continent Pills + Attribute Filter + Search Input */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {(['All', 'Europe', 'Asia', 'Africa', 'Americas', 'Oceania', 'Oceans'] as TrainingCategory[]).map(
                    (cont) => {
                      const active = modalContinentFilter === cont;
                      return (
                        <button
                          key={cont}
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setModalContinentFilter(cont);
                            setAlbumPage(1);
                            if (albumScrollRef.current) albumScrollRef.current.scrollTop = 0;
                          }}
                          className={`rounded-full border px-3 py-1 text-[10px] font-extrabold transition-colors cursor-pointer ${
                            active
                              ? 'border-[#F6EFE2] bg-[#F6EFE2] text-[#142534]'
                              : 'border-[#F6EFE2]/15 bg-[#0C1D2B] text-[#D6CBB9] hover:text-white'
                          }`}
                        >
                          {cont}
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-full border border-[#F6EFE2]/15 bg-[#0C1D2B] p-0.5 text-[10px] font-bold">
                    {(['all', 'capital', 'capital_to_country', 'location', 'country', 'flag'] as const).map((attr) => (
                      <button
                        key={attr}
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setHorizonAttrFilter(attr);
                          setAlbumPage(1);
                          if (albumScrollRef.current) albumScrollRef.current.scrollTop = 0;
                        }}
                        className={`rounded-full px-2.5 py-0.5 transition-colors cursor-pointer ${
                          horizonAttrFilter === attr
                            ? 'bg-[#E9C46A] text-[#142534]'
                            : 'text-[#9FB3C4] hover:text-white'
                        }`}
                      >
                        {attr === 'all'
                          ? 'All Plates'
                          : attr === 'capital'
                          ? '🏛️ Country → Cap'
                          : attr === 'capital_to_country'
                          ? '🏙️ Cap → Country'
                          : attr === 'location'
                          ? '🧭 Name → Map'
                          : attr === 'country'
                          ? '🗺️ Map → Name'
                          : '🏳️ Flags'}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex items-center">
                    <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#8FA6B8]" />
                    <input
                      type="text"
                      value={horizonSearch}
                      onChange={(e) => {
                        setHorizonSearch(e.target.value);
                        setAlbumPage(1);
                        if (albumScrollRef.current) albumScrollRef.current.scrollTop = 0;
                      }}
                      placeholder="Search country, capital, sea…"
                      className="w-48 sm:w-60 rounded-full border border-[#F6EFE2]/20 bg-[#0C1D2B] pl-8 pr-7 py-1 text-xs font-medium text-[#F6EFE2] placeholder:text-[#8FA6B8]/70 focus:border-[#E9C46A] focus:outline-none"
                    />
                    {horizonSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setHorizonSearch('');
                          setAlbumPage(1);
                          if (albumScrollRef.current) albumScrollRef.current.scrollTop = 0;
                        }}
                        className="absolute right-2.5 text-[#8FA6B8] hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. High-Definition 15-Cards-Per-View (5 Cols × 3 Rows) Scrollable Trophy Grid */}
            {modalHorizonCards.length === 0 ? (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center rounded-2xl border border-[#F6EFE2]/10 bg-[#08131E]/60 p-8 text-center">
                <Trophy className="h-10 w-10 text-[#E9C46A]/45 mb-2" />
                <p className={`${serifDisplay} text-base font-bold text-[#F6EFE2]`}>
                  No Trophy Plates in This View
                </p>
                <p className="mt-1 text-xs text-[#9FB3C4]">
                  Try selecting another stage tab above or clearing your search filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedHorizonCategory(null);
                    setModalContinentFilter('All');
                    setHorizonAttrFilter('all');
                    setHorizonSearch('');
                  }}
                  className="mt-3 rounded-xl bg-[#E9C46A] px-4 py-1.5 text-xs font-extrabold text-[#142534] hover:bg-[#F3D999] cursor-pointer"
                >
                  Show All {cardTelemetry.total} Plates
                </button>
              </div>
            ) : (
              <div
                ref={albumScrollRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.clientHeight > 0) {
                    const page = Math.max(1, Math.round(el.scrollTop / el.clientHeight) + 1);
                    if (page !== albumPage) setAlbumPage(page);
                  }
                }}
                className="relative z-10 flex-1 min-h-0 overflow-y-auto pr-1.5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 lg:auto-rows-[calc((100%-1.5rem)/3)] gap-3 snap-y snap-mandatory"
              >
                {modalHorizonCards.map((card, index) => {
                  const catMeta = HORIZON_CATEGORY_META[card.category];
                  const showAnswer =
                    card.attribute === 'location' ||
                    card.category === 'mastered' ||
                    revealHorizonCapitals;
                  const animDelay = `${(index % 15) * 18}ms`;

                  return (
                    <div
                      key={card.id}
                      style={{
                        animation: `trophyCardReveal 280ms cubic-bezier(0.16, 1, 0.3, 1) ${animDelay} both`
                      }}
                      onClick={() => {
                        soundFx.playClick();
                        setActiveRegionLock({
                          id: card.entityId,
                          label: card.entityName,
                          coords: card.coordinates
                        });
                        setIsHorizonModalOpen(false);
                      }}
                      title="Click to pinpoint on the 3D Globe"
                      className="group relative snap-start min-h-[124px] flex flex-col justify-between overflow-hidden rounded-2xl border border-[#F6EFE2]/15 bg-gradient-to-b from-[#132E42] via-[#0E2333] to-[#0A1824] p-3 text-left shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-[#E9C46A]/80 hover:shadow-[0_10px_28px_rgba(0,0,0,0.45)] cursor-pointer"
                    >
                      {/* Top Stage Metallic Accent Bar */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0 h-1"
                        style={{ background: catMeta.color }}
                      />

                      {/* Row 1: Framed Flag Medallion + Plate Code + Stage Trophy Badge */}
                      <div className="flex items-start justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#F6EFE2]/20 bg-[#08131E] text-xl shadow-inner select-none group-hover:scale-105 transition-transform">
                            {card.flagOrEmblem}
                          </span>
                          <div className="min-w-0">
                            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-[#8FA6B8] truncate">
                              {card.plateCode}
                            </span>
                            <span className="block text-[9px] font-extrabold uppercase tracking-wider text-[#E9C46A] truncate">
                              {card.continent}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-lg border px-2 py-0.5 font-mono text-[9px] font-black shadow-sm ${catMeta.badgeCls}`}
                        >
                          {card.trophyGlyph} {card.shortBadge}
                        </span>
                      </div>

                      {/* Row 2: High-Definition Entity Title & Coordinates */}
                      <div className="my-1 min-w-0">
                        <h4 className={`${serifDisplay} truncate text-sm font-black leading-snug text-[#F6EFE2] group-hover:text-[#FFF3B0] transition-colors`}>
                          {card.entityName}
                        </h4>
                        <p className="truncate text-[10px] font-medium text-[#9FB3C4]">
                          {card.subregion} · <span className="font-mono text-[9px] text-[#8FA6B8]">{card.coordText}</span>
                        </p>
                      </div>

                      {/* Row 3: Inset Velvet Attribute Plate & SRS Telemetry */}
                      <div className="flex items-center justify-between gap-1.5 rounded-xl border border-[#F6EFE2]/12 bg-[#07111B]/90 px-2.5 py-1.5">
                        <div className="min-w-0 flex-1">
                          <span className="block text-[8px] font-extrabold uppercase tracking-wider text-[#8FA6B8]">
                            {card.attributeGlyph} {card.attributeLabel}
                          </span>
                          <span className="block truncate text-[11px] font-extrabold text-[#F6EFE2]">
                            {showAnswer ? card.answerText : '• • • • • •'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {(card.attribute === 'capital' || card.attribute === 'capital_to_country') && showAnswer && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                soundFx.playClick();
                                if (card.entityName && (card.capitalText || card.answerText)) {
                                  speechEngine.speakCountryAndCapital(
                                    card.entityName,
                                    card.capitalText || card.answerText
                                  );
                                } else {
                                  speechEngine.speak(card.capitalText || card.answerText);
                                }
                              }}
                              title={`Pronounce ${card.entityName} and ${card.capitalText || card.answerText}`}
                              className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#F6EFE2]/15 bg-[#122B3E] text-[#D6CBB9] hover:bg-[#D94E34] hover:text-white transition-colors"
                            >
                              <Volume2 className="h-3 w-3" />
                            </button>
                          )}
                          <span className="rounded-md bg-[#102637] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#9FB3C4]">
                            {card.reps > 0 ? `${card.reps}×` : 'New'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. Trophy Album Footer Navigation (15 Cards per View Pager) */}
            <div className="relative z-10 shrink-0 mt-3 pt-2.5 border-t border-[#F6EFE2]/12 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[#9FB3C4]">
                <span className="font-mono text-[11px] font-bold text-[#F6EFE2]">
                  Page {albumPage} of {Math.max(1, Math.ceil(modalHorizonCards.length / 15))}
                </span>
                <span>·</span>
                <span className="text-[11px]">
                  Showing <strong>15 high-definition plates per view</strong> ({modalHorizonCards.length} total matching)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={albumPage <= 1}
                  onClick={() => {
                    soundFx.playClick();
                    if (albumScrollRef.current) {
                      albumScrollRef.current.scrollBy({
                        top: -albumScrollRef.current.clientHeight,
                        behavior: 'smooth'
                      });
                    }
                  }}
                  className="rounded-xl border border-[#F6EFE2]/15 bg-[#0C1D2B] px-3 py-1 text-xs font-extrabold text-[#F6EFE2] disabled:opacity-35 hover:border-[#E9C46A] transition-colors cursor-pointer disabled:cursor-default"
                >
                  ← Prev 15
                </button>
                <button
                  type="button"
                  disabled={albumPage >= Math.ceil(modalHorizonCards.length / 15)}
                  onClick={() => {
                    soundFx.playClick();
                    if (albumScrollRef.current) {
                      albumScrollRef.current.scrollBy({
                        top: albumScrollRef.current.clientHeight,
                        behavior: 'smooth'
                      });
                    }
                  }}
                  className="rounded-xl border border-[#F6EFE2]/15 bg-[#0C1D2B] px-3 py-1 text-xs font-extrabold text-[#F6EFE2] disabled:opacity-35 hover:border-[#E9C46A] transition-colors cursor-pointer disabled:cursor-default"
                >
                  Next 15 →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VelocityHome;
