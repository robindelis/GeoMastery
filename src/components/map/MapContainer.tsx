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
  hideHoverTooltip?: boolean;
  onToggleHeatmap?: () => void;
  autoRotate?: boolean;
  onToggleAutoRotate?: () => void;
  onSelectCountry?: (country: Country) => void;
  className?: string;
  controlsClassName?: string;
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
  hideHoverTooltip = false,
  onToggleHeatmap,
  autoRotate = false,
  onToggleAutoRotate,
  onSelectCountry,
  className = '',
  controlsClassName = 'right-4'
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
            hideHoverTooltip={hideHoverTooltip}
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
            hideHoverTooltip={hideHoverTooltip}
            onSelectCountry={onSelectCountry}
          />
        )}

        {/* Floating Cartographic Controls Bar */}
        <div className={`absolute top-4 z-40 flex items-center gap-2 bg-[#162938]/92 backdrop-blur-md border border-[#e9c46a]/30 p-1.5 rounded-2xl shadow-2xl transition-all duration-300 ${controlsClassName}`}>
          {/* 2D / 3D Switcher */}
          <div className="flex items-center bg-[#0f1e2a] p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => onToggleMapMode('2d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mapMode === '2d'
                  ? 'bg-[#f6efe2] text-[#162938] shadow-md'
                  : 'text-[#d8cfc0] hover:text-white'
              }`}
              title="Switch to 2D Flat Vector Map"
            >
              <Map className="w-3.5 h-3.5" />
              <span>2D Map</span>
            </button>
            <button
              onClick={() => onToggleMapMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mapMode === '3d'
                  ? 'bg-[#f6efe2] text-[#162938] shadow-md'
                  : 'text-[#d8cfc0] hover:text-white'
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
              className={`p-1.5 rounded-xl border text-xs transition-all ${
                autoRotate
                  ? 'bg-[#e9c46a]/20 border-[#e9c46a]/50 text-[#e9c46a]'
                  : 'bg-[#0f1e2a] border-white/10 text-[#d8cfc0] hover:text-white'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                showHeatmap
                  ? 'bg-[#e9c46a] border-[#e9c46a] text-[#162938]'
                  : 'bg-[#0f1e2a] border-white/10 text-[#d8cfc0] hover:text-white'
              }`}
              title="Toggle Spaced Repetition Mastery Heatmap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mastery Tint</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
