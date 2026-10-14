import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Sparkles,
  Gauge,
  ChevronRight,
  Globe2,
  Map as MapIcon,
  Crosshair,
  CheckCircle2,
  Radio,
  Scale,
  UserCheck,
  Utensils,
  Coins,
  ShieldCheck,
  Orbit
} from 'lucide-react';
import worldData110m from '../../assets/geo/countries-110m.json';
import { COUNTRIES } from '../../assets/data/countries';
import { useHomeData, useDueBreakdown } from './homeData';
import { useCountUp } from './useCountUp';
import type { HomeViewProps } from './homeTypes';
import type { TrainingCategory } from '../../core/types';
import { soundFx } from '../../core/soundFx';
import { speechEngine } from '../../core/speechEngine';
import { formatCoordinates } from '../../core/geoUtils';

/* ────────────────────────────────────────────────────────────────────────────
 * ORBITAL CARTOGRAPHY — GeoMastery Landing & Command Deck
 *
 * Aesthetic Direction:
 * - Palette:
 *   • Abyssal Bathymetry (#060B14 → #0B1324)
 *   • Bioluminescent Emerald (#10B981 / #34D399)
 *   • Orbital Cyan (#22D3EE / #38BDF8)
 *   • Cartographer's Brass / Astrolabe Gold (#F59E0B / #FBBF24)
 *   • Alabaster Vellum & Slate Glass (#F8FAFC / rgba(15, 23, 42, 0.72))
 * - Typography:
 *   • Fraunces (editorial cartographic serif kickers & dossier titles)
 *   • Archivo Black (high-impact geometric display headlines)
 *   • Plus Jakarta Sans (UI body)
 *   • JetBrains Mono (coordinates, bearings, telemetry, SRS counts)
 * - Signature Centerpiece:
 *   • Interactive 3D Orthographic Telemetry Globe that slews smoothly to any
 *     hovered/selected continent or spotlight nation, supports drag-to-spin,
 *     and renders live geodesic flight corridors with traveling photon pulses.
 * ──────────────────────────────────────────────────────────────────────────── */

const EMERALD = '#10B981';
const CYAN = '#22D3EE';
const AMBER = '#F59E0B';
const INDIGO = '#818CF8';
const ROSE = '#FB7185';

interface RegionMeta {
  tint: string;
  coords: [number, number]; // [lng, lat]
  coordLabel: string;
  sectorCode: string;
}

const REGION_META: Record<string, RegionMeta> = {
  Europe: {
    tint: '#38BDF8',
    coords: [15, 50],
    coordLabel: '50.0°N · 015.0°E',
    sectorCode: 'SEC-EU // 01'
  },
  Asia: {
    tint: '#F43F5E',
    coords: [95, 32],
    coordLabel: '32.0°N · 095.0°E',
    sectorCode: 'SEC-AS // 02'
  },
  Africa: {
    tint: '#F59E0B',
    coords: [20, 4],
    coordLabel: '04.0°N · 020.0°E',
    sectorCode: 'SEC-AF // 03'
  },
  Americas: {
    tint: '#10B981',
    coords: [-74, 8],
    coordLabel: '08.0°N · 074.0°W',
    sectorCode: 'SEC-AM // 04'
  },
  Oceania: {
    tint: '#A855F7',
    coords: [148, -22],
    coordLabel: '22.0°S · 148.0°E',
    sectorCode: 'SEC-OC // 05'
  },
  Oceans: {
    tint: '#22D3EE',
    coords: [-145, -5],
    coordLabel: '05.0°S · 145.0°W',
    sectorCode: 'SEC-MA // 06'
  }
};

interface ArcCorridor {
  source: [number, number];
  target: [number, number];
  speed: number;
  color: string;
}

const ORBITAL_CORRIDORS: ArcCorridor[] = [
  { source: [2.3522, 48.8566], target: [139.6917, 35.6895], speed: 0.0034, color: '#22D3EE' },
  { source: [-74.006, 40.7128], target: [-0.1278, 51.5074], speed: 0.0042, color: '#10B981' },
  { source: [31.2357, 30.0444], target: [36.8219, -1.2921], speed: 0.0048, color: '#F59E0B' },
  { source: [103.8198, 1.3521], target: [151.2093, -33.8688], speed: 0.0038, color: '#38BDF8' },
  { source: [-47.8825, -15.7942], target: [-9.1393, 38.7223], speed: 0.0039, color: '#10B981' },
  { source: [77.209, 28.6139], target: [55.2708, 25.2048], speed: 0.0045, color: '#F59E0B' },
  { source: [126.978, 37.5665], target: [-122.4194, 37.7749], speed: 0.0031, color: '#22D3EE' }
];

const displayFont = 'font-[family-name:var(--font-black)]';
const editorialFont = 'font-[family-name:var(--font-fraunces)]';

/* ── Interactive 3D Orthographic Observatory Globe ─────────────────────── */

interface ObservatoryGlobeProps {
  targetCoords: [number, number] | null;
  targetLabel: string;
  targetTint: string;
  spotlightCoords: [number, number];
  spotlightName: string;
  masteredCountryCoords: [number, number][];
  recallCountryCoords: [number, number][];
}

const InteractiveObservatoryGlobe: React.FC<ObservatoryGlobeProps> = ({
  targetCoords,
  targetLabel,
  targetTint,
  spotlightCoords,
  spotlightName,
  masteredCountryCoords,
  recallCountryCoords
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number }>({
    x: 0,
    y: 0,
    yaw: -15,
    pitch: -20
  });

  // Current camera orientation [yaw, pitch]
  const rotationRef = useRef<{ yaw: number; pitch: number }>({
    yaw: -spotlightCoords[0],
    pitch: - Math.max(-55, Math.min(55, spotlightCoords[1]))
  });

  const [hudCoords, setHudCoords] = useState<{ lat: string; lng: string }>({
    lat: '20.0° N',
    lng: '015.0° E'
  });

  // Keep latest props in refs so the animation loop never restarts unnecessarily
  const targetRef = useRef({
    coords: targetCoords,
    label: targetLabel,
    tint: targetTint,
    spotlightCoords,
    spotlightName,
    masteredCountryCoords,
    recallCountryCoords
  });
  useEffect(() => {
    targetRef.current = {
      coords: targetCoords,
      label: targetLabel,
      tint: targetTint,
      spotlightCoords,
      spotlightName,
      masteredCountryCoords,
      recallCountryCoords
    };
  }, [
    targetCoords,
    targetLabel,
    targetTint,
    spotlightCoords,
    spotlightName,
    masteredCountryCoords,
    recallCountryCoords
  ]);

  const geoLand = useMemo(() => {
    try {
      return feature(worldData110m as any, (worldData110m as any).objects.land) as any;
    } catch {
      return null;
    }
  }, []);

  const geoBorders = useMemo(() => {
    try {
      return feature(worldData110m as any, (worldData110m as any).objects.countries) as any;
    } catch {
      return null;
    }
  }, []);

  const arcInterpolators = useMemo(() => {
    return ORBITAL_CORRIDORS.map((arc) => ({
      interpolator: d3.geoInterpolate(arc.source, arc.target),
      speed: arc.speed,
      color: arc.color,
      arcGeoJSON: {
        type: 'LineString',
        coordinates: d3.range(0, 1.02, 0.04).map((t) => d3.geoInterpolate(arc.source, arc.target)(t))
      }
    }));
  }, []);

  const arcProgressRef = useRef<number[]>(ORBITAL_CORRIDORS.map((_, i) => (i * 0.19) % 1));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !geoLand) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 380;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 152;

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
          // Smoothly slew camera toward hovered/locked region or nation
          const desiredYaw = -currentTarget.coords[0];
          const desiredPitch = -Math.max(-65, Math.min(65, currentTarget.coords[1]));

          // Shortest angular delta for yaw
          let deltaYaw = ((desiredYaw - rotationRef.current.yaw + 540) % 360) - 180;
          rotationRef.current.yaw += deltaYaw * 0.075;
          rotationRef.current.pitch += (desiredPitch - rotationRef.current.pitch) * 0.075;
        } else {
          // Gentle orbital drift
          rotationRef.current.yaw = (rotationRef.current.yaw + 0.14) % 360;
          const idlePitch = -18 + Math.sin(frame * 0.008) * 6;
          rotationRef.current.pitch += (idlePitch - rotationRef.current.pitch) * 0.03;
        }
      }

      projection.rotate([rotationRef.current.yaw, rotationRef.current.pitch, 0]);

      // Update HUD coordinates every 12 frames to avoid React re-render overhead
      if (frame % 12 === 0) {
        const centerLng = ((-rotationRef.current.yaw + 540) % 360) - 180;
        const centerLat = -rotationRef.current.pitch;
        const latStr = `${Math.abs(centerLat).toFixed(1)}° ${centerLat >= 0 ? 'N' : 'S'}`;
        const lngStr = `${Math.abs(centerLng).toFixed(1).padStart(5, '0')}° ${centerLng >= 0 ? 'E' : 'W'}`;
        setHudCoords({ lat: latStr, lng: lngStr });
      }

      ctx.clearRect(0, 0, size, size);

      // 1. Outer Atmospheric Limb Glow
      const outerGlow = ctx.createRadialGradient(cx, cy, radius * 0.88, cx, cy, radius * 1.24);
      outerGlow.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
      outerGlow.addColorStop(0.45, 'rgba(34, 211, 238, 0.14)');
      outerGlow.addColorStop(1, 'rgba(6, 11, 20, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.24, 0, Math.PI * 2);
      ctx.fill();

      // 2. Deep Bathymetric Ocean Sphere
      const oceanGrad = ctx.createRadialGradient(
        cx - radius * 0.32,
        cy - radius * 0.32,
        radius * 0.05,
        cx,
        cy,
        radius
      );
      oceanGrad.addColorStop(0, '#132847');
      oceanGrad.addColorStop(0.55, '#091528');
      oceanGrad.addColorStop(1, '#040913');
      ctx.fillStyle = oceanGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Graticule Meridians & Parallels
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      path(graticule);
      ctx.stroke();

      // 4. Continental Landmasses
      ctx.fillStyle = 'rgba(22, 41, 68, 0.92)';
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      path(geoLand);
      ctx.fill();
      ctx.stroke();

      // Subtle internal country borders
      if (geoBorders) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        path(geoBorders);
        ctx.stroke();
      }

      const centerGeo: [number, number] = [-rotationRef.current.yaw, -rotationRef.current.pitch];

      // 5. Learner's Mastered & Active-Recall Beacons on the Globe
      for (const coord of currentTarget.masteredCountryCoords) {
        if (d3.geoDistance(coord, centerGeo) < Math.PI / 2 - 0.05) {
          const pt = projection(coord);
          if (pt) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 2.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      for (const coord of currentTarget.recallCountryCoords) {
        if (d3.geoDistance(coord, centerGeo) < Math.PI / 2 - 0.05) {
          const pt = projection(coord);
          if (pt) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 2.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 6. Geodesic Corridors & Traveling Photons
      arcInterpolators.forEach((arc, idx) => {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        path(arc.arcGeoJSON as any);
        ctx.stroke();

        arcProgressRef.current[idx] = (arcProgressRef.current[idx] + arc.speed) % 1;
        const ptGeo = arc.interpolator(arcProgressRef.current[idx]);
        if (d3.geoDistance(ptGeo, centerGeo) < Math.PI / 2) {
          const projected = projection(ptGeo);
          if (projected) {
            const [px, py] = projected;
            const glow = ctx.createRadialGradient(px, py, 0, px, py, 6.5);
            glow.addColorStop(0, '#FFFFFF');
            glow.addColorStop(0.35, arc.color);
            glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(px, py, 6.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // 7. Active Target Reticle (either Hovered Region or Spotlight Nation)
      const reticleGeo = currentTarget.coords || currentTarget.spotlightCoords;
      const reticleLabel = currentTarget.coords ? currentTarget.label : currentTarget.spotlightName;
      const reticleColor = currentTarget.coords ? currentTarget.tint : '#10B981';

      if (d3.geoDistance(reticleGeo, centerGeo) < Math.PI / 2) {
        const pt = projection(reticleGeo);
        if (pt) {
          const [rx, ry] = pt;
          const pulse = (frame * 0.025) % 1;
          const ringR = 6 + pulse * 18;

          // Expanding radar ring
          ctx.strokeStyle = reticleColor;
          ctx.globalAlpha = (1 - pulse) * 0.85;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rx, ry, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;

          // Inner lock ring
          ctx.strokeStyle = reticleColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(rx, ry, 5.5, 0, Math.PI * 2);
          ctx.stroke();

          // Center beacon dot
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
          ctx.fill();

          // Floating callout pill
          const labelText = reticleLabel.toUpperCase();
          ctx.font = '700 9px "JetBrains Mono", monospace';
          const textWidth = ctx.measureText(labelText).width;
          const boxX = Math.min(size - textWidth - 24, Math.max(10, rx + 10));
          const boxY = Math.max(24, ry - 10);

          ctx.fillStyle = 'rgba(6, 11, 20, 0.86)';
          ctx.strokeStyle = reticleColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY - 11, textWidth + 14, 17, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#F8FAFC';
          ctx.fillText(labelText, boxX + 7, boxY + 0.5);
        }
      }

      // 8. Crisp Planetary Rim Highlight
      const rimGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      rimGrad.addColorStop(0, 'rgba(52, 211, 153, 0.75)');
      rimGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.45)');
      rimGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [geoLand, geoBorders, arcInterpolators]);

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
      {/* Outer Counter-Rotating Astrolabe & Azimuth SVG Rings */}
      <svg
        aria-hidden="true"
        viewBox="0 0 420 420"
        className="pointer-events-none absolute h-[340px] w-[340px] sm:h-[390px] sm:w-[390px] text-slate-500/40"
      >
        <g className=" origin-center animate-gm-spin-slow">
          <circle
            cx="210"
            cy="210"
            r="196"
            fill="none"
            stroke="rgba(56, 189, 248, 0.2)"
            strokeWidth="1"
            strokeDasharray="3 7"
          />
          <circle cx="210" cy="14" r="3" fill="#22D3EE" />
          <circle cx="406" cy="210" r="2.5" fill="#10B981" />
          <circle cx="210" cy="406" r="2.5" fill="#38BDF8" />
          <circle cx="14" cy="210" r="2.5" fill="#F59E0B" />
        </g>
        <g className="origin-center animate-gm-spin-reverse">
          <circle
            cx="210"
            cy="210"
            r="178"
            fill="none"
            stroke="rgba(16, 185, 129, 0.16)"
            strokeWidth="1"
            strokeDasharray="16 24"
          />
        </g>
        {/* Cardinal Azimuth Labels */}
        <text x="210" y="10" textAnchor="middle" className="fill-cyan-400/70 font-mono text-[8px] font-bold">
          000° N
        </text>
        <text x="412" y="213" textAnchor="end" className="fill-slate-400/60 font-mono text-[8px] font-bold">
          090° E
        </text>
        <text x="210" y="417" textAnchor="middle" className="fill-slate-400/60 font-mono text-[8px] font-bold">
          180° S
        </text>
        <text x="8" y="213" textAnchor="start" className="fill-slate-400/60 font-mono text-[8px] font-bold">
          270° W
        </text>
      </svg>

      {/* Interactive 3D Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Drag to rotate planetary observatory"
        className="relative z-10 h-[310px] w-[310px] sm:h-[360px] sm:w-[360px] cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Corner HUD Telemetry Readouts */}
      <div className="pointer-events-none absolute left-2 top-2 z-20 flex flex-col gap-0.5 rounded-lg border border-slate-800/80 bg-slate-950/75 px-2.5 py-1.5 backdrop-blur-md">
        <span className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {targetCoords ? 'SECTOR LOCK' : 'ORBITAL TRACK'}
        </span>
        <span className="font-mono text-[10px] font-semibold tabular-nums text-slate-200">
          {hudCoords.lat} · {hudCoords.lng}
        </span>
      </div>

      <div className="pointer-events-none absolute right-2 bottom-2 z-20 flex items-center gap-1.5 rounded-lg border border-slate-800/80 bg-slate-950/75 px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400 backdrop-blur-md">
        <Orbit className="h-3 w-3 text-cyan-400" />
        <span>Drag to Spin</span>
      </div>
    </div>
  );
};

/* ── Main Landing Page Component ────────────────────────────────────────── */

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

  // Interactive globe lock state: triggered by hovering/clicking region cards or spotlight
  const [activeRegionLock, setActiveRegionLock] = useState<{
    id: string;
    label: string;
    coords: [number, number];
    tint: string;
  } | null>(null);

  const masteryValue = useCountUp(data.mastery.masteryPercentage);
  const dueValue = useCountUp(data.totalDueCount, 650);

  // Extract coordinates of mastered and active-recall countries for live globe beacons
  const { masteredCoords, recallCoords } = useMemo(() => {
    const mastered: [number, number][] = [];
    const recall: [number, number][] = [];
    for (const c of COUNTRIES) {
      const capStage = srsItemsMap.get(`${c.id}:capital`)?.stage ?? 0;
      const locStage = srsItemsMap.get(`${c.id}:location`)?.stage ?? 0;
      const best = Math.max(capStage, locStage);
      if (best === 2) mastered.push(c.coordinates);
      else if (best === 1) recall.push(c.coordinates);
    }
    return { masteredCoords: mastered, recallCoords: recall };
  }, [srsItemsMap]);

  const ringRadius = 44;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (masteryValue / 100) * ringCircumference;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const focusVectors = [
    {
      attr: 'capital' as const,
      label: 'Capitals',
      sub: `${due.capital} due`,
      glyph: '🏛️',
      tint: CYAN,
      activeBg: 'bg-cyan-500/15 border-cyan-400/70 text-cyan-200 shadow-[0_0_25px_-6px_rgba(34,211,238,0.45)]'
    },
    {
      attr: 'location' as const,
      label: 'Locations',
      sub: `${due.location} due`,
      glyph: '📍',
      tint: EMERALD,
      activeBg: 'bg-emerald-500/15 border-emerald-400/70 text-emerald-200 shadow-[0_0_25px_-6px_rgba(16,185,129,0.45)]'
    }
  ];

  const handlePronounceSpotlightCapital = () => {
    soundFx.playClick();
    speechEngine.speak(data.spotlight.capital);
  };

  return (
    <div className="relative h-full overflow-y-auto bg-[#060B14] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* ══ AMBIENT BATHYMETRIC & CARTOGRAPHIC CANVAS ═════════════════════ */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_18%_-10%,#0F2942_0%,#081221_48%,#050911_100%)]" />
        <div className="animate-gm-drift absolute -left-28 -top-20 h-[32rem] w-[32rem] rounded-full bg-emerald-500/[0.11] blur-[135px]" />
        <div className="animate-gm-drift absolute right-0 top-1/5 h-[28rem] w-[28rem] rounded-full bg-cyan-500/[0.11] blur-[140px] [animation-delay:-6s]" />
        <div className="animate-gm-drift absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-amber-500/[0.07] blur-[140px] [animation-delay:-11s]" />

        {/* Subtle Nautical Coordinate Grid */}
        <svg className="absolute inset-0 h-full w-full opacity-35">
          <defs>
            <pattern id="orbital-carto-grid" width="64" height="64" patternUnits="userSpaceOnUse">
              <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(148, 163, 184, 0.045)" strokeWidth="1" />
              <circle cx="0" cy="0" r="1" fill="rgba(56, 189, 248, 0.16)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#orbital-carto-grid)" />
        </svg>
      </div>

      {/* ══ FOREGROUND CONTAINER ══════════════════════════════════════════ */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-7 sm:py-7">
        {/* ── 1. TOP EPHEMERIS & TELEMETRY BAR ─────────────────────────── */}
        <header className="animate-gm-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/65 px-4 py-3 backdrop-blur-xl">
          {/* Left: Rank & XP Telemetry */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">
                ORBITAL DECK // {todayFormatted}
              </span>
            </div>

            <div className="hidden h-4 w-px bg-slate-800 sm:block" />

            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                LVL {data.rank.level} · {data.rank.title}
              </span>
              <div className="hidden items-center gap-2 md:flex">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-700"
                    style={{ width: `${data.rank.progress}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] font-semibold tabular-nums text-slate-400">
                  {data.rank.xp.toLocaleString()} / {data.rank.nextXP.toLocaleString()} XP
                </span>
              </div>
            </div>
          </div>

          {/* Right: Streak, Map Projection Switcher & Sync Utilities */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Active Streak Badge */}
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300 shadow-[0_0_20px_-6px_rgba(245,158,11,0.4)]">
              <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>{stats.currentStreak}d Streak</span>
            </div>

            {/* 2D / 3D Projection Selector */}
            <div className="flex items-center rounded-full border border-slate-700/80 bg-slate-950/80 p-0.5">
              <button
                onClick={() => onToggleMapMode('2d')}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                  mapMode === '2d'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Use 2D Vector Projection in Training & Atlas"
              >
                <MapIcon className="h-3 w-3" />
                <span>2D</span>
              </button>
              <button
                onClick={() => onToggleMapMode('3d')}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                  mapMode === '3d'
                    ? 'bg-cyan-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Use 3D Orthographic Globe in Training & Atlas"
              >
                <Globe2 className="h-3 w-3" />
                <span>3D</span>
              </button>
            </div>

            {/* Utility Icon Chips */}
            <button
              onClick={onSyncGitHub}
              title={isSyncing ? 'Syncing…' : 'Sync progress with GitHub'}
              aria-label="Sync progress with GitHub"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/60 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              onClick={() => setShowToken((v) => !v)}
              title="Configure GitHub token for two-way cloud sync"
              aria-label="Configure GitHub token"
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                settings.githubSyncToken
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700/80 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={onToggleSound}
              title={settings.audioEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              aria-label="Toggle sound effects"
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                settings.audioEnabled
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700/80 bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {settings.audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={onExportBackup}
              title="Export progress backup (JSON)"
              aria-label="Export progress backup"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/60 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            <label
              title="Import progress backup (JSON)"
              aria-label="Import progress backup"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/60 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
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

        {/* Optional GitHub Sync / Token Drawer */}
        {(syncStatusMessage || showToken) && (
          <div className="animate-gm-pop rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-4 backdrop-blur-xl">
            {showToken ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-400">
                    GitHub Two-Way Cloud Sync Token
                  </span>
                  <button
                    onClick={() => setShowToken(false)}
                    className="font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  Pulling your progress works automatically. Add a Personal Access Token with{' '}
                  <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-cyan-300">repo</code> (contents:write)
                  scope to push progress updates from any device.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={tokenDraft}
                    onChange={(e) => setTokenDraft(e.target.value)}
                    placeholder="ghp_… or github_pat_…"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      onSaveGithubToken(tokenDraft.trim());
                      setShowToken(false);
                    }}
                    className="rounded-xl bg-emerald-500 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 transition-colors hover:bg-emerald-400"
                  >
                    Save Token
                  </button>
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                {syncStatusMessage}
              </p>
            )}
          </div>
        )}

        {/* ── 2. HERO COMMAND DECK & LIVE 3D PLANETARY OBSERVATORY ──────── */}
        <section className="animate-gm-rise relative overflow-hidden rounded-[2rem] border border-slate-700/70 bg-gradient-to-br from-slate-900/90 via-[#0B1528]/90 to-[#070E1B]/95 p-6 sm:p-8 lg:p-10 shadow-[0_28px_80px_-20px_rgba(0,0,0,0.75)] [animation-delay:60ms]">
          {/* Subtle Top Laser Accent Line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-[110px]" />
          <div className="pointer-events-none absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-[110px]" />

          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            {/* Left Column: Mission Control & Launch Deck */}
            <div className="flex flex-col justify-between">
              <div>
                {/* Queue Status Pill */}
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">
                    {data.totalDueCount > 0
                      ? `EXPEDITION QUEUE READY · ${dueValue} CARDS DUE`
                      : 'HORIZON CLEAR · ALL CARDS SCHEDULED'}
                  </span>
                </div>

                {/* Editorial Kicker + Monumental Display Title */}
                <p className={`${editorialFont} mt-4 text-base sm:text-lg italic text-cyan-300/90`}>
                  Planetary Spaced-Repetition Observatory
                </p>
                <h1
                  className={`${displayFont} mt-1 text-[2.35rem] leading-[0.95] tracking-[-0.03em] text-white sm:text-[3.25rem] xl:text-[3.65rem]`}
                >
                  CHART EVERY
                  <br />
                  <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-200 bg-clip-text text-transparent">
                    BORDER & CAPITAL.
                  </span>
                </h1>

                <p className="mt-4 max-w-xl text-sm sm:text-[15px] leading-relaxed text-slate-300/90">
                  {data.totalDueCount > 0 ? (
                    <>
                      Your orbital deck has <strong className="font-semibold text-white">{dueValue} active cards</strong>{' '}
                      waiting across sovereign nations and maritime straits. Two consecutive active-recall answers lock
                      each card into long-term mastery.
                    </>
                  ) : (
                    <>
                      Every scheduled card in your queue is caught up. Launch an ungraded practice expedition to sharpen
                      speed and pinpoint accuracy across any continent.
                    </>
                  )}
                </p>

                {/* Focus Vector Toggles (Capitals / Locations) */}
                <div className="mt-6">
                  <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    ACTIVE TRAINING VECTORS
                  </span>
                  <div className="mt-2.5 flex flex-wrap gap-3">
                    {focusVectors.map((vec) => {
                      const active = selectedAttributes.includes(vec.attr);
                      return (
                        <button
                          key={vec.attr}
                          onClick={() => {
                            soundFx.playClick();
                            onToggleAttribute(vec.attr);
                          }}
                          aria-pressed={active}
                          className={`group flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all active:scale-95 ${
                            active
                              ? vec.activeBg
                              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-lg">{vec.glyph}</span>
                          <div>
                            <span className="block text-xs font-extrabold uppercase tracking-wider">{vec.label}</span>
                            <span className="block font-mono text-[10px] text-slate-400 group-hover:text-slate-300">
                              {vec.sub}
                            </span>
                          </div>
                          <span
                            className={`ml-1 h-2.5 w-2.5 rounded-full transition-transform ${
                              active ? 'scale-110 bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-700'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Launch Button + Atlas & Arcade Triggers */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                    }}
                    className="group relative overflow-hidden flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 px-7 py-4 text-sm font-black uppercase tracking-[0.06em] text-slate-950 shadow-[0_18px_40px_-10px_rgba(16,185,129,0.65)] transition-all hover:scale-[1.02] hover:shadow-[0_22px_48px_-10px_rgba(34,211,238,0.75)] active:scale-[0.98]"
                  >
                    {/* Animated sheen sweep */}
                    <span
                      aria-hidden="true"
                      className="animate-gm-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                    />
                    <Play className="h-5 w-5 fill-slate-950 transition-transform group-hover:translate-x-0.5" />
                    <span>{data.isCaughtUp('All') ? 'Practice World Deck' : 'Launch World Expedition'}</span>
                    <span className="rounded-full bg-slate-950/20 px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-slate-950">
                      {data.isCaughtUp('All') ? '236' : dueValue}
                    </span>
                  </button>

                  <button
                    onClick={onOpenAtlas}
                    className="flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/75 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-slate-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/50 hover:bg-slate-800/90"
                  >
                    <Compass className="h-4 w-4 text-cyan-400" />
                    <span>Explorer Atlas</span>
                  </button>

                  <button
                    onClick={onOpenArcade}
                    className="flex items-center gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-amber-200 transition-all hover:-translate-y-0.5 hover:border-amber-400/60 hover:bg-amber-500/20"
                  >
                    <Zap className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>60s Time Attack</span>
                  </button>
                </div>
              </div>

              {/* Integrated Mastery Gauge & 4-Stage Retention Horizon */}
              <div className="mt-8 grid gap-4 rounded-2xl border border-slate-800/90 bg-slate-950/65 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
                {/* Circular Mastery Ring */}
                <div className="flex items-center gap-4 pr-2 sm:border-r sm:border-slate-800/80 sm:pr-5">
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                    <svg className="h-24 w-24 -rotate-90" viewBox="0 0 104 104">
                      <defs>
                        <linearGradient id="orbital-mastery-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={EMERALD} />
                          <stop offset="55%" stopColor={CYAN} />
                          <stop offset="100%" stopColor={AMBER} />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="52"
                        cy="52"
                        r={ringRadius}
                        className="stroke-slate-800"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="52"
                        cy="52"
                        r={ringRadius}
                        stroke="url(#orbital-mastery-grad)"
                        strokeWidth="8"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-xl font-bold leading-none tabular-nums text-white">
                        {masteryValue}%
                      </span>
                      <span className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                        Mastered
                      </span>
                    </div>
                  </div>
                  <div className="sm:hidden">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Planetary Horizon
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {data.pipeline.mastered + data.pipeline.recall} of {data.pipeline.total} entities in active memory
                    </p>
                  </div>
                </div>

                {/* 4-Stage Pipeline Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      MEMORY RETENTION HORIZON ({data.pipeline.total} SOVEREIGN & MARITIME ENTITIES)
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {data.pipeline.mastered + data.pipeline.recall} / {data.pipeline.total}
                    </span>
                  </div>

                  <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-slate-900 p-0.5">
                    <div
                      className="h-full rounded-l-full bg-emerald-400 transition-all duration-700"
                      style={{ width: `${(data.pipeline.mastered / data.pipeline.total) * 100}%` }}
                      title={`Mastered (L2): ${data.pipeline.mastered}`}
                    />
                    <div
                      className="h-full bg-amber-400 transition-all duration-700"
                      style={{ width: `${(data.pipeline.recall / data.pipeline.total) * 100}%` }}
                      title={`Active Recall (L1): ${data.pipeline.recall}`}
                    />
                    <div
                      className="h-full rounded-r-full bg-cyan-400/80 transition-all duration-700"
                      style={{ width: `${(data.pipeline.recognition / data.pipeline.total) * 100}%` }}
                      title={`Recognition (L0): ${data.pipeline.recognition}`}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'Mastered (L2)', val: data.pipeline.mastered, dot: 'bg-emerald-400', text: 'text-emerald-300' },
                      { label: 'Recall (L1)', val: data.pipeline.recall, dot: 'bg-amber-400', text: 'text-amber-300' },
                      { label: 'Scaffold (L0)', val: data.pipeline.recognition, dot: 'bg-cyan-400', text: 'text-cyan-300' },
                      { label: 'Uncharted', val: data.pipeline.uncharted, dot: 'bg-slate-600', text: 'text-slate-400' }
                    ].map((st) => (
                      <div
                        key={st.label}
                        className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/50 px-2.5 py-1.5"
                      >
                        <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                        <span className={`font-mono text-xs font-bold tabular-nums ${st.text}`}>{st.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive 3D Planetary Observatory */}
            <div className="relative flex flex-col items-center justify-center rounded-[1.75rem] border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6 shadow-inner">
              <InteractiveObservatoryGlobe
                targetCoords={activeRegionLock ? activeRegionLock.coords : null}
                targetLabel={activeRegionLock ? activeRegionLock.label : data.spotlight.name}
                targetTint={activeRegionLock ? activeRegionLock.tint : EMERALD}
                spotlightCoords={data.spotlight.coordinates}
                spotlightName={data.spotlight.name}
                masteredCountryCoords={masteredCoords}
                recallCountryCoords={recallCoords}
              />

              {/* Quick Sector Lock-On Pills below the Globe */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setActiveRegionLock(null);
                  }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] transition-all ${
                    activeRegionLock === null
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Crosshair className="h-3 w-3" />
                  <span>Auto-Orbit ({data.spotlight.name})</span>
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
                                coords: meta.coords,
                                tint: meta.tint
                              }
                        );
                      }}
                      className={`rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] transition-all ${
                        isLocked
                          ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                          : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {reg.emblem} {reg.shortName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. CONTINENTAL & MARITIME THEATERS ("SELECT YOUR THEATER") ── */}
        <section className="animate-gm-rise flex flex-col gap-4 [animation-delay:140ms]">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-400">
                REGIONAL EXPEDITION SECTORS
              </p>
              <h2 className={`${displayFont} mt-1 text-xl sm:text-2xl tracking-[-0.02em] text-white`}>
                SELECT YOUR THEATER OF OPERATIONS
              </h2>
            </div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Hover any sector to slew orbital camera · Click to deploy drill
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {data.regions.map((region) => {
              const meta = REGION_META[region.id] || REGION_META.Europe;
              const isHighlighted = activeRegionLock?.id === region.id;

              return (
                <button
                  key={region.id}
                  onMouseEnter={() =>
                    setActiveRegionLock({
                      id: region.id,
                      label: region.name,
                      coords: meta.coords,
                      tint: meta.tint
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
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-[1.5rem] border p-4 text-left transition-all duration-300 hover:-translate-y-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    isHighlighted
                      ? 'border-slate-500/80 bg-slate-900/90 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.75)]'
                      : 'border-slate-800/90 bg-slate-900/60 hover:border-slate-600/80 hover:bg-slate-900/85'
                  }`}
                >
                  {/* Top Illuminated Scanline on Hover */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-50 transition-opacity group-hover:opacity-100"
                    style={{ background: `linear-gradient(90deg, transparent, ${meta.tint}, transparent)` }}
                  />

                  {/* Ambient Corner Glow */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-45"
                    style={{ background: meta.tint }}
                  />

                  <div>
                    {/* Sector Header & Coordinate Tag */}
                    <div className="flex items-center justify-between font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      <span>{meta.sectorCode}</span>
                      <span>{meta.coordLabel}</span>
                    </div>

                    {/* Region Emblem, Name & Mastery Percentage */}
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-700/80 bg-slate-950/80 text-xl shadow-inner transition-transform group-hover:scale-105">
                          {region.emblem}
                        </span>
                        <div>
                          <span className={`${displayFont} block text-base leading-tight tracking-tight text-white`}>
                            {region.shortName.toUpperCase()}
                          </span>
                          <span className="mt-0.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {region.shortSubtitle}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className="font-mono text-2xl font-bold leading-none tabular-nums"
                          style={{ color: meta.tint }}
                        >
                          {region.masteredPct}%
                        </span>
                        <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-widest text-slate-500">
                          Mastery
                        </span>
                      </div>
                    </div>

                    {/* Dual-Layer Progress Bar (Mastered + Active Recall) */}
                    <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-950 p-0.5">
                      <span
                        className="h-full rounded-l-full transition-all duration-500"
                        style={{ width: `${region.masteredPct}%`, background: meta.tint }}
                      />
                      <span
                        className="h-full bg-amber-400/80 transition-all duration-500"
                        style={{ width: `${region.recallPct}%` }}
                      />
                    </div>

                    {/* Card Breakdown Row */}
                    <div className="mt-3 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      <span>
                        <strong className="text-white">{region.mastered}</strong>/{region.total} L2
                      </span>
                      <span className={region.recall > 0 ? 'text-amber-300' : 'text-slate-500'}>
                        {region.recall} L1 recall
                      </span>
                    </div>
                  </div>

                  {/* Deploy CTA Bar */}
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-200 transition-all group-hover:border-transparent group-hover:bg-emerald-500 group-hover:text-slate-950">
                    <span className="flex items-center gap-1.5">
                      <Play className="h-3 w-3 fill-current" />
                      {region.caughtUp ? 'Practice' : `Deploy · ${region.dueCount} due`}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 4. CARTOGRAPHER'S FIELD DOSSIER & TELEMETRY DECK ─────────── */}
        <section className="animate-gm-rise grid gap-5 lg:grid-cols-3 [animation-delay:220ms]">
          {/* Left 2 Columns: Daily Spotlight Nation Field Dossier */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[1.75rem] border border-slate-800/90 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-slate-950/90 p-6 sm:p-7 lg:col-span-2">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

            <div>
              {/* Dossier Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <Radio className="h-4 w-4 animate-pulse text-cyan-400" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
                    DAILY RECONNAISSANCE DOSSIER // ARCHIVE #{data.spotlight.numericId}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-slate-300">
                    {formatCoordinates(data.spotlight.coordinates)}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] ${
                      data.spotlightStatus.tone === 'mastered'
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : data.spotlightStatus.tone === 'recall'
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                        : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                    }`}
                  >
                    {data.spotlightStatus.label}
                  </span>
                </div>
              </div>

              {/* Spotlight Nation Identity */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-slate-700/80 bg-slate-950/90 text-5xl shadow-inner">
                    {data.spotlight.flagEmoji}
                  </div>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      {data.spotlight.subregion} · {data.spotlight.continent}
                    </p>
                    <h3 className={`${editorialFont} mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white`}>
                      {data.spotlight.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">{data.spotlight.officialName}</p>
                  </div>
                </div>

                {/* Interactive Capital Flashcard & Studio Audio Box */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/85 px-4 py-3">
                  <div className="min-w-[140px]">
                    <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      CAPITAL CITY RECALL
                    </span>
                    <span className="mt-1 block font-mono text-lg font-bold tracking-tight text-white">
                      {revealCapital ? data.spotlight.capital : '• • • • • • • •'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setRevealCapital((v) => !v);
                        soundFx.playClick();
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-2 font-mono text-[10px] font-extrabold uppercase tracking-wider text-slate-950 transition-colors hover:bg-cyan-300"
                    >
                      {revealCapital ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{revealCapital ? 'Mask' : 'Reveal'}</span>
                    </button>

                    <button
                      onClick={handlePronounceSpotlightCapital}
                      title="Listen to studio pronunciation of this capital"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-cyan-300 transition-colors hover:border-cyan-400 hover:text-white"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Cultural & Geopolitical Field Intelligence (Real Data from countries.ts) */}
              {data.spotlight.facts && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3">
                    <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <Scale className="h-3 w-3 text-cyan-400" />
                      Regime
                    </span>
                    <p className="mt-1.5 truncate text-xs font-semibold text-slate-200" title={data.spotlight.facts.politicalRegime}>
                      {data.spotlight.facts.politicalRegime || 'Sovereign Republic'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3">
                    <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <UserCheck className="h-3 w-3 text-emerald-400" />
                      Leadership
                    </span>
                    <p className="mt-1.5 truncate text-xs font-semibold text-slate-200" title={data.spotlight.facts.leader}>
                      {data.spotlight.facts.leader || 'Head of State'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3">
                    <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <Utensils className="h-3 w-3 text-amber-400" />
                      National Dish
                    </span>
                    <p className="mt-1.5 truncate text-xs font-semibold text-slate-200" title={data.spotlight.facts.cuisine}>
                      {data.spotlight.facts.cuisine || 'Traditional Cuisine'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3">
                    <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <Coins className="h-3 w-3 text-purple-400" />
                      Currency
                    </span>
                    <p className="mt-1.5 truncate text-xs font-semibold text-slate-200" title={data.spotlight.facts.currency}>
                      {data.spotlight.facts.currency || 'National Tender'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Dossier Footer Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
              <p className="text-xs text-slate-400">{data.spotlightStatus.hint}</p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setActiveRegionLock({
                      id: data.spotlight.id,
                      label: data.spotlight.name,
                      coords: data.spotlight.coordinates,
                      tint: EMERALD
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-400/60 hover:text-white"
                >
                  <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Pin on Globe</span>
                </button>

                <button
                  onClick={() => onStartSession(data.spotlight.continent, ['capital', 'location'], true)}
                  className="group flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-slate-950"
                >
                  <span>Drill {data.spotlight.continent}</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Lifetime Telemetry & Daily Expedition Quests */}
          <div className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-slate-800/90 bg-slate-900/75 p-6">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400">
                  LIFETIME TELEMETRY
                </span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>

              {/* 2x2 Compact Telemetry Readout Grid */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                  <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <Target className="h-3.5 w-3.5 text-cyan-400" />
                    Reviews
                  </span>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
                    {stats.totalReviews.toLocaleString()}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{data.reviewsToday} today</p>
                </div>

                <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                  <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                    Accuracy
                  </span>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-400">{data.accuracy}%</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">all-time precision</p>
                </div>

                <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                  <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                    Best Streak
                  </span>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-amber-300">{stats.longestStreak}d</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">active: {stats.currentStreak}d</p>
                </div>

                <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                  <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <Trophy className="h-3.5 w-3.5 text-purple-400" />
                    Charted
                  </span>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
                    {data.entitiesInMemory}
                    <span className="text-sm text-slate-500">/{data.totalWorldEntities}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{data.pipeline.uncharted} uncharted</p>
                </div>
              </div>
            </div>

            {/* Daily Expedition Directives */}
            <div className="border-t border-slate-800/80 pt-4">
              <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">
                DAILY EXPEDITION DIRECTIVES
              </span>
              <div className="mt-2.5 space-y-2">
                {[
                  {
                    label: 'Complete Daily Review Queue',
                    done: data.reviewsToday > 0 || data.totalDueCount === 0,
                    reward: '+50 XP'
                  },
                  {
                    label: 'Advance 5 Cards to Active Recall',
                    done: data.pipeline.recall + data.pipeline.mastered >= 5,
                    reward: '+35 XP'
                  },
                  {
                    label: 'Maintain Daily Navigator Streak',
                    done: stats.currentStreak > 0,
                    reward: 'SHIELD ON'
                  }
                ].map((quest) => (
                  <div
                    key={quest.label}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${
                          quest.done ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                      />
                      <span className={quest.done ? 'text-slate-200' : 'text-slate-400'}>{quest.label}</span>
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        quest.done ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {quest.reward}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. FOOTER TELEMETRY ──────────────────────────────────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70 px-1 pt-4 pb-2 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">
          <span>GEOMASTERY ORBITAL ATLAS · SPACED REPETITION ENGINE</span>
          <span>
            196 SOVEREIGN NATIONS · 40 MARITIME BODIES · {data.mastery.grandTotal} TOTAL CARDS
          </span>
        </footer>
      </div>
    </div>
  );
};

export default VelocityHome;
