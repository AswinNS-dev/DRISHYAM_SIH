import React, { useState, useRef, useEffect, useMemo, useCallback, type RefObject } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { AlertTriangle, Maximize2, ChevronUp, ChevronDown, Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import type { NetworkNodeCategory } from '../../services/api';
import { useAppStore } from '../../store/appStore';

// =========================================================================
// 3D GLASS GEOMETRIES & MATERIALS CACHE (SUBTLE 3D GLASS / CRYSTAL EFFECT)
// =========================================================================

// Shared 3D geometries for multi-source intelligence entities
const GEOMETRIES: Record<string, { outer: THREE.BufferGeometry; inner: THREE.BufferGeometry }> = {
  // Suspect: Red sphere
  suspect: {
    outer: new THREE.SphereGeometry(6.5, 24, 24),
    inner: new THREE.SphereGeometry(3.6, 16, 16),
  },
  // Offender: Orange sphere
  offender: {
    outer: new THREE.SphereGeometry(7.5, 24, 24),
    inner: new THREE.SphereGeometry(4.2, 16, 16),
  },
  // CDR: Cyan hexagon (6-sided cylinder)
  cdr: {
    outer: new THREE.CylinderGeometry(6.2, 6.2, 5.5, 6),
    inner: new THREE.CylinderGeometry(3.4, 3.4, 3.2, 6),
  },
  // Financial Transaction: Amber / Gold diamond (Octahedron)
  financial_transaction: {
    outer: new THREE.OctahedronGeometry(7.2, 0),
    inner: new THREE.OctahedronGeometry(4.0, 0),
  },
  // Surveillance Report: Purple cube (Box)
  surveillance_report: {
    outer: new THREE.BoxGeometry(8.5, 8.5, 8.5),
    inner: new THREE.BoxGeometry(4.5, 4.5, 4.5),
  },
  // Social Media Intel: Blue octagon (8-sided cylinder)
  social_media_intel: {
    outer: new THREE.CylinderGeometry(6.5, 6.5, 5.5, 8),
    inner: new THREE.CylinderGeometry(3.5, 3.5, 3.2, 8),
  },
  case: {
    outer: new THREE.BoxGeometry(7.0, 7.0, 7.0),
    inner: new THREE.BoxGeometry(3.5, 3.5, 3.5),
  },
  location: {
    outer: new THREE.ConeGeometry(6.0, 9.0, 6),
    inner: new THREE.ConeGeometry(3.0, 5.0, 6),
  },
  victim: {
    outer: new THREE.SphereGeometry(5.2, 16, 16),
    inner: new THREE.SphereGeometry(2.8, 12, 12),
  },
  officer: {
    outer: new THREE.IcosahedronGeometry(6.0, 0),
    inner: new THREE.IcosahedronGeometry(3.2, 0),
  },
  default: {
    outer: new THREE.SphereGeometry(5.5, 16, 16),
    inner: new THREE.SphereGeometry(3.0, 12, 12),
  },
};

const HALO_GEOMETRY = new THREE.TorusGeometry(9.0, 0.45, 12, 32);
const HALO_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.9,
});

// Materials for subtle 3D glass / crystal effect with inner luminous core
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

const MATERIALS: Record<string, { outer: THREE.Material; inner: THREE.Material }> = {
  suspect: {
    outer: createGlassMaterial(0xef4444),
    inner: createCoreMaterial(0xff6b6b),
  },
  offender: {
    outer: createGlassMaterial(0xf97316),
    inner: createCoreMaterial(0xffa040),
  },
  cdr: {
    outer: createGlassMaterial(0x06b6d4, 0.82),
    inner: createCoreMaterial(0x22d3ee),
  },
  financial_transaction: {
    outer: createGlassMaterial(0xf59e0b, 0.85),
    inner: createCoreMaterial(0xfde68a),
  },
  surveillance_report: {
    outer: createGlassMaterial(0xa855f7),
    inner: createCoreMaterial(0xd8b4fe),
  },
  social_media_intel: {
    outer: createGlassMaterial(0x3b82f6),
    inner: createCoreMaterial(0x93c5fd),
  },
  case: {
    outer: createGlassMaterial(0x10b981),
    inner: createCoreMaterial(0x6ee7b7),
  },
  location: {
    outer: createGlassMaterial(0x0ea5e9),
    inner: createCoreMaterial(0x7dd3fc),
  },
  victim: {
    outer: createGlassMaterial(0x64748b, 0.7),
    inner: createCoreMaterial(0x94a3b8, 0.85),
  },
  officer: {
    outer: createGlassMaterial(0x14b8a6),
    inner: createCoreMaterial(0x5eead4),
  },
  default: {
    outer: createGlassMaterial(0x8b5cf6),
    inner: createCoreMaterial(0xc4b5fd),
  },
};

const SELECTED_MATERIALS = {
  outer: createGlassMaterial(0xffffff, 0.9),
  inner: createCoreMaterial(0xffffff, 1.0),
};

const PATH_MATERIALS = {
  outer: createGlassMaterial(0x22d3ee, 0.95),
  inner: createCoreMaterial(0xa5f3fc, 1.0),
};

const DIMMED_MATERIALS = {
  outer: createGlassMaterial(0x475569, 0.22),
  inner: createCoreMaterial(0x334155, 0.25),
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
  /** True when the record originates from the bundled demo seed dataset (gap 132.4). */
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

interface CriminalGraph3DProps {
  onNodeSelect?: (node: GraphNode) => void;
  onLinkSelect?: (link: GraphLink) => void;
  graphData?: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  /** Issue #230: node ids + undirected edge keys (`min~max`) to emphasize after a
   *  connection-path search. All non-highlighted content is dimmed while active. */
  highlightPath?: {
    nodeIds: string[];
    linkKeys: string[];
  } | null;
}

export const CriminalGraph3D: React.FC<CriminalGraph3DProps> = ({ onNodeSelect, onLinkSelect, graphData, highlightPath }) => {
  const fgRef = useRef<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const resolvedGraphData = useMemo(() => graphData ?? EMPTY_GRAPH_DATA, [graphData]);
  const [currentGraphData, setCurrentGraphData] = useState(resolvedGraphData);
  const [hasError, setHasError] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === 'light';
  const canvasBg = isLight ? '#f7f9fc' : '#080E1B';

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  // Issue #230: normalize the highlighted path so nodes/edges can be emphasized.
  const pathNodeIds = useMemo(() => {
    const set = new Set(highlightPath?.nodeIds ?? []);
    return set;
  }, [highlightPath]);
  const pathLinkKeys = useMemo(() => {
    const set = new Set(highlightPath?.linkKeys ?? []);
    return set;
  }, [highlightPath]);
  const hasHighlight = !!highlightPath && (pathNodeIds.size > 0 || pathLinkKeys.size > 0);

  const linkKey = (link: GraphLink): string => {
    const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    return [String(sId), String(tId)].sort().join('~');
  };
  const isPathLink = (link: GraphLink): boolean => pathLinkKeys.has(linkKey(link));
  const isPathNode = (node: GraphNode): boolean => pathNodeIds.has(node.id);

  // Issue #230: nodes that keep a permanent on-canvas label — the selection plus
  // every entity on the highlighted connection path.
  const labeledNodes = useMemo(() => {
    if (!selectedNodeId && !hasHighlight) return [];
    return currentGraphData.nodes.filter((n) => n.id === selectedNodeId || (hasHighlight && isPathNode(n)));
  }, [currentGraphData, selectedNodeId, hasHighlight, pathNodeIds]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: width || 600,
          height: height || 400
        });
      }
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    setCurrentGraphData(resolvedGraphData);
    // Reset auto-fit so new graph data triggers camera fit (Issue #189)
    hasAutoFit.current = false;
  }, [resolvedGraphData]);

  // Compute degree centrality for node scaling
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

  // Configure force simulation for better layout
  useEffect(() => {
    if (fgRef.current && !hasError) {
      const engine = fgRef.current.d3Force;
      if (engine) {
        // Set custom link distance based on relationship type
        const linkForce = engine('link');
        if (linkForce) {
          linkForce.distance((link: any) => {
            const type = link.relationship_type || link.relationship || '';
            if (type.includes('USED') || type.includes('LINKED')) return 80;
            if (type.includes('KNOWS') || type.includes('ASSOCIATED')) return 140;
            return 110;
          });
        }
        // Increase charge repulsion to spread nodes apart
        const chargeForce = engine('charge');
        if (chargeForce) {
          chargeForce.strength(-280);
        }
      }
    }
  }, [hasError, currentGraphData]);

  // Auto-fit camera on initial data load
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (currentGraphData.nodes.length > 0 && !hasAutoFit.current && fgRef.current && !hasError) {
      hasAutoFit.current = true;
      setTimeout(() => {
        fgRef.current?.zoomToFit(400, 30);
      }, 2500);
    }
  }, [currentGraphData, hasError]);

  // Node Clicked Action — zoom camera close to the node
  const handleNodeClick = (node: any) => {
    if (fgRef.current && fgRef.current.cameraPosition) {
      const distance = 45;
      const norm = Math.hypot(node.x || 0, node.y || 0, node.z || 0) || 1;
      fgRef.current.cameraPosition(
        {
          x: (node.x || 0) + (node.x || 0) / norm * distance,
          y: (node.y || 0) + (node.y || 0) / norm * distance + 15,
          z: (node.z || 0) + (node.z || 0) / norm * distance + distance,
        },
        node,
        1500
      );
    }
    const fullNode = currentGraphData.nodes.find(n => n.id === node.id);
    if (fullNode) {
      setSelectedNodeId(fullNode.id);
      onNodeSelect?.(fullNode);
    }
  };

  // Link Clicked Action (Issue #159)
  const handleLinkClick = (link: any) => {
    if (onLinkSelect) {
      onLinkSelect(link);
    }
  };

  // Issue #189: Center camera on the currently selected node
  const handleCenterSelected = useCallback(() => {
    if (!selectedNodeId || !fgRef.current || hasError) return;
    const node = currentGraphData.nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    const distance = 45;
    const norm = Math.hypot(node.x || 0, node.y || 0, node.z || 0) || 1;
    if (fgRef.current.cameraPosition) {
      fgRef.current.cameraPosition(
        {
          x: (node.x || 0) + (node.x || 0) / norm * distance,
          y: (node.y || 0) + (node.y || 0) / norm * distance + 15,
          z: (node.z || 0) + (node.z || 0) / norm * distance + distance,
        },
        node,
        800
      );
    }
  }, [selectedNodeId, currentGraphData, hasError]);

  // Color matching for nodes
  const getNodeColor = (cat: string) => {
    switch (cat) {
      case 'suspect': return '#EF4444'; // Red
      case 'offender': return '#F97316'; // Orange
      case 'cdr': return '#06B6D4'; // Cyan
      case 'financial_transaction': return '#F59E0B'; // Amber / Gold
      case 'surveillance_report': return '#A855F7'; // Purple
      case 'social_media_intel': return '#3B82F6'; // Blue
      case 'location': return '#0EA5E9'; // Sky
      case 'case': return '#10B981'; // Green
      case 'victim': return '#64748B'; // Grey
      case 'officer': return '#14C997'; // Teal
      default: return '#8B5CF6';
    }
  };

  // Color matching for link provenance & intelligence sources
  const getLinkColor = (link: GraphLink) => {
    const relType = (link.relationship_type || link.relationship || '').toUpperCase();
    if (relType === 'COMMUNICATION' || relType.includes('CDR') || relType.includes('CALL')) {
      return isLight ? 'rgba(8, 145, 178, 0.85)' : 'rgba(6, 182, 212, 0.85)';
    }
    if (relType === 'FINANCIAL' || relType.includes('TRANSACTION') || relType.includes('TXN')) {
      return isLight ? 'rgba(217, 119, 6, 0.85)' : 'rgba(245, 158, 11, 0.85)';
    }
    if (relType === 'SURVEILLANCE' || relType.includes('SURVEILLANCE') || relType.includes('CCTV')) {
      return isLight ? 'rgba(147, 51, 234, 0.85)' : 'rgba(168, 85, 247, 0.85)';
    }
    if (relType === 'SOCIAL_DIGITAL' || relType.includes('SOCIAL') || relType.includes('TELEGRAM') || relType.includes('CYBER')) {
      return isLight ? 'rgba(37, 99, 235, 0.85)' : 'rgba(59, 130, 246, 0.85)';
    }
    if (link.verification_status === 'VERIFIED' || link.provenance === 'DIRECT_DATABASE') {
      return isLight ? 'rgba(5, 150, 105, 0.85)' : 'rgba(16, 185, 129, 0.85)';
    }
    if (link.verification_status === 'POTENTIAL' || link.provenance === 'ANALYTICAL_INFERENCE') {
      return isLight ? 'rgba(217, 119, 6, 0.95)' : 'rgba(245, 158, 11, 0.95)';
    }
    if (link.is_demo_derived || link.provenance === 'DEMO_SEED' || link.provenance === 'MIXED') {
      return isLight ? 'rgba(124, 58, 237, 0.75)' : 'rgba(168, 85, 247, 0.75)';
    }
    return isLight ? 'rgba(100, 116, 139, 0.6)' : 'rgba(148, 163, 184, 0.55)';
  };

  // Node 3D Glass Object with inner glow highlight and custom geometry
  const nodeThreeObject = useCallback(
    (node: any) => {
      const cat = (node.category || 'default').toLowerCase();
      const geom = GEOMETRIES[cat] || GEOMETRIES.default;
      const isSelected = node.id === selectedNodeId;
      const isPath = hasHighlight && isPathNode(node);
      const isDimmed = hasHighlight && !isPath;

      const mat = isSelected
        ? SELECTED_MATERIALS
        : isPath
        ? PATH_MATERIALS
        : isDimmed
        ? DIMMED_MATERIALS
        : MATERIALS[cat] || MATERIALS.default;

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

      if (isSelected) {
        const ringMesh = new THREE.Mesh(HALO_GEOMETRY, HALO_MATERIAL);
        ringMesh.rotation.x = Math.PI / 2;
        group.add(ringMesh);
      }

      // Hierarchy and degree centrality scaling
      const deg = degreeMap[node.id] || 0;
      const isPerson = cat === 'suspect' || cat === 'offender';
      const baseScale = isPerson
        ? 1.0 + Math.min(deg * 0.08, 0.55)
        : 0.85 + Math.min(deg * 0.05, 0.35);
      const finalScale = isSelected ? baseScale * 1.3 : baseScale;
      group.scale.set(finalScale, finalScale, finalScale);

      return group;
    },
    [selectedNodeId, hasHighlight, isPathNode, degreeMap]
  );

  // Slow orbital rotation when idle
  useEffect(() => {
    if (fgRef.current && !hasError) {
      fgRef.current.controls().autoRotate = true;
      fgRef.current.controls().autoRotateSpeed = 0.65;
    }
  }, [hasError]);

  return (
    <div className="w-full h-full relative bg-[var(--bg-surface)] rounded-card border border-border-color flex flex-col justify-between overflow-hidden" style={{ minHeight: '500px' }}>
      
      {/* STATUS OVERLAY */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)]/90 backdrop-blur-sm border border-[var(--border-color)] rounded-btn text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          <span>{currentGraphData.nodes.length} NODES</span>
          <span className="text-[var(--border-color)]">/</span>
          <span>{currentGraphData.links.length} EDGES</span>
          <span className="ml-2 text-[var(--text-disabled)]">CLICK NODE &rarr; DOSSIER &bull; EDGE &rarr; LINK</span>
          {hasHighlight && (
            <span className="ml-2 inline-flex items-center gap-1 text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
              CONNECTION PATH
            </span>
          )}
        </div>
      </div>

      {/* GRAPH VIEWPORT */}
      <div ref={containerRef} className="flex-1 w-full h-full relative" style={{ minHeight: '460px' }}>
        {hasError ? (
          <GraphFallback onNodeSelect={onNodeSelect} onLinkSelect={onLinkSelect} isLight={isLight} graphData={currentGraphData} />
        ) : (
          <ErrorBoundary fallback={<GraphFallback onNodeSelect={onNodeSelect} onLinkSelect={onLinkSelect} isLight={isLight} graphData={currentGraphData} />} onError={() => setHasError(true)}>
            <ForceGraph3D
              ref={fgRef}
              graphData={currentGraphData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor={canvasBg}
              showNavInfo={false}
              nodeThreeObject={nodeThreeObject}
              nodeLabel={(node) => {
                const cat = (node.category || 'entity').toLowerCase();
                const color = getNodeColor(node.category);
                const badgeStyle = `display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;letter-spacing:0.05em;text-transform:uppercase;background:${color}22;color:${color};border:1px solid ${color}55;`;

                let detailsHtml = '';
                if (cat === 'cdr') {
                  detailsHtml = `
                    <span style="color:#67e8f9">Phone: ${node.phone || node.name.replace(/^CDR:\s*/, '')}</span><br />
                    <span style="color:#94a3b8">Type: Call Detail Record &bull; Active Telemetry</span>
                    ${node.date ? `<br /><span style="color:#94a3b8">Logged: ${new Date(node.date).toLocaleString()}</span>` : ''}
                  `;
                } else if (cat === 'financial_transaction') {
                  detailsHtml = `
                    <span style="color:#fde68a">Evidence/Ledger: ${node.name}</span><br />
                    <span style="color:#94a3b8">Status: ${node.status || 'Verified Ledger'} &bull; Risk: ${node.riskScore ?? 0}%</span>
                    ${node.date ? `<br /><span style="color:#94a3b8">Timestamp: ${node.date}</span>` : ''}
                  `;
                } else if (cat === 'surveillance_report') {
                  detailsHtml = `
                    <span style="color:#d8b4fe">Surveillance: ${node.name}</span><br />
                    <span style="color:#94a3b8">Priority: ${node.status || 'Active Intel'} &bull; District: ${node.district || 'Unassigned'}</span>
                    ${node.date ? `<br /><span style="color:#94a3b8">Reported: ${new Date(node.date).toLocaleString()}</span>` : ''}
                  `;
                } else if (cat === 'social_media_intel') {
                  detailsHtml = `
                    <span style="color:#93c5fd">Digital Threat: ${node.name}</span><br />
                    <span style="color:#94a3b8">Channel: Cyber Intelligence &bull; Risk: ${node.riskScore ?? 0}%</span>
                    ${node.district ? `<br /><span style="color:#94a3b8">District: ${node.district}</span>` : ''}
                  `;
                } else if (cat === 'offender') {
                  detailsHtml = `
                    <span style="color:#fdba74">Status: ${node.status || 'Convicted / Known'} &bull; Risk: ${node.riskScore ?? 0}%</span><br />
                    <span style="color:#94a3b8">Affiliation: ${node.gangAffiliation || 'Independent'} &bull; Cases: ${node.casesCount ?? 0}</span>
                  `;
                } else {
                  detailsHtml = `
                    <span style="color:#fca5a5">Risk: ${node.riskScore ?? 0}% &bull; Cases: ${node.casesCount ?? 0}</span>
                    ${node.district ? `<br /><span style="color:#94a3b8">District: ${node.district}</span>` : ''}
                    ${node.gangAffiliation ? `<br /><span style="color:#94a3b8">Gang: ${node.gangAffiliation}</span>` : ''}
                  `;
                }

                return `
                  <div style="
                    background: rgba(11, 17, 32, 0.94);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    padding: 8px 12px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 11px;
                    line-height: 1.45;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px ${color}33;
                    backdrop-filter: blur(8px);
                    max-width: 280px;
                    pointer-events: none;
                  ">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
                      <b style="color:#f1f5f9;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${node.name}</b>
                      <span style="${badgeStyle}">${cat.replace(/_/g, ' ')}</span>
                    </div>
                    ${detailsHtml}
                  </div>
                `;
              }}
              linkLabel={(link) => {
                const l = link as GraphLink;
                const provenance = l.provenance || 'DIRECT_DATABASE';
                const status = l.verification_status || 'VERIFIED';
                return `<div style="font-family:monospace;font-size:10px;line-height:1.4;pointer-events:none">
                  <b style="color:#e8edf5">${l.relationship || 'RELATIONSHIP'}</b><br />
                  <span style="color:${getLinkColor(l)}">${provenance.replace(/_/g, ' ')} &bull; ${status.replace(/_/g, ' ')}</span>
                  ${l.weight !== undefined && l.weight !== null ? `<br /><span style="color:#94a3b8">strength ${l.weight}</span>` : ''}
                </div>`;
              }}
              linkColor={link => {
                const l = link as GraphLink;
                if (hasHighlight) {
                  if (isPathLink(l)) return '#22D3EE';
                  return isLight ? 'rgba(100, 116, 139, 0.10)' : 'rgba(148, 163, 184, 0.10)';
                }
                return getLinkColor(l);
              }}
              linkDirectionalParticles={link => {
                const l = link as GraphLink;
                if (hasHighlight) {
                  if (isPathLink(l)) return 4;
                  return 0;
                }
                return l.verification_status === 'POTENTIAL' ? 3 : 1.5;
              }}
              linkDirectionalParticleSpeed={0.018}
              linkDirectionalParticleWidth={2.5}
              linkWidth={link => {
                const l = link as GraphLink;
                if (hasHighlight) {
                  if (isPathLink(l)) return 5;
                  return 1.2;
                }
                return l.verification_status === 'VERIFIED' ? 3.5 : 2.5;
              }}
              d3AlphaDecay={0.015}
              d3VelocityDecay={0.35}
              d3AlphaMin={0.0005}
              cooldownTime={12000}
              warmupTicks={50}
              rendererConfig={{ antialias: true }}
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
              onEngineStop={() => {
                if (fgRef.current && !hasError) {
                  fgRef.current.zoomToFit(400, 30);
                }
              }}
            />
          </ErrorBoundary>
        )}

        {/* Permanent labels for selection + highlighted connection path (Issue #230) */}
        <NodePinOverlay fgRef={fgRef} nodes={labeledNodes} />

        {/* Multi-source Intelligence & Provenance Legend overlay — collapsible */}
        <div
          className={`absolute bottom-4 left-4 z-20 bg-[#0B1120] border border-[#334155] rounded-card shadow-2xl font-mono select-none pointer-events-auto transition-all duration-200 ${
            legendOpen ? 'p-3 w-[240px]' : 'p-1.5 w-auto'
          }`}
        >
          <button
            onClick={() => setLegendOpen(v => !v)}
            className="flex items-center gap-1.5 cursor-pointer text-[8px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-emerald-400 transition-colors"
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ${legendOpen ? '' : 'mr-0.5'}`} />
            Legend
            {legendOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>

          {legendOpen && (
            <>
              {/* Entity Shapes Section */}
              <div className="border-t border-[#1E293B] pt-2 mt-2 flex flex-col gap-1.5">
                <span className="text-[8px] font-bold text-[#94A3B8] uppercase tracking-wider">Multi-Source Entities</span>
                
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
                <span className="text-[8px] font-bold text-[#94A3B8] uppercase tracking-wider">Relationship Provenance</span>
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

              <div className="border-t border-[#1E293B] pt-2 mt-2 flex items-center gap-2 bg-[#0F172A] px-2 py-1 rounded border border-[#1E293B]">
                <span className="text-[8px] text-[#94A3B8]">
                  {currentGraphData.nodes.length} nodes, {currentGraphData.links.length} edges
                </span>
              </div>
            </>
          )}
        </div>

        {/* Floating Zoom Controls (Issue #189: added center-selected button) */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 pointer-events-auto">
          <button
            onClick={() => {
              if (fgRef.current) {
                const pos = fgRef.current.cameraPosition();
                if (pos) {
                  const scale = 0.7;
                  fgRef.current.cameraPosition(
                    { x: pos.x * scale, y: pos.y * scale, z: pos.z * scale },
                    undefined, 400
                  );
                }
              }
            }}
            title="Zoom in"
            className="p-2 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/15 border border-border-color hover:border-[var(--accent-blue)]/30 rounded text-[var(--text-secondary)] cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (fgRef.current) {
                const pos = fgRef.current.cameraPosition();
                if (pos) {
                  const scale = 1.4;
                  fgRef.current.cameraPosition(
                    { x: pos.x * scale, y: pos.y * scale, z: pos.z * scale },
                    undefined, 400
                  );
                }
              }
            }}
            title="Zoom out"
            className="p-2 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/15 border border-border-color hover:border-[var(--accent-blue)]/30 rounded text-[var(--text-secondary)] cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => fgRef.current?.zoomToFit(400, 30)}
            title="Fit all nodes in view"
            className="p-2 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/15 border border-border-color hover:border-[var(--accent-blue)]/30 rounded text-[var(--text-secondary)] cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {selectedNodeId && (
            <button
              onClick={handleCenterSelected}
              title="Center on selected node"
              className="p-2 bg-[var(--accent-blue)]/15 hover:bg-[var(--accent-blue)]/25 border border-[var(--accent-blue)]/30 hover:border-[var(--accent-blue)]/50 rounded text-[var(--accent-blue)] cursor-pointer"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

// Issue #230: HTML label layer that tracks selected/path nodes in screen space on
// every animation frame. Only mounts while at least one node needs a permanent
// label, so normal browsing keeps the canvas completely unlabeled.
const NodePinOverlay = ({ fgRef, nodes }: { fgRef: RefObject<any>; nodes: GraphNode[] }) => {
  const elRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    const el = elRefs.current;
    let raf = 0;
    const loop = () => {
      const inst = fgRef.current;
      if (inst && inst.graphData && nodesRef.current.length > 0) {
        try {
          const graph = inst.graphData();
          const toScreen = inst.graph2ScreenCoords.bind(inst);
          for (const n of graph.nodes) {
            const nodeEl = el[n.id];
            if (nodeEl && n.x !== undefined && n.y !== undefined && n.z !== undefined) {
              const pt = toScreen(n.x, n.y, n.z);
              nodeEl.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -230%)`;
            }
          }
        } catch {
          // Camera or graph not ready yet — try again next frame.
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fgRef]);

  if (nodes.length === 0) return null;

  return (
    <div className="absolute inset-0 top-0 left-0 z-10 pointer-events-none overflow-hidden">
      {nodes.map((n) => (
        <div
          key={n.id}
          ref={(el) => { elRefs.current[n.id] = el; }}
          className="absolute left-0 top-0 px-1.5 py-0.5 rounded border text-[8px] font-mono leading-tight whitespace-nowrap"
          style={{
            background: 'rgba(8,14,27,0.85)',
            borderColor: 'rgba(34,211,238,0.5)',
            color: '#E8EDF5',
            opacity: 0.95,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          {n.name}
        </div>
      ))}
    </div>
  );
};

// Canvas-based fallback when WebGL crashes — renders the real graph data
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

// Helper to draw clean regular 2D polygons on canvas
function draw2DPolygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation = 0
) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const GraphFallback: React.FC<GraphFallbackProps> = ({ onNodeSelect, onLinkSelect, isLight, graphData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Deterministic multi-ring layout computed from the actual node list
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

    // Render at device pixel ratio for a sharp, HD-quality image
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

      // Draw particle flow animation lines with provenance & intelligence colors
      layoutLinks.forEach(link => {
        const start = coords[typeof link.source === 'object' ? link.source.id : link.source];
        const end = coords[typeof link.target === 'object' ? link.target.id : link.target];
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          
          const relType = (link.relationship_type || link.relationship || '').toUpperCase();
          if (relType === 'COMMUNICATION' || relType.includes('CDR')) {
            ctx.strokeStyle = isLight ? 'rgba(8, 145, 178, 0.85)' : 'rgba(6, 182, 212, 0.85)';
            ctx.lineWidth = 2.4;
            ctx.setLineDash([]);
          } else if (relType === 'FINANCIAL' || relType.includes('TXN')) {
            ctx.strokeStyle = isLight ? 'rgba(217, 119, 6, 0.85)' : 'rgba(245, 158, 11, 0.85)';
            ctx.lineWidth = 2.4;
            ctx.setLineDash([]);
          } else if (relType === 'SURVEILLANCE') {
            ctx.strokeStyle = isLight ? 'rgba(147, 51, 234, 0.85)' : 'rgba(168, 85, 247, 0.85)';
            ctx.lineWidth = 2.4;
            ctx.setLineDash([]);
          } else if (relType === 'SOCIAL_DIGITAL') {
            ctx.strokeStyle = isLight ? 'rgba(37, 99, 235, 0.85)' : 'rgba(59, 130, 246, 0.85)';
            ctx.lineWidth = 2.4;
            ctx.setLineDash([]);
          } else if (link.verification_status === 'VERIFIED' || link.provenance === 'DIRECT_DATABASE') {
            ctx.strokeStyle = isLight ? 'rgba(5, 150, 105, 0.9)' : 'rgba(16, 185, 129, 0.9)';
            ctx.lineWidth = 2.8;
            ctx.setLineDash([]);
          } else if (link.verification_status === 'POTENTIAL' || link.provenance === 'ANALYTICAL_INFERENCE') {
            ctx.strokeStyle = isLight ? 'rgba(217, 119, 6, 0.95)' : 'rgba(245, 158, 11, 0.95)';
            ctx.lineWidth = 2.4;
            ctx.setLineDash([5, 4]);
          } else if (link.is_demo_derived || link.provenance === 'DEMO_SEED' || link.provenance === 'MIXED') {
            ctx.strokeStyle = isLight ? 'rgba(124, 58, 237, 0.8)' : 'rgba(168, 85, 247, 0.8)';
            ctx.lineWidth = 2.0;
            ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.6)' : 'rgba(148, 163, 184, 0.55)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([]);
          }
          
          ctx.stroke();
          ctx.setLineDash([]);

          // Flow dot tracer
          const time = Date.now() / 1500;
          const ratio = (time) % 1.0;
          const px = start.x + (end.x - start.x) * ratio;
          const py = start.y + (end.y - start.y) * ratio;

          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = link.verification_status === 'VERIFIED' ? '#10b981' : '#f59e0b';
          ctx.fill();
        }
      });

      // Draw Nodes with distinctive 2D geometric shapes
      layoutNodes.forEach((node) => {
        const pt = coords[node.id];
        if (pt) {
          const isHigh = node.category === 'suspect' || node.category === 'offender';
          const size = isHigh ? 13 : 10;
          const fill = FALLBACK_NODE_COLORS[node.category] ?? '#6A7A96';

          // Helper to draw geometric shape path
          const drawShapePath = (r: number) => {
            switch (node.category) {
              case 'cdr':
                // Hexagon
                draw2DPolygon(ctx, pt.x, pt.y, r * 1.1, 6, Math.PI / 6);
                break;
              case 'financial_transaction':
                // Diamond (4-pointed rhombus)
                draw2DPolygon(ctx, pt.x, pt.y, r * 1.25, 4, 0);
                break;
              case 'surveillance_report':
                // Square / Cube
                ctx.beginPath();
                ctx.rect(pt.x - r, pt.y - r, r * 2, r * 2);
                ctx.closePath();
                break;
              case 'social_media_intel':
                // Octagon
                draw2DPolygon(ctx, pt.x, pt.y, r * 1.1, 8, Math.PI / 8);
                break;
              default:
                // Circle (Suspect, Offender, Victim, Location)
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.closePath();
                break;
            }
          };

          // Outer pulsing ring on selected
          if (selectedNodeId === node.id) {
            drawShapePath(size + 7);
            ctx.strokeStyle = fill + '88';
            ctx.lineWidth = 2.0;
            ctx.stroke();
          }

          // Inner nodes
          drawShapePath(size);
          ctx.fillStyle = fill;
          ctx.fill();

          // Subtle inner highlight border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Text labels
          ctx.font = '9px monospace';
          ctx.fillStyle = selectedNodeId === node.id ? '#ffffff' : isLight ? '#334155' : '#A8B4CC';
          ctx.fillText(node.name, pt.x - 30, pt.y - size - 4);
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    // Attach click listener targeting coordinates or links
    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let foundNode: GraphNode | null = null;

      // Match node coordinate radius
      for (const node of layoutNodes) {
        const pt = coords[node.id];
        if (pt) {
          const dist = Math.hypot(clickX - pt.x, clickY - pt.y);
          if (dist <= 20) {
            foundNode = node;
            break;
          }
        }
      }

      if (foundNode) {
        setSelectedNodeId(foundNode.id);
        onNodeSelect?.(foundNode);
        return;
      }

      // Check if click was close to any link line
      if (onLinkSelect) {
        for (const link of layoutLinks) {
          const start = coords[typeof link.source === 'object' ? link.source.id : link.source];
          const end = coords[typeof link.target === 'object' ? link.target.id : link.target];
          if (start && end) {
            // Distance from point to line segment
            const l2 = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
            if (l2 === 0) continue;
            let t = ((clickX - start.x) * (end.x - start.x) + (clickY - start.y) * (end.y - start.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = start.x + t * (end.x - start.x);
            const projY = start.y + t * (end.y - start.y);
            const dist = Math.hypot(clickX - projX, clickY - projY);
            if (dist <= 8) {
              onLinkSelect(link);
              break;
            }
          }
        }
      }
    };

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [onNodeSelect, onLinkSelect, selectedNodeId, isLight, layout]);

  if (layout.nodes.length === 0) {
    return (
      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[var(--bg-surface)] p-4 text-center gap-2">
        <AlertTriangle className="w-6 h-6 text-[var(--accent-amber)]" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          No network records available to visualize
        </span>
        <span className="text-[9px] font-mono text-[var(--text-disabled)]">
          Sync PostgreSQL into Neo4j or add linked FIR/case data first.
        </span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full flex flex-col justify-between bg-[var(--bg-surface)] p-4 text-center">
      <div className="w-full flex items-center justify-center gap-1.5 p-2 bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 text-[var(--accent-amber)] text-[9.5px] font-mono rounded">
        <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
        <span>WEBGL DIRECT X ACCELERATION OFF - RELATIONAL MATRIX SIMULATOR RUNNING</span>
      </div>
      <div className="flex-grow flex items-center justify-center relative overflow-hidden">
        <canvas ref={canvasRef} width={800} height={500} className="w-full h-full object-contain cursor-pointer max-w-[800px] max-h-[500px]" />
      </div>
    </div>
  );
};

// Simple React ErrorBoundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback: React.ReactNode, onError?: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ThreeJS Network Graph component failed to load:", error, errorInfo);
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
