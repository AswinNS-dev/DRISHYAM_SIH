import React, { useState, useMemo } from 'react';
import type { GangNetworkSummary, GangHierarchyMember } from '../../services/api';
import {
  Users,
  Crosshair,
  MapPin,
  ArrowRight,
  UserCheck,
  Search,
  X,
  Eye,
  Flame,
} from 'lucide-react';
import type { GraphNode } from './CriminalGraph3D';

interface GangNetworkViewProps {
  gangs: GangNetworkSummary[];
  selectedGang: GangNetworkSummary | null;
  onSelectGang: (gang: GangNetworkSummary) => void;
  onSelectMemberIn3D?: (node: GraphNode) => void;
  onSwitchTo3DGraph?: () => void;
}

export const GangNetworkView: React.FC<GangNetworkViewProps> = ({
  gangs,
  selectedGang,
  onSelectGang,
  onSelectMemberIn3D,
  onSwitchTo3DGraph,
}) => {
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');

  // Extract distinct territories
  const territories = useMemo(() => {
    const list = new Set<string>();
    gangs.forEach((g) => {
      if (g.territory) {
        g.territory.split(',').forEach((t) => {
          const clean = t.trim();
          if (clean) list.add(clean);
        });
      }
    });
    return Array.from(list).sort();
  }, [gangs]);

  // Filter gangs
  const filteredGangs = useMemo(() => {
    return gangs.filter((g) => {
      const matchSearch =
        !searchFilter.trim() ||
        g.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        g.leader_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        g.primary_racket.toLowerCase().includes(searchFilter.toLowerCase()) ||
        g.territory.toLowerCase().includes(searchFilter.toLowerCase());

      const matchTerritory =
        selectedTerritory === 'all' ||
        g.territory.toLowerCase().includes(selectedTerritory.toLowerCase());

      return matchSearch && matchTerritory;
    });
  }, [gangs, searchFilter, selectedTerritory]);

  const activeGang = selectedGang && filteredGangs.some((g) => g.gang_id === selectedGang.gang_id)
    ? selectedGang
    : filteredGangs[0] || selectedGang || gangs[0];

  return (
    <div className="h-full flex flex-col gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-card font-mono select-none overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border-secondary)] pb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400 animate-pulse" />
            Organized Crime & Gang Syndicate Network
          </h3>
          <p className="text-[9.5px] text-[var(--text-muted)] mt-0.5">
            Hierarchical command structures, interstate rackets, and operative syndicates across jurisdictions.
          </p>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold uppercase">
          {gangs.length} Syndicates Tracked
        </span>
      </div>

      {/* Search & Territory Filter Bar */}
      <div className="bg-[var(--bg-primary)] p-2.5 rounded-card border border-[var(--border-primary)] space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search syndicates by name, boss, racket, or city..."
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] focus:border-amber-400 rounded-btn pl-8 pr-8 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] outline-none transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2 pointer-events-none" />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {onSwitchTo3DGraph && (
            <button
              type="button"
              onClick={onSwitchTo3DGraph}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent-blue)]/20 hover:bg-[var(--accent-blue)]/30 border border-[var(--accent-blue)]/50 text-[#60A5FA] text-xs font-bold uppercase cursor-pointer transition-colors shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Full 3D Graph</span>
            </button>
          )}
        </div>

        {/* Territory Quick Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto text-[9px]">
          <span className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)] shrink-0">Territory:</span>
          <button
            type="button"
            onClick={() => setSelectedTerritory('all')}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              selectedTerritory === 'all'
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            All ({gangs.length})
          </button>
          {territories.slice(0, 10).map((t) => {
            const count = gangs.filter((g) => g.territory.toLowerCase().includes(t.toLowerCase())).length;
            if (count === 0) return null;
            return (
              <button
                type="button"
                key={t}
                onClick={() => setSelectedTerritory(t)}
                className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  selectedTerritory.toLowerCase() === t.toLowerCase()
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left Side Gang List, Right Side Hierarchy Tree */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Gang Syndicate Cards List (4 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-2 overflow-y-auto max-h-[70vh] pr-1">
          <span className="text-[9.5px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
            Matching Syndicates ({filteredGangs.length})
          </span>
          {filteredGangs.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-secondary)] rounded-card">
              No syndicates match your search filter.
            </div>
          ) : (
            filteredGangs.map((g) => {
              const isSelected = activeGang?.gang_id === g.gang_id;
              return (
                <div
                  key={g.gang_id}
                  onClick={() => onSelectGang(g)}
                  className={`p-3 rounded-card border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-[var(--bg-elevated)] border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                      : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border-[var(--border-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase truncate max-w-[200px]">{g.name}</span>
                    <span
                      className={`text-[8.5px] px-2 py-0.5 rounded font-bold uppercase ${
                        g.risk_level === 'CRITICAL'
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                      }`}
                    >
                      {g.risk_level}
                    </span>
                  </div>

                  <div className="text-[9.5px] text-[var(--text-muted)] space-y-0.5">
                    <div className="flex items-center gap-1.5 text-amber-300">
                      <Crosshair className="w-3 h-3 shrink-0" />
                      <span>Boss: {g.leader_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)] truncate">
                      <MapPin className="w-3 h-3 text-[var(--accent-blue)] shrink-0" />
                      <span className="truncate">{g.territory}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-orange-400/90 truncate">
                      <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                      <span className="truncate">{g.primary_racket}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] pt-1.5 border-t border-[var(--border-primary)]">
                    <span>{g.active_members} Active Operatives</span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-[var(--text-muted)]/30'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Gang Hierarchy Details (7 cols) */}
        {activeGang ? (
          <div className="lg:col-span-7 bg-[var(--bg-primary)] p-3.5 rounded-card border border-[var(--border-secondary)] flex flex-col gap-3.5 overflow-y-auto max-h-[70vh]">
            {/* Gang Summary Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 p-3 bg-[var(--bg-tertiary)] rounded-card border border-[var(--border-primary)]">
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase flex items-center gap-2">
                  <span>{activeGang.name}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/40">
                    {activeGang.risk_level}
                  </span>
                </h4>
                <p className="text-[10px] text-amber-400 font-bold uppercase mt-0.5">
                  Racket: {activeGang.primary_racket}
                </p>
              </div>
              <div className="text-[9.5px] text-left sm:text-right font-mono text-[var(--text-muted)]">
                <div>Territory: <span className="text-[var(--text-primary)]">{activeGang.territory}</span></div>
                <div>Boss: <span className="text-amber-300 font-bold">{activeGang.leader_name}</span></div>
              </div>
            </div>

            {/* Hierarchy Tree */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] text-[var(--text-muted)] uppercase font-bold tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[var(--accent-blue)]" />
                  Command Hierarchy & Operative Roster ({activeGang.members.length})
                </span>
                <span className="text-[9px] text-[var(--text-muted)]">Click operative to inspect dossier</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeGang.members.map((member: GangHierarchyMember) => (
                  <div
                    key={member.id}
                    onClick={() =>
                      onSelectMemberIn3D?.({
                        id: member.id,
                        name: member.name,
                        category: member.rank_level === 1 ? 'suspect' : 'offender',
                        riskScore: member.riskScore,
                        details: `${member.role} · Gang: ${activeGang.name}`,
                        casesCount: member.casesCount,
                        isSeed: member.isSeed,
                      })
                    }
                    className="p-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-secondary)] hover:border-amber-400/50 rounded-card transition-all cursor-pointer flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9.5px] font-bold flex items-center justify-center">
                          L{member.rank_level}
                        </span>
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase truncate max-w-[130px]">{member.name}</span>
                      </div>
                      <span
                        className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          member.status === 'at_large' ? 'bg-rose-950/60 text-rose-400' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                        }`}
                      >
                        {member.status}
                      </span>
                    </div>

                    <div className="text-[9.5px] text-[var(--text-muted)] flex items-center justify-between pt-1 border-t border-[var(--border-primary)]">
                      <span>Role: <strong className="text-[var(--text-primary)]">{member.role}</strong></span>
                      <span className="text-amber-400 font-bold">Risk {member.riskScore.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inter-member relationships */}
            {activeGang.relationships && activeGang.relationships.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[var(--border-primary)]">
                <span className="text-[9.5px] text-[var(--text-muted)] uppercase font-bold">Tactical Gang Linkages:</span>
                <div className="flex flex-wrap gap-1.5 text-[9.5px]">
                  {activeGang.relationships.map((rel, idx) => (
                    <div key={`rel-${idx}`} className="px-2 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-[var(--text-muted)]">
                      <strong className="text-[var(--text-primary)]">{rel.source}</strong> ➔ <strong className="text-[var(--text-primary)]">{rel.target}</strong>: {rel.relationship}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-secondary)] rounded-card">
            <Users className="w-8 h-8 text-[var(--text-disabled)] mb-2" />
            <span>Select a gang syndicate from the left to view hierarchical structure and operative roster.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GangNetworkView;
