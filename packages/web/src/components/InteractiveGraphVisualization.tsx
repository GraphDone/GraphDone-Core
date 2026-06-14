import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { Link2, Edit3, Trash2, Folder, FolderOpen, Plus, FileText, Settings, Maximize2, ArrowLeft, X, GitBranch, Minus, Unlink, Crosshair, GripVertical, Undo2 } from 'lucide-react';
import {
  getPriorityIconElement,
  getStatusIconElement,
  getTypeIconElement,
  getRelationshipIconElement,
  getRelationshipIconForD3,
  getTypeConfig,
  getStatusConfig,
  getStatusCompletionPercentage,
  WorkItemType,
  WorkItemStatus,
  AlertTriangle,
  AlertCircle,
  ListTodo,
  Target
} from '../constants/workItemConstants';
import { useQuery, useMutation, useApolloClient, gql } from '@apollo/client';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { GET_WORK_ITEMS, GET_EDGES, CREATE_EDGE, UPDATE_EDGE, DELETE_EDGE, CREATE_WORK_ITEM, UPDATE_WORK_ITEM, DELETE_WORK_ITEM } from '../lib/queries';
import { validateGraphData, getValidationSummary, ValidationResult } from '../utils/graphDataValidation';
import { DEFAULT_NODE_CONFIG } from '../constants/workItemConstants';

import { DeleteWorkItemModal } from './DeleteWorkItemModal';
import { RelationshipEditorWindow } from './RelationshipEditorWindow';
import { CreateWorkItemModal } from './CreateWorkItemModal';
import { CreateGraphModal } from './CreateGraphModal';
import { GraphSelectionModal } from './GraphSelectionModal';
import { UpdateGraphModal } from './UpdateGraphModal';
import { DeleteGraphModal } from './DeleteGraphModal';
import { ConnectWorkItemModal } from './ConnectWorkItemModal';
import { WorkItemDetailsModal } from './WorkItemDetailsModal';

import { WorkItem, WorkItemEdge } from '../types/graph';
import { RelationshipType, RELATIONSHIP_OPTIONS, getRelationshipConfig } from '../constants/workItemConstants';
import { useAdaptiveQuality } from '../hooks/useAdaptiveQuality';
import { nodeLifeClasses, nodeGlowFilter, isActiveStatus, isCompletedStatus, edgeFlowClass } from '../lib/nodeAnimations';
import { mergeSimulationNodes, mergeSimulationEdges } from '../lib/graphDataMerge';
import { edgeLabelPlacement, clearSegment, slideTFromPointer, chooseLabelT } from '../lib/edgeLabelLayout';
import { PerfMeter, DriftMeter } from '../lib/perfMeter';
import { DEFAULT_PHYSICS, collisionRadius, linkDistance, linkMaxDistance, linkStrength } from '../lib/physicsConfig';
import { edgeBorderEndpoints, minEdgeLength, clampToMinNeighbors } from '../lib/edgeGeometry';
import { spawnCelebration } from '../lib/celebration';
import { buildNeighborhood } from '../lib/graphAdjacency';
import { UndoStack } from '../lib/undoStack';

// LOD thresholds for different zoom levels
const LOD_THRESHOLDS = {
  VERY_FAR: 0.1,
  FAR: 0.3,
  MEDIUM: 0.6,
  CLOSE: 1.0,
};

// Utility functions
const getSmoothedOpacity = (scale: number, threshold: number, fadeRange: number = 0.2) => {
  if (scale >= threshold + fadeRange) return 1;
  if (scale <= threshold - fadeRange) return 0;
  return (scale - (threshold - fadeRange)) / (fadeRange * 2);
};

interface NodeMenuState {
  node: WorkItem | null;
  position: { x: number; y: number };
  visible: boolean;
}

interface EdgeMenuState {
  edge: WorkItemEdge | null;
  position: { x: number; y: number };
  visible: boolean;
}

interface DragState {
  isDragging: boolean;
  offset: { x: number; y: number };
}

interface InteractiveGraphVisualizationProps {
  onResetLayout?: () => void;
}

export function InteractiveGraphVisualization({ onResetLayout }: InteractiveGraphVisualizationProps = {}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentGraph, availableGraphs, descendInto } = useGraph();
  // descendInto from context isn't memoized; hold the latest in a ref so the
  // D3-bound node click handler can call it without re-binding every render.
  const descendIntoRef = useRef(descendInto);
  descendIntoRef.current = descendInto;
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const { tier: qualityTier, profile: qualityProfile } = useAdaptiveQuality();
  const qualityProfileRef = useRef(qualityProfile);
  qualityProfileRef.current = qualityProfile;

  // Fullscreen mode abandoned - keeping single view mode

  // Prevent body scroll when graph view is active
  useEffect(() => {
    const originalBodyOverflow = window.getComputedStyle(document.body).overflow;
    const originalHtmlOverflow = window.getComputedStyle(document.documentElement).overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);
  
  const { data: workItemsData, loading, error, refetch } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph ? {
      where: {
        graph: {
          id: currentGraph.id
        }
      }
    } : { where: {} },
    fetchPolicy: currentGraph ? 'cache-and-network' : 'cache-only',
    pollInterval: currentGraph ? 2000 : 0,
    errorPolicy: 'all'
  });

  const { data: edgesData, loading: edgesLoading, error: edgesError, refetch: refetchEdges } = useQuery(GET_EDGES, {
    variables: currentGraph ? {
      where: {
        source: {
          graph: {
            id: currentGraph.id
          }
        }
      }
    } : { where: {} },
    fetchPolicy: currentGraph ? 'cache-and-network' : 'cache-only',
    pollInterval: currentGraph ? 2000 : 0,
    errorPolicy: 'all'
  });

  // Mutation for creating work items
  const [createNodeMutation] = useMutation(CREATE_WORK_ITEM, {
    refetchQueries: [
      { 
        query: GET_WORK_ITEMS,
        variables: currentGraph ? {
          where: {
            graph: {
              id: currentGraph.id
            }
          }
        } : { where: {} }
      }
    ],
    awaitRefetchQueries: true
  });

  // Mutation for creating edges
  const [createEdgeMutation] = useMutation(CREATE_EDGE, {
    refetchQueries: [
      // Refetch all edges for graph visualization (matches ConnectNodeModal)
      { 
        query: GET_EDGES,
        variables: {}
      },
      // Refetch edges for current graph
      { 
        query: GET_EDGES, 
        variables: {
          where: {
            source: {
              graph: {
                id: currentGraph?.id
              }
            }
          }
        }
      },
      // Refetch work items for current graph
      { 
        query: GET_WORK_ITEMS, 
        variables: currentGraph ? {
          where: {
            graph: {
              id: currentGraph.id
            }
          }
        } : {}
      }
    ],
    awaitRefetchQueries: true,
    optimisticResponse: (vars) => {
      const input = vars.input[0];
      return {
        createEdges: {
          edges: [{
            id: `temp-${Date.now()}`,
            type: input.type,
            weight: input.weight,
            source: { id: 'temp-source' },
            target: { id: 'temp-target' }
          }]
        }
      };
    },
    onError: (_error) => {
      // Error handled by GraphQL error boundary
    }
  });

  // Mutation for updating work item positions
  const [updateWorkItemMutation] = useMutation(UPDATE_WORK_ITEM, {
    refetchQueries: [
      { 
        query: GET_WORK_ITEMS,
        variables: currentGraph ? {
          where: {
            graph: {
              id: currentGraph.id
            }
          }
        } : { where: {} }
      },
      { 
        query: GET_EDGES,
        variables: currentGraph ? {
          where: {
            source: {
              graph: {
                id: currentGraph.id
              }
            }
          }
        } : { where: {} }
      }
    ],
    awaitRefetchQueries: true, // Wait for refetch to complete
    errorPolicy: 'all',
    onCompleted: (data) => {
      console.log('[Graph Debug] Node update completed successfully', data);
      // Don't force reinitialization - let data updates flow through naturally
    },
    onError: (error) => {
      console.error('[Graph Debug] Node update failed:', error);
    }
  });

  const [deleteWorkItemMutation] = useMutation(DELETE_WORK_ITEM, {
    refetchQueries: [
      { query: GET_WORK_ITEMS, variables: currentGraph ? { where: { graph: { id: currentGraph.id } } } : { where: {} } },
      { query: GET_EDGES, variables: currentGraph ? { where: { source: { graph: { id: currentGraph.id } } } } : { where: {} } }
    ]
  });
  
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({ node: null, position: { x: 0, y: 0 }, visible: false });
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState>({ edge: null, position: { x: 0, y: 0 }, visible: false });
  const [menuDragState, setMenuDragState] = useState<DragState>({ isDragging: false, offset: { x: 0, y: 0 } });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType>('RELATES_TO');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showDataHealth, setShowDataHealth] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateNodeModal, setShowCreateNodeModal] = useState(false);
  const [showNodeDetailsModal, setShowNodeDetailsModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectModalInitialTab, setConnectModalInitialTab] = useState<'connect' | 'disconnect'>('connect');
  const [openedFromDeleteModal, setOpenedFromDeleteModal] = useState(false);
  const [showCreateGraphModal, setShowCreateGraphModal] = useState(false);
  const [showGraphSwitcher, setShowGraphSwitcher] = useState(false);
  const [showUpdateGraphModal, setShowUpdateGraphModal] = useState(false);
  const [showDeleteGraphModal, setShowDeleteGraphModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkItem | null>(null);
  const lastSelectedNodeRef = useRef<any>(null); // Track last selected node for centering
  const [selectedEdge, setSelectedEdge] = useState<WorkItemEdge | null>(null);
  const [createNodePosition, setCreateNodePosition] = useState<{ x: number; y: number; z: number } | undefined>(undefined);
  const [currentTransform, setCurrentTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [editingEdge, setEditingEdge] = useState<{ edge: WorkItemEdge; position: { x: number; y: number } } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number; graphX: number; graphY: number } | null>(null);
  const [isFlippingEdge, setIsFlippingEdge] = useState(false);
  const [showRelationshipWindow, setShowRelationshipWindow] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  // Inline rename: an input floats over the node — no modal (W2)
  const [inlineEdit, setInlineEdit] = useState<{ nodeId: string; value: string; original: string; graphX: number; graphY: number } | null>(null);

  // D3 handlers are bound once at init and the init effect intentionally
  // avoids re-initialising on mode changes — so handlers would capture STALE
  // mode state. Mirror it into refs that handlers read live.
  const isConnectingRef = useRef(false);
  const connectionSourceRef = useRef<string | null>(null);
  isConnectingRef.current = isConnecting;
  connectionSourceRef.current = connectionSource;
  const selectedRelationTypeRef = useRef<RelationshipType>('RELATES_TO');

  // FLOW-3: every mutation registers its inverse — experimentation is safe
  const undoStackRef = useRef(new UndoStack(36));
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  useEffect(() => undoStackRef.current.onChange(() => setUndoLabel(undoStackRef.current.peekLabel())), []);
  const runUndo = useCallback(async () => {
    try {
      const action = await undoStackRef.current.undo();
      if (action) showSuccess(`Undid: ${action.label}`);
    } catch {
      showError('Could not undo that — the server refused');
    }
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        runUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runUndo]);

  // Esc always works: pop one mode level, never trap the user
  // (docs/design/interaction-model.md, principle 3). Connection mode and the
  // edge-type selector were keyboard traps before this.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isConnecting) {
        setIsConnecting(false);
        setConnectionSource(null);
        return;
      }
      if (editingEdge) {
        setEditingEdge(null);
        return;
      }
      if (nodeMenu.visible) {
        setNodeMenu({ node: null, position: { x: 0, y: 0 }, visible: false });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnecting, editingEdge, nodeMenu.visible]);

  // The edge being edited glows for the whole session of the editor —
  // applied reactively (init-time attr checks captured stale editingEdge).
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const id = editingEdge?.edge?.id ?? null;
    svg.selectAll('.edge').classed('edge-editing', (d: any) => !!id && d?.id === id);
    svg.selectAll('.edge-label-group').classed('edge-editing-label', (d: any) => !!id && d?.id === id);
    return () => {
      svg.selectAll('.edge').classed('edge-editing', false);
      svg.selectAll('.edge-label-group').classed('edge-editing-label', false);
    };
  }, [editingEdge?.edge?.id]);

  // Grow-mode ghost preview: a dashed line + ghost circle follow the cursor
  // from the source node, so the next click's meaning is always visible.
  useEffect(() => {
    if (!isConnecting || !connectionSource || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('.main-graph-group');
    if (g.empty()) return;
    const sourceNode = (simulationRef.current?.nodes() as any[])?.find((n: any) => n.id === connectionSource);
    if (!sourceNode) return;

    const preview = g.append('g').attr('class', 'grow-preview').style('pointer-events', 'none');
    const previewLine = preview.append('line')
      .attr('stroke', '#34d399')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6 5')
      .attr('opacity', 0.8)
      .attr('x1', sourceNode.x).attr('y1', sourceNode.y)
      .attr('x2', sourceNode.x).attr('y2', sourceNode.y);
    const previewGhost = preview.append('circle')
      .attr('r', 14)
      .attr('fill', 'rgba(52, 211, 153, 0.15)')
      .attr('stroke', '#34d399')
      .attr('stroke-dasharray', '4 4')
      .attr('stroke-width', 1.5)
      .attr('cx', sourceNode.x).attr('cy', sourceNode.y);
    svg.on('mousemove.grow', (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event, g.node() as any);
      previewLine.attr('x1', sourceNode.x).attr('y1', sourceNode.y).attr('x2', mx).attr('y2', my);
      previewGhost.attr('cx', mx).attr('cy', my);
    });

    return () => {
      svg.on('mousemove.grow', null);
      preview.remove();
    };
  }, [isConnecting, connectionSource]);

  
  // Handle dragging for relationship selector
  useEffect(() => {
    let animationFrame: number | null = null;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && editingEdge) {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        
        animationFrame = requestAnimationFrame(() => {
          const newX = e.clientX - dragStart.x;
          const newY = e.clientY - dragStart.y;
          setDragOffset({ x: newX, y: newY });
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
      };
    }
    
    // Return cleanup function for when not dragging
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isDragging, dragStart, editingEdge]);


  // Helper function to apply glow effect immediately when node is clicked
  const applyNodeGlowImmediately = useCallback((node: WorkItem) => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const defs = svg.select('defs');
    
    const nodeTypeConfig = getTypeConfig(node.type as WorkItemType);
    const nodeColor = nodeTypeConfig.hexColor;
    const filterId = `node-glow-${node.type.toLowerCase()}`;
    
    // Remove existing filter and create new one with node's type color
    defs.select(`#${filterId}`).remove();
    
    const nodeGlowFilter = defs.append('filter')
      .attr('id', filterId)
      .attr('x', '-100%')
      .attr('y', '-100%')
      .attr('width', '300%')
      .attr('height', '300%');
    
    // Convert hex to RGB values for feColorMatrix
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
      } : { r: 0.06, g: 0.73, b: 0.51 }; // fallback green
    };
    
    const rgb = hexToRgb(nodeColor);
    nodeGlowFilter.append('feColorMatrix')
      .attr('in', 'SourceGraphic')
      .attr('type', 'matrix')
      .attr('values', `0 0 0 0 ${rgb.r} 0 0 0 0 ${rgb.g} 0 0 0 0 ${rgb.b} 0 0 0 1 0`);
    
    const blur = nodeGlowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '15')
      .attr('result', 'coloredBlur');
    
    blur.append('animate')
      .attr('attributeName', 'stdDeviation')
      .attr('values', '10;20;10')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');
    
    const feMerge = nodeGlowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    
    // Apply the type-specific glow filter immediately
    svg.selectAll('.node-bg')
      .filter((d: any) => d && d.id === node.id)
      .style('filter', `url(#${filterId})`);
  }, []);

  // Apply glow effect to active dialog elements after D3 renders
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const defs = svg.select('defs');
    
    // Remove glow and reset properties from all elements first
    svg.selectAll('.node-bg').style('filter', null);
    svg.selectAll('.edge')
      .style('filter', null)
      .attr('stroke-width', (d: any) => (d.strength || 0.8) * 3); // Reset to normal thickness
    
    // Apply type-specific glow to active node if nodeMenu is visible
    if (nodeMenu.visible && nodeMenu.node) {
      const nodeTypeConfig = getTypeConfig(nodeMenu.node.type as WorkItemType);
      const nodeColor = nodeTypeConfig.hexColor;
      const filterId = `node-glow-${nodeMenu.node.type.toLowerCase()}`;
      
      // Remove existing filter and create new one with node's type color
      defs.select(`#${filterId}`).remove();
      
      const nodeGlowFilter = defs.append('filter')
        .attr('id', filterId)
        .attr('x', '-100%')
        .attr('y', '-100%')
        .attr('width', '300%')
        .attr('height', '300%');
      
      // Convert hex to RGB values for feColorMatrix
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255
        } : { r: 0.06, g: 0.73, b: 0.51 }; // fallback green
      };
      
      const rgb = hexToRgb(nodeColor);
      nodeGlowFilter.append('feColorMatrix')
        .attr('in', 'SourceGraphic')
        .attr('type', 'matrix')
        .attr('values', `0 0 0 0 ${rgb.r} 0 0 0 0 ${rgb.g} 0 0 0 0 ${rgb.b} 0 0 0 1 0`);
      
      const blur = nodeGlowFilter.append('feGaussianBlur')
        .attr('stdDeviation', '15')
        .attr('result', 'coloredBlur');
      
      blur.append('animate')
        .attr('attributeName', 'stdDeviation')
        .attr('values', '10;20;10')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');
      
      const feMerge = nodeGlowFilter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
      
      // Apply the type-specific glow filter
      svg.selectAll('.node-bg')
        .filter((d: any) => d && d.id === nodeMenu.node?.id)
        .style('filter', `url(#${filterId})`);
    }
    
    // Apply glow effects to all selected nodes (for multi-select)
    if (selectedNodes.size > 0) {
      const nodeIdsArray = Array.from(selectedNodes);
      
      // Group nodes by type for efficient filter creation
      const nodesByType = new Map<string, string[]>();
      
      svg.selectAll('.node-bg')
        .filter((d: any) => d && nodeIdsArray.includes(d.id))
        .each((d: any) => {
          const nodeType = d.type.toLowerCase();
          if (!nodesByType.has(nodeType)) {
            nodesByType.set(nodeType, []);
          }
          nodesByType.get(nodeType)!.push(d.id);
        });
      
      // Create glow filters for each node type that has selected nodes
      nodesByType.forEach((nodeIds, nodeType) => {
        const nodeTypeConfig = getTypeConfig(nodeType as WorkItemType);
        const nodeColor = nodeTypeConfig.hexColor;
        const filterId = `selected-node-glow-${nodeType}`;
        
        // Remove existing filter and create new one
        defs.select(`#${filterId}`).remove();
        
        const nodeGlowFilter = defs.append('filter')
          .attr('id', filterId)
          .attr('x', '-100%')
          .attr('y', '-100%')
          .attr('width', '300%')
          .attr('height', '300%');
        
        // Convert hex to RGB values
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
          } : { r: 0.06, g: 0.73, b: 0.51 }; // fallback green
        };
        
        const rgb = hexToRgb(nodeColor);
        nodeGlowFilter.append('feColorMatrix')
          .attr('in', 'SourceGraphic')
          .attr('type', 'matrix')
          .attr('values', `0 0 0 0 ${rgb.r} 0 0 0 0 ${rgb.g} 0 0 0 0 ${rgb.b} 0 0 0 1 0`);
        
        const blur = nodeGlowFilter.append('feGaussianBlur')
          .attr('stdDeviation', '8')  // Slightly smaller than dialog glow
          .attr('result', 'coloredBlur');
        
        // Subtle pulsing animation for selected nodes
        blur.append('animate')
          .attr('attributeName', 'stdDeviation')
          .attr('values', '6;12;6')
          .attr('dur', '3s')
          .attr('repeatCount', 'indefinite');
        
        const feMerge = nodeGlowFilter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
        
        // Apply the glow to nodes of this type that are selected
        svg.selectAll('.node-bg')
          .filter((d: any) => d && nodeIds.includes(d.id))
          .style('filter', `url(#${filterId})`);
      });
    }
    
    // Apply relationship-specific glow to active edge if editingEdge is visible
    if (editingEdge && editingEdge.edge) {
      const relationshipConfig = getRelationshipConfig(editingEdge.edge.type as RelationshipType);
      const edgeColor = relationshipConfig.hexColor;
      const edgeFilterId = `edge-glow-${editingEdge.edge.type.toLowerCase()}`;
      
      // Remove existing filter and create new one with relationship color
      defs.select(`#${edgeFilterId}`).remove();
      
      const edgeGlowFilter = defs.append('filter')
        .attr('id', edgeFilterId)
        .attr('x', '-150%')
        .attr('y', '-150%')
        .attr('width', '400%')
        .attr('height', '400%');
      
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255
        } : { r: 0.06, g: 0.73, b: 0.51 }; // fallback green
      };
      
      const rgb = hexToRgb(edgeColor);
      edgeGlowFilter.append('feColorMatrix')
        .attr('in', 'SourceGraphic')
        .attr('type', 'matrix')
        .attr('values', `0 0 0 0 ${rgb.r} 0 0 0 0 ${rgb.g} 0 0 0 0 ${rgb.b} 0 0 0 1 0`);
      
      const edgeBlur = edgeGlowFilter.append('feGaussianBlur')
        .attr('stdDeviation', '25')
        .attr('result', 'coloredBlur');
      
      edgeBlur.append('animate')
        .attr('attributeName', 'stdDeviation')
        .attr('values', '15;35;15')
        .attr('dur', '1.5s')
        .attr('repeatCount', 'indefinite');
      
      const edgeFeMerge = edgeGlowFilter.append('feMerge');
      edgeFeMerge.append('feMergeNode').attr('in', 'coloredBlur');
      edgeFeMerge.append('feMergeNode').attr('in', 'SourceGraphic');
      
      svg.selectAll('.edge')
        .filter((d: any) => d && d.id === editingEdge.edge?.id)
        .style('filter', `url(#${edgeFilterId})`)
        .attr('stroke-width', 12); // Also make the edge thicker
    }
    
    
  }, [nodeMenu.visible, nodeMenu.node?.id, editingEdge?.edge?.id, selectedEdge?.id, selectedNodes]);
  
  // Auto-collapse relationship panel when no items are selected
  useEffect(() => {
    // Auto-hide relationship window when no items are selected (optional)
    // Window will be controlled manually by user interactions
  }, [selectedNodes.size, editingEdge]);
  
  // Level of detail thresholds
  const LOD_THRESHOLDS = {
    VERY_FAR: 0.3,    // Only show basic shapes
    FAR: 0.5,         // Add node icons  
    MEDIUM: 0.8,      // Add node titles
    CLOSE: 0.6,       // Add edge labels (earlier)
    VERY_CLOSE: 2.0   // Full detail
  };

  // Function to save node position to database
  const saveNodePosition = useCallback(async (nodeId: string, x: number, y: number) => {
    try {
      await updateWorkItemMutation({
        variables: {
          where: { id: nodeId },
          update: { 
            positionX: x,
            positionY: y
          }
        }
      });
      // Position saved successfully
    } catch (error) {
      // Error saving position, continue without logging
    }
  }, [updateWorkItemMutation]);

  // Durable layout: persist the current position of every node whose live
  // position has moved away from its last-saved position by more than a pixel.
  // This makes a physics-laid-out arrangement (and grown/new nodes) survive a
  // reload, so the snapshot-authoritative load above has accurate positions to
  // pin to. Called debounced when the sim settles and on page hide.
  const persistAllPositions = useCallback(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    const moved = (sim.nodes() as any[]).filter((n: any) =>
      typeof n.x === 'number' && typeof n.y === 'number' &&
      (Math.abs((n.positionX ?? 0) - n.x) > 1 || Math.abs((n.positionY ?? 0) - n.y) > 1)
    );
    moved.forEach((n: any) => {
      n.positionX = n.x;
      n.positionY = n.y;
      saveNodePosition(n.id, n.x, n.y);
    });
  }, [saveNodePosition]);

  // Save the settled layout on page hide so a tidy arrangement is never lost
  // even if the user never dragged a node.
  useEffect(() => {
    const handler = () => persistAllPositions();
    window.addEventListener('pagehide', handler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistAllPositions();
    });
    return () => window.removeEventListener('pagehide', handler);
  }, [persistAllPositions]);

  // Function to get SVG path for priority icons (using correct Lucide icon paths)
  const getPriorityIconSvgPath = (priorityValue: number): string => {
    if (priorityValue >= 0.8) return 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'; // Flame
    if (priorityValue >= 0.6) return 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'; // Zap
    if (priorityValue >= 0.4) return 'M12.002 4l-3.091 6.261-6.91 1.01 5 4.87-1.18 6.88 6.18-3.25 6.181 3.25-1.18-6.88 5-4.87-6.91-1.01z'; // Triangle/Star
    if (priorityValue >= 0.2) return 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z'; // Circle
    return 'M12 5v14m-7-7 7 7 7-7'; // ArrowDown
  };

  // Function to get SVG path for status icons  
  const getStatusIconSvgPath = (status: string): string => {
    switch (status) {
      case 'NOT_STARTED': return 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z'; // Hexagon
      case 'PROPOSED': return 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'; // ClipboardList
      case 'PLANNED': return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'; // Calendar
      case 'IN_PROGRESS': return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'; // Clock
      case 'COMPLETED': return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'; // CheckCircle
      case 'BLOCKED': return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'; // AlertCircle
      case 'CANCELLED': return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'; // XCircle
      default: return 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z'; // Circle (fallback)
    }
  };
  const [showGraphPanel, setShowGraphPanel] = useState(false);
  const [nodeCounter, setNodeCounter] = useState(1);
  

  // Calculate dynamic positioning for panels and minimized buttons to avoid overlap
  const getPanelPosition = (panelType: 'graph' | 'create') => {
    const graphPanelHeight = 295; // Height of expanded graph panel
    const buttonHeight = 48; // Height of minimized buttons (h-12 = 48px)
    const compactSpacing = 12; // Spacing when panel is minimized
    const expandedSpacing = 1; // Spacing when panel is expanded
    
    if (panelType === 'graph') {
      // Graph panel/button is always at top position
      return { top: '20px' };
    } else if (panelType === 'create') {
      // Create button positioning depends only on graph panel state (comes right after it)
      let topOffset = 20; // Start position
      
      if (showGraphPanel) {
        topOffset += graphPanelHeight + expandedSpacing;
      } else {
        topOffset += buttonHeight + compactSpacing;
      }
      
      return { top: `${topOffset}px` };
    }
    
    return { top: '20px' };
  };

  // Additional edge operations
  const [updateEdgeMutation] = useMutation(UPDATE_EDGE, {
    refetchQueries: [
      // Refetch all edges for graph visualization (matches other mutations)
      { 
        query: GET_EDGES,
        variables: {}
      },
      // Refetch edges for current graph
      { 
        query: GET_EDGES, 
        variables: {
          where: {
            source: {
              graph: {
                id: currentGraph?.id
              }
            }
          }
        }
      }
    ],
    awaitRefetchQueries: true,
    optimisticResponse: (vars) => {
      return {
        updateEdges: {
          edges: [{
            id: vars.where.id,
            type: vars.update.type || 'DEFAULT_EDGE',
            weight: vars.update.weight || 0.8,
            source: { id: 'temp-source' },
            target: { id: 'temp-target' }
          }]
        }
      };
    },
    update(cache, { data }) {
      if (data?.updateEdges?.edges?.length > 0) {
        const updatedEdge = data.updateEdges.edges[0];
        
        // Update the GET_EDGES query cache
        const existingEdges = cache.readQuery({
          query: GET_EDGES,
          variables: {
            where: {
              source: {
                graph: {
                  id: currentGraph?.id
                }
              }
            }
          }
        });
        
        if (existingEdges) {
          cache.writeQuery({
            query: GET_EDGES,
            variables: {
              where: {
                source: {
                  graph: {
                    id: currentGraph?.id
                  }
                }
              }
            },
            data: {
              edges: (existingEdges as any).edges.map((edge: any) => 
                edge.id === updatedEdge.id ? updatedEdge : edge
              )
            }
          });
        }
      }
    }
  });

  // Apollo client for direct mutations
  const client = useApolloClient();

  const [deleteEdgeMutation] = useMutation(DELETE_EDGE, {
    refetchQueries: [
      // Refetch all edges for graph visualization (matches ConnectNodeModal)
      { 
        query: GET_EDGES,
        variables: {}
      },
      // Refetch edges for current graph
      { 
        query: GET_EDGES, 
        variables: {
          where: {
            source: {
              graph: {
                id: currentGraph?.id
              }
            }
          }
        }
      },
      // Refetch work items for current graph
      { 
        query: GET_WORK_ITEMS, 
        variables: currentGraph ? {
          where: {
            graph: {
              id: currentGraph.id
            }
          }
        } : {}
      }
    ],
    awaitRefetchQueries: true,
    optimisticResponse: () => {
      return {
        deleteEdges: {
          nodesDeleted: 0,
          relationshipsDeleted: 1
        }
      };
    }
  });

  const getGraphTypeIcon = (type?: string) => {
    switch (type) {
      case 'PROJECT':
        return <Folder className="h-4 w-4 text-white" />;
      case 'WORKSPACE':
        return <FolderOpen className="h-4 w-4 text-white" />;
      case 'SUBGRAPH':
        return <Plus className="h-4 w-4 text-white" />;
      case 'TEMPLATE':
        return <FileText className="h-4 w-4 text-white" />;
      default:
        return <Plus className="h-4 w-4 text-white" />;
    }
  };


  // Close menus when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = () => {
      setNodeMenu(prev => ({ ...prev, visible: false }));
      setEdgeMenu(prev => ({ ...prev, visible: false }));
      setEditingEdge(null); // Close inline edge editor
      setSelectedNode(null); // Clear selected node when clicking outside
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditingEdge(null);
        setNodeMenu(prev => ({ ...prev, visible: false }));
        setEdgeMenu(prev => ({ ...prev, visible: false }));
      }
      
      // Manual text refresh shortcut (R key)
      if (event.key === 'r' || event.key === 'R') {
        if (!event.ctrlKey && !event.metaKey && !event.altKey) { // Only plain R key
          event.preventDefault();
          refreshTextVisibility();
          console.log('[Graph Debug] Manual text visibility refresh triggered');
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);


  const handleNodeClick = useCallback((event: MouseEvent, node: WorkItem) => {
    event.stopPropagation();

    // Read mode through refs: this handler is bound to D3 elements once and
    // must see live state without forcing a full re-init.
    const growSource = connectionSourceRef.current;
    if (isConnectingRef.current && growSource) {
      // Complete connection (clicking the source itself just cancels)
      if (growSource !== node.id) {
        // Check if edge already exists
        if (edgeExists(growSource, node.id)) {
          setIsConnecting(false);
          setConnectionSource(null);
          return;
        }

        // Create edge in backend
        createEdgeMutation({
          variables: {
            input: [{
              type: selectedRelationTypeRef.current,
              weight: 0.8,
              source: { connect: { where: { node: { id: growSource } } } },
              target: { connect: { where: { node: { id: node.id } } } },
            }]
          }
        }).then((result) => {
          const createdEdgeId = result?.data?.createEdges?.edges?.[0]?.id;
          if (createdEdgeId) {
            undoStackRef.current.push({
              label: 'Connect items',
              undo: async () => {
                await deleteEdgeMutation({ variables: { where: { id: createdEdgeId } } });
              }
            });
          }
        }).catch(() => {
          // Error handled by GraphQL
        });
        // Don't reinitialize - let refetchQueries handle the update
      }

      setIsConnecting(false);
      setConnectionSource(null);
    } else if (node.subgraphId) {
      // Altium-style sheet symbol: a plain click descends into its sub-graph.
      // (Grow/connect is handled above; drag is suppressed by mousedownNodeRef;
      // edit/relationship icons stopPropagation, so this only fires on a plain
      // click of a sheet node.) Called via ref to avoid re-binding the handler.
      descendIntoRef.current(node.subgraphId);
    } else {
      // Handle node selection with 2-item ring buffer
      setSelectedNodes(prev => {
        const newSet = new Set(prev);
        
        if (newSet.has(node.id)) {
          // If clicking on already selected node, deselect it
          newSet.delete(node.id);
        } else {
          // Add node to selection
          newSet.add(node.id);
          
          // Implement 2-item ring buffer: remove oldest if we exceed 2
          if (newSet.size > 2) {
            const allNodes = Array.from(newSet);
            const oldestNode = allNodes[0]; // Remove first (oldest) node
            newSet.delete(oldestNode);
          }
        }
        
        return newSet;
      });
      
      // Update single selected node for backwards compatibility
      setSelectedNode(node);
      
      // Clear any selected edge when selecting nodes
      setEditingEdge(null);
      
      // Apply glow effect immediately without waiting for useEffect
      applyNodeGlowImmediately(node);
    }
  }, [isConnecting, connectionSource, selectedRelationType]);

  // Remove unused handleEdgeClick to fix TypeScript warning

  const workItems: WorkItem[] = workItemsData?.workItems || [];
  
  // Text refresh utility function
  const refreshTextVisibility = useCallback(() => {
    if (!d3 || !containerRef.current) return;
    
    const svg = d3.select(containerRef.current).select('svg');
    const g = svg.select('.main-group');
    
    // Get current zoom scale
    const currentTransform = d3.zoomTransform(svg.node() as Element);
    const scale = currentTransform.k;
    
    // Force refresh all text elements with proper LOD opacities
    setTimeout(() => {
      (g.selectAll('.node-type-text') as any)
        .style('visibility', 'visible')
        .style('opacity', getSmoothedOpacity(scale, LOD_THRESHOLDS.FAR));
      (g.selectAll('.node-title-text') as any)
        .style('visibility', 'visible')
        .style('opacity', getSmoothedOpacity(scale, LOD_THRESHOLDS.MEDIUM));
      (g.selectAll('.node-description-text') as any)
        .style('visibility', 'visible')
        .style('opacity', getSmoothedOpacity(scale, LOD_THRESHOLDS.CLOSE));
    }, 100); // Small delay to ensure DOM is updated
  }, []);

  // Refetch data when graph changes
  useEffect(() => {
    if (currentGraph) {
      refetch();
      refetchEdges();
    }
  }, [currentGraph?.id, refetch, refetchEdges]);
  
  // Refresh text visibility after data changes - DISABLED to prevent conflicts
  // useEffect(() => {
  //   if (workItems && edgesData?.edges) {
  //     refreshTextVisibility();
  //   }
  // }, [workItems?.length, edgesData?.edges?.length, refreshTextVisibility]);
  
  const workItemEdges: WorkItemEdge[] = [];
  
  // Add edges from Neo4j Edge entities
  if (edgesData?.edges) {
    edgesData.edges.forEach((edge: any) => {
      workItemEdges.push({
        id: edge.id,
        source: edge.source.id,
        target: edge.target.id,
        type: edge.type,
        strength: edge.weight || 0.8,
        description: getRelationshipConfig(edge.type as RelationshipType).label
      });
    });
  }
  
  // Extract edges from legacy dependencies (fallback)
  workItems.forEach(item => {
    if (item.dependencies) {
      item.dependencies.forEach((dep: WorkItem) => {
        // Only add if not already added from Edge entities
        const exists = workItemEdges.some(e => e.source === dep.id && e.target === item.id);
        if (!exists) {
          workItemEdges.push({
            id: `edge-${dep.id}-${item.id}`,
            source: dep.id,
            target: item.id,
            type: 'DEPENDS_ON' as RelationshipType,
            strength: 0.8,
            description: 'dependency relationship'
          });
        }
      });
    }
  });

  // Validate and sanitize data before D3 processing
  const currentValidationResult = validateGraphData(workItems, workItemEdges);
  
  // Debug logging for data validation issues
  useEffect(() => {
    console.log('[Graph Debug] Data validation result:', {
      totalWorkItems: workItems.length,
      totalEdges: workItemEdges.length,
      validNodes: currentValidationResult.validNodes.length,
      validEdges: currentValidationResult.validEdges.length,
      errors: currentValidationResult.errors,
      warnings: currentValidationResult.warnings
    });
    
    if (workItems.length > 0 && currentValidationResult.validNodes.length === 0) {
      console.error('[Graph Debug] CRITICAL: All nodes filtered out by validation!', {
        rawWorkItems: workItems,
        validationResult: currentValidationResult
      });
    }
  }, [workItems.length, currentValidationResult.validNodes.length, currentValidationResult.errors.length]);
  
  // Update validation state
  useEffect(() => {
    setValidationResult(currentValidationResult);
    
  }, [currentValidationResult.errors.length, currentValidationResult.warnings.length]);

  const validatedNodes = currentValidationResult.validNodes;
  const validatedEdges = currentValidationResult.validEdges;
  
  const nodes = [
    // Real nodes from database with smart initial positioning
    ...validatedNodes.map((item, index) => {
      // Check if this node has any connections
      const hasConnections = validatedEdges.some(edge => 
        edge.source.id === item.id || edge.target.id === item.id
      );
      
      // Snapshot-authoritative layout: a node the user has positioned
      // (saved position is not the (0,0) default) loads PINNED via fx/fy, so
      // the force simulation physically cannot drift a tidy arrangement. New
      // / never-placed nodes stay free to be laid out, then get saved (and
      // thus pinned next load) by the autosave below.
      const isPlaced = !(item.positionX === 0 && item.positionY === 0);
      let x = item.positionX;
      let y = item.positionY;

      // Unplaced (never-positioned) nodes start on a CLEAN grid spread sized to
      // the node count, spacing > collision diameter (~224) so there are no
      // initial overlaps. Physics then REFINES this (links pull connected nodes
      // together, collision holds the gap) and settles fast & clean — far
      // better than exploding a pile at the origin. Jitter breaks symmetry.
      if (!isPlaced) {
        const cols = Math.max(1, Math.ceil(Math.sqrt(validatedNodes.length)));
        const spacing = 260;
        const half = (cols * spacing) / 2;
        x = (index % cols) * spacing - half + ((index * 13) % 23) - 11;
        y = Math.floor(index / cols) * spacing - half + ((index * 7) % 19) - 9;
      }

      const node = {
        ...item,
        x,
        y,
        fx: isPlaced ? x : null,
        fy: isPlaced ? y : null,
        priority: item.priority || 0
      };
      
      // DEBUG: Log if this node is being reset to origin
      if (x === 0 && y === 0 && item.positionX !== 0 && item.positionY !== 0) {
        console.log('[CRITICAL DEBUG] Node position being reset to origin:', item.id, 'was at:', item.positionX, item.positionY);
      }
      
      return node;
    })
  ];

  // Helper function to check if edge already exists
  const edgeExists = (sourceId: string, targetId: string): boolean => {
    return validatedEdges.some(edge => 
      (edge.source === sourceId && edge.target === targetId) ||
      (edge.source === targetId && edge.target === sourceId) // Check both directions
    );
  };
  
  // Define whether to show empty state overlay (but don't early return)
  const showEmptyStateOverlay = !loading && !error && nodes.length === 0;

  // Create hierarchical attraction links based on project structure
  const createHierarchicalLinks = (nodes: WorkItem[]) => {
    const hierarchyLinks: Array<{source: string, target: string, strength: number, distance: number}> = [];
    
    // Group nodes by type for easy lookup
    const nodesByType: Record<string, WorkItem[]> = {};
    nodes.forEach(node => {
      if (!nodesByType[node.type]) {
        nodesByType[node.type] = [];
      }
      nodesByType[node.type].push(node);
    });
    
    // Define hierarchical relationships
    const epics = nodesByType['EPIC'] || [];
    const milestones = nodesByType['MILESTONE'] || [];
    const features = nodesByType['FEATURE'] || [];
    const tasks = nodesByType['TASK'] || [];
    const bugs = nodesByType['BUG'] || [];
    const outcomes = nodesByType['OUTCOME'] || [];
    
    // EPIC -> MILESTONE attraction (strong)
    epics.forEach(epic => {
      milestones.forEach(milestone => {
        hierarchyLinks.push({
          source: epic.id,
          target: milestone.id,
          strength: 0.1, // Weaker attraction for better spacing
          distance: 250 // Larger distance for clear edge visibility
        });
      });
    });
    
    // MILESTONE -> FEATURE attraction
    milestones.forEach(milestone => {
      features.forEach(feature => {
        hierarchyLinks.push({
          source: milestone.id,
          target: feature.id,
          strength: 0.08,
          distance: 220
        });
      });
    });
    
    // FEATURE -> TASK/BUG attraction (tasks attach to features)
    features.forEach(feature => {
      tasks.forEach(task => {
        hierarchyLinks.push({
          source: feature.id,
          target: task.id,
          strength: 0.1, // Weaker attachment for better spacing
          distance: 200
        });
      });
      bugs.forEach(bug => {
        hierarchyLinks.push({
          source: feature.id,
          target: bug.id,
          strength: 0.1, // Weaker attachment for better spacing
          distance: 200
        });
      });
    });
    
    // EPIC -> OUTCOME attraction (outcomes relate to epics)
    epics.forEach(epic => {
      outcomes.forEach(outcome => {
        hierarchyLinks.push({
          source: epic.id,
          target: outcome.id,
          strength: 0.06,
          distance: 280
        });
      });
    });
    
    return hierarchyLinks;
  };

  // Initialize empty visualization canvas
  const initializeEmptyVisualization = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    
    // Check if this is the first initialization or we need to preserve existing structure
    const existingMainGroup = svg.select('g.main-graph-group');
    const isFirstInit = existingMainGroup.empty();
    
    // Store current zoom transform if preserving structure
    let currentTransform = null;
    if (!isFirstInit) {
      currentTransform = d3.zoomTransform(svg.node()!);
    }
    
    if (isFirstInit) {
      // First initialization - clear everything and create core structure
      svg.selectAll('*').remove();
      d3.select(containerRef.current).selectAll('.node-labels-container').remove();
    } else {
      // Surgical update - only clear data elements, preserve core structure
      existingMainGroup.selectAll('.nodes-group').remove();
      existingMainGroup.selectAll('.edges-group').remove();
      existingMainGroup.selectAll('.edge-labels-group').remove();
      d3.select(containerRef.current).selectAll('.node-labels-container').remove();
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr('width', width).attr('height', height);
    
    // Create zoom behavior for empty canvas with reversed wheel direction
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .wheelDelta((event: WheelEvent) => {
        // Reverse wheel direction: negative deltaY for zoom in, positive for zoom out
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * -1;
      })
      .on('zoom', (event) => {
        const g = svg.select('g.main-graph-group');
        if (!g.empty()) {
          g.attr('transform', event.transform);
        }
      });

    const g = isFirstInit ? svg.append('g').attr('class', 'main-graph-group') : existingMainGroup;
    
    // Create grid pattern and overlay (only on first init)
    if (isFirstInit) {
      // Add subtle grid pattern that moves with camera
      const gridDefs = svg.append('defs');
      const pattern = gridDefs.append('pattern')
        .attr('id', 'grid-pattern')
        .attr('width', 100)
        .attr('height', 100)
        .attr('patternUnits', 'userSpaceOnUse');
      
      // Grid lines
      pattern.append('path')
        .attr('d', 'M 100 0 L 0 0 0 100')
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.03)')
        .attr('stroke-width', 1);
      
      // Add grid overlay
      const gridOverlay = g.append('rect')
        .attr('class', 'grid-overlay')
        .attr('x', -10000)
        .attr('y', -10000)
        .attr('width', 20000)
        .attr('height', 20000)
        .attr('fill', 'url(#grid-pattern)')
        .attr('pointer-events', 'none');
    }

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    
    // Restore zoom transform if this is a surgical update
    if (!isFirstInit && currentTransform) {
      svg.call(zoom.transform, currentTransform);
    }
  }, []);

  // Grow-a-child: predict the natural child type for a parent (kid-simple
  // defaults — the user can retype later with one click)
  const childTypeFor = (parentType?: string): string => {
    switch (parentType) {
      case 'EPIC': return 'FEATURE';
      case 'MILESTONE': return 'TASK';
      case 'OUTCOME': return 'FEATURE';
      case 'FEATURE': return 'TASK';
      default: return 'TASK';
    }
  };

  // Inline node creation function
  const createInlineNode = async (
    x: number,
    y: number,
    options?: { type?: string; connectFrom?: { id: string; type?: string } }
  ) => {
    // Create inline node function
    if (!currentGraph?.id) {
      // No current graph selected
      return;
    }

    try {
      // Generate a unique name that doesn't conflict with existing nodes
      let nodeTitle = `New Work Item ${nodeCounter}`;
      let attempts = 0;
      
      // Check if name already exists and generate a new one if needed
      while (validatedNodes.some(node => node.title.toLowerCase().trim() === nodeTitle.toLowerCase().trim()) && attempts < 100) {
        attempts++;
        nodeTitle = `New Work Item ${nodeCounter + attempts}`;
      }
      
      // Update counter for next node
      if (attempts > 0) {
        setNodeCounter(prev => prev + attempts);
      }
      
      
      const workItemInput = {
        title: nodeTitle,
        description: DEFAULT_NODE_CONFIG.description,
        type: options?.type ?? DEFAULT_NODE_CONFIG.type,
        status: DEFAULT_NODE_CONFIG.status,
        priority: 0.0,
        positionX: x,
        positionY: y,
        positionZ: 0,
        radius: 1.0,
        theta: 0.0,
        phi: 0.0,

        owner: {
          connect: {
            where: { node: { id: currentUser?.id } }
          }
        },
        graph: {
          connect: {
            where: { node: { id: currentGraph.id } }
          }
        }
      };

      const result = await createNodeMutation({
        variables: { input: [workItemInput] }
      });

      if (result.data) {
        setNodeCounter(prev => prev + 1);
        const newNode = result.data.createWorkItems?.workItems?.[0];

        // Grow mode: wire the new node to its source immediately
        let grownEdgeId: string | undefined;
        if (newNode?.id && options?.connectFrom) {
          const edgeResult = await createEdgeMutation({
            variables: {
              input: [{
                type: 'IS_PART_OF',
                weight: 0.8,
                source: { connect: { where: { node: { id: newNode.id } } } },
                target: { connect: { where: { node: { id: options.connectFrom.id } } } }
              }]
            }
          }).catch(() => undefined); /* edge failure shouldn't kill the node */
          grownEdgeId = edgeResult?.data?.createEdges?.edges?.[0]?.id;
        }

        if (newNode?.id) {
          const createdId = newNode.id;
          const edgeToRemove = grownEdgeId;
          undoStackRef.current.push({
            label: 'Create item',
            undo: async () => {
              // edges first — orphan edges break the whole edges query
              if (edgeToRemove) {
                await deleteEdgeMutation({ variables: { where: { id: edgeToRemove } } }).catch(() => {});
              }
              await deleteWorkItemMutation({ variables: { where: { id: createdId } } });
            }
          });
        }

        // The name is the next thing a person wants to set — put them
        // straight into an inline rename, no modal (interaction-model W2/W3)
        if (newNode?.id) {
          setInlineEdit({ nodeId: newNode.id, value: newNode.title || nodeTitle, original: newNode.title || nodeTitle, graphX: x, graphY: y });
        }
        return newNode;
      }
    } catch (error) {
      console.error('[Create Work Item Error]', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create work item';
      showError(errorMessage);
    }
    return undefined;
  };

  // Helper function to calculate node dimensions (shared between init and update)
  const getNodeDimensions = useCallback((d: WorkItem) => {
    // Larger base dimensions by type - increased for 3-line support
    const baseDimensions = (() => {
      switch (d.type) {
        case 'EPIC': return { width: 200, height: 120 };
        case 'MILESTONE': return { width: 190, height: 115 };
        case 'FEATURE': return { width: 180, height: 110 };
        case 'OUTCOME': return { width: 185, height: 115 };
        case 'TASK': return { width: 170, height: 105 };
        case 'BUG': return { width: 165, height: 100 };
        case 'IDEA': return { width: 160, height: 95 };
        default: return { width: 170, height: 105 };
      }
    })();

    // Use base width for consistent layout
    const width = baseDimensions.width;

    // Calculate actual text wrapping based on word breaks - up to 3 lines
    const maxCharsPerLine = Math.floor(width / 8); // ~8px per character for more conservative wrapping
    const words = d.title.split(' ');
    let lines = 1;
    let currentLineLength = 0;

    for (const word of words) {
      const wordLength = word.length;
      // Check if adding this word would exceed line length
      if (currentLineLength + wordLength + 1 > maxCharsPerLine && currentLineLength > 0) {
        lines++;
        currentLineLength = wordLength;
        if (lines >= 3) break; // Maximum 3 lines
      } else {
        currentLineLength += wordLength + (currentLineLength > 0 ? 1 : 0); // +1 for space
      }
    }

    lines = Math.min(lines, 3); // Maximum 3 lines

    // Height is the SUM of the content rows, not a guess: title bar (28) +
    // gap (12) + title lines (16 each) + description row (22 when present) +
    // status/priority block (42) anchored at the bottom. A fixed base height
    // let long titles overlap the status row.
    const contentHeight = 28 + 12 + lines * 16 + (d.description ? 22 : 6) + 42;
    const finalHeight = Math.max(baseDimensions.height, contentHeight);

    return {
      width: width,
      height: finalHeight,
      titleLines: lines,
      maxCharsPerLine: maxCharsPerLine
    };
  }, []);

  // Smart data update function - only reinitializes when necessary, preserves camera position
  const updateVisualizationData = useCallback(() => {
    if (!simulationRef.current || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const simulation = simulationRef.current;

    // Get current data counts from DOM
    const currentNodeCount = svg.select('.nodes-group').selectAll('.node').size();
    const currentEdgeCount = svg.select('.edges-group').selectAll('.edge').size();
    const newNodeCount = nodes.length;
    const newEdgeCount = validatedEdges.length;

    // Check if we need full reinitialization (node/edge count changed)
    const needsReinit = (currentNodeCount !== newNodeCount) || (currentEdgeCount !== newEdgeCount);
    
    if (needsReinit) {
      console.log('[Graph Debug] Data structure changed - triggering reinitialization with preserved camera');
      setReinitTrigger(prev => prev + 1);
      return;
    }

    // If counts are the same, update both simulation data AND DOM elements (for property changes)
    console.log('[Graph Debug] Data counts unchanged - updating simulation data and DOM elements');

    // Merge fresh data INTO the live simulation objects instead of swapping
    // arrays. The DOM is data-bound to these exact objects; replacing them
    // splits physics from rendering and edges visibly detach from nodes.
    const simNodes = simulation.nodes() as any[];
    const prevStatuses = new Map(simNodes.map((n: any) => [n.id, n.status]));
    const nodeMerge = mergeSimulationNodes(simNodes, nodes as any[]);

    // LIVE-3: work that just transitioned to completed celebrates.
    if (qualityProfileRef.current.particleCelebrations) {
      const layer = svg.select<SVGGElement>('.main-graph-group');
      if (!layer.empty()) {
        for (const id of nodeMerge.changedIds) {
          const node = nodeMerge.nodes.find((n: any) => n.id === id) as any;
          if (node && isCompletedStatus(node.status) && !isCompletedStatus(prevStatuses.get(id))) {
            spawnCelebration(layer, id, node.x || 0, node.y || 0, getTypeConfig(node.type as WorkItemType).hexColor);
          }
        }
      }
    }
    // Re-assert pins after the merge: mergeSimulationNodes intentionally
    // strips physics keys (fx/fy) to preserve live velocity, so placed nodes
    // arriving via a graph-switch or poll would otherwise come back unpinned
    // and drift. Snapshot-authoritative load must hold here too.
    if (!layoutReflowingRef.current) {
      (nodeMerge.nodes as any[]).forEach((node: any) => {
        const placed = !(((node.positionX ?? 0) === 0) && ((node.positionY ?? 0) === 0));
        if (placed) {
          node.fx = node.positionX;
          node.fy = node.positionY;
          node.userPinned = true;
        }
      });
    }
    simulation.nodes(nodeMerge.nodes as any);
    const linkForce = simulation.force('link') as d3.ForceLink<any, any>;
    if (linkForce) {
      const edgeMerge = mergeSimulationEdges(
        linkForce.links() as any[],
        validatedEdges as any[],
        nodeMerge.nodes as Array<{ id: string }>
      );
      linkForce.links(edgeMerge.edges);
    }

    // UPDATE DOM ELEMENTS: Rebind data and update visual properties
    // Update node titles
    const nodeGroups = svg.select('.nodes-group').selectAll('.node');
    nodeGroups.each(function(d: any) {
      const nodeGroup = d3.select(this);
      // Find the updated node data by ID
      const updatedNode = nodes.find(n => n.id === d.id);
      if (!updatedNode) return;

      // Update title text elements (must mirror the creation path exactly,
      // or cards shift layout on every poll)
      nodeGroup.selectAll('.node-title-text').remove();
      const maxCharsPerLine = getNodeDimensions(updatedNode).maxCharsPerLine;
      const maxLines = 3;
      let lines: string[] = [];
      const words = updatedNode.title.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length > maxCharsPerLine && currentLine) {
          lines.push(currentLine);
          currentLine = word;
          if (lines.length >= maxLines) break;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine && lines.length < maxLines) {
        lines.push(currentLine);
      }
      if (lines.length === 0) {
        lines.push(updatedNode.title.substring(0, maxCharsPerLine - 3) + '...');
      }

      const dimensions = getNodeDimensions(updatedNode);
      const titleBarHeight = 28;
      const startY = -dimensions.height / 2 + titleBarHeight + 18;
      lines.forEach((line, index) => {
        nodeGroup.append('text')
          .attr('class', 'node-title-text')
          .attr('x', 0)
          .attr('y', startY + (index * 16))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(line)
          .style('font-size', '14px')
          .style('font-weight', '600')
          .style('fill', () => {
            const isCompleted = updatedNode.status === 'COMPLETED' || updatedNode.status === 'Completed' || updatedNode.status === 'Done' || updatedNode.status === 'DONE';
            return isCompleted ? '#9ca3af' : '#ffffff';
          })
          .style('pointer-events', 'none');
      });

      // Update node type badge text
      nodeGroup.select('.node-type-text')
        .text(() => {
          const config = getTypeConfig(updatedNode.type as WorkItemType);
          return config.label.toUpperCase();
        });

      // Update description
      nodeGroup.select('.node-description-text')
        .text(() => {
          if (!updatedNode.description) return '';
          const maxDescChars = 25;
          return updatedNode.description.length > maxDescChars
            ? updatedNode.description.substring(0, maxDescChars) + '...'
            : updatedNode.description;
        });
    });

    // Physics is one-shot: it settles a graph, then stays idle. A routine
    // data poll must NOT reheat a fully-placed (frozen) graph — that caused
    // perpetual drift. Only nudge the sim if there are still-unsettled
    // (unpinned / never-placed) nodes that actually need to find a spot.
    const hasUnpinned = (simulation.nodes() as any[]).some((n: any) => n.fx == null || n.fy == null);
    if (hasUnpinned) {
      simulation.alpha(0.1).restart();
    }

    console.log('[Graph Debug] Simulation data and DOM elements updated');
  }, [nodes, validatedEdges, getNodeDimensions]);

  // Define initializeVisualization function with access to nodes data
  const initializeVisualization = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Handle empty state
    if (nodes.length === 0) {
      initializeEmptyVisualization();
      return;
    }
    
    // PRESERVE EXISTING NODE POSITIONS before reinitialization
    const existingPositions = new Map();
    if (simulationRef.current) {
      simulationRef.current.nodes().forEach((node: any) => {
        if (node.x !== undefined && node.y !== undefined) {
          existingPositions.set(node.id, { x: node.x, y: node.y, vx: node.vx || 0, vy: node.vy || 0 });
        }
      });
    }

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    
    // Check if this is the first initialization or we need to preserve existing structure
    const existingMainGroup = svg.select('g.main-graph-group');
    const isFirstInit = existingMainGroup.empty();
    
    // Store current zoom transform if preserving structure
    let currentTransform = null;
    if (!isFirstInit) {
      currentTransform = d3.zoomTransform(svg.node()!);
    }
    
    if (isFirstInit) {
      // First initialization - clear everything and create core structure
      svg.selectAll('*').remove();
      d3.select(containerRef.current).selectAll('.node-labels-container').remove();
    } else {
      // Surgical update - only clear data elements, preserve core structure
      existingMainGroup.selectAll('.nodes-group').remove();
      existingMainGroup.selectAll('.edges-group').remove();
      existingMainGroup.selectAll('.edge-labels-group').remove();
      existingMainGroup.selectAll('.node-labels-container').remove();
      d3.select(containerRef.current).selectAll('.node-labels-container').remove();
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    svg.attr('width', width).attr('height', height);
    
    // Create or reuse zoom behavior with reversed wheel direction
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .wheelDelta((event: WheelEvent) => {
        // Reverse wheel direction: negative deltaY for zoom in, positive for zoom out
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * -1;
      });

    const g = isFirstInit ? svg.append('g').attr('class', 'main-graph-group') : existingMainGroup;

    // Create or reuse background for capturing clicks  
    let background = g.select('rect.background');
    if (background.empty()) {
      background = g.append('rect')
        .attr('class', 'background')
        .attr('x', -10000)
        .attr('y', -10000)
        .attr('width', 20000)
        .attr('height', 20000)
        .attr('fill', 'transparent')
        .style('cursor', 'default') as any;
    }

    // Create or reuse grid pattern and overlay (only on first init)
    if (isFirstInit) {
      // Add subtle grid pattern that moves with camera
      const gridDefs = svg.append('defs');
      const pattern = gridDefs.append('pattern')
        .attr('id', 'grid-pattern')
        .attr('width', 100)
        .attr('height', 100)
        .attr('patternUnits', 'userSpaceOnUse');
      
      // Grid lines
      pattern.append('path')
        .attr('d', 'M 100 0 L 0 0 0 100')
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.03)')
        .attr('stroke-width', 1);
      
      // Add grid overlay
      const gridOverlay = g.append('rect')
        .attr('class', 'grid-overlay')
        .attr('x', -10000)
        .attr('y', -10000)
        .attr('width', 20000)
        .attr('height', 20000)
        .attr('fill', 'url(#grid-pattern)')
        .attr('pointer-events', 'none');
    }

    // Apply zoom behavior to the svg (always, but preserve existing transform)
    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    
    // Restore zoom transform if this is a surgical update
    if (!isFirstInit && currentTransform) {
      svg.call(zoom.transform, currentTransform);
    }

    // Add click handler for context menu on background
    background.on('click', function(event: MouseEvent) {
      event.stopPropagation();

      // Grow mode: clicking empty space is the intuitive "make a new one
      // HERE, connected" — a kid's first guess is the right one. The new
      // node lands in inline rename. (Cancel = Esc / right-click / source.)
      if (isConnectingRef.current) {
        const growSource = connectionSourceRef.current;
        const sourceNode = (simulationRef.current?.nodes() as any[])?.find((n: any) => n.id === growSource);
        const [gx, gy] = d3.pointer(event, g.node() as any);
        setIsConnecting(false);
        setConnectionSource(null);
        if (growSource) {
          createInlineNode(gx, gy, {
            type: childTypeFor(sourceNode?.type),
            connectFrom: { id: growSource, type: sourceNode?.type }
          });
        }
        return;
      }

      // Check only the main dialogs that we care about
      const hasOpenDialogs =
        nodeMenu.visible ||
        edgeMenu.visible ||
        editingEdge !== null ||
        false; // Removed edge details dialog

      if (hasOpenDialogs) {
        // Close all dialogs and menus - first click
        setNodeMenu({ node: null, position: { x: 0, y: 0 }, visible: false });
        setEdgeMenu({ edge: null, position: { x: 0, y: 0 }, visible: false });
        setEditingEdge(null);
        setContextMenuPosition(null);
        return;
      }
      
      // Clear node selection when clicking on empty space
      if (selectedNode || selectedNodes.size > 0) {
        setSelectedNode(null);
        setSelectedNodes(new Set());
        return;
      }
      
      // Don't show context menu on single left-click in empty space - only on right-click
      // This prevents camera jumps from rapid context menu show/hide cycles
    });

    // Add right-click handler for context menu
    background.on('contextmenu', function(event: MouseEvent) {
      event.preventDefault();

      // Right-click cancels grow mode (alongside Esc and clicking the source)
      if (isConnectingRef.current) {
        setIsConnecting(false);
        setConnectionSource(null);
        return;
      }

      // Close all existing dialogs first (exclusive dialog behavior)
      setEditingEdge(null);

      const [graphX, graphY] = d3.pointer(event, g.node());
      
      setContextMenuPosition({
        x: event.clientX,
        y: event.clientY,
        graphX,
        graphY
      });
    });

    // Snapshot-authoritative init: a node the user has positioned (saved
    // position != the (0,0) default) is PINNED to that position so the force
    // simulation cannot drift a tidy layout across reloads. Only brand-new /
    // never-placed nodes are seeded near center and left free to flow.
    // (This block used to null every node's fx/fy unconditionally, which is
    //  why arrangements never survived a reload — the real drift bug.)
    const spreadCols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const spreadSpacing = 260; // > collision diameter so the spread has no overlaps
    const spreadHalf = (spreadCols * spreadSpacing) / 2;
    nodes.forEach((node: any, i: number) => {
      node.userPreferredPosition = null;
      node.userPreferenceVector = null;
      const placed = !(((node.positionX ?? 0) === 0) && ((node.positionY ?? 0) === 0));
      if (placed) {
        node.userPinned = true;
        node.x = node.positionX;
        node.y = node.positionY;
        node.fx = node.positionX;
        node.fy = node.positionY;
      } else {
        node.userPinned = false;
        node.fx = null;
        node.fy = null;
        // Clean grid spread (not a random pile) so physics refines from a
        // non-overlapping start.
        if (!node.x) node.x = (i % spreadCols) * spreadSpacing - spreadHalf + ((i * 13) % 23) - 11;
        if (!node.y) node.y = Math.floor(i / spreadCols) * spreadSpacing - spreadHalf + ((i * 7) % 19) - 9;
      }
    });

    // Viewport culling - only render visible nodes for performance
    const margin = 200;
    const visibleNodes = (currentTransform?.k || 1) < LOD_THRESHOLDS.VERY_FAR ? 
      nodes.filter((node: WorkItem) => {
        const nodeX = (node.positionX || 0) * (currentTransform?.k || 1) + (currentTransform?.x || 0);
        const nodeY = (node.positionY || 0) * (currentTransform?.k || 1) + (currentTransform?.y || 0);
        return nodeX >= -margin && nodeX <= width + margin && 
               nodeY >= -margin && nodeY <= height + margin;
      }) : nodes;
    
    // Simple 2D force simulation
    const simulation = d3.forceSimulation(visibleNodes as any);
    simulationRef.current = simulation; // Store reference for resize handling
    
    // RESTORE PRESERVED POSITIONS to prevent nodes jumping to origin
    if (existingPositions.size > 0) {
      simulation.nodes().forEach((node: any) => {
        const savedPos = existingPositions.get(node.id);
        if (savedPos) {
          node.x = savedPos.x;
          node.y = savedPos.y;
          node.vx = savedPos.vx;
          node.vy = savedPos.vy;
        }
      });
      // Stop simulation immediately to freeze positions
      simulation.alpha(0).stop();
    }
    
    // All force parameters come from the single source of truth in
    // physicsConfig.ts — see that file (and the debug console's drift metrics)
    // to reason about / tune why nodes settle and drift the way they do.
    const phys = DEFAULT_PHYSICS;

    // Hard minimum-edge-length constraint: connected nodes may never sit closer
    // than their edge label needs to display (d._minLen, cached by the link
    // distance accessor = halfDiag(src)+halfDiag(tgt)+labelW+pad). Position-based
    // like forceCollide, so it's a real floor, not just a spring preference. It
    // respects pinned nodes (fx set): a free node yields, two pinned nodes hold.
    const minEdgeForce = () => {
      for (const e of validatedEdges as any[]) {
        const s = e.source, t = e.target;
        if (!s || !t || typeof s.x !== 'number' || typeof t.x !== 'number') continue;
        const min = e._minLen || 0;
        if (min <= 0) continue;
        let dx = t.x - s.x, dy = t.y - s.y;
        let dist = Math.hypot(dx, dy);
        if (dist === 0) { dx = 1; dy = 0; dist = 1; } // arbitrary separation dir
        if (dist >= min) continue;
        const corr = ((min - dist) / dist) * 0.5; // ease toward the floor
        const ox = dx * corr, oy = dy * corr;
        const sFixed = s.fx != null, tFixed = t.fx != null;
        if (sFixed && tFixed) continue;
        if (sFixed) { t.x += ox * 2; t.y += oy * 2; }
        else if (tFixed) { s.x -= ox * 2; s.y -= oy * 2; }
        else { s.x -= ox; s.y -= oy; t.x += ox; t.y += oy; }
      }
    };

    simulation
      .force('link', d3.forceLink(validatedEdges)
        .id((d: any) => d.id)
        .distance((d: any) => {
          const currentDistance = Math.hypot((d.target.x || 0) - (d.source.x || 0), (d.target.y || 0) - (d.source.y || 0));
          const maxDistance = linkMaxDistance(width, height, phys);
          const preferred = currentDistance > maxDistance ? maxDistance : linkDistance(width, height, phys);
          // Floor: never pull connected nodes closer than their edge label
          // needs to display — the label width sets a minimum edge length so
          // it always fits in the border-to-border gap (edgeGeometry.minEdgeLength).
          const label = getRelationshipConfig(d.type as RelationshipType)?.label || '';
          // Slightly generous estimate of the rendered label box (10px/600 text
          // + icon + padding) so the gap never UNDER-shoots the real label.
          const labelW = label.length * 7 + 34;
          // Pass the edge direction so the minimum is just the per-angle border
          // reach + label + a small margin (not an oversized half-diagonal buffer).
          const dx = (d.target.x || 0) - (d.source.x || 0);
          const dy = (d.target.y || 0) - (d.source.y || 0);
          const minLen = minEdgeLength(getNodeDimensions(d.source), getNodeDimensions(d.target), labelW, dx, dy);
          d._minLen = minLen; // cached for the hard min-edge constraint below
          return Math.max(preferred, minLen);
        })
        .strength((d: any) => {
          const currentDistance = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
          return linkStrength(currentDistance, linkMaxDistance(width, height, phys), phys);
        })
      )
      .force('charge', d3.forceManyBody()
        .strength(phys.charge.strength)
        .distanceMax(phys.charge.distanceMax)
      )
      .force('center', d3.forceCenter(centerX, centerY).strength(phys.centering.center))
      .force('x', d3.forceX(centerX).strength(phys.centering.axis))
      .force('y', d3.forceY(centerY).strength(phys.centering.axis))
      .force('collision', d3.forceCollide()
        // Radius from the node's actual card geometry (half diagonal + padding).
        .radius((d: any) => collisionRadius(getNodeDimensions(d), phys))
        .strength(phys.collision.strength)
        .iterations(phys.collision.iterations)
      )
      .force('minEdge', minEdgeForce)
      .force('hierarchy', d3.forceLink()
        .id((d: any) => d.id)
        .links(createHierarchicalLinks(nodes))
        .distance((d: any) => d.distance || phys.hierarchy.distance)
        .strength((d: any) => d.strength || phys.hierarchy.strength)
      )
      .alphaTarget(phys.alpha.restTarget) // LIVE-6: physics rests when settled
      .alphaDecay(phys.alpha.decay)
      .velocityDecay(phys.alpha.velocityDecay);

    // Filter edges based on visible nodes for performance
    // Temporarily show ALL edges for debugging
    const visibleEdges = validatedEdges;
    
    // Debug: Log edge visibility
    
    // Create edges FIRST (so they render under nodes)
    const edgesGroup = g.append('g').attr('class', 'edges-group');
    
    // Create visible edge lines
    const linkElements = edgesGroup
      .selectAll('.edge')
      .data(visibleEdges)
      .enter()
      .append('line')
      .attr('class', (d: WorkItemEdge) => {
        let classes = 'edge';
        // After force-link binding, source/target are node objects at runtime
        const src = d.source as unknown as { status?: string };
        const tgt = d.target as unknown as { status?: string };
        const flowClass = edgeFlowClass(
          typeof src === 'object' ? src?.status : undefined,
          typeof tgt === 'object' ? tgt?.status : undefined
        );
        if (flowClass) {
          classes += ` ${flowClass}`;
        }
        // Add pulsing class if edge dialog is active
        if (editingEdge && editingEdge.edge && editingEdge.edge.id === d.id) {
          classes += ' dialog-active-pulse';
        }
        return classes;
      })
      .attr('stroke', (d: WorkItemEdge) => {
        // Use relationship color for active dialog (same as normal)
        const config = getRelationshipConfig(d.type as RelationshipType);
        return config.hexColor;
      })
      .attr('stroke-width', (d: WorkItemEdge) => {
        // Much thicker for active dialog
        if (editingEdge && editingEdge.edge && editingEdge.edge.id === d.id) {
          return 10; // Very thick to make it obvious
        }
        return (d.strength || 0.8) * 3;
      })
      .attr('stroke-opacity', (d: WorkItemEdge) => {
        // Full opacity for active dialog
        if (editingEdge && editingEdge.edge && editingEdge.edge.id === d.id) {
          return 1;
        }
        return 0.7;
      })
      .style('filter', (d: WorkItemEdge) => {
        // Apply pulsing glow to edges with active dialogs
        if (editingEdge && editingEdge.edge && editingEdge.edge.id === d.id) {
          return 'url(#dialog-glow)';
        }
        return null;
      })
      .on('mouseenter', function(event: MouseEvent, d: WorkItemEdge) {
        // Skip hover effect if edge has active dialog (glow is already applied)
        if ((editingEdge && editingEdge.edge && editingEdge.edge.id === d.id) ||
            false) { // Removed edge details dialog
          return;
        }
        
        // Add white border hover effect to edges
        d3.select(this)
          .style('stroke', '#ffffff')
          .style('stroke-width', '4')
          .style('stroke-opacity', '1')
          .style('filter', 'drop-shadow(0 0 4px #ffffff)');
      })
      .on('mouseleave', function(event: MouseEvent, d: WorkItemEdge) {
        // Skip hover reset if edge has active dialog (glow should remain)
        if ((editingEdge && editingEdge.edge && editingEdge.edge.id === d.id) ||
            false) { // Removed edge details dialog
          return;
        }
        
        // Restore original edge stroke
        const config = getRelationshipConfig(d.type as RelationshipType);
        d3.select(this)
          .style('stroke', config.hexColor)
          .style('stroke-width', (d.strength || 0.8) * 3)
          .style('stroke-opacity', '0.7')
          .style('filter', null);
      });
    
    // Create invisible thicker clickable areas for easier interaction
    const clickableEdges = edgesGroup
      .selectAll('.edge-clickable')
      .data(visibleEdges)
      .enter()
      .append('line')
      .attr('class', 'edge-clickable')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 12)
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d: WorkItemEdge) => {
        event.stopPropagation();
        
        // Position dialog to the side of the edge to avoid obstructing the glow
        const offset = 100; // Distance from edge
        const dialogWidth = 300; // Estimated dialog width
        const dialogHeight = 200; // Estimated dialog height
        
        // Calculate position to the right side, but check boundaries
        let x = event.clientX + offset;
        let y = event.clientY - dialogHeight / 2;
        
        // If dialog would go off right edge, position to the left
        if (x + dialogWidth > window.innerWidth - 20) {
          x = event.clientX - offset - dialogWidth;
        }
        
        // Keep dialog within vertical bounds
        if (y < 20) y = 20;
        if (y + dialogHeight > window.innerHeight - 20) {
          y = window.innerHeight - dialogHeight - 20;
        }
        
        setSelectedEdge(d);
      })
      .on('mouseover', function(event: MouseEvent, d: WorkItemEdge) {
        // Highlight the corresponding visible edge
        linkElements
          .filter((edge: WorkItemEdge) => edge.id === d.id)
          .attr('stroke-width', (d: WorkItemEdge) => ((d.strength || 0.8) * 3) + 2)
          .attr('stroke-opacity', 1);
      })
      .on('mouseout', function(event: MouseEvent, d: WorkItemEdge) {
        // Reset the corresponding visible edge
        linkElements
          .filter((edge: WorkItemEdge) => edge.id === d.id)
          .attr('stroke-width', (d: WorkItemEdge) => (d.strength || 0.8) * 3)
          .attr('stroke-opacity', 0.7);
      });

    // Create or get defs element for filters
    let filterDefs = svg.select('defs') as any;
    if (filterDefs.empty()) {
      filterDefs = svg.append('defs') as any;
    }
    
    // Add drop shadow filter for nodes
    const dropShadowFilter = filterDefs.append('filter')
      .attr('id', 'node-drop-shadow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    dropShadowFilter.append('feDropShadow')
      .attr('dx', 2)
      .attr('dy', 3)
      .attr('stdDeviation', 3)
      .attr('flood-color', 'rgba(0, 0, 0, 0.4)')
      .attr('flood-opacity', 1);

    // Create nodes AFTER edges (so they render on top)
    const nodeElements = g.append('g')
      .attr('class', 'nodes-group')
      .selectAll('.node')
      .data(visibleNodes)
      .enter()
      .append('g')
      .attr('class', (d: WorkItem) => `node node-type-${d.type.toLowerCase()}`)
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          
          // Check if this is an edge creation attempt (Alt/Option key held)
          if (event.sourceEvent.altKey) {
            mousedownNodeRef.current = d;
            return;
          }
          
          // Store initial position and connected nodes for cluster behavior
          d._dragStart = { x: d.x, y: d.y };
          d._connectedNodes = validatedEdges
            .filter(edge => edge.source.id === d.id || edge.target.id === d.id)
            .map(edge => {
              const connectedNode = edge.source.id === d.id ? edge.target : edge.source;
              return {
                node: connectedNode,
                edge, // keep the edge so the drag clamp can read its _minLen
                wasFixed: connectedNode.fx !== null || connectedNode.fy !== null
              };
            });
          
          // Normal drag behavior
          if (!event.active) simulation.alphaTarget(0.2).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          // Calculate drag distance from start
          const dragDistance = Math.sqrt(
            Math.pow(event.x - d._dragStart.x, 2) + 
            Math.pow(event.y - d._dragStart.y, 2)
          );
          
          // Threshold for switching from cluster movement to edge stretching
          const stretchThreshold = 80; // pixels
          const clustering = dragDistance < stretchThreshold;

          // Drag-time hard clamp: the dragged node may not get closer than the
          // edge-label minimum to a connected neighbor that ISN'T moving with it
          // (cluster-co-moving free neighbors keep their distance automatically,
          // so they're excluded). This is the interactive twin of the minEdge
          // force, which only governs the auto-layout.
          const clampNeighbors = (d._connectedNodes || [])
            .filter((c: any) => !(clustering && !c.wasFixed))
            .map((c: any) => ({ x: c.node.x || 0, y: c.node.y || 0, minLen: c.edge?._minLen || 0 }));
          const tgt = clampToMinNeighbors({ x: event.x, y: event.y }, clampNeighbors);

          if (clustering) {
            // Cluster movement - move connected nodes together
            const deltaX = tgt.x - d.x;
            const deltaY = tgt.y - d.y;

            d._connectedNodes.forEach(({ node, wasFixed }: { node: any, wasFixed: boolean }) => {
              if (!wasFixed) { // Only move if not already fixed by user previously
                node.fx = (node.fx || node.x) + deltaX;
                node.fy = (node.fy || node.y) + deltaY;
                node.x = node.fx;
                node.y = node.fy;
              }
            });
          } else {
            // Edge stretching - release connected nodes to move independently
            d._connectedNodes.forEach(({ node, wasFixed }: { node: any, wasFixed: boolean }) => {
              if (!wasFixed) { // Only release if we were controlling it and it wasn't user-fixed
                node.fx = null;
                node.fy = null;
              }
            });
          }

          // Move the dragged node to the clamped target
          d.fx = tgt.x;
          d.fy = tgt.y;
          d.x = d.fx;
          d.y = d.fy;
        })
        .on('end', (event, d: any) => {
          // Check if this is edge creation end
          if (mousedownNodeRef.current && mousedownNodeRef.current.id !== d.id) {
            const sourceId = mousedownNodeRef.current.id;
            const targetId = d.id;
            
            // Check if edge already exists
            if (edgeExists(sourceId, targetId)) {
                  mousedownNodeRef.current = null;
              return;
            }
            
            
            // Create edge using GraphQL mutation
            createEdgeMutation({
              variables: {
                input: [{
                  type: 'DEFAULT_EDGE',
                  weight: 0.8,
                  source: { connect: { where: { node: { id: sourceId } } } },
                  target: { connect: { where: { node: { id: targetId } } } },
                }]
              }
            }).then(() => {
              }).catch(() => {
            });
            
            mousedownNodeRef.current = null;
            return;
          }
          
          // Sticky drag behavior - node stays where user put it
          if (!event.active) simulation.alphaTarget(0.1).restart();
          
          // Keep the node fixed at the dropped position
          // Don't release fx/fy - let the node stay where the user put it
          // The physics will adapt around the fixed position
          
          // Save the new position to the database
          saveNodePosition(d.id, d.fx, d.fy);
          
          // Let the simulation cool to a full stop after the neighbors settle
          setTimeout(() => {
            simulation.alphaTarget(0);
          }, 1000);
          mousedownNodeRef.current = null;
        }));

    // LIVE-8: wake-up entrance — nodes float in by recency on first open.
    // Never delays interactivity; skipped at LOW/MEDIUM tier and reduced motion.
    if (isFirstInit && qualityProfileRef.current.entranceAnimation && visibleNodes.length > 0) {
      const byRecency = [...visibleNodes]
        .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
        .reduce((ranks, node, rank) => ranks.set(node.id, rank), new Map<string, number>());
      const stagger = Math.min(40, 500 / visibleNodes.length);
      nodeElements
        .style('opacity', 0)
        .transition()
        .delay((d: WorkItem) => (byRecency.get(d.id) ?? 0) * stagger)
        .duration(300)
        .style('opacity', 1)
        .on('end', function() {
          // Clear the inline opacity so hover-dim CSS can take over later
          d3.select(this).style('opacity', null);
        });
    }

    // LIVE-7: hovering a node illuminates its 1-hop neighborhood — everything
    // else dims. Precomputed adjacency keeps the handler a Map lookup.
    const neighborhood = buildNeighborhood(validatedEdges as any);
    nodeElements
      .on('mouseenter.neighborhood', function(_event, hovered: any) {
        if (mousedownNodeRef.current) return;
        const hood = neighborhood.get(hovered.id);
        nodeElements.classed('dim-for-hover', (d: any) => d.id !== hovered.id && !hood?.nodes.has(d.id));
        linkElements.classed('dim-for-hover', (d: any) => !hood?.edges.has(d.id));
        clickableEdges.classed('dim-for-hover', (d: any) => !hood?.edges.has(d.id));
        edgeLabelGroups.classed('dim-for-hover', (d: any) => !hood?.edges.has(d.id));
      })
      .on('mouseleave.neighborhood', () => {
        nodeElements.classed('dim-for-hover', false);
        linkElements.classed('dim-for-hover', false);
        clickableEdges.classed('dim-for-hover', false);
        edgeLabelGroups.classed('dim-for-hover', false);
      })
      // Double-click a node → rename in place, no modal (W2)
      .on('dblclick.rename', (event: MouseEvent, d: any) => {
        event.stopPropagation();
        setInlineEdit({ nodeId: d.id, value: d.title || '', original: d.title || '', graphX: d.x || 0, graphY: d.y || 0 });
      });


    // Monopoly-style rectangular nodes with colored title bars
    // getNodeDimensions is now defined outside and shared with updateVisualizationData

    // Sheet-symbol "stack" — offset rects BEHIND the card imply this node opens
    // a whole sub-graph (Altium-style hierarchical sheet). Rendered first so the
    // main card sits on top. Only for nodes that drill into a sub-graph.
    [10, 5].forEach((off) => {
      nodeElements.filter((d: WorkItem) => !!d.subgraphId).append('rect')
        .attr('class', 'node-subgraph-stack')
        .attr('x', (d: WorkItem) => -getNodeDimensions(d).width / 2 + off)
        .attr('y', (d: WorkItem) => -getNodeDimensions(d).height / 2 + off)
        .attr('width', (d: WorkItem) => getNodeDimensions(d).width)
        .attr('height', (d: WorkItem) => getNodeDimensions(d).height)
        .attr('rx', 8)
        .attr('fill', '#1f2937')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 1.5)
        .style('opacity', 0.45)
        .style('pointer-events', 'none');
    });

    // Main node rectangle (dark theme background)
    nodeElements.append('rect')
      .attr('class', (d: WorkItem) => {
        let classes = 'node-bg';
        const lifeClass = nodeLifeClasses(d.status);
        if (lifeClass) {
          classes += ` ${lifeClass}`;
        }
        // Add pulsing class if node dialog is active
        if (nodeMenu.visible && nodeMenu.node && nodeMenu.node.id === d.id) {
          classes += ' dialog-active-pulse';
        }
        return classes;
      })
      .attr('x', (d: WorkItem) => -getNodeDimensions(d).width / 2)
      .attr('y', (d: WorkItem) => -getNodeDimensions(d).height / 2)
      .attr('width', (d: WorkItem) => getNodeDimensions(d).width)
      .attr('height', (d: WorkItem) => getNodeDimensions(d).height)
      .attr('rx', 8)
      .attr('fill', (d: WorkItem) => {
        // Dim completed nodes
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          return '#374151'; // Dark gray for completed nodes
        }
        return '#1f2937'; // Dark background consistent with theme
      })
      .style('filter', (d: WorkItem) => {
        const typeConfig = getTypeConfig(d.type as WorkItemType);
        return nodeGlowFilter(d.priority, typeConfig.hexColor, qualityProfileRef.current.glowEffects);
      })
      .attr('stroke', (d: WorkItem) => {
        // Use node type color for active dialog
        if (nodeMenu.visible && nodeMenu.node && nodeMenu.node.id === d.id) {
          const typeConfig = getTypeConfig(d.type as WorkItemType);
          return typeConfig.hexColor;
        }
        // Highlight selected node with type color border
        if (selectedNode && selectedNode.id === d.id) {
          const typeConfig = getTypeConfig(d.type as WorkItemType);
          return typeConfig.hexColor;
        }
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          return '#4b5563';
        }
        // Sheet symbols (drill into a sub-graph) get an indigo accent border.
        if (d.subgraphId) {
          return '#818cf8';
        }
        // In-progress work breathes with its type color (LIVE-1)
        if (isActiveStatus(d.status)) {
          return getTypeConfig(d.type as WorkItemType).hexColor;
        }
        return '#4b5563'; // Gray border
      })
      .attr('stroke-width', (d: WorkItem) => {
        // Much thicker for active dialog to make it obvious
        if (nodeMenu.visible && nodeMenu.node && nodeMenu.node.id === d.id) {
          return 8; // Very thick
        }
        // Thicker border for selected node
        if (selectedNode && selectedNode.id === d.id) {
          return 3;
        }
        if (d.subgraphId) {
          return 2.5; // Sheet symbol — emphasize it's a container
        }
        return 1.5;
      })
      .style('stroke-opacity', (d: WorkItem) => {
        // Full opacity for active dialog
        if (nodeMenu.visible && nodeMenu.node && nodeMenu.node.id === d.id) {
          return 1;
        }
        return 1;
      });

    // Colored title bar at top (like Monopoly property cards)
    const titleBarHeight = 28;
    nodeElements.append('rect')
      .attr('class', 'node-title-bar')
      .attr('x', (d: WorkItem) => -getNodeDimensions(d).width / 2 + 2)
      .attr('y', (d: WorkItem) => -getNodeDimensions(d).height / 2 + 2)
      .attr('width', (d: WorkItem) => getNodeDimensions(d).width - 4)
      .attr('height', titleBarHeight)
      .attr('rx', 6)
      .attr('fill', (d: WorkItem) => {
        // Dim completed nodes title bars
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          return '#9ca3af'; // Gray for completed nodes
        }
        
        // Use centralized color system
        return getTypeConfig(d.type as WorkItemType).hexColor;
      })
      .attr('stroke', (d: WorkItem) => {
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          return '#6b7280';
        }
        
        // Use centralized color system - slightly darker for border
        const typeConfig = getTypeConfig(d.type as WorkItemType);
        return typeConfig.hexColor;
      })
      .attr('stroke-width', 1.5);

    // Node type text in colored title bar (centered)
    nodeElements.append('text')
      .attr('class', 'node-type-text')
      .attr('x', 0)
      .attr('y', (d: WorkItem) => -getNodeDimensions(d).height / 2 + titleBarHeight / 2 + 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text((d: WorkItem) => d.type)
      .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.FAR ? 1 : 0)
      .style('font-size', '13px')
      .style('font-weight', '700')
      .style('fill', (d: WorkItem) => {
        const config = getTypeConfig(d.type as WorkItemType);
        return config.hexColor;
      })
      .style('pointer-events', 'none');

    // Edit icon in title bar (centered vertically, left side) - scales with zoom
    const iconSize = Math.max(16, Math.min(24, titleBarHeight * 0.7));
    const editIcons = nodeElements.append('g')
      .attr('class', 'node-edit-icon')
      .attr('transform', (d: WorkItem) => {
        const x = -getNodeDimensions(d).width / 2 + iconSize / 2 + 12;
        const y = -getNodeDimensions(d).height / 2 + 2 + titleBarHeight / 2;
        return `translate(${x}, ${y}) scale(${1 / (currentTransform?.k || 1)})`;
      })
      .style('cursor', 'pointer')
      .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.FAR ? 0.85 : 0)
      .style('pointer-events', 'all');
    
    // Edit icon background - scales with icon
    const editBg = editIcons.append('rect')
      .attr('class', 'edit-bg')
      .attr('x', -iconSize/2)
      .attr('y', -iconSize/2)
      .attr('width', iconSize)
      .attr('height', iconSize)
      .attr('rx', 3)
      .attr('fill', 'rgba(0, 0, 0, 0.7)')
      .attr('stroke', 'rgba(255, 255, 255, 0.8)')
      .attr('stroke-width', 1);
    
    // Simple gear using text (emoji) - proper size
    editIcons.append('text')
      .attr('class', 'edit-gear')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', `${iconSize * 1.1}px`)
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .text('⚙');
    
    // Hover effects for the entire edit icon group
    editIcons
      .on('mouseenter', function() {
        const icon = d3.select(this);
        // Brighten background and add glow
        icon.select('.edit-bg')
          .transition().duration(200)
          .attr('fill', 'rgba(59, 130, 246, 0.8)')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2);
        
        // Highlight background
        icon.select('.edit-bg')
          .transition().duration(200)
          .attr('fill', 'rgba(59, 130, 246, 0.9)')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2);
        
        // Scale up text slightly
        icon.select('.edit-gear')
          .transition().duration(200)
          .style('font-size', `${iconSize * 1.3}px`);
      })
      .on('mouseleave', function() {
        const icon = d3.select(this);
        // Return to normal state
        icon.select('.edit-bg')
          .transition().duration(200)
          .attr('fill', 'rgba(0, 0, 0, 0.7)')
          .attr('stroke', 'rgba(255, 255, 255, 0.8)')
          .attr('stroke-width', 1);
        
        // Scale text back to normal
        icon.select('.edit-gear')
          .transition().duration(200)
          .style('font-size', `${iconSize * 1.1}px`);
      });
    
    // Edit icon click handler - opens edit modal
    editIcons.on('click', (event: MouseEvent, d: WorkItem) => {
      event.stopPropagation();
      event.preventDefault();
      
      // Set selected node and show details modal for editing
      setSelectedNode(d);
      lastSelectedNodeRef.current = d; // Track last selected
      applyNodeGlowImmediately(d);
      setShowNodeDetailsModal(true);
    });

    // Relationship creation icon in title bar (centered vertically, right side) - mirrors edit icon
    const relationshipIcons = nodeElements.append('g')
      .attr('class', 'node-relationship-icon')
      .attr('transform', (d: WorkItem) => {
        const x = getNodeDimensions(d).width / 2 - iconSize / 2 - 12; // Right side, mirrored from edit icon
        const y = -getNodeDimensions(d).height / 2 + 2 + titleBarHeight / 2;
        return `translate(${x}, ${y}) scale(${1 / (currentTransform?.k || 1)})`;
      })
      .style('cursor', 'pointer')
      .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.FAR ? 0.85 : 0)
      .style('pointer-events', 'all');
    
    // Relationship icon background - same as edit icon
    relationshipIcons.append('rect')
      .attr('class', 'relationship-bg')
      .attr('x', -iconSize/2)
      .attr('y', -iconSize/2)
      .attr('width', iconSize)
      .attr('height', iconSize)
      .attr('rx', 3)
      .attr('fill', 'rgba(0, 0, 0, 0.7)')
      .attr('stroke', 'rgba(255, 255, 255, 0.8)')
      .attr('stroke-width', 1);
    
    // Plus sign using text - matching the gear styling
    relationshipIcons.append('text')
      .attr('class', 'relationship-plus')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', `${iconSize * 1.2}px`) // Slightly bigger than gear for visual balance
      .style('font-weight', 'bold')
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .text('+');
    
    // Hover effects for relationship icon - mirroring edit icon
    relationshipIcons
      .on('mouseenter', function() {
        const icon = d3.select(this);
        
        // Grow background
        icon.select('.relationship-bg')
          .transition().duration(200)
          .attr('width', iconSize * 1.2)
          .attr('height', iconSize * 1.2)
          .attr('x', -iconSize * 0.6)
          .attr('y', -iconSize * 0.6)
          .attr('fill', 'rgba(34, 197, 94, 0.9)') // Green color for relationship creation
          .attr('stroke', 'rgba(255, 255, 255, 1.0)');
        
        // Scale up text slightly
        icon.select('.relationship-plus')
          .transition().duration(200)
          .style('font-size', `${iconSize * 1.4}px`);
      })
      .on('mouseleave', function() {
        const icon = d3.select(this);
        
        // Shrink background back
        icon.select('.relationship-bg')
          .transition().duration(200)
          .attr('width', iconSize)
          .attr('height', iconSize)
          .attr('x', -iconSize/2)
          .attr('y', -iconSize/2)
          .attr('fill', 'rgba(0, 0, 0, 0.7)')
          .attr('stroke', 'rgba(255, 255, 255, 0.8)');
        
        // Scale text back to normal
        icon.select('.relationship-plus')
          .transition().duration(200)
          .style('font-size', `${iconSize * 1.2}px`);
      });

    // Relationship icon click handler - just opens relationship window
    relationshipIcons.on('click', (event: MouseEvent, d: WorkItem) => {
      event.stopPropagation();
      event.preventDefault();

      // "+" means GROW: enter grow mode wired to this node. Click empty
      // space → new connected item right there; click another node →
      // connect to it; Esc / right-click / clicking this node → cancel.
      // No modals, no instructions-as-UI (interaction-model W3).
      setNodeMenu({ node: null, position: { x: 0, y: 0 }, visible: false });
      setEditingEdge(null);
      setShowRelationshipWindow(false);
      setConnectionSource(d.id);
      setIsConnecting(true);
    });

    // Sheet-symbol affordances: a "descend" glyph (bottom-right) + a child
    // count line, only for nodes that drill into a sub-graph.
    const sheetNodes = nodeElements.filter((d: WorkItem) => !!d.subgraphId);

    const descendIcon = sheetNodes.append('g')
      .attr('class', 'node-descend-icon')
      .attr('transform', (d: WorkItem) => {
        const x = getNodeDimensions(d).width / 2 - iconSize / 2 - 8;
        const y = getNodeDimensions(d).height / 2 - iconSize / 2 - 6;
        return `translate(${x}, ${y}) scale(${1 / (currentTransform?.k || 1)})`;
      })
      .style('cursor', 'pointer')
      .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.FAR ? 0.9 : 0)
      .style('pointer-events', 'all');
    descendIcon.append('rect')
      .attr('class', 'descend-bg')
      .attr('x', -iconSize / 2)
      .attr('y', -iconSize / 2)
      .attr('width', iconSize)
      .attr('height', iconSize)
      .attr('rx', 4)
      .attr('fill', 'rgba(99, 102, 241, 0.9)')
      .attr('stroke', 'rgba(255, 255, 255, 0.85)')
      .attr('stroke-width', 1);
    descendIcon.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', `${iconSize * 0.95}px`)
      .style('font-weight', 'bold')
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .text('⤢');
    descendIcon
      .on('mouseenter', function() {
        d3.select(this).select('.descend-bg').transition().duration(150)
          .attr('fill', 'rgba(129, 140, 248, 1)');
      })
      .on('mouseleave', function() {
        d3.select(this).select('.descend-bg').transition().duration(150)
          .attr('fill', 'rgba(99, 102, 241, 0.9)');
      })
      .on('click', (event: MouseEvent, d: WorkItem) => {
        event.stopPropagation();
        event.preventDefault();
        if (d.subgraphId) descendIntoRef.current(d.subgraphId);
      });

    // Child-graph count line (LOD-gated like the description text).
    sheetNodes.append('text')
      .attr('class', 'node-subgraph-count')
      .attr('x', 0)
      .attr('y', (d: WorkItem) => getNodeDimensions(d).height / 2 - 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-weight', '600')
      .style('fill', '#a5b4fc')
      .style('pointer-events', 'none')
      .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.CLOSE ? 1 : 0)
      .text((d: WorkItem) => {
        const n = d.subgraph?.nodeCount ?? 0;
        const e = d.subgraph?.edgeCount ?? 0;
        return `▸ ${n} nodes · ${e} edges`;
      });

    // Node title section - with text wrapping
    nodeElements.each(function(d: WorkItem) {
      const nodeGroup = d3.select(this);
      const dimensions = getNodeDimensions(d);
      const { maxCharsPerLine } = dimensions;
      
      // Split title into lines with proper word wrapping - 3-line maximum
      const words = d.title.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      let hasMoreText = false;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        // Check if this line would be too long
        if (testLine.length <= maxCharsPerLine) {
          currentLine = testLine;
        } else {
          // Need to wrap to next line
          if (lines.length < 2) {
            // Can still add another line (we allow up to 3 lines)
            lines.push(currentLine || word); // Handle case where first word is too long
            currentLine = currentLine ? word : '';
          } else {
            // Already have 2 lines, this would be fourth line - truncate
            hasMoreText = true;
            break;
          }
        }
      }
      
      // Add the final line
      if (currentLine) {
        if (hasMoreText && lines.length === 2) {
          // Truncate third line with ellipsis
          const availableSpace = maxCharsPerLine - 3; // Reserve space for "..."
          const truncated = currentLine.length > availableSpace 
            ? currentLine.substring(0, availableSpace) + '...'
            : currentLine + '...';
          lines.push(truncated);
        } else {
          lines.push(currentLine);
        }
      }
      
      // Ensure we always have at least one line
      if (lines.length === 0) {
        lines.push(d.title.substring(0, maxCharsPerLine - 3) + '...');
      }
      
      // Create text elements for each line
      const startY = -dimensions.height / 2 + titleBarHeight + 18;
      lines.forEach((line, index) => {
        nodeGroup.append('text')
          .attr('class', 'node-title-text')
          .attr('x', 0)
          .attr('y', startY + (index * 16))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(line)
          .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.MEDIUM ? 1 : 0)
          .style('font-size', '14px')
          .style('font-weight', '600')
          .style('fill', () => {
            const isCompleted = d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE';
            return isCompleted ? '#9ca3af' : '#ffffff';
          })
          .style('pointer-events', 'none');
      });

    });

    // Description section - bigger and more readable
    nodeElements.append('text')
      .attr('class', 'node-description-text')
      .attr('x', 0)
      .attr('y', (d: WorkItem) => {
        const dimensions = getNodeDimensions(d);
        const titleLinesHeight = dimensions.titleLines * 16;
        return -dimensions.height / 2 + titleBarHeight + 18 + titleLinesHeight + 8;
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text((d: WorkItem) => {
        if (!d.description) return '';
        const maxLength = Math.floor(getNodeDimensions(d).width / 6.5);
        // Hide description if too long instead of truncating
        return d.description.length > maxLength ? '' : d.description;
      })
      .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.CLOSE ? 1 : 0)
      .style('font-size', '11px')
      .style('font-weight', '400')
      .style('fill', (d: WorkItem) => {
        const isCompleted = d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE';
        return isCompleted ? '#6b7280' : '#d1d5db';
      })
      .style('pointer-events', 'none');

    // Status progress bar and percentage (bottom left)
    nodeElements.each(function(d: WorkItem) {
      const nodeGroup = d3.select(this);
      const dimensions = getNodeDimensions(d);
      
      // Calculate status percentage using centralized function
      const statusPercentage = getStatusCompletionPercentage(d.status as WorkItemStatus);
      
      // Get status color from centralized constants
      const statusColor = getStatusConfig(d.status as WorkItemStatus).hexColor;
      
      const barWidth = 40;
      const barHeight = 3;
      const barX = -dimensions.width / 2 + 8;
      const barY = dimensions.height / 2 - 15;
      
      // Status progress bar background
      nodeGroup.append('rect')
        .attr('class', 'status-progress-bg')
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', barWidth)
        .attr('height', barHeight)
        .attr('rx', 1.5)
        .attr('fill', '#374151')
        .style('pointer-events', 'none');
      
      // Status progress bar fill
      nodeGroup.append('rect')
        .attr('class', 'status-progress-fill')
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', (barWidth * statusPercentage) / 100)
        .attr('height', barHeight)
        .attr('rx', 1.5)
        .attr('fill', statusColor)
        .style('pointer-events', 'none');
      
      // Status icon (SVG) - using centralized icon system
      const statusLabelX = barX + barWidth / 2 - 8;
      const statusIconX = statusLabelX + 15; // Position after "Status" text
      const statusConfig = getStatusConfig(d.status as any);
      const statusIconSvg = nodeGroup.append('svg')
        .attr('class', 'status-icon-svg')
        .attr('x', statusIconX)
        .attr('y', barY - 22)
        .attr('width', 10)
        .attr('height', 10)
        .attr('viewBox', '0 0 24 24')
        .style('pointer-events', 'none');
      
      // Add the correct icon path based on status
      const statusIconPath = getStatusIconSvgPath(d.status as string);
      if (statusIconPath) {
        statusIconSvg.append('path')
          .attr('d', statusIconPath)
          .attr('fill', 'none')
          .attr('stroke', statusColor)
          .attr('stroke-width', '2')
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round');
      }

      // Status label (above percentage)
      nodeGroup.append('text')
        .attr('class', 'status-label-text')
        .attr('x', barX + barWidth / 2 - 8)
        .attr('y', barY - 16)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text('Status')
        .style('font-size', '8px')
        .style('font-weight', '400')
        .style('fill', '#9ca3af')
        .style('pointer-events', 'none');

      // Status percentage text (above bar)
      nodeGroup.append('text')
        .attr('class', 'status-percentage-text')
        .attr('x', barX + barWidth / 2)
        .attr('y', barY - 4)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(`${statusPercentage}%`)
        .style('font-size', '9px')
        .style('font-weight', '500')
        .style('fill', statusColor)
        .style('pointer-events', 'none');
    });

    // Priority progress bar and percentage (bottom right)
    nodeElements.each(function(d: WorkItem) {
      const nodeGroup = d3.select(this);
      const dimensions = getNodeDimensions(d);
      
      const priority = d.priority || 0;
      const priorityPercentage = Math.round(priority * 100);
      
      // Get priority color
      const priorityColor = (() => {
        if (priority >= 0.8) return '#ef4444'; // Critical - red
        if (priority >= 0.6) return '#f97316'; // High - orange  
        if (priority >= 0.4) return '#eab308'; // Medium - yellow
        if (priority >= 0.2) return '#3b82f6'; // Low - blue
        return '#6b7280'; // Minimal - gray
      })();
      
      const barWidth = 40;
      const barHeight = 3;
      const barX = dimensions.width / 2 - 8 - barWidth;
      const barY = dimensions.height / 2 - 15;
      
      // Priority progress bar background
      nodeGroup.append('rect')
        .attr('class', 'priority-progress-bg')
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', barWidth)
        .attr('height', barHeight)
        .attr('rx', 1.5)
        .attr('fill', '#374151')
        .style('pointer-events', 'none');
      
      // Priority progress bar fill
      nodeGroup.append('rect')
        .attr('class', 'priority-progress-fill')
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', (barWidth * priorityPercentage) / 100)
        .attr('height', barHeight)
        .attr('rx', 1.5)
        .attr('fill', priorityColor)
        .style('pointer-events', 'none');
      
      // Priority icon (SVG) - using correct icon based on priority value
      const priorityLabelX = barX + barWidth / 2;
      const priorityIconX = priorityLabelX + 18 - 2; // Position after "Priority" text, shifted left by 2
      const prioritySvg = nodeGroup.append('svg')
        .attr('class', 'priority-icon-svg')
        .attr('x', priorityIconX)
        .attr('y', barY - 22)
        .attr('width', 10)
        .attr('height', 10)
        .attr('viewBox', '0 0 24 24')
        .style('pointer-events', 'none');
      
      // Add correct priority icon path
      const priorityIconPath = getPriorityIconSvgPath(priority);
      if (priorityIconPath) {
        prioritySvg.append('path')
          .attr('d', priorityIconPath)
          .attr('fill', 'none')
          .attr('stroke', priorityColor)
          .attr('stroke-width', '2')
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round');
      }

      // Priority label (above percentage)
      nodeGroup.append('text')
        .attr('class', 'priority-label-text')
        .attr('x', barX + barWidth / 2)
        .attr('y', barY - 16)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text('Priority')
        .style('font-size', '8px')
        .style('font-weight', '400')
        .style('fill', '#9ca3af')
        .style('pointer-events', 'none');

      // Priority percentage text (above bar)
      nodeGroup.append('text')
        .attr('class', 'priority-percentage-text')
        .attr('x', barX + barWidth / 2)
        .attr('y', barY - 4)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(`${priorityPercentage}%`)
        .style('font-size', '9px')
        .style('font-weight', '500')
        .style('fill', priorityColor)
        .style('pointer-events', 'none');
    });

    // Add completion indicators (checkmarks) for completed nodes
    nodeElements.each(function(d: WorkItem) {
      const nodeGroup = d3.select(this);
      
      // Add checkmark for completed nodes
      if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
        nodeGroup.append('text')
          .attr('class', 'completion-indicator')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', '96')
          .attr('font-weight', '900')
          .attr('fill', '#10b981')
          .attr('stroke', '#10b981')
          .attr('stroke-width', '1')
          .attr('pointer-events', 'none')
          .text('✓');
      }
      
    });

    // Create arrow symbols for middle of edges
    const arrowElements = g.append('g')
      .attr('class', 'arrows-group')
      .selectAll('.arrow')
      .data(validatedEdges)
      .enter()
      .append('path')
      .attr('class', 'arrow')
      .attr('d', 'M-16,-8 L0,0 L-16,8 L-8,0 Z')
      .attr('fill', (d: WorkItemEdge) => {
        // Use the relationship color for consistency with edge stroke
        const config = getRelationshipConfig(d.type as RelationshipType);
        return config.hexColor;
      })
      .attr('stroke', (d: WorkItemEdge) => {
        // Always use relationship color for consistency
        const config = getRelationshipConfig(d.type as RelationshipType);
        return config.hexColor;
      })
      .attr('stroke-width', 1)
      .attr('opacity', 1);

    // Create edge label groups with rounded rectangles and text (only for visible edges)
    // NOTE: this group is appended after the nodes group, so nodes-group is
    // raised afterwards — node cards and their controls must always stack
    // above edge labels, or labels steal clicks meant for node buttons.
    const edgeLabelGroups = g.append('g')
      .attr('class', 'edge-labels-group')
      .selectAll('.edge-label-group')
      .data(visibleEdges)
      .enter()
      .append('g')
      .attr('class', 'edge-label-group')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('click', function(event: MouseEvent, d: WorkItemEdge) {
        event.stopPropagation();
        event.preventDefault(); // Prevent any default behavior
        
        // Open the editor, remembering WHERE the edge was clicked so the
        // window can position itself away from the edge it edits
        setShowRelationshipWindow(true);
        setEditingEdge({
          edge: d,
          position: { x: event.clientX, y: event.clientY }
        });
        setDragOffset({ x: 0, y: 0 }); // Reset drag offset
      });

    // Nodes always stack ABOVE edge labels/arrows — labels were stealing
    // clicks from node controls (the + icon) when they drifted over a card.
    g.select('.nodes-group').raise();

    // Add text labels first to measure their size
    edgeLabelGroups
      .append('text')
      .attr('class', 'edge-label')
      .attr('x', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .text((d: WorkItemEdge) => {
        const config = getRelationshipConfig(d.type as RelationshipType);
        return config.label;
      })
      .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.CLOSE ? 1 : 0);

    // Add icons positioned to the left of text
    edgeLabelGroups
      .append('foreignObject')
      .style('opacity', (currentTransform?.k || 1) >= LOD_THRESHOLDS.CLOSE ? 1 : 0)
      .attr('class', 'edge-label-icon')
      .attr('width', 14)
      .attr('height', 14)
      .attr('x', -7) // Will be adjusted after measuring text
      .attr('y', -7)
      .style('pointer-events', 'none')
      .each(function(d: WorkItemEdge) {
        // Get the exact same centralized React component as the dropdown
        const { IconComponent } = getRelationshipIconForD3(d.type as RelationshipType);
        
        // Create a unique container for each icon
        const uniqueId = `edge-icon-${d.id}`;
        
        d3.select(this)
          .style('width', '14px')
          .style('height', '14px')
          .style('display', 'flex')
          .style('align-items', 'center')
          .style('justify-content', 'center')
          .html(`<div id="${uniqueId}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"></div>`);
        
        // Render the centralized React component in the unique container
        const container = document.getElementById(uniqueId);
        if (container) {
          const root = ReactDOM.createRoot(container);
          root.render(React.createElement(IconComponent, { 
            className: "h-3 w-3 text-white"
          }));
        }
      });

    // Add rounded rectangle backgrounds after measuring content
    edgeLabelGroups
      .insert('rect', ':first-child') // Insert before other elements
      .attr('class', 'edge-label-bg')
      .attr('rx', 8)
      .attr('ry', 8)
      .style('fill', (d: WorkItemEdge) => {
        const config = getRelationshipConfig(d.type as RelationshipType);
        return config.hexColor;
      })
      .style('opacity', 1)
      .style('stroke', (d: WorkItemEdge) => {
        const config = getRelationshipConfig(d.type as RelationshipType);
        return config.hexColor;
      })
      .style('stroke-width', 1.5)
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('mouseover', function() {
        d3.select(this)
          .style('opacity', 1)
          .style('stroke', '#ffffff')
          .style('stroke-width', 2);
      })
      .on('mouseout', function() {
        d3.select(this)
          .style('opacity', 0.9)
          .style('stroke', '#1f2937')
          .style('stroke-width', 1);
      });

    // Size and position elements after text is rendered
    setTimeout(() => {
      edgeLabelGroups.each(function(d: WorkItemEdge) {
        const group = d3.select(this);
        const textElement = group.select('.edge-label').node() as SVGTextElement;
        
        if (textElement) {
          const bbox = textElement.getBBox();
          const iconWidth = 14;
          const spacing = 8;
          const paddingLeft = 6;
          const paddingRight = 8;
          const totalWidth = paddingLeft + iconWidth + spacing + bbox.width + paddingRight;
          const totalHeight = Math.max(22, bbox.height + 8);
          
          // Update rectangle size and center it
          group.select('.edge-label-bg')
            .attr('width', totalWidth)
            .attr('height', totalHeight)
            .attr('x', -totalWidth / 2)
            .attr('y', -totalHeight / 2);
          
          // Position icon on the left side with proper padding
          group.select('.edge-label-icon')
            .attr('x', -totalWidth / 2 + paddingLeft)
            .attr('y', -totalHeight / 2 + (totalHeight - 14) / 2);
          
          // Position text next to icon (left-aligned, not centered)
          group.select('.edge-label')
            .attr('x', -totalWidth / 2 + paddingLeft + iconWidth + spacing)
            .attr('y', 0)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle');
        }
      });
    }, 150);

    // Node click handling with edge creation
    nodeElements
    .on('click', (event: MouseEvent, d: any) => {
      // Shift+Click for edge creation
      if (event.shiftKey) {
        event.stopPropagation();
        event.preventDefault();
        
        if (!mousedownNodeRef.current) {
          // First click - select source node
          mousedownNodeRef.current = d;
          
          // Visual feedback - highlight source node
          d3.select(event.currentTarget as SVGElement)
            .select('rect')
            .style('stroke', '#10b981')
            .style('stroke-width', 3);
        } else if (mousedownNodeRef.current.id !== d.id) {
          // Second click - create edge with professional animation
          const sourceNode = mousedownNodeRef.current;
          const targetNode = d;
          
          // Check if edge already exists
          if (edgeExists(sourceNode.id, targetNode.id)) {
              // Remove source node highlight
            nodeElements.selectAll('rect')
              .style('stroke', null)
              .style('stroke-width', null);
            mousedownNodeRef.current = null;
            return;
          }
          
          
          // Remove source node highlight
          nodeElements.selectAll('rect')
            .style('stroke', null)
            .style('stroke-width', null);
          
          // Create temporary dotted edge for animation
          const tempEdgeId = `temp-edge-${sourceNode.id}-${targetNode.id}`;
          const edgeContainer = svg.select('.edges-group');
          
          const tempEdge = edgeContainer
            .append('line')
            .attr('id', tempEdgeId)
            .attr('class', 'temp-edge')
            .attr('x1', sourceNode.x)
            .attr('y1', sourceNode.y)
            .attr('x2', targetNode.x)
            .attr('y2', targetNode.y)
            .style('stroke', '#10b981')
            .style('stroke-width', 2)
            .style('stroke-dasharray', '8,4')
            .style('opacity', 0);
          
          // Fade in dotted edge smoothly
          tempEdge
            .transition()
            .duration(3000)
            .ease(d3.easeQuadInOut)
            .style('opacity', 1)
            .on('end', () => {
              // After fade in, animate to solid smoothly
              tempEdge
                .transition()
                .duration(12000)
                .ease(d3.easeQuadInOut)
                .style('stroke-dasharray', '0,0')
                .style('stroke-width', 3)
                .on('end', () => {
                  // Create actual edge in database
                  createEdgeMutation({
                    variables: {
                      input: [{
                        type: 'DEFAULT_EDGE',
                        weight: 0.8,
                        source: { connect: { where: { node: { id: sourceNode.id } } } },
                        target: { connect: { where: { node: { id: targetNode.id } } } },
                      }]
                    }
                  }).then(() => {
                            // Remove temporary edge after real edge is added
                    setTimeout(() => {
                      tempEdge.remove();
                    }, 200);
                  }).catch(() => {
                          // Remove temp edge on error
                    tempEdge.remove();
                  });
                });
            });
          
          mousedownNodeRef.current = null;
        }
        return;
      }
      
      // Regular node clicks (right-click menu)
      setTimeout(() => {
        if (!mousedownNodeRef.current) {
          handleNodeClick(event, d);
        }
      }, 10);
    })
    .on('contextmenu', (event: MouseEvent, d: any) => {
      event.preventDefault();
      event.stopPropagation();

      // Show context menu for advanced actions
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const menuWidth = 320;
        const menuHeight = 500;
        const padding = 10;

        let x = event.clientX - containerRect.left;
        let y = event.clientY - containerRect.top;

        if (x + menuWidth > window.innerWidth - padding) {
          x = window.innerWidth - menuWidth - padding;
        }
        if (y + menuHeight > window.innerHeight - padding) {
          y = window.innerHeight - menuHeight - padding;
        }
        if (x < padding) {
          x = padding;
        }
        if (y < padding) {
          y = padding;
        }

        setNodeMenu({
          node: d,
          position: {
            x,
            y
          },
          visible: true
        });

        // Select the node and apply glow effect
        setSelectedNode(d);
        lastSelectedNodeRef.current = d;
        applyNodeGlowImmediately(d);
      }
    })
    .on('touchstart', function(event: TouchEvent, d: any) {
      // Track touch for long-press detection
      const element = d3.select(this);
      const touch = event.touches[0];

      const touchData = {
        startTime: Date.now(),
        startX: touch.clientX,
        startY: touch.clientY,
        timeout: null as any,
        moved: false
      };

      // Store touch data on the element
      (element.node() as any).__touchData = touchData;

      // Add visual feedback for long-press
      const feedbackCircle = element.append('circle')
        .attr('class', 'long-press-feedback')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 0)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('opacity', 0.6);

      // Animate growing circle for visual feedback
      feedbackCircle
        .transition()
        .duration(500)
        .attr('r', 30)
        .attr('opacity', 0);

      // Set timeout for long-press
      touchData.timeout = setTimeout(() => {
        if (!touchData.moved) {
          // Long press detected - show context menu
          event.preventDefault();
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setNodeMenu({
              node: d,
              position: {
                x: touch.clientX - containerRect.left,
                y: touch.clientY - containerRect.top
              },
              visible: true
            });

            // Select the node and apply glow effect
            setSelectedNode(d);
            lastSelectedNodeRef.current = d;
            applyNodeGlowImmediately(d);

            // Haptic feedback (if supported)
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }
        }
        feedbackCircle.remove();
      }, 500);
    })
    .on('touchmove', function(event: TouchEvent) {
      // Track movement to cancel long-press if user is dragging
      const element = d3.select(this);
      const touchData = (element.node() as any).__touchData;

      if (touchData) {
        const touch = event.touches[0];
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // If moved more than 10px, cancel long-press
        if (distance > 10) {
          touchData.moved = true;
          if (touchData.timeout) {
            clearTimeout(touchData.timeout);
          }
          // Remove visual feedback
          element.select('.long-press-feedback').remove();
        }
      }
    })
    .on('touchend', function() {
      // Clean up long-press detection
      const element = d3.select(this);
      const touchData = (element.node() as any).__touchData;

      if (touchData) {
        if (touchData.timeout) {
          clearTimeout(touchData.timeout);
        }
        delete (element.node() as any).__touchData;
      }

      // Remove visual feedback
      element.select('.long-press-feedback').remove();
    })
    .on('touchcancel', function() {
      // Clean up on touch cancel
      const element = d3.select(this);
      const touchData = (element.node() as any).__touchData;

      if (touchData && touchData.timeout) {
        clearTimeout(touchData.timeout);
        delete (element.node() as any).__touchData;
      }

      // Remove visual feedback
      element.select('.long-press-feedback').remove();
    });

    let labelAvoidCounter = 0;
    const updateEdgePositions = (forceAvoid = false) => {
      // Border-to-border anchors: the edge starts/ends where the center line
      // crosses each card's border, not at the buried center. Computed once per
      // edge per tick (shared datum) so line, hitbox and arrow agree. The anchor
      // slides around the border as the nodes move — shortest border path.
      linkElements.each(function (d: any) {
        d._ep = edgeBorderEndpoints(
          { x: d.source.x || 0, y: d.source.y || 0 }, getNodeDimensions(d.source),
          { x: d.target.x || 0, y: d.target.y || 0 }, getNodeDimensions(d.target)
        );
      });

      // Update visible edge positions
      linkElements
        .attr('x1', (d: any) => d._ep.x1)
        .attr('y1', (d: any) => d._ep.y1)
        .attr('x2', (d: any) => d._ep.x2)
        .attr('y2', (d: any) => d._ep.y2);

      // Update clickable edge positions
      clickableEdges
        .attr('x1', (d: any) => d._ep.x1)
        .attr('y1', (d: any) => d._ep.y1)
        .attr('x2', (d: any) => d._ep.x2)
        .attr('y2', (d: any) => d._ep.y2);

      // Arrow sits at the TARGET border, pointing into the node.
      arrowElements
        .attr('transform', (d: any) => {
          const ep = d._ep;
          const angle = Math.atan2(ep.y2 - ep.y1, ep.x2 - ep.x1) * 180 / Math.PI;
          return `translate(${ep.x2},${ep.y2}) rotate(${angle})`;
        });

      // Edge labels: auto-centered in the clear span between the two node
      // cards, pushed off ALL node cards once the simulation settles, and
      // slidable by the user (d.labelT persists because the data merge keeps
      // edge object identity stable; d.labelTUser pins a manual slide).
      labelAvoidCounter++;
      // forceAvoid lets a one-shot caller (layout settle / pinned graphs that
      // don't tick) run a full label de-overlap pass on demand.
      const runAvoidance = forceAvoid || (simulation.alpha() < 0.1 && labelAvoidCounter % 15 === 0);
      const obstacles = runAvoidance
        ? (simulation.nodes() as any[]).map((n: any) => {
            const dims = getNodeDimensions(n);
            return { x: n.x || 0, y: n.y || 0, width: dims.width, height: dims.height };
          })
        : null;

      // Labels placed earlier in this pass become obstacles for later ones,
      // so labels avoid each other as well as every node card.
      const placedLabels: Array<{ x: number; y: number; width: number; height: number }> = [];
      edgeLabelGroups
        .attr('transform', function(d: any) {
          const source = { x: d.source.x || 0, y: d.source.y || 0 };
          const target = { x: d.target.x || 0, y: d.target.y || 0 };
          const sourceDims = getNodeDimensions(d.source);
          const targetDims = getNodeDimensions(d.target);

          let labelW = 60;
          let labelH = 20;
          if (obstacles) {
            const bbox = (this as SVGGElement).getBBox();
            labelW = bbox.width || 60;
            labelH = bbox.height || 20;
            if (!d.labelTUser) {
              d.labelT = chooseLabelT({
                source, target, sourceDims, targetDims,
                obstacles: obstacles.concat(placedLabels),
                labelDims: { width: labelW, height: labelH }
              });
            }
          }

          const placement = edgeLabelPlacement({ source, target, sourceDims, targetDims, t: d.labelT });
          if (obstacles) {
            placedLabels.push({ x: placement.x, y: placement.y, width: labelW + 8, height: labelH + 8 });
          }
          return `translate(${placement.x},${placement.y}) rotate(${placement.rotation})`;
        });
    };

    // Let users slide a label along its edge, within the clear span.
    edgeLabelGroups
      .style('cursor', 'grab')
      .call(d3.drag<any, any>()
        .on('start', (event) => {
          event.sourceEvent?.stopPropagation();
        })
        .on('drag', function(event, d: any) {
          const [px, py] = d3.pointer(event, g.node() as any);
          const source = { x: d.source.x || 0, y: d.source.y || 0 };
          const target = { x: d.target.x || 0, y: d.target.y || 0 };
          const segment = clearSegment(source, target, getNodeDimensions(d.source), getNodeDimensions(d.target));
          d.labelT = slideTFromPointer({ x: px, y: py }, source, target, segment);
          d.labelTUser = true;
          updateEdgePositions();
        }));

    // Simulation tick. Order matters: nodes move first, then every line,
    // arrow and label re-anchors to the nodes' new positions — edges can
    // never lag a frame behind. Every tick is measured (PerfMeter → debug
    // console + window.__graphPerf) so dynamics work stays evidence-based.
    const perfMeter = new PerfMeter(240);
    const driftMeter = new DriftMeter();
    let lastPerfReport = 0;
    simulation.on('tick', () => {
      const tickStart = performance.now();

      // 1) Nodes first
      nodeElements
        .attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);

      // Restore text visibility OUTSIDE the hot path: reading style() forces
      // a style recalc per text element; doing it every tick for every node
      // was the page's main frame killer (measured via PerfMeter). Once per
      // ~30 ticks is imperceptible and keeps the workaround's behavior.
      if (labelAvoidCounter % 30 === 0) {
        g.selectAll('.node-type-text, .node-title-text, .node-description-text' as any)
          .style('visibility', 'visible')
          .style('opacity', function(this: any) {
            const currentOpacity = parseFloat(d3.select(this).style('opacity')) || 0;
            if (currentOpacity === 0) {
              const svgElement = svg.node();
              if (svgElement) {
                const currentTransform = d3.zoomTransform(svgElement);
                const scale = currentTransform.k;
                const classList = d3.select(this as any).attr('class');
                if (classList?.includes('node-type-text')) return getSmoothedOpacity(scale, LOD_THRESHOLDS.FAR);
                if (classList?.includes('node-title-text')) return getSmoothedOpacity(scale, LOD_THRESHOLDS.MEDIUM);
                if (classList?.includes('node-description-text')) return getSmoothedOpacity(scale, LOD_THRESHOLDS.CLOSE);
              }
            }
            return currentOpacity;
          });
      }

      // Update mini-map with current node positions (live simulation objects —
      // the React-state nodes are different objects since the identity merge)
      if ((window as any).updateMiniMapPositions) {
        const simNodesForMap = simulation.nodes() as any[];
        if (simNodesForMap.length > 0) {
          const positions: {[key: string]: {x: number, y: number}} = {};
          const types: {[key: string]: string} = {};
          simNodesForMap.forEach((node: any) => {
            if (node.x !== undefined && node.y !== undefined) {
              positions[node.id] = { x: node.x, y: node.y };
              types[node.id] = node.type;
            }
          });
          (window as any).updateMiniMapPositions(positions);
          (window as any).updateMiniMapTypes?.(types);
        }
      }
        
      // 2) Then every edge, arrow and label re-anchors to the new positions
      updateEdgePositions();

      // 3) Measure. The debug console is the source of truth for dynamics.
      const now = performance.now();
      perfMeter.tick(now - tickStart);
      perfMeter.frame(now);
      if (now - lastPerfReport > 2000) {
        lastPerfReport = now;
        // Drift = node movement, the actual "slip and drift" signal that
        // frame stats can't show. rmsFromSavedPx near 0 means the layout
        // matches what's saved (snapshot fidelity).
        const spatial = driftMeter.sample(simulation.nodes() as any[]);
        const stats = {
          ...perfMeter.summary(),
          alpha: Math.round(simulation.alpha() * 1000) / 1000,
          nodes: nodes.length,
          edges: validatedEdges.length,
          quality: qualityProfileRef.current.tier,
          spatial
        };
        (window as any).__graphPerf = stats;
        if ((window as any).debugLog) {
          const level = stats.avgTickMs > 8 || stats.fps < 30 ? '⚠️' : '✅';
          (window as any).debugLog('Perf', `${level} fps=${stats.fps} tick avg=${stats.avgTickMs}ms p95=${stats.p95TickMs}ms dropped=${stats.droppedFrames} alpha=${stats.alpha}`, stats);
          const driftLevel = spatial.rmsFromSavedPx > 25 ? '⚠️' : '✅';
          (window as any).debugLog('Drift', `${driftLevel} moving=${spatial.movingNodes} maxStep=${spatial.maxStepPx}px meanStep=${spatial.meanStepPx}px rmsFromSaved=${spatial.rmsFromSavedPx}px`, spatial);
        }
      }
    });

    // Update zoom with LOD updates
    zoom.on('zoom', (event) => {
      g.attr('transform', event.transform);
      setCurrentTransform({ 
        x: event.transform.x, 
        y: event.transform.y, 
        scale: event.transform.k 
      });
      
      // Update mini-map viewport
      if ((window as any).updateMiniMapViewport) {
        const viewportUpdate = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k
        };
        (window as any).updateMiniMapViewport(viewportUpdate);
      }
      
      // Update LOD based on zoom level
      const scale = event.transform.k;
      
      // Smooth opacity transitions based on zoom level
      const getSmoothedOpacity = (threshold: number, fadeRange: number = 0.2) => {
        if (scale >= threshold + fadeRange) return 1;
        if (scale <= threshold - fadeRange) return 0;
        return (scale - (threshold - fadeRange)) / (fadeRange * 2);
      };
      
      // Update text opacities with smooth transitions
      g.selectAll('.node-type-text' as any)
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.FAR));
      g.selectAll('.node-title-text' as any)
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.MEDIUM));
      g.selectAll('.node-description-text' as any)
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.CLOSE));
      g.selectAll('.edge-label' as any)
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.CLOSE));
      g.selectAll('.edge-label-icon' as any)
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.CLOSE));
      g.selectAll('.edge' as any)
        .style('opacity', Math.max(0.1, getSmoothedOpacity(LOD_THRESHOLDS.VERY_FAR, 0.1)))
        .attr('stroke-width', function(d: any) {
          // Don't override stroke width if this edge has an active dialog
          if (editingEdge && editingEdge.edge && editingEdge.edge.id === d.id) {
            return 10; // Keep thick for active dialog
          }
          return scale >= LOD_THRESHOLDS.FAR ? 1 : Math.max(0.3, scale * 0.8);
        });
    });

    // Configure simulation for stability. Start hot only if there are
    // unpinned (new / never-placed) nodes to lay out; an already-arranged
    // graph loads pinned and stays put (snapshot-authoritative).
    const hasUnpinnedNodes = (simulation.nodes() as any[]).some((n: any) => n.fx == null || n.fy == null);
    if (hasUnpinnedNodes) {
      // Mark the start of a one-shot layout so we can report how long it took
      // the physics to settle (a metric for studying the behavior).
      layoutStartRef.current = performance.now();
      lastSettleMsRef.current = null;
    }
    simulation
      .alpha(hasUnpinnedNodes ? DEFAULT_PHYSICS.alpha.loadEnergy : 0)
      .alphaDecay(0.015)
      .restart();

    // When the layout settles: record settle time, persist the arrangement so
    // it's durable across reloads, run a final edge-label de-overlap pass, and
    // center the camera. After this the simulation is idle (one-shot physics).
    simulation.on('end.persist', () => {
      if (layoutStartRef.current != null && lastSettleMsRef.current == null) {
        lastSettleMsRef.current = Math.round(performance.now() - layoutStartRef.current);
      }
      persistAllPositions();
      runLabelAvoidanceRef.current?.();
    });
    
    // Add method to restart collision detection
    (simulation as any).restartCollisions = () => {
      simulation.alphaTarget(0.3).restart();
      setTimeout(() => {
        simulation.alphaTarget(0);
      }, 2000);
    };

    // Expose a one-shot edge-label de-overlap pass + run one shortly after init.
    // Fully-pinned graphs don't tick, so without this their labels would stay at
    // the default midpoint and could overlap → clean starting positions need it.
    runLabelAvoidanceRef.current = () => updateEdgePositions(true);
    setTimeout(() => updateEdgePositions(true), 500);
  }, [nodes, validatedEdges, handleNodeClick, initializeEmptyVisualization]); // Include handleNodeClick to get fresh connection state

  // One-shot layout instrumentation + the forced label-avoidance hook.
  const layoutStartRef = useRef<number | null>(null);
  const lastSettleMsRef = useRef<number | null>(null);
  const runLabelAvoidanceRef = useRef<(() => void) | null>(null);

  // Store simulation reference for resize handling
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // True only while "Reset layout" is re-flowing — suspends snapshot pinning
  const layoutReflowingRef = useRef(false);
  const mousedownNodeRef = useRef<any>(null);

  // Fit view to show all nodes
  const fitViewToNodes = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    // Bounds must come from the LIVE simulation objects (the React-state
    // nodes are different objects since the identity merge and may hold
    // stale/initial coordinates — that bug made fit zoom out to a huge box).
    const simNodes = (simulationRef.current?.nodes() as any[]) || [];
    if (simNodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Bounding box of the actual cards, not just their centers
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    simNodes.forEach((node: any) => {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
      const dims = getNodeDimensions(node);
      minX = Math.min(minX, node.x - dims.width / 2);
      maxX = Math.max(maxX, node.x + dims.width / 2);
      minY = Math.min(minY, node.y - dims.height / 2);
      maxY = Math.max(maxY, node.y + dims.height / 2);
    });

    if (!isFinite(minX)) return; // No valid positions

    const padding = 60;
    minX -= padding; maxX += padding; minY -= padding; maxY += padding;

    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);

    // Fit, but never zoom IN past 1.25 (a 3-node graph shouldn't fill the screen)
    const scale = Math.min(width / boundsWidth, height / boundsHeight, 1.25);

    const translateX = width / 2 - ((minX + maxX) / 2) * scale;
    const translateY = height / 2 - ((minY + maxY) / 2) * scale;
    const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

    // Use the component's own zoom behavior so handlers fire and state stays
    // coherent; animate so the user keeps spatial context.
    if (zoomBehaviorRef.current) {
      svg.transition().duration(450).call(zoomBehaviorRef.current.transform as any, transform);
    } else {
      svg.call(d3.zoom<SVGSVGElement, unknown>().transform as any, transform);
    }
  }, [getNodeDimensions]);

  // Mini-map click → pan the main view to that graph point at current zoom
  useEffect(() => {
    (window as any).miniMapNavigate = (graphX: number, graphY: number) => {
      if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current) return;
      const svg = d3.select(svgRef.current);
      const k = d3.zoomTransform(svgRef.current).k || 1;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const t = d3.zoomIdentity.translate(w / 2 - graphX * k, h / 2 - graphY * k).scale(k);
      svg.transition().duration(350).call(zoomBehaviorRef.current.transform as any, t);
    };
    // Mini-map wheel/pinch → zoom the main view to a target scale, centered on
    // the gesture's graph point. Clamped to the same scaleExtent as the main
    // zoom; applied via the shared zoom behavior so state + handlers stay in sync.
    (window as any).miniMapZoom = (graphX: number, graphY: number, targetK: number) => {
      if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current) return;
      const svg = d3.select(svgRef.current);
      const k = Math.max(0.1, Math.min(4, targetK));
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const t = d3.zoomIdentity.translate(w / 2 - graphX * k, h / 2 - graphY * k).scale(k);
      svg.transition().duration(120).call(zoomBehaviorRef.current.transform as any, t);
    };
    return () => {
      delete (window as any).miniMapNavigate;
      delete (window as any).miniMapZoom;
    };
  }, []);

  // Center on specific node
  const centerOnNode = useCallback((nodeId?: string) => {
    const nodeToCenter = nodeId 
      ? nodes.find((n: any) => n.id === nodeId)
      : lastSelectedNodeRef.current || nodes[0];
      
    if (!nodeToCenter || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const svgElement = svgRef.current;
    const { width, height } = svgElement.getBoundingClientRect();
    
    // Get node position
    const nodeX = nodeToCenter.x || 0;
    const nodeY = nodeToCenter.y || 0;
    
    // Calculate transform to center this node
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Get current zoom scale (maintain it)
    const currentScale = currentTransform?.scale || 1;
    
    // Calculate translation to center the node
    const translateX = centerX - nodeX * currentScale;
    const translateY = centerY - nodeY * currentScale;
    
    // Apply transform with smooth transition
    const transform = d3.zoomIdentity.translate(translateX, translateY).scale(currentScale);
    svg.transition()
      .duration(750)
      .call(d3.zoom<SVGSVGElement, unknown>().transform as any, transform);
      
    // Update mini-map viewport
    if ((window as any).updateMiniMapViewport) {
      const viewportUpdate = {
        x: translateX,
        y: translateY,
        k: currentScale
      };
      if ((window as any).debugLog) {
        (window as any).debugLog('Graph', '🎯 Center on node', viewportUpdate);
      }
      console.log('🎯 CENTER-ON-NODE viewport update:', viewportUpdate);
      (window as any).updateMiniMapViewport(viewportUpdate);
    }
  }, [nodes, currentTransform]);

  // Track viewport dimensions for mini-map
  useEffect(() => {
    if (!svgRef.current) return;
    
    const updateDimensions = () => {
      if (!svgRef.current) return;
      const { width, height } = svgRef.current.getBoundingClientRect();
      const dimensions = { width, height };
      if ((window as any).debugLog) {
        (window as any).debugLog('Graph', '📊 Viewport dimensions updated', dimensions);
      }
      console.log('📊 VIEWPORT DIMENSIONS:', dimensions);
      if ((window as any).updateViewportDimensions) {
        (window as any).updateViewportDimensions(dimensions);
      }
    };
    
    // Initial dimensions
    updateDimensions();
    
    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(svgRef.current);
    
    // Also listen to window resize for good measure
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Reset layout = the explicit "re-flow everything" escape hatch. It must
  // override snapshot-authoritative pinning: clear each node's saved-position
  // intent (in memory) and unpin, suspend re-pinning while physics rearranges,
  // then persist the fresh layout once it settles so it becomes the new
  // authoritative snapshot.
  const resetLayout = useCallback(() => {
    layoutReflowingRef.current = true;
    // Unpin + mark unplaced; initializeVisualization will lay the unplaced
    // nodes out on a CLEAN spread grid (see getUnplacedSpread) so physics
    // REFINES a non-overlapping start instead of trying to explode a pile.
    nodes.forEach((node: any) => {
      node.userPinned = false;
      node.userPreferredPosition = null;
      node.userPreferenceVector = null;
      node.fx = null;
      node.fy = null;
      node.positionX = 0;
      node.positionY = 0;
      node.targetX = null;
      node.targetY = null;
      node.x = 0;
      node.y = 0;
    });
    initializeVisualization();
    setTimeout(() => {
      fitViewToNodes();
      persistAllPositions();      // the reflowed layout becomes the new snapshot
      layoutReflowingRef.current = false;
    }, 2500);
  }, [nodes, initializeVisualization, fitViewToNodes, persistAllPositions]);

  // Comprehensive layout metrics for studying the physics behaviour skeptically:
  // is the simulation actually idle (not silently reheating), do node cards
  // overlap, do edge labels overlap, how long did the last layout take to
  // settle, plus the live drift sample. Exposed for the diagnostic + console.
  useEffect(() => {
    (window as any).__organizeGraph = () => resetLayout();
    (window as any).__layoutMetrics = () => {
      const sim = simulationRef.current;
      if (!sim) return null;
      const ns = sim.nodes() as any[];
      // TRUE visual overlap = the node CARD rectangles intersect (AABB). The
      // collision radius is the half-diagonal, which over-counts side-by-side
      // cards that don't actually overlap — this metric measures the real pile.
      let overlapPairs = 0;
      let maxOverlap = 0;
      let proximityPairs = 0; // closer than collision radius (soft crowding)
      const dims = ns.map((n) => getNodeDimensions(n));
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i];
        const da = dims[i];
        const ra = collisionRadius(da);
        for (let j = i + 1; j < ns.length; j++) {
          const b = ns[j];
          const db = dims[j];
          const dx = Math.abs((a.x || 0) - (b.x || 0));
          const dy = Math.abs((a.y || 0) - (b.y || 0));
          const ox = (da.width + db.width) / 2 - dx;
          const oy = (da.height + db.height) / 2 - dy;
          if (ox > 0 && oy > 0) { overlapPairs++; if (Math.min(ox, oy) > maxOverlap) maxOverlap = Math.min(ox, oy); }
          if (Math.hypot(dx, dy) < ra + collisionRadius(db)) proximityPairs++;
        }
      }
      const labelRects = Array.from(document.querySelectorAll('.graph-container svg .edge-label-group'))
        .map((g) => (g as SVGGElement).getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      let labelOverlaps = 0;
      for (let i = 0; i < labelRects.length; i++) {
        for (let j = i + 1; j < labelRects.length; j++) {
          const a = labelRects[i];
          const b = labelRects[j];
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) labelOverlaps++;
        }
      }
      const alpha = sim.alpha();
      // The sim stops ticking once alpha drops past alphaMin (~0.001); at that
      // point nodes are frozen. (The drift field below is sampled in the tick
      // loop, so it goes STALE after the sim stops — use atRest, not drift, to
      // judge "has it stopped moving".)
      const atRest = alpha <= 0.0015;
      return {
        simRunning: !atRest,
        atRest,
        alpha: Math.round(alpha * 10000) / 10000,
        lastSettleMs: lastSettleMsRef.current,
        nodeCount: ns.length,
        pinnedCount: ns.filter((n: any) => n.fx != null).length,
        edgeCount: validatedEdges.length,
        overlappingNodePairs: overlapPairs,
        maxNodeOverlapPx: Math.round(maxOverlap),
        proximityPairs,
        labelCount: labelRects.length,
        overlappingLabelPairs: labelOverlaps,
        drift: (window as any).__graphPerf?.spatial ?? null,
      };
    };
    return () => {
      delete (window as any).__layoutMetrics;
      delete (window as any).__organizeGraph;
    };
  }, [getNodeDimensions, validatedEdges, resetLayout]);

  // Center the camera on the graph whenever it loads or CHANGES (login, graph
  // switch, drill-in / ascend). Keyed on the graph id — the old effect keyed on
  // hasNodes only and restored one global transform, so it never recentered on
  // a graph change. We wait briefly for the one-shot layout to settle, then fit.
  const hasNodes = nodes.length > 0;
  const currentGraphId = currentGraph?.id;
  useEffect(() => {
    if (!hasNodes || !svgRef.current) return undefined;
    const timer = setTimeout(() => fitViewToNodes(), 1500);
    return () => clearTimeout(timer);
  }, [hasNodes, currentGraphId, fitViewToNodes]);

  // Expose reset function to parent component
  useEffect(() => {
    if (onResetLayout) {
      // Set up a way for parent to trigger reset
      (window as any).triggerGraphReset = resetLayout;
    }
    return () => {
      if ((window as any).triggerGraphReset === resetLayout) {
        delete (window as any).triggerGraphReset;
      }
    };
  }, [resetLayout, onResetLayout]);

  // Force reinitialization trigger - incremented when view needs refresh
  const [reinitTrigger, setReinitTrigger] = useState(0);

  // Track previous node count to detect transition from empty to non-empty
  const prevNodeCountRef = useRef<number>(0);
  // Track the previous edge signature (id + type + direction) so a relationship
  // TYPE change or a direction FLIP — which keep the edge COUNT the same — still
  // forces a rebuild. Without this the edge label/arrow keep the stale value.
  const prevEdgeSigRef = useRef<string>('');

  // Comprehensive reinitialization effect - ONLY when actually needed
  useEffect(() => {
    console.log('[Graph Debug] Checking if reinitialization needed...', {
      nodesLength: nodes.length,
      prevNodesLength: prevNodeCountRef.current,
      edgesLength: validatedEdges.length,
      trigger: reinitTrigger,
      currentGraph: currentGraph?.id
    });

    // Detect transition from empty to non-empty graph (first node creation)
    const wasEmpty = prevNodeCountRef.current === 0;
    const isNowPopulated = nodes.length > 0;
    const transitioningFromEmpty = wasEmpty && isNowPopulated;

    // Detect a relationship TYPE change or direction FLIP. Both keep the edge
    // count the same, so length-based checks miss them; compare an id+type+
    // direction signature against the last render and force a rebuild on change.
    const edgeSig = (validatedEdges as any[])
      .map((e) => {
        const sId = typeof e.source === 'object' ? e.source?.id : e.source;
        const tId = typeof e.target === 'object' ? e.target?.id : e.target;
        return `${e.id}:${e.type}:${sId}>${tId}`;
      })
      .sort()
      .join(',');
    const edgesChanged = prevEdgeSigRef.current !== '' && prevEdgeSigRef.current !== edgeSig;

    // Only reinitialize if this is truly necessary
    const shouldReinit =
      !svgRef.current ||
      !containerRef.current ||
      nodes.length === 0 ||
      !d3.select(svgRef.current).select('.main-graph-group').node() ||
      reinitTrigger > 0 ||
      transitioningFromEmpty || // Force reinit when adding first node to empty graph
      edgesChanged; // relationship type changed or direction flipped

    if (shouldReinit) {
      console.log('[Graph Debug] Full reinitialization required');
      initializeVisualization();
      // Reset trigger after use
      if (reinitTrigger > 0) {
        setReinitTrigger(0);
      }
    } else {
      console.log('[Graph Debug] Using selective updates instead of full reinit');
      // Use selective data updates instead of full reinitialization
      updateVisualizationData();
    }

    // Update previous node count + edge signature for next comparison
    prevNodeCountRef.current = nodes.length;
    prevEdgeSigRef.current = edgeSig;

    const handleResize = () => {
      if (!containerRef.current || !svgRef.current || !simulationRef.current) return;
      
      const container = containerRef.current;
      const svg = d3.select(svgRef.current);
      
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      const newCenterX = newWidth / 2;
      const newCenterY = newHeight / 2;

      // Update SVG dimensions
      svg.attr('width', newWidth).attr('height', newHeight);
      
      // Update simulation center force with new dimensions
      simulationRef.current
        .force('center', d3.forceCenter(newCenterX, newCenterY))
        .alpha(0.3) // Restart simulation with some energy
        .restart();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [
    nodes.length,
    validatedEdges.length,
    currentGraph?.id, // Re-init when graph changes
    reinitTrigger, // Manual trigger
    loading, // Re-init when loading completes
    edgesLoading, // Re-init when edges loading completes
    // Track node property changes for selective updates (only titles, descriptions, types)
    nodes.map(n => `${n.id}:${n.title}:${n.description}:${n.type}:${n.status}`).join(','),
    // Track edge type/direction changes so a relationship edit or flip rebuilds
    validatedEdges.map((e: any) => {
      const sId = typeof e.source === 'object' ? e.source?.id : e.source;
      const tId = typeof e.target === 'object' ? e.target?.id : e.target;
      return `${e.id}:${e.type}:${sId}>${tId}`;
    }).join(',')
  ]);

  // Manual reinitialization function (expose globally for debugging)
  useEffect(() => {
    (window as any).forceGraphReinit = () => {
      console.log('[Graph Debug] Forcing manual reinitialization...');
      setReinitTrigger(prev => prev + 1);
    };
    
    // Auto-reinit on view switches or navigation changes - DISABLED to prevent conflicts
    // const handleVisibilityChange = () => {
    //   if (!document.hidden) {
    //     console.log('[Graph Debug] View became visible, checking if reinit needed...');
    //     setTimeout(() => {
    //       const svg = d3.select(containerRef.current).select('svg');
    //       const hasNodes = svg.select('.nodes-group').selectAll('.node').size() > 0;
    //       if (nodes.length > 0 && !hasNodes) {
    //         console.log('[Graph Debug] Missing nodes detected, forcing reinit...');
    //         setReinitTrigger(prev => prev + 1);
    //       }
    //     }, 100);
    //   }
    // };
    
    // document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      delete (window as any).forceGraphReinit;
    };
  }, [nodes.length]);

  // Keyboard shortcut for manual reinit (Shift+R)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'R' && event.shiftKey) {
        event.preventDefault();
        console.log('[Graph Debug] Manual reinit triggered by Shift+R');
        setReinitTrigger(prev => prev + 1);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Set empty state overlay when no graph is selected
  const showNoGraphMessage = !currentGraph;

  if (loading || edgesLoading) {
    return (
      <div className="graph-container relative w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-green-300 text-lg font-medium">Loading graph data...</div>
          <div className="text-gray-400 text-sm mt-2">Connecting to database...</div>
        </div>
      </div>
    );
  }

  if (error || edgesError) {
    // Determine user-friendly error message based on error type
    const getErrorMessage = (err: any) => {
      if (!err) return "Unknown error occurred";
      
      const message = err.message || err.toString();
      
      // Network/connection errors
      if (message.includes('NetworkError') || message.includes('fetch')) {
        return "Cannot connect to GraphDone server. Please check if the server is running at http://localhost:4127";
      }
      
      // GraphQL/Database errors
      if (message.includes('Cannot return null for non-nullable')) {
        return "Database schema issue detected. Please restart the server or reseed the database.";
      }
      
      if (message.includes('Neo4j')) {
        return "Database connection failed. Please ensure Neo4j is running and properly configured.";
      }
      
      if (message.includes('Enum') && message.includes('cannot represent')) {
        return "Data format error. Please check that your database schema matches the application version.";
      }
      
      // Authentication/permission errors
      if (message.includes('unauthorized') || message.includes('Unauthorized')) {
        return "Authentication failed. Please check your database credentials.";
      }
      
      // Generic GraphQL errors
      if (message.includes('GraphQL')) {
        return "Server communication error. Please check server logs for details.";
      }
      
      // Fallback with original message for debugging
      return `Server error: ${message}`;
    };

    const errorMessage = getErrorMessage(error || edgesError);
    const isNetworkError = errorMessage.includes('Cannot connect');
    
    return (
      <div ref={containerRef} className="graph-container relative w-full h-full" data-quality={qualityTier}>
        <svg ref={svgRef} className="w-full h-full">
          {/* Error message centered in SVG */}
          <foreignObject x="20%" y="30%" width="60%" height="40%">
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="max-w-lg text-center bg-gray-800/80 backdrop-blur-sm rounded-lg p-6 border border-red-500/30">
                <div className="text-red-400 text-xl mb-4">
                  {isNetworkError ? '🔌' : '⚠️'} Connection Error
                </div>
                <div className="text-red-300 mb-6 leading-relaxed">
                  {errorMessage}
                </div>
                
                {isNetworkError && (
                  <div className="text-gray-400 text-sm space-y-2">
                    <div>💡 <strong>Quick fixes:</strong></div>
                    <div>• Run <code className="bg-gray-800 px-2 py-1 rounded">./start</code> to start the server</div>
                    <div>• Check if port 4127 is available</div>
                    <div>• Verify Neo4j database is running</div>
                  </div>
                )}
                
                <button 
                  onClick={() => window.location.reload()} 
                  className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  🔄 Retry Connection
                </button>
              </div>
            </div>
          </foreignObject>
        </svg>
        
        {/* Maintain same structure as full render */}
        <div className="absolute top-4 left-4 z-40 opacity-50">
          <button className="bg-gray-800/90 backdrop-blur-sm border border-gray-600 rounded-lg px-3 py-2 shadow-md">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <span className="text-sm font-medium text-red-400">Error</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  const getNodeColor = (node: WorkItem) => {
    return getTypeConfig(node.type as any).hexColor;
  };



  const handleViewNodeDetails = (node: WorkItem) => {
    setSelectedNode(node);
    setShowNodeDetailsModal(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleEditNode = (node: WorkItem) => {
    setSelectedNode(node);
    setShowNodeDetailsModal(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleDeleteNode = (node: WorkItem) => {
    setSelectedNode(node);
    setShowDeleteModal(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedNode(null);
  };

  const handleOpenDisconnectFromDelete = () => {
    if (!selectedNode) {
      return;
    }
    
    // Mark that this was opened from delete modal
    setOpenedFromDeleteModal(true);
    setSelectedNode(selectedNode); // Ensure it's set
    setConnectModalInitialTab('disconnect');
    setShowConnectModal(true);
    setShowDeleteModal(false); // Close delete modal after setting up connect modal
  };


  const handleCreateConnectedNode = (node: WorkItem, event: any) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setCreateNodePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        z: 0
      });
    }
    setSelectedNode(node);
    setShowCreateNodeModal(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleConnectToExistingNodes = (node: WorkItem) => {
    setSelectedNode(node);
    setConnectModalInitialTab('connect'); // Open to connect tab
    setShowConnectModal(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleDisconnectNodes = (node: WorkItem) => {
    setSelectedNode(node);
    setConnectModalInitialTab('disconnect'); // Open to disconnect tab
    setShowConnectModal(true); // Use ConnectNodeModal with tab
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleCloseCreateNodeModal = () => {
    setShowCreateNodeModal(false);
    setSelectedNode(null);
    setCreateNodePosition(undefined);
  };

  const handleCloseConnectModal = () => {
    setShowConnectModal(false);
    setConnectModalInitialTab('connect'); // Reset to connect tab
    
    // If this was opened from delete modal, return to delete modal
    if (openedFromDeleteModal && selectedNode) {
      setOpenedFromDeleteModal(false);
      setShowDeleteModal(true);
    } else {
      setSelectedNode(null);
    }
  };



  const handleEditEdge = (edge: WorkItemEdge) => {
    // Find source and target nodes
    const sourceNode = validatedNodes.find(n => n.id === edge.source);
    const targetNode = validatedNodes.find(n => n.id === edge.target);
    
    if (sourceNode && targetNode) {
      // Open connect modal with disconnect tab to edit the relationship
      setSelectedNode(sourceNode);
      setShowConnectModal(true);
      setConnectModalInitialTab('disconnect');
    }
    setEdgeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleDeleteEdge = (edge: WorkItemEdge) => {
    const src: any = edge.source;
    const tgt: any = edge.target;
    const sourceId = typeof src === 'object' ? src?.id : src;
    const targetId = typeof tgt === 'object' ? tgt?.id : tgt;
    deleteEdgeMutation({
      variables: {
        where: { id: edge.id }
      }
    }).then(() => {
      // Deleting is safe because undo can rebuild it — no confirm() popup
      undoStackRef.current.push({
        label: 'Delete relationship',
        undo: async () => {
          await createEdgeMutation({
            variables: {
              input: [{
                type: edge.type,
                weight: edge.strength ?? 0.8,
                source: { connect: { where: { node: { id: sourceId } } } },
                target: { connect: { where: { node: { id: targetId } } } }
              }]
            }
          });
        }
      });
    });
    setEdgeMenu(prev => ({ ...prev, visible: false }));
  };


  return (
    <div ref={containerRef} className="graph-container relative w-full h-full overflow-hidden select-none" data-quality={qualityTier}>
      <svg 
        ref={svgRef} 
        className="w-full h-full" 
      />
      
      
      {/* Empty State Overlay */}
      {showEmptyStateOverlay && (
        <div className="absolute inset-0 flex items-start justify-center pointer-events-none pt-16 pl-32">
          <div className="max-w-lg text-center bg-gray-800/90 backdrop-blur-sm rounded-xl p-8 border border-gray-600/50 shadow-2xl pointer-events-auto">
            <div className="text-green-400 text-4xl mb-4">
              🌱
            </div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-green-300 to-blue-400 bg-clip-text text-transparent mb-3">
              Transform Your Vision
            </h3>
            <div className="text-gray-200 mb-8 leading-relaxed text-base max-w-md mx-auto">
              Break free from rigid hierarchies. Create your first work item and experience how GraphDone intelligently connects ideas, surfaces priorities, and accelerates meaningful outcomes.
            </div>
            
            <button 
              onClick={() => createInlineNode(400, 300)}
              className="bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center gap-3 mx-auto pointer-events-auto cursor-pointer shadow-lg hover:shadow-xl hover:shadow-green-500/25 transform hover:-translate-y-0.5 hover:scale-105"
            >
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                <Plus className="h-3 w-3" />
              </div>
              Create Your First Work Item
            </button>
          </div>
        </div>
      )}
      
      {/* No Graph Selected Overlay */}
      {showNoGraphMessage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="max-w-lg text-center bg-gray-800/90 backdrop-blur-sm rounded-xl p-8 border border-gray-600/50 shadow-2xl pointer-events-auto">
            <div className="text-yellow-300 text-4xl mb-4">
              📊
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              No Graph Selected
            </h3>
            <div className="text-gray-400 mb-8 leading-relaxed">
              Choose a graph to start visualizing your data and see the magic of GraphDone in action.
            </div>
            
            <button 
              onClick={() => setShowGraphSwitcher(true)}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center gap-3 mx-auto pointer-events-auto cursor-pointer shadow-lg hover:shadow-xl hover:shadow-green-500/25 transform hover:-translate-y-0.5 hover:scale-105"
            >
              Select Graph
            </button>
          </div>
        </div>
      )}
      



      {/* Grow mode: one friendly hint, no instructions-as-UI, no dropdown.
          The edge type can be retyped later by clicking its label. */}
      {isConnecting && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm border border-emerald-500/40 text-emerald-100 px-4 py-2 rounded-xl shadow-lg pointer-events-none">
          <div className="flex items-center space-x-2 text-sm">
            <Link2 className="h-4 w-4 text-emerald-400" />
            <span>Click empty space to grow a new item · click a node to connect · Esc to cancel</span>
          </div>
        </div>
      )}

      {/* Inline rename: the input floats over the node — no modal (W2) */}
      {inlineEdit && (() => {
        const simNode = (simulationRef.current?.nodes() as any[])?.find((n: any) => n.id === inlineEdit.nodeId);
        const gx = simNode?.x ?? inlineEdit.graphX;
        const gy = simNode?.y ?? inlineEdit.graphY;
        const left = gx * currentTransform.scale + currentTransform.x;
        const top = gy * currentTransform.scale + currentTransform.y;
        const commit = () => {
          const title = inlineEdit.value.trim();
          const previous = inlineEdit.original;
          setInlineEdit(null);
          if (title && title !== previous) {
            updateWorkItemMutation({
              variables: { where: { id: inlineEdit.nodeId }, update: { title } }
            }).then(() => {
              undoStackRef.current.push({
                label: 'Rename item',
                undo: async () => {
                  await updateWorkItemMutation({
                    variables: { where: { id: inlineEdit.nodeId }, update: { title: previous } }
                  });
                }
              });
            }).catch(() => showError('Could not rename item'));
          }
        };
        return (
          <div
            className="absolute z-50"
            style={{ left, top, transform: 'translate(-50%, -50%)' }}
          >
            <input
              autoFocus
              data-testid="inline-rename"
              value={inlineEdit.value}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setInlineEdit(null);
              }}
              onBlur={commit}
              className="px-3 py-2 rounded-lg bg-gray-900/95 border-2 border-emerald-400 text-white text-sm font-semibold shadow-2xl outline-none min-w-[180px] text-center"
            />
          </div>
        );
      })()}

      {/* Node Context Menu */}
      {nodeMenu.visible && nodeMenu.node && createPortal(
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999999]"
          onClick={() => setNodeMenu({ node: null, position: { x: 0, y: 0 }, visible: false })}
          onMouseMove={(e) => {
            if (menuDragState.isDragging) {
              const menuWidth = 320;
              const menuHeight = 500;
              const padding = 10;

              const newX = Math.max(
                padding,
                Math.min(
                  window.innerWidth - menuWidth - padding,
                  e.clientX - menuDragState.offset.x
                )
              );

              const newY = Math.max(
                padding,
                Math.min(
                  window.innerHeight - menuHeight - padding,
                  e.clientY - menuDragState.offset.y
                )
              );

              setNodeMenu(prev => ({
                ...prev,
                position: {
                  x: newX,
                  y: newY
                }
              }));
            }
          }}
          onMouseUp={() => setMenuDragState({ isDragging: false, offset: { x: 0, y: 0 } })}
          onTouchMove={(e) => {
            if (menuDragState.isDragging && e.touches.length > 0) {
              const touch = e.touches[0];
              const menuWidth = 320;
              const menuHeight = 500;
              const padding = 10;

              const newX = Math.max(
                padding,
                Math.min(
                  window.innerWidth - menuWidth - padding,
                  touch.clientX - menuDragState.offset.x
                )
              );

              const newY = Math.max(
                padding,
                Math.min(
                  window.innerHeight - menuHeight - padding,
                  touch.clientY - menuDragState.offset.y
                )
              );

              setNodeMenu(prev => ({
                ...prev,
                position: {
                  x: newX,
                  y: newY
                }
              }));
            }
          }}
          onTouchEnd={() => setMenuDragState({ isDragging: false, offset: { x: 0, y: 0 } })}
        >
          <div
            className="absolute bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fadeIn"
            style={{
              left: nodeMenu.position.x,
              top: nodeMenu.position.y,
              minWidth: '320px',
              maxHeight: '500px',
              cursor: menuDragState.isDragging ? 'grabbing' : 'default'
            }}
            onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-5 py-3 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-blue-500/5 border-b border-white/10 cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              setMenuDragState({
                isDragging: true,
                offset: {
                  x: e.clientX - nodeMenu.position.x,
                  y: e.clientY - nodeMenu.position.y
                }
              });
            }}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                const touch = e.touches[0];
                setMenuDragState({
                  isDragging: true,
                  offset: {
                    x: touch.clientX - nodeMenu.position.x,
                    y: touch.clientY - nodeMenu.position.y
                  }
                });
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div
                  className="w-3 h-3 rounded-full ring-2 ring-white/30 shadow-lg"
                  style={{ backgroundColor: getNodeColor(nodeMenu.node) }}
                />
                <span className="font-semibold text-gray-100 text-base">{nodeMenu.node.title}</span>
              </div>
              <button
                onClick={() => setNodeMenu(prev => ({ ...prev, visible: false }))}
                className="p-2 text-gray-400 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-200 hover:scale-110"
                title="Close menu (ESC)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center space-x-3 mt-2">
              <span className="flex items-center">
                {(() => {
                  const status = nodeMenu.node?.status?.toUpperCase() || '';
                  const statusIcon = getStatusIconElement(status as any, "h-3 w-3 mr-1.5");
                  const getStatusBgColor = () => {
                    const statusConfig = getStatusConfig(status as WorkItemStatus);
                    return `${statusConfig.color} ${statusConfig.bgColor} px-2.5 py-1 rounded-lg text-xs font-medium`;
                  };
                  const formatStatus = (status: string) => {
                    return getStatusConfig(status as WorkItemStatus).label;
                  };
                  return (
                    <>
                      {statusIcon}
                      <span className={getStatusBgColor()}>{formatStatus(nodeMenu.node.status)}</span>
                    </>
                  );
                })()}
              </span>
              <span className="flex items-center">
                {(() => {
                  const getTypeIcon = () => {
                    if (!nodeMenu.node?.type) return null;
                    return getTypeIconElement(nodeMenu.node.type as any, "h-3 w-3 mr-1.5");
                  };
                  const getTypeBgColor = () => {
                    if (!nodeMenu.node?.type) return 'text-gray-400 bg-gray-400/10 px-2.5 py-1 rounded-lg text-xs font-medium';
                    const typeConfig = getTypeConfig(nodeMenu.node.type as any);
                    return `${typeConfig.color} ${typeConfig.bgColor} px-2.5 py-1 rounded-lg text-xs font-medium`;
                  };
                  return (
                    <>
                      {getTypeIcon()}
                      <span className={getTypeBgColor()}>{nodeMenu.node.type}</span>
                    </>
                  );
                })()}
              </span>
            </div>
          </div>

          <div className="px-5 py-3 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent border-b border-white/5">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {(() => {
                    const priority = nodeMenu.node?.priority || 0;
                    return getPriorityIconElement(priority, "h-4 w-4 mr-2 text-blue-400");
                  })()}
                  <span className="text-gray-300 text-sm">Priority</span>
                </div>
                <span className="text-white font-semibold text-sm">{Math.round((nodeMenu.node?.priority || 0) * 100)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    (nodeMenu.node?.priority || 0) >= 0.8 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                    (nodeMenu.node?.priority || 0) >= 0.6 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                    (nodeMenu.node?.priority || 0) >= 0.4 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                    (nodeMenu.node?.priority || 0) >= 0.2 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                    'bg-gradient-to-r from-gray-500 to-gray-400'
                  }`}
                  style={{ width: `${Math.round((nodeMenu.node?.priority || 0) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto py-2">
            <div className="space-y-1 px-2">
              {(() => {
                const connectionCount = edgesData?.edges?.filter((edge: any) =>
                  edge.source.id === nodeMenu.node?.id || edge.target.id === nodeMenu.node?.id
                ).length || 0;

                return [
                  {
                    icon: Plus,
                    title: "Add New Work Item",
                    description: "Create a standalone work item",
                    onClick: () => {
                      setShowCreateNodeModal(true);
                      setSelectedNode(null);
                      setNodeMenu(prev => ({ ...prev, visible: false }));
                    },
                    gradient: "from-green-500/20 via-emerald-500/10 to-green-500/5",
                    iconColor: "text-green-400"
                  },
                  {
                    icon: GitBranch,
                    title: "Create New & Connect",
                    description: "Add a new work item linked to this one",
                    onClick: (e: React.MouseEvent) => handleCreateConnectedNode(nodeMenu.node!, e),
                    gradient: "from-blue-500/20 via-cyan-500/10 to-blue-500/5",
                    iconColor: "text-blue-400"
                  },
                  {
                    icon: Link2,
                    title: "Connect to Existing Work Items",
                    description: "Link this to other work items in graph",
                    onClick: () => handleConnectToExistingNodes(nodeMenu.node!),
                    gradient: "from-purple-500/20 via-pink-500/10 to-purple-500/5",
                    iconColor: "text-purple-400",
                    badge: connectionCount
                  },
                  {
                    icon: Unlink,
                    title: "Disconnect Work Items",
                    description: "Remove connections from this work item",
                    onClick: () => handleDisconnectNodes(nodeMenu.node!),
                    gradient: "from-orange-500/20 via-red-500/10 to-orange-500/5",
                    iconColor: "text-orange-400",
                    badge: connectionCount
                  }
                ];
              })().map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`w-full flex items-center px-4 py-3 rounded-xl bg-gradient-to-br ${action.gradient}
                    hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-white/5
                    hover:border-white/20 group animate-fadeIn`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <action.icon className={`h-5 w-5 mr-3 flex-shrink-0 ${action.iconColor} group-hover:scale-110 transition-transform`} />
                  <div className="text-left flex-1">
                    <div className="font-medium text-gray-100 text-sm">{action.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{action.description}</div>
                  </div>
                  {action.badge !== undefined && action.badge > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold">
                      {action.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-3" />

            <div className="space-y-1 px-2">
              {[
                {
                  icon: FileText,
                  title: "View Details",
                  onClick: () => handleViewNodeDetails(nodeMenu.node!),
                  iconColor: "text-cyan-400"
                },
                {
                  icon: Edit3,
                  title: "Edit Work Item Details",
                  onClick: () => handleEditNode(nodeMenu.node!),
                  iconColor: "text-indigo-400"
                },
                {
                  icon: Crosshair,
                  title: "Center on Node",
                  onClick: () => {
                    centerOnNode(nodeMenu.node!.id);
                    setNodeMenu(prev => ({ ...prev, visible: false }));
                  },
                  iconColor: "text-teal-400"
                },
                {
                  icon: Trash2,
                  title: "Delete Work Item",
                  onClick: () => handleDeleteNode(nodeMenu.node!),
                  iconColor: "text-red-400",
                  danger: true
                }
              ].map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-200
                    ${action.danger
                      ? 'hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40'
                      : 'hover:bg-white/5 text-gray-200 border border-transparent hover:border-white/10'
                    } group animate-fadeIn`}
                  style={{ animationDelay: `${(index + 4) * 30}ms` }}
                >
                  <action.icon className={`h-4 w-4 mr-3 ${action.iconColor} group-hover:scale-110 transition-transform`} />
                  <span className="text-sm font-medium">{action.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        </div>,
        document.body
      )}

      {/* Edge Context Menu */}
      {edgeMenu.visible && edgeMenu.edge && (
        <div
          className="absolute bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 z-50"
          style={{
            left: edgeMenu.position.x,
            top: edgeMenu.position.y,
            minWidth: '200px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-gray-600">
            <div className="text-sm font-medium text-gray-100">
              {edgeMenu.edge.type.replace('_', ' ')}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {edgeMenu.edge.description}
            </div>
            <div className="flex items-center mt-2 text-xs">
              <div
                className="w-3 h-1 mr-2"
                style={{
                  backgroundColor: getRelationshipConfig(edgeMenu.edge.type as RelationshipType).hexColor,
                  borderStyle: 'solid'
                }}
              />
              <span className="text-gray-300">Strength: {Math.round((edgeMenu.edge.strength || 0.8) * 100)}%</span>
            </div>
          </div>
          <div className="py-1">
            <button 
              onClick={() => handleEditEdge(edgeMenu.edge!)}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <Edit3 className="h-4 w-4 mr-3" />
              Edit Relationship
            </button>
            <button 
              onClick={() => handleDeleteEdge(edgeMenu.edge!)}
              className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-red-900/50"
            >
              <Trash2 className="h-4 w-4 mr-3" />
              Delete Relationship
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenuPosition && (
        <div
          className="fixed z-50 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[200px]"
          style={{
            left: Math.min(contextMenuPosition?.x || 0, window.innerWidth - 220),
            top: Math.min(contextMenuPosition?.y || 0, window.innerHeight - 120),
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            animation: 'slideInScale 0.2s ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-2">
            {/* Undo — first item so touch users always have it one tap away */}
            <button
              onClick={() => {
                runUndo();
                setContextMenuPosition(null);
              }}
              disabled={!undoLabel}
              data-testid="context-undo"
              className={`w-full text-left px-4 py-3 flex items-center space-x-3 transition-all duration-300 ease-out group rounded-lg mx-2 border-b border-white/5 mb-2 ${undoLabel ? 'hover:bg-amber-500/10 text-gray-200' : 'opacity-40 cursor-not-allowed text-gray-500'}`}
            >
              <div className="w-6 h-6 rounded-lg bg-gray-700/50 flex items-center justify-center group-hover:bg-amber-500/20 transition-all duration-300 ease-out">
                <Undo2 className="h-4 w-4 text-gray-400 group-hover:text-amber-400 transition-colors duration-300" />
              </div>
              <span className="font-medium group-hover:text-amber-300 transition-colors duration-300">
                {undoLabel ? `Undo: ${undoLabel}` : 'Nothing to undo'}
              </span>
              <div className="ml-auto text-xs text-gray-500">Ctrl+Z</div>
            </button>
            
            <button
              onClick={() => {
                createInlineNode(contextMenuPosition?.graphX || 0, contextMenuPosition?.graphY || 0);
                setContextMenuPosition(null);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/8 text-gray-200 flex items-center space-x-3 transition-all duration-300 ease-out group rounded-lg mx-2"
            >
              <div className="w-6 h-6 rounded-lg bg-gray-700/50 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all duration-300 ease-out">
                <Plus className="h-4 w-4 text-gray-400 group-hover:text-emerald-400 transition-colors duration-300" />
              </div>
              <span className="text-gray-300 font-medium group-hover:text-white transition-colors duration-300">Create Work Item</span>
              <div className="ml-auto">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out"></div>
              </div>
            </button>
            
            <button
              onClick={() => {
                // Zoom to fit button clicked
                // Zoom to fit all nodes - completely rewritten for proper detection
                const svg = d3.select(svgRef.current);
                const containerRect = containerRef.current?.getBoundingClientRect();
                if (svg.node() && containerRect && nodes.length > 0) {
                  // Get all node positions (both from simulation and stored positions)
                  const allPositions = nodes.map(node => ({
                    x: node.x !== undefined ? node.x : (node.positionX || 0),
                    y: node.y !== undefined ? node.y : (node.positionY || 0)
                  })).filter(pos => pos.x !== undefined && pos.y !== undefined);
                  
                  if (allPositions.length === 0) {
                    // No valid node positions found
                    setContextMenuPosition(null);
                    return;
                  }
                  
                  // Find the absolute bounds of all nodes
                  const minX = Math.min(...allPositions.map(p => p.x));
                  const maxX = Math.max(...allPositions.map(p => p.x));
                  const minY = Math.min(...allPositions.map(p => p.y));
                  const maxY = Math.max(...allPositions.map(p => p.y));
                  
                  // Add generous padding for node sizes and breathing room
                  const nodePadding = 150; // Account for node size
                  const extraMargin = 300; // Extra breathing room
                  const totalPadding = nodePadding + extraMargin;
                  
                  const boundsWidth = (maxX - minX) + (2 * totalPadding);
                  const boundsHeight = (maxY - minY) + (2 * totalPadding);
                  
                  // Calculate how much we need to scale to fit everything
                  const containerWidth = containerRect.width;
                  const containerHeight = containerRect.height;
                  
                  const scaleX = containerWidth / boundsWidth;
                  const scaleY = containerHeight / boundsHeight;
                  const scale = Math.min(scaleX, scaleY, 0.2); // Very conservative max scale for wide zoom out
                  
                  // Find the center of all nodes
                  const centerX = (minX + maxX) / 2;
                  const centerY = (minY + maxY) / 2;
                  
                  // Calculate translation to center the nodes
                  const translateX = (containerWidth / 2) - (centerX * scale);
                  const translateY = (containerHeight / 2) - (centerY * scale);
                  
                  // Zoom to fit calculation complete
                  
                  // Create the transform and update D3's zoom behavior state properly
                  const newTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
                  
                  // Update D3's internal zoom state immediately (no transition)
                  svg.property('__zoom', newTransform);
                  
                  // Apply the visual transform with transition
                  const g = svg.select('g');
                  g.transition()
                    .duration(750)
                    .attr('transform', newTransform.toString())
                    .on('end', () => {
                      // Update the current transform state
                      setCurrentTransform({ x: translateX, y: translateY, scale: scale });
                    });
                }
                setContextMenuPosition(null);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/8 text-gray-200 flex items-center space-x-3 transition-all duration-300 ease-out group rounded-lg mx-2"
            >
              <div className="w-6 h-6 rounded-lg bg-gray-700/50 flex items-center justify-center group-hover:bg-blue-500/20 transition-all duration-300 ease-out">
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
                  <path d="M9 9h6v6H9z" strokeWidth="2"/>
                </svg>
              </div>
              <span className="text-gray-300 font-medium group-hover:text-white transition-colors duration-300">Zoom to Fit</span>
              <div className="ml-auto">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out"></div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Click outside handler for context menu */}
      {contextMenuPosition && (
        <div 
          className="fixed inset-0 z-[40]" 
          onClick={() => setContextMenuPosition(null)}
        />
      )}

      {/* Relationship Editor Window */}
      <RelationshipEditorWindow
        isVisible={showRelationshipWindow}
        editingEdge={editingEdge}
        selectedNodes={selectedNodes}
        workItems={workItems}
        onClose={() => setShowRelationshipWindow(false)}
        onFlipDirection={() => {
          // The component handles flip internally
          setEditingEdge(null); // Clear after flip
        }}
        onDeleteEdge={(edgeId) => {
          setEditingEdge(null); // Clear after delete
        }}
        onCreateEdge={(sourceId, targetId, type) => {
          // Clear selection after create
          setSelectedNodes(new Set());
        }}
        showSuccess={showSuccess}
        showError={showError}
        refetchEdges={refetchEdges}
        onClearSelection={() => {
          setSelectedNodes(new Set());
        }}
      />


      {/* Work Item Details Modal */}
      {showNodeDetailsModal && selectedNode && (() => {
        // Always get fresh node data by ID from validatedNodes (synced with Apollo cache)
        const freshNode = validatedNodes.find(n => n.id === selectedNode.id) || selectedNode;
        return (
          <WorkItemDetailsModal
            isOpen={showNodeDetailsModal}
            onClose={() => {
              setShowNodeDetailsModal(false);
              setSelectedNode(null);
            }}
            node={freshNode}
            edges={validatedEdges}
            nodes={validatedNodes}
            onConnectToExisting={(node) => {
              setShowNodeDetailsModal(false);
              handleConnectToExistingNodes(node);
            }}
            onDisconnect={(node) => {
              setShowNodeDetailsModal(false);
              handleDisconnectNodes(node);
            }}
          />
        );
      })()}

      {/* Create Work Item Modal */}
      {showCreateNodeModal && (
        <CreateWorkItemModal
          isOpen={showCreateNodeModal}
          onClose={handleCloseCreateNodeModal}
          onSubmit={async (nodeData) => {
            // Handle node creation
            handleCloseCreateNodeModal();
          }}
        />
      )}

{/* Fullscreen toggle removed - fullscreen mode abandoned */}

    </div>
  );
}
