import React from 'react';
import type { AIGraphInsightData } from '../../services/api';
import { Sparkles, ShieldAlert, Crosshair, Lightbulb, Eye } from 'lucide-react';
import type { GraphNode } from './CriminalGraph3D';

interface AIGraphInsightsModalProps {
  insights: AIGraphInsightData[];
  nodes?: GraphNode[];
  onSelectNodeIn3D?: (node: GraphNode) => void;
  onSwitchTo3DGraph?: () => void;
}

export const AIGraphInsightsModal: React.FC<AIGraphInsightsModalProps> = ({
  insights,
  nodes = [],
  onSelectNodeIn3D,
  onSwitchTo3DGraph,
}) => {
  const resolveNode = (nid: string): GraphNode => {
    const found = nodes.find((n) => n.id === nid || n.name.toLowerCase() === nid.toLowerCase());
    if (found) return found;
    return {
      id: nid,
      name: nid.startsWith('criminal-') ? `Suspect (${nid.slice(9, 17)})` : nid,
      category: 'suspect',
      riskScore: 80,
      details: 'Identified by AI threat assessment',
      casesCount: 1,
    };
  };

  const handleSelectNode = (nid: string) => {
    const node = resolveNode(nid);
    onSelectNodeIn3D?.(node);
    onSwitchTo3DGraph?.();
  };

  return (
    <div className="h-full flex flex-col gap-3.5 p-3.5 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-card font-mono select-none overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border-secondary)] pb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            AI Graph Intelligence & Threat Assessment
          </h3>
          <p className="text-[9.5px] text-[var(--text-muted)] mt-0.5">
            Automated broker discovery, cross-syndicate pattern matching, and actionable investigative advisories.
          </p>
        </div>
        {onSwitchTo3DGraph && (
          <button
            type="button"
            onClick={onSwitchTo3DGraph}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--accent-blue)]/20 hover:bg-[var(--accent-blue)]/30 border border-[var(--accent-blue)]/50 text-[#60A5FA] text-xs font-bold uppercase transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View 3D Network</span>
          </button>
        )}
      </div>

      {/* Insight Cards List */}
      <div className="space-y-3.5 flex-1 min-h-0 overflow-y-auto">
        {insights.length === 0 ? (
          <div className="text-center py-10 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-secondary)] rounded-card">
            No active threat alerts for the current network slice.
          </div>
        ) : (
          insights.map((insight) => (
            <div
              key={insight.id}
              className="p-3.5 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-card space-y-2.5 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className={`w-4 h-4 ${
                      insight.threat_level === 'CRITICAL'
                        ? 'text-rose-400'
                        : insight.threat_level === 'HIGH'
                        ? 'text-amber-400'
                        : 'text-[#60A5FA]'
                    }`}
                  />
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase">{insight.title}</h4>
                </div>
                <span
                  className={`text-[8.5px] px-2 py-0.5 rounded font-bold uppercase ${
                    insight.threat_level === 'CRITICAL'
                      ? 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                      : insight.threat_level === 'HIGH'
                      ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                      : 'bg-blue-950/60 text-[#60A5FA] border border-blue-500/40'
                  }`}
                >
                  {insight.threat_level} Threat
                </span>
              </div>

              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{insight.description}</p>

              {/* AI Recommendation Box */}
              <div className="p-2.5 bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)] flex items-start gap-2 text-[10px]">
                <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 uppercase">AI Tactical Advisory: </strong>
                  <span className="text-[var(--text-secondary)]">{insight.recommendation}</span>
                </div>
              </div>

              {/* Target Nodes Action buttons */}
              {insight.target_node_ids && insight.target_node_ids.length > 0 && (
                <div className="flex items-center gap-2 text-[9.5px] pt-1 flex-wrap">
                  <span className="text-[var(--text-muted)] uppercase font-bold">Target Entities:</span>
                  {insight.target_node_ids.map((nid) => {
                    const resolved = resolveNode(nid);
                    return (
                      <button
                        type="button"
                        key={nid}
                        onClick={() => handleSelectNode(nid)}
                        className="px-2 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/20 border border-[var(--border-secondary)] hover:border-[#3B82F6]/60 text-[#60A5FA] rounded transition-colors cursor-pointer flex items-center gap-1.5 uppercase font-bold"
                        title="Click to inspect dossier and highlight in 3D network"
                      >
                        <Crosshair className="w-3 h-3 text-amber-400" />
                        <span>{resolved.name}</span>
                        {resolved.riskScore != null && (
                          <span className="text-[8.5px] text-amber-400/80 font-normal">
                            ({resolved.riskScore.toFixed(0)})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AIGraphInsightsModal;
