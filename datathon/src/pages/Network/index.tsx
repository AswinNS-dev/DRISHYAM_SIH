import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNetwork } from '../../hooks/useNetwork';
import GraphExplorerToolbar from '../../components/network/GraphExplorerToolbar';
import NetworkFilterPanel from '../../components/network/NetworkFilterPanel';
import CriminalGraph3D, { type GraphNode, type GraphLink } from '../../components/network/CriminalGraph3D';
import NodeDetailPanel from '../../components/network/NodeDetailPanel';
import EdgeDetailPanel from '../../components/network/EdgeDetailPanel';
import PathFinderPanel from '../../components/network/PathFinderPanel';
import ShortestPathPanel from '../../components/network/ShortestPathPanel';
import GangNetworkView from '../../components/network/GangNetworkView';
import LinkAnalysisPanel from '../../components/network/LinkAnalysisPanel';
import HiddenNetworkPanel from '../../components/network/HiddenNetworkPanel';
import NetworkTimelineSlider from '../../components/network/NetworkTimelineSlider';
import AIGraphInsightsModal from '../../components/network/AIGraphInsightsModal';
import GeographicScopeBar from '../../components/network/GeographicScopeBar';
import { downloadSecureDossier } from '../../utils/downloader';
import { useAuditStore } from '../../store/auditStore';
import { useAuthStore } from '../../store/authStore';
import {
  Network as NetIcon,
  Layers,
  Database,
  SearchX,
  AlertTriangle,
  Focus,
  X,
  ShieldAlert,
  Phone,
  CreditCard,
  Video,
  Globe,
  Users,
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { hasActiveNetworkFilters, buildNetworkPathHighlight, computeFocusSubgraph } from '../../utils/networkSearch';

interface NetworkGraphAreaProps {
  graphData: { nodes: GraphNode[]; links: GraphLink[] } | null;
  loading: boolean;
  error: string | null;
  onNodeSelect: (node: GraphNode) => void;
  onLinkSelect?: (link: GraphLink) => void;
  onClearFilters: () => void;
  highlightPath?: { nodeIds: string[]; linkKeys: string[] } | null;
  selectedNodeId?: string | null;
  onClearSelection?: () => void;
  suspectOffenderNexus?: boolean;
  onToggleSuspectOffenderNexus?: () => void;
}

const NetworkGraphArea: React.FC<NetworkGraphAreaProps> = ({
  graphData,
  loading,
  error,
  onNodeSelect,
  onLinkSelect,
  onClearFilters,
  highlightPath,
  selectedNodeId,
  onClearSelection,
  suspectOffenderNexus,
  onToggleSuspectOffenderNexus,
}) => {
  if (loading) {
    return (
      <div className="w-full p-6">
        <CardSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6 bg-[var(--bg-surface)] rounded-card border border-[var(--accent-coral)]/30">
        <AlertTriangle className="w-8 h-8 text-[var(--accent-coral)]" />
        <span className="text-xs text-[var(--text-muted)] uppercase max-w-sm">{error}</span>
      </div>
    );
  }
  if (graphData && graphData.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6 bg-[var(--bg-surface)] rounded-card border border-[var(--border-secondary)]">
        <SearchX className="w-8 h-8 text-[var(--text-disabled)]" />
        <span className="text-xs text-[var(--text-muted)] uppercase">
          No network relationships found for the selected filters.
        </span>
        <button
          type="button"
          onClick={onClearFilters}
          className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/20 border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-btn text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          Clear Filters
        </button>
      </div>
    );
  }
  if (!graphData) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-surface)] rounded-card border border-[var(--border-secondary)]">
        <span className="text-xs text-[var(--text-muted)] uppercase">Graph data unavailable</span>
      </div>
    );
  }
  return (
    <CriminalGraph3D
      onNodeSelect={onNodeSelect}
      onLinkSelect={onLinkSelect}
      graphData={graphData}
      highlightPath={highlightPath}
      selectedNodeId={selectedNodeId}
      onClearSelection={onClearSelection}
      suspectOffenderNexus={suspectOffenderNexus}
      onToggleSuspectOffenderNexus={onToggleSuspectOffenderNexus}
    />
  );
};

interface WorkspaceSidePanelProps {
  selectedNode: GraphNode | null;
  selectedLink: GraphLink | null;
  nodes: GraphNode[];
  links: GraphLink[];
  emptyMessage: string;
  onCloseNode: () => void;
  onCloseLink: () => void;
  onSelectNode: (node: GraphNode) => void;
  onSelectLink: (link: GraphLink) => void;
  onSetPathSource?: (node: GraphNode) => void;
  onSetPathTarget?: (node: GraphNode) => void;
  onFocusNode?: (node: GraphNode, hops: number) => void;
  onClearFocus?: () => void;
  isFocused: boolean;
  focusHops: number;
}

const WorkspaceSidePanel: React.FC<WorkspaceSidePanelProps> = ({
  selectedNode,
  selectedLink,
  nodes,
  links,
  emptyMessage,
  onCloseNode,
  onCloseLink,
  onSelectNode,
  onSelectLink,
  onSetPathSource,
  onSetPathTarget,
  onFocusNode,
  onClearFocus,
  isFocused,
  focusHops,
}) => {
  if (selectedLink) {
    return (
      <EdgeDetailPanel
        link={selectedLink}
        nodes={nodes}
        onClose={onCloseLink}
        onSelectNode={(n) => {
          onSelectNode(n);
        }}
      />
    );
  }
  if (selectedNode) {
    return (
      <NodeDetailPanel
        node={selectedNode}
        links={links}
        nodes={nodes}
        onClose={onCloseNode}
        onSelectNode={onSelectNode}
        onSelectLink={onSelectLink}
        onSetPathSource={onSetPathSource}
        onSetPathTarget={onSetPathTarget}
        onFocusNode={onFocusNode}
        onClearFocus={onClearFocus}
        isFocused={isFocused}
        focusHops={focusHops}
      />
    );
  }
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)]/40 rounded-card">
      <Layers className="w-10 h-10 mb-3 text-[var(--text-disabled)]" />
      <span>{emptyMessage}</span>
    </div>
  );
};

export const NetworkPageWorkspace: React.FC = () => {
  const {
    activeView,
    setActiveView,
    categoryFilter,
    setCategoryFilter,
    minRisk,
    setMinRisk,
    networkFilters,
    setNetworkFilters,
    graphData,
    isNeo4jBacked,
    seedNodeCount,
    loading,
    error,
    selectedNode,
    setSelectedNode,
    gangs,
    selectedGang,
    setSelectedGang,
    sourceNodeId,
    setSourceNodeId,
    targetNodeId,
    setTargetNodeId,
    hiddenTargetCriminal,
    setHiddenTargetCriminal,
    pathResult,
    pathLoading,
    runShortestPath,
    pathSource,
    setPathSource,
    pathTarget,
    setPathTarget,
    pathMaxHops,
    setPathMaxHops,
    connectionPath,
    connectionLoading,
    connectionError,
    runConnectionSearch,
    clearConnectionPath,
    hiddenMinHops,
    setHiddenMinHops,
    hiddenMaxHops,
    setHiddenMaxHops,
    hiddenNetwork,
    hiddenLoading,
    hiddenError,
    runHiddenNetworkDiscovery,
    linkAnalysis,
    insights,
    handleNeo4jSync,
    timelineDateRange,
    setTimelineDateRange,
    selectedState,
    setSelectedState,
    selectedDistrict,
    setSelectedDistrict,
    selectedCity,
    setSelectedCity,
    investigationScope,
    setInvestigationScope,
    expandScope,
    searchQuery,
    setSearchQuery,
    searchGlobal,
    toggleSearchGlobal,
  } = useNetwork();

  const { user } = useAuthStore();
  const { addLog } = useAuditStore();

  // Hidden-connection entities are partial records; resolve them to a full
  // graph node (lookup first, safe fallback) so the 3D graph can highlight them.
  const handleSelectHiddenEntity = (entity: { id: string; name: string } | null) => {
    if (!entity) { setSelectedNode(null); return; }
    const match = graphData?.nodes.find((n) => n.id === entity.id);
    if (match) { setSelectedNode(match); return; }
    setSelectedNode({
      id: entity.id,
      name: entity.name,
      category: 'suspect' as never,
      riskScore: 0,
      details: 'Entity referenced by a hidden (multi-hop) network connection.',
      casesCount: 0,
    });
  };
  const activeFilters = hasActiveNetworkFilters(networkFilters);
  const resultCount = graphData ? graphData.nodes.length : null;
  const hasExplicitDateFilters = Boolean(networkFilters.dateFrom || networkFilters.dateTo);

  // Issue #230: link selection (edge details) + path/Focus panel state.
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [highlightOn, setHighlightOn] = useState<boolean>(true);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusHops, setFocusHops] = useState<number>(2);

  const handleNodeSelect = (node: GraphNode) => {
    setSelectedLink(null);
    setSelectedNode(node);
  };

  const handleLinkSelect = (link: GraphLink) => {
    setSelectedNode(null);
    setSelectedLink(link);
  };

  const handleSetPathSource = (node: GraphNode) => {
    setPathSource(node);
    setActiveView('path_finder');
  };

  const handleSetPathTarget = (node: GraphNode) => {
    setPathTarget(node);
    setActiveView('path_finder');
  };

  const handleFocusNode = (node: GraphNode, hops: number) => {
    setSelectedLink(null);
    setFocusedNodeId(node.id);
    setFocusHops(hops);
  };

  const handleClearFocus = () => setFocusedNodeId(null);

  const handleClearConnectionPath = () => {
    clearConnectionPath();
    setHighlightOn(true);
  };

  // A stale focus (computed against a previous dataset) is dropped on filter change.
  useEffect(() => {
    setFocusedNodeId(null);
  }, [networkFilters, timelineDateRange]);

  // Issue #230: connection-path highlight normalized to undirected edge keys.
  const connectionHighlightPath = useMemo(() => {
    if (!highlightOn) return null;
    return buildNetworkPathHighlight(connectionPath);
  }, [highlightOn, connectionPath]);

  // Shortest path highlight normalized to node IDs and link keys
  const shortestHighlightPath = useMemo(() => {
    if (!pathResult || !pathResult.found || !pathResult.path_nodes || pathResult.path_nodes.length < 2) return null;
    const nodeIds = pathResult.path_nodes.map((n) => n.id);
    const linkKeys: string[] = [];
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const a = nodeIds[i];
      const b = nodeIds[i + 1];
      linkKeys.push(`${a}__${b}`);
      linkKeys.push(`${b}__${a}`);
    }
    return { nodeIds, linkKeys };
  }, [pathResult]);

  const activeHighlightPath = activeView === 'shortest_path' ? shortestHighlightPath : connectionHighlightPath;
  const highlightPath = activeHighlightPath;

  // Multi-source intelligence visibility toggles
  const [sourceVisibility, setSourceVisibility] = useState<Record<string, boolean>>({
    suspect: true,
    offender: true,
    cdr: true,
    financial_transaction: true,
    surveillance_report: true,
    social_media_intel: true,
    case: true,
    location: true,
    victim: true,
    officer: true,
  });

  const handleToggleSourceVisibility = (cat: string) => {
    setSourceVisibility((prev) => ({
      ...prev,
      [cat]: prev[cat] === false ? true : false,
    }));
  };

  const handleResetSourceVisibility = () => {
    setSourceVisibility({
      suspect: true,
      offender: true,
      cdr: true,
      financial_transaction: true,
      surveillance_report: true,
      social_media_intel: true,
      case: true,
      location: true,
      victim: true,
      officer: true,
    });
  };

  // Dynamic entity type counts
  const entityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      suspect: 0,
      offender: 0,
      cdr: 0,
      financial_transaction: 0,
      surveillance_report: 0,
      social_media_intel: 0,
      case: 0,
      location: 0,
      victim: 0,
      officer: 0,
    };
    (graphData?.nodes || []).forEach((n) => {
      counts[n.category] = (counts[n.category] || 0) + 1;
    });
    return counts;
  }, [graphData]);

  // Dynamic Intelligence Breakdown & Summary Stats
  const summaryStats = useMemo(() => {
    const nodes = graphData?.nodes || [];
    const links = graphData?.links || [];

    // 1. Total Suspects
    const totalSuspects = nodes.filter((n) => n.category === 'suspect').length;

    // Fast category lookup by node ID
    const nodeCategoryMap = new Map<string, string>();
    nodes.forEach((n) => nodeCategoryMap.set(n.id, n.category));

    const getSourceId = (s: any) => (typeof s === 'object' && s !== null ? s.id : s);
    const getTargetId = (t: any) => (typeof t === 'object' && t !== null ? t.id : t);

    // 2. Total CDR Links
    const totalCdrLinks = links.filter((l) => {
      if (l.relationship_type === 'COMMUNICATION') return true;
      const sCat = nodeCategoryMap.get(getSourceId(l.source));
      const tCat = nodeCategoryMap.get(getTargetId(l.target));
      return sCat === 'cdr' || tCat === 'cdr' || /CDR|CALL|PHONE|COMMUNICATION/i.test(l.relationship || '');
    }).length;

    // 3. Total Financial Links
    const totalFinancialLinks = links.filter((l) => {
      if (l.relationship_type === 'FINANCIAL') return true;
      const sCat = nodeCategoryMap.get(getSourceId(l.source));
      const tCat = nodeCategoryMap.get(getTargetId(l.target));
      return (
        sCat === 'financial_transaction' ||
        tCat === 'financial_transaction' ||
        /FINANCIAL|TRANSACTION|TRANSFER|PAYMENT|LEDGER/i.test(l.relationship || '')
      );
    }).length;

    // 4. Total Surveillance Links
    const totalSurveillanceLinks = links.filter((l) => {
      if (l.relationship_type === 'SURVEILLANCE') return true;
      const sCat = nodeCategoryMap.get(getSourceId(l.source));
      const tCat = nodeCategoryMap.get(getTargetId(l.target));
      return (
        sCat === 'surveillance_report' ||
        tCat === 'surveillance_report' ||
        /SURVEILLANCE|CCTV|SIGHTING|HARBOR/i.test(l.relationship || '')
      );
    }).length;

    // 5. Total Social Media Links
    const totalSocialLinks = links.filter((l) => {
      if (l.relationship_type === 'SOCIAL_DIGITAL') return true;
      const sCat = nodeCategoryMap.get(getSourceId(l.source));
      const tCat = nodeCategoryMap.get(getTargetId(l.target));
      return (
        sCat === 'social_media_intel' ||
        tCat === 'social_media_intel' ||
        /SOCIAL|DIGITAL|CYBER|ONLINE|THREAT/i.test(l.relationship || '')
      );
    }).length;

    // 6. High-Risk Entities
    const highRiskEntities = nodes.filter((n) => (n.riskScore ?? 0) >= 75).length;

    // 7. Syndicate / Ring Detections
    const syndicateDetections = gangs?.length || 0;

    return {
      totalSuspects,
      totalCdrLinks,
      totalFinancialLinks,
      totalSurveillanceLinks,
      totalSocialLinks,
      highRiskEntities,
      syndicateDetections,
    };
  }, [graphData, gangs]);

  // Dedicated Suspect <-> Offender Nexus Mode (showing network connection between suspect and offender alone)
  const [suspectOffenderNexus, setSuspectOffenderNexus] = useState<boolean>(false);

  const handleToggleSuspectOffenderNexus = useCallback(() => {
    setSuspectOffenderNexus((prev) => !prev);
  }, []);

  const isNexusActive = suspectOffenderNexus || categoryFilter === 'suspect_offender';

  // Focus mode: restrict the rendered subgraph to N hops around a chosen entity,
  // or isolate Suspect <-> Offender Nexus alone when toggled.
  const displayData = useMemo(() => {
    const base = graphData ?? { nodes: [], links: [] };

    // 1. Suspect <-> Offender Nexus Mode: Isolate suspect & offender connections alone
    if (isNexusActive) {
      const isSuspectOrOffender = (cat: string) => cat === 'suspect' || cat === 'offender';
      let candidateNodes = base.nodes.filter((n) => isSuspectOrOffender(n.category));
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        candidateNodes = candidateNodes.filter(
          (n) =>
            n.name?.toLowerCase().includes(q) ||
            n.id?.toLowerCase().includes(q) ||
            (n.details && n.details.toLowerCase().includes(q))
        );
      }
      const candidateIds = new Set(candidateNodes.map((n) => n.id));

      const candidateLinks = base.links.filter((l) => {
        const sId = typeof l.source === 'object' && l.source !== null ? l.source.id : String(l.source);
        const tId = typeof l.target === 'object' && l.target !== null ? l.target.id : String(l.target);
        return candidateIds.has(sId) && candidateIds.has(tId);
      });

      // Filter to connected nodes in this nexus so disconnected nodes don't clutter the view
      const connectedIds = new Set<string>();
      candidateLinks.forEach((l) => {
        const sId = typeof l.source === 'object' && l.source !== null ? l.source.id : String(l.source);
        const tId = typeof l.target === 'object' && l.target !== null ? l.target.id : String(l.target);
        connectedIds.add(sId);
        connectedIds.add(tId);
      });

      const activeNodes = candidateNodes.filter((n) => connectedIds.has(n.id));
      const targetNodes = activeNodes.length > 0 ? activeNodes : candidateNodes;

      // Ensure links have clean string IDs so Three-ForceGraph attaches directly to node objects
      const cleanLinks = candidateLinks.map((l) => ({
        ...l,
        source: typeof l.source === 'object' && l.source !== null ? l.source.id : String(l.source),
        target: typeof l.target === 'object' && l.target !== null ? l.target.id : String(l.target),
      }));

      // Ensure nodes have clean coordinates so D3 force simulation can organize them naturally
      const cleanNodes = targetNodes.map((n) => ({
        ...n,
        x: undefined,
        y: undefined,
        z: undefined,
        vx: undefined,
        vy: undefined,
        vz: undefined,
      }));

      const nexusBase = {
        nodes: cleanNodes,
        links: cleanLinks,
      };

      if (!focusedNodeId) return nexusBase;
      return computeFocusSubgraph(nexusBase, focusedNodeId, focusHops);
    }

    // 2. Multi-source intelligence visibility filters
    let visibleNodes = base.nodes.filter((n) => sourceVisibility[n.category] !== false);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      visibleNodes = visibleNodes.filter(
        (n) =>
          n.name?.toLowerCase().includes(q) ||
          n.id?.toLowerCase().includes(q) ||
          (n.details && n.details.toLowerCase().includes(q)) ||
          n.category?.toLowerCase().includes(q)
      );
    }
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleLinks = base.links.filter((l) => {
      const sId = typeof l.source === 'object' ? l.source.id : String(l.source);
      const tId = typeof l.target === 'object' ? l.target.id : String(l.target);
      return visibleNodeIds.has(sId) && visibleNodeIds.has(tId);
    });
    const filteredBase = { nodes: visibleNodes, links: visibleLinks };

    if (!focusedNodeId) return filteredBase;
    return computeFocusSubgraph(filteredBase, focusedNodeId, focusHops);
  }, [graphData, isNexusActive, sourceVisibility, focusedNodeId, focusHops, searchQuery]);


  const focusedNode =
    (focusedNodeId ? graphData?.nodes.find((n) => n.id === focusedNodeId) ?? null : null);
  const focusIsSelected = !!focusedNodeId && focusedNodeId === selectedNode?.id;

  const handleExportMatrix = () => {
    const nodeId = (ref: string | any): string => {
      if (typeof ref === 'string') return ref;
      if (ref && typeof ref === 'object') return ref.id ?? ref.name ?? '';
      return String(ref ?? '');
    };

    const matrixData = {
      relationType: 'Criminal Link Association Matrix',
      totalNodes: graphData?.nodes.length ?? 0,
      totalEdges: graphData?.links.length ?? 0,
      isNeo4jBacked,
      activeSuspects: graphData?.nodes.filter((node) => node.category === 'suspect').map((node) => node.name) ?? [],
      relationEdges:
        graphData?.links.map((link) => ({
          from: nodeId(link.source),
          to: nodeId(link.target),
          relation: link.relationship,
        })) ?? [],
    };

    downloadSecureDossier(
      'Suspect Connection Matrix',
      matrixData,
      user ? `CONFIDENTIAL - ${user.badgeId}` : 'CONFIDENTIAL - STATE POLICE'
    );

    if (user) {
      addLog(user.name, user.badgeId, 'EXPORT', 'Exported suspect relationship linkage association matrix (JSON)');
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col gap-3 p-1 md:p-3 select-none bg-[var(--bg-primary)] font-mono">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--border-muted)] pb-2">
        <div>
          <h2 className="text-md font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <NetIcon className="w-5 h-5 text-[#6C43CC] animate-pulse" />
            Graph-Based Criminal Intelligence & Relationship Analysis
          </h2>
          <p className="text-[9.5px] text-[var(--text-muted)] mt-0.5">
            NEO4J CYPHER GRAPH DB • THREE.JS FORCE DIRECTED NETWORK • CONNECTION PATH • GANG SYNDICATES • LINK CENTRALITY
          </p>
        </div>
      </div>

      {/* Gap 132.4: transparency banner for demo-seeded content */}
      {seedNodeCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-card border border-[var(--accent-purple)]/25 bg-[var(--accent-purple)]/5 text-[9.5px] font-mono text-[var(--accent-purple)] uppercase tracking-wider">
          <Database className="w-3.5 h-3.5 flex-shrink-0" />
          Dataset scope: contains {seedNodeCount} seeded demo record{seedNodeCount === 1 ? '' : 's'} — flagged nodes originate from the bundled training dataset, not live intelligence
        </div>
      )}

      {/* Geographic Scoping & Active Jurisdiction Control */}
      <GeographicScopeBar
        selectedState={selectedState}
        onStateChange={setSelectedState}
        selectedDistrict={selectedDistrict}
        onDistrictChange={setSelectedDistrict}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        scope={investigationScope}
        onScopeChange={setInvestigationScope}
        onExpandScope={expandScope}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchGlobal={searchGlobal}
        onToggleSearchGlobal={toggleSearchGlobal}
        nodeCount={graphData?.nodes?.length ?? 0}
        edgeCount={graphData?.links?.length ?? 0}
        loading={loading}
      />

      {/* Global Explorer Navigation & Filter Toolbar */}
      <GraphExplorerToolbar
        activeView={activeView}
        setActiveView={setActiveView}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        minRisk={minRisk}
        setMinRisk={setMinRisk}
        isNeo4jBacked={isNeo4jBacked}
        onExportMatrix={handleExportMatrix}
        onNeo4jSync={handleNeo4jSync}
        entityCounts={entityCounts}
        sourceVisibility={sourceVisibility}
        onToggleSourceVisibility={handleToggleSourceVisibility}
        onResetSourceVisibility={handleResetSourceVisibility}
        suspectOffenderNexus={isNexusActive}
        onToggleSuspectOffenderNexus={handleToggleSuspectOffenderNexus}
      />

      {/* Issue #226: structured multi-parameter search & filter controls */}
      <NetworkFilterPanel
        filters={networkFilters}
        onApply={setNetworkFilters}
        onClear={() => setNetworkFilters({})}
        loading={loading}
        resultCount={resultCount}
        hasActiveFilters={activeFilters}
      />

      {/* Dynamic Intelligence Breakdown & Summary Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {/* 1. Total Suspects */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setCategoryFilter(categoryFilter === 'suspect' ? 'all' : 'suspect')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCategoryFilter(categoryFilter === 'suspect' ? 'all' : 'suspect');
            }
          }}
          className={`p-2 rounded-card border transition-all cursor-pointer flex flex-col justify-between ${
            categoryFilter === 'suspect'
              ? 'bg-[#E24A4A]/20 border-[#E24A4A] shadow-[0_0_12px_rgba(226,74,74,0.3)]'
              : 'bg-[var(--bg-surface)] hover:bg-[#E24A4A]/10 border-[var(--border-secondary)] hover:border-[#E24A4A]/60'
          }`}
          title="Click to filter network by Suspects"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-[#E24A4A] font-bold truncate">Suspects</span>
            <ShieldAlert className="w-3.5 h-3.5 text-[#E24A4A] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-[var(--text-primary)]">{summaryStats.totalSuspects}</span>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Active</span>
          </div>
        </div>

        {/* 2. Total CDR Links */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleToggleSourceVisibility('cdr')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleSourceVisibility('cdr');
            }
          }}
          className={`p-2 rounded-card border transition-all cursor-pointer flex flex-col justify-between ${
            sourceVisibility['cdr'] === false
              ? 'bg-[var(--bg-surface)]/40 border-[var(--border-muted)] opacity-50'
              : 'bg-[var(--bg-surface)] hover:bg-[#00F0FF]/10 border-[var(--border-secondary)] hover:border-[#00F0FF]/60'
          }`}
          title="Click to toggle CDR visibility"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-[#00F0FF] font-bold truncate">CDR Links</span>
            <Phone className="w-3.5 h-3.5 text-[#00F0FF] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-[var(--text-primary)]">{summaryStats.totalCdrLinks}</span>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">
              {sourceVisibility['cdr'] === false ? 'Hidden' : 'Calls'}
            </span>
          </div>
        </div>

        {/* 3. Total Financial Links */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleToggleSourceVisibility('financial_transaction')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleSourceVisibility('financial_transaction');
            }
          }}
          className={`p-2 rounded-card border transition-all cursor-pointer flex flex-col justify-between ${
            sourceVisibility['financial_transaction'] === false
              ? 'bg-[var(--bg-surface)]/40 border-[var(--border-muted)] opacity-50'
              : 'bg-[var(--bg-surface)] hover:bg-[#FFB703]/10 border-[var(--border-secondary)] hover:border-[#FFB703]/60'
          }`}
          title="Click to toggle Financial Transaction visibility"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-[#FFB703] font-bold truncate">Fin. Links</span>
            <CreditCard className="w-3.5 h-3.5 text-[#FFB703] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-[var(--text-primary)]">{summaryStats.totalFinancialLinks}</span>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">
              {sourceVisibility['financial_transaction'] === false ? 'Hidden' : 'Transfers'}
            </span>
          </div>
        </div>

        {/* 4. Total Surveillance Links */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleToggleSourceVisibility('surveillance_report')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleSourceVisibility('surveillance_report');
            }
          }}
          className={`p-2 rounded-card border transition-all cursor-pointer flex flex-col justify-between ${
            sourceVisibility['surveillance_report'] === false
              ? 'bg-[var(--bg-surface)]/40 border-[var(--border-muted)] opacity-50'
              : 'bg-[var(--bg-surface)] hover:bg-[#A855F7]/10 border-[var(--border-secondary)] hover:border-[#A855F7]/60'
          }`}
          title="Click to toggle Surveillance Report visibility"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-[#A855F7] font-bold truncate">Surveillance</span>
            <Video className="w-3.5 h-3.5 text-[#A855F7] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-[var(--text-primary)]">{summaryStats.totalSurveillanceLinks}</span>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">
              {sourceVisibility['surveillance_report'] === false ? 'Hidden' : 'Sightings'}
            </span>
          </div>
        </div>

        {/* 5. Total Social Media Links */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleToggleSourceVisibility('social_media_intel')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleSourceVisibility('social_media_intel');
            }
          }}
          className={`p-2 rounded-card border transition-all cursor-pointer flex flex-col justify-between ${
            sourceVisibility['social_media_intel'] === false
              ? 'bg-[var(--bg-surface)]/40 border-[var(--border-muted)] opacity-50'
              : 'bg-[var(--bg-surface)] hover:bg-[#3B82F6]/10 border-[var(--border-secondary)] hover:border-[#3B82F6]/60'
          }`}
          title="Click to toggle Social Media Intel visibility"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-[#3B82F6] font-bold truncate">Social Intel</span>
            <Globe className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-[var(--text-primary)]">{summaryStats.totalSocialLinks}</span>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">
              {sourceVisibility['social_media_intel'] === false ? 'Hidden' : 'Signals'}
            </span>
          </div>
        </div>

        {/* 6. High-Risk Entities */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setMinRisk(minRisk >= 75 ? 0 : 75)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setMinRisk(minRisk >= 75 ? 0 : 75);
            }
          }}
          className={`p-2 rounded-card border transition-all cursor-pointer flex flex-col justify-between ${
            minRisk >= 75
              ? 'bg-[#FF5722]/20 border-[#FF5722] shadow-[0_0_12px_rgba(255,87,34,0.3)]'
              : 'bg-[var(--bg-surface)] hover:bg-[#FF5722]/10 border-[var(--border-secondary)] hover:border-[#FF5722]/60'
          }`}
          title="Click to filter by High-Risk Entities (Risk ≥ 75)"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-[#FF5722] font-bold truncate">High-Risk</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[#FF5722] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-[var(--text-primary)]">{summaryStats.highRiskEntities}</span>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">
              {minRisk >= 75 ? 'Active ≥75' : 'Score ≥75'}
            </span>
          </div>
        </div>

        {/* 7. Syndicate / Ring Detections */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveView(activeView === 'gangs' ? '3d_explorer' : 'gangs')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActiveView(activeView === 'gangs' ? '3d_explorer' : 'gangs');
            }
          }}
          className={`p-2 rounded-card border transition-all cursor-pointer flex flex-col justify-between ${
            activeView === 'gangs'
              ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] shadow-[0_0_12px_rgba(139,92,246,0.3)]'
              : 'bg-[var(--bg-surface)] hover:bg-[#8B5CF6]/10 border-[var(--border-secondary)] hover:border-[#8B5CF6]/60'
          }`}
          title="Click to inspect Syndicate / Gang Detections"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-[#8B5CF6] font-bold truncate">Syndicates</span>
            <Users className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-[var(--text-primary)]">{summaryStats.syndicateDetections}</span>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">
              {activeView === 'gangs' ? 'Viewing' : 'Rings'}
            </span>
          </div>
        </div>
      </div>

      {/* Focus mode indicator */}
      {focusedNode && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-card border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/5 text-[9.5px] font-mono uppercase tracking-wider">
          <Focus className="w-3.5 h-3.5 text-[var(--accent-blue)] animate-pulse" />
          <span className="text-[var(--text-secondary)]">
            Focus mode: <b className="text-[var(--accent-blue)]">{focusedNode.name}</b> — {focusHops} hop{focusHops === 1 ? '' : 's'} around this entity
          </span>
          <button
            onClick={handleClearFocus}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--accent-coral)]/15 text-[var(--text-muted)] border border-[var(--border-color)] cursor-pointer transition-colors"
          >
            <X className="w-2.5 h-2.5" />
            Exit
          </button>
        </div>
      )}

      {/* Workspace Display Area */}
      <div className="flex-1 w-full">
        {activeView === '3d_explorer' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div
              className={`h-full min-h-[640px] lg:min-h-[82vh] transition-all duration-300 ${
                selectedNode || selectedLink ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'
              }`}
            >
              <NetworkGraphArea
                graphData={displayData}
                loading={loading}
                error={error}
                highlightPath={highlightPath}
                selectedNodeId={selectedNode?.id}
                onNodeSelect={handleNodeSelect}
                onLinkSelect={handleLinkSelect}
                onClearSelection={() => setSelectedNode(null)}
                onClearFilters={() => setNetworkFilters({})}
                suspectOffenderNexus={isNexusActive}
                onToggleSuspectOffenderNexus={handleToggleSuspectOffenderNexus}
              />
            </div>
            {(selectedNode || selectedLink) && (
              <div className="lg:col-span-4 xl:col-span-3 h-full min-h-[640px] lg:min-h-[82vh] bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden animate-in fade-in duration-200">
                <WorkspaceSidePanel
                  selectedNode={selectedNode}
                  selectedLink={selectedLink}
                  nodes={graphData?.nodes || []}
                  links={graphData?.links || []}
                  emptyMessage="Select suspect or relationship inside the 3D graph to unlock dossiers telemetry"
                  onCloseNode={() => setSelectedNode(null)}
                  onCloseLink={() => setSelectedLink(null)}
                  onSelectNode={handleNodeSelect}
                  onSelectLink={handleLinkSelect}
                  onSetPathSource={handleSetPathSource}
                  onSetPathTarget={handleSetPathTarget}
                  onFocusNode={handleFocusNode}
                  onClearFocus={handleClearFocus}
                  isFocused={focusIsSelected}
                  focusHops={focusHops}
                />
              </div>
            )}
          </div>
        )}

        {activeView === 'shortest_path' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
            <div className="lg:col-span-4 h-full min-h-[560px] lg:min-h-[70vh]">
              <ShortestPathPanel
                nodes={graphData?.nodes || []}
                onCalculatePath={runShortestPath}
                pathResult={pathResult}
                loading={pathLoading}
                onSelectNodeIn3D={handleNodeSelect}
                sourceNodeId={sourceNodeId}
                targetNodeId={targetNodeId}
                onSetSourceNodeId={setSourceNodeId}
                onSetTargetNodeId={setTargetNodeId}
              />
            </div>
            <div className="lg:col-span-8 h-full flex flex-col gap-2 min-h-0">
              <div className="flex-1 min-h-[480px] lg:min-h-[66vh]">
                <NetworkGraphArea
                  graphData={displayData}
                  loading={loading}
                  error={error}
                  highlightPath={activeHighlightPath}
                  selectedNodeId={selectedNode?.id}
                  onNodeSelect={handleNodeSelect}
                  onLinkSelect={handleLinkSelect}
                  onClearSelection={() => setSelectedNode(null)}
                  onClearFilters={() => setNetworkFilters({})}
                  suspectOffenderNexus={isNexusActive}
                  onToggleSuspectOffenderNexus={handleToggleSuspectOffenderNexus}
                />
              </div>
              <div className="h-[200px] shrink-0 bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
                <WorkspaceSidePanel
                  selectedNode={selectedNode}
                  selectedLink={selectedLink}
                  nodes={graphData?.nodes || []}
                  links={graphData?.links || []}
                  emptyMessage="Select any path node or relationship to inspect supporting evidence"
                  onCloseNode={() => setSelectedNode(null)}
                  onCloseLink={() => setSelectedLink(null)}
                  onSelectNode={handleNodeSelect}
                  onSelectLink={handleLinkSelect}
                  onSetPathSource={handleSetPathSource}
                  onSetPathTarget={handleSetPathTarget}
                  onFocusNode={handleFocusNode}
                  onClearFocus={handleClearFocus}
                  isFocused={focusIsSelected}
                  focusHops={focusHops}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'path_finder' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
            <div className="lg:col-span-4 h-full min-h-[560px] lg:min-h-[70vh]">
              <PathFinderPanel
                nodes={graphData?.nodes || []}
                pathSource={pathSource}
                pathTarget={pathTarget}
                maxHops={pathMaxHops}
                loading={connectionLoading}
                error={connectionError}
                result={connectionPath}
                highlightOn={highlightOn}
                onSetSource={setPathSource}
                onSetTarget={setPathTarget}
                onSetMaxHops={setPathMaxHops}
                onRunSearch={() => void runConnectionSearch()}
                onToggleHighlight={() => setHighlightOn((v) => !v)}
                onClear={handleClearConnectionPath}
                onSelectNode={handleNodeSelect}
              />
            </div>
            <div className="lg:col-span-8 h-full flex flex-col gap-2 min-h-0">
              <div className="flex-1 min-h-[480px] lg:min-h-[66vh]">
                <NetworkGraphArea
                  graphData={displayData}
                  loading={loading}
                  error={error}
                  highlightPath={highlightPath}
                  selectedNodeId={selectedNode?.id}
                  onNodeSelect={handleNodeSelect}
                  onLinkSelect={handleLinkSelect}
                  onClearSelection={() => setSelectedNode(null)}
                  onClearFilters={() => setNetworkFilters({})}
                  suspectOffenderNexus={isNexusActive}
                  onToggleSuspectOffenderNexus={handleToggleSuspectOffenderNexus}
                />
              </div>
              <div className="h-[200px] shrink-0 bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
                <WorkspaceSidePanel
                  selectedNode={selectedNode}
                  selectedLink={selectedLink}
                  nodes={graphData?.nodes || []}
                  links={graphData?.links || []}
                  emptyMessage="Select a node or connection to inspect supporting evidence"
                  onCloseNode={() => setSelectedNode(null)}
                  onCloseLink={() => setSelectedLink(null)}
                  onSelectNode={handleNodeSelect}
                  onSelectLink={handleLinkSelect}
                  onSetPathSource={handleSetPathSource}
                  onSetPathTarget={handleSetPathTarget}
                  onFocusNode={handleFocusNode}
                  onClearFocus={handleClearFocus}
                  isFocused={focusIsSelected}
                  focusHops={focusHops}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'gangs' && (
          <GangNetworkView
            gangs={gangs}
            selectedGang={selectedGang}
            onSelectGang={setSelectedGang}
            onSelectMemberIn3D={handleNodeSelect}
            onSwitchTo3DGraph={() => setActiveView('3d_explorer')}
          />
        )}

        {activeView === 'hidden_networks' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
            <div className="lg:col-span-5 h-full min-h-[560px] lg:min-h-[70vh]">
              <HiddenNetworkPanel
                nodes={graphData?.nodes || []}
                result={hiddenNetwork}
                loading={hiddenLoading}
                error={hiddenError}
                minHops={hiddenMinHops}
                maxHops={hiddenMaxHops}
                onSetMinHops={setHiddenMinHops}
                onSetMaxHops={setHiddenMaxHops}
                onRun={(name) => void runHiddenNetworkDiscovery(name)}
                onSelectNodeIn3D={handleSelectHiddenEntity}
                targetCriminalName={hiddenTargetCriminal}
                onSetTargetCriminalName={setHiddenTargetCriminal}
              />
            </div>
            <div className="lg:col-span-7 h-full flex flex-col gap-2 min-h-0">
              <div className="flex-1 min-h-[480px] lg:min-h-[66vh]">
                <NetworkGraphArea
                  graphData={displayData}
                  loading={loading}
                  error={error}
                  highlightPath={activeHighlightPath}
                  selectedNodeId={selectedNode?.id}
                  onNodeSelect={handleNodeSelect}
                  onLinkSelect={handleLinkSelect}
                  onClearSelection={() => setSelectedNode(null)}
                  onClearFilters={() => setNetworkFilters({})}
                  suspectOffenderNexus={isNexusActive}
                  onToggleSuspectOffenderNexus={handleToggleSuspectOffenderNexus}
                />
              </div>
              <div className="h-[200px] shrink-0 bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
                <WorkspaceSidePanel
                  selectedNode={selectedNode}
                  selectedLink={selectedLink}
                  nodes={graphData?.nodes || []}
                  links={graphData?.links || []}
                  emptyMessage="Select a hidden-connection entity or intermediate to inspect supporting evidence"
                  onCloseNode={() => setSelectedNode(null)}
                  onCloseLink={() => setSelectedLink(null)}
                  onSelectNode={handleNodeSelect}
                  onSelectLink={handleLinkSelect}
                  onSetPathSource={handleSetPathSource}
                  onSetPathTarget={handleSetPathTarget}
                  onFocusNode={handleFocusNode}
                  onClearFocus={handleClearFocus}
                  isFocused={focusIsSelected}
                  focusHops={focusHops}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'link_analysis' && <LinkAnalysisPanel data={linkAnalysis} loading={loading} onSelectNodeIn3D={(node) => { handleNodeSelect(node); setActiveView('3d_explorer'); }} />}

        {activeView === 'timeline' && (
          <div className="h-full flex flex-col gap-3">
            <NetworkTimelineSlider onDateChange={setTimelineDateRange} />
            {hasExplicitDateFilters && (
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Explicit date range set in the filter panel — the timeline window is ignored while those dates are active.
              </div>
            )}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
              <div className="lg:col-span-8 h-full min-h-[420px] lg:min-h-[58vh]">
                <NetworkGraphArea
                  graphData={displayData}
                  loading={loading}
                  error={error}
                  highlightPath={highlightPath}
                  selectedNodeId={selectedNode?.id}
                  onNodeSelect={handleNodeSelect}
                  onLinkSelect={handleLinkSelect}
                  onClearSelection={() => setSelectedNode(null)}
                  onClearFilters={() => setNetworkFilters({})}
                />
              </div>
              <div className="lg:col-span-4 h-full min-h-[420px] lg:min-h-[58vh] bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
                <WorkspaceSidePanel
                  selectedNode={selectedNode}
                  selectedLink={selectedLink}
                  nodes={graphData?.nodes || []}
                  links={graphData?.links || []}
                  emptyMessage="Scrub timeline slider to inspect temporal graph changes"
                  onCloseNode={() => setSelectedNode(null)}
                  onCloseLink={() => setSelectedLink(null)}
                  onSelectNode={handleNodeSelect}
                  onSelectLink={handleLinkSelect}
                  onSetPathSource={handleSetPathSource}
                  onSetPathTarget={handleSetPathTarget}
                  onFocusNode={handleFocusNode}
                  onClearFocus={handleClearFocus}
                  isFocused={focusIsSelected}
                  focusHops={focusHops}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'ai_insights' && (
          <AIGraphInsightsModal insights={insights} nodes={graphData?.nodes || []} onSelectNodeIn3D={handleNodeSelect} onSwitchTo3DGraph={() => setActiveView('3d_explorer')} />
        )}
      </div>
    </div>
  );
};

export default NetworkPageWorkspace;