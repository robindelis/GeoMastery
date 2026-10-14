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
  Sparkles
} from 'lucide-react';
import worldData110m from '../../assets/geo/countries-110m.json';
import { COUNTRIES_BY_NUMERIC } from '../../assets/data/countries';
import { getAtlasCountryColor } from '../map/VectorMap2D';
import { useHomeData, useDueBreakdown } from './homeData';
import { useCountUp } from './useCountUp';
import type { HomeViewProps } from './homeTypes';
import type { TrainingCategory } from '../../core/types';
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
      const next = Math.max(160, Math.min(clientWidth - 16, clientHeight - 8, 300));
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
  const due = useDueBreakdown(srsItemsMap, selectedAttributes);

  const [revealCapital, setRevealCapital] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(settings.githubSyncToken || '');

  const [activeRegionLock, setActiveRegionLock] = useState<{
    id: string;
    label: string;
    coords: [number, number];
  } | null>(null);

  const masteryValue = useCountUp(data.mastery.masteryPercentage);
  const dueValue = useCountUp(data.totalDueCount, 650);

  const ringRadius = 32;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (masteryValue / 100) * ringCircumference;

  const focusOptions = [
    {
      attr: 'capital' as const,
      label: 'Capitals',
      detail: `${due.capital} due`,
      glyph: '🏛️'
    },
    {
      attr: 'location' as const,
      label: 'Locations',
      detail: `${due.location} due`,
      glyph: '🧭'
    }
  ];

  const handlePronounceSpotlightCapital = () => {
    soundFx.playClick();
    speechEngine.speak(data.spotlight.capital);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0F2536] text-[#F6EFE2] selection:bg-[#D94E34]/30 selection:text-[#F6EFE2] flex flex-col">
      {/* Pure CSS radial gradient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,#1D4763_0%,#112A3D_55%,#0B1C2A_100%)]"
      />

      {/* ══ LOCKED VIEWPORT CONTAINER (Zero Vertical Scroll) ══════════════ */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1600px] flex-col justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 overflow-hidden">
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
                <div className="h-2 w-24 overflow-hidden rounded-full bg-[#0C1F2D]">
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
              onClick={onToggleSound}
              title={settings.audioEnabled ? 'Mute sound' : 'Enable sound'}
              aria-label="Toggle sound"
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                settings.audioEnabled
                  ? 'border-[#2A9D8F] bg-[#2A9D8F]/25 text-[#A7F3D0]'
                  : 'border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] hover:text-white'
              }`}
            >
              {settings.audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
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
          {/* ══ LEFT COLUMN (5 Cols): VELLUM HERO FOLIO + TELEMETRY STRIP ══ */}
          <div className="col-span-12 lg:col-span-5 flex flex-col justify-between gap-3 min-h-0 overflow-hidden">
            {/* Sunlit Vellum Hero Card */}
            <div className="relative flex-1 min-h-0 flex flex-col justify-between overflow-hidden rounded-[1.75rem] border-2 border-[#E2D5BE] bg-[#F6EFE2] p-5 sm:p-6 text-[#142534] shadow-2xl">
              <div className="pointer-events-none absolute inset-2.5 rounded-[1.3rem] border border-[#142534]/10" />

              <div className="relative">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D94E34]/30 bg-[#D94E34]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C84228]">
                  <Sparkles className="h-3 w-3" />
                  <span>
                    {data.totalDueCount > 0
                      ? `${dueValue} Cards Ready for Today’s Expedition`
                      : 'All Cards Scheduled · Free Practice Ready'}
                  </span>
                </div>

                <h1
                  className={`${serifDisplay} mt-3 text-[2.2rem] xl:text-[2.75rem] font-black leading-[0.96] tracking-[-0.03em] text-[#142534]`}
                >
                  Learn the World{' '}
                  <span className="italic font-bold text-[#D94E34]">by Heart.</span>
                </h1>

                <p className="mt-2.5 text-xs sm:text-[13px] font-medium leading-relaxed text-[#334A5E]">
                  {data.totalDueCount > 0 ? (
                    <>
                      Master <strong className="font-extrabold text-[#142534]">196 sovereign nations</strong> and{' '}
                      <strong className="font-extrabold text-[#142534]">40 oceans & straits</strong>. Two consecutive
                      active-recall answers graduate each card into long-term memory.
                    </>
                  ) : (
                    <>
                      Your spaced-repetition queue is caught up. Launch an ungraded practice voyage across any region
                      or test your speed in 60s Time Attack.
                    </>
                  )}
                </p>

                {/* Study Focus Toggles */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#5B7083]">
                    Focus:
                  </span>
                  {focusOptions.map((opt) => {
                    const active = selectedAttributes.includes(opt.attr);
                    return (
                      <button
                        key={opt.attr}
                        onClick={() => {
                          soundFx.playClick();
                          onToggleAttribute(opt.attr);
                        }}
                        aria-pressed={active}
                        className={`flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold transition-all active:scale-95 ${
                          active
                            ? 'border-[#142534] bg-[#142534] text-[#F6EFE2]'
                            : 'border-[#D5C7B0] bg-[#EDE3D0]/70 text-[#495E70] hover:border-[#142534]/50'
                        }`}
                      >
                        <span>{opt.glyph}</span>
                        <span>{opt.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                            active ? 'bg-[#E9C46A] text-[#142534]' : 'bg-[#DDD1BC] text-[#495E70]'
                          }`}
                        >
                          {opt.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Primary Launch & Mode Buttons */}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                    }}
                    className="group flex items-center gap-2.5 rounded-2xl bg-[#D94E34] px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-[0.05em] text-[#FFF8E7] shadow-md transition-all hover:bg-[#C54128] active:scale-[0.98]"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>{data.isCaughtUp('All') ? 'Practice World' : 'Begin Expedition'}</span>
                    <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-[11px] font-bold">
                      {data.isCaughtUp('All') ? '236' : dueValue}
                    </span>
                  </button>

                  <button
                    onClick={onOpenAtlas}
                    className="flex items-center gap-1.5 rounded-2xl border-2 border-[#142534] px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.05em] text-[#142534] transition-colors hover:bg-[#142534] hover:text-[#F6EFE2]"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>Atlas</span>
                  </button>

                  <button
                    onClick={onOpenArcade}
                    className="flex items-center gap-1.5 rounded-2xl border-2 border-[#D49B27] bg-[#E9C46A]/40 px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.05em] text-[#142534] transition-colors hover:bg-[#E9C46A]/70"
                  >
                    <Zap className="h-3.5 w-3.5 fill-[#D94E34] text-[#D94E34]" />
                    <span>Arcade</span>
                  </button>
                </div>
              </div>

              {/* Integrated Mastery Ring & 4-Stage Memory Horizon */}
              <div className="relative mt-4 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-[#D8CBB5] bg-[#ECE2CE]/85 p-3">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center border-r border-[#D0C2AA] pr-3">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 76 76">
                    <circle cx="38" cy="38" r={ringRadius} stroke="#D5C7B0" strokeWidth="6.5" fill="transparent" />
                    <circle
                      cx="38"
                      cy="38"
                      r={ringRadius}
                      stroke={JADE}
                      strokeWidth="6.5"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 pr-3 flex flex-col items-center justify-center">
                    <span className="font-mono text-sm font-extrabold leading-none text-[#142534]">
                      {masteryValue}%
                    </span>
                    <span className="text-[7px] font-extrabold uppercase tracking-wider text-[#2A9D8F]">
                      Mastery
                    </span>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-extrabold uppercase tracking-wider text-[#142534]">
                      Memory Horizon
                    </span>
                    <span className="font-mono font-bold text-[#2A9D8F]">
                      {data.pipeline.mastered + data.pipeline.recall}/{data.pipeline.total}
                    </span>
                  </div>

                  <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-[#D5C7B0] p-0.5">
                    <div
                      className="h-full rounded-l-full bg-[#2A9D8F]"
                      style={{ width: `${(data.pipeline.mastered / data.pipeline.total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-[#E07A3C]"
                      style={{ width: `${(data.pipeline.recall / data.pipeline.total) * 100}%` }}
                    />
                    <div
                      className="h-full rounded-r-full bg-[#3B8EA5]"
                      style={{ width: `${(data.pipeline.recognition / data.pipeline.total) * 100}%` }}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Master', val: data.pipeline.mastered, dot: 'bg-[#2A9D8F]' },
                      { label: 'Recall', val: data.pipeline.recall, dot: 'bg-[#E07A3C]' },
                      { label: 'Seen', val: data.pipeline.recognition, dot: 'bg-[#3B8EA5]' },
                      { label: 'Unseen', val: data.pipeline.uncharted, dot: 'bg-[#948875]' }
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-md bg-[#F6EFE2]/80 px-1.5 py-0.5 text-[10px] font-bold text-[#142534]"
                      >
                        <span className="flex items-center gap-1 text-[#495E70]">
                          <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                          {item.label}
                        </span>
                        <span className="font-mono font-extrabold">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 4-Card Lifetime Telemetry Strip (Shrink-0) */}
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

          {/* ══ CENTER COLUMN (4 Cols): 3D POLITICAL GLOBE + SPOTLIGHT ══════ */}
          <div className="col-span-12 lg:col-span-4 flex flex-col justify-between gap-3 min-h-0 overflow-hidden">
            {/* Interactive 3D Political Globe Dome */}
            <div className="relative flex-1 min-h-0 flex flex-col items-center justify-between overflow-hidden rounded-[1.75rem] border-2 border-[#E9C46A]/35 bg-gradient-to-b from-[#173A52] via-[#112C3F] to-[#0C202E] p-3.5 shadow-2xl">
              <InteractiveAtelierGlobe
                targetCoords={activeRegionLock ? activeRegionLock.coords : null}
                targetLabel={activeRegionLock ? activeRegionLock.label : data.spotlight.name}
                spotlightCoords={data.spotlight.coordinates}
                spotlightName={data.spotlight.name}
                spotlightId={data.spotlight.id}
              />

              {/* Quick Globe Sector Pills */}
              <div className="mt-2 shrink-0 flex flex-wrap items-center justify-center gap-1">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setActiveRegionLock(null);
                  }}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                    activeRegionLock === null
                      ? 'border-[#E9C46A] bg-[#E9C46A] text-[#142534]'
                      : 'border-[#F6EFE2]/20 bg-[#0E2231] text-[#D6CBB9] hover:text-white'
                  }`}
                >
                  <Crosshair className="h-2.5 w-2.5" />
                  <span>{data.spotlight.name}</span>
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
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold transition-all ${
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

            {/* Spotlight Nation Archival Postcard (Shrink-0) */}
            <div className="shrink-0 rounded-[1.75rem] border-2 border-[#E2D5BE] bg-[#F6EFE2] p-4 text-[#142534] shadow-xl">
              <div className="flex items-center justify-between border-b border-[#D8CBB5] pb-2">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C84228]">
                  <span className="h-2 w-2 rounded-full bg-[#D94E34]" />
                  Country in Focus · #{data.spotlight.numericId}
                </span>
                <span className="font-mono text-[10px] font-bold text-[#495E70]">
                  {formatCoordinates(data.spotlight.coordinates)}
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#D8CBB5] bg-[#ECE2CE] text-3xl">
                    {data.spotlight.flagEmoji}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`${serifDisplay} truncate text-xl font-black leading-tight text-[#142534]`}>
                      {data.spotlight.name}
                    </h3>
                    <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#5B7083]">
                      {data.spotlight.subregion} · {data.spotlightStatus.label}
                    </p>
                  </div>
                </div>

                {/* Capital Reveal + Audio */}
                <div className="flex items-center gap-1.5 rounded-xl border border-[#D8CBB5] bg-[#ECE2CE] px-2.5 py-1.5 shrink-0">
                  <div className="pr-1">
                    <span className="block text-[8px] font-extrabold uppercase tracking-wider text-[#5B7083]">
                      Capital
                    </span>
                    <span className={`${serifDisplay} block text-sm font-black text-[#142534]`}>
                      {revealCapital ? data.spotlight.capital : '• • • • • •'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setRevealCapital((v) => !v);
                      soundFx.playClick();
                    }}
                    className="rounded-lg bg-[#142534] px-2 py-1 text-[10px] font-extrabold text-[#F6EFE2] hover:bg-[#223B52]"
                  >
                    {revealCapital ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={handlePronounceSpotlightCapital}
                    title="Pronounce capital"
                    className="rounded-lg border border-[#142534]/20 bg-[#F6EFE2] p-1 text-[#142534] hover:bg-[#D94E34] hover:text-white"
                  >
                    <Volume2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* 2x2 Field Notes */}
              {data.spotlight.facts && (
                <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#ECE2CE]/80 px-2.5 py-1">
                    <Scale className="h-3 w-3 shrink-0 text-[#D94E34]" />
                    <span className="truncate font-bold text-[#142534]">
                      {data.spotlight.facts.politicalRegime || 'Republic'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#ECE2CE]/80 px-2.5 py-1">
                    <UserCheck className="h-3 w-3 shrink-0 text-[#2A9D8F]" />
                    <span className="truncate font-bold text-[#142534]">
                      {data.spotlight.facts.leader || 'Head of State'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#ECE2CE]/80 px-2.5 py-1">
                    <Utensils className="h-3 w-3 shrink-0 text-[#D48C1C]" />
                    <span className="truncate font-bold text-[#142534]">
                      {data.spotlight.facts.cuisine || 'Cuisine'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#ECE2CE]/80 px-2.5 py-1">
                    <Coins className="h-3 w-3 shrink-0 text-[#1E6B7B]" />
                    <span className="truncate font-bold text-[#142534]">
                      {data.spotlight.facts.currency || 'Currency'}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-2.5 flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setActiveRegionLock({
                      id: data.spotlight.id,
                      label: data.spotlight.name,
                      coords: data.spotlight.coordinates
                    });
                  }}
                  className="flex items-center gap-1 text-[11px] font-extrabold text-[#142534] hover:text-[#D94E34]"
                >
                  <Crosshair className="h-3 w-3" />
                  <span>Center on Globe</span>
                </button>

                <button
                  onClick={() => onStartSession(data.spotlight.continent, ['capital', 'location'], true)}
                  className="flex items-center gap-1 rounded-lg bg-[#D94E34] px-3 py-1 text-[11px] font-extrabold text-white hover:bg-[#C54128]"
                >
                  <span>Drill {data.spotlight.continent}</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN (3 Cols): 6 REGIONAL FOLIO PLATES ══════════════ */}
          <div className="col-span-12 lg:col-span-3 flex flex-col justify-between gap-2 min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#E9C46A]">
                Regional Folios ({data.regions.length})
              </span>
              <span className="text-[10px] font-semibold text-[#D6CBB9]">Hover to turn globe</span>
            </div>

            <div className="flex-1 min-h-0 grid grid-rows-6 gap-2">
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
                    className={`group relative min-h-0 flex flex-col justify-between overflow-hidden rounded-2xl border-2 px-3.5 py-2.5 text-left transition-all ${
                      isHovered
                        ? 'border-[#E9C46A] bg-[#1A3E58] shadow-lg'
                        : 'border-[#F6EFE2]/15 bg-[#143146] hover:border-[#E9C46A]/65 hover:bg-[#193B54]'
                    }`}
                  >
                    {/* Left Pigment Spine */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-1.5"
                      style={{ background: meta.accent }}
                    />

                    <div className="flex items-center justify-between gap-2 pl-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#F6EFE2]/15 bg-[#0E2231] text-base">
                          {region.emblem}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`${serifDisplay} truncate text-base font-black leading-none text-[#F6EFE2]`}>
                              {region.shortName}
                            </span>
                            <span className="font-mono text-[9px] font-bold text-[#8FA6B8]">
                              {meta.coordLabel}
                            </span>
                          </div>
                          <span className="mt-0.5 block text-[10px] font-semibold text-[#D6CBB9]">
                            {region.shortSubtitle} · <strong className="text-[#F6EFE2]">{region.mastered}</strong>/{region.total} mastered
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`${serifDisplay} text-lg font-black leading-none`}
                          style={{ color: meta.accent }}
                        >
                          {region.masteredPct}%
                        </span>
                        <span className="flex items-center gap-1 rounded-lg bg-[#0E2231] px-2.5 py-1 text-[10px] font-extrabold text-[#F6EFE2] transition-colors group-hover:bg-[#F6EFE2] group-hover:text-[#142534]">
                          <Play className="h-2.5 w-2.5 fill-current" />
                          {region.caughtUp ? 'Practice' : `${region.dueCount} due`}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-1.5 ml-1 flex h-1.5 overflow-hidden rounded-full bg-[#0C1D2B]">
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
        </div>
      </div>
    </div>
  );
};

export default VelocityHome;
