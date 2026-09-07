import React from 'react';
import type { NetworkWorkspaceView } from '../../hooks/useNetwork';
import {
  Share2,
  GitCommit,
  Waypoints,
  Users,
  BarChart3,
  Calendar,
  Sparkles,
  RefreshCw,
  Sliders,
  Database,
} from 'lucide-react';

interface GraphExplorerToolbarProps {
  activeView: NetworkWorkspaceView;
  setActiveView: (view: NetworkWorkspaceView) => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  minRisk: number;
  setMinRisk: (val: number) => void;
  isNeo4jBacked: boolean;
  onExportMatrix: () => void;
  onNeo4jSync: () => void;
  entityCounts?: Record<string, number>;
  sourceVisibility?: Record<string, boolean>;
  onToggleSourceVisibility?: (category: string) => void;
  onResetSourceVisibility?: () => void;
}

export const GraphExplorerToolbar: React.FC<GraphExplorerToolbarProps> = ({
  activeView,
  setActiveView,
  categoryFilter,
  setCategoryFilter,
  minRisk,
  setMinRisk,
  isNeo4jBacked,
  onExportMatrix,
  onNeo4jSync,
  entityCounts,
  sourceVisibility,
  onToggleSourceVisibility,
  onResetSourceVisibility,
}) => {
  const views: { id: NetworkWorkspaceView; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: '3d_explorer', label: '3D Graph Explorer', icon: Share2 },
    { id: 'shortest_path', label: 'Shortest Path', icon: GitCommit },
    { id: 'path_finder', label: 'Connection Path', icon: Waypoints },
    { id: 'gangs', label: 'Gang Networks', icon: Users },
    { id: 'link_analysis', label: 'Link Analysis', icon: BarChart3 },
    { id: 'timeline', label: 'Timeline View', icon: Calendar },
    { id: 'ai_insights', label: 'AI Insights', icon: Sparkles },
  ];

  const intelligenceSources = [
    {
      id: 'suspect',
      label: 'Suspects',
      color: '#EF4444',
      badgeClass: 'text-red-400 bg-red-500/10 border-red-500/30',
      activeClass: 'border-red-500/60 bg-red-500/15 shadow-[0_0_8px_rgba(239,68,68,0.3)]',
      renderIcon: () => <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.8)]" />,
    },
    {
      id: 'offender',
      label: 'Offenders',
      color: '#F97316',
      badgeClass: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      activeClass: 'border-orange-500/60 bg-orange-500/15 shadow-[0_0_8px_rgba(249,115,22,0.3)]',
      renderIcon: () => <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] shadow-[0_0_6px_rgba(249,115,22,0.8)]" />,
    },
    {
      id: 'cdr',
      label: 'CDRs',
      color: '#06B6D4',
      badgeClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      activeClass: 'border-cyan-500/60 bg-cyan-500/15 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
      renderIcon: () => (
        <svg className="w-3 h-3 text-[#06B6D4]" viewBox="0 0 16 16" fill="currentColor">
          <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" />
        </svg>
      ),
    },
    {
      id: 'financial_transaction',
      label: 'Financial',
      color: '#F59E0B',
      badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      activeClass: 'border-amber-500/60 bg-amber-500/15 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
      renderIcon: () => (
        <svg className="w-3 h-3 text-[#F59E0B]" viewBox="0 0 16 16" fill="currentColor">
          <polygon points="8,1 15,8 8,15 1,8" />
        </svg>
      ),
    },
    {
      id: 'surveillance_report',
      label: 'Surveillance',
      color: '#A855F7',
      badgeClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      activeClass: 'border-purple-500/60 bg-purple-500/15 shadow-[0_0_8px_rgba(168,85,247,0.3)]',
      renderIcon: () => (
        <svg className="w-3 h-3 text-[#A855F7]" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'social_media_intel',
      label: 'Social Intel',
      color: '#3B82F6',
      badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      activeClass: 'border-blue-500/60 bg-blue-500/15 shadow-[0_0_8px_rgba(59,130,246,0.3)]',
      renderIcon: () => (
        <svg className="w-3 h-3 text-[#3B82F6]" viewBox="0 0 16 16" fill="currentColor">
          <polygon points="5,1.5 11,1.5 14.5,5 14.5,11 11,14.5 5,14.5 1.5,11 1.5,5" />
        </svg>
      ),
    },
  ];

  const anySourceHidden = sourceVisibility
    ? intelligenceSources.some((s) => sourceVisibility[s.id] === false)
    : false;

  return (
    <div className="flex flex-col gap-3 bg-[var(--bg-secondary)] p-3 rounded-card border border-[var(--border-secondary)] shadow-lg font-mono">
      {/* Top Navigation Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Workspace View Mode Selector */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] p-1 rounded-btn border border-[var(--border-primary)] overflow-x-auto">
          {views.map((v) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`px-3 py-1.5 rounded-btn text-[11px] font-bold tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--accent-blue)] text-[var(--text-primary)] shadow-[0_0_12px_rgba(30,111,217,0.5)] border border-[#3B82F6]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/10'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--text-primary)] animate-pulse' : 'text-[var(--text-muted)]'}`} />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 text-[10px] uppercase">
          {/* Neo4j Status Badge */}
          <div
            className={`px-2.5 py-1.5 rounded-btn border flex items-center gap-1.5 text-[9.5px] font-bold ${
              isNeo4jBacked
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-950/40 text-amber-400 border-amber-500/30'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>{isNeo4jBacked ? 'Neo4j Connected' : 'SQL Graph Fallback'}</span>
          </div>

          <button
            onClick={onNeo4jSync}
            title="Sync PostgreSQL relational records to Neo4j Graph"
            className="px-2.5 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-btn transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync Neo4j</span>
          </button>

          <button
            onClick={onExportMatrix}
            className="px-2.5 py-1.5 bg-[var(--accent-blue)]/15 hover:bg-[var(--accent-blue)]/30 border border-[var(--accent-blue)]/40 text-[#60A5FA] hover:text-[var(--text-primary)] rounded-btn transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
          >
            <Share2 className="w-3 h-3" />
            <span>Export Matrix</span>
          </button>
        </div>
      </div>

      {/* Middle Multi-Source Visibility Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-primary)]">
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase font-bold">
          <span>Sources:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {intelligenceSources.map((source) => {
            const isVisible = sourceVisibility ? sourceVisibility[source.id] !== false : true;
            const count = entityCounts ? entityCounts[source.id] ?? 0 : null;

            return (
              <button
                key={source.id}
                onClick={() => onToggleSourceVisibility?.(source.id)}
                title={`Toggle ${source.label} visibility in 3D network`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-btn text-[10px] font-mono border transition-all cursor-pointer ${
                  isVisible
                    ? source.activeClass
                    : 'opacity-40 border-border-color bg-[var(--bg-primary)]/40 line-through text-[var(--text-disabled)]'
                }`}
              >
                {source.renderIcon()}
                <span className={isVisible ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-disabled)]'}>
                  {source.label}
                </span>
                {count !== null && (
                  <span
                    className={`ml-0.5 px-1 py-0.2 rounded text-[9px] font-bold ${
                      isVisible ? source.badgeClass : 'bg-[var(--bg-tertiary)] text-[var(--text-disabled)]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {anySourceHidden && onResetSourceVisibility && (
            <button
              onClick={onResetSourceVisibility}
              className="text-[9px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/20 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Show All
            </button>
          )}
        </div>
      </div>

      {/* Bottom Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-primary)] text-[11px]">
        {/* Category Filters */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold flex items-center gap-1">
            <Sliders className="w-3 h-3 text-[var(--accent-blue)]" /> Entity:
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] rounded-btn px-2.5 py-1 text-xs focus:outline-none focus:border-[var(--accent-blue)]"
          >
            <option value="all">All Categories</option>
            <option value="suspect">Suspects (At Large)</option>
            <option value="offender">Known Offenders</option>
            <option value="cdr">Call Detail Records (CDR)</option>
            <option value="financial_transaction">Financial Transactions</option>
            <option value="surveillance_report">Surveillance Reports</option>
            <option value="social_media_intel">Social Media Intel</option>
            <option value="case">Cases / FIRs</option>
            <option value="location">Jurisdiction Hotspots</option>
            <option value="victim">Victims & Complainants</option>
          </select>
        </div>

        {/* Risk Threshold Slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Min Risk: {minRisk}</span>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={minRisk}
            onChange={(e) => setMinRisk(Number(e.target.value))}
            className="w-24 accent-[var(--accent-blue)] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

export default GraphExplorerToolbar;

