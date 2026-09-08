import React, { useEffect, useState, useId } from 'react';
import {
  MapPin,
  Compass,
  Search,
  Maximize2,
  CheckCircle2,
  Globe2,
  Building,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  getStates,
  getDistricts,
  getPoliceStations,
  type StateRecord,
  type DistrictRecord,
  type PoliceStationRecord,
} from '../../services/api';

export type InvestigationScope = 'city' | 'district' | 'state' | 'all';

export interface GeographicScopeBarProps {
  selectedState: string;
  onStateChange: (state: string) => void;
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  scope: InvestigationScope;
  onScopeChange: (scope: InvestigationScope) => void;
  onExpandScope: (targetScope: 'district' | 'state') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchGlobal: boolean;
  onToggleSearchGlobal: () => void;
  nodeCount: number;
  edgeCount: number;
  loading: boolean;
}

export const GeographicScopeBar: React.FC<GeographicScopeBarProps> = ({
  selectedState,
  onStateChange,
  selectedDistrict,
  onDistrictChange,
  selectedCity,
  onCityChange,
  scope,
  onScopeChange,
  onExpandScope,
  searchQuery,
  onSearchChange,
  searchGlobal,
  onToggleSearchGlobal,
  nodeCount,
  edgeCount,
  loading: _loading,
}) => {
  const stateSelectId = useId();
  const districtSelectId = useId();
  const citySelectId = useId();
  const scopeSelectId = useId();

  const [states, setStates] = useState<StateRecord[]>([]);
  const [districts, setDistricts] = useState<DistrictRecord[]>([]);
  const [cities, setCities] = useState<PoliceStationRecord[]>([]);

  // 1. Fetch available states on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stateList = await getStates();
        if (!active) return;
        setStates(stateList);
      } catch {
        // Fallback handled gracefully
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 2. Fetch districts when selectedState changes
  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      setCities([]);
      return;
    }
    const stateObj = states.find(
      (s) =>
        s.state_code.toLowerCase() === selectedState.toLowerCase() ||
        s.state_name.toLowerCase() === selectedState.toLowerCase()
    );
    if (!stateObj) return;

    let active = true;
    (async () => {
      try {
        const distList = await getDistricts(stateObj.id);
        if (!active) return;
        setDistricts(distList);
      } catch {
        setDistricts([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedState, states]);

  // 3. Fetch cities/stations when selectedDistrict changes
  useEffect(() => {
    if (!selectedDistrict) {
      setCities([]);
      return;
    }
    const distObj = districts.find(
      (d) =>
        d.district_name.toLowerCase() === selectedDistrict.toLowerCase() ||
        d.district_code.toLowerCase() === selectedDistrict.toLowerCase()
    );
    if (!distObj) return;

    let active = true;
    (async () => {
      try {
        const stationList = await getPoliceStations(distObj.id);
        if (!active) return;
        setCities(stationList);
      } catch {
        setCities([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedDistrict, districts]);

  // Format breadcrumb text
  const breadcrumbText = [
    selectedCity ? selectedCity : null,
    selectedDistrict ? `${selectedDistrict} District` : null,
    selectedState ? selectedState : 'All Regions',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-card shadow-sm transition-all">
      {/* Top Row: Geographic Cascading Selectors & Scope Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Cascading Selectors */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* State Selector */}
          <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border-secondary)] px-2 py-1 rounded-btn text-xs">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1">
              <Compass className="w-3 h-3 text-[#6C43CC]" />
              <label htmlFor={stateSelectId}>State:</label>
            </span>
            <select
              id={stateSelectId}
              value={selectedState}
              onChange={(e) => {
                const nextState = e.target.value;
                onStateChange(nextState);
                onDistrictChange('');
                onCityChange('');
              }}
              className="bg-transparent text-[var(--text-primary)] font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-[#0F172A] text-slate-300">
                Select State
              </option>
              {states.map((s) => (
                <option key={s.id} value={s.state_name} className="bg-[#0F172A] text-slate-200">
                  {s.state_name}
                </option>
              ))}
            </select>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 hidden sm:block" />

          {/* District Selector */}
          <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border-secondary)] px-2 py-1 rounded-btn text-xs">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1">
              <Building className="w-3 h-3 text-[#3B82F6]" />
              <label htmlFor={districtSelectId}>District:</label>
            </span>
            <select
              id={districtSelectId}
              value={selectedDistrict}
              disabled={!selectedState || districts.length === 0}
              onChange={(e) => {
                const nextDist = e.target.value;
                onDistrictChange(nextDist);
                onCityChange('');
              }}
              className="bg-transparent text-[var(--text-primary)] font-semibold text-xs focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="" className="bg-[#0F172A] text-slate-300">
                {districts.length > 0 ? 'Select District' : 'No Districts'}
              </option>
              {districts.map((d) => (
                <option key={d.id} value={d.district_name} className="bg-[#0F172A] text-slate-200">
                  {d.district_name}
                </option>
              ))}
            </select>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 hidden sm:block" />

          {/* City / Station Selector */}
          <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border-secondary)] px-2 py-1 rounded-btn text-xs">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#10B981]" />
              <label htmlFor={citySelectId}>City:</label>
            </span>
            <select
              id={citySelectId}
              value={selectedCity}
              disabled={!selectedDistrict || cities.length === 0}
              onChange={(e) => onCityChange(e.target.value)}
              className="bg-transparent text-[var(--text-primary)] font-semibold text-xs focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="" className="bg-[#0F172A] text-slate-300">
                {cities.length > 0 ? 'Select City / Station' : 'Select City'}
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.station_name} className="bg-[#0F172A] text-slate-200">
                  {c.station_name}
                </option>
              ))}
            </select>
          </div>

          {/* Investigation Scope Dropdown */}
          <div className="flex items-center gap-1 bg-[#1E1B4B]/30 border border-[#6C43CC]/50 px-2.5 py-1 rounded-btn text-xs ml-auto sm:ml-2">
            <span className="text-[10px] uppercase font-bold text-[#A78BFA] flex items-center gap-1">
              <Layers className="w-3 h-3 text-[#A78BFA]" />
              <label htmlFor={scopeSelectId}>Scope:</label>
            </span>
            <select
              id={scopeSelectId}
              value={scope}
              onChange={(e) => onScopeChange(e.target.value as InvestigationScope)}
              className="bg-transparent text-[#E0E7FF] font-bold text-xs focus:outline-none cursor-pointer"
            >
              <option value="city" className="bg-[#0F172A] text-slate-200">
                Current City
              </option>
              <option value="district" className="bg-[#0F172A] text-slate-200">
                Current District
              </option>
              <option value="state" className="bg-[#0F172A] text-slate-200">
                Entire State
              </option>
              <option value="all" className="bg-[#0F172A] text-slate-200">
                All Available (Global)
              </option>
            </select>
          </div>
        </div>

        {/* Right: Quick Search Input & Global Search Toggle */}
        <div className="flex items-center gap-2 min-w-[240px] w-full lg:w-auto">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                searchGlobal
                  ? 'Global search all jurisdictions...'
                  : `Search within ${selectedCity || selectedDistrict || selectedState || 'scope'}...`
              }
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] rounded-btn pl-8 pr-2 py-1 text-xs focus:outline-none focus:border-[#6C43CC] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Global Search Scope Toggle */}
          <button
            type="button"
            onClick={onToggleSearchGlobal}
            title={searchGlobal ? 'Switch to geographic scope search' : 'Search across entire database'}
            className={`px-2 py-1 rounded-btn text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer shrink-0 ${
              searchGlobal
                ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                : 'bg-[var(--bg-primary)] border-[var(--border-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {searchGlobal ? 'Global On' : 'Scope Only'}
          </button>
        </div>
      </div>

      {/* Bottom Row: Active Breadcrumb, Statistics, and Scope Quick Expansion */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-muted)]/50 text-[11px]">
        {/* Breadcrumb Information */}
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span className="text-[10px] uppercase font-bold text-[#6C43CC] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
            Showing network for:
          </span>
          <span className="font-semibold text-[var(--text-primary)] truncate max-w-[320px] sm:max-w-md">
            {breadcrumbText || 'All Regions'}
          </span>
        </div>

        {/* Action Controls: Expand to District / Expand to State & Metrics */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Node & Link Count Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[10px] font-mono text-[var(--text-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
            <span className="text-[var(--text-primary)] font-bold">{nodeCount}</span> nodes •{' '}
            <span className="text-[var(--text-primary)] font-bold">{edgeCount}</span> links
          </div>

          {/* Quick Expand to District Button (if on city scope) */}
          {scope === 'city' && selectedDistrict && (
            <button
              type="button"
              onClick={() => onExpandScope('district')}
              className="flex items-center gap-1 px-2.5 py-0.5 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/40 hover:border-[#3B82F6] text-[#60A5FA] rounded-btn text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              title={`Expand network to all entities in ${selectedDistrict} district`}
            >
              <Maximize2 className="w-2.5 h-2.5" />
              Expand to District
            </button>
          )}

          {/* Quick Expand to State Button (if on city or district scope) */}
          {(scope === 'city' || scope === 'district') && selectedState && (
            <button
              type="button"
              onClick={() => onExpandScope('state')}
              className="flex items-center gap-1 px-2.5 py-0.5 bg-[#6C43CC]/15 hover:bg-[#6C43CC]/25 border border-[#6C43CC]/40 hover:border-[#6C43CC] text-[#A78BFA] rounded-btn text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              title={`Expand network to all entities in ${selectedState} state`}
            >
              <Globe2 className="w-2.5 h-2.5" />
              Expand to State
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeographicScopeBar;
