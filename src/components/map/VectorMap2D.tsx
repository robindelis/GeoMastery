import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import worldData50m from '../../assets/geo/countries-50m.json';
import { Country, SRSItem } from '../../core/types';
import { COUNTRIES_BY_ID, COUNTRIES_BY_NUMERIC } from '../../assets/data/countries';
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
        className={`country-vector-path transition-colors duration-100 cursor-pointer hover:brightness-125 ${
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

    const path = d3.geoPath().projection(proj);
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

  // Setup Zoom behavior with GPU-accelerated transforms
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 24])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        if (gRef.current) {
          d3.select(gRef.current).attr('transform', event.transform);
          const k = event.transform.k;
          d3.select(gRef.current).selectAll('.microstate-dot').attr('r', 3.5 / k);
          d3.select(gRef.current).selectAll('.microstate-pulse').attr('r', 8 / k);
          d3.select(gRef.current).selectAll('.microstate-hitbox').attr('r', 16 / k);
        }
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svgRef.current).call(zoom);
  }, []);

  // Programmatic camera focus (Only when auto-zoom is NOT disabled)
  useEffect(() => {
    if (disableAutoZoom) return;

    const countryToFocus = selectedCountryId || targetCountryId;
    if (!countryToFocus || !svgRef.current || !zoomBehaviorRef.current) return;

    const c = COUNTRIES_BY_ID.get(countryToFocus);
    if (!c || !c.coordinates) return;

    const coords = projection(c.coordinates);
    if (!coords) return;

    const [cx, cy] = coords;
    const targetScale = 3.5;
    const transform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(targetScale)
      .translate(-cx, -cy);

    d3.select(svgRef.current)
      .transition()
      .duration(700)
      .call(zoomBehaviorRef.current.transform, transform);
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
    if (nameRef.current) nameRef.current.textContent = country.name;
    if (capRef.current) capRef.current.textContent = `Capital: ${country.capital}`;
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

  // Calculate country fill color
  const getCountryFill = useCallback(
    (country?: Country) => {
      if (!country) return '#1e293b';

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

      return '#1e293b'; // Slate 800 continental base
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

  // Open-ocean proximity click assist (snaps to nearest island / microstate within 28 screen px)
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement;
      const isDirectTarget =
        target.classList?.contains('country-vector-path') ||
        target.classList?.contains('microstate-hitbox') ||
        target.classList?.contains('microstate-dot');
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

      // Proximity threshold: within 28 screen pixels of an island/microstate in open waters
      if (minScreenDist <= 28 && nearestCountry) {
        handleCountrySelect(nearestCountry);
      }
    },
    [microstateItems, handleCountrySelect]
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleContainerMouseMove}
      className={`relative w-full h-full overflow-hidden bg-[#0f172a] select-none ${className}`}
    >
      {/* Background soft ambient radial gradient */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(30,41,59,0.5)_0%,rgba(15,23,42,1)_100%)]" />

      {/* Main SVG Map */}
      <svg
        ref={svgRef}
        onClick={handleSvgClick}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <defs>
          <radialGradient id="sphere-ocean" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#1e293b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
          </radialGradient>
        </defs>

        <g ref={gRef}>
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
                stroke={isSelected || isTarget ? '#38bdf8' : '#475569'}
                strokeWidth={isSelected || isTarget ? '1.4' : '0.6'}
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
