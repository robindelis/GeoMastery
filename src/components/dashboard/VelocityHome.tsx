import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
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
  CheckCircle2,
  Scale,
  UserCheck,
  Utensils,
  Coins,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { COUNTRIES, COUNTRIES_BY_NUMERIC } from '../../assets/data/countries';
import { getCachedGeoFeatures, getAtlasCountryColor } from '../map/VectorMap2D';
import { useHomeData, useDueBreakdown } from './homeData';
import { useCountUp } from './useCountUp';
import type { HomeViewProps } from './homeTypes';
import type { TrainingCategory } from '../../core/types';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';
import { formatCoordinates } from '../../core/geoUtils';

/* ────────────────────────────────────────────────────────────────────────────
 * L'ATELIER DU MONDE — The Grand Political Atlas Theme
 *
 * Soulful, bold, tactile cartography inspired by mid-century political globes,
 * National Geographic folio plates, and warm archival vellum:
 * - Sunlit Parchment Vellum (#F6EFE2 & #EDE3D0) paired with Deep Prussian Ink (#142534)
 * - Aegean Cerulean Seas (#1B4965 → #0F2C3F)
 * - Multi-tonal Political Landmasses (Sand, Terracotta, Sage, Saffron, Coral, Buff)
 * - Bold Fraunces editorial serif headlines + smooth tactile controls
 * ──────────────────────────────────────────────────────────────────────────── */

const TERRACOTTA = '#D94E34';
const JADE = '#2A9D8F';
const OCHRE = '#E9C46A';
const CORAL = '#E07A5F';
const SAGE = '#6B9E78';
const CERULEAN = '#48CAE4';

interface RegionAtelierMeta {
  accent: string;
  badgeBg: string;
  coords: [number, number];
  coordLabel: string;
  plateNumber: string;
}

const REGION_META: Record<string, RegionAtelierMeta> = {
  Europe: {
    accent: '#E07A5F',
    badgeBg: '#E07A5F',
    coords: [15, 50],
    coordLabel: '50°N · 15°E',
    plateNumber: 'Plate I'
  },
  Asia: {
    accent: '#E9C46A',
    badgeBg: '#D49B27',
    coords: [95, 32],
    coordLabel: '32°N · 95°E',
    plateNumber: 'Plate II'
  },
  Africa: {
    accent: '#F4A261',
    badgeBg: '#E07A3C',
    coords: [20, 4],
    coordLabel: '04°N · 20°E',
    plateNumber: 'Plate III'
  },
  Americas: {
    accent: '#2A9D8F',
    badgeBg: '#2A9D8F',
    coords: [-74, 8],
    coordLabel: '08°N · 74°W',
    plateNumber: 'Plate IV'
  },
  Oceania: {
    accent: '#81B29A',
    badgeBg: '#5E947A',
    coords: [148, -22],
    coordLabel: '22°S · 148°E',
    plateNumber: 'Plate V'
  },
  Oceans: {
    accent: '#48CAE4',
    badgeBg: '#2899B5',
    coords: [-145, -5],
    coordLabel: '05°S · 145°W',
    plateNumber: 'Plate VI'
  }
};

interface TradeRouteArc {
  source: [number, number];
  target: [number, number];
  speed: number;
}

const VOYAGE_ARCS: TradeRouteArc[] = [
  { source: [2.3522, 48.8566], target: [-74.006, 40.7128], speed: 0.0028 },
  { source: [-9.1393, 38.7223], target: [-47.8825, -15.7942], speed: 0.0032 },
  { source: [31.2357, 30.0444], target: [77.209, 28.6139], speed: 0.0036 },
  { source: [103.8198, 1.3521], target: [139.6917, 35.6895], speed: 0.0031 },
  { source: [151.2093, -33.8688], target: [-122.4194, 37.7749], speed: 0.0024 }
];

const serifDisplay = 'font-[family-name:var(--font-fraunces)]';
const blackDisplay = 'font-[family-name:var(--font-black)]';

/* ── Interactive 3D Political Atelier Globe ────────────────────────────── */

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number }>({
    x: 0,
    y: 0,
    yaw: -15,
    pitch: -20
  });

  const rotationRef = useRef<{ yaw: number; pitch: number }>({
    yaw: -spotlightCoords[0],
    pitch: -Math.max(-55, Math.min(55, spotlightCoords[1]))
  });

  const [hudBearing, setHudBearing] = useState<{ lat: string; lng: string }>({
    lat: '20.0° N',
    lng: '015.0° E'
  });

  const targetRef = useRef({
    coords: targetCoords,
    label: targetLabel,
    spotlightCoords,
    spotlightName,
    spotlightId
  });
  useEffect(() => {
    targetRef.current = {
      coords: targetCoords,
      label: targetLabel,
      spotlightCoords,
      spotlightName,
      spotlightId
    };
  }, [targetCoords, targetLabel, spotlightCoords, spotlightName, spotlightId]);

  // Use the 50m country features so every country renders in its warm political pigment
  const countryFeatures = useMemo(() => {
    const raw = getCachedGeoFeatures();
    return raw.map((feat) => {
      const c = COUNTRIES_BY_NUMERIC.get(String(feat.id));
      return {
        feat,
        id: c?.id || '',
        fill: c ? getAtlasCountryColor(c.id) : '#C6BBA5'
      };
    });
  }, []);

  const arcInterpolators = useMemo(() => {
    return VOYAGE_ARCS.map((arc) => ({
      interpolator: d3.geoInterpolate(arc.source, arc.target),
      speed: arc.speed,
      arcGeoJSON: {
        type: 'LineString',
        coordinates: d3.range(0, 1.02, 0.04).map((t) => d3.geoInterpolate(arc.source, arc.target)(t))
      }
    }));
  }, []);

  const arcProgressRef = useRef<number[]>(VOYAGE_ARCS.map((_, i) => (i * 0.21) % 1));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || countryFeatures.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 380;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 154;

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([cx, cy])
      .clipAngle(90);

    const path = d3.geoPath(projection, ctx);
    const graticule = d3.geoGraticule10();

    let frame = 0;
    let animId: number;

    const render = () => {
      frame++;
      const currentTarget = targetRef.current;

      if (!isDraggingRef.current) {
        if (currentTarget.coords) {
          const desiredYaw = -currentTarget.coords[0];
          const desiredPitch = -Math.max(-65, Math.min(65, currentTarget.coords[1]));
          const deltaYaw = ((desiredYaw - rotationRef.current.yaw + 540) % 360) - 180;
          rotationRef.current.yaw += deltaYaw * 0.075;
          rotationRef.current.pitch += (desiredPitch - rotationRef.current.pitch) * 0.075;
        } else {
          rotationRef.current.yaw = (rotationRef.current.yaw + 0.13) % 360;
          const idlePitch = -18 + Math.sin(frame * 0.008) * 5;
          rotationRef.current.pitch += (idlePitch - rotationRef.current.pitch) * 0.03;
        }
      }

      projection.rotate([rotationRef.current.yaw, rotationRef.current.pitch, 0]);

      if (frame % 14 === 0) {
        const centerLng = ((-rotationRef.current.yaw + 540) % 360) - 180;
        const centerLat = -rotationRef.current.pitch;
        setHudBearing({
          lat: `${Math.abs(centerLat).toFixed(1)}° ${centerLat >= 0 ? 'N' : 'S'}`,
          lng: `${Math.abs(centerLng).toFixed(1).padStart(5, '0')}° ${centerLng >= 0 ? 'E' : 'W'}`
        });
      }

      ctx.clearRect(0, 0, size, size);

      // 1. Warm Sunlit Brass Halo around the Globe
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.2);
      halo.addColorStop(0, 'rgba(233, 196, 106, 0.26)');
      halo.addColorStop(0.55, 'rgba(42, 157, 143, 0.1)');
      halo.addColorStop(1, 'rgba(14, 34, 49, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
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
      oceanGrad.addColorStop(0.62, '#163D56');
      oceanGrad.addColorStop(1, '#0C2333');
      ctx.fillStyle = oceanGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Warm Ivory Meridians & Parallels
      ctx.strokeStyle = 'rgba(246, 239, 226, 0.12)';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      path(graticule);
      ctx.stroke();

      // 4. Multi-tonal Political Atlas Countries with Deep Sepia/Prussian Ink Borders
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = '#14293A';
      for (let i = 0; i < countryFeatures.length; i++) {
        const item = countryFeatures[i];
        const isSpotlight = item.id === currentTarget.spotlightId;
        ctx.fillStyle = isSpotlight ? '#FFF3B0' : item.fill;
        ctx.beginPath();
        path(item.feat);
        ctx.fill();
        ctx.stroke();
      }

      const centerGeo: [number, number] = [-rotationRef.current.yaw, -rotationRef.current.pitch];

      // 5. Classic Dashed Navigation Routes & Golden Compass Travellers
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(246, 239, 226, 0.32)';
      ctx.lineWidth = 1.1;
      arcInterpolators.forEach((arc) => {
        ctx.beginPath();
        path(arc.arcGeoJSON as any);
        ctx.stroke();
      });
      ctx.restore();

      arcInterpolators.forEach((arc, idx) => {
        arcProgressRef.current[idx] = (arcProgressRef.current[idx] + arc.speed) % 1;
        const ptGeo = arc.interpolator(arcProgressRef.current[idx]);
        if (d3.geoDistance(ptGeo, centerGeo) < Math.PI / 2) {
          const projected = projection(ptGeo);
          if (projected) {
            const [px, py] = projected;
            ctx.fillStyle = '#FFF8E7';
            ctx.strokeStyle = '#D94E34';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.arc(px, py, 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      });

      // 6. Active Compass Target Ring (Hovered Continent or Spotlight Country)
      const reticleGeo = currentTarget.coords || currentTarget.spotlightCoords;
      const reticleLabel = currentTarget.coords ? currentTarget.label : currentTarget.spotlightName;

      if (d3.geoDistance(reticleGeo, centerGeo) < Math.PI / 2) {
        const pt = projection(reticleGeo);
        if (pt) {
          const [rx, ry] = pt;
          const pulse = (frame * 0.022) % 1;
          const ringR = 7 + pulse * 17;

          ctx.strokeStyle = '#D94E34';
          ctx.globalAlpha = (1 - pulse) * 0.85;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(rx, ry, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;

          ctx.fillStyle = '#D94E34';
          ctx.strokeStyle = '#FFF8E7';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Warm Parchment Callout Flag on the Globe
          const text = reticleLabel;
          ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
          const tw = ctx.measureText(text).width;
          const bx = Math.min(size - tw - 26, Math.max(10, rx + 10));
          const by = Math.max(24, ry - 8);

          ctx.fillStyle = '#F6EFE2';
          ctx.strokeStyle = '#142534';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bx, by - 13, tw + 16, 20, 7);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#142534';
          ctx.fillText(text, bx + 8, by + 1);
        }
      }

      // 7. Engraved Brass Globe Meridian Rim
      const rimGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      rimGrad.addColorStop(0, '#F3D999');
      rimGrad.addColorStop(0.5, '#C8963E');
      rimGrad.addColorStop(1, '#7E571E');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [countryFeatures, arcInterpolators]);

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
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Engraved Brass Meridian & Compass Rose SVG Frame */}
      <svg
        aria-hidden="true"
        viewBox="0 0 420 420"
        className="pointer-events-none absolute h-[340px] w-[340px] sm:h-[390px] sm:w-[390px]"
      >
        <g className="origin-center animate-gm-spin-slow">
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
        </g>
        <circle
          cx="210"
          cy="210"
          r="178"
          fill="none"
          stroke="rgba(246, 239, 226, 0.16)"
          strokeWidth="1"
        />
        <text x="210" y="29" textAnchor="middle" className="fill-[#E9C46A] font-serif text-[10px] font-bold">
          N
        </text>
        <text x="395" y="213" textAnchor="middle" className="fill-[#F6EFE2]/60 font-serif text-[10px] font-bold">
          E
        </text>
        <text x="210" y="401" textAnchor="middle" className="fill-[#F6EFE2]/60 font-serif text-[10px] font-bold">
          S
        </text>
        <text x="25" y="213" textAnchor="middle" className="fill-[#F6EFE2]/60 font-serif text-[10px] font-bold">
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
        className="relative z-10 h-[310px] w-[310px] sm:h-[360px] sm:w-[360px] cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Warm Brass & Vellum Bearing Tag */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-xl border border-[#E9C46A]/35 bg-[#102637]/90 px-3 py-1.5 backdrop-blur-md">
        <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#E9C46A]">
          {targetCoords ? `Focused · ${targetLabel}` : 'Meridian Bearing'}
        </span>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-[#F6EFE2]">
          {hudBearing.lat} · {hudBearing.lng}
        </span>
      </div>

      <div className="pointer-events-none absolute right-3 bottom-3 z-20 rounded-full border border-[#F6EFE2]/20 bg-[#102637]/85 px-3 py-1 text-[10px] font-semibold text-[#F6EFE2]/80 backdrop-blur-md">
        Drag globe to explore
      </div>
    </div>
  );
};

/* ── Main Front Page Component ──────────────────────────────────────────── */

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

  const ringRadius = 42;
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
    <div className="relative h-full overflow-y-auto bg-[#0F2536] text-[#F6EFE2] selection:bg-[#D94E34]/30 selection:text-[#F6EFE2]">
      {/* ══ WARM AEGEAN & PARCHMENT STUDIO ATMOSPHERE ════════════════════ */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(125%_95%_at_20%_0%,#1D4763_0%,#112A3D_55%,#0B1C2A_100%)]" />
        <div className="animate-gm-drift absolute -left-24 -top-24 h-[32rem] w-[32rem] rounded-full bg-[#E9C46A]/[0.09] blur-[130px]" />
        <div className="animate-gm-drift absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[#E07A5F]/[0.08] blur-[140px] [animation-delay:-7s]" />

        {/* Subtle Engraved Atlas Meridian Lines */}
        <svg className="absolute inset-0 h-full w-full opacity-25">
          <defs>
            <pattern id="atelier-atlas-lines" width="96" height="96" patternUnits="userSpaceOnUse">
              <path d="M 96 0 L 0 0 0 96" fill="none" stroke="rgba(246, 239, 226, 0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#atelier-atlas-lines)" />
        </svg>
      </div>

      {/* ══ MAIN CONTENT CONTAINER ═══════════════════════════════════════ */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1420px] flex-col gap-7 px-4 py-5 sm:px-7 sm:py-8">
        {/* ── 1. ATELIER RIBBON HEADER ─────────────────────────────────── */}
        <header className="animate-gm-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F6EFE2]/15 bg-[#153348]/85 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#E9C46A]" />
              <span className={`${serifDisplay} text-sm font-bold italic text-[#F6EFE2]`}>
                L’Atelier Cartographique
              </span>
            </div>

            <span className="hidden h-4 w-px bg-[#F6EFE2]/15 sm:block" />

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#E9C46A]/20 border border-[#E9C46A]/45 px-3 py-0.5 text-[11px] font-bold text-[#F6EFE2]">
                Rank {data.rank.level} · {data.rank.title}
              </span>
              <div className="hidden items-center gap-2 md:flex">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-[#0C1F2D]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#E9C46A] to-[#D94E34] transition-all duration-700"
                    style={{ width: `${data.rank.progress}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] font-semibold text-[#D6CBB9]">
                  {data.rank.xp.toLocaleString()} / {data.rank.nextXP.toLocaleString()} XP
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Streak Pill */}
            <div className="flex items-center gap-1.5 rounded-full bg-[#D94E34] px-3.5 py-1.5 text-xs font-extrabold text-[#FFF8E7] shadow-sm">
              <Flame className="h-3.5 w-3.5 fill-current" />
              <span>{stats.currentStreak} Day Streak</span>
            </div>

            {/* 2D / 3D Map Projection Switcher */}
            <div className="flex items-center rounded-full border border-[#F6EFE2]/15 bg-[#0E2231] p-0.5">
              <button
                onClick={() => onToggleMapMode('2d')}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-all ${
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
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-all ${
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
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] transition-colors hover:border-[#E9C46A] hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-[#E9C46A]' : ''}`} />
            </button>

            <button
              onClick={() => setShowToken((v) => !v)}
              title="GitHub cloud sync token"
              aria-label="GitHub cloud sync token"
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
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
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
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
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] transition-colors hover:border-[#F6EFE2]/40 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            <label
              title="Import backup (JSON)"
              aria-label="Import backup"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#F6EFE2]/15 bg-[#0E2231] text-[#D6CBB9] transition-colors hover:border-[#F6EFE2]/40 hover:text-white"
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
        </header>

        {/* Sync & Token Drawer */}
        {(syncStatusMessage || showToken) && (
          <div className="animate-gm-pop rounded-2xl border-2 border-[#E9C46A]/50 bg-[#153348] p-4 shadow-xl">
            {showToken ? (
              <div className="flex flex-col gap-3">
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
                <p className="text-xs leading-relaxed text-[#D6CBB9]">
                  Pulling progress works automatically. Add a Personal Access Token with{' '}
                  <code className="rounded bg-[#0E2231] px-1.5 py-0.5 font-mono text-[#E9C46A]">repo</code> scope to push
                  updates from any device.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={tokenDraft}
                    onChange={(e) => setTokenDraft(e.target.value)}
                    placeholder="ghp_… or github_pat_…"
                    className="flex-1 rounded-xl border border-[#F6EFE2]/20 bg-[#0E2231] px-4 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-[#E9C46A] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      onSaveGithubToken(tokenDraft.trim());
                      setShowToken(false);
                    }}
                    className="rounded-xl bg-[#D94E34] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition-colors hover:bg-[#E05A47]"
                  >
                    Save Token
                  </button>
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-xs font-bold text-[#E9C46A]">
                <span className="h-2 w-2 rounded-full bg-[#2A9D8F]" />
                {syncStatusMessage}
              </p>
            )}
          </div>
        )}

        {/* ── 2. HERO FOLIO — SUNLIT VELLUM + LIVE POLITICAL GLOBE ─────── */}
        <section className="animate-gm-rise grid gap-6 lg:grid-cols-[1.15fr_0.85fr] [animation-delay:60ms]">
          {/* Left: Tactile Warm Parchment Vellum Atlas Folio */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] border-2 border-[#E2D5BE] bg-[#F6EFE2] p-6 sm:p-9 text-[#142534] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)]">
            {/* Inner Cartographic Frame Rule */}
            <div className="pointer-events-none absolute inset-3 rounded-[1.4rem] border border-[#142534]/12" />

            <div className="relative">
              {/* Top Edition Kicker */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D94E34]/30 bg-[#D94E34]/10 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#C84228]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {data.totalDueCount > 0
                    ? `${dueValue} Cards Ready for Today’s Expedition`
                    : 'All Scheduled Cards Complete · Free Practice Ready'}
                </span>
              </div>

              {/* Bold Editorial Serif Headline */}
              <h1
                className={`${serifDisplay} mt-4 text-[2.6rem] font-black leading-[0.98] tracking-[-0.03em] text-[#142534] sm:text-[3.5rem] xl:text-[3.85rem]`}
              >
                Learn the World
                <br />
                <span className="italic font-bold text-[#D94E34]">by Heart.</span>
              </h1>

              <p className="mt-4 max-w-xl text-sm sm:text-[15px] font-medium leading-relaxed text-[#334A5E]">
                {data.totalDueCount > 0 ? (
                  <>
                    Explore <strong className="font-extrabold text-[#142534]">196 sovereign nations</strong> and{' '}
                    <strong className="font-extrabold text-[#142534]">40 oceans & straits</strong> on our tactile
                    political atlas. Answer twice in a row from active recall to master each card.
                  </>
                ) : (
                  <>
                    Your daily spaced-repetition queue is completely caught up. Take an ungraded practice voyage across
                    any continent or test your speed in 60-second Time Attack.
                  </>
                )}
              </p>

              {/* Focus Switches (Capitals & Locations) */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5B7083]">
                  Study Focus:
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
                      className={`flex items-center gap-2.5 rounded-full border-2 px-4 py-2 text-xs font-extrabold transition-all active:scale-95 ${
                        active
                          ? 'border-[#142534] bg-[#142534] text-[#F6EFE2] shadow-md'
                          : 'border-[#D5C7B0] bg-[#EDE3D0]/70 text-[#495E70] hover:border-[#142534]/50 hover:text-[#142534]'
                      }`}
                    >
                      <span className="text-base">{opt.glyph}</span>
                      <span>{opt.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                          active ? 'bg-[#E9C46A] text-[#142534]' : 'bg-[#DDD1BC] text-[#495E70]'
                        }`}
                      >
                        {opt.detail}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Primary CTA & Secondary Mode Buttons */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                  }}
                  className="group relative overflow-hidden flex items-center gap-3 rounded-2xl bg-[#D94E34] px-7 py-4 text-sm font-black uppercase tracking-[0.06em] text-[#FFF8E7] shadow-[0_14px_30px_-8px_rgba(217,78,52,0.65)] transition-all hover:-translate-y-0.5 hover:bg-[#C54128] active:scale-[0.98]"
                >
                  <Play className="h-5 w-5 fill-current transition-transform group-hover:translate-x-0.5" />
                  <span>{data.isCaughtUp('All') ? 'Practice World Atlas' : 'Begin World Expedition'}</span>
                  <span className="rounded-full bg-black/20 px-2.5 py-0.5 font-mono text-xs font-bold text-[#FFF8E7]">
                    {data.isCaughtUp('All') ? '236' : dueValue}
                  </span>
                </button>

                <button
                  onClick={onOpenAtlas}
                  className="flex items-center gap-2 rounded-2xl border-2 border-[#142534] bg-transparent px-5 py-3.5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#142534] transition-all hover:-translate-y-0.5 hover:bg-[#142534] hover:text-[#F6EFE2]"
                >
                  <Compass className="h-4 w-4" />
                  <span>Explore Atlas</span>
                </button>

                <button
                  onClick={onOpenArcade}
                  className="flex items-center gap-2 rounded-2xl border-2 border-[#D49B27] bg-[#E9C46A]/35 px-5 py-3.5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#142534] transition-all hover:-translate-y-0.5 hover:bg-[#E9C46A]/65"
                >
                  <Zap className="h-4 w-4 fill-[#D94E34] text-[#D94E34]" />
                  <span>60s Time Attack</span>
                </button>
              </div>
            </div>

            {/* Bottom Ledger inside the Vellum Folio: Mastery Ring + 4-Stage Pipeline */}
            <div className="relative mt-8 grid gap-5 rounded-2xl border border-[#D8CBB5] bg-[#ECE2CE]/80 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex items-center gap-4 sm:border-r sm:border-[#D0C2AA] sm:pr-5">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 96 96">
                    <circle
                      cx="48"
                      cy="48"
                      r={ringRadius}
                      stroke="#D5C7B0"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={ringRadius}
                      stroke={JADE}
                      strokeWidth="8"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-lg font-extrabold leading-none text-[#142534]">
                      {masteryValue}%
                    </span>
                    <span className="mt-0.5 text-[8px] font-extrabold uppercase tracking-widest text-[#2A9D8F]">
                      Mastered
                    </span>
                  </div>
                </div>
                <div className="sm:hidden">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#142534]">Atlas Retention</p>
                  <p className="text-xs text-[#495E70]">
                    {data.pipeline.mastered + data.pipeline.recall} of {data.pipeline.total} places in memory
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold uppercase tracking-[0.12em] text-[#142534]">
                    World Memory Horizon ({data.pipeline.total} Sovereign States & Seas)
                  </span>
                  <span className="font-mono font-bold text-[#2A9D8F]">
                    {data.pipeline.mastered + data.pipeline.recall} / {data.pipeline.total}
                  </span>
                </div>

                {/* Smooth Segmented Progress Bar */}
                <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-[#D5C7B0] p-0.5">
                  <div
                    className="h-full rounded-l-full bg-[#2A9D8F] transition-all duration-700"
                    style={{ width: `${(data.pipeline.mastered / data.pipeline.total) * 100}%` }}
                  />
                  <div
                    className="h-full bg-[#E07A3C] transition-all duration-700"
                    style={{ width: `${(data.pipeline.recall / data.pipeline.total) * 100}%` }}
                  />
                  <div
                    className="h-full rounded-r-full bg-[#3B8EA5] transition-all duration-700"
                    style={{ width: `${(data.pipeline.recognition / data.pipeline.total) * 100}%` }}
                  />
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Mastered', val: data.pipeline.mastered, dot: 'bg-[#2A9D8F]' },
                    { label: 'Active Recall', val: data.pipeline.recall, dot: 'bg-[#E07A3C]' },
                    { label: 'First Sight', val: data.pipeline.recognition, dot: 'bg-[#3B8EA5]' },
                    { label: 'Uncharted', val: data.pipeline.uncharted, dot: 'bg-[#948875]' }
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg bg-[#F6EFE2]/80 px-2.5 py-1 text-[11px] font-bold text-[#142534]"
                    >
                      <span className="flex items-center gap-1.5 text-[#495E70]">
                        <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                        {item.label}
                      </span>
                      <span className="font-mono font-extrabold">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Interactive 3D Political Globe Dome */}
          <div className="relative flex flex-col items-center justify-between overflow-hidden rounded-[2rem] border-2 border-[#E9C46A]/35 bg-gradient-to-b from-[#173A52] via-[#112C3F] to-[#0C202E] p-5 sm:p-6 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.6)]">
            <InteractiveAtelierGlobe
              targetCoords={activeRegionLock ? activeRegionLock.coords : null}
              targetLabel={activeRegionLock ? activeRegionLock.label : data.spotlight.name}
              spotlightCoords={data.spotlight.coordinates}
              spotlightName={data.spotlight.name}
              spotlightId={data.spotlight.id}
            />

            {/* Region Rotation Pills under the Globe */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <button
                onClick={() => {
                  soundFx.playClick();
                  setActiveRegionLock(null);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                  activeRegionLock === null
                    ? 'border-[#E9C46A] bg-[#E9C46A] text-[#142534]'
                    : 'border-[#F6EFE2]/20 bg-[#0E2231]/80 text-[#D6CBB9] hover:text-white'
                }`}
              >
                <Crosshair className="h-3 w-3" />
                <span>Spotlight ({data.spotlight.name})</span>
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
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
                      isLocked
                        ? 'border-[#F6EFE2] bg-[#F6EFE2] text-[#142534]'
                        : 'border-[#F6EFE2]/15 bg-[#0E2231]/70 text-[#D6CBB9] hover:border-[#F6EFE2]/40 hover:text-white'
                    }`}
                  >
                    {reg.emblem} {reg.shortName}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 3. THE SIX THEATERS OF THE WORLD (REGIONAL PLATES) ────────── */}
        <section className="animate-gm-rise flex flex-col gap-4 [animation-delay:140ms]">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#E9C46A]">
                Regional Folios
              </span>
              <h2 className={`${serifDisplay} mt-1 text-2xl sm:text-3xl font-black tracking-tight text-[#F6EFE2]`}>
                Choose a Region to Study
              </h2>
            </div>
            <p className="text-xs font-medium text-[#D6CBB9]">
              Hover any folio plate to turn the globe · Click to begin a regional drill
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-[1.5rem] border-2 p-4 text-left transition-all duration-300 hover:-translate-y-1.5 ${
                    isHovered
                      ? 'border-[#E9C46A] bg-[#1A3E58] shadow-2xl'
                      : 'border-[#F6EFE2]/15 bg-[#143146]/90 hover:border-[#E9C46A]/70 hover:bg-[#193B54]'
                  }`}
                >
                  {/* Warm Top Pigment Ribbon */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
                    style={{ background: meta.accent }}
                  />

                  <div>
                    <div className="mt-1 flex items-center justify-between font-mono text-[10px] font-bold text-[#D6CBB9]">
                      <span className="uppercase tracking-widest text-[#E9C46A]">{meta.plateNumber}</span>
                      <span>{meta.coordLabel}</span>
                    </div>

                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#F6EFE2]/20 bg-[#0E2231] text-xl shadow-inner transition-transform group-hover:scale-105">
                          {region.emblem}
                        </span>
                        <div>
                          <span className={`${serifDisplay} block text-lg font-extrabold leading-tight text-[#F6EFE2]`}>
                            {region.shortName}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-semibold text-[#D6CBB9]">
                            {region.shortSubtitle}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`${serifDisplay} text-2xl font-black leading-none`}
                        style={{ color: meta.accent }}
                      >
                        {region.masteredPct}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#0C1D2B] p-0.5">
                      <span
                        className="h-full rounded-l-full transition-all duration-500"
                        style={{ width: `${region.masteredPct}%`, background: meta.accent }}
                      />
                      <span
                        className="h-full bg-[#E9C46A]/80 transition-all duration-500"
                        style={{ width: `${region.recallPct}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-[#D6CBB9]">
                      <span>
                        <strong className="text-[#F6EFE2]">{region.mastered}</strong>/{region.total} mastered
                      </span>
                      <span className={region.recall > 0 ? 'text-[#E9C46A]' : 'text-[#8FA6B8]'}>
                        {region.recall} recall
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-[#0E2231] px-3.5 py-2.5 text-xs font-extrabold text-[#F6EFE2] transition-colors group-hover:bg-[#F6EFE2] group-hover:text-[#142534]">
                    <span className="flex items-center gap-1.5">
                      <Play className="h-3 w-3 fill-current" />
                      {region.caughtUp ? 'Practice Plate' : `Study · ${region.dueCount} due`}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 4. CARTOGRAPHER'S DISPATCH & NAVIGATOR'S LEDGER ───────────── */}
        <section className="animate-gm-rise grid gap-5 lg:grid-cols-3 [animation-delay:210ms]">
          {/* Left 2 Columns: Archival Nation Postcard Dossier */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] border-2 border-[#E2D5BE] bg-[#F6EFE2] p-6 sm:p-7 text-[#142534] shadow-xl lg:col-span-2">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8CBB5] pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#D94E34]" />
                  <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#C84228]">
                    Country in Focus · Archive #{data.spotlight.numericId}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[#D0C2AA] bg-[#ECE2CE] px-3 py-1 font-mono text-[10px] font-bold text-[#334A5E]">
                    {formatCoordinates(data.spotlight.coordinates)}
                  </span>
                  <span className="rounded-full bg-[#142534] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#F6EFE2]">
                    {data.spotlightStatus.label}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-2 border-[#D8CBB5] bg-[#ECE2CE] text-5xl shadow-inner">
                    {data.spotlight.flagEmoji}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#5B7083]">
                      {data.spotlight.subregion} · {data.spotlight.continent}
                    </p>
                    <h3 className={`${serifDisplay} mt-1 text-3xl font-black tracking-tight text-[#142534]`}>
                      {data.spotlight.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-[#495E70]">{data.spotlight.officialName}</p>
                  </div>
                </div>

                {/* Capital Flashcard & Studio Audio */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#D8CBB5] bg-[#ECE2CE] px-4 py-3">
                  <div className="min-w-[140px]">
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#5B7083]">
                      Capital City
                    </span>
                    <span className={`${serifDisplay} mt-0.5 block text-xl font-black text-[#142534]`}>
                      {revealCapital ? data.spotlight.capital : '• • • • • • • •'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setRevealCapital((v) => !v);
                        soundFx.playClick();
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#142534] px-3.5 py-2 text-xs font-extrabold text-[#F6EFE2] transition-colors hover:bg-[#223B52]"
                    >
                      {revealCapital ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{revealCapital ? 'Hide' : 'Reveal'}</span>
                    </button>

                    <button
                      onClick={handlePronounceSpotlightCapital}
                      title="Listen to capital pronunciation"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#142534]/25 bg-[#F6EFE2] text-[#142534] transition-colors hover:bg-[#D94E34] hover:text-white"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Cultural & Geopolitical Field Notes */}
              {data.spotlight.facts && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-[#D8CBB5] bg-[#ECE2CE]/75 p-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#5B7083]">
                      <Scale className="h-3.5 w-3.5 text-[#D94E34]" />
                      Government
                    </span>
                    <p
                      className="mt-1 truncate text-xs font-extrabold text-[#142534]"
                      title={data.spotlight.facts.politicalRegime}
                    >
                      {data.spotlight.facts.politicalRegime || 'Republic'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#D8CBB5] bg-[#ECE2CE]/75 p-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#5B7083]">
                      <UserCheck className="h-3.5 w-3.5 text-[#2A9D8F]" />
                      Head of State
                    </span>
                    <p
                      className="mt-1 truncate text-xs font-extrabold text-[#142534]"
                      title={data.spotlight.facts.leader}
                    >
                      {data.spotlight.facts.leader || 'Head of State'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#D8CBB5] bg-[#ECE2CE]/75 p-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#5B7083]">
                      <Utensils className="h-3.5 w-3.5 text-[#D48C1C]" />
                      National Dish
                    </span>
                    <p
                      className="mt-1 truncate text-xs font-extrabold text-[#142534]"
                      title={data.spotlight.facts.cuisine}
                    >
                      {data.spotlight.facts.cuisine || 'Traditional Cuisine'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#D8CBB5] bg-[#ECE2CE]/75 p-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#5B7083]">
                      <Coins className="h-3.5 w-3.5 text-[#1E6B7B]" />
                      Currency
                    </span>
                    <p
                      className="mt-1 truncate text-xs font-extrabold text-[#142534]"
                      title={data.spotlight.facts.currency}
                    >
                      {data.spotlight.facts.currency || 'National Currency'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#D8CBB5] pt-4">
              <p className="text-xs font-semibold text-[#495E70]">{data.spotlightStatus.hint}</p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setActiveRegionLock({
                      id: data.spotlight.id,
                      label: data.spotlight.name,
                      coords: data.spotlight.coordinates
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-[#142534] px-3.5 py-2 text-xs font-extrabold text-[#142534] transition-colors hover:bg-[#142534] hover:text-[#F6EFE2]"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  <span>Center on Globe</span>
                </button>

                <button
                  onClick={() => onStartSession(data.spotlight.continent, ['capital', 'location'], true)}
                  className="group flex items-center gap-1.5 rounded-xl bg-[#D94E34] px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-[#C54128]"
                >
                  <span>Practice {data.spotlight.continent}</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Navigator's Ledger & Daily Goals */}
          <div className="flex flex-col justify-between gap-4 rounded-[2rem] border-2 border-[#F6EFE2]/15 bg-[#143146]/95 p-6 shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-[#F6EFE2]/15 pb-3">
                <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E9C46A]">
                  Navigator’s Ledger
                </span>
                <Trophy className="h-4 w-4 text-[#E9C46A]" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#F6EFE2]/10 bg-[#0E2231] p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#D6CBB9]">
                    <Target className="h-3.5 w-3.5 text-[#48CAE4]" />
                    Total Reviews
                  </span>
                  <p className={`${serifDisplay} mt-1.5 text-2xl font-black text-[#F6EFE2]`}>
                    {stats.totalReviews.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8FA6B8]">{data.reviewsToday} today</p>
                </div>

                <div className="rounded-2xl border border-[#F6EFE2]/10 bg-[#0E2231] p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#D6CBB9]">
                    <Gauge className="h-3.5 w-3.5 text-[#2A9D8F]" />
                    Accuracy
                  </span>
                  <p className={`${serifDisplay} mt-1.5 text-2xl font-black text-[#6EE7B7]`}>{data.accuracy}%</p>
                  <p className="mt-0.5 text-[11px] text-[#8FA6B8]">all-time precision</p>
                </div>

                <div className="rounded-2xl border border-[#F6EFE2]/10 bg-[#0E2231] p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#D6CBB9]">
                    <Flame className="h-3.5 w-3.5 text-[#E07A5F]" />
                    Best Streak
                  </span>
                  <p className={`${serifDisplay} mt-1.5 text-2xl font-black text-[#E9C46A]`}>
                    {stats.longestStreak} days
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8FA6B8]">current: {stats.currentStreak}d</p>
                </div>

                <div className="rounded-2xl border border-[#F6EFE2]/10 bg-[#0E2231] p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#D6CBB9]">
                    <Compass className="h-3.5 w-3.5 text-[#E9C46A]" />
                    Charted
                  </span>
                  <p className={`${serifDisplay} mt-1.5 text-2xl font-black text-[#F6EFE2]`}>
                    {data.entitiesInMemory}
                    <span className="text-sm font-normal text-[#8FA6B8]">/{data.totalWorldEntities}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8FA6B8]">{data.pipeline.uncharted} left to discover</p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#F6EFE2]/15 pt-4">
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#E9C46A]">
                Daily Field Goals
              </span>
              <div className="mt-2.5 space-y-2">
                {[
                  {
                    label: 'Complete a Daily World Session',
                    done: data.reviewsToday > 0 || data.totalDueCount === 0,
                    badge: '+50 XP'
                  },
                  {
                    label: 'Reach 5 Nations in Active Recall',
                    done: data.pipeline.recall + data.pipeline.mastered >= 5,
                    badge: '+35 XP'
                  },
                  {
                    label: 'Keep Your Daily Streak Alive',
                    done: stats.currentStreak > 0,
                    badge: 'Active'
                  }
                ].map((goal) => (
                  <div
                    key={goal.label}
                    className="flex items-center justify-between rounded-xl border border-[#F6EFE2]/10 bg-[#0E2231] px-3.5 py-2 text-xs"
                  >
                    <span className="flex items-center gap-2 font-semibold text-[#F6EFE2]">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${
                          goal.done ? 'text-[#2A9D8F]' : 'text-[#495E70]'
                        }`}
                      />
                      <span>{goal.label}</span>
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        goal.done ? 'text-[#E9C46A]' : 'text-[#8FA6B8]'
                      }`}
                    >
                      {goal.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. FOOTER ────────────────────────────────────────────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F6EFE2]/15 px-1 pt-4 pb-2 text-xs font-semibold text-[#8FA6B8]">
          <span className={`${serifDisplay} italic text-[#D6CBB9]`}>
            GeoMastery — L’Atelier du Monde · Political & Maritime Atlas
          </span>
          <span>196 Sovereign States · 40 Oceans & Straits · {data.mastery.grandTotal} Study Cards</span>
        </footer>
      </div>
    </div>
  );
};

export default VelocityHome;
