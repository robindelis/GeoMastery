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

interface VectorMap2DProps {
  selectedCountryId?: string | null;
  targetCountryId?: string | null;
  feedbackState?: 'correct' | 'incorrect' | 'neutral' | null;
  highlightedCountryIds?: string[];
  srsItemsMap?: Map<string, SRSItem>;
  showHeatmap?: boolean;
  disableAutoZoom?: boolean;
  onSelectCountry?: (country: Country) => void;
  className?: string;
}

interface CountryFeatureItem {
  id: string | number;
  country?: Country;
  pathD: string;
}

interface CountryPolygonProps {
  country?: Country;
  pathD: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
  isFeedbackCorrect: boolean;
  isFeedbackIncorrect: boolean;
  onCountryHover: (country?: Country) => void;
  onCountryLeave: () => void;
  onSelectCountry?: (country: Country) => void;
}

// Memoized Country Polygon: Only updates when its specific fill/stroke/feedback state changes!
const CountryPolygon = React.memo<CountryPolygonProps>(
  ({
    country,
    pathD,
    fill,
    stroke,
    strokeWidth,
    isFeedbackCorrect,
    isFeedbackIncorrect,
    onCountryHover,
    onCountryLeave,
    onSelectCountry,
  }) => {
    const onSelectRef = useRef(onSelectCountry);
    onSelectRef.current = onSelectCountry;

    const onHoverRef = useRef(onCountryHover);
    onHoverRef.current = onCountryHover;

    const onLeaveRef = useRef(onCountryLeave);
    onLeaveRef.current = onCountryLeave;

    const handleMouseEnter = useCallback(() => {
      onHoverRef.current?.(country);
    }, [country]);

    const handleMouseLeave = useCallback(() => {
      onLeaveRef.current?.();
    }, []);

    const handleClick = useCallback(() => {
      if (country) {
        onSelectRef.current?.(country);
      }
    }, [country]);

    return (
      <path
        d={pathD}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        className={`country-vector-path cursor-pointer ${
          isFeedbackCorrect ? 'map-country-correct' : ''
        } ${isFeedbackIncorrect ? 'map-country-incorrect' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    );
  },
  (prev, next) => {
    return (
      prev.fill === next.fill &&
      prev.stroke === next.stroke &&
      prev.strokeWidth === next.strokeWidth &&
      prev.isFeedbackCorrect === next.isFeedbackCorrect &&
      prev.isFeedbackIncorrect === next.isFeedbackIncorrect &&
      prev.pathD === next.pathD &&
      prev.country?.id === next.country?.id &&
      prev.onSelectCountry === next.onSelectCountry
    );
  }
);

CountryPolygon.displayName = 'CountryPolygon';

interface WaterBodyPolygonProps {
  waterBody: WaterBody;
  pathD: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
  isFeedbackCorrect: boolean;
  isFeedbackIncorrect: boolean;
  isSelectedOrTarget: boolean;
  onHover: (country?: Country) => void;
  onLeave: () => void;
  onSelectCountry?: (country: Country) => void;
}

// Memoized Water Body Polygon: renders interactive ocean basin, sea, or strait
const WaterBodyPolygon = React.memo<WaterBodyPolygonProps>(
  ({
    waterBody,
    pathD,
    fill,
    stroke,
    strokeWidth,
    isFeedbackCorrect,
    isFeedbackIncorrect,
    isSelectedOrTarget,
    onHover,
    onLeave,
    onSelectCountry,
  }) => {
    const country = useMemo(() => waterBodyToCountry(waterBody), [waterBody]);

    const onSelectRef = useRef(onSelectCountry);
    onSelectRef.current = onSelectCountry;

    const onHoverRef = useRef(onHover);
    onHoverRef.current = onHover;

    const onLeaveRef = useRef(onLeave);
    onLeaveRef.current = onLeave;

    const handleMouseEnter = useCallback(() => {
      onHoverRef.current?.(country);
    }, [country]);

    const handleMouseLeave = useCallback(() => {
      onLeaveRef.current?.();
    }, []);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectRef.current?.(country);
      },
      [country]
    );

    return (
      <path
        d={pathD}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect={stroke !== 'none' ? 'non-scaling-stroke' : undefined}
        className={`water-body-vector-path cursor-pointer ${
          isFeedbackCorrect
            ? 'water-body-correct'
            : isFeedbackIncorrect
            ? 'water-body-incorrect'
            : isSelectedOrTarget
            ? 'water-body-selected'
            : ''
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    );
  },
  (prev, next) => {
    return (
      prev.fill === next.fill &&
      prev.stroke === next.stroke &&
      prev.strokeWidth === next.strokeWidth &&
      prev.isFeedbackCorrect === next.isFeedbackCorrect &&
      prev.isFeedbackIncorrect === next.isFeedbackIncorrect &&
      prev.isSelectedOrTarget === next.isSelectedOrTarget &&
      prev.pathD === next.pathD &&
      prev.waterBody.id === next.waterBody.id &&
      prev.onSelectCountry === next.onSelectCountry
    );
  }
);

WaterBodyPolygon.displayName = 'WaterBodyPolygon';

export const VectorMap2D: React.FC<VectorMap2DProps> = ({
  selectedCountryId,
  targetCountryId,
  feedbackState,
  highlightedCountryIds = [],
  srsItemsMap,
  showHeatmap = false,
  disableAutoZoom = false,
  onSelectCountry,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const flagRef = useRef<HTMLSpanElement | null>(null);
  const nameRef = useRef<HTMLDivElement | null>(null);
  const capRef = useRef<HTMLDivElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

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

  // Window resize observer
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Setup D3 Projection & Path generator
  const { projection, pathGenerator } = useMemo(() => {
    const proj = d3
      .geoNaturalEarth1()
      .scale(dimensions.width / 5.8)
      .translate([dimensions.width / 2, dimensions.height / 2 + 10]);

    const path = d3.geoPath().projection(proj).digits(1);
    return { projection: proj, pathGenerator: path };
  }, [dimensions]);

  // Precompute SVG paths once when geometry or projection changes (ZERO recalculation on clicks/hovers)
  const countryFeatures = useMemo<CountryFeatureItem[]>(() => {
    if (!pathGenerator || !geoFeatures.length) return [];
    const items: CountryFeatureItem[] = [];
    for (let i = 0; i < geoFeatures.length; i++) {
      const feat = geoFeatures[i];
      const pathD = pathGenerator(feat);
      if (pathD) {
        items.push({
          id: feat.id || i,
          country: COUNTRIES_BY_NUMERIC.get(String(feat.id)),
          pathD,
        });
      }
    }
    return items;
  }, [geoFeatures, pathGenerator]);

  const isZoomingRef = useRef(false);
  const zoomEndTimerRef = useRef<number | null>(null);
  const rafZoomIdRef = useRef<number | null>(null);
  const lastBeaconKRef = useRef<number | null>(null);
  const beaconCirclesRef = useRef<{ el: SVGCircleElement; baseR: number }[]>([]);

  // Index beacon circle elements after renders so zoom loops never perform querySelectorAll
  useEffect(() => {
    if (!gRef.current) return;
    const items: { el: SVGCircleElement; baseR: number }[] = [];
    gRef.current.querySelectorAll<SVGCircleElement>('.microstate-dot').forEach((el) => {
      items.push({ el, baseR: 3.5 });
    });
    gRef.current.querySelectorAll<SVGCircleElement>('.microstate-pulse').forEach((el) => {
      items.push({ el, baseR: 8 });
    });
    gRef.current.querySelectorAll<SVGCircleElement>('.microstate-hitbox').forEach((el) => {
      items.push({ el, baseR: 16 });
    });
    gRef.current.querySelectorAll<SVGCircleElement>('.water-beacon-dot').forEach((el) => {
      const isOcean = el.getAttribute('data-ocean') === 'true';
      const isStrait = el.getAttribute('data-strait') === 'true';
      items.push({ el, baseR: isStrait ? 4 : isOcean ? 6 : 5 });
    });
    gRef.current.querySelectorAll<SVGCircleElement>('.water-beacon-pulse').forEach((el) => {
      const isOcean = el.getAttribute('data-ocean') === 'true';
      items.push({ el, baseR: isOcean ? 16 : 12 });
    });
    gRef.current.querySelectorAll<SVGCircleElement>('.water-beacon-hitbox').forEach((el) => {
      const isOcean = el.getAttribute('data-ocean') === 'true';
      items.push({ el, baseR: isOcean ? 32 : 24 });
    });
    beaconCirclesRef.current = items;
  });

  // Setup Zoom behavior with GPU-accelerated transforms & smooth RAF batching
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 24])
      .wheelDelta((event) => {
        return -event.deltaY * (event.deltaMode === 1 ? 0.03 : event.deltaMode ? 0.5 : 0.0015);
      })
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        if (!gRef.current) return;

        // Toggle .is-zooming class during active gestures to suppress hit-test & hover thrashing
        if (!isZoomingRef.current) {
          isZoomingRef.current = true;
          svgRef.current?.classList.add('is-zooming');
        }
        if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current);
        zoomEndTimerRef.current = window.setTimeout(() => {
          isZoomingRef.current = false;
          svgRef.current?.classList.remove('is-zooming');
        }, 120);

        // Batch beacon radii resizing inside requestAnimationFrame (at most once per frame, zero querySelectorAll)
        // Transform and beacon radii are applied together once per frame, however many wheel events fired
        if (!rafZoomIdRef.current) {
          rafZoomIdRef.current = requestAnimationFrame(() => {
            rafZoomIdRef.current = null;
            const t = zoomTransformRef.current;
            gRef.current?.setAttribute('transform', t.toString());
            if (t.k === lastBeaconKRef.current) return;
            lastBeaconKRef.current = t.k;
            const beacons = beaconCirclesRef.current;
            for (let i = 0; i < beacons.length; i++) {
              beacons[i].el.setAttribute('r', (beacons[i].baseR / t.k).toFixed(2));
            }
          });
        }
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svgRef.current).call(zoom);

    return () => {
      if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current);
      if (rafZoomIdRef.current) cancelAnimationFrame(rafZoomIdRef.current);
    };
  }, []);

  // Programmatic camera focus (Smooth, cinematic auto-zoom when revealing answers / selecting locations)
  useEffect(() => {
    if (disableAutoZoom) return;

    const countryToFocus = selectedCountryId || targetCountryId;
    if (!countryToFocus || !svgRef.current || !zoomBehaviorRef.current) return;

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

    // Suppress pointer events & hover trashing during camera fly-over so passing paths don't trigger filters
    svgRef.current.classList.add('is-zooming');

    d3.select(svgRef.current)
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .call(zoomBehaviorRef.current.transform, transform)
      .on('end', () => {
        svgRef.current?.classList.remove('is-zooming');
      })
      .on('interrupt', () => {
        svgRef.current?.classList.remove('is-zooming');
      });
  }, [selectedCountryId, targetCountryId, disableAutoZoom, projection, dimensions]);

  // High-performance direct DOM tooltip tracking (Zero React re-renders during mouse movements)
  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    if (tooltipRef.current) {
      tooltipRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY - 12}px, 0)`;
    }
  }, []);

  const handleCountryHover = useCallback((country?: Country) => {
    if (!country || !tooltipRef.current) return;
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
  }, []);

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

  // Calculate country fill color (Elevated base fill #334155 for crisp contrast against #090e1a ocean)
  const getCountryFill = useCallback(
    (country?: Country) => {
      if (!country) return '#334155';

      // Quiz feedback states:
      if (feedbackState === 'correct') {
        if (country.id === targetCountryId || country.id === selectedCountryId) {
          return '#10b981'; // Emerald
        }
      }
      if (feedbackState === 'incorrect') {
        if (country.id === targetCountryId) {
          return '#10b981'; // Always show correct answer target in Emerald!
        }
        if (country.id === selectedCountryId) {
          return '#f43f5e'; // Rose for user's incorrect pick
        }
      }

      // Selected state
      if (country.id === selectedCountryId) {
        return '#0284c7'; // Vivid Cyan/Sky
      }

      // Highlighted list
      if (highlightedCountryIds.includes(country.id)) {
        return '#38bdf8';
      }

      // Heatmap mode
      if (showHeatmap && srsItemsMap) {
        const capItem = srsItemsMap.get(`${country.id}:capital`);
        const locItem = srsItemsMap.get(`${country.id}:location`);
        const score = (capItem?.stage || 0) + (locItem?.stage || 0); // 0 to 4
        if (score >= 3) return '#059669'; // Emerald Mastered
        if (score === 2) return '#10b981';
        if (score === 1) return '#d97706'; // Amber Learning
        return '#334155'; // Slate 700 New
      }

      return '#334155'; // Slate 700 high-contrast continental base
    },
    [feedbackState, targetCountryId, selectedCountryId, highlightedCountryIds, showHeatmap, srsItemsMap]
  );

  // Compute projected microstate anchor points (includes Tuvalu, Vatican, Nauru, etc.)
  const microstateItems = useMemo(() => {
    const list = getMicrostateList();
    return list
      .map((country) => {
        const coords = projection(country.coordinates);
        return {
          country,
          cx: coords ? coords[0] : 0,
          cy: coords ? coords[1] : 0,
          hasValidCoords: Boolean(coords && !isNaN(coords[0]) && !isNaN(coords[1]))
        };
      })
      .filter((item) => item.hasValidCoords);
  }, [projection]);

  // Precompute projected coordinates for all 40 hydrographic bodies (straits, seas, oceans)
  const waterBodyItems = useMemo(() => {
    return WATER_BODIES.map((wb) => {
      const coords = projection(wb.coordinates);
      return {
        wb,
        country: waterBodyToCountry(wb),
        cx: coords ? coords[0] : 0,
        cy: coords ? coords[1] : 0,
        hasValidCoords: Boolean(coords && !isNaN(coords[0]) && !isNaN(coords[1]))
      };
    }).filter((item) => item.hasValidCoords);
  }, [projection]);

  // Precompute boundary-accurate water body SVG paths once when projection changes
  const { oceanFeatures, seaFeatures, straitFeatures } = useMemo(() => {
    if (!pathGenerator || !waterGeoFeatures.length) {
      return { oceanFeatures: [], seaFeatures: [], straitFeatures: [] };
    }

    const oceans: { wb: WaterBody; pathD: string }[] = [];
    const seas: { wb: WaterBody; pathD: string }[] = [];
    const straits: { wb: WaterBody; pathD: string }[] = [];

    for (const feat of waterGeoFeatures) {
      const wb = getWaterBodyById(feat.id);
      if (!wb) continue;
      const pathD = pathGenerator(feat);
      if (!pathD) continue;

      const item = { wb, pathD };
      if (wb.type === 'ocean') {
        oceans.push(item);
      } else if (wb.type === 'strait' || wb.type === 'channel') {
        straits.push(item);
      } else {
        seas.push(item);
      }
    }

    return { oceanFeatures: oceans, seaFeatures: seas, straitFeatures: straits };
  }, [pathGenerator, waterGeoFeatures]);

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

      if (highlightedCountryIds.includes(wb.id)) {
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
    [selectedCountryId, targetCountryId, feedbackState, highlightedCountryIds, showHeatmap, srsItemsMap]
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

  // Open-ocean proximity click assist (snaps to nearest microstate or water body)
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement;
      const isDirectTarget =
        target.classList?.contains('country-vector-path') ||
        target.classList?.contains('water-body-vector-path') ||
        target.classList?.contains('microstate-hitbox') ||
        target.classList?.contains('microstate-dot') ||
        target.classList?.contains('water-beacon-hitbox') ||
        target.classList?.contains('water-beacon-dot');
      if (isDirectTarget) return;

      const svg = svgRef.current;
      if (!svg || !gRef.current) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = gRef.current.getScreenCTM();
      if (!ctm) return;
      const transformedPt = pt.matrixTransform(ctm.inverse());

      const k = zoomTransformRef.current?.k || 1;

      // 1. Proximity check for microstates (within 28 screen px)
      let minScreenDist = Infinity;
      let nearestCountry: Country | null = null;

      for (const m of microstateItems) {
        const dx = (transformedPt.x - m.cx) * k;
        const dy = (transformedPt.y - m.cy) * k;
        const dist = Math.hypot(dx, dy);
        if (dist < minScreenDist) {
          minScreenDist = dist;
          nearestCountry = m.country;
        }
      }

      if (minScreenDist <= 28 && nearestCountry) {
        handleCountrySelect(nearestCountry);
        return;
      }

      // 2. Proximity check for water bodies (straits ~35px, seas ~65px, oceans ~120px)
      let minWaterDist = Infinity;
      let nearestWater: Country | null = null;
      const isWaterDrill = Boolean(targetCountryId?.startsWith('WATER_'));

      for (const w of waterBodyItems) {
        const dx = (transformedPt.x - w.cx) * k;
        const dy = (transformedPt.y - w.cy) * k;
        const dist = Math.hypot(dx, dy);

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
        // If drilling water bodies, snap to closest water body on map
        let closestWb: Country | null = null;
        let closestDist = Infinity;
        for (const w of waterBodyItems) {
          const dx = (transformedPt.x - w.cx) * k;
          const dy = (transformedPt.y - w.cy) * k;
          const dist = Math.hypot(dx, dy);
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
    [microstateItems, waterBodyItems, handleCountrySelect, targetCountryId]
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleContainerMouseMove}
      className={`relative w-full h-full overflow-hidden bg-[#090e1a] select-none ${className}`}
    >
      {/* Background soft ambient radial gradient */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(20,32,54,0.6)_0%,rgba(9,14,26,1)_100%)]" />

      {/* Main SVG Map */}
      <svg
        ref={svgRef}
        onClick={handleSvgClick}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <defs>
          <radialGradient id="sphere-ocean" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#142036" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#090e1a" stopOpacity="1" />
          </radialGradient>
        </defs>

        <g ref={gRef} className="vector-map-main-group">
          {/* Water Bodies Layer 1: Global Oceans (deepest water layer) */}
          <g className="oceans-layer">
            {oceanFeatures.map(({ wb, pathD }) => {
              const isSelected = wb.id === selectedCountryId;
              const isTarget = wb.id === targetCountryId;
              const isFeedbackCorrect =
                (feedbackState === 'correct' && Boolean(isSelected || isTarget)) ||
                (feedbackState === 'incorrect' && Boolean(isTarget));
              const isFeedbackIncorrect = feedbackState === 'incorrect' && Boolean(isSelected);

              return (
                <WaterBodyPolygon
                  key={wb.id}
                  waterBody={wb}
                  pathD={pathD}
                  fill={getWaterBodyFill(wb)}
                  stroke={getWaterBodyStroke(wb)}
                  strokeWidth="0.8"
                  isFeedbackCorrect={isFeedbackCorrect}
                  isFeedbackIncorrect={isFeedbackIncorrect}
                  isSelectedOrTarget={isSelected || isTarget}
                  onHover={handleCountryHover}
                  onLeave={handleCountryLeave}
                  onSelectCountry={handleCountrySelect}
                />
              );
            })}
          </g>

          {/* Water Bodies Layer 2: Marginal Seas, Gulfs, and Bays */}
          <g className="seas-layer">
            {seaFeatures.map(({ wb, pathD }) => {
              const isSelected = wb.id === selectedCountryId;
              const isTarget = wb.id === targetCountryId;
              const isFeedbackCorrect =
                (feedbackState === 'correct' && Boolean(isSelected || isTarget)) ||
                (feedbackState === 'incorrect' && Boolean(isTarget));
              const isFeedbackIncorrect = feedbackState === 'incorrect' && Boolean(isSelected);

              return (
                <WaterBodyPolygon
                  key={wb.id}
                  waterBody={wb}
                  pathD={pathD}
                  fill={getWaterBodyFill(wb)}
                  stroke={getWaterBodyStroke(wb)}
                  strokeWidth="0.8"
                  isFeedbackCorrect={isFeedbackCorrect}
                  isFeedbackIncorrect={isFeedbackIncorrect}
                  isSelectedOrTarget={isSelected || isTarget}
                  onHover={handleCountryHover}
                  onLeave={handleCountryLeave}
                  onSelectCountry={handleCountrySelect}
                />
              );
            })}
          </g>

          {/* Water Bodies Layer 3: Strategic Straits, Canals, and Channels */}
          <g className="straits-layer">
            {straitFeatures.map(({ wb, pathD }) => {
              const isSelected = wb.id === selectedCountryId;
              const isTarget = wb.id === targetCountryId;
              const isFeedbackCorrect =
                (feedbackState === 'correct' && Boolean(isSelected || isTarget)) ||
                (feedbackState === 'incorrect' && Boolean(isTarget));
              const isFeedbackIncorrect = feedbackState === 'incorrect' && Boolean(isSelected);

              return (
                <WaterBodyPolygon
                  key={wb.id}
                  waterBody={wb}
                  pathD={pathD}
                  fill={getWaterBodyFill(wb)}
                  stroke={getWaterBodyStroke(wb)}
                  strokeWidth="1"
                  isFeedbackCorrect={isFeedbackCorrect}
                  isFeedbackIncorrect={isFeedbackIncorrect}
                  isSelectedOrTarget={isSelected || isTarget}
                  onHover={handleCountryHover}
                  onLeave={handleCountryLeave}
                  onSelectCountry={handleCountrySelect}
                />
              );
            })}
          </g>

          {/* Countries vector polygons */}
          {countryFeatures.map((item) => {
            const country = item.country;
            const isSelected = country && country.id === selectedCountryId;
            const isTarget = country && country.id === targetCountryId;
            const isFeedbackCorrect = feedbackState === 'correct' && Boolean(isSelected || isTarget);
            const isFeedbackIncorrect = feedbackState === 'incorrect' && Boolean(isSelected);

            return (
              <CountryPolygon
                key={item.id}
                country={country}
                pathD={item.pathD}
                fill={getCountryFill(country)}
                stroke={isSelected || isTarget ? '#38bdf8' : '#64748b'}
                strokeWidth={isSelected || isTarget ? '1.5' : '0.8'}
                isFeedbackCorrect={isFeedbackCorrect}
                isFeedbackIncorrect={isFeedbackIncorrect}
                onCountryHover={handleCountryHover}
                onCountryLeave={handleCountryLeave}
                onSelectCountry={handleCountrySelect}
              />
            );
          })}

          {/* Microstates & Small Island Nations Beacons Layer */}
          <g className="microstate-beacons-layer">
            {microstateItems.map(({ country, cx, cy }) => {
              const isSelected = country.id === selectedCountryId;
              const isTarget = country.id === targetCountryId;
              const isFeedbackCorrect = feedbackState === 'correct' && Boolean(isSelected || isTarget);
              const isFeedbackIncorrect = feedbackState === 'incorrect' && Boolean(isSelected);
              const k = zoomTransformRef.current?.k || 1;
              const dotRadius = 3.5 / k;
              const hitRadius = 16 / k;
              const pulseRadius = 8 / k;

              const fill = getCountryFill(country);
              const stroke = isSelected || isTarget ? '#ffffff' : '#38bdf8';

              return (
                <g key={`beacon-${country.id}`} className="microstate-beacon-group">
                  {/* Pulsing ring when active or in feedback */}
                  {(isSelected || isTarget) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={pulseRadius}
                      className="microstate-pulse animate-ping opacity-75"
                      fill="none"
                      stroke={isFeedbackCorrect ? '#10b981' : isFeedbackIncorrect ? '#f43f5e' : '#38bdf8'}
                      strokeWidth="1.2"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {/* Core beacon dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={dotRadius}
                    className="microstate-dot transition-colors duration-150 cursor-pointer"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Generous invisible clickable hit-target (32px diameter on screen) */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hitRadius}
                    className="microstate-hitbox cursor-pointer"
                    fill="transparent"
                    pointerEvents="all"
                    onMouseEnter={() => handleCountryHover(country)}
                    onMouseLeave={handleCountryLeave}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCountrySelect(country);
                    }}
                  />
                </g>
              );
            })}
          </g>

          {/* Maritime Bodies & Straits Beacons Layer */}
          <g className="maritime-beacons-layer">
            {waterBodyItems.map(({ wb, country, cx, cy }) => {
              const isSelected = country.id === selectedCountryId;
              const isTarget = country.id === targetCountryId;
              const isStrait = wb.type === 'strait' || wb.type === 'channel';
              const isFeedbackCorrect = feedbackState === 'correct' && Boolean(isSelected || isTarget);
              const isFeedbackIncorrect = feedbackState === 'incorrect' && Boolean(isSelected);
              const k = zoomTransformRef.current?.k || 1;
              const isOcean = wb.type === 'ocean';

              const dotRadius = (isStrait ? 4 : isOcean ? 6 : 5) / k;
              const hitRadius = (isStrait ? 20 : isOcean ? 32 : 24) / k;
              const pulseRadius = (isStrait ? 10 : isOcean ? 16 : 12) / k;

              let fill = isStrait ? '#06b6d4' : isOcean ? '#38bdf8' : '#0ea5e9';
              let stroke = isSelected || isTarget ? '#ffffff' : '#e0f2fe';

              if (feedbackState === 'correct' && (isSelected || isTarget)) {
                fill = '#10b981';
                stroke = '#ffffff';
              } else if (feedbackState === 'incorrect' && isSelected) {
                fill = '#f43f5e';
                stroke = '#ffffff';
              } else if (feedbackState === 'incorrect' && isTarget) {
                fill = '#10b981';
                stroke = '#ffffff';
              }

              return (
                <g key={`water-beacon-${wb.id}`} className="water-beacon-group">
                  {/* Pulsing ring when active or in feedback */}
                  {(isSelected || isTarget) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={pulseRadius}
                      data-ocean={isOcean ? 'true' : 'false'}
                      className="water-beacon-pulse animate-ping opacity-75"
                      fill="none"
                      stroke={isFeedbackCorrect ? '#10b981' : isFeedbackIncorrect ? '#f43f5e' : '#38bdf8'}
                      strokeWidth="1.4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {/* Core beacon dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={dotRadius}
                    data-ocean={isOcean ? 'true' : 'false'}
                    data-strait={isStrait ? 'true' : 'false'}
                    className="water-beacon-dot transition-colors duration-150 cursor-pointer"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Name label shown when active or at zoom */}
                  {(isSelected || isTarget || (isStrait && k >= 3.5)) && (
                    <text
                      x={cx}
                      y={cy - (dotRadius + 4 / k)}
                      textAnchor="middle"
                      fill="#ffffff"
                      stroke="#090e1a"
                      strokeWidth={1.5 / k}
                      paintOrder="stroke fill"
                      fontSize={Math.max(8, 11 / k)}
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                    >
                      {wb.name}
                    </text>
                  )}

                  {/* Generous invisible clickable hit-target */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hitRadius}
                    data-ocean={isOcean ? 'true' : 'false'}
                    className="water-beacon-hitbox cursor-pointer"
                    fill="transparent"
                    pointerEvents="all"
                    onMouseEnter={() => handleCountryHover(country)}
                    onMouseLeave={handleCountryLeave}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCountrySelect(country);
                    }}
                  />
                </g>
              );
            })}
          </g>
        </g>
      </svg>

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
