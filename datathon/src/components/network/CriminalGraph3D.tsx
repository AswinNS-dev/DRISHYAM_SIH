import React, { useState, useRef, useEffect, useMemo, useCallback, type RefObject } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import {
  AlertTriangle,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Crosshair,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Sparkles,
  Zap,
  X,
} from 'lucide-react';
import type { NetworkNodeCategory } from '../../services/api';
import { useAppStore } from '../../store/appStore';

// =========================================================================
// 3D GLASS GEOMETRIES & MATERIALS CACHE (SUBSTANTIAL & HIGH-DEFINITION)
// =========================================================================

// Shared 3D geometries for multi-source intelligence entities — enlarged crystal scales for high visual impact
const GEOMETRIES: Record<string, { outer: THREE.BufferGeometry; inner: THREE.BufferGeometry }> = {
  // Suspect: Red sphere
  suspect: {
    outer: new THREE.SphereGeometry(15.0, 24, 24),
    inner: new THREE.SphereGeometry(8.0, 16, 16),
  },
  // Offender: Orange sphere
  offender: {
    outer: new THREE.SphereGeometry(16.0, 24, 24),
    inner: new THREE.SphereGeometry(8.5, 16, 16),
  },
  // CDR: Cyan hexagon (6-sided cylinder)
  cdr: {
    outer: new THREE.CylinderGeometry(14.0, 14.0, 10.0, 6),
    inner: new THREE.CylinderGeometry(7.5, 7.5, 6.0, 6),
  },
  // Financial Transaction: Amber / Gold diamond (Octahedron)
  financial_transaction: {
    outer: new THREE.OctahedronGeometry(15.0, 0),
    inner: new THREE.OctahedronGeometry(8.0, 0),
  },
  // Surveillance Report: Purple cube (Box)
  surveillance_report: {
    outer: new THREE.BoxGeometry(15.0, 15.0, 15.0),
    inner: new THREE.BoxGeometry(8.0, 8.0, 8.0),
  },
  // Social Media Intel: Blue octagon (8-sided cylinder)
  social_media_intel: {
    outer: new THREE.CylinderGeometry(14.0, 14.0, 10.0, 8),
    inner: new THREE.CylinderGeometry(7.5, 7.5, 6.0, 8),
  },
  case: {
    outer: new THREE.BoxGeometry(15.0, 15.0, 15.0),
    inner: new THREE.BoxGeometry(8.0, 8.0, 8.0),
  },
  location: {
    outer: new THREE.ConeGeometry(13.5, 19.0, 6),
    inner: new THREE.ConeGeometry(7.0, 10.0, 6),
  },
  victim: {
    outer: new THREE.SphereGeometry(12.5, 16, 16),
    inner: new THREE.SphereGeometry(6.5, 12, 12),
  },
  officer: {
    outer: new THREE.IcosahedronGeometry(13.5, 0),
    inner: new THREE.IcosahedronGeometry(7.2, 0),
  },
  organization: {
    outer: new THREE.DodecahedronGeometry(16.0, 0),
    inner: new THREE.DodecahedronGeometry(8.5, 0),
  },
  gang: {
    outer: new THREE.DodecahedronGeometry(18.5, 0),
    inner: new THREE.DodecahedronGeometry(10.0, 0),
  },
  vehicle: {
    outer: new THREE.CylinderGeometry(13.5, 13.5, 16.0, 8),
    inner: new THREE.CylinderGeometry(7.0, 7.0, 8.5, 8),
  },
  weapon: {
    outer: new THREE.OctahedronGeometry(14.5, 0),
    inner: new THREE.OctahedronGeometry(7.5, 0),
  },
  default: {
    outer: new THREE.SphereGeometry(13.0, 16, 16),
    inner: new THREE.SphereGeometry(7.0, 12, 12),
  },
};

// Hero node dual halo orbit rings — matching enlarged node scale
const HERO_HALO_GEOMETRY = new THREE.TorusGeometry(24.0, 0.90, 16, 48);
const HERO_HALO_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.95,
  side: THREE.DoubleSide,
});

const HERO_OUTER_RING_GEOM = new THREE.TorusGeometry(32.0, 0.70, 16, 48);
const HERO_OUTER_RING_MAT = new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.80,
  side: THREE.DoubleSide,
});

const CATEGORY_COLORS: Record<string, number> = {
  suspect: 0xef4444,
  offender: 0xf97316,
  cdr: 0x06b6d4,
  financial_transaction: 0xf59e0b,
  surveillance_report: 0xa855f7,
  social_media_intel: 0x3b82f6,
  case: 0x10b981,
  location: 0x0ea5e9,
  victim: 0x64748b,
  officer: 0x14b8a6,
  organization: 0x8b5cf6,
  gang: 0xec4899,
  vehicle: 0x38bdf8,
  weapon: 0xf43f5e,
  default: 0x8b5cf6,
};

// Materials cache to prevent re-allocating Three.js materials on every animation frame
interface NodeMaterials {
  outer: THREE.Material;
  inner: THREE.Material;
}

const MATERIAL_CACHE = new Map<string, NodeMaterials>();

// Materials for 3D glass / crystal effect with inner luminous core
const createGlassMaterial = (color: number, opacity = 0.78) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.15,
    metalness: 0.12,
    transmission: 0.55,
    transparent: true,
    opacity,
    depthWrite: false,
  });

const createCoreMaterial = (color: number, opacity = 0.95) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
  });

function getNodeMaterials(
  category: string,
  state: 'normal' | 'hero' | 'one_hop' | 'two_hop' | 'dimmed',
  isLight: boolean
): NodeMaterials {
  const cat = (category || 'default').toLowerCase();
  const hex = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default;
  const key = `${cat}_${state}_${isLight ? 'light' : 'dark'}`;

  const cached = MATERIAL_CACHE.get(key);
  if (cached) return cached;

  let outer: THREE.Material;
  let inner: THREE.Material;

  if (state === 'hero') {
    outer = createGlassMaterial(0xffffff, 0.98);
    inner = createCoreMaterial(0xffffff, 1.0);
  } else if (state === 'one_hop') {
    outer = createGlassMaterial(hex, 0.95);
    inner = createCoreMaterial(hex, 1.0);
  } else if (state === 'two_hop') {
    outer = createGlassMaterial(hex, 0.35);
    inner = createCoreMaterial(hex, 0.40);
  } else if (state === 'dimmed') {
    outer = createGlassMaterial(0x334155, 0.08);
    inner = createCoreMaterial(0x1e293b, 0.08);
  } else {
    // Normal state — luminous crystal glass with glowing inner core
    outer = createGlassMaterial(hex, 0.85);
    inner = createCoreMaterial(hex, 0.95);
  }

  const result: NodeMaterials = { outer, inner };
  MATERIAL_CACHE.set(key, result);
  return result;
}

const PATH_MATERIALS: NodeMaterials = {
  outer: createGlassMaterial(0x22d3ee, 0.95),
  inner: createCoreMaterial(0xa5f3fc, 1.0),
};

export interface GraphNode {
  id: string;
  name: string;
  category: NetworkNodeCategory;
  riskScore: number;
  details: string;
  casesCount: number;
  phone?: string | null;
  gangAffiliation?: string | null;
  status?: string | null;
  district?: string | null;
  date?: string | null;
  /** True when the record originates from the bundled demo seed dataset. */
  isSeed?: boolean;
  /** Spatial coordinates assigned by the force-graph simulation at render time. */
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphLink {
  source: string | any;
  target: string | any;
  relationship: string;
  weight?: number;
  first_seen?: string | null;
  last_seen?: string | null;
  provenance?: 'DIRECT_DATABASE' | 'ANALYTICAL_INFERENCE' | 'DEMO_SEED' | 'MIXED' | 'UNKNOWN' | string;
  verification_status?: 'VERIFIED' | 'POTENTIAL' | 'UNVERIFIED' | 'DEMO' | string;
  relationship_type?: string;
  evidence?: Array<{
    record_type?: string;
    record_id?: string;
    record_number?: string;
    details?: string;
    timestamp?: string | null;
    factors?: string[];
  }>;
  confidence?: number | null;
  confidence_level?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' | string;
  is_demo_derived?: boolean;
  operational_warning?: string | null;
}

const EMPTY_GRAPH_DATA: { nodes: GraphNode[]; links: GraphLink[] } = { nodes: [], links: [] };

export interface CriminalGraph3DProps {
  onNodeSelect?: (node: GraphNode) => void;
  onLinkSelect?: (link: GraphLink) => void;
  graphData?: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  /** Node ids + undirected edge keys (`min~max`) to emphasize after a connection-path search. */
  highlightPath?: {
    nodeIds: string[];
    linkKeys: string[];
  } | null;
  /** Controlled selection from parent workspace */
  selectedNodeId?: string | null;
  /** Callback when user deselects or clicks empty background */
  onClearSelection?: () => void;
  /** Whether the Suspect <-> Offender Nexus filter is active */
  suspectOffenderNexus?: boolean;
  /** Callback to toggle Suspect <-> Offender Nexus */
  onToggleSuspectOffenderNexus?: () => void;
}

export const CriminalGraph3D: React.FC<CriminalGraph3DProps> = ({
  onNodeSelect,
  onLinkSelect,
  graphData,
  highlightPath,
  selectedNodeId: externalSelectedNodeId,
  onClearSelection,
  suspectOffenderNexus,
  onToggleSuspectOffenderNexus,
}) => {
  const fgRef = useRef<any>(null);
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);

  // Synchronize selection between internal and parent prop
  const activeSelectedNodeId =
    externalSelectedNodeId !== undefined ? externalSelectedNodeId : internalSelectedNodeId;

  // Local neighborhood isolation toggle
  const [isolateLocalNetwork, setIsolateLocalNetwork] = useState<boolean>(false);

  const resolvedGraphData = useMemo(() => graphData ?? EMPTY_GRAPH_DATA, [graphData]);

  const [currentGraphData, setCurrentGraphData] = useState(resolvedGraphData);
  const [hasError, setHasError] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === 'light';
  const canvasBg = isLight ? '#f7f9fc' : '#080E1B';

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        width: Math.max(window.innerWidth * 0.70, 800),
        height: Math.max(window.innerHeight * 0.75, 680),
      };
    }
    return { width: 960, height: 680 };
  });

  // Path finder highlights
  const pathNodeIds = useMemo(() => new Set(highlightPath?.nodeIds ?? []), [highlightPath]);
  const pathLinkKeys = useMemo(() => new Set(highlightPath?.linkKeys ?? []), [highlightPath]);
  const hasHighlight = !!highlightPath && (pathNodeIds.size > 0 || pathLinkKeys.size > 0);

  const linkKey = (link: GraphLink): string => {
    const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    return [String(sId), String(tId)].sort().join('~');
  };
  const isPathLink = (link: GraphLink): boolean => pathLinkKeys.has(linkKey(link));
  const isPathNode = (node: GraphNode): boolean => pathNodeIds.has(node.id);

  // Compute degree centrality for node scaling, repulsion and camera fitting
  const degreeMap = useMemo(() => {
    const deg: Record<string, number> = {};
    for (const link of currentGraphData.links) {
      const src = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tgt = typeof link.target === 'object' ? (link.target as any).id : link.target;
      deg[src] = (deg[src] || 0) + 1;
      deg[tgt] = (deg[tgt] || 0) + 1;
    }
    return deg;
  }, [currentGraphData]);

  // Investigation Focus Adjacency: 1-hop and 2-hop neighborhoods
  const { oneHopNeighbors, twoHopNeighbors, directLinkKeys, secondaryLinkKeys } = useMemo(() => {
    if (!activeSelectedNodeId) {
      return {
        oneHopNeighbors: new Set<string>(),
        twoHopNeighbors: new Set<string>(),
        directLinkKeys: new Set<string>(),
        secondaryLinkKeys: new Set<string>(),
      };
    }

    const oneHop = new Set<string>();
    const directLinks = new Set<string>();

    for (const link of currentGraphData.links) {
      const s = typeof link.source === 'object' ? String(link.source.id) : String(link.source);
      const t = typeof link.target === 'object' ? String(link.target.id) : String(link.target);
      const key = [s, t].sort().join('~');

      if (s === activeSelectedNodeId) {
        oneHop.add(t);
        directLinks.add(key);
      } else if (t === activeSelectedNodeId) {
        oneHop.add(s);
        directLinks.add(key);
      }
    }

    const twoHop = new Set<string>();
    const secondaryLinks = new Set<string>();

    for (const link of currentGraphData.links) {
      const s = typeof link.source === 'object' ? String(link.source.id) : String(link.source);
      const t = typeof link.target === 'object' ? String(link.target.id) : String(link.target);
      const key = [s, t].sort().join('~');

      if (directLinks.has(key)) continue;

      const sInOne = oneHop.has(s);
      const tInOne = oneHop.has(t);

      if (sInOne && !oneHop.has(t) && t !== activeSelectedNodeId) {
        twoHop.add(t);
        secondaryLinks.add(key);
      } else if (tInOne && !oneHop.has(s) && s !== activeSelectedNodeId) {
        twoHop.add(s);
        secondaryLinks.add(key);
      } else if (sInOne && tInOne) {
        secondaryLinks.add(key);
      }
    }

    return {
      oneHopNeighbors: oneHop,
      twoHopNeighbors: twoHop,
      directLinkKeys: directLinks,
      secondaryLinkKeys: secondaryLinks,
    };
  }, [activeSelectedNodeId, currentGraphData]);

  // Determine node hierarchical state
  const getNodeState = useCallback(
    (nodeId: string): 'hero' | 'one_hop' | 'two_hop' | 'dimmed' | 'normal' => {
      if (!activeSelectedNodeId) return 'normal';
      if (nodeId === activeSelectedNodeId) return 'hero';
      if (oneHopNeighbors.has(nodeId)) return 'one_hop';
      if (twoHopNeighbors.has(nodeId)) return 'two_hop';
      return 'dimmed';
    },
    [activeSelectedNodeId, oneHopNeighbors, twoHopNeighbors]
  );

  // Determine link hierarchical state
  const getLinkState = useCallback(
    (link: GraphLink): 'direct' | 'secondary' | 'dimmed' | 'normal' => {
      if (!activeSelectedNodeId) return 'normal';
      const key = linkKey(link);
      if (directLinkKeys.has(key)) return 'direct';
      if (secondaryLinkKeys.has(key)) return 'secondary';
      return 'dimmed';
    },
    [activeSelectedNodeId, directLinkKeys, secondaryLinkKeys]
  );

  // Effective graph data when Local Neighborhood mode is toggled ON
  const effectiveGraphData = useMemo(() => {
    if (!isolateLocalNetwork || !activeSelectedNodeId) {
      return currentGraphData;
    }
    const allowedNodeIds = new Set<string>([
      activeSelectedNodeId,
      ...Array.from(oneHopNeighbors),
      ...Array.from(twoHopNeighbors),
    ]);
    const filteredNodes = currentGraphData.nodes.filter((n) => allowedNodeIds.has(n.id));
    const filteredLinks = currentGraphData.links.filter((l) => {
      const sId = typeof l.source === 'object' ? l.source.id : String(l.source);
      const tId = typeof l.target === 'object' ? l.target.id : String(l.target);
      return allowedNodeIds.has(sId) && allowedNodeIds.has(tId);
    });
    return { nodes: filteredNodes, links: filteredLinks };
  }, [isolateLocalNetwork, activeSelectedNodeId, currentGraphData, oneHopNeighbors, twoHopNeighbors]);

  // Active labels layer: 1-hop connected neighbors (hero node is framed in 3D and in top status chip)
  const labeledNodes = useMemo(() => {
    if (hasHighlight) {
      return currentGraphData.nodes.filter((n) => isPathNode(n));
    }
    if (activeSelectedNodeId) {
      // Exclude selected hero node to prevent duplicate label & status bar collision
      return currentGraphData.nodes.filter(
        (n) => n.id !== activeSelectedNodeId && oneHopNeighbors.has(n.id)
      );
    }
    return [];
  }, [currentGraphData, activeSelectedNodeId, hasHighlight, isPathNode, oneHopNeighbors]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
        }
      }
    };
    updateSize();
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    setCurrentGraphData(resolvedGraphData);
    hasAutoFit.current = false;
  }, [resolvedGraphData]);

  // =========================================================================
  // 3D FORCE SIMULATION TUNING (EXPANSIVE ORGANIC 3D NETWORK CLUSTER)
  // =========================================================================
  useEffect(() => {
    if (fgRef.current && !hasError) {
      const engine = fgRef.current.d3Force;
      if (engine) {
        // 1. Link distance based on relationship type — enlarged spacing for big visual impact
        const linkForce = engine('link');
        if (linkForce) {
          linkForce.distance((link: any) => {
            const type = (link.relationship_type || link.relationship || '').toUpperCase();
            if (type.includes('USED') || type.includes('LINKED')) return 110;
            if (type.includes('COMMUNICATION') || type.includes('CDR')) return 130;
            if (type.includes('FINANCIAL')) return 150;
            if (type.includes('2 FIR') || type.includes('3 FIR')) return 135;
            if (type.includes('KNOWS') || type.includes('ASSOCIATED') || type.includes('GANG')) return 180;
            return 140;
          });
          linkForce.strength(0.35);
        }

        // 2. Stronger repulsion spreads nodes into a big, expansive 3D galaxy
        const chargeForce = engine('charge');
        if (chargeForce) {
          chargeForce.strength(suspectOffenderNexus ? -420 : -380);
        }

        // 3. Gentle center force keeps the cluster centered without collapsing
        const centerForce = engine('center');
        if (centerForce) {
          centerForce.strength(0.04);
        }
      }
    }
  }, [hasError, currentGraphData, suspectOffenderNexus]);

  // Initial camera framing: frame connected core network so the graph fills the screen
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (currentGraphData.nodes.length > 0 && !hasAutoFit.current && fgRef.current && !hasError) {
      hasAutoFit.current = true;
      // Immediately place camera close so the graph is big and prominent
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 380 }, { x: 0, y: 0, z: 0 }, 0);
      setTimeout(() => {
        if (fgRef.current && !activeSelectedNodeId) {
          // Zoom to fit connected core nodes (degree >= 2), preventing isolated outliers from shrinking the view
          fgRef.current.zoomToFit(700, 35, (node: any) => (degreeMap[node.id] || 0) >= 2);
        }
      }, 1400);
    }
  }, [currentGraphData, hasError, activeSelectedNodeId, degreeMap]);

  // Smoothly center and frame the neighborhood whenever activeSelectedNodeId changes
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      activeSelectedNodeId &&
      activeSelectedNodeId !== prevSelectedIdRef.current &&
      fgRef.current &&
      !hasError
    ) {
      prevSelectedIdRef.current = activeSelectedNodeId;
      const neighborIds = new Set<string>([String(activeSelectedNodeId)]);
      for (const link of currentGraphData.links) {
        const s = typeof link.source === 'object' ? String(link.source.id) : String(link.source);
        const t = typeof link.target === 'object' ? String(link.target.id) : String(link.target);
        if (s === String(activeSelectedNodeId)) neighborIds.add(t);
        if (t === String(activeSelectedNodeId)) neighborIds.add(s);
      }
      if (neighborIds.size > 1 && fgRef.current.zoomToFit) {
        fgRef.current.zoomToFit(800, 60, (n: any) => neighborIds.has(String(n.id)));
      } else {
        const node = currentGraphData.nodes.find((n) => n.id === activeSelectedNodeId);
        if (node && fgRef.current.cameraPosition) {
          const target = { x: Number(node.x) || 0, y: Number(node.y) || 0, z: Number(node.z) || 0 };
          fgRef.current.cameraPosition({ x: target.x, y: target.y + 24, z: target.z + 240 }, target, 800);
        }
      }
    } else if (!activeSelectedNodeId) {
      prevSelectedIdRef.current = null;
    }
  }, [activeSelectedNodeId, currentGraphData, hasError]);

  // Node Clicked Action — smoothly frames clicked node and all its direct connections
  const handleNodeClick = (node: any) => {
    setInternalSelectedNodeId(node.id);
    const fullNode = currentGraphData.nodes.find((n) => n.id === node.id);
    if (fullNode) {
      onNodeSelect?.(fullNode);
    }

    // Collect all 1-hop connected neighbors
    const neighborIds = new Set<string>([String(node.id)]);
    for (const link of currentGraphData.links) {
      const s = typeof link.source === 'object' ? String(link.source.id) : String(link.source);
      const t = typeof link.target === 'object' ? String(link.target.id) : String(link.target);
      if (s === String(node.id)) neighborIds.add(t);
      if (t === String(node.id)) neighborIds.add(s);
    }

    if (fgRef.current) {
      // Zoom to fit the entire connected neighborhood (clicked node + all direct ties) perfectly in view
      if (neighborIds.size > 1 && fgRef.current.zoomToFit) {
        fgRef.current.zoomToFit(800, 60, (n: any) => neighborIds.has(String(n.id)));
      } else if (fgRef.current.cameraPosition) {
        const target = {
          x: Number(node.x) || 0,
          y: Number(node.y) || 0,
          z: Number(node.z) || 0,
        };
        fgRef.current.cameraPosition(
          {
            x: target.x,
            y: target.y + 24,
            z: target.z + 240,
          },
          target,
          800
        );
      }
    }
  };

  // Background Clicked Action — deselects and returns to full view
  const handleBackgroundClick = () => {
    setInternalSelectedNodeId(null);
    setIsolateLocalNetwork(false);
    onClearSelection?.();
  };

  // Link Clicked Action
  const handleLinkClick = (link: any) => {
    if (onLinkSelect) {
      onLinkSelect(link);
    }
  };

  // Center camera on the currently selected node and its neighborhood
  const handleCenterSelected = useCallback(() => {
    if (!activeSelectedNodeId || !fgRef.current || hasError) return;
    const neighborIds = new Set<string>([String(activeSelectedNodeId)]);
    for (const link of currentGraphData.links) {
      const s = typeof link.source === 'object' ? String(link.source.id) : String(link.source);
      const t = typeof link.target === 'object' ? String(link.target.id) : String(link.target);
      if (s === String(activeSelectedNodeId)) neighborIds.add(t);
      if (t === String(activeSelectedNodeId)) neighborIds.add(s);
    }
    if (neighborIds.size > 1 && fgRef.current.zoomToFit) {
      fgRef.current.zoomToFit(700, 60, (n: any) => neighborIds.has(String(n.id)));
    } else {
      const node = currentGraphData.nodes.find((n) => n.id === activeSelectedNodeId);
      if (node && fgRef.current.cameraPosition) {
        const target = { x: Number(node.x) || 0, y: Number(node.y) || 0, z: Number(node.z) || 0 };
        fgRef.current.cameraPosition({ x: target.x, y: target.y + 24, z: target.z + 240 }, target, 700);
      }
    }
  }, [activeSelectedNodeId, currentGraphData, hasError]);

  // Fit all connected nodes smoothly within viewport
  const handleFitView = useCallback(() => {
    if (fgRef.current && !hasError) {
      fgRef.current.zoomToFit(600, 30, (node: any) => (degreeMap[node.id] || 0) >= 2);
    }
  }, [hasError, degreeMap]);

  // Reset view and deselect
  const handleResetView = useCallback(() => {
    setInternalSelectedNodeId(null);
    setIsolateLocalNetwork(false);
    onClearSelection?.();
    if (fgRef.current && !hasError) {
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 380 }, { x: 0, y: 0, z: 0 }, 700);
      setTimeout(() => {
        fgRef.current?.zoomToFit(600, 30, (node: any) => (degreeMap[node.id] || 0) >= 2);
      }, 750);
    }
  }, [onClearSelection, hasError, degreeMap]);

  // Color matching for nodes
  const getNodeColor = (cat: string) => {
    switch ((cat || '').toLowerCase()) {
      case 'suspect': return '#EF4444';
      case 'offender': return '#F97316';
      case 'cdr': return '#06B6D4';
      case 'financial_transaction': return '#F59E0B';
      case 'surveillance_report': return '#A855F7';
      case 'social_media_intel': return '#3B82F6';
      case 'location': return '#0EA5E9';
      case 'case': return '#10B981';
      case 'victim': return '#64748B';
      case 'officer': return '#14C997';
      case 'organization': return '#8B5CF6';
      case 'gang': return '#EC4899';
      case 'vehicle': return '#38BDF8';
      case 'weapon': return '#F43F5E';
      default: return '#8B5CF6';
    }
  };

  // Color matching for criminal ties, syndicate relationships & intelligence sources
  const getLinkColor = (link: GraphLink) => {
    const rel = (link.relationship || '').toUpperCase();
    const relType = (link.relationship_type || '').toUpperCase();

    // 1. High-Threat Multi-FIR Repeat Co-accused (Crimson & Vivid Rose)
    if (rel.includes('3 FIR') || rel.includes('CO-ACCUSED IN 3')) {
      return '#EF4444'; // Bright Crimson Red
    }
    if (rel.includes('2 FIR') || rel.includes('CO-ACCUSED IN 2')) {
      return '#F43F5E'; // Vivid Rose / Neon Coral
    }

    // 2. Specific Gang Syndicates (Rich distinct colors matching the 3D aesthetic)
    if (rel.includes('EXTORTION') || rel.includes('DIGITAL EXTORTION')) {
      return '#EC4899'; // Vibrant Pink / Magenta
    }
    if (rel.includes('NARCOTICS') || rel.includes('DRUG') || rel.includes('KONKAN')) {
      return '#10B981'; // Vivid Emerald Green
    }
    if (rel.includes('SNATCHER') || rel.includes('WHITEFIELD') || rel.includes('ROBBERY')) {
      return '#F97316'; // Vivid Amber-Orange
    }
    if (rel.includes('LAND') || rel.includes('DECCAN') || rel.includes('MAFIA')) {
      return '#A855F7'; // Electric Purple
    }
    if (relType === 'GANG_ASSOCIATE' || rel.includes('SYNDICATE') || rel.includes('GANG')) {
      return '#8B5CF6'; // Bright Violet
    }

    // 3. Single FIR Co-accused (Electric Cyan)
    if (rel.includes('CO-ACCUSED') || relType === 'SHARED_CASE') {
      return isLight ? 'rgba(8, 145, 178, 0.9)' : '#06B6D4'; // Electric Cyan
    }

    // 4. Intelligence Modality Links
    if (relType === 'COMMUNICATION' || rel.includes('CDR') || rel.includes('CALL')) {
      return isLight ? 'rgba(8, 145, 178, 0.85)' : '#00F0FF'; // Neon Cyan
    }
    if (relType === 'FINANCIAL' || rel.includes('TRANSACTION') || rel.includes('TXN')) {
      return isLight ? 'rgba(217, 119, 6, 0.85)' : '#FFB703'; // Bright Amber Gold
    }
    if (relType === 'SURVEILLANCE' || rel.includes('SURVEILLANCE') || rel.includes('CCTV')) {
      return isLight ? 'rgba(147, 51, 234, 0.85)' : '#C084FC'; // Luminous Purple
    }
    if (relType === 'SOCIAL_DIGITAL' || rel.includes('SOCIAL') || rel.includes('CYBER')) {
      return isLight ? 'rgba(37, 99, 235, 0.85)' : '#60A5FA'; // Bright Sky Blue
    }

    // 5. Verification Status Fallbacks
    if (link.verification_status === 'VERIFIED' || link.provenance === 'DIRECT_DATABASE') {
      return isLight ? 'rgba(5, 150, 105, 0.85)' : 'rgba(16, 185, 129, 0.85)';
    }
    if (link.verification_status === 'POTENTIAL' || link.provenance === 'ANALYTICAL_INFERENCE') {
      return isLight ? 'rgba(217, 119, 6, 0.85)' : 'rgba(245, 158, 11, 0.85)';
    }
    if (link.is_demo_derived || link.provenance === 'DEMO_SEED' || link.provenance === 'MIXED') {
      return isLight ? 'rgba(124, 58, 237, 0.75)' : 'rgba(168, 85, 247, 0.75)';
    }
    return isLight ? 'rgba(100, 116, 139, 0.55)' : 'rgba(148, 163, 184, 0.50)';
  };

  const getDirectLinkColor = (link: GraphLink): string => {
    const rel = (link.relationship || '').toUpperCase();
    const relType = (link.relationship_type || '').toUpperCase();
    if (rel.includes('3 FIR') || rel.includes('CO-ACCUSED IN 3')) return '#EF4444';
    if (rel.includes('2 FIR') || rel.includes('CO-ACCUSED IN 2')) return '#F43F5E';
    if (rel.includes('EXTORTION')) return '#EC4899';
    if (rel.includes('NARCOTICS') || rel.includes('KONKAN')) return '#10B981';
    if (rel.includes('SNATCHER') || rel.includes('WHITEFIELD')) return '#F97316';
    if (rel.includes('DECCAN') || rel.includes('LAND')) return '#A855F7';
    if (relType === 'COMMUNICATION' || rel.includes('CDR') || rel.includes('CALL')) {
      return '#00F0FF'; // Electric Cyan
    }
    if (relType === 'FINANCIAL' || rel.includes('TRANSACTION')) {
      return '#FFB703'; // Bright Amber Gold
    }
    if (relType === 'SURVEILLANCE' || rel.includes('CCTV')) {
      return '#C084FC'; // Electric Purple
    }
    if (relType === 'SOCIAL_DIGITAL' || rel.includes('SOCIAL')) {
      return '#60A5FA'; // Bright Sky Blue
    }
    return '#38BDF8';
  };

  // Node 3D Glass Object with Investigation Focus Mode Visual Hierarchy
  const nodeThreeObject = useCallback(
    (node: any) => {
      const cat = (node.category || 'default').toLowerCase();
      const geom = GEOMETRIES[cat] || GEOMETRIES.default;
      const isPath = hasHighlight && isPathNode(node);

      let state: 'hero' | 'one_hop' | 'two_hop' | 'dimmed' | 'normal' = 'normal';
      if (hasHighlight) {
        state = isPath ? 'hero' : 'dimmed';
      } else if (activeSelectedNodeId) {
        state = getNodeState(node.id);
      }

      const mat = isPath
        ? PATH_MATERIALS
        : getNodeMaterials(cat, state, isLight);

      const group = new THREE.Group();

      const outerMesh = new THREE.Mesh(geom.outer, mat.outer);
      const innerMesh = new THREE.Mesh(geom.inner, mat.inner);

      // Distinct geometric rotations
      if (cat === 'cdr') {
        outerMesh.rotation.x = Math.PI / 3;
        outerMesh.rotation.z = Math.PI / 6;
        innerMesh.rotation.x = Math.PI / 3;
        innerMesh.rotation.z = Math.PI / 6;
      } else if (cat === 'social_media_intel') {
        outerMesh.rotation.x = Math.PI / 4;
        outerMesh.rotation.y = Math.PI / 8;
        innerMesh.rotation.x = Math.PI / 4;
        innerMesh.rotation.y = Math.PI / 8;
      } else if (cat === 'financial_transaction') {
        outerMesh.rotation.y = Math.PI / 4;
        innerMesh.rotation.y = Math.PI / 4;
      }

      group.add(outerMesh);
      group.add(innerMesh);

      // Luminous dual orbital rings on Hero / Selected node
      if (state === 'hero') {
        const ringMesh = new THREE.Mesh(HERO_HALO_GEOMETRY, HERO_HALO_MATERIAL);
        ringMesh.rotation.x = Math.PI / 2;
        group.add(ringMesh);

        const outerRing = new THREE.Mesh(HERO_OUTER_RING_GEOM, HERO_OUTER_RING_MAT);
        outerRing.rotation.x = Math.PI / 3;
        outerRing.rotation.y = Math.PI / 6;
        group.add(outerRing);
      }

      // Hierarchy and degree centrality scaling
      const deg = degreeMap[node.id] || 0;
      const isPerson = cat === 'suspect' || cat === 'offender' || cat === 'gang';

      let scaleMultiplier = 1.0;
      if (state === 'hero') {
        scaleMultiplier = 1.55;
      } else if (state === 'one_hop') {
        scaleMultiplier = 1.30;
      } else if (state === 'two_hop') {
        scaleMultiplier = 0.80;
      } else if (state === 'dimmed') {
        scaleMultiplier = 0.35;
      }

      const baseScale = isPerson
        ? 1.05 + Math.min(deg * 0.04, 0.45)
        : 0.95 + Math.min(deg * 0.03, 0.30);

      const finalScale = baseScale * scaleMultiplier;
      group.scale.set(finalScale, finalScale, finalScale);

      return group;
    },
    [activeSelectedNodeId, hasHighlight, isPathNode, getNodeState, degreeMap, isLight]
  );

  // Slow orbital rotation when idle (stops while interacting or focusing)
  useEffect(() => {
    if (fgRef.current && !hasError) {
      const controls = fgRef.current.controls();
      if (controls) {
        controls.autoRotate = !activeSelectedNodeId;
        controls.autoRotateSpeed = 0.50;
      }
    }
  }, [hasError, activeSelectedNodeId]);

  const activeSelectedNode = useMemo(() => {
    if (!activeSelectedNodeId) return null;
    return currentGraphData.nodes.find((n) => n.id === activeSelectedNodeId) ?? null;
  }, [activeSelectedNodeId, currentGraphData]);

  return (
    <div
      className="w-full h-full relative bg-[var(--bg-surface)] rounded-card border border-border-color flex flex-col justify-between overflow-hidden select-none"
      style={{ minHeight: '740px' }}
    >
      {/* TOP STATUS OVERLAY */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)]/90 backdrop-blur-md border border-[var(--border-color)] rounded-btn text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)] shadow-lg">
          <span>{effectiveGraphData.nodes.length} NODES</span>
          <span className="text-[var(--border-color)]">/</span>
          <span>{effectiveGraphData.links.length} EDGES</span>
          <span className="ml-2 text-[var(--text-disabled)] hidden sm:inline">&bull; CLICK NODE &rarr; DOSSIER</span>

          {suspectOffenderNexus && (
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold tracking-wider">
              <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
              SUSPECT &harr; OFFENDER NEXUS
              {onToggleSuspectOffenderNexus && (
                <button
                  onClick={onToggleSuspectOffenderNexus}
                  className="hover:text-red-400 p-0.5 ml-0.5 cursor-pointer transition-colors"
                  title="Exit Suspect-Offender Nexus Mode"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          )}

          {hasHighlight && (
            <span className="ml-2 inline-flex items-center gap-1 text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
              PATH HIGHLIGHT
            </span>
          )}

          {activeSelectedNode && (
            <span className="ml-2 inline-flex items-center gap-1.5 text-sky-300 border-l border-[var(--border-color)] pl-2">
              <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
              TARGET: <b className="text-white truncate max-w-[130px]">{activeSelectedNode.name}</b>
              <span className="text-[8px] text-sky-400 font-bold">({oneHopNeighbors.size} CONNECTIONS)</span>
              <button
                onClick={handleResetView}
                className="hover:text-red-400 p-0.5 ml-1 cursor-pointer transition-colors"
                title="Exit Focus Mode"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* GRAPH VIEWPORT */}
      <div ref={containerRef} className="flex-1 w-full h-full relative" style={{ minHeight: '720px' }}>
        {hasError ? (
          <GraphFallback
            onNodeSelect={onNodeSelect}
            onLinkSelect={onLinkSelect}
            isLight={isLight}
            graphData={currentGraphData}
          />
        ) : (
          <ErrorBoundary
            fallback={
              <GraphFallback
                onNodeSelect={onNodeSelect}
                onLinkSelect={onLinkSelect}
                isLight={isLight}
                graphData={currentGraphData}
              />
            }
            onError={() => setHasError(true)}
          >
            <ForceGraph3D
              ref={fgRef}
              graphData={effectiveGraphData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor={canvasBg}
              showNavInfo={false}
              nodeThreeObject={nodeThreeObject}
              nodeLabel={(node: any) => {
                const cat = (node.category || 'entity').toLowerCase();
                const color = getNodeColor(node.category);
                const deg = degreeMap[node.id] || 0;
                const isSelected = node.id === activeSelectedNodeId;
                const is1Hop = oneHopNeighbors.has(node.id);

                const badgeStyle = `display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;background:${color}22;color:${color};border:1px solid ${color}66;`;

                let relationTag = '';
                if (isSelected) {
                  relationTag = `<span style="background:rgba(56,189,248,0.25);color:#38bdf8;border:1px solid #38bdf8;font-size:8.5px;padding:1px 5px;border-radius:3px;font-weight:bold;letter-spacing:0.05em;">TARGET HERO</span>`;
                } else if (is1Hop) {
                  relationTag = `<span style="background:rgba(16,185,129,0.25);color:#34d399;border:1px solid #10b981;font-size:8.5px;padding:1px 5px;border-radius:3px;font-weight:bold;letter-spacing:0.05em;">DIRECT LINK</span>`;
                }

                const risk = node.riskScore ?? 0;
                const riskColor = risk >= 75 ? '#ef4444' : risk >= 50 ? '#f59e0b' : '#10b981';

                let specificDetails = '';
                if (cat === 'cdr') {
                  specificDetails = `
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-top:2px;">
                      <span>TELEMETRY:</span>
                      <span style="color:#67e8f9;font-weight:600;">${node.phone || node.name.replace(/^CDR:\s*/, '')}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;">
                      <span>CALL TYPE:</span>
                      <span style="color:#e2e8f0;">Active Cellular CDR</span>
                    </div>
                    ${node.date ? `<div style="display:flex;justify-content:space-between;color:#94a3b8;"><span>LOGGED:</span><span style="color:#cbd5e1;">${new Date(node.date).toLocaleString()}</span></div>` : ''}
                  `;
                } else if (cat === 'financial_transaction') {
                  specificDetails = `
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-top:2px;">
                      <span>LEDGER:</span>
                      <span style="color:#fde68a;font-weight:600;">${node.name}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;">
                      <span>STATUS:</span>
                      <span style="color:#e2e8f0;">${node.status || 'Verified Ledger'}</span>
                    </div>
                    ${node.date ? `<div style="display:flex;justify-content:space-between;color:#94a3b8;"><span>TIMESTAMP:</span><span style="color:#cbd5e1;">${node.date}</span></div>` : ''}
                  `;
                } else if (cat === 'surveillance_report') {
                  specificDetails = `
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-top:2px;">
                      <span>SURVEILLANCE:</span>
                      <span style="color:#d8b4fe;font-weight:600;">${node.name}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;">
                      <span>DISTRICT:</span>
                      <span style="color:#e2e8f0;">${node.district || 'Unassigned'}</span>
                    </div>
                    ${node.date ? `<div style="display:flex;justify-content:space-between;color:#94a3b8;"><span>LOGGED:</span><span style="color:#cbd5e1;">${new Date(node.date).toLocaleString()}</span></div>` : ''}
                  `;
                } else if (cat === 'social_media_intel') {
                  specificDetails = `
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-top:2px;">
                      <span>CHANNEL:</span>
                      <span style="color:#93c5fd;font-weight:600;">Cyber / OSINT</span>
                    </div>
                    ${node.district ? `<div style="display:flex;justify-content:space-between;color:#94a3b8;"><span>DISTRICT:</span><span style="color:#e2e8f0;">${node.district}</span></div>` : ''}
                  `;
                } else {
                  specificDetails = `
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-top:2px;">
                      <span>AFFILIATION:</span>
                      <span style="color:#e2e8f0;">${node.gangAffiliation || 'Independent'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;">
                      <span>CASES RECORDED:</span>
                      <span style="color:#e2e8f0;">${node.casesCount ?? 0}</span>
                    </div>
                    ${node.district ? `<div style="display:flex;justify-content:space-between;color:#94a3b8;"><span>DISTRICT:</span><span style="color:#e2e8f0;">${node.district}</span></div>` : ''}
                  `;
                }

                return `
                  <div style="
                    background: rgba(11, 17, 32, 0.94);
                    border: 1px solid ${isSelected ? 'rgba(56,189,248,0.7)' : 'rgba(255, 255, 255, 0.18)'};
                    border-radius: 9px;
                    padding: 9px 13px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 11px;
                    line-height: 1.4;
                    box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.75), 0 0 18px ${color}40;
                    backdrop-filter: blur(12px);
                    min-width: 240px;
                    max-width: 320px;
                    pointer-events: none;
                  ">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:5px;">
                      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        <b style="color:#f8fafc;font-size:12.5px;">${node.name}</b>
                      </div>
                      <div style="display:flex;align-items:center;gap:4px;">
                        ${relationTag}
                        <span style="${badgeStyle}">${cat.replace(/_/g, ' ')}</span>
                      </div>
                    </div>

                    <!-- Risk Score Bar -->
                    <div style="margin-bottom:6px;">
                      <div style="display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:2px;">
                        <span style="color:#94a3b8;">THREAT RISK SCORE:</span>
                        <span style="color:${riskColor};font-weight:700;">${risk}%</span>
                      </div>
                      <div style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
                        <div style="width:${Math.min(risk, 100)}%;height:100%;background:${riskColor};box-shadow:0 0 6px ${riskColor};"></div>
                      </div>
                    </div>

                    <!-- Degree / Direct Connections -->
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:10px;margin-bottom:4px;">
                      <span>DIRECT CONNECTIONS:</span>
                      <span style="color:#38bdf8;font-weight:700;">${deg} node${deg === 1 ? '' : 's'}</span>
                    </div>

                    <!-- Specific entity intelligence -->
                    <div style="font-size:9.5px;border-top:1px dashed rgba(255,255,255,0.1);padding-top:4px;">
                      ${specificDetails}
                    </div>
                  </div>
                `;
              }}
              linkLabel={(link: any) => {
                const l = link as GraphLink;
                const provenance = l.provenance || 'DIRECT_DATABASE';
                const status = l.verification_status || 'VERIFIED';
                const relColor = getLinkColor(l);
                const isDirect = activeSelectedNodeId ? getLinkState(l) === 'direct' : false;

                return `
                  <div style="
                    background: rgba(11, 17, 32, 0.94);
                    border: 1px solid ${isDirect ? 'rgba(56,189,248,0.7)' : 'rgba(255, 255, 255, 0.15)'};
                    border-radius: 8px;
                    padding: 7px 11px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 10px;
                    line-height: 1.4;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.6), 0 0 12px ${relColor}33;
                    backdrop-filter: blur(10px);
                    pointer-events: none;
                    min-width: 180px;
                  ">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:3px;">
                      <b style="color:#f8fafc;font-size:11px;">${(l.relationship || 'RELATIONSHIP').toUpperCase()}</b>
                      ${isDirect ? '<span style="background:rgba(56,189,248,0.2);color:#38bdf8;border:1px solid #38bdf8;font-size:8px;padding:1px 4px;border-radius:3px;">DIRECT EDGE</span>' : ''}
                    </div>
                    <div style="color:${relColor};font-weight:600;font-size:9px;">
                      ${provenance.replace(/_/g, ' ')} &bull; ${status.replace(/_/g, ' ')}
                    </div>
                    ${l.weight !== undefined && l.weight !== null ? `<div style="color:#94a3b8;font-size:9px;margin-top:2px;">Signal Strength: <b style="color:#cbd5e1;">${l.weight}</b></div>` : ''}
                  </div>
                `;
              }}
              // Curved edges prevent overlapping lines without creating polygon wedges
              linkCurvature={0.16}
              linkColor={(link: any) => {
                const l = link as GraphLink;
                if (hasHighlight) {
                  if (isPathLink(l)) return '#22D3EE';
                  return isLight ? 'rgba(100, 116, 139, 0.05)' : 'rgba(148, 163, 184, 0.05)';
                }
                if (activeSelectedNodeId) {
                  const state = getLinkState(l);
                  if (state === 'direct') {
                    return getDirectLinkColor(l);
                  } else if (state === 'secondary') {
                    return isLight ? 'rgba(56, 189, 248, 0.20)' : 'rgba(56, 189, 248, 0.20)';
                  } else {
                    return isLight ? 'rgba(100, 116, 139, 0.02)' : 'rgba(148, 163, 184, 0.02)';
                  }
                }
                return getLinkColor(l);
              }}
              linkWidth={(link: any) => {
                const l = link as GraphLink;
                if (hasHighlight) {
                  return isPathLink(l) ? 4.5 : 0.4;
                }
                if (activeSelectedNodeId) {
                  const state = getLinkState(l);
                  if (state === 'direct') return 4.8;
                  if (state === 'secondary') return 1.2;
                  return 0.08;
                }
                if (suspectOffenderNexus) {
                  const rel = (l.relationship || '').toUpperCase();
                  if (rel.includes('2 FIR') || rel.includes('3 FIR') || rel.includes('SYNDICATE')) {
                    return 3.4;
                  }
                  return 2.4;
                }
                return l.verification_status === 'VERIFIED' ? 2.2 : 1.4;
              }}
              linkDirectionalParticles={(link: any) => {
                const l = link as GraphLink;
                if (hasHighlight) {
                  return isPathLink(l) ? 5 : 0;
                }
                if (activeSelectedNodeId) {
                  const state = getLinkState(l);
                  if (state === 'direct') return 5;
                  return 0;
                }
                if (suspectOffenderNexus) {
                  return 2;
                }
                return l.verification_status === 'POTENTIAL' ? 2 : 1;
              }}
              linkDirectionalParticleSpeed={(link: any) => {
                if (activeSelectedNodeId && getLinkState(link as GraphLink) === 'direct') return 0.012;
                return 0.008;
              }}
              linkDirectionalParticleWidth={(link: any) => {
                const l = link as GraphLink;
                if (hasHighlight && isPathLink(l)) return 4.0;
                if (activeSelectedNodeId && getLinkState(l) === 'direct') return 4.5;
                if (suspectOffenderNexus) return 2.8;
                return 2.0;
              }}
              linkDirectionalParticleColor={(link: any) => {
                const l = link as GraphLink;
                if (activeSelectedNodeId && getLinkState(l) === 'direct') {
                  return getDirectLinkColor(l);
                }
                if (suspectOffenderNexus) {
                  return getLinkColor(l);
                }
                return '#38BDF8';
              }}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              cooldownTime={15000}
              warmupTicks={50}
              rendererConfig={{ antialias: true, alpha: true }}
              onNodeClick={handleNodeClick}
              onBackgroundClick={handleBackgroundClick}
              onLinkClick={handleLinkClick}
              onEngineStop={() => {
                if (fgRef.current && !hasError && !activeSelectedNodeId) {
                  fgRef.current.zoomToFit(600, 30, (node: any) => (degreeMap[node.id] || 0) >= 2);
                }
              }}
            />
          </ErrorBoundary>
        )}

        {/* Permanent HUD labels for Hero Node and 1-Hop Connected Neighbors */}
        <NodePinOverlay
          fgRef={fgRef}
          nodes={labeledNodes}
          selectedNodeId={activeSelectedNodeId}
        />

        {/* Multi-source Intelligence & Provenance Legend overlay — collapsible */}
        <div
          className={`absolute bottom-4 left-4 z-20 bg-[#0B1120]/90 backdrop-blur-md border border-[#334155] rounded-card shadow-2xl font-mono select-none pointer-events-auto transition-all duration-200 ${
            legendOpen ? 'p-3 w-[240px]' : 'p-1.5 w-auto'
          }`}
        >
          <button
            onClick={() => setLegendOpen((v) => !v)}
            className="flex items-center gap-1.5 cursor-pointer text-[8px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-emerald-400 transition-colors"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ${
                legendOpen ? '' : 'mr-0.5'
              }`}
            />
            Legend
            {legendOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>

          {legendOpen && (
            <>
              {suspectOffenderNexus ? (
                <>
                  {/* Suspect-Offender Entities */}
                  <div className="border-t border-[#1E293B] pt-2 mt-2 flex flex-col gap-1.5">
                    <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-amber-400" /> Suspect &harr; Offender Nexus
                    </span>

                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      <div className="flex items-center gap-1.5 bg-[#0F172A] px-1.5 py-1 rounded border border-[#1E293B]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.8)] shrink-0" />
                        <span className="text-slate-200 truncate font-semibold">Suspect</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0F172A] px-1.5 py-1 rounded border border-[#1E293B]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] shadow-[0_0_6px_rgba(249,115,22,0.8)] shrink-0" />
                        <span className="text-slate-200 truncate font-semibold">Offender</span>
                      </div>
                    </div>
                  </div>

                  {/* Suspect-Offender Connection Legend */}
                  <div className="border-t border-[#1E293B] pt-2 mt-2 flex flex-col gap-1">
                    <span className="text-[8px] font-bold text-[#94A3B8] uppercase tracking-wider">
                      Criminal Relationship Ties
                    </span>
                    <div className="flex flex-col gap-1 text-[8.5px]">
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-[#EF4444] rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        <span className="text-red-400 font-semibold">Co-accused (2+ FIRs)</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-[#06B6D4] rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                        <span className="text-cyan-300 font-semibold">Co-accused (1 FIR)</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-[#EC4899] rounded-full shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                        <span className="text-pink-300 font-semibold">Digital Extortion Syndicate</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-[#10B981] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <span className="text-emerald-300 font-semibold">Konkan Narcotics Cartel</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-[#F97316] rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                        <span className="text-orange-300 font-semibold">Chain Snatchers Ring</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-[#A855F7] rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        <span className="text-purple-300 font-semibold">Deccan Land Mafia</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Entity Shapes Section */}
                  <div className="border-t border-[#1E293B] pt-2 mt-2 flex flex-col gap-1.5">
                    <span className="text-[8px] font-bold text-[#94A3B8] uppercase tracking-wider">
                      Multi-Source Entities
                    </span>

                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      <div className="flex items-center gap-1.5 bg-[#0F172A] px-1.5 py-1 rounded border border-[#1E293B]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.8)] shrink-0" />
                        <span className="text-slate-200 truncate">Suspect</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0F172A] px-1.5 py-1 rounded border border-[#1E293B]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] shadow-[0_0_6px_rgba(249,115,22,0.8)] shrink-0" />
                        <span className="text-slate-200 truncate">Offender</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0F172A] px-1.5 py-1 rounded border border-[#1E293B]">
                        <svg className="w-2.5 h-2.5 text-[#06B6D4] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                          <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" />
                        </svg>
                        <span className="text-cyan-300 truncate">CDR (Hex)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0F172A] px-1.5 py-1 rounded border border-[#1E293B]">
                        <svg className="w-2.5 h-2.5 text-[#F59E0B] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                          <polygon points="8,1 15,8 8,15 1,8" />
                        </svg>
                        <span className="text-amber-300 truncate">Financial</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0F172A] px-1.5 py-1 rounded border border-[#1E293B]">
                        <svg className="w-2.5 h-2.5 text-[#A855F7] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
                        </svg>
                        <span className="text-purple-300 truncate">Surveillance</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0F172A] px-1.5 py-1 rounded border border-[#1E293B]">
                        <svg className="w-2.5 h-2.5 text-[#3B82F6] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                          <polygon points="5,1.5 11,1.5 14.5,5 14.5,11 11,14.5 5,14.5 1.5,11 1.5,5" />
                        </svg>
                        <span className="text-blue-300 truncate">Social Intel</span>
                      </div>
                    </div>
                  </div>

                  {/* Relationship Links Section */}
                  <div className="border-t border-[#1E293B] pt-2 mt-2 flex flex-col gap-1">
                    <span className="text-[8px] font-bold text-[#94A3B8] uppercase tracking-wider">
                      Relationship Provenance
                    </span>
                    <div className="flex flex-col gap-1 text-[8.5px]">
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <span className="text-emerald-300 font-semibold">Direct Fact (Verified)</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 border-t-2 border-dashed border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                        <span className="text-amber-300 font-semibold">Analytical Lead (Potential)</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                        <span className="text-cyan-300 font-semibold">Communication (CDR)</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                        <span className="text-amber-300 font-semibold">Financial Link</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        <span className="text-purple-300 font-semibold">Surveillance Report</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0F172A] px-2 py-0.5 rounded border border-[#1E293B]">
                        <span className="w-3.5 h-1 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        <span className="text-blue-300 font-semibold">Social / Digital Intel</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-[#1E293B] pt-2 mt-2 flex items-center gap-2 bg-[#0F172A] px-2 py-1 rounded border border-[#1E293B]">
                <span className="text-[8px] text-[#94A3B8]">
                  {effectiveGraphData.nodes.length} nodes, {effectiveGraphData.links.length} edges
                </span>
              </div>
            </>
          )}
        </div>

        {/* FLOATING GLASS CONTROL BAR */}
        <div className="absolute bottom-4 right-4 z-20 pointer-events-auto select-none">
          <div className="flex items-center gap-1 p-1 bg-[#0B1120]/85 backdrop-blur-md border border-[#334155]/80 rounded-xl shadow-2xl">
            {/* Zoom In */}
            <button
              onClick={() => {
                if (fgRef.current) {
                  const pos = fgRef.current.cameraPosition();
                  if (pos) {
                    const scale = 0.72;
                    fgRef.current.cameraPosition(
                      { x: pos.x * scale, y: pos.y * scale, z: pos.z * scale },
                      undefined,
                      350
                    );
                  }
                }
              }}
              title="Zoom in (+)"
              className="p-2 bg-[var(--bg-tertiary)] hover:bg-sky-500/20 border border-border-color hover:border-sky-500/40 rounded-lg text-[var(--text-secondary)] hover:text-sky-300 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Zoom Out */}
            <button
              onClick={() => {
                if (fgRef.current) {
                  const pos = fgRef.current.cameraPosition();
                  if (pos) {
                    const scale = 1.38;
                    fgRef.current.cameraPosition(
                      { x: pos.x * scale, y: pos.y * scale, z: pos.z * scale },
                      undefined,
                      350
                    );
                  }
                }
              }}
              title="Zoom out (-)"
              className="p-2 bg-[var(--bg-tertiary)] hover:bg-sky-500/20 border border-border-color hover:border-sky-500/40 rounded-lg text-[var(--text-secondary)] hover:text-sky-300 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* Fit Network (Focuses on connected graph) */}
            <button
              onClick={handleFitView}
              title="Fit connected network in view"
              className="p-2 bg-[var(--bg-tertiary)] hover:bg-sky-500/20 border border-border-color hover:border-sky-500/40 rounded-lg text-[var(--text-secondary)] hover:text-sky-300 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Focus Selected Node & Connections */}
            <button
              onClick={handleCenterSelected}
              disabled={!activeSelectedNodeId}
              title={
                activeSelectedNodeId
                  ? 'Center & Frame selected target and its connections'
                  : 'Select a node to frame its connections'
              }
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                activeSelectedNodeId
                  ? 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/50 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                  : 'bg-[var(--bg-tertiary)]/50 border-border-color/40 text-[var(--text-disabled)] cursor-not-allowed opacity-50'
              }`}
            >
              <Crosshair className="w-4 h-4" />
            </button>

            {/* Reset View & Deselect */}
            <button
              onClick={handleResetView}
              title="Reset view and clear selection"
              className="p-2 bg-[var(--bg-tertiary)] hover:bg-amber-500/20 border border-border-color hover:border-amber-500/40 rounded-lg text-[var(--text-secondary)] hover:text-amber-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Divider */}
            <div className="w-[1px] h-5 bg-[#334155] mx-0.5" />

            {/* Local Neighborhood Isolation Toggle */}
            <button
              onClick={() => setIsolateLocalNetwork((prev) => !prev)}
              disabled={!activeSelectedNodeId}
              title={
                activeSelectedNodeId
                  ? isolateLocalNetwork
                    ? 'Switch back to Full Network view'
                    : 'Isolate Local Neighborhood (Selected + 1-Hop + 2-Hop)'
                  : 'Select a node to isolate its local neighborhood'
              }
              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                isolateLocalNetwork && activeSelectedNodeId
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : activeSelectedNodeId
                  ? 'bg-[var(--bg-tertiary)] hover:bg-cyan-500/15 border-border-color text-[var(--text-secondary)] hover:text-cyan-300'
                  : 'bg-[var(--bg-tertiary)]/50 border-border-color/40 text-[var(--text-disabled)] cursor-not-allowed opacity-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isolateLocalNetwork && activeSelectedNodeId ? 'Local Net' : 'Full Net'}</span>
            </button>

            {/* Divider */}
            <div className="w-[1px] h-5 bg-[#334155] mx-0.5" />

            {/* Suspect <-> Offender Nexus Toggle Button */}
            <button
              onClick={onToggleSuspectOffenderNexus}
              title={
                suspectOffenderNexus
                  ? 'Exit Suspect ↔ Offender Nexus (return to full multi-source intelligence graph)'
                  : 'Isolate Suspect ↔ Offender Nexus (exclusively view suspect and offender criminal connections)'
              }
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                suspectOffenderNexus
                  ? 'bg-gradient-to-r from-red-600/30 via-orange-600/30 to-amber-600/30 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                  : 'bg-[var(--bg-tertiary)] hover:bg-amber-500/20 border-border-color text-[var(--text-secondary)] hover:text-amber-300'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${suspectOffenderNexus ? 'text-amber-400 animate-pulse' : 'text-amber-400/80'}`} />
              <span>{suspectOffenderNexus ? 'Susp ↔ Off (Active)' : 'Susp ↔ Off'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// PERMANENT HUD LABELS FOR 1-HOP CONNECTED NEIGHBORS (CLEAN & NON-COLLIDING)
// =========================================================================
const NodePinOverlay = ({
  fgRef,
  nodes,
  selectedNodeId,
}: {
  fgRef: RefObject<any>;
  nodes: GraphNode[];
  selectedNodeId: string | null;
}) => {
  const elRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Never show pin for the hero target itself to prevent collisions with top status bar
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => n.id !== selectedNodeId);
  }, [nodes, selectedNodeId]);

  const nodesRef = useRef(filteredNodes);
  nodesRef.current = filteredNodes;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const inst = fgRef.current;
      if (inst && inst.graphData && nodesRef.current.length > 0) {
        try {
          const toScreen = inst.graph2ScreenCoords.bind(inst);
          for (const n of nodesRef.current) {
            const nodeEl = elRefs.current[n.id];
            if (nodeEl && n.x !== undefined && n.y !== undefined && n.z !== undefined) {
              const pt = toScreen(n.x, n.y, n.z);
              nodeEl.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -180%)`;
            }
          }
        } catch {
          // Camera or graph not ready yet — try again next frame
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fgRef]);

  if (filteredNodes.length === 0) return null;

  return (
    <div className="absolute inset-0 top-0 left-0 z-10 pointer-events-none overflow-hidden select-none">
      {filteredNodes.map((n) => {
        const color =
          n.category === 'suspect'
            ? '#EF4444'
            : n.category === 'offender'
            ? '#F97316'
            : n.category === 'cdr'
            ? '#06B6D4'
            : n.category === 'financial_transaction'
            ? '#F59E0B'
            : n.category === 'surveillance_report'
            ? '#A855F7'
            : n.category === 'social_media_intel'
            ? '#3B82F6'
            : n.category === 'gang'
            ? '#EC4899'
            : '#10B981';

        return (
          <div
            key={n.id}
            ref={(el) => {
              elRefs.current[n.id] = el;
            }}
            className="absolute left-0 top-0 rounded-md font-mono leading-tight whitespace-nowrap px-2.5 py-1 text-[9.5px] font-semibold border shadow-lg transition-opacity duration-150"
            style={{
              background: 'rgba(11, 17, 32, 0.92)',
              backdropFilter: 'blur(8px)',
              borderColor: `${color}99`,
              color: '#f8fafc',
              boxShadow: `0 0 10px ${color}33, 0 3px 8px rgba(0,0,0,0.85)`,
              zIndex: 15,
            }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                }}
              />
              <span className="truncate max-w-[150px]">{n.name}</span>
              <span
                className="text-[7.5px] uppercase tracking-wider px-1 py-0.2 rounded font-bold"
                style={{
                  background: `${color}25`,
                  color: color,
                  border: `1px solid ${color}40`,
                }}
              >
                {n.category.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =========================================================================
// 2D CANVAS-BASED FALLBACK (WHEN WEBGL HARDWARE ACCELERATION IS DISABLED)
// =========================================================================
interface GraphFallbackProps {
  onNodeSelect?: (node: GraphNode) => void;
  onLinkSelect?: (link: GraphLink) => void;
  isLight: boolean;
  graphData?: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
}

const FALLBACK_NODE_COLORS: Record<string, string> = {
  suspect: '#EF4444',
  offender: '#F97316',
  cdr: '#06B6D4',
  financial_transaction: '#F59E0B',
  surveillance_report: '#A855F7',
  social_media_intel: '#3B82F6',
  location: '#0EA5E9',
  victim: '#64748B',
  case: '#10B981',
  gang: '#6C43CC',
  vehicle: '#3D8AF0',
  weapon: '#F09C2E',
  officer: '#14C997',
};

const GraphFallback: React.FC<GraphFallbackProps> = ({
  onNodeSelect,
  onLinkSelect,
  isLight,
  graphData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const layout = useMemo(() => {
    const nodes = graphData?.nodes ?? [];
    const coords: Record<string, { x: number; y: number }> = {};
    const cx = 400;
    const cy = 250;
    const nodesPerRing = 8;
    nodes.forEach((node, index) => {
      const ring = Math.floor(index / nodesPerRing);
      const posInRing = index % nodesPerRing;
      const ringSize = Math.min(nodesPerRing, nodes.length - ring * nodesPerRing);
      const radius = 100 + ring * 120;
      const angle = (posInRing / ringSize) * Math.PI * 2 - Math.PI / 2;
      coords[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * 0.78 * Math.sin(angle),
      };
    });
    return { nodes, links: graphData?.links ?? [], coords };
  }, [graphData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layout.nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const LOGICAL_W = 800;
    const LOGICAL_H = 500;
    canvas.width = LOGICAL_W * dpr;
    canvas.height = LOGICAL_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let animId: number;
    const { nodes: layoutNodes, links: layoutLinks, coords } = layout;

    const draw = () => {
      ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Draw links
      layoutLinks.forEach((link) => {
        const sId = typeof link.source === 'object' ? link.source.id : link.source;
        const tId = typeof link.target === 'object' ? link.target.id : link.target;
        const p1 = coords[sId];
        const p2 = coords[tId];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.4)' : 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // Draw nodes
      layoutNodes.forEach((node) => {
        const pt = coords[node.id];
        if (pt) {
          const fill = FALLBACK_NODE_COLORS[node.category] || '#8B5CF6';
          const size = 10;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = '10px monospace';
          ctx.fillStyle = isLight ? '#334155' : '#e2e8f0';
          ctx.fillText(node.name, pt.x - 20, pt.y - size - 4);
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let foundNode: GraphNode | null = null;
      for (const node of layoutNodes) {
        const pt = coords[node.id];
        if (pt) {
          const dist = Math.hypot(clickX - pt.x, clickY - pt.y);
          if (dist <= 22) {
            foundNode = node;
            break;
          }
        }
      }

      if (foundNode) {
        setSelectedNodeId(foundNode.id);
        onNodeSelect?.(foundNode);
      }
    };

    canvas.addEventListener('click', handleCanvasClick);
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [onNodeSelect, onLinkSelect, selectedNodeId, isLight, layout]);

  return (
    <div className="absolute inset-0 w-full h-full flex flex-col justify-between bg-[var(--bg-surface)] p-4 text-center">
      <div className="w-full flex items-center justify-center gap-1.5 p-2 bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 text-[var(--accent-amber)] text-[9.5px] font-mono rounded">
        <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
        <span>WEBGL DIRECT X ACCELERATION OFF - RELATIONAL MATRIX SIMULATOR RUNNING</span>
      </div>
      <div className="flex-grow flex items-center justify-center relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full h-full object-contain cursor-pointer max-w-[800px] max-h-[500px]"
        />
      </div>
    </div>
  );
};

// React ErrorBoundary for catching WebGL/Three.js crash
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; onError?: () => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ThreeJS Network Graph component failed to load:', error, errorInfo);
    if (this.props.onError) this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default CriminalGraph3D;
