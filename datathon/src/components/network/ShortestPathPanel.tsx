import React, { useState, useMemo } from 'react';
import type { ShortestPathResult } from '../../services/api';
import type { GraphNode } from './CriminalGraph3D';
import {
  GitCommit,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Search,
  Cpu,
  ArrowLeftRight,
  X,
  Eye,
} from 'lucide-react';

interface ShortestPathPanelProps {
  nodes: GraphNode[];
  onCalculatePath: (sourceId: string, targetId: string) => Promise<void>;
  pathResult: ShortestPathResult | null;
  loading: boolean;
  onSelectNodeIn3D?: (node: GraphNode) => void;
  sourceNodeId?: string;
  targetNodeId?: string;
  onSetSourceNodeId?: (id: string) => void;
  onSetTargetNodeId?: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  suspect: '#EF4444',
  offender: '#F97316',
  victim: '#22c55e',
  officer: '#3B82F6',
  case: '#F59E0B',
  location: '#A855F7',
};

export const ShortestPathPanel: React.FC<ShortestPathPanelProps> = ({
  nodes,
  onCalculatePath,
  pathResult,
  loading,
  onSelectNodeIn3D,
  sourceNodeId,
  targetNodeId,
  onSetSourceNodeId,
  onSetTargetNodeId,
}) => {
  // Sort candidates prioritizing suspects & offenders
  const candidateNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      const aIsCrim = a.category === 'suspect' || a.category === 'offender' ? 1 : 0;
      const bIsCrim = b.category === 'suspect' || b.category === 'offender' ? 1 : 0;
      if (aIsCrim !== bIsCrim) return bIsCrim - aIsCrim;
      return (b.riskScore ?? 0) - (a.riskScore ?? 0);
    });
  }, [nodes]);

  const [localSourceId, setLocalSourceId] = useState<string>(candidateNodes[0]?.id || '');
  const [localTargetId, setLocalTargetId] = useState<string>(candidateNodes[1]?.id || '');

  const srcId = sourceNodeId !== undefined ? sourceNodeId : localSourceId;
  const tgtId = targetNodeId !== undefined ? targetNodeId : localTargetId;
  const setSrcId = onSetSourceNodeId || setLocalSourceId;
  const setTgtId = onSetTargetNodeId || setLocalTargetId;

  const [srcSearch, setSrcSearch] = useState<string>('');
  const [tgtSearch, setTgtSearch] = useState<string>('');
  const [showSrcDropdown, setShowSrcDropdown] = useState<boolean>(false);
  const [showTgtDropdown, setShowTgtDropdown] = useState<boolean>(false);

  const selectedSrcNode = useMemo(() => nodes.find((n) => n.id === srcId), [nodes, srcId]);
  const selectedTgtNode = useMemo(() => nodes.find((n) => n.id === tgtId), [nodes, tgtId]);

  const filteredSrcNodes = useMemo(() => {
    if (!srcSearch.trim()) return candidateNodes.slice(0, 10);
    const q = srcSearch.toLowerCase().trim();
    return candidateNodes.filter((n) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)).slice(0, 10);
  }, [candidateNodes, srcSearch]);

  const filteredTgtNodes = useMemo(() => {
    if (!tgtSearch.trim()) return candidateNodes.slice(0, 10);
    const q = tgtSearch.toLowerCase().trim();
    return candidateNodes.filter((n) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)).slice(0, 10);
  }, [candidateNodes, tgtSearch]);

  const handleSwap = () => {
    const prevSrc = srcId;
    setSrcId(tgtId);
    setTgtId(prevSrc);
    if (tgtId && prevSrc) {
      void onCalculatePath(tgtId, prevSrc);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (srcId && tgtId && srcId !== tgtId) {
      void onCalculatePath(srcId, tgtId);
    }
  };

  return (
    <div className="h-full flex flex-col gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-card font-mono select-none overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border-secondary)] pb-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-[#3B82F6] animate-pulse" />
            Shortest Relationship Path Analysis
          </h3>
          <span className="text-[9px] px-2 py-0.5 rounded bg-[var(--accent-blue)]/10 text-[#60A5FA] border border-[var(--accent-blue)]/30 font-bold uppercase">
            BFS Traversal
          </span>
        </div>
        <p className="text-[9.5px] text-[var(--text-muted)] mt-0.5">
          Calculates minimum degrees of separation and shortest evidence-backed linkage chain between two entities.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="bg-[var(--bg-primary)] p-3 rounded-card border border-[var(--border-primary)] space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center">
          {/* Source Selector */}
          <div className="md:col-span-5 relative">
            <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold flex items-center justify-between mb-1">
              <span>Source Entity:</span>
              {selectedSrcNode && (
                <span className="text-[#60A5FA] lowercase truncate max-w-[130px]">
                  {selectedSrcNode.name}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={srcSearch || (selectedSrcNode ? `${selectedSrcNode.name} [${selectedSrcNode.category}]` : '')}
                onChange={(e) => {
                  setSrcSearch(e.target.value);
                  setShowSrcDropdown(true);
                }}
                onFocus={() => {
                  setShowSrcDropdown(true);
                  if (selectedSrcNode && !srcSearch) setSrcSearch(selectedSrcNode.name);
                }}
                placeholder="Search source entity..."
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] focus:border-[#3B82F6] rounded-btn px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none"
              />
              {srcSearch && (
                <button
                  type="button"
                  onClick={() => { setSrcSearch(''); setShowSrcDropdown(false); }}
                  className="absolute right-2 top-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {showSrcDropdown && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-card shadow-xl max-h-44 overflow-y-auto">
                {filteredSrcNodes.map((n) => (
                  <div
                    key={`src-opt-${n.id}`}
                    onClick={() => {
                      setSrcId(n.id);
                      setSrcSearch('');
                      setShowSrcDropdown(false);
                    }}
                    className="px-2.5 py-1.5 hover:bg-[#3B82F6]/15 flex items-center justify-between cursor-pointer text-xs border-b border-[var(--border-primary)]/30 last:border-0"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[n.category] || '#60A5FA' }} />
                      <span className="text-[var(--text-primary)] font-semibold truncate">{n.name}</span>
                      <span className="text-[8.5px] uppercase text-[var(--text-muted)]">[{n.category}]</span>
                    </div>
                    {n.riskScore != null && <span className="text-[9px] text-amber-400 font-bold shrink-0">R:{n.riskScore.toFixed(0)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div className="md:col-span-1 flex items-center justify-center pt-3">
            <button
              type="button"
              onClick={handleSwap}
              className="p-2 rounded-full bg-[var(--bg-tertiary)] hover:bg-[#3B82F6]/20 border border-[var(--border-secondary)] text-[var(--text-muted)] hover:text-[#60A5FA] transition-colors cursor-pointer"
              title="Swap source and target"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Target Selector */}
          <div className="md:col-span-5 relative">
            <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold flex items-center justify-between mb-1">
              <span>Target Entity:</span>
              {selectedTgtNode && (
                <span className="text-[#60A5FA] lowercase truncate max-w-[130px]">
                  {selectedTgtNode.name}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={tgtSearch || (selectedTgtNode ? `${selectedTgtNode.name} [${selectedTgtNode.category}]` : '')}
                onChange={(e) => {
                  setTgtSearch(e.target.value);
                  setShowTgtDropdown(true);
                }}
                onFocus={() => {
                  setShowTgtDropdown(true);
                  if (selectedTgtNode && !tgtSearch) setTgtSearch(selectedTgtNode.name);
                }}
                placeholder="Search target entity..."
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] focus:border-[#3B82F6] rounded-btn px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none"
              />
              {tgtSearch && (
                <button
                  type="button"
                  onClick={() => { setTgtSearch(''); setShowTgtDropdown(false); }}
                  className="absolute right-2 top-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {showTgtDropdown && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-card shadow-xl max-h-44 overflow-y-auto">
                {filteredTgtNodes.map((n) => (
                  <div
                    key={`tgt-opt-${n.id}`}
                    onClick={() => {
                      setTgtId(n.id);
                      setTgtSearch('');
                      setShowTgtDropdown(false);
                    }}
                    className="px-2.5 py-1.5 hover:bg-[#3B82F6]/15 flex items-center justify-between cursor-pointer text-xs border-b border-[var(--border-primary)]/30 last:border-0"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[n.category] || '#60A5FA' }} />
                      <span className="text-[var(--text-primary)] font-semibold truncate">{n.name}</span>
                      <span className="text-[8.5px] uppercase text-[var(--text-muted)]">[{n.category}]</span>
                    </div>
                    {n.riskScore != null && <span className="text-[9px] text-amber-400 font-bold shrink-0">R:{n.riskScore.toFixed(0)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick-Pick Suspects */}
        {candidateNodes.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[var(--border-primary)]/40">
            <span className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">Quick Pick:</span>
            {candidateNodes.slice(0, 4).map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  if (!srcId || srcId === c.id) setSrcId(c.id);
                  else setTgtId(c.id);
                }}
                className="px-2 py-0.5 rounded text-[8.5px] font-mono border bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[#60A5FA] hover:border-[#3B82F6]/50 cursor-pointer transition-colors truncate max-w-[130px]"
                title={`Click to assign ${c.name}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-primary)]/40">
          <button
            type="submit"
            disabled={loading || !srcId || !tgtId || srcId === tgtId}
            className="w-full sm:w-auto px-4 py-1.5 bg-[var(--accent-blue)] hover:bg-[#3B82F6] text-white text-xs font-bold uppercase tracking-wider rounded-btn transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md"
          >
            {loading ? <Cpu className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Calculate Shortest Path
          </button>
        </div>
      </form>

      {/* Path Output Results */}
      <div className="flex-1 bg-[var(--bg-primary)] p-3 rounded-card border border-[var(--border-primary)] flex flex-col gap-2.5 overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-[var(--text-muted)] gap-2 py-10">
            <Cpu className="w-8 h-8 animate-spin text-[#3B82F6]" />
            <span>Computing shortest path graph traversal across network...</span>
          </div>
        ) : pathResult ? (
          <div className="space-y-3">
            {/* Status Summary Banner */}
            <div className={`p-2.5 rounded-card border flex items-center justify-between text-xs font-bold uppercase ${
              pathResult.found
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-400'
            }`}>
              <div className="flex items-center gap-2">
                {pathResult.found ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
                <span>{pathResult.found ? `Path Connected: ${pathResult.distance} Degree${pathResult.distance > 1 ? 's' : ''} Separation` : 'No Connection Path Found'}</span>
              </div>
              <span className="text-[9.5px] opacity-80 lowercase font-mono">{pathResult.distance} hop(s)</span>
            </div>

            {pathResult.explanation && (
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-tertiary)]/50 p-2 rounded border border-[var(--border-primary)]/30">
                {pathResult.explanation}
              </p>
            )}

            {/* Path Nodes Flow Sequence */}
            {pathResult.found && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                  Traversed Linkage Sequence ({pathResult.path_nodes.length} entities):
                </h4>
                <div className="flex flex-col gap-1.5">
                  {pathResult.path_nodes.map((node, idx) => {
                    const edgeRel = pathResult.path_edges[idx]?.relationship;
                    return (
                      <React.Fragment key={`path-item-${node.id}-${idx}`}>
                        <div
                          onClick={() => onSelectNodeIn3D?.(node as GraphNode)}
                          className="p-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-card transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/30 text-[#60A5FA] border border-[var(--accent-blue)]/50 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-[var(--text-primary)] uppercase">{node.name}</div>
                              <div className="text-[9.5px] text-[var(--text-muted)] uppercase">
                                {node.category} {node.riskScore != null ? `• Risk: ${node.riskScore.toFixed(0)}` : ''}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNodeIn3D?.(node as GraphNode);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/20 border border-[var(--border-secondary)] text-[#60A5FA] text-[9px] uppercase font-bold cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Focus 3D</span>
                          </button>
                        </div>

                        {edgeRel && (
                          <div className="flex items-center justify-center gap-1.5 text-[9.5px] text-[#3B82F6] font-bold uppercase py-0.5">
                            <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                            <span>{edgeRel}</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-[var(--text-muted)] text-center p-6 border border-dashed border-[var(--border-secondary)] rounded-card">
            <GitCommit className="w-8 h-8 text-[var(--text-disabled)] mb-2" />
            <span>Select source and target entities above to calculate shortest relationship degrees and highlight on the 3D graph.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShortestPathPanel;
