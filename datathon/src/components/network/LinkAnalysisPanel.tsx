import React from 'react';
import type { LinkAnalysisData, CentralityMetric } from '../../services/api';
import { BarChart3, Activity, Cpu, Award, Eye } from 'lucide-react';
import type { GraphNode } from './CriminalGraph3D';

interface LinkAnalysisPanelProps {
  data: LinkAnalysisData | null;
  loading: boolean;
  onSelectNodeIn3D?: (node: GraphNode) => void;
}

export const LinkAnalysisPanel: React.FC<LinkAnalysisPanelProps> = ({ data, loading, onSelectNodeIn3D }) => {
  if (loading || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-card text-xs font-mono text-[var(--text-muted)] uppercase">
        <Cpu className="w-8 h-8 animate-spin text-[#3B82F6] mb-3" />
        <span>Calculating network graph centralities & broker node metrics...</span>
      </div>
    );
  }

  const handleNodeClick = (node: CentralityMetric) => {
    onSelectNodeIn3D?.({
      id: node.node_id,
      name: node.node_name,
      category: (node.category as any) || 'suspect',
      riskScore: node.riskScore ?? 75,
      details: `Betweenness: ${node.betweenness_score} · Degree: ${node.degree_centrality}`,
      casesCount: node.degree_centrality,
    });
  };

  return (
    <div className="h-full flex flex-col gap-3.5 p-3.5 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-card font-mono select-none overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border-secondary)] pb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400 animate-pulse" />
            Network Topology & Centrality Link Analysis
          </h3>
          <p className="text-[9.5px] text-[var(--text-muted)] mt-0.5">
            Degree centrality, betweenness broker scores, and high-impact bridge nodes across criminal networks.
          </p>
        </div>

        {/* Top Stats */}
        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1 bg-[var(--bg-primary)] rounded border border-[var(--border-secondary)] text-center">
            <div className="text-[8.5px] text-[var(--text-muted)] uppercase">Graph Density</div>
            <div className="text-xs font-bold text-purple-400">{data.graph_density}</div>
          </div>
          <div className="px-3 py-1 bg-[var(--bg-primary)] rounded border border-[var(--border-secondary)] text-center">
            <div className="text-[8.5px] text-[var(--text-muted)] uppercase">Syndicate Clusters</div>
            <div className="text-xs font-bold text-amber-400">{data.total_clusters}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Broker Nodes vs High-Impact Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 flex-1 min-h-0">
        {/* Top Broker Nodes (Betweenness) */}
        <div className="bg-[var(--bg-primary)] p-3.5 rounded-card border border-[var(--border-secondary)] space-y-2.5 flex flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-2">
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Top Broker Nodes (Betweenness Centrality)
            </h4>
            <span className="text-[8.5px] text-[var(--text-muted)]">Key intermediaries</span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[50vh] pr-1">
            {data.top_broker_nodes.map((node: CentralityMetric) => (
              <div
                key={node.node_id}
                onClick={() => handleNodeClick(node)}
                className="p-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-primary)] hover:border-purple-400/60 rounded-card flex items-center justify-between transition-all cursor-pointer shadow-sm"
              >
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)] uppercase">{node.node_name}</div>
                  <div className="text-[9.5px] text-[var(--text-muted)] uppercase">{node.category} • Risk {node.riskScore}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right font-bold">
                    <div className="text-xs text-purple-400">{node.betweenness_score}</div>
                    <div className="text-[8.5px] text-[var(--text-muted)] font-normal">Betweenness</div>
                  </div>
                  <Eye className="w-3.5 h-3.5 text-purple-400/50 hover:text-purple-300" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High Impact Degree Nodes */}
        <div className="bg-[var(--bg-primary)] p-3.5 rounded-card border border-[var(--border-secondary)] space-y-2.5 flex flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-2">
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              High Influence Nodes (PageRank)
            </h4>
            <span className="text-[8.5px] text-[var(--text-muted)]">Influence score</span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[50vh] pr-1">
            {data.high_impact_nodes.map((node: CentralityMetric) => (
              <div
                key={node.node_id}
                onClick={() => handleNodeClick(node)}
                className="p-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-primary)] hover:border-amber-400/60 rounded-card flex items-center justify-between transition-all cursor-pointer shadow-sm"
              >
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)] uppercase">{node.node_name}</div>
                  <div className="text-[9.5px] text-[var(--text-muted)] uppercase">{node.category} • Risk {node.riskScore} • Degree {node.degree_centrality}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right font-bold">
                    <div className="text-xs text-amber-400">{node.pagerank_score != null ? node.pagerank_score.toFixed(4) : node.degree_centrality}</div>
                    <div className="text-[8.5px] text-[var(--text-muted)] font-normal">PageRank</div>
                  </div>
                  <Eye className="w-3.5 h-3.5 text-amber-400/50 hover:text-amber-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metric explanations */}
      <div className="bg-[var(--bg-secondary)]/60 border border-[var(--border-secondary)] rounded-card p-2.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-blue-400">Degree centrality</div>
          <p className="text-[8.5px] text-[var(--text-muted)] leading-relaxed mt-0.5">Share of the network directly connected to this entity via shared FIRs.</p>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-purple-400">Betweenness centrality</div>
          <p className="text-[8.5px] text-[var(--text-muted)] leading-relaxed mt-0.5">How often an entity bridges shortest paths between disjoint criminal factions.</p>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400">PageRank score</div>
          <p className="text-[8.5px] text-[var(--text-muted)] leading-relaxed mt-0.5">Iterative stationary distribution measuring structural importance and influence.</p>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Syndicate clusters</div>
          <p className="text-[8.5px] text-[var(--text-muted)] leading-relaxed mt-0.5">Connected components and dense co-offending cliques in the active graph.</p>
        </div>
      </div>
    </div>
  );
};

export default LinkAnalysisPanel;
