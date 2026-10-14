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
import type { TrainingCategory, SRSItem } from '../../core/types';
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

  const ringRadius = 28;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (masteryValue / 100) * ringCircumference;

  const cardTelemetry = useMemo(() => {
    let mastered = data.mastery.globalStage2;
    let recall = 0;
    let learning = 0;
    let unseen = 0;
    for (const r of data.regions) {
      recall += r.recall1Cards;
      learning += r.stage0Cards + r.recall0Cards;
      unseen += r.unseenCards;
    }
    const total = data.mastery.grandTotal;
    return {
      mastered,
      recall,
      learning,
      unseen,
      total
    };
  }, [data.mastery, data.regions]);

  const spotlightCapItem = srsItemsMap.get(`${data.spotlight.id}:capital`);
  const spotlightLocItem = srsItemsMap.get(`${data.spotlight.id}:location`);

  const getSpotlightCardBadge = (item?: SRSItem) => {
    if (!item) {
      return {
        label: 'Unseen',
        cls: 'border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]'
      };
    }
    if (item.stage === 0) {
      return {
        label: 'L0 Recognition',
        cls: 'border-[#F4A261]/30 bg-[#F4A261]/10 text-[#F4A261]'
      };
    }
    if (item.stage === 2) {
      return {
        label: '2/2 Mastered',
        cls: 'border-[#10B981]/30 bg-[#10B981]/15 text-[#10B981]'
      };
    }
    const recall = item.consecutiveRecallCorrect || 0;
    return {
      label: `${recall}/2 Recall`,
      cls:
        recall === 0
          ? 'border-[#F4A261]/30 bg-[#F4A261]/10 text-[#F4A261]'
          : 'border-[#E9C46A]/30 bg-[#E9C46A]/15 text-[#E9C46A]'
    };
  };

  const capBadge = getSpotlightCardBadge(spotlightCapItem);
  const locBadge = getSpotlightCardBadge(spotlightLocItem);

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
            {/* Section 1: Expedition Launch Deck (Shrink-0) */}
            <div className="relative shrink-0 overflow-hidden rounded-[1.4rem] border border-[#F6EFE2]/15 bg-gradient-to-b from-[#132D42] to-[#0E2233] p-4 text-[#F6EFE2] shadow-xl">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D94E34]/35 bg-[#D94E34]/15 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F4A261]">
                <Sparkles className="h-3 w-3 text-[#E9C46A]" />
                <span>
                  {data.totalDueCount > 0
                    ? `${dueValue} Unlearned & Due Cards Ready · Smart SRS Active`
                    : 'Spaced Queue Caught Up · Free Practice Active'}
                </span>
              </div>

              {/* Title */}
              <h1 className={`${serifDisplay} mt-2 text-2xl xl:text-[1.75rem] font-black leading-tight tracking-tight text-[#F6EFE2]`}>
                Learn the World <span className="italic font-bold text-[#E9C46A]">by Heart.</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-1 text-xs font-medium leading-relaxed text-[#9FB3C4]">
                Smart SRS prioritizes unlearned & 0/2 active recall cards while weaving in rare 2/2 retention checks to guarantee lifelong mastery.
              </p>

              {/* Study Focus Toggles */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8FA6B8]">
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
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all active:scale-95 ${
                        active
                          ? 'border-[#E9C46A] bg-[#E9C46A]/20 text-[#F6EFE2] shadow-sm'
                          : 'border-[#F6EFE2]/15 bg-[#0C1D2B] text-[#9FB3C4] hover:border-[#F6EFE2]/40'
                      }`}
                    >
                      <span>{opt.glyph}</span>
                      <span>{opt.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                          active ? 'bg-[#E9C46A] text-[#142534]' : 'bg-[#153247] text-[#9FB3C4]'
                        }`}
                      >
                        {opt.detail}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Action Row */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                  }}
                  className="group flex items-center gap-2 rounded-xl bg-[#D94E34] px-4 py-2 text-xs font-black uppercase tracking-[0.05em] text-[#FFF8E7] shadow-md transition-all hover:bg-[#C54128] active:scale-[0.98]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{data.isCaughtUp('All') ? 'Practice World' : 'Begin Expedition'}</span>
                  <span className="rounded-full bg-black/25 px-2 py-0.5 font-mono text-[10px] font-bold">
                    {data.isCaughtUp('All') ? '236' : dueValue}
                  </span>
                </button>

                {data.priorityRegion && data.priorityRegion.unlearnedCount > 0 && (
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      onStartSession(
                        data.priorityRegion.id,
                        data.priorityRegion.isWater ? ['location'] : selectedAttributes,
                        false
                      );
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-[#E9C46A]/50 bg-[#E9C46A]/15 px-3 py-2 text-xs font-black uppercase tracking-[0.05em] text-[#E9C46A] hover:bg-[#E9C46A]/25 transition-all active:scale-95 shadow-sm"
                  >
                    <Compass className="h-3 w-3" />
                    <span>
                      Focus {data.priorityRegion.shortName} (
                      {data.priorityRegion.unseenCards > 0
                        ? `${data.priorityRegion.unseenCards} unseen`
                        : `${data.priorityRegion.dueCount} due`}
                      )
                    </span>
                  </button>
                )}

                <button
                  onClick={onOpenAtlas}
                  className="flex items-center gap-1 rounded-xl border border-[#F6EFE2]/15 bg-[#0C1D2B] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.05em] text-[#F6EFE2] transition-colors hover:border-[#E9C46A] hover:text-[#E9C46A]"
                >
                  <Compass className="h-3 w-3" />
                  <span>Atlas</span>
                </button>

                <button
                  onClick={onOpenArcade}
                  className="flex items-center gap-1 rounded-xl border border-[#D94E34]/40 bg-[#D94E34]/15 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.05em] text-[#F6EFE2] transition-colors hover:bg-[#D94E34]/30"
                >
                  <Zap className="h-3 w-3 fill-[#D94E34] text-[#D94E34]" />
                  <span>Arcade</span>
                </button>
              </div>
            </div>

            {/* Section 2: Memory Horizon & Smart Queue Intelligence Card (Flex-1) */}
            <div className="relative flex-1 min-h-0 flex flex-col justify-between overflow-hidden rounded-[1.4rem] border border-[#F6EFE2]/15 bg-gradient-to-b from-[#132D42] to-[#0E2233] p-4 text-[#F6EFE2] shadow-xl">
              {/* Header + Mastery Ring */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Compact SVG Ring */}
                  <div className="relative flex h-13 w-13 shrink-0 items-center justify-center">
                    <svg className="h-13 w-13 -rotate-90" viewBox="0 0 68 68">
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

                <span className="font-mono text-xs font-bold text-[#10B981] px-2.5 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/30">
                  {cardTelemetry.mastered + cardTelemetry.recall}/{cardTelemetry.total}
                </span>
              </div>

              {/* 4-Stage Segmented Progress Bar */}
              <div className="my-2 flex flex-col gap-1.5">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-[#0C1D2B] p-0.5 shadow-inner">
                  <div
                    className="h-full rounded-l-full bg-[#10B981] transition-all duration-500"
                    style={{ width: `${(cardTelemetry.mastered / cardTelemetry.total) * 100}%` }}
                    title={`Mastered: ${cardTelemetry.mastered}`}
                  />
                  <div
                    className="h-full bg-[#E9C46A] transition-all duration-500"
                    style={{ width: `${(cardTelemetry.recall / cardTelemetry.total) * 100}%` }}
                    title={`Recall (1/2): ${cardTelemetry.recall}`}
                  />
                  <div
                    className="h-full bg-[#F4A261] transition-all duration-500"
                    style={{ width: `${(cardTelemetry.learning / cardTelemetry.total) * 100}%` }}
                    title={`Learning (0/2): ${cardTelemetry.learning}`}
                  />
                  <div
                    className="h-full rounded-r-full bg-[#38BDF8]/40 transition-all duration-500"
                    style={{ width: `${(cardTelemetry.unseen / cardTelemetry.total) * 100}%` }}
                    title={`Unseen: ${cardTelemetry.unseen}`}
                  />
                </div>

                {/* 4 Mini-Tiles Breakdown */}
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="rounded-xl bg-[#0C1D2B]/85 border border-[#10B981]/30 p-2 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-[#10B981] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                      Mastered
                    </span>
                    <span className="font-mono text-base font-black text-[#F6EFE2] mt-0.5">
                      {cardTelemetry.mastered}
                    </span>
                    <span className="text-[9px] text-[#9FB3C4]">2/2 Retention</span>
                  </div>

                  <div className="rounded-xl bg-[#0C1D2B]/85 border border-[#E9C46A]/30 p-2 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-[#E9C46A] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E9C46A]" />
                      Recall
                    </span>
                    <span className="font-mono text-base font-black text-[#F6EFE2] mt-0.5">
                      {cardTelemetry.recall}
                    </span>
                    <span className="text-[9px] text-[#9FB3C4]">1/2 to Master</span>
                  </div>

                  <div className="rounded-xl bg-[#0C1D2B]/85 border border-[#F4A261]/30 p-2 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-[#F4A261] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F4A261]" />
                      Learning
                    </span>
                    <span className="font-mono text-base font-black text-[#F6EFE2] mt-0.5">
                      {cardTelemetry.learning}
                    </span>
                    <span className="text-[9px] text-[#9FB3C4]">0/2 Recall</span>
                  </div>

                  <div className="rounded-xl bg-[#0C1D2B]/85 border border-[#38BDF8]/30 p-2 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-[#38BDF8] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#38BDF8]" />
                      Unseen
                    </span>
                    <span className="font-mono text-base font-black text-[#F6EFE2] mt-0.5">
                      {cardTelemetry.unseen}
                    </span>
                    <span className="text-[9px] text-[#38BDF8]/80">Fresh Cards</span>
                  </div>
                </div>
              </div>

              {/* Smart Queue Algorithm Breakdown Strip */}
              <div className="pt-2 border-t border-[#F6EFE2]/10 flex items-center justify-between text-[10px]">
                <span className="font-extrabold uppercase tracking-wider text-[#9FB3C4] flex items-center gap-1">
                  <Target className="h-3 w-3 text-[#E9C46A]" />
                  Next 15-Card Mix:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8]/30 font-bold text-[#38BDF8]">
                    🎯 ~6 Unseen
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#F4A261]/15 border border-[#F4A261]/30 font-bold text-[#F4A261]">
                    🧠 ~7 Recall (0/2 & 1/2)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 font-bold text-[#10B981]">
                    🛡️ 1–2 Mastered
                  </span>
                </div>
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

          {/* ══ CENTER COLUMN (4 Cols): 3D POLITICAL GLOBE + DARK DOSSIER ══════ */}
          <div className="col-span-12 lg:col-span-4 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden">
            {/* Interactive 3D Political Globe Dome */}
            <div className="relative flex-1 min-h-0 flex flex-col items-center justify-between overflow-hidden rounded-[1.4rem] border-2 border-[#E9C46A]/35 bg-gradient-to-b from-[#173A52] via-[#112C3F] to-[#0C202E] p-3.5 shadow-2xl">
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

            {/* Country in Focus Dossier (Shrink-0, Dark Naval Theme) */}
            <div className="shrink-0 rounded-[1.4rem] border border-[#F6EFE2]/15 bg-gradient-to-b from-[#132D42] to-[#0E2233] p-3.5 text-[#F6EFE2] shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#F6EFE2]/10 pb-2">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#E9C46A]">
                  <span className="h-2 w-2 rounded-full bg-[#D94E34] animate-pulse" />
                  Country in Focus · #{data.spotlight.numericId}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${capBadge.cls}`}>
                    Cap: {capBadge.label}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${locBadge.cls}`}>
                    Loc: {locBadge.label}
                  </span>
                </div>
              </div>

              {/* Identification & Capital Reveal */}
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#F6EFE2]/15 bg-[#0C1D2B] text-2xl shadow-inner select-none">
                    {data.spotlight.flagEmoji}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`${serifDisplay} truncate text-base font-black leading-tight text-[#F6EFE2]`}>
                      {data.spotlight.name}
                    </h3>
                    <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#9FB3C4]">
                      {data.spotlight.subregion} · {formatCoordinates(data.spotlight.coordinates)}
                    </p>
                  </div>
                </div>

                {/* Capital Reveal + Audio */}
                <div className="flex items-center gap-1.5 rounded-xl border border-[#F6EFE2]/15 bg-[#0C1D2B]/90 px-2.5 py-1.5 shrink-0">
                  <div className="pr-1">
                    <span className="block text-[8px] font-extrabold uppercase tracking-wider text-[#9FB3C4]">
                      Capital
                    </span>
                    <span className={`${serifDisplay} block text-sm font-black text-[#F6EFE2]`}>
                      {revealCapital ? data.spotlight.capital : '• • • • • •'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setRevealCapital((v) => !v);
                      soundFx.playClick();
                    }}
                    className="rounded-lg bg-[#143146] px-2 py-1 text-[10px] font-extrabold text-[#F6EFE2] hover:bg-[#1A3E58]"
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
                <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#0C1D2B]/80 border border-[#F6EFE2]/10 px-2.5 py-1">
                    <Scale className="h-3 w-3 shrink-0 text-[#E07A5F]" />
                    <span className="truncate font-bold text-[#F6EFE2]">
                      {data.spotlight.facts.politicalRegime || 'Republic'}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 truncate rounded-lg bg-[#0C1D2B]/80 border border-[#F6EFE2]/10 px-2.5 py-1"
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
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#0C1D2B]/80 border border-[#F6EFE2]/10 px-2.5 py-1">
                    <Utensils className="h-3 w-3 shrink-0 text-[#E9C46A]" />
                    <span className="truncate font-bold text-[#F6EFE2]">
                      {data.spotlight.facts.cuisine || 'Cuisine'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate rounded-lg bg-[#0C1D2B]/80 border border-[#F6EFE2]/10 px-2.5 py-1">
                    <Coins className="h-3 w-3 shrink-0 text-[#38BDF8]" />
                    <span className="truncate font-bold text-[#F6EFE2]">
                      {data.spotlight.facts.currency || 'Currency'}
                    </span>
                  </div>
                </div>
              )}

              {/* Footer buttons */}
              <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-[#F6EFE2]/10">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setActiveRegionLock({
                      id: data.spotlight.id,
                      label: data.spotlight.name,
                      coords: data.spotlight.coordinates
                    });
                  }}
                  className="flex items-center gap-1 text-[11px] font-extrabold text-[#D6CBB9] hover:text-[#E9C46A] transition-colors"
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
                  className="flex items-center gap-1 rounded-lg bg-[#D94E34] px-3 py-1 text-[11px] font-extrabold text-white hover:bg-[#C54128] transition-colors shadow-sm"
                >
                  <span>Drill {data.spotlight.continent}</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN (3 Cols): 6 REGIONAL FOLIOS WITH RICH 3-ROW CARDS ══ */}
          <div className="col-span-12 lg:col-span-3 flex flex-col justify-between gap-2 min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#E9C46A]">
                Regional Folios ({data.regions.length})
              </span>
              <span className="text-[10px] font-semibold text-[#8FA6B8]">Hover to turn globe</span>
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
                    className={`group relative min-h-0 flex flex-col justify-between overflow-hidden rounded-2xl border px-3.5 py-2 text-left transition-all ${
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

                    {/* Row 1: Header */}
                    <div className="flex items-center justify-between gap-2 pl-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#F6EFE2]/15 bg-[#0C1D2B] text-sm">
                          {region.emblem}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`${serifDisplay} truncate text-sm font-black leading-none text-[#F6EFE2]`}>
                              {region.shortName}
                            </span>
                            <span className="font-mono text-[9px] font-bold text-[#8FA6B8]">
                              {meta.coordLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`${serifDisplay} text-base font-black leading-none`}
                          style={{ color: meta.accent }}
                        >
                          {region.masteredPct}%
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-[#0C1D2B] px-2 py-0.5 text-[9px] font-extrabold text-[#F6EFE2] transition-colors group-hover:bg-[#F6EFE2] group-hover:text-[#142534]">
                          <Play className="h-2 w-2 fill-current" />
                          {region.caughtUp ? 'Practice' : `${region.dueCount} due`}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Stage Breakdown Pills (Fills Middle) */}
                    <div className="my-1 flex items-center gap-1.5 pl-1 text-[9px]">
                      <span className="flex items-center gap-1 rounded-md bg-[#10B981]/15 border border-[#10B981]/30 px-1.5 py-0.5 font-bold text-[#10B981]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                        {region.mastered} Mastered
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-[#E9C46A]/15 border border-[#E9C46A]/30 px-1.5 py-0.5 font-bold text-[#E9C46A]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#E9C46A]" />
                        {region.recall0Cards + region.recall1Cards} Recall
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-[#38BDF8]/15 border border-[#38BDF8]/30 px-1.5 py-0.5 font-bold text-[#38BDF8]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#38BDF8]" />
                        {region.unseenCards + region.stage0Cards} Unseen
                      </span>
                    </div>

                    {/* Row 3: Segmented Progress Bar */}
                    <div className="ml-1 flex h-1.5 overflow-hidden rounded-full bg-[#0C1D2B]">
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
