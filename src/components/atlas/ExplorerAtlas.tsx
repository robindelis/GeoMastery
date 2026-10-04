import React, { useState, useMemo } from 'react';
import { Search, Compass, MapPin, Building2, Scale, UserCheck, Utensils, Coins, Sparkles, X } from 'lucide-react';
import { Country, Continent, MapViewMode, SRSItem } from '../../core/types';
import { COUNTRIES, COUNTRIES_BY_ID } from '../../assets/data/countries';
import { MapContainer } from '../map/MapContainer';
import { StorageService } from '../../core/storage';
import { soundFx } from '../../core/soundFx';

interface ExplorerAtlasProps {
  mapMode: MapViewMode;
  onToggleMapMode: (mode: MapViewMode) => void;
  onStartSpecificDrill?: (country: Country) => void;
}

export const ExplorerAtlas: React.FC<ExplorerAtlasProps> = ({
  mapMode,
  onToggleMapMode,
  onStartSpecificDrill
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContinent, setSelectedContinent] = useState<'All' | Continent>('All');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(() => COUNTRIES_BY_ID.get('FRA') || COUNTRIES[0]);
  const [srsItemsMap] = useState<Map<string, SRSItem>>(() => StorageService.loadSRSItems());
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  // Filter countries for search dropdown
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.capital.toLowerCase().includes(q) ||
        c.officialName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery]);

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setSearchQuery('');
    soundFx.playMapPing();
  };

  const getMasteryBadge = (attributeId: string) => {
    if (!selectedCountry) return null;
    const item = srsItemsMap.get(`${selectedCountry.id}:${attributeId}`);
    if (!item || item.stage === 0) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          Unlearned (L0)
        </span>
      );
    }
    if (item.stage === 1) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/60">
          Learning (L1)
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
        Mastered (L2)
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0f172a]">
      {/* Top Search & Filter Bar */}
      <div className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between z-30 gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any country or capital city..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
          />

          {/* Autocomplete Dropdown */}
          {filteredCountries.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-slate-800">
              {filteredCountries.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCountry(c)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{c.flagEmoji}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">{c.name}</div>
                      <div className="text-xs text-slate-400">Capital: {c.capital}</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    {c.continent}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Continent Pills */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {(['All', 'Europe', 'Asia', 'Africa', 'Americas', 'Oceania'] as const).map((cont) => (
            <button
              key={cont}
              onClick={() => setSelectedContinent(cont)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedContinent === cont
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cont}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace (Map + Slide-over Country Dossier Drawer) */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex">
        {/* Map View */}
        <div className="flex-1 h-full">
          <MapContainer
            mapMode={mapMode}
            onToggleMapMode={onToggleMapMode}
            selectedCountryId={selectedCountry?.id}
            srsItemsMap={srsItemsMap}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap((h) => !h)}
            autoRotate={autoRotate}
            onToggleAutoRotate={() => setAutoRotate((r) => !r)}
            onSelectCountry={handleSelectCountry}
          />
        </div>

        {/* Slide-Over Country Dossier */}
        {selectedCountry && (
          <div className="absolute right-0 top-0 bottom-0 w-80 sm:w-96 bg-slate-900/95 border-l border-slate-800/80 backdrop-blur-xl z-40 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="flex flex-col gap-5">
              {/* Header with Close */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selectedCountry.flagEmoji}</span>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight leading-tight">
                      {selectedCountry.name}
                    </h2>
                    <p className="text-xs text-slate-400 line-clamp-1">{selectedCountry.officialName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCountry(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                  {selectedCountry.continent} • {selectedCountry.subregion}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                  ISO: {selectedCountry.id}
                </span>
              </div>

              {/* Facts Grid */}
              <div className="flex flex-col gap-2.5 mt-1">
                {/* Capital City */}
                <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Capital City</div>
                      <div className="text-sm font-bold text-white">{selectedCountry.capital}</div>
                    </div>
                  </div>
                  {getMasteryBadge('capital')}
                </div>

                {/* Map Location */}
                <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Geographic Center</div>
                      <div className="text-xs font-mono text-slate-300">
                        {selectedCountry.coordinates[1].toFixed(2)}° N, {selectedCountry.coordinates[0].toFixed(2)}° E
                      </div>
                    </div>
                  </div>
                  {getMasteryBadge('location')}
                </div>

                {/* Future Extensible Attributes (Starter Data) */}
                {selectedCountry.facts.politicalRegime && (
                  <div className="bg-slate-900/50 border border-slate-800/60 p-3 rounded-xl flex items-center gap-2.5">
                    <Scale className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Political Regime</div>
                      <div className="text-xs font-semibold text-slate-200">
                        {selectedCountry.facts.politicalRegime}
                      </div>
                    </div>
                  </div>
                )}

                {selectedCountry.facts.leader && (
                  <div className="bg-slate-900/50 border border-slate-800/60 p-3 rounded-xl flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Head of State / Leader</div>
                      <div className="text-xs font-semibold text-slate-200">
                        {selectedCountry.facts.leader}
                      </div>
                    </div>
                  </div>
                )}

                {selectedCountry.facts.cuisine && (
                  <div className="bg-slate-900/50 border border-slate-800/60 p-3 rounded-xl flex items-center gap-2.5">
                    <Utensils className="w-4 h-4 text-rose-400" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">National Dish</div>
                      <div className="text-xs font-semibold text-slate-200">
                        {selectedCountry.facts.cuisine}
                      </div>
                    </div>
                  </div>
                )}

                {selectedCountry.facts.currency && (
                  <div className="bg-slate-900/50 border border-slate-800/60 p-3 rounded-xl flex items-center gap-2.5">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Currency</div>
                      <div className="text-xs font-semibold text-slate-200">
                        {selectedCountry.facts.currency}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick drill button */}
            {onStartSpecificDrill && (
              <button
                onClick={() => onStartSpecificDrill(selectedCountry)}
                className="w-full mt-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                <span>Drill This Nation</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
