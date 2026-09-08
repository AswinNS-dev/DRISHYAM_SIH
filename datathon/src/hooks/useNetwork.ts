import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getFullNetworkGraph,
  getGangNetworks,
  calculateShortestPath,
  getLinkAnalysis,
  getAIGraphInsights,
  findNetworkPath,
  getHiddenNetworks,
  triggerNeo4jSync,
  type NetworkFilterParams,
  type NetworkPathResponse,
} from '../services/api';
import type {
  GangNetworkSummary,
  ShortestPathResult,
  LinkAnalysisData,
  AIGraphInsightData,
  HiddenNetworkResponse,
} from '../services/api';
import type { GraphNode, GraphLink } from '../components/network/CriminalGraph3D';
import type { InvestigationScope } from '../components/network/GeographicScopeBar';
import { useAuthStore } from '../store/authStore';

export type NetworkWorkspaceView =
  | '3d_explorer'
  | 'shortest_path'
  | 'path_finder'
  | 'hidden_networks'
  | 'gangs'
  | 'link_analysis'
  | 'timeline'
  | 'ai_insights';

export function useNetwork() {
  const { user } = useAuthStore();

  const [activeView, setActiveView] = useState<NetworkWorkspaceView>('3d_explorer');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [minRisk, setMinRisk] = useState<number>(0);
  // Issue #226: multi-parameter case filters (applied server-side).
  const [networkFilters, setNetworkFilters] = useState<NetworkFilterParams>({});
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const [isNeo4jBacked, setIsNeo4jBacked] = useState<boolean>(false);
  // Gap 132.4: provenance transparency about demo-seeded records.
  const [seedNodeCount, setSeedNodeCount] = useState<number>(0);
  const [datasetScope, setDatasetScope] = useState<string>('live_records');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Geographic Scoping & Investigation Scope
  const [selectedState, setSelectedState] = useState<string>(() => {
    return localStorage.getItem('drishyam_user_state') || 'Karnataka';
  });

  const [selectedDistrict, setSelectedDistrict] = useState<string>(() => {
    return localStorage.getItem('drishyam_user_district') || user?.district || 'Dharwad';
  });

  const [selectedCity, setSelectedCity] = useState<string>(() => {
    return localStorage.getItem('drishyam_user_city') || user?.station || 'Hubli City Police Station';
  });

  const [investigationScope, setInvestigationScope] = useState<InvestigationScope>(() => {
    return (localStorage.getItem('drishyam_investigation_scope') as InvestigationScope) || 'city';
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchGlobal, setSearchGlobal] = useState<boolean>(false);

  // Sync user profile district/station once authenticated session is loaded
  useEffect(() => {
    if (!localStorage.getItem('drishyam_user_district') && user?.district) {
      setSelectedDistrict(user.district);
    }
    if (!localStorage.getItem('drishyam_user_city') && user?.station) {
      setSelectedCity(user.station);
    }
  }, [user]);

  const handleStateChange = useCallback((newState: string) => {
    setSelectedState(newState);
    if (newState) {
      localStorage.setItem('drishyam_user_state', newState);
    } else {
      localStorage.removeItem('drishyam_user_state');
    }
  }, []);

  const handleDistrictChange = useCallback((newDistrict: string) => {
    setSelectedDistrict(newDistrict);
    if (newDistrict) {
      localStorage.setItem('drishyam_user_district', newDistrict);
    } else {
      localStorage.removeItem('drishyam_user_district');
    }
  }, []);

  const handleCityChange = useCallback((newCity: string) => {
    setSelectedCity(newCity);
    if (newCity) {
      localStorage.setItem('drishyam_user_city', newCity);
    } else {
      localStorage.removeItem('drishyam_user_city');
    }
  }, []);

  const handleScopeChange = useCallback((newScope: InvestigationScope) => {
    setInvestigationScope(newScope);
    localStorage.setItem('drishyam_investigation_scope', newScope);
    if (newScope === 'all') {
      setSearchGlobal(true);
    } else {
      setSearchGlobal(false);
    }
  }, []);

  const handleExpandScope = useCallback((targetScope: 'district' | 'state') => {
    setInvestigationScope(targetScope);
    localStorage.setItem('drishyam_investigation_scope', targetScope);
  }, []);

  const handleToggleSearchGlobal = useCallback(() => {
    setSearchGlobal((prev) => {
      const next = !prev;
      if (next) {
        setInvestigationScope('all');
        localStorage.setItem('drishyam_investigation_scope', 'all');
      } else {
        setInvestigationScope('city');
        localStorage.setItem('drishyam_investigation_scope', 'city');
      }
      return next;
    });
  }, []);

  // Request cancellation and in-memory cache
  const abortControllerRef = useRef<AbortController | null>(null);
  const graphCacheRef = useRef<
    Map<
      string,
      {
        nodes: GraphNode[];
        links: GraphLink[];
        isNeo4jBacked: boolean;
        seedNodeCount: number;
        datasetScope: string;
      }
    >
  >(new Map());

  // Gang Networks state
  const [gangs, setGangs] = useState<GangNetworkSummary[]>([]);
  const [selectedGang, setSelectedGang] = useState<GangNetworkSummary | null>(null);

  // Shortest Path state
  const [sourceNodeId, setSourceNodeId] = useState<string>('');
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [pathResult, setPathResult] = useState<ShortestPathResult | null>(null);
  const [pathLoading, setPathLoading] = useState<boolean>(false);

  // Investigative Path Finder state (issue #230)
  const [pathSource, setPathSource] = useState<GraphNode | null>(null);
  const [pathTarget, setPathTarget] = useState<GraphNode | null>(null);
  const [pathMaxHops, setPathMaxHops] = useState<number>(3);
  const [connectionPath, setConnectionPath] = useState<NetworkPathResponse | null>(null);
  const [connectionLoading, setConnectionLoading] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Link Analysis state
  const [linkAnalysis, setLinkAnalysis] = useState<LinkAnalysisData | null>(null);

  // Hidden network discovery state (SIH26189 friends-of-friends)
  const [hiddenTargetCriminal, setHiddenTargetCriminal] = useState<string>('');
  const [hiddenMinHops, setHiddenMinHops] = useState<number>(2);
  const [hiddenMaxHops, setHiddenMaxHops] = useState<number>(2);
  const [hiddenNetwork, setHiddenNetwork] = useState<HiddenNetworkResponse | null>(null);
  const [hiddenLoading, setHiddenLoading] = useState<boolean>(false);
  const [hiddenError, setHiddenError] = useState<string | null>(null);

  // AI Insights state
  const [insights, setInsights] = useState<AIGraphInsightData[]>([]);

  // Timeline state
  const [timelineDateRange, setTimelineDateRange] = useState<[string, string]>(['2024-01-01', '2026-12-31']);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // The timeline slider is a date window over the dataset.
  const isTimelineActive = !(
    timelineDateRange[0] === '2024-01-01' && timelineDateRange[1] === '2026-12-31'
  );

  // Issue #226 filters + the active timeline window
  const effectiveFilters = useCallback(
    (base: NetworkFilterParams): NetworkFilterParams => {
      if (base.dateFrom || base.dateTo || !isTimelineActive) return base;
      return { ...base, dateFrom: timelineDateRange[0], dateTo: timelineDateRange[1] };
    },
    [timelineDateRange, isTimelineActive]
  );

  // Load Main Graph with caching, cancellation, and geographic scoping
  const loadGraph = useCallback(
    async (opts?: { bypassCache?: boolean }) => {
      // Abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Prepare geographic filters based on active investigation scope
      const geoParams: Partial<NetworkFilterParams> = {
        scope: investigationScope,
      };

      if (investigationScope === 'city') {
        if (selectedState) geoParams.state = selectedState;
        if (selectedDistrict) geoParams.district = selectedDistrict;
        if (selectedCity) geoParams.city = selectedCity;
      } else if (investigationScope === 'district') {
        if (selectedState) geoParams.state = selectedState;
        if (selectedDistrict) geoParams.district = selectedDistrict;
      } else if (investigationScope === 'state') {
        if (selectedState) geoParams.state = selectedState;
      }

      const mergedFilters = effectiveFilters({
        ...networkFilters,
        ...geoParams,
      });

      const cat = categoryFilter === 'all' || categoryFilter === 'suspect_offender' ? undefined : categoryFilter;

      const cacheKey = JSON.stringify({
        cat,
        minRisk,
        mergedFilters,
      });

      if (!opts?.bypassCache && graphCacheRef.current.has(cacheKey)) {
        const cached = graphCacheRef.current.get(cacheKey)!;
        setGraphData({
          nodes: cached.nodes,
          links: cached.links,
        });
        setIsNeo4jBacked(cached.isNeo4jBacked);
        setSeedNodeCount(cached.seedNodeCount);
        setDatasetScope(cached.datasetScope);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await getFullNetworkGraph(
          cat,
          minRisk,
          undefined,
          false,
          mergedFilters,
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;

        const nodes = res.nodes as GraphNode[];
        const links = res.edges as GraphLink[];

        setGraphData({
          nodes,
          links,
        });
        setIsNeo4jBacked(res.is_neo4j_backed);
        setSeedNodeCount(res.seed_node_count ?? 0);
        setDatasetScope(res.dataset_scope ?? 'live_records');

        // Store up to 20 cached responses
        if (graphCacheRef.current.size >= 20) {
          const firstKey = graphCacheRef.current.keys().next().value;
          if (firstKey) graphCacheRef.current.delete(firstKey);
        }
        graphCacheRef.current.set(cacheKey, {
          nodes,
          links,
          isNeo4jBacked: res.is_neo4j_backed,
          seedNodeCount: res.seed_node_count ?? 0,
          datasetScope: res.dataset_scope ?? 'live_records',
        });
      } catch (err: any) {
        if (
          err?.name === 'AbortError' ||
          controller.signal.aborted ||
          err?.message?.toLowerCase?.().includes('abort')
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [
      categoryFilter,
      minRisk,
      effectiveFilters,
      networkFilters,
      selectedState,
      selectedDistrict,
      selectedCity,
      investigationScope,
    ]
  );

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load Gangs
  const loadGangs = useCallback(async () => {
    try {
      const data = await getGangNetworks();
      setGangs(data);
      if (data.length > 0 && !selectedGang) {
        setSelectedGang(data[0]);
      }
    } catch {
      // Fallback handled in UI
    }
  }, [selectedGang]);

  // Run Shortest Path
  const runShortestPath = async (src: string, tgt: string) => {
    if (!src || !tgt) return;
    setPathLoading(true);
    try {
      const res = await calculateShortestPath(src, tgt);
      setPathResult(res);
    } catch (err) {
      setPathResult({
        found: false,
        distance: 0,
        path_nodes: [],
        path_edges: [],
        explanation: err instanceof Error ? err.message : 'Path calculation failed.',
      });
    } finally {
      setPathLoading(false);
    }
  };

  // Investigative Path Finder (issue #230)
  const runConnectionSearch = useCallback(async () => {
    setConnectionError(null);
    if (!pathSource || !pathTarget) {
      setConnectionError('Please select both source and target entities.');
      return;
    }
    if (pathSource.id === pathTarget.id) {
      setConnectionError('Please select two different entities.');
      return;
    }
    setConnectionLoading(true);
    try {
      const res = await findNetworkPath(pathSource.id, pathTarget.id, pathMaxHops, effectiveFilters(networkFilters));
      setConnectionPath(res);
    } catch (err) {
      setConnectionPath(null);
      setConnectionError(
        err instanceof Error && err.message ? err.message : 'Unable to find the connection. Please try again.'
      );
    } finally {
      setConnectionLoading(false);
    }
  }, [pathSource, pathTarget, pathMaxHops, effectiveFilters, networkFilters]);

  const clearConnectionPath = useCallback(() => {
    setConnectionPath(null);
    setConnectionError(null);
  }, []);

  // Hidden network discovery
  const runHiddenNetworkDiscovery = useCallback(async (targetCrimName?: string) => {
    setHiddenLoading(true);
    setHiddenError(null);
    const crimName = targetCrimName !== undefined ? targetCrimName : hiddenTargetCriminal;
    if (targetCrimName !== undefined) {
      setHiddenTargetCriminal(targetCrimName);
    }
    try {
      const geoParams: Partial<NetworkFilterParams> = {};
      if (investigationScope === 'city') {
        if (selectedState) geoParams.state = selectedState;
        if (selectedDistrict) geoParams.district = selectedDistrict;
        if (selectedCity) geoParams.city = selectedCity;
      } else if (investigationScope === 'district') {
        if (selectedState) geoParams.state = selectedState;
        if (selectedDistrict) geoParams.district = selectedDistrict;
      } else if (investigationScope === 'state') {
        if (selectedState) geoParams.state = selectedState;
      }

      const merged = effectiveFilters({
        ...networkFilters,
        ...geoParams,
        criminalName: crimName.trim() ? crimName.trim() : undefined,
      });

      const res = await getHiddenNetworks(hiddenMinHops, hiddenMaxHops, merged);
      setHiddenNetwork(res);
    } catch (err) {
      setHiddenNetwork(null);
      setHiddenError(err instanceof Error ? err.message : 'Hidden network discovery failed.');
    } finally {
      setHiddenLoading(false);
    }
  }, [
    hiddenTargetCriminal,
    hiddenMinHops,
    hiddenMaxHops,
    effectiveFilters,
    networkFilters,
    selectedState,
    selectedDistrict,
    selectedCity,
    investigationScope,
  ]);

  useEffect(() => {
    setConnectionPath(null);
    setConnectionError(null);
    setPathSource(null);
    setPathTarget(null);
  }, [networkFilters, timelineDateRange]);

  // Run Link Analysis
  const loadLinkAnalysis = useCallback(async () => {
    try {
      const res = await getLinkAnalysis();
      setLinkAnalysis(res);
    } catch {
      // Handled silently
    }
  }, []);

  // Load AI Insights
  const loadInsights = useCallback(async () => {
    try {
      const res = await getAIGraphInsights();
      setInsights(res);
    } catch {
      // Handled silently
    }
  }, []);

  // Trigger Neo4j Sync
  const handleNeo4jSync = async () => {
    try {
      await triggerNeo4jSync();
      graphCacheRef.current.clear();
      await loadGraph({ bypassCache: true });
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    void loadGangs();
    void loadLinkAnalysis();
    void loadInsights();
  }, [loadGangs, loadLinkAnalysis, loadInsights]);

  return {
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
    datasetScope,
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
    hiddenTargetCriminal,
    setHiddenTargetCriminal,
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
    timelineDateRange,
    setTimelineDateRange,
    reloadGraph: loadGraph,
    handleNeo4jSync,
    // Geographic Environment & Scope
    selectedState,
    setSelectedState: handleStateChange,
    selectedDistrict,
    setSelectedDistrict: handleDistrictChange,
    selectedCity,
    setSelectedCity: handleCityChange,
    investigationScope,
    setInvestigationScope: handleScopeChange,
    expandScope: handleExpandScope,
    searchQuery,
    setSearchQuery,
    searchGlobal,
    toggleSearchGlobal: handleToggleSearchGlobal,
  };
}
