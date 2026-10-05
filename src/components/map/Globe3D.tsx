import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import worldData50m from '../../assets/geo/countries-50m.json';
import waterBodies50m from '../../assets/geo/water-bodies-50m.json';
import { Country, SRSItem } from '../../core/types';
import { COUNTRIES_BY_ID, COUNTRIES_BY_NUMERIC } from '../../assets/data/countries';
import { WATER_BODIES, getWaterBodyById, WaterBody } from '../../assets/data/waterBodies';
import { waterBodyToCountry } from '../../core/srsEngine';
import { getMicrostateList } from '../../core/microstates';

interface Globe3DProps {
  selectedCountryId?: string | null;
  targetCountryId?: string | null;
  feedbackState?: 'correct' | 'incorrect' | 'neutral' | null;
  highlightedCountryIds?: string[];
  srsItemsMap?: Map<string, SRSItem>;
  showHeatmap?: boolean;
  autoRotate?: boolean;
  disableAutoSpin?: boolean;
  onSelectCountry?: (country: Country) => void;
  className?: string;
}

export const Globe3D: React.FC<Globe3DProps> = ({
  selectedCountryId,
  targetCountryId,
  feedbackState,
  highlightedCountryIds = [],
  srsItemsMap,
  showHeatmap = false,
  autoRotate = false,
  disableAutoSpin = false,
  onSelectCountry,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredCountry, setHoveredCountry] = useState<{ country: Country; x: number; y: number } | null>(null);

  // Rotation angles: [yaw, pitch, roll]
  const rotationRef = useRef<[number, number, number]>([0, -20, 0]);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  // Convert TopoJSON to GeoJSON features
  const geoFeatures = useMemo(() => {
    try {
      const geo = feature(worldData50m as any, (worldData50m as any).objects.countries) as any;
      return geo.features as any[];
    } catch (e) {
      console.error('Failed to parse TopoJSON:', e);
      return [];
    }
  }, []);

  const countryFeatureItems = useMemo(() => {
    return geoFeatures.map((feat) => {
      const country = COUNTRIES_BY_NUMERIC.get(String(feat.id));
      const b = d3.geoBounds(feat);
      return {
        feat,
        country,
        bbox: [b[0][0], b[0][1], b[1][0], b[1][1]] as [number, number, number, number],
        isCrossAntimeridian: b[0][0] > b[1][0]
      };
    });
  }, [geoFeatures]);

  const microstateList = useMemo(() => getMicrostateList(), []);

  const hoveredWaterIdRef = useRef<string | null>(null);

  const waterGeoFeatures = useMemo(() => {
    try {
      const geo = feature(waterBodies50m as any, (waterBodies50m as any).objects.water_bodies) as any;
      const rawFeatures = (geo.features as any[]) || [];
      const clampCoord = ([x, y]: [number, number]): [number, number] => [
        Math.max(-180, Math.min(180, x)),
        Math.max(-89.999, Math.min(89.999, y))
      ];
      const densifyRing = (ring: [number, number][]): [number, number][] => {
        const newRing: [number, number][] = [];
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = clampCoord(ring[i]);
          const p2 = clampCoord(ring[i + 1]);
          newRing.push(p1);
          const dLat = Math.abs(p1[1] - p2[1]);
          const dLng = Math.abs(p1[0] - p2[0]);
          if (dLat < 0.1 && dLng > 2.0) {
            const steps = Math.ceil(dLng / 2.0);
            const stepLng = (p2[0] - p1[0]) / steps;
            const stepLat = (p2[1] - p1[1]) / steps;
            for (let s = 1; s < steps; s++) {
              newRing.push([
                +(p1[0] + s * stepLng).toFixed(5),
                +(p1[1] + s * stepLat).toFixed(5)
              ]);
            }
          }
        }
        newRing.push(clampCoord(ring[ring.length - 1]));
        return newRing;
      };

      return rawFeatures.map((feat) => {
        if (!feat.geometry) return feat;
        if (feat.geometry.type === 'Polygon') {
          return {
            ...feat,
            geometry: {
              ...feat.geometry,
              coordinates: feat.geometry.coordinates.map((ring: any) => densifyRing(ring))
            }
          };
        }
        if (feat.geometry.type === 'MultiPolygon') {
          return {
            ...feat,
            geometry: {
              ...feat.geometry,
              coordinates: feat.geometry.coordinates.map((poly: any) => poly.map((ring: any) => densifyRing(ring)))
            }
          };
        }
        return feat;
      });
    } catch (e) {
      console.error('Failed to parse water bodies TopoJSON:', e);
      return [];
    }
  }, []);

  const waterFeatureItems = useMemo(() => {
    return waterGeoFeatures
      .map((feat) => {
        const wb = getWaterBodyById(feat.id);
        if (!wb) return null;
        const b = d3.geoBounds(feat);
        return {
          feat,
          wb,
          bbox: [b[0][0], b[0][1], b[1][0], b[1][1]] as [number, number, number, number],
          isCrossAntimeridian: b[0][0] > b[1][0]
        };
      })
      .filter((item): item is { feat: any; wb: WaterBody; bbox: [number, number, number, number]; isCrossAntimeridian: boolean } => item !== null);
  }, [waterGeoFeatures]);

  const sortedWaterItemsForDetection = useMemo(() => {
    return [...waterFeatureItems].sort((a, b) => {
      const typeRank = (t: string) => {
        if (t === 'strait' || t === 'channel') return 1;
        if (t === 'sea' || t === 'gulf' || t === 'bay') return 2;
        return 3;
      };
      return typeRank(a.wb.type) - typeRank(b.wb.type);
    });
  }, [waterFeatureItems]);

  const sortedWaterItemsForRender = useMemo(() => {
    return [...waterFeatureItems].sort((a, b) => {
      const typeRank = (t: string) => {
        if (t === 'ocean') return 1;
        if (t === 'sea' || t === 'gulf' || t === 'bay') return 2;
        return 3;
      };
      return typeRank(a.wb.type) - typeRank(b.wb.type);
    });
  }, [waterFeatureItems]);

  // Responsive sizing
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

  // Setup D3 Orthographic Projection
  const projection = useMemo(() => {
    const radius = Math.min(dimensions.width, dimensions.height) / 2.3;
    return d3
      .geoOrthographic()
      .scale(radius)
      .translate([dimensions.width / 2, dimensions.height / 2])
      .clipAngle(90);
  }, [dimensions]);

  // Determine country fill color (Elevated base fill #334155 for high contrast against deep ocean)
  const getCountryFill = useCallback(
    (country?: Country) => {
      if (!country) return '#334155';

      if (feedbackState === 'correct') {
        if (country.id === targetCountryId || country.id === selectedCountryId) {
          return '#10b981'; // Emerald
        }
      }
      if (feedbackState === 'incorrect') {
        if (country.id === targetCountryId) return '#10b981'; // Correct answer in Emerald
        if (country.id === selectedCountryId) return '#f43f5e'; // Rose for wrong pick
      }

      if (country.id === selectedCountryId) return '#0284c7';
      if (highlightedCountryIds.includes(country.id)) return '#38bdf8';

      if (showHeatmap && srsItemsMap) {
        const cap = srsItemsMap.get(`${country.id}:capital`);
        const loc = srsItemsMap.get(`${country.id}:location`);
        const score = (cap?.stage || 0) + (loc?.stage || 0);
        if (score >= 3) return '#059669';
        if (score === 2) return '#10b981';
        if (score === 1) return '#d97706';
        return '#334155';
      }

      return '#334155';
    },
    [feedbackState, targetCountryId, selectedCountryId, highlightedCountryIds, showHeatmap, srsItemsMap]
  );

  // Smooth spin to focus country coordinates
  const spinToCountry = useCallback(
    (countryId: string) => {
      const wb = getWaterBodyById(countryId);
      const c = wb ? waterBodyToCountry(wb) : COUNTRIES_BY_ID.get(countryId);
      if (!c || !c.coordinates) return;

      const [targetLng, targetLat] = c.coordinates;
      const targetRotation: [number, number, number] = [-targetLng, -targetLat, 0];
      const startRotation = [...rotationRef.current] as [number, number, number];

      const interpolator = d3.interpolate(startRotation, targetRotation);
      const startTime = performance.now();
      const duration = 1000;

      const animateSpin = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const ease = d3.easeCubicOut(t);
        rotationRef.current = interpolator(ease);

        if (t < 1) {
          requestAnimationFrame(animateSpin);
        }
      };

      requestAnimationFrame(animateSpin);
    },
    []
  );

  // Auto-focus when target or selected country changes
  useEffect(() => {
    if (disableAutoSpin) return;
    const cid = selectedCountryId || targetCountryId;
    if (cid) {
      spinToCountry(cid);
    }
  }, [selectedCountryId, targetCountryId, disableAutoSpin, spinToCountry]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const path = d3.geoPath(projection, ctx);
    const graticule = d3.geoGraticule10();

    const render = () => {
      // Auto-rotation or inertia deceleration
      if (autoRotate && !isDraggingRef.current) {
        rotationRef.current[0] += 0.2;
      } else if (!isDraggingRef.current) {
        rotationRef.current[0] += velocityRef.current.x;
        rotationRef.current[1] = Math.max(-80, Math.min(80, rotationRef.current[1] + velocityRef.current.y));
        velocityRef.current.x *= 0.94;
        velocityRef.current.y *= 0.94;
      }

      projection.rotate(rotationRef.current);

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const radius = Math.min(dimensions.width, dimensions.height) / 2.3;
      const [cx, cy] = [dimensions.width / 2, dimensions.height / 2];

      // Atmospheric outer glow
      const outerGlow = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.15);
      outerGlow.addColorStop(0, 'rgba(14, 165, 233, 0.25)');
      outerGlow.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
      outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.15, 0, 2 * Math.PI);
      ctx.fill();

      // Globe sphere ocean (Deep bathymetric gradient for high contrast)
      const oceanGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      oceanGrad.addColorStop(0, '#142036');
      oceanGrad.addColorStop(1, '#090e1a');
      ctx.fillStyle = oceanGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Graticules (Latitude / Longitude grid)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      path(graticule);
      ctx.stroke();

      const centerCoords = [-rotationRef.current[0], -rotationRef.current[1]];

      // Draw Water Body Basin Polygons (rendered UNDER country landmasses so coastlines cleanly mask them)
      for (const { feat, wb } of sortedWaterItemsForRender) {
        const isSelected = wb.id === selectedCountryId;
        const isTarget = wb.id === targetCountryId;
        const isHovered = wb.id === hoveredWaterIdRef.current;
        const isFeedback = feedbackState !== null && (isSelected || isTarget);
        const isHighlighted = highlightedCountryIds.includes(wb.id);

        const isOcean = wb.type === 'ocean';
        const isActive = isSelected || isTarget || isHovered || isFeedback || isHighlighted;

        // Performance standard: Inactive oceans blend into the dark navy ocean sphere.
        // Skipping invisible full-ocean path renders at 60fps delivers zero-lag rotation!
        if (isOcean && !isActive) continue;

        let fillStyle =
          wb.type === 'strait' || wb.type === 'channel'
            ? 'rgba(14, 165, 233, 0.18)'
            : wb.type === 'ocean'
            ? 'rgba(3, 105, 161, 0.05)'
            : 'rgba(14, 165, 233, 0.09)';
        let strokeStyle =
          wb.type === 'strait' || wb.type === 'channel'
            ? 'rgba(56, 189, 248, 0.35)'
            : wb.type === 'ocean'
            ? 'transparent'
            : 'rgba(56, 189, 248, 0.15)';
        let lineWidth = 0.8;

        if (feedbackState === 'correct' && (isSelected || isTarget)) {
          fillStyle = 'rgba(16, 185, 129, 0.45)';
          strokeStyle = '#10b981';
          lineWidth = 1.6;
        } else if (feedbackState === 'incorrect') {
          if (isTarget) {
            fillStyle = 'rgba(16, 185, 129, 0.45)';
            strokeStyle = '#10b981';
            lineWidth = 1.6;
          } else if (isSelected) {
            fillStyle = 'rgba(244, 63, 94, 0.45)';
            strokeStyle = '#f43f5e';
            lineWidth = 1.6;
          }
        } else if (isHovered) {
          fillStyle = 'rgba(14, 165, 233, 0.45)';
          strokeStyle = '#38bdf8';
          lineWidth = 1.6;
        } else if (isSelected || isTarget) {
          fillStyle = 'rgba(2, 132, 199, 0.4)';
          strokeStyle = '#38bdf8';
          lineWidth = 1.4;
        } else if (highlightedCountryIds.includes(wb.id)) {
          fillStyle = 'rgba(56, 189, 248, 0.35)';
          strokeStyle = '#38bdf8';
          lineWidth = 1.2;
        }

        ctx.beginPath();
        path(feat);
        ctx.fillStyle = fillStyle;
        ctx.fill();
        if (strokeStyle !== 'transparent') {
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
      }

      // Draw countries (Elevated fill & hairline borders)
      for (const feat of geoFeatures) {
        const country = COUNTRIES_BY_NUMERIC.get(String(feat.id));
        ctx.fillStyle = getCountryFill(country);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 0.8;

        ctx.beginPath();
        path(feat);
        ctx.fill();
        ctx.stroke();
      }

      // Draw Water Bodies on 3D Globe
      for (const wb of WATER_BODIES) {
        const isSelected = wb.id === selectedCountryId;
        const isTarget = wb.id === targetCountryId;
        const isStrait = wb.type === 'strait' || wb.type === 'channel';

        const dist = d3.geoDistance(wb.coordinates, centerCoords as any);
        if (dist < Math.PI / 2) {
          const projected = projection(wb.coordinates);
          if (projected) {
            const [px, py] = projected;
            const isOcean = wb.type === 'ocean';

            if (isSelected || isTarget) {
              ctx.strokeStyle =
                feedbackState === 'correct'
                  ? '#10b981'
                  : feedbackState === 'incorrect'
                  ? '#f43f5e'
                  : '#38bdf8';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.arc(px, py, isOcean ? 14 : 9, 0, 2 * Math.PI);
              ctx.stroke();
            }

            ctx.fillStyle = isStrait ? '#06b6d4' : isOcean ? '#38bdf8' : '#0ea5e9';
            if (feedbackState === 'correct' && (isSelected || isTarget)) ctx.fillStyle = '#10b981';
            else if (feedbackState === 'incorrect' && isSelected) ctx.fillStyle = '#f43f5e';
            else if (feedbackState === 'incorrect' && isTarget) ctx.fillStyle = '#10b981';

            ctx.strokeStyle = isSelected || isTarget ? '#ffffff' : '#e0f2fe';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, isOcean ? 5.5 : isStrait ? 4 : 4.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      // Draw Microstate Beacons on 3D Globe (Vatican, Tuvalu, Nauru, etc.)
      for (const country of microstateList) {
        const dist = d3.geoDistance(country.coordinates, centerCoords as any);
        if (dist < Math.PI / 2) {
          const projected = projection(country.coordinates);
          if (projected) {
            const [px, py] = projected;
            const isSelected = country.id === selectedCountryId;
            const isTarget = country.id === targetCountryId;

            // Subtle pulsing beacon ring for selected/target microstates
            if (isSelected || isTarget) {
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.arc(px, py, 7, 0, 2 * Math.PI);
              ctx.stroke();
            }

            ctx.fillStyle = getCountryFill(country);
            ctx.strokeStyle = isSelected || isTarget ? '#ffffff' : '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      // Globe rim highlight
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    dimensions,
    projection,
    geoFeatures,
    getCountryFill,
    autoRotate,
    sortedWaterItemsForRender,
    feedbackState,
    targetCountryId,
    selectedCountryId,
    highlightedCountryIds,
    microstateList
  ]);

  // Mouse interaction handlers for rotation and drag
  const mouseHoverCoordsRef = useRef<{ mx: number; my: number; clientX: number; clientY: number } | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverRafRef.current) {
        cancelAnimationFrame(hoverRafRef.current);
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { x: 0, y: 0 };
    if (hoverRafRef.current) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
  };

  const processHover = useCallback(() => {
    hoverRafRef.current = null;
    const coords = mouseHoverCoordsRef.current;
    if (!coords || !containerRef.current || isDraggingRef.current) return;

    const { mx, my, clientX, clientY } = coords;

    // Check proximity to microstates first (since microstates are sub-pixel)
    const center = [-rotationRef.current[0], -rotationRef.current[1]];
    let nearestMicrostate: Country | null = null;
    let minMicroDist = Infinity;
    for (const m of microstateList) {
      if (d3.geoDistance(m.coordinates, center as any) < Math.PI / 2) {
        const p = projection(m.coordinates);
        if (p) {
          const d = Math.hypot(mx - p[0], my - p[1]);
          if (d <= 18 && d < minMicroDist) {
            minMicroDist = d;
            nearestMicrostate = m;
          }
        }
      }
    }

    if (nearestMicrostate) {
      hoveredWaterIdRef.current = null;
      setHoveredCountry({ country: nearestMicrostate, x: clientX, y: clientY });
      return;
    }

    const geoCoords = projection.invert ? projection.invert([mx, my]) : null;
    if (geoCoords) {
      const [lng, lat] = geoCoords;
      if (!isNaN(lng) && !isNaN(lat)) {
        // Fast bounding-box filtered land check (Zero lag)
        let matchCountry: Country | null = null;
        for (const item of countryFeatureItems) {
          if (lat < item.bbox[1] || lat > item.bbox[3]) continue;
          if (!item.isCrossAntimeridian && (lng < item.bbox[0] || lng > item.bbox[2])) continue;
          if (d3.geoContains(item.feat, [lng, lat])) {
            matchCountry = item.country || null;
            break;
          }
        }

        if (matchCountry) {
          hoveredWaterIdRef.current = null;
          setHoveredCountry({ country: matchCountry, x: clientX, y: clientY });
          return;
        }

        // Fast bounding-box filtered water body check
        for (const { feat, wb, bbox, isCrossAntimeridian } of sortedWaterItemsForDetection) {
          if (lat < bbox[1] || lat > bbox[3]) continue;
          if (isCrossAntimeridian ? (lng < bbox[0] && lng > bbox[2]) : (lng < bbox[0] || lng > bbox[2])) continue;
          if (d3.geoContains(feat, [lng, lat])) {
            hoveredWaterIdRef.current = wb.id;
            setHoveredCountry({ country: waterBodyToCountry(wb), x: clientX, y: clientY });
            return;
          }
        }
      }
    }

    // Proximity fallback to water body beacon dots
    for (const wb of WATER_BODIES) {
      if (d3.geoDistance(wb.coordinates, center as any) < Math.PI / 2) {
        const p = projection(wb.coordinates);
        if (p) {
          const d = Math.hypot(mx - p[0], my - p[1]);
          const thresh =
            wb.type === 'strait' || wb.type === 'channel'
              ? 22
              : wb.type === 'sea' || wb.type === 'gulf' || wb.type === 'bay'
              ? 32
              : 45;
          if (d <= thresh) {
            hoveredWaterIdRef.current = wb.id;
            setHoveredCountry({ country: waterBodyToCountry(wb), x: clientX, y: clientY });
            return;
          }
        }
      }
    }

    hoveredWaterIdRef.current = null;
    setHoveredCountry(null);
  }, [countryFeatureItems, microstateList, projection, sortedWaterItemsForDetection]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current && lastMousePosRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      const sensitivity = 0.35;
      rotationRef.current[0] += dx * sensitivity;
      rotationRef.current[1] = Math.max(-80, Math.min(80, rotationRef.current[1] - dy * sensitivity));

      velocityRef.current = { x: dx * 0.15, y: -dy * 0.15 };
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    } else {
      // RAF-throttled hover detection on globe surface (avoids freezing the event loop)
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        mouseHoverCoordsRef.current = {
          mx: e.clientX - rect.left,
          my: e.clientY - rect.top,
          clientX: e.clientX,
          clientY: e.clientY
        };
        if (!hoverRafRef.current) {
          hoverRafRef.current = requestAnimationFrame(processHover);
        }
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    lastMousePosRef.current = null;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    lastMousePosRef.current = null;
    hoveredWaterIdRef.current = null;
    setHoveredCountry(null);
    if (hoverRafRef.current) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (Math.abs(velocityRef.current.x) > 1 || Math.abs(velocityRef.current.y) > 1) {
      return; // Was dragging, don't trigger click
    }

    if (containerRef.current && onSelectCountry) {
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check proximity to microstates first
      const center = [-rotationRef.current[0], -rotationRef.current[1]];
      let nearestMicrostate: Country | null = null;
      let minMicroDist = Infinity;
      for (const m of microstateList) {
        if (d3.geoDistance(m.coordinates, center as any) < Math.PI / 2) {
          const p = projection(m.coordinates);
          if (p) {
            const d = Math.hypot(mx - p[0], my - p[1]);
            if (d <= 22 && d < minMicroDist) {
              minMicroDist = d;
              nearestMicrostate = m;
            }
          }
        }
      }

      if (nearestMicrostate) {
        onSelectCountry(nearestMicrostate);
        return;
      }

      const coords = projection.invert ? projection.invert([mx, my]) : null;
      if (coords) {
        const [lng, lat] = coords;
        if (!isNaN(lng) && !isNaN(lat)) {
          // Fast bounding-box filtered land check
          let matchedCountry: Country | null = null;
          for (const item of countryFeatureItems) {
            if (lat < item.bbox[1] || lat > item.bbox[3]) continue;
            if (!item.isCrossAntimeridian && (lng < item.bbox[0] || lng > item.bbox[2])) continue;
            if (d3.geoContains(item.feat, [lng, lat])) {
              matchedCountry = item.country || null;
              break;
            }
          }
          if (matchedCountry) {
            onSelectCountry(matchedCountry);
            return;
          }

          // Water body basin click
          for (const { feat, wb, bbox, isCrossAntimeridian } of sortedWaterItemsForDetection) {
            if (lat < bbox[1] || lat > bbox[3]) continue;
            if (isCrossAntimeridian ? (lng < bbox[0] && lng > bbox[2]) : (lng < bbox[0] || lng > bbox[2])) continue;
            if (d3.geoContains(feat, [lng, lat])) {
              onSelectCountry(waterBodyToCountry(wb));
              return;
            }
          }
        }
      }

      // Fallback proximity to water body beacon dots
      for (const wb of WATER_BODIES) {
        if (d3.geoDistance(wb.coordinates, center as any) < Math.PI / 2) {
          const p = projection(wb.coordinates);
          if (p) {
            const d = Math.hypot(mx - p[0], my - p[1]);
            const thresh =
              wb.type === 'strait' || wb.type === 'channel'
                ? 24
                : wb.type === 'sea' || wb.type === 'gulf' || wb.type === 'bay'
                ? 36
                : 50;
            if (d <= thresh) {
              onSelectCountry(waterBodyToCountry(wb));
              return;
            }
          }
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#090e1a] select-none ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing block" />

      {/* Floating Hover Tooltip */}
      {hoveredCountry && (
        <div
          className="fixed pointer-events-none z-50 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-full mb-3 text-xs flex items-center gap-2"
          style={{ left: hoveredCountry.x, top: hoveredCountry.y }}
        >
          <span className="text-base">{hoveredCountry.country.flagEmoji}</span>
          <div>
            <div className="font-bold text-white tracking-wide">
              {hoveredCountry.country.officialName || hoveredCountry.country.name}
            </div>
            <div className="text-[10px] text-emerald-400">
              {hoveredCountry.country.id.startsWith('WATER_')
                ? `${hoveredCountry.country.subregion} • ${hoveredCountry.country.facts?.significance || ''}`
                : `Capital: ${hoveredCountry.country.capital}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
