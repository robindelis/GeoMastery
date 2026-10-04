import React from 'react';
import { Globe, Map, Sparkles, Layers, RotateCw } from 'lucide-react';
import { VectorMap2D } from './VectorMap2D';
import { Globe3D } from './Globe3D';
import { Country, MapViewMode, SRSItem } from '../../core/types';

interface MapContainerProps {
  mapMode: MapViewMode;
  onToggleMapMode: (mode: MapViewMode) => void;
  selectedCountryId?: string | null;
  targetCountryId?: string | null;
  feedbackState?: 'correct' | 'incorrect' | 'neutral' | null;
  highlightedCountryIds?: string[];
  srsItemsMap?: Map<string, SRSItem>;
  showHeatmap?: boolean;
  disableAutoZoom?: boolean;
  onToggleHeatmap?: () => void;
  autoRotate?: boolean;
  onToggleAutoRotate?: () => void;
  onSelectCountry?: (country: Country) => void;
  className?: string;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  mapMode,
  onToggleMapMode,
  selectedCountryId,
  targetCountryId,
  feedbackState,
  highlightedCountryIds,
  srsItemsMap,
  showHeatmap = false,
  disableAutoZoom = false,
  onToggleHeatmap,
  autoRotate = false,
  onToggleAutoRotate,
  onSelectCountry,
  className = ''
}) => {
  return (
    <div className={`relative w-full h-full overflow-hidden flex flex-col ${className}`}>
      {/* Map Content (2D or 3D) */}
      <div className="relative flex-1 w-full h-full">
        {mapMode === '2d' ? (
          <VectorMap2D
            selectedCountryId={selectedCountryId}
            targetCountryId={targetCountryId}
            feedbackState={feedbackState}
            highlightedCountryIds={highlightedCountryIds}
            srsItemsMap={srsItemsMap}
            showHeatmap={showHeatmap}
            disableAutoZoom={disableAutoZoom}
            onSelectCountry={onSelectCountry}
          />
        ) : (
          <Globe3D
            selectedCountryId={selectedCountryId}
            targetCountryId={targetCountryId}
            feedbackState={feedbackState}
            highlightedCountryIds={highlightedCountryIds}
            srsItemsMap={srsItemsMap}
            showHeatmap={showHeatmap}
            autoRotate={autoRotate}
            disableAutoSpin={disableAutoZoom}
            onSelectCountry={onSelectCountry}
          />
        )}

        {/* Floating Cartographic Controls Bar */}
        <div className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-1.5 rounded-xl shadow-xl">
          {/* 2D / 3D Switcher */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/50">
            <button
              onClick={() => onToggleMapMode('2d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mapMode === '2d'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch to 2D Flat Vector Map"
            >
              <Map className="w-3.5 h-3.5" />
              <span>2D Map</span>
            </button>
            <button
              onClick={() => onToggleMapMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mapMode === '3d'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch to 3D Rotating Globe"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D Globe</span>
            </button>
          </div>

          {/* Auto-rotate button for 3D Globe */}
          {mapMode === '3d' && onToggleAutoRotate && (
            <button
              onClick={onToggleAutoRotate}
              className={`p-1.5 rounded-lg border text-xs transition-all ${
                autoRotate
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                  : 'bg-slate-800/70 border-slate-700/50 text-slate-400 hover:text-white'
              }`}
              title="Toggle Globe Auto-Rotation"
            >
              <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Heatmap Mastery Overlay Toggle */}
          {onToggleHeatmap && (
            <button
              onClick={onToggleHeatmap}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                showHeatmap
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-slate-800/70 border-slate-700/50 text-slate-400 hover:text-white'
              }`}
              title="Toggle Spaced Repetition Mastery Heatmap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Heatmap</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
