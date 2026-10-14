import React, { useState, useEffect, useMemo } from 'react';
import { Search, Compass, MapPin, Building2, Scale, UserCheck, Utensils, Coins, Sparkles, X } from 'lucide-react';
import { Country, Continent, MapViewMode, SRSItem } from '../../core/types';
import { COUNTRIES, COUNTRIES_BY_ID } from '../../assets/data/countries';
import { MapContainer } from '../map/MapContainer';
import { StorageService } from '../../core/storage';
import { soundFx } from '../../core/soundFx';
import { formatCoordinates } from '../../core/geoUtils';

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
  const [srsItemsMap, setSrsItemsMap] = useState<Map<string, SRSItem>>(() => StorageService.loadSRSItems());
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  useEffect(() => {
    return StorageService.subscribe(() => {
      setSrsItemsMap(StorageService.loadSRSItems());
    });
  }, []);

  // Filter countries for search dropdown based on search query and selected continent
  const filteredCountries = useMemo(() => {
    let pool = COUNTRIES;
    if (selectedContinent !== 'All') {
      pool = pool.filter((c) => c.continent === selectedContinent);
    }
    if (!searchQuery.trim()) {
      return selectedContinent !== 'All' ? pool.slice(0, 8) : [];
    }
    const q = searchQuery.toLowerCase();
    return pool.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.capital.toLowerCase().includes(q) ||
        c.officialName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, selectedContinent]);

  const highlightedCountryIds = useMemo(() => {
    if (selectedContinent === 'All') return [];
    return COUNTRIES.filter((c) => c.continent === selectedContinent).map((c) => c.id);
  }, [selectedContinent]);

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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0F2536]">
      {/* Top Search & Filter Bar */}
      <div className="py-2.5 sm:py-0 sm:h-16 border-b border-[#F6EFE2]/12 bg-[#122C40]/95 backdrop-blur-md px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between z-30 gap-2.5 sm:gap-4 shrink-0">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-[#D6CBB9] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any country or capital city..."
            className="w-full pl-10 pr-4 py-2 rounded-full bg-[#0C1F2E] border border-[#F6EFE2]/20 text-sm text-[#F6EFE2] placeholder-[#8FA6B8] focus:outline-none focus:border-[#E9C46A]"
          />

          {/* Autocomplete Dropdown */}
          {filteredCountries.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#F6EFE2] border-2 border-[#142534] rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-[#D8CBB5]">
              {filteredCountries.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCountry(c)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#ECE2CE] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{c.flagEmoji}</span>
                    <div>
                      <div className="text-sm font-extrabold text-[#142534]">{c.name}</div>
                      <div className="text-xs font-semibold text-[#C84228]">Capital: {c.capital}</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-extrabold text-[#142534] bg-[#D8CBB5] px-2.5 py-0.5 rounded-full">
                    {c.continent}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Continent Pills (Horizontally scrollable on mobile) */}
        <div className="flex overflow-x-auto no-scrollbar items-center gap-1.5 bg-[#0C1F2E] p-1 rounded-full border border-[#F6EFE2]/15 w-full sm:w-auto">
          {(['All', 'Europe', 'Asia', 'Africa', 'Americas', 'Oceania'] as const).map((cont) => (
            <button
              key={cont}
              onClick={() => setSelectedContinent(cont)}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                selectedContinent === cont
                  ? 'bg-[#F6EFE2] text-[#142534] shadow-sm'
                  : 'text-[#D6CBB9] hover:text-white'
              }`}
            >
              {cont}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace (Map + Slide-over / Bottom-sheet Country Dossier Drawer) */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex">
        {/* Map View */}
        <div className="flex-1 h-full">
          <MapContainer
            mapMode={mapMode}
            onToggleMapMode={onToggleMapMode}
            selectedCountryId={selectedCountry?.id}
            highlightedCountryIds={highlightedCountryIds}
            srsItemsMap={srsItemsMap}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap((h) => !h)}
            autoRotate={autoRotate}
            onToggleAutoRotate={() => setAutoRotate((r) => !r)}
            onSelectCountry={handleSelectCountry}
            controlsClassName={selectedCountry ? 'right-4 sm:right-[25.5rem]' : 'right-4'}
          />
        </div>

        {/* Slide-Over (Tablet/Desktop) & Bottom-Sheet (Mobile) Country Dossier */}
        {selectedCountry && (
          <div className="absolute inset-x-0 bottom-0 top-auto w-full max-h-[55dvh] rounded-t-3xl border-t-2 sm:rounded-none sm:border-t-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-96 sm:max-h-none bg-[#F6EFE2] text-[#142534] sm:border-l-2 border-[#D8CBB5] z-40 p-5 flex flex-col justify-between shadow-2xl overflow-hidden">
            <div className="flex flex-col gap-3">
              {/* Header with Close */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selectedCountry.flagEmoji}</span>
                  <div>
                    <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-black text-[#142534] tracking-tight leading-tight">
                      {selectedCountry.name}
                    </h2>
                    <p className="text-xs font-semibold text-[#495E70] line-clamp-1">{selectedCountry.officialName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCountry(null)}
                  className="p-1.5 rounded-full text-[#495E70] hover:text-[#142534] hover:bg-[#ECE2CE] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-[#ECE2CE] border border-[#D8CBB5] text-[#142534] font-bold">
                  {selectedCountry.continent} • {selectedCountry.subregion}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#142534] text-[#F6EFE2] font-mono font-bold">
                  ISO: {selectedCountry.id}
                </span>
              </div>

              {/* Facts Grid */}
              <div className="flex flex-col gap-2">
                {/* Capital City */}
                <div className="bg-[#ECE2CE] border border-[#D8CBB5] p-3 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-[#D94E34]" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#5B7083] font-extrabold">Capital City</div>
                      <div className="font-[family-name:var(--font-fraunces)] text-base font-black text-[#142534]">{selectedCountry.capital}</div>
                    </div>
                  </div>
                  {getMasteryBadge('capital')}
                </div>

                {/* Map Location */}
                <div className="bg-[#ECE2CE] border border-[#D8CBB5] p-3 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-[#2A9D8F]" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#5B7083] font-extrabold">Geographic Center</div>
                      <div className="text-xs font-mono font-bold text-[#142534]">
                        {formatCoordinates(selectedCountry.coordinates)}
                      </div>
                    </div>
                  </div>
                  {getMasteryBadge('location')}
                </div>

                {/* Future Extensible Attributes (Starter Data) */}
                {selectedCountry.facts.politicalRegime && (
                  <div className="bg-[#ECE2CE]/70 border border-[#D8CBB5] p-2.5 rounded-2xl flex items-center gap-2.5">
                    <Scale className="w-4 h-4 text-[#D48C1C]" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#5B7083] font-extrabold">Political Regime</div>
                      <div className="text-xs font-extrabold text-[#142534]">
                        {selectedCountry.facts.politicalRegime}
                      </div>
                    </div>
                  </div>
                )}

                {(selectedCountry.facts.headOfState || selectedCountry.facts.leader) && (
                  <div className="bg-[#ECE2CE]/70 border border-[#D8CBB5] p-2.5 rounded-2xl flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-[#2A9D8F] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-[#5B7083] font-extrabold">Head of State</div>
                      <div className="text-xs font-extrabold text-[#142534] truncate">
                        {selectedCountry.facts.headOfState || selectedCountry.facts.leader}
                      </div>
                      {selectedCountry.facts.headOfGovernment && selectedCountry.facts.headOfGovernment !== (selectedCountry.facts.headOfState || selectedCountry.facts.leader) && (
                        <div className="text-[10px] font-semibold text-[#5B7083] truncate mt-0.5">
                          Head of Govt: {selectedCountry.facts.headOfGovernment}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedCountry.facts.cuisine && (
                  <div className="bg-[#ECE2CE]/70 border border-[#D8CBB5] p-2.5 rounded-2xl flex items-center gap-2.5">
                    <Utensils className="w-4 h-4 text-[#D94E34]" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#5B7083] font-extrabold">National Dish</div>
                      <div className="text-xs font-extrabold text-[#142534]">
                        {selectedCountry.facts.cuisine}
                      </div>
                    </div>
                  </div>
                )}

                {selectedCountry.facts.currency && (
                  <div className="bg-[#ECE2CE]/70 border border-[#D8CBB5] p-2.5 rounded-2xl flex items-center gap-2.5">
                    <Coins className="w-4 h-4 text-[#1E6B7B]" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#5B7083] font-extrabold">Currency</div>
                      <div className="text-xs font-extrabold text-[#142534]">
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
                className="w-full mt-3 py-3 rounded-2xl bg-[#D94E34] hover:bg-[#C54128] text-[#FFF8E7] font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
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
