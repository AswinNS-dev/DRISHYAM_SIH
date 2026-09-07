import React from 'react';
import { Radar, Play, Loader2, ChevronRight, ShieldAlert, FileText } from 'lucide-react';
import type { HiddenConnection, HiddenNetworkResponse } from '../../services/api';

interface HiddenNetworkPanelProps {
  nodes: Array<{ id: string; name: string }>;
  result: HiddenNetworkResponse | null;
  loading: boolean;
  error: string | null;
  minHops: number;
  maxHops: number;
  onSetMinHops: (hops: number) => void;
  onSetMaxHops: (hops: number) => void;
  onRun: () => void;
  onSelectNodeIn3D: (node: { id: string; name: string } | null) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  suspect: '#C94A2A',
  offender: '#8B5CF6',
  victim: '#22c55e',
  officer: '#1E6FD9',
};

const EntityChip: React.FC<{
  entity: { id: string; name: string; category: string; riskScore?: number };
  onSelect: (e: { id: string; name: string }) => void;
}> = ({ entity, onSelect }) => (
  <button
    onClick={() => onSelect(entity)}
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)]/60 hover:border-[var(--accent-blue)]/50 transition-colors cursor-pointer"
    title={`${entity.name} · ${entity.category}${entity.riskScore != null ? ` · risk ${entity.riskScore.toFixed(0)}` : ''}`}
  >
    <span
      className="w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: CATEGORY_COLORS[entity.category] || 'var(--accent-blue)' }}
    />
    <span className="text-[9.5px] font-semibold text-[var(--text-primary)] truncate max-w-[140px]">{entity.name}</span>
  </button>
);

const ConnectionCard: React.FC<{
  conn: HiddenConnection;
  onSelectNodeIn3D: (node: { id: string; name: string } | null) => void;
}> = ({ conn, onSelectNodeIn3D }) => (
  <div className="rounded-card border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 p-2.5 space-y-2">
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/40 text-[8px] font-mono font-bold uppercase tracking-wider text-amber-400">
        {conn.label}
      </span>
      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[8px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
        {conn.connection_status} · strength {conn.strength.toFixed(0)}
      </span>
    </div>

    <div className="flex items-center gap-1.5 flex-wrap">
      <EntityChip entity={conn.source} onSelect={onSelectNodeIn3D} />
      {conn.intermediates.map((mid, i) => (
        <React.Fragment key={`${mid.id}-${i}`}>
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
          <EntityChip entity={mid} onSelect={onSelectNodeIn3D} />
        </React.Fragment>
      ))}
      <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
      <EntityChip entity={conn.target} onSelect={onSelectNodeIn3D} />
    </div>

    <p className="text-[9.5px] leading-relaxed text-[var(--text-secondary)]">{conn.explanation}</p>

    {conn.hop_evidence.length > 0 && (
      <div className="space-y-1">
        <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Supporting evidence chain</div>
        {conn.hop_evidence.map((hop, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[9px] text-[var(--text-muted)]">
            <FileText className="w-3 h-3 mt-0.5 shrink-0 text-[var(--accent-teal)]" />
            <span>
              <b className="text-[var(--text-secondary)]">{hop.from_name}</b> — <b className="text-[var(--text-secondary)]">{hop.to_name}</b>: shared FIR participation
              {hop.fir_numbers.length > 0 && ` (${hop.fir_numbers.slice(0, 3).join(', ')}${hop.fir_numbers.length > 3 ? ` +${hop.fir_numbers.length - 3}` : ''})`}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const HiddenNetworkPanel: React.FC<HiddenNetworkPanelProps> = ({
  result,
  loading,
  error,
  minHops,
  maxHops,
  onSetMinHops,
  onSetMaxHops,
  onRun,
  onSelectNodeIn3D,
}) => {
  return (
    <div className="h-full overflow-y-auto rounded-card border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Radar className="w-4 h-4 text-[var(--accent-purple)] mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">Hidden Network Discovery</h3>
          <p className="text-[9.5px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
            Friends-of-friends traversal: finds entities with <b className="text-[var(--text-secondary)]">no direct relationship record</b> that are
            connected through intermediaries. Every result is an <b className="text-amber-400">indirect, potential connection</b> — never a confirmed
            criminal association — and each is grounded in the supporting FIR chain shown beneath it.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Traversal depth</span>
        {[2, 3].map((hops) => {
          const active = minHops === hops && maxHops === hops;
          return (
            <button
              key={hops}
              onClick={() => { onSetMinHops(hops); onSetMaxHops(hops); }}
              className={`px-2.5 py-1 rounded border text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--accent-purple)]/15 border-[var(--accent-purple)]/50 text-[var(--accent-purple)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {hops}-hop
            </button>
          );
        })}
        <button
          onClick={onRun}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent-purple)]/15 border border-[var(--accent-purple)]/40 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-purple)] hover:bg-[var(--accent-purple)]/25 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Discover
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent-coral)]">
          <ShieldAlert className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {result && (
        <div className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          {result.found} indirect connection{result.found === 1 ? '' : 's'} found
        </div>
      )}

      {result?.explanation && (
        <p className="text-[9px] leading-relaxed text-[var(--text-muted)] border-l-2 border-[var(--accent-purple)]/40 pl-2">
          {result.explanation}
        </p>
      )}

      {result && result.connections.length === 0 && !loading && !error && (
        <div className="text-center py-8 text-[10px] text-[var(--text-muted)] uppercase">
          No hidden multi-hop connections in the current network.
        </div>
      )}

      <div className="space-y-2">
        {result?.connections.map((conn, i) => (
          <ConnectionCard key={i} conn={conn} onSelectNodeIn3D={onSelectNodeIn3D} />
        ))}
      </div>

      <div className="text-[8px] font-mono text-[var(--text-disabled)] uppercase tracking-wider pt-1">
        AI-generated analytical output · grounded in FIR participation records · verify before action
      </div>
    </div>
  );
};

export default HiddenNetworkPanel;
