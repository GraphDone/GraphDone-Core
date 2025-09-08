import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import * as d3 from 'd3';
import { Link2, Edit3, Trash2, Folder, FolderOpen, Plus, FileText, Settings, Maximize2, ArrowLeft, X, GitBranch, Minus, Unlink, Crosshair } from 'lucide-react';
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
import { GET_WORK_ITEMS, GET_EDGES, CREATE_EDGE, UPDATE_EDGE, DELETE_EDGE, CREATE_WORK_ITEM, UPDATE_WORK_ITEM } from '../lib/queries';
import { validateGraphData, getValidationSummary, ValidationResult } from '../utils/graphDataValidation';
import { DEFAULT_NODE_CONFIG } from '../constants/workItemConstants';

import { DeleteNodeModal } from './DeleteNodeModal';
import { RelationshipEditorWindow } from './RelationshipEditorWindow';
import { CreateNodeModal } from './CreateNodeModal';
import { CreateGraphModal } from './CreateGraphModal';
import { GraphSelectionModal } from './GraphSelectionModal';
import { UpdateGraphModal } from './UpdateGraphModal';
import { DeleteGraphModal } from './DeleteGraphModal';
import { ConnectNodeModal } from './ConnectNodeModal';
import { NodeDetailsModal } from './NodeDetailsModal';

import { WorkItem, WorkItemEdge } from '../types/graph';
import { RelationshipType, RELATIONSHIP_OPTIONS, getRelationshipConfig } from '../constants/workItemConstants';

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

interface InteractiveGraphVisualizationProps {
  onResetLayout?: () => void;
}

export function InteractiveGraphVisualization({ onResetLayout }: InteractiveGraphVisualizationProps = {}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentGraph, availableGraphs } = useGraph();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  
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
    pollInterval: currentGraph ? 100 : 0,
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
    pollInterval: currentGraph ? 100 : 0,
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
  
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({ node: null, position: { x: 0, y: 0 }, visible: false });
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState>({ edge: null, position: { x: 0, y: 0 }, visible: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType>('DEFAULT_EDGE');
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

  // Function to get SVG path for priority icons
  const getPriorityIconSvgPath = (priorityValue: number): string => {
    if (priorityValue >= 0.8) return 'M12 2L2 7v10c0 5.55 3.84 10 9 11 1.16-.21 2.31-.54 3.42-1.01C16.1 26.46 18.05 25.24 20 23.5 21.95 21.76 23.84 19.54 24 17v-10L12 2z'; // Flame
    if (priorityValue >= 0.6) return 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'; // Zap
    if (priorityValue >= 0.4) return 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'; // Triangle (star-like)
    if (priorityValue >= 0.2) return 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z'; // Circle
    return 'M12 5v14m-7-7l7 7 7-7'; // ArrowDown
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
    
    if (isConnecting && connectionSource) {
      // Complete connection
      if (connectionSource !== node.id) {
        // Check if edge already exists
        if (edgeExists(connectionSource, node.id)) {
          setIsConnecting(false);
          setConnectionSource(null);
          return;
        }
        
        // Create edge in backend
        createEdgeMutation({
          variables: {
            input: [{
              type: selectedRelationType,
              weight: 0.8,
              source: { connect: { where: { node: { id: connectionSource } } } },
              target: { connect: { where: { node: { id: node.id } } } },
            }]
          }
        }).then(() => {
          // Edge created successfully
        }).catch(() => {
          // Error handled by GraphQL
        });
        // Don't reinitialize - let refetchQueries handle the update
      }
      
      setIsConnecting(false);
      setConnectionSource(null);
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
      
      let x = item.positionX;
      let y = item.positionY;
      
      // If node has never been positioned (0,0) and has no connections, place it on periphery
      if ((item.positionX === 0 && item.positionY === 0) && !hasConnections) {
        const angle = (index / validatedNodes.length) * 2 * Math.PI;
        const radius = Math.min(window.innerWidth, window.innerHeight) * 0.4; // Place on outer ring
        const centerX = 0; // Start from center
        const centerY = 0;
        x = centerX + Math.cos(angle) * radius;
        y = centerY + Math.sin(angle) * radius;
      }
      
      const node = {
        ...item,
        x,
        y,
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
      .filter((event: any) => {
        // Reverse mouse wheel direction for more intuitive zooming
        // Scroll up = zoom in (deltaY negative), Scroll down = zoom out (deltaY positive)
        if (event.type === 'wheel') {
          event.deltaY = -event.deltaY;
        }
        return true;
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
    
    // Restore zoom transform if this is a surgical update
    if (!isFirstInit && currentTransform) {
      svg.call(zoom.transform, currentTransform);
    }
  }, []);

  // Inline node creation function
  const createInlineNode = async (x: number, y: number) => {
    // Create inline node function
    if (!currentGraph?.id) {
      // No current graph selected
      return;
    }
    
    try {
      // Generate a unique name that doesn't conflict with existing nodes
      let nodeTitle = `New Node ${nodeCounter}`;
      let attempts = 0;
      
      // Check if name already exists and generate a new one if needed
      while (validatedNodes.some(node => node.title.toLowerCase().trim() === nodeTitle.toLowerCase().trim()) && attempts < 100) {
        attempts++;
        nodeTitle = `New Node ${nodeCounter + attempts}`;
      }
      
      // Update counter for next node
      if (attempts > 0) {
        setNodeCounter(prev => prev + attempts);
      }
      
      
      const workItemInput = {
        title: nodeTitle,
        description: DEFAULT_NODE_CONFIG.description,
        type: DEFAULT_NODE_CONFIG.type,
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
        // Let Apollo's cache update handle the UI update instead of refetch to avoid camera jumping
        // The refetchQueries in the mutation config will handle the data update
      }
    } catch (_error) {
      // Error handled by mutation error state
    }
  };

  // Smart data update function - only reinitializes when necessary, preserves camera position
  const updateVisualizationData = useCallback(() => {
    if (!simulationRef.current || !svgRef.current) return;
    
    console.log('[Graph Debug] Checking for data changes...');
    
    const svg = d3.select(svgRef.current);
    const simulation = simulationRef.current;
    
    // Get current data counts from DOM
    const currentNodeCount = svg.select('.nodes-group').selectAll('.node').size();
    const currentEdgeCount = svg.select('.edges-group').selectAll('.edge').size();
    const newNodeCount = nodes.length;
    const newEdgeCount = validatedEdges.length;
    
    console.log('[Graph Debug] Data counts:', {
      currentNodes: currentNodeCount,
      newNodes: newNodeCount,
      currentEdges: currentEdgeCount,
      newEdges: newEdgeCount
    });

    // Check if we need full reinitialization (node/edge count changed)
    const needsReinit = (currentNodeCount !== newNodeCount) || (currentEdgeCount !== newEdgeCount);
    
    if (needsReinit) {
      console.log('[Graph Debug] Data structure changed - triggering reinitialization with preserved camera');
      setReinitTrigger(prev => prev + 1);
      return;
    }

    // If counts are the same, just update simulation data (for property changes)
    console.log('[Graph Debug] Data counts unchanged - updating simulation data only');
    
    // Update simulation with current data (handles property changes)
    simulation.nodes(nodes as any);
    const linkForce = simulation.force('link') as d3.ForceLink<any, any>;
    if (linkForce) {
      linkForce.links(validatedEdges);
    }

    // Gentle restart to settle any property changes
    simulation.alpha(0.1).restart();
    
    console.log('[Graph Debug] Simulation data updated');
  }, [nodes, validatedEdges]);

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
      .filter((event: any) => {
        // Reverse mouse wheel direction for more intuitive zooming
        // Scroll up = zoom in (deltaY negative), Scroll down = zoom out (deltaY positive)
        if (event.type === 'wheel') {
          event.deltaY = -event.deltaY;
        }
        return true;
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
    
    // Restore zoom transform if this is a surgical update
    if (!isFirstInit && currentTransform) {
      svg.call(zoom.transform, currentTransform);
    }

    // Add click handler for context menu on background
    background.on('click', function(event: MouseEvent) {
      event.stopPropagation();
      
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

    // Initialize all nodes at screen center for 2D layout
    nodes.forEach((node: any) => {
      // Reset any user pinning/positioning (like Reset Layout button)
      node.userPinned = false;
      node.userPreferredPosition = null;
      node.userPreferenceVector = null;
      node.fx = null;
      node.fy = null;
      
      // Set initial position at screen center with some randomness
      if (!node.x) node.x = centerX + (Math.random() - 0.5) * 100;
      if (!node.y) node.y = centerY + (Math.random() - 0.5) * 100;
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
    
    simulation
      .force('link', d3.forceLink(validatedEdges)
        .id((d: any) => d.id)
        .distance((d: any) => {
          const minDistance = Math.min(width, height) * 0.4; // 40% of screen size for minimum
          const maxDistance = Math.min(width, height) * 0.6; // 60% of screen size for maximum
          
          // Calculate current distance between nodes
          const sourceNode = d.source;
          const targetNode = d.target;
          const currentDistance = Math.sqrt(
            Math.pow(targetNode.x - sourceNode.x, 2) + 
            Math.pow(targetNode.y - sourceNode.y, 2)
          );
          
          // If current distance exceeds maximum, return maximum to create pulling force
          if (currentDistance > maxDistance) {
            return maxDistance;
          }
          
          // Otherwise use minimum as preferred distance
          return minDistance;
        })
        .strength((d: any) => {
          // Calculate current distance between nodes
          const sourceNode = d.source;
          const targetNode = d.target;
          const currentDistance = Math.sqrt(
            Math.pow(targetNode.x - sourceNode.x, 2) + 
            Math.pow(targetNode.y - sourceNode.y, 2)
          );
          
          const maxDistance = Math.min(width, height) * 0.6;
          
          // Stronger force when edge is too long to create pulling effect
          if (currentDistance > maxDistance) {
            return 0.8; // Strong pulling force
          }
          
          // Normal strength otherwise
          return 0.3;
        })
      )
      .force('charge', d3.forceManyBody()
        .strength(-100) // Simple, consistent repulsion for all nodes
        .distanceMax(200) // Reasonable influence range
      )
      .force('center', d3.forceCenter(centerX, centerY).strength(0.01)) // Minimal centering
      .force('x', d3.forceX(centerX).strength(0.002)) // Extremely weak horizontal centering for maximum width
      .force('y', d3.forceY(centerY).strength(0.002)) // Extremely weak vertical centering for maximum height
      .force('collision', d3.forceCollide(90) // Sufficient collision radius to prevent overlap
        .strength(0.7) // Moderate collision prevention
        .iterations(2) // Fewer iterations for stability
      )
      // Add hierarchical attraction forces (Epic->Milestone, Feature->Task, etc.)
      .force('hierarchy', d3.forceLink()
        .id((d: any) => d.id)
        .links(createHierarchicalLinks(nodes))
        .distance((d: any) => d.distance || 250) // Much larger hierarchical distance
        .strength((d: any) => d.strength || 0.05) // Very weak hierarchical strength
      )
      .alphaTarget(0.05) // Lower alpha target for calmer simulation
      .alphaDecay(0.015) // Slightly slower decay for better collision resolution
      .velocityDecay(0.4); // Add velocity decay for smoother movement

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
          
          if (dragDistance < stretchThreshold) {
            // Cluster movement - move connected nodes together
            const deltaX = event.x - d.x;
            const deltaY = event.y - d.y;
            
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
          
          // Move the dragged node
          d.fx = event.x;
          d.fy = event.y;
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
          
          // Gradually reduce simulation energy to let other nodes settle
          setTimeout(() => {
            simulation.alphaTarget(0.02);
          }, 1000);
          mousedownNodeRef.current = null;
        }));

    // Monopoly-style rectangular nodes with colored title bars
    const getNodeDimensions = (d: WorkItem) => {
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
      
      // Calculate additional height needed for multiple lines (16px per extra line)
      const additionalHeight = (lines - 1) * 16;
      const finalHeight = baseDimensions.height + additionalHeight;
      
      return { 
        width: width, 
        height: finalHeight,
        titleLines: lines,
        maxCharsPerLine: maxCharsPerLine
      };
    };
    
    // Main node rectangle (dark theme background)
    nodeElements.append('rect')
      .attr('class', (d: WorkItem) => {
        let classes = 'node-bg';
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
      .style('filter', 'url(#node-drop-shadow)')
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
      
      console.log('[Graph Debug] + button clicked, opening relationship window');
      
      // Simply open the relationship window - avoid changing selectedNodes to prevent graph refresh
      setShowRelationshipWindow(true);
      setEditingEdge(null);
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
        
        // Auto-show relationship window when edge is clicked
        if (!showRelationshipWindow) {
          setShowRelationshipWindow(true);
          // Set the selected edge with initial position for new window
          setEditingEdge({
            edge: d,
            position: { x: 200, y: 80 } // Initial position for new window
          });
        } else {
          // Window already visible, just update the edge data (preserve window position)
          setEditingEdge(prev => prev ? {
            edge: d,
            position: prev.position // Keep existing window position
          } : {
            edge: d,
            position: { x: 200, y: 80 }
          });
        }
        setDragOffset({ x: 0, y: 0 }); // Reset drag offset
      });

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
      
      // Context menu disabled - just select the node
      setSelectedNode(d);
      lastSelectedNodeRef.current = d; // Track last selected
      
      // Apply glow effect
      applyNodeGlowImmediately(d);
      
      // Context menu disabled
      return;
      /*
      // Show context menu for advanced actions
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setNodeMenu({
          node: d,
          position: {
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top
          },
          visible: true
        });
      }
      */
    });

    const updateEdgePositions = () => {
      // Update visible edge positions
      linkElements
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      
      // Update clickable edge positions  
      clickableEdges
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
        
      // Update arrow positions
      arrowElements
        .attr('transform', (d: any) => {
          const midX = (d.source.x + d.target.x) / 2;
          const midY = (d.source.y + d.target.y) / 2;
          const angle = Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x) * 180 / Math.PI;
          return `translate(${midX},${midY}) rotate(${angle})`;
        });

      // Update edge label group positions to follow edge angles
      edgeLabelGroups
        .attr('transform', (d: any) => {
          const midX = (d.source.x + d.target.x) / 2;
          const midY = (d.source.y + d.target.y) / 2;
          const angle = Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x) * 180 / Math.PI;
          
          // Offset perpendicular to the edge
          const offsetDistance = 25;
          const perpAngle = (angle + 90) * Math.PI / 180;
          const offsetX = Math.cos(perpAngle) * offsetDistance;
          const offsetY = Math.sin(perpAngle) * offsetDistance;
          
          // Keep text readable by limiting rotation
          let textRotation = angle;
          if (angle > 90 || angle < -90) {
            textRotation = angle + 180; // Flip text to keep it readable
          }
          
          return `translate(${midX + offsetX},${midY + offsetY}) rotate(${textRotation})`;
        });
    };

    // Simulation tick
    simulation.on('tick', () => {
      // Allow nodes to move freely without bounds constraints
      
      // DEBUG: Log if any nodes are at origin during tick
      const nodesAtOrigin = nodes.filter((n: any) => (n.x === 0 || n.x === undefined) && (n.y === 0 || n.y === undefined));
      if (nodesAtOrigin.length > 0) {
        console.log('[CRITICAL DEBUG] Nodes at origin during tick:', nodesAtOrigin.length, 'out of', nodes.length);
        console.log('[CRITICAL DEBUG] First few nodes at origin:', nodesAtOrigin.slice(0, 3).map((n: any) => ({id: n.id, x: n.x, y: n.y})));
      }
      
      // Update node positions
      nodeElements
        .attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);

      // Ensure text elements are visible and properly positioned after position updates
      g.selectAll('.node-type-text, .node-title-text, .node-description-text' as any)
        .style('visibility', 'visible')
        .style('opacity', function(this: any) {
          // Restore LOD-appropriate opacity if it was hidden
          const currentOpacity = parseFloat(d3.select(this).style('opacity')) || 0;
          if (currentOpacity === 0) {
            // Get current scale from the svg element
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

      // Update mini-map with current node positions
      if ((window as any).updateMiniMapPositions && nodes.length > 0) {
        const positions: {[key: string]: {x: number, y: number}} = {};
        nodes.forEach((node: any) => {
          if (node.x !== undefined && node.y !== undefined) {
            positions[node.id] = { x: node.x, y: node.y };
          }
        });
        (window as any).updateMiniMapPositions(positions);
      }
        
      // Always update edges to stay anchored to nodes
      updateEdgePositions();
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
        if ((window as any).debugLog) {
          (window as any).debugLog('Graph', '🔍 Zoom/pan event', viewportUpdate);
        }
        console.log('🔍 ZOOM-EVENT viewport update:', viewportUpdate);
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

    // Configure simulation for stability
    simulation
      .alpha(0.6) // Lower starting energy for stability
      .alphaDecay(0.015) // Slower decay for smoother movement
      .restart();
    
    // Add method to restart collision detection
    (simulation as any).restartCollisions = () => {
      simulation.alphaTarget(0.3).restart();
      setTimeout(() => {
        simulation.alphaTarget(0.05);
      }, 2000);
    };
  }, [nodes, validatedEdges, handleNodeClick, initializeEmptyVisualization]); // Include handleNodeClick to get fresh connection state

  // Store simulation reference for resize handling
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const mousedownNodeRef = useRef<any>(null);

  // Fit view to show all nodes
  const fitViewToNodes = useCallback(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Calculate bounding box of all nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    nodes.forEach((node: any) => {
      const x = node.x || 0;
      const y = node.y || 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    
    if (!isFinite(minX)) return; // No valid positions
    
    // Add padding
    const padding = 100;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;
    
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    
    // Calculate scale to fit all nodes
    const scale = Math.min(
      width / boundsWidth,
      height / boundsHeight,
      2 // Max zoom level
    );
    
    // Calculate translate to center the bounds
    const centerX = width / 2;
    const centerY = height / 2;
    const boundsCenterX = (minX + maxX) / 2;
    const boundsCenterY = (minY + maxY) / 2;
    
    const translateX = centerX - boundsCenterX * scale;
    const translateY = centerY - boundsCenterY * scale;
    
    // Apply the transform
    const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    svg.call(d3.zoom<SVGSVGElement, unknown>().transform as any, transform);
  }, [nodes]);

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

  // Reset layout function
  const resetLayout = useCallback(() => {
    nodes.forEach((node: any) => {
      node.userPinned = false;
      node.userPreferredPosition = null;
      node.userPreferenceVector = null;
      node.fx = null;
      node.fy = null;
      // Clear positioning cache to force recalculation
      node.targetX = null;
      node.targetY = null;
    });
    initializeVisualization();
    // Auto-fit after reset
    setTimeout(() => {
      fitViewToNodes();
    }, 1000);
  }, [nodes, initializeVisualization, fitViewToNodes]);

  // Auto-fit view when component first mounts with nodes - using stable dependency
  const hasNodes = nodes.length > 0;
  useEffect(() => {
    if (hasNodes && svgRef.current) {
      // Check if this is the initial load (no previous transform stored)
      const hasStoredTransform = sessionStorage.getItem('graphViewTransform');
      if (!hasStoredTransform) {
        // First time loading - auto fit after simulation settles
        const timer = setTimeout(() => {
          fitViewToNodes();
          // Store the fitted transform
          if (svgRef.current) {
            const svg = d3.select(svgRef.current);
            const transform = d3.zoomTransform(svg.node()!);
            sessionStorage.setItem('graphViewTransform', JSON.stringify({
              x: transform.x,
              y: transform.y,
              k: transform.k
            }));
          }
        }, 1500);
        return () => clearTimeout(timer);
      } else {
        // Restore previous transform
        try {
          const saved = JSON.parse(hasStoredTransform);
          const timer = setTimeout(() => {
            if (svgRef.current) {
              const svg = d3.select(svgRef.current);
              const transform = d3.zoomIdentity.translate(saved.x, saved.y).scale(saved.k);
              svg.call(d3.zoom<SVGSVGElement, unknown>().transform as any, transform);
            }
          }, 500);
          return () => clearTimeout(timer);
        } catch (e) {
          // If stored transform is invalid, auto-fit
          const timer = setTimeout(() => {
            fitViewToNodes();
          }, 1500);
          return () => clearTimeout(timer);
        }
      }
    }
    return undefined;
  }, [hasNodes]); // Removed fitViewToNodes dependency to prevent camera jumps

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

  // Comprehensive reinitialization effect - ONLY when actually needed
  useEffect(() => {
    console.log('[Graph Debug] Checking if reinitialization needed...', { 
      nodesLength: nodes.length, 
      edgesLength: validatedEdges.length,
      trigger: reinitTrigger,
      currentGraph: currentGraph?.id
    });
    
    // Only reinitialize if this is truly necessary
    const shouldReinit = 
      !svgRef.current ||
      !containerRef.current ||
      nodes.length === 0 ||
      !d3.select(svgRef.current).select('.main-graph-group').node() ||
      reinitTrigger > 0;
    
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
    edgesLoading // Re-init when edges loading completes
    // Removed JSON.stringify dependency - it was triggering reinitialization on every node property change
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
      <div ref={containerRef} className="graph-container relative w-full h-full">
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
    const sourceTitle = edge.source || 'Unknown';
    const targetTitle = edge.target || 'Unknown';
    if (confirm(`Are you sure you want to delete the ${edge.type.toLowerCase()} relationship between "${sourceTitle}" and "${targetTitle}"?`)) {
      deleteEdgeMutation({
        variables: {
          where: { id: edge.id }
        }
      });
    }
    setEdgeMenu(prev => ({ ...prev, visible: false }));
  };


  return (
    <div ref={containerRef} className="graph-container relative w-full h-full overflow-hidden select-none">
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
              Break free from rigid hierarchies. Create your first node and experience how GraphDone intelligently connects ideas, surfaces priorities, and accelerates meaningful outcomes.
            </div>
            
            <button 
              onClick={() => createInlineNode(400, 300)}
              className="bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center gap-3 mx-auto pointer-events-auto cursor-pointer shadow-lg hover:shadow-xl hover:shadow-green-500/25 transform hover:-translate-y-0.5 hover:scale-105"
            >
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                <Plus className="h-3 w-3" />
              </div>
              Create Your First Node
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
      



      {/* Connection Mode Indicator */}
      {isConnecting && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <Link2 className="h-4 w-4" />
            <span>Click target node to create {selectedRelationType.replace('_', ' ')} relationship</span>
            <button
              onClick={() => {
                setIsConnecting(false);
                setConnectionSource(null);
              }}
              className="ml-2 text-blue-200 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Relationship Type Selector */}
      {isConnecting && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3">
          <div className="text-sm font-medium text-green-300 mb-2">Relationship Type:</div>
          <select
            value={selectedRelationType}
            onChange={(e) => setSelectedRelationType(e.target.value as RelationshipType)}
            className="w-full border border-gray-600 bg-gray-700 text-gray-200 rounded px-2 py-1 text-sm"
          >
            {RELATIONSHIP_OPTIONS.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label} - {option.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Node Context Menu */}
      {nodeMenu.visible && nodeMenu.node && (
        <>
          {/* Backdrop for node menu */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setNodeMenu({ node: null, position: { x: 0, y: 0 }, visible: false })}
          />
          <div
            className="absolute bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 z-50 max-h-96 overflow-y-auto"
            style={{
              left: nodeMenu.position.x,
              top: nodeMenu.position.y,
              minWidth: '250px'
            }}
            onClick={(e) => e.stopPropagation()}
        >
          {/* Node Info Header with Close Button */}
          <div className="px-4 py-2 border-b border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getNodeColor(nodeMenu.node) }}
              />
              <span className="font-medium text-gray-100">{nodeMenu.node.title}</span>
              </div>
              <button
                onClick={() => setNodeMenu(prev => ({ ...prev, visible: false }))}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="Close menu"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-200" />
              </button>
            </div>
            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
              <span className="flex items-center">
                {(() => {
                  const status = nodeMenu.node?.status?.toUpperCase() || '';
                  const statusIcon = getStatusIconElement(status as any, "h-3 w-3 mr-1");
                  const getStatusBgColor = () => {
                    const statusConfig = getStatusConfig(status as WorkItemStatus);
                    return `${statusConfig.color} ${statusConfig.bgColor} px-2 py-0.5 rounded`;
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
                    return getTypeIconElement(nodeMenu.node.type as any, "h-3 w-3 mr-1");
                  };
                  const getTypeBgColor = () => {
                    if (!nodeMenu.node?.type) return 'text-gray-400 bg-gray-400/10 px-2 py-0.5 rounded';
                    const typeConfig = getTypeConfig(nodeMenu.node.type as any);
                    return `${typeConfig.color} ${typeConfig.bgColor} px-2 py-0.5 rounded`;
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

          {/* Quick Stats */}
          <div className="px-4 py-2 border-b border-gray-600">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center">
                  {(() => {
                    const priority = nodeMenu.node?.priority || 0;
                    return getPriorityIconElement(priority, "h-3 w-3 mr-1");
                  })()}
                  <span className="text-gray-400">Priority:</span>
                  <span className="ml-1 font-medium">{Math.round((nodeMenu.node?.priority || 0) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      (nodeMenu.node?.priority || 0) >= 0.8 ? 'bg-red-400' :
                      (nodeMenu.node?.priority || 0) >= 0.6 ? 'bg-orange-400' :
                      (nodeMenu.node?.priority || 0) >= 0.4 ? 'bg-yellow-400' :
                      (nodeMenu.node?.priority || 0) >= 0.2 ? 'bg-blue-400' :
                      'bg-gray-400'
                    }`}
                    style={{ width: `${Math.round((nodeMenu.node?.priority || 0) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={() => {
                setShowCreateNodeModal(true);
                setSelectedNode(null);
                setNodeMenu(prev => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <Plus className="h-4 w-4 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Add New Node</div>
                <div className="text-xs text-gray-400 mt-0.5">Create a standalone node</div>
              </div>
            </button>
            <button
              onClick={(e) => handleCreateConnectedNode(nodeMenu.node!, e)}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <GitBranch className="h-4 w-4 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Create New & Connect</div>
                <div className="text-xs text-gray-400 mt-0.5">Add a new node linked to this one</div>
              </div>
            </button>
            <button
              onClick={() => handleConnectToExistingNodes(nodeMenu.node!)}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <Link2 className="h-4 w-4 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Connect to Existing Nodes</div>
                <div className="text-xs text-gray-400 mt-0.5">Link this to other nodes in graph</div>
              </div>
            </button>
            <button
              onClick={() => handleDisconnectNodes(nodeMenu.node!)}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:bg-red-900/20"
            >
              <Unlink className="h-4 w-4 mr-3 flex-shrink-0 text-red-400" />
              <div className="text-left">
                <div className="font-medium">Disconnect Nodes</div>
                <div className="text-xs text-gray-400 mt-0.5">Remove connections from this node</div>
              </div>
            </button>
            <div className="border-t border-gray-600 my-1"></div>
            <button 
              onClick={() => handleViewNodeDetails(nodeMenu.node!)}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <FileText className="h-4 w-4 mr-3" />
              View Details
            </button>
            <button 
              onClick={() => handleEditNode(nodeMenu.node!)}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <Edit3 className="h-4 w-4 mr-3" />
              Edit Node Details
            </button>
            <button 
              onClick={() => {
                centerOnNode(nodeMenu.node!.id);
                setNodeMenu(prev => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <Crosshair className="h-4 w-4 mr-3" />
              Center on Node
            </button>
            <button 
              onClick={() => handleDeleteNode(nodeMenu.node!)}
              className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-red-900/50"
            >
              <Trash2 className="h-4 w-4 mr-3" />
              Delete Node
            </button>
          </div>
        </div>
        </>
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
            {/* Reload Button - at the top for recovery */}
            <button
              onClick={() => {
                console.log('[Graph Debug] User triggered page reload from context menu');
                window.location.reload();
              }}
              className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-gray-200 flex items-center space-x-3 transition-all duration-300 ease-out group rounded-lg mx-2 border-b border-white/5 mb-2"
            >
              <div className="w-6 h-6 rounded-lg bg-gray-700/50 flex items-center justify-center group-hover:bg-red-500/20 transition-all duration-300 ease-out">
                <ArrowLeft className="h-4 w-4 text-gray-400 group-hover:text-red-400 transition-colors duration-300 transform group-hover:rotate-[-90deg]" />
              </div>
              <span className="text-gray-300 font-medium group-hover:text-red-400 transition-colors duration-300">Reload Page</span>
              <div className="ml-auto text-xs text-gray-500 group-hover:text-red-400">Recovery</div>
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
              <span className="text-gray-300 font-medium group-hover:text-white transition-colors duration-300">Create Node</span>
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


      {/* Node Details Modal */}
      {showNodeDetailsModal && selectedNode && (
        <NodeDetailsModal
          isOpen={showNodeDetailsModal}
          onClose={() => {
            setShowNodeDetailsModal(false);
            setSelectedNode(null);
          }}
          node={selectedNode}
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
      )}

{/* Fullscreen toggle removed - fullscreen mode abandoned */}

    </div>
  );
}
