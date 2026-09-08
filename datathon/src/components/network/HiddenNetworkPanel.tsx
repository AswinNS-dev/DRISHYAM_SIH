import React, { useState, useMemo } from 'react';
import {
  Radar,
  Loader2,
  ChevronRight,
  ShieldAlert,
  FileText,
  Search,
  X,
  User,
  Sparkles,
  Eye,
} from 'lucide-react';
import type { HiddenConnection, HiddenNetworkResponse } from '../../services/api';

interface HiddenNetworkPanelProps {
  nodes: Array<{ id: string; name: string; category?: string; riskScore?: number }>;
  result: HiddenNetworkResponse | null;
  loading: boolean;
  error: string | null;
  minHops: number;
  maxHops: number;
  onSetMinHops: (hops: number) => void;
  onSetMaxHops: (hops: number) => void;
  onRun: (criminalName?: string) => void;
  onSelectNodeIn3D: (node: { id: string; name: string } | null) => void;
  targetCriminalName?: string;
  onSetTargetCriminalName?: (name: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  suspect: '#EF4444',
  offender: '#F97316',
  victim: '#22c55e',
  officer: '#3B82F6',
};

const EntityChip: React.FC<{
  entity: { id: string; name: string; category: string; riskScore?: number };
  onSelect: (e: { id: string; name: string }) => void;
  isAnchor?: boolean;
}> = ({ entity, onSelect, isAnchor }) => (
  <button
    type="button"
    onClick={() => onSelect(entity)}
    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer ${
      isAnchor
        ? 'bg-rose-500/15 border-rose-500/50 hover:border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
        : 'bg-[var(--bg-tertiary)]/70 border-[var(--border-color)] hover:border-[var(--accent-blue)]/60'
    }`}
    title={`${entity.name} · ${entity.category}${entity.riskScore != null ? ` · risk ${entity.riskScore.toFixed(0)}` : ''}`}
  >
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: CATEGORY_COLORS[entity.category] || 'var(--accent-blue)' }}
    />
    <span className={`text-[10px] font-semibold truncate max-w-[150px] ${isAnchor ? 'text-rose-300 font-bold' : 'text-[var(--text-primary)]'}`}>
      {entity.name}
    </span>
    {entity.riskScore != null && (
      <span className="text-[8px] font-mono text-[var(--text-muted)]">
        {entity.riskScore.toFixed(0)}
      </span>
    )}
  </button>
);

const ConnectionCard: React.FC<{
  conn: HiddenConnection;
  onSelectNodeIn3D: (node: { id: string; name: string } | null) => void;
}> = ({ conn, onSelectNodeIn3D }) => (
  <div className="rounded-card border border-[var(--border-color)] bg-[var(--bg-secondary)]/70 p-3 space-y-2.5 shadow-md">
    <div className="flex items-center justify-between gap-1.5 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[8.5px] font-mono font-bold uppercase tracking-wider text-amber-400">
          {conn.label}
        </span>
        <span className="px-2 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[8.5px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          {conn.connection_status} · Strength {conn.strength.toFixed(1)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onSelectNodeIn3D(conn.source)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/20 border border-[var(--border-color)] text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        title="Inspect source criminal in 3D graph"
      >
        <Eye className="w-3 h-3 text-[var(--accent-blue)]" />
        <span>Focus 3D</span>
      </button>
    </div>

    {/* Multi-Hop Path Visual Chain */}
    <div className="flex items-center gap-1.5 flex-wrap p-2 rounded bg-[var(--bg-primary)]/80 border border-[var(--border-primary)]/40">
      <EntityChip entity={conn.source} onSelect={onSelectNodeIn3D} isAnchor />
      {conn.intermediates.map((mid, i) => (
        <React.Fragment key={`${mid.id}-${i}`}>
          <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <EntityChip entity={mid} onSelect={onSelectNodeIn3D} />
        </React.Fragment>
      ))}
      <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <EntityChip entity={conn.target} onSelect={onSelectNodeIn3D} />
    </div>

    <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
      {conn.explanation}
    </p>

    {conn.hop_evidence.length > 0 && (
      <div className="space-y-1 pt-1 border-t border-[var(--border-primary)]/30">
        <div className="text-[8.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-bold">
          Supporting FIR Evidence Chain ({conn.hop_evidence.length} hops):
        </div>
        {conn.hop_evidence.map((hop, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[9px] text-[var(--text-muted)]">
            <FileText className="w-3 h-3 mt-0.5 shrink-0 text-[var(--accent-teal)]" />
            <span>
              <b className="text-[var(--text-primary)]">{hop.from_name}</b> ➔ <b className="text-[var(--text-primary)]">{hop.to_name}</b>: shared FIR participation
              {hop.fir_numbers.length > 0 && (
                <span className="text-[var(--accent-teal)] ml-1">
                  ({hop.fir_numbers.slice(0, 3).join(', ')}{hop.fir_numbers.length > 3 ? ` +${hop.fir_numbers.length - 3}` : ''})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const HiddenNetworkPanel: React.FC<HiddenNetworkPanelProps> = ({
  nodes,
  result,
  loading,
  error,
  minHops,
  maxHops,
  onSetMinHops,
  onSetMaxHops,
  onRun,
  onSelectNodeIn3D,
  targetCriminalName,
  onSetTargetCriminalName,
}) => {
  const [localCriminalName, setLocalCriminalName] = useState<string>(targetCriminalName || '');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const criminalName = targetCriminalName !== undefined ? targetCriminalName : localCriminalName;
  const setCriminalName = onSetTargetCriminalName || setLocalCriminalName;

  // Filter available criminals in the active network
  const availableCriminals = useMemo(() => {
    const seen = new Set<string>();
    return nodes
      .filter((n) => (n.category === 'suspect' || n.category === 'offender') && !seen.has(n.name.toLowerCase()) && seen.add(n.name.toLowerCase()))
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  }, [nodes]);

  // Autocomplete suggestions based on input
  const suggestions = useMemo(() => {
    if (!criminalName.trim()) return [];
    const q = criminalName.toLowerCase().trim();
    return availableCriminals.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [availableCriminals, criminalName]);

  const handleSelectCriminal = (name: string) => {
    setCriminalName(name);
    setShowSuggestions(false);
    onRun(name);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    onRun(criminalName);
  };

  const handleClearCriminal = () => {
    setCriminalName('');
    setShowSuggestions(false);
    onRun('');
  };

  return (
    <div className="h-full overflow-y-auto rounded-card border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4 font-mono select-none">
      {/* Header */}
      <div className="flex items-start gap-2.5 border-b border-[var(--border-secondary)] pb-3">
        <Radar className="w-5 h-5 text-[var(--accent-purple)] mt-0.5 shrink-0 animate-pulse" />
        <div className="flex-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
            Hidden Network Discovery & Pattern Analysis
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
            Uncovers indirect, multi-hop relationships between criminals connected through shared intermediaries,
            evidence chains, and co-accused FIR participations.
          </p>
        </div>
      </div>

      {/* Criminal Search & Discovery Form */}
      <form onSubmit={handleSearchSubmit} className="space-y-3 bg-[var(--bg-primary)] p-3 rounded-card border border-[var(--border-primary)]">
        <div>
          <label className="text-[9.5px] uppercase tracking-wider text-[var(--text-muted)] font-bold flex items-center gap-1.5 mb-1.5">
            <User className="w-3.5 h-3.5 text-rose-400" />
            Target Criminal / Suspect Name:
          </label>
          <div className="relative">
            <input
              type="text"
              value={criminalName}
              onChange={(e) => {
                setCriminalName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Enter criminal name (e.g. Suresh, Dinesh Kumar, Selvakumar, Vijay Kumar S)..."
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] focus:border-[var(--accent-purple)] rounded-btn pl-8 pr-8 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] outline-none transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5 pointer-events-none" />
            {criminalName && (
              <button
                type="button"
                onClick={handleClearCriminal}
                className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-card shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                <div className="px-2.5 py-1 text-[8px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
                  Available Network Criminals ({suggestions.length})
                </div>
                {suggestions.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCriminal(c.name)}
                    className="px-3 py-1.5 hover:bg-[var(--accent-purple)]/15 flex items-center justify-between cursor-pointer text-xs border-b border-[var(--border-primary)]/30 last:border-0 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: CATEGORY_COLORS[c.category || 'suspect'] }}
                      />
                      <span className="font-semibold text-[var(--text-primary)]">{c.name}</span>
                      <span className="text-[8.5px] uppercase text-[var(--text-muted)]">[{c.category}]</span>
                    </div>
                    {c.riskScore != null && (
                      <span className="text-[9px] font-mono text-amber-400 font-bold">
                        Risk {c.riskScore.toFixed(0)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick-Select Criminal Chips from Active Scope */}
        {availableCriminals.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">Quick Select:</span>
            {availableCriminals.slice(0, 5).map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => handleSelectCriminal(c.name)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                  criminalName.toLowerCase() === c.name.toLowerCase()
                    ? 'bg-[var(--accent-purple)]/20 border-[var(--accent-purple)] text-[var(--accent-purple)] font-bold'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Traversal Depth & Execution Row */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-primary)]/40 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Hops:</span>
            {[2, 3, 4].map((hops) => {
              const active = minHops <= hops && maxHops >= hops;
              return (
                <button
                  type="button"
                  key={hops}
                  onClick={() => {
                    onSetMinHops(2);
                    onSetMaxHops(hops);
                  }}
                  className={`px-2.5 py-1 rounded border text-[9.5px] font-bold font-mono transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-purple)]/20 border-[var(--accent-purple)] text-[var(--accent-purple)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {hops}-Hop
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {criminalName && (
              <button
                type="button"
                onClick={handleClearCriminal}
                className="px-2.5 py-1 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-color)] text-[9.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase font-bold transition-colors cursor-pointer"
              >
                Clear Target
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[var(--accent-purple)] hover:bg-[#9333ea] text-white text-[10px] font-bold uppercase tracking-wider shadow-md disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
              {criminalName ? 'Find Hidden Patterns' : 'Discover All Patterns'}
            </button>
          </div>
        </div>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Header / Explanation */}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">
            <span>
              {result.found} Hidden Connection{result.found === 1 ? '' : 's'} Found
              {criminalName ? ` for "${criminalName}"` : ''}
            </span>
            <span className="text-amber-400 font-normal">Evidence-Grounded FIR Links</span>
          </div>

          {result.explanation && (
            <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] border-l-2 border-[var(--accent-purple)] pl-2.5 bg-[var(--bg-primary)]/40 py-1.5 rounded-r">
              {result.explanation}
            </p>
          )}
        </div>
      )}

      {/* Empty State */}
      {result && result.connections.length === 0 && !loading && !error && (
        <div className="text-center py-8 px-4 rounded-card border border-dashed border-[var(--border-secondary)] bg-[var(--bg-primary)]/30 space-y-2">
          <Sparkles className="w-8 h-8 text-[var(--text-disabled)] mx-auto" />
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase">
            No indirect multi-hop connections detected
          </div>
          <p className="text-[10px] text-[var(--text-muted)] max-w-sm mx-auto">
            {criminalName
              ? `No indirect connections found for "${criminalName}". Try increasing traversal hops to 3 or 4, or expand geographic scope to District or State.`
              : 'No hidden network relationships found in the active scope. Try expanding the geographic boundary or changing traversal depth.'}
          </p>
        </div>
      )}

      {/* Connection Cards List */}
      <div className="space-y-3">
        {result?.connections.map((conn, i) => (
          <ConnectionCard key={i} conn={conn} onSelectNodeIn3D={onSelectNodeIn3D} />
        ))}
      </div>

      <div className="text-[8.5px] font-mono text-[var(--text-disabled)] uppercase tracking-wider pt-2 border-t border-[var(--border-secondary)] text-center">
        Analytical Intelligence · Grounded in FIR Participations & Statutory Police Records · Verify Before Enforcement
      </div>
    </div>
  );
};

export default HiddenNetworkPanel;
