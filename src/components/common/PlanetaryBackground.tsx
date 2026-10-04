import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import worldData110m from '../../assets/geo/countries-110m.json';

interface ArcDefinition {
  source: [number, number]; // [lng, lat]
  target: [number, number]; // [lng, lat]
  name: string;
  speed: number;
}

// Famous global knowledge corridors connecting world cultural capitals
const KNOWLEDGE_ARCS: ArcDefinition[] = [
  { source: [2.3522, 48.8566], target: [139.6917, 35.6895], name: 'Paris - Tokyo', speed: 0.0035 },
  { source: [-74.006, 40.7128], target: [-0.1278, 51.5074], name: 'New York - London', speed: 0.0042 },
  { source: [31.2357, 30.0444], target: [36.8219, -1.2921], name: 'Cairo - Nairobi', speed: 0.005 },
  { source: [103.8198, 1.3521], target: [151.2093, -33.8688], name: 'Singapore - Sydney', speed: 0.0038 },
  { source: [-47.8825, -15.7942], target: [-9.1393, 38.7223], name: 'Brasilia - Lisbon', speed: 0.004 },
  { source: [77.209, 28.6139], target: [55.2708, 25.2048], name: 'New Delhi - Dubai', speed: 0.0045 },
  { source: [126.978, 37.5665], target: [144.9631, -37.8136], name: 'Seoul - Melbourne', speed: 0.0032 }
];

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulseOffset: number;
}

interface PlanetaryBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const PlanetaryBackground: React.FC<PlanetaryBackgroundProps> = ({
  children,
  className = '',
  contentClassName = 'flex flex-col'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // Passive mouse tracking for subtle 3D tilt
  const mouseRef = useRef<{ x: number; y: number }>({ x: 600, y: 400 });
  const tiltRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  // Continuous rotation angle
  const baseRotationRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Photon particle progress tracking along each arc
  const arcProgressRef = useRef<number[]>(KNOWLEDGE_ARCS.map((_, i) => (i * 0.17) % 1));

  // Convert TopoJSON to GeoJSON features
  const geoLand = useMemo(() => {
    try {
      const geo = feature(worldData110m as any, (worldData110m as any).objects.land) as any;
      return geo;
    } catch (e) {
      console.error('Failed to parse TopoJSON land:', e);
      return null;
    }
  }, []);

  // Pre-generate cosmic starfield
  const stars = useMemo<Star[]>(() => {
    const starCount = 75;
    const items: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      items.push({
        x: Math.random(),
        y: Math.random(),
        radius: Math.random() * 1.4 + 0.6,
        baseAlpha: Math.random() * 0.45 + 0.2,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }
    return items;
  }, []);

  // Precomputed great circle interpolators
  const arcInterpolators = useMemo(() => {
    return KNOWLEDGE_ARCS.map((arc) => ({
      interpolator: d3.geoInterpolate(arc.source, arc.target),
      speed: arc.speed,
      arcGeoJSON: {
        type: 'LineString',
        coordinates: d3.range(0, 1.02, 0.025).map((t) => d3.geoInterpolate(arc.source, arc.target)(t))
      }
    }));
  }, []);

  // Window resize observer
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse move handler for gentle 3D tilt
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !geoLand) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Responsive globe position: offset to center-right on wide screens, centered on narrower screens
    const isWide = dimensions.width > 900;
    const cx = isWide ? dimensions.width * 0.68 : dimensions.width * 0.5;
    const cy = dimensions.height * 0.42;
    const radius = Math.max(260, Math.min(dimensions.width * 0.35, dimensions.height * 0.52));

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([cx, cy])
      .clipAngle(90);

    const path = d3.geoPath(projection, ctx);
    const graticule = d3.geoGraticule10();

    let frameCount = 0;

    const render = () => {
      frameCount++;

      // Passive smooth mouse tilt interpolation
      const targetYaw = ((mouseRef.current.x / dimensions.width) - 0.5) * 6;
      const targetPitch = ((mouseRef.current.y / dimensions.height) - 0.5) * -6;
      tiltRef.current.yaw += (targetYaw - tiltRef.current.yaw) * 0.04;
      tiltRef.current.pitch += (targetPitch - tiltRef.current.pitch) * 0.04;

      // Continuous serene rotation
      baseRotationRef.current += 0.06;
      const currentYaw = baseRotationRef.current + tiltRef.current.yaw;
      const currentPitch = -18 + tiltRef.current.pitch;

      projection.rotate([currentYaw, currentPitch, 0]);

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // 1. Draw Starfield
      for (const s of stars) {
        const sx = s.x * dimensions.width;
        const sy = s.y * dimensions.height;
        const alpha = s.baseAlpha + Math.sin(frameCount * s.pulseSpeed + s.pulseOffset) * 0.15;
        ctx.fillStyle = `rgba(226, 232, 240, ${Math.max(0.08, alpha)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s.radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 2. Multi-Layer Atmospheric Aurora Limb Glow
      const atmosphereGlow = ctx.createRadialGradient(cx, cy, radius * 0.94, cx, cy, radius * 1.32);
      atmosphereGlow.addColorStop(0, 'rgba(14, 165, 233, 0.32)'); // Radiant cyan
      atmosphereGlow.addColorStop(0.35, 'rgba(16, 185, 129, 0.18)'); // Emerald aurora
      atmosphereGlow.addColorStop(0.7, 'rgba(56, 189, 248, 0.06)'); // Soft sky mist
      atmosphereGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = atmosphereGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.32, 0, 2 * Math.PI);
      ctx.fill();

      // 3. Globe Sphere Body (Deep Oceanic Core)
      const oceanGradient = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.35,
        radius * 0.05,
        cx,
        cy,
        radius
      );
      oceanGradient.addColorStop(0, '#1e293b'); // Elevated slate
      oceanGradient.addColorStop(0.65, '#0f172a'); // Deep slate
      oceanGradient.addColorStop(1, '#090d16'); // Outer limb shadow
      ctx.fillStyle = oceanGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fill();

      // 4. Latitude/Longitude Graticules
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      path(graticule);
      ctx.stroke();

      // 5. Continental Landmasses
      ctx.fillStyle = 'rgba(30, 41, 59, 0.88)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)'; // Luminous cyan coastline
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      path(geoLand);
      ctx.fill();
      ctx.stroke();

      // 6. Geodesic Flight Arcs & Traveling Photons
      arcInterpolators.forEach((arcData, i) => {
        // Draw the static curved great circle arc
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        path(arcData.arcGeoJSON as any);
        ctx.stroke();

        // Advance photon progress
        arcProgressRef.current[i] = (arcProgressRef.current[i] + arcData.speed) % 1;
        const t = arcProgressRef.current[i];
        const point = arcData.interpolator(t);

        // Check if the point is on visible hemisphere
        const centerCoords = [-currentYaw, -currentPitch];
        const dist = d3.geoDistance(point, centerCoords as any);
        if (dist < Math.PI / 2) {
          const projected = projection(point);
          if (projected) {
            const [px, py] = projected;
            // Photon aura
            const photonGlow = ctx.createRadialGradient(px, py, 0, px, py, 6);
            photonGlow.addColorStop(0, 'rgba(52, 211, 153, 0.95)'); // Emerald core
            photonGlow.addColorStop(0.4, 'rgba(56, 189, 248, 0.6)');
            photonGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = photonGlow;
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, 2 * Math.PI);
            ctx.fill();

            // Core center dot
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 1.4, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      });

      // 7. Planet Rim Highlight (Crisp Limelight)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.stroke();

      // 8. Deep Space Celestial Body: Crescent Moon (Upper Left Cosmic Expanse)
      if (dimensions.width > 768) {
        const moonX = dimensions.width * 0.11;
        const moonY = dimensions.height * 0.14;
        const moonRadius = 22;

        // Dark side earthshine
        ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Moon subtle lunar halo
        const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.8, moonX, moonY, moonRadius * 2);
        moonGlow.addColorStop(0, 'rgba(226, 232, 240, 0.12)');
        moonGlow.addColorStop(1, 'rgba(226, 232, 240, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius * 2, 0, 2 * Math.PI);
        ctx.fill();

        // Silver illuminated crescent
        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, 2 * Math.PI);
        ctx.clip();

        // Sunlit side
        ctx.fillStyle = 'rgba(241, 245, 249, 0.9)';
        ctx.beginPath();
        ctx.arc(moonX - 5, moonY - 2, moonRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Shadow cut-out creating the crescent
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(moonX + 3, moonY - 1, moonRadius * 0.9, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }

      // 9. Navigational Satellite (GeoMastery Recon Orbiter) & Trajectory Arc
      if (dimensions.width > 900) {
        const satOrbitRadiusX = dimensions.width * 0.62;
        const satOrbitRadiusY = dimensions.height * 0.44;

        // Orbit Trajectory Arc
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.setLineDash([4, 8]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, satOrbitRadiusX, satOrbitRadiusY, -Math.PI / 10, Math.PI * 0.82, Math.PI * 1.55);
        ctx.stroke();
        ctx.setLineDash([]);

        // Satellite position traveling along orbit
        const satAngle = Math.PI * 1.18 + Math.sin(frameCount * 0.003) * 0.15;
        const rot = -Math.PI / 10;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const rawX = Math.cos(satAngle) * satOrbitRadiusX;
        const rawY = Math.sin(satAngle) * satOrbitRadiusY;
        const satX = cx + cosR * rawX - sinR * rawY;
        const satY = cy + sinR * rawX + cosR * rawY;

        // Radio signal pulse rings
        const pulseCycle = (frameCount * 0.025) % 1;
        const pulseRadius = pulseCycle * 32 + 4;
        const pulseAlpha = (1 - pulseCycle) * 0.4;
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulseAlpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(satX, satY, pulseRadius, 0, 2 * Math.PI);
        ctx.stroke();

        // Solar panels
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(satX - 14, satY - 2.5, 8, 5);
        ctx.fillRect(satX + 6, satY - 2.5, 8, 5);
        // Solar panel grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(satX - 14, satY - 2.5, 8, 5);
        ctx.strokeRect(satX + 6, satY - 2.5, 8, 5);

        // Satellite bus body
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(satX - 4, satY - 3.5, 8, 7);

        // Blinking beacon photon
        const isBlink = Math.sin(frameCount * 0.15) > 0;
        ctx.fillStyle = isBlink ? '#34d399' : '#047857';
        ctx.beginPath();
        ctx.arc(satX, satY, 1.8, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 10. Left-Edge Cartographic Coordinate Telemetry & Astrolabe Quadrant
      if (dimensions.width > 1100) {
        // Astrolabe arcs in upper-left corner
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 180, 0, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 280, 0, Math.PI / 2);
        ctx.stroke();

        // Coordinate ticks along left edge
        const tickYValues = [0.2, 0.35, 0.5, 0.65, 0.8];
        const labels = ['+60°N', '+30°N', 'EQ 00°', '-30°S', '-60°S'];
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;

        tickYValues.forEach((frac, idx) => {
          const ty = dimensions.height * frac;
          ctx.beginPath();
          ctx.moveTo(8, ty);
          ctx.lineTo(20, ty);
          ctx.stroke();
          ctx.fillText(labels[idx], 24, ty + 3);
        });

        // Top Telemetry Header
        ctx.fillText('GEO-ORBITAL RECON // CH-01', 24, dimensions.height * 0.25);
        ctx.fillText('EPHEMERIS: TRACKING ACTIVE', 24, dimensions.height * 0.25 + 13);
        ctx.fillText('FOV: 45° • MAG: 1.0X', 24, dimensions.height * 0.25 + 26);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [dimensions, geoLand, stars, arcInterpolators]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full h-full overflow-hidden bg-[#090d16] ${className}`}
    >
      {/* 3D Animated Planetary Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none select-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Atmospheric Contrast Overlays */}
      {/* Softened left-edge vignette: preserves celestial depth while maintaining high readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#090d16]/75 via-[#090d16]/40 to-transparent pointer-events-none" />

      {/* Bottom fade: softens cards as they scroll */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#090d16] via-[#090d16]/60 to-transparent pointer-events-none" />

      {/* Subtle top ambient vignette */}
      <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-[#090d16]/80 to-transparent pointer-events-none" />

      {/* Cartographic Coordinate Grid Overlay (Faint Background Grid) */}
      <div className="absolute inset-0 pointer-events-none select-none opacity-30">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="carto-subtle-grid" width="90" height="90" patternUnits="userSpaceOnUse">
              <path d="M 90 0 L 0 0 0 90" fill="none" stroke="rgba(148, 163, 184, 0.03)" strokeWidth="1" />
              <circle cx="0" cy="0" r="1.2" fill="rgba(56, 189, 248, 0.12)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#carto-subtle-grid)" />
        </svg>
      </div>

      {/* Main Foreground Content */}
      <div className={`relative z-10 w-full h-full ${contentClassName}`}>{children}</div>
    </div>
  );
};
