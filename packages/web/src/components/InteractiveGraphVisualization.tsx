import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import * as d3 from 'd3';
import { Link2, Edit3, Trash2, Folder, FolderOpen, Plus, FileText, Settings, Maximize2, ArrowLeft, X, GitBranch, Minus, Unlink } from 'lucide-react';
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
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { GET_WORK_ITEMS, GET_EDGES, CREATE_EDGE, UPDATE_EDGE, DELETE_EDGE, CREATE_WORK_ITEM } from '../lib/queries';
import { validateGraphData, getValidationSummary, ValidationResult } from '../utils/graphDataValidation';
import { DEFAULT_NODE_CONFIG } from '../constants/workItemConstants';

import { EditNodeModal } from './EditNodeModal';
import { DeleteNodeModal } from './DeleteNodeModal';
import { CreateNodeModal } from './CreateNodeModal';
import { CreateGraphModal } from './CreateGraphModal';
import { GraphSelectionModal } from './GraphSelectionModal';
import { UpdateGraphModal } from './UpdateGraphModal';
import { DeleteGraphModal } from './DeleteGraphModal';
import { ConnectNodeModal } from './ConnectNodeModal';
import { NodeDetailsModal } from './NodeDetailsModal';

import { WorkItem, WorkItemEdge } from '../types/graph';
import { RelationshipType, RELATIONSHIP_OPTIONS, getRelationshipConfig } from '../constants/workItemConstants';


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

export function InteractiveGraphVisualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentGraph, availableGraphs } = useGraph();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isFullscreen = location.pathname === '/graph';
  
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
  
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({ node: null, position: { x: 0, y: 0 }, visible: false });
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState>({ edge: null, position: { x: 0, y: 0 }, visible: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType>('DEFAULT_EDGE');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showDataHealth, setShowDataHealth] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
  const [selectedEdge, setSelectedEdge] = useState<WorkItemEdge | null>(null);
  const [showEdgeDetails, setShowEdgeDetails] = useState(false);
  const [edgeDetailsPosition, setEdgeDetailsPosition] = useState<{ x: number; y: number } | null>(null);
  const [createNodePosition, setCreateNodePosition] = useState<{ x: number; y: number; z: number } | undefined>(undefined);
  const [currentTransform, setCurrentTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [editingEdge, setEditingEdge] = useState<{ edge: WorkItemEdge; position: { x: number; y: number } } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number; graphX: number; graphY: number } | null>(null);
  
  // Level of detail thresholds
  const LOD_THRESHOLDS = {
    VERY_FAR: 0.3,    // Only show basic shapes
    FAR: 0.5,         // Add node icons  
    MEDIUM: 0.8,      // Add node titles
    CLOSE: 0.6,       // Add edge labels (earlier)
    VERY_CLOSE: 2.0   // Full detail
  };

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
  const [showLegend, setShowLegend] = useState(false);
  const [showGraphPanel, setShowGraphPanel] = useState(false);
  const [nodeCounter, setNodeCounter] = useState(1);
  

  // Calculate dynamic positioning for panels and minimized buttons to avoid overlap
  const getPanelPosition = (panelType: 'graph' | 'legend' | 'create') => {
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
    } else if (panelType === 'legend') {
      // Legend panel positioning depends on graph panel AND create button states
      let topOffset = 20; // Start position
      
      // Add graph panel height/button
      if (showGraphPanel) {
        topOffset += graphPanelHeight + expandedSpacing;
      } else {
        topOffset += buttonHeight + compactSpacing;
      }
      
      // Add create button height (only if not in empty state)
      if (!showEmptyStateOverlay) {
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
    optimisticResponse: (vars) => {
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
        }).catch((_error) => {
          // Error handled by GraphQL
        });
        initializeVisualization();
      }
      
      setIsConnecting(false);
      setConnectionSource(null);
    } else {
      // Set selected node for the Node Actions panel
      setSelectedNode(node);
      
      // Show node menu
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setNodeMenu({
          node,
          position: {
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top
          },
          visible: true
        });
      }
    }
  }, [isConnecting, connectionSource, selectedRelationType]);

  // Remove unused handleEdgeClick to fix TypeScript warning

  const workItems: WorkItem[] = workItemsData?.workItems || [];
  
  // Refetch data when graph changes
  useEffect(() => {
    if (currentGraph) {
      refetch();
      refetchEdges();
    }
  }, [currentGraph?.id, refetch, refetchEdges]);
  
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
  
  // Update validation state
  useEffect(() => {
    setValidationResult(currentValidationResult);
    
  }, [currentValidationResult.errors.length, currentValidationResult.warnings.length]);

  const validatedNodes = currentValidationResult.validNodes;
  const validatedEdges = currentValidationResult.validEdges;
  
  const nodes = [
    // Real nodes from database
    ...validatedNodes.map(item => ({
      ...item,
      x: item.positionX,
      y: item.positionY,
      priority: {
        executive: item.priorityExec,
        individual: item.priorityIndiv,
        community: item.priorityComm,
        computed: item.priorityComp
      }
    }))
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
    
    // Clear previous content
    svg.selectAll('*').remove();
    
    // Clear any existing HTML label containers
    d3.select(containerRef.current).selectAll('.node-labels-container').remove();

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr('width', width).attr('height', height);
    
    // Create zoom behavior for empty canvas
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        const g = svg.select('g');
        if (!g.empty()) {
          g.attr('transform', event.transform);
        }
      });

    svg.call(zoom);
    const g = svg.append('g');
  }, []);

  // Inline node creation function
  const createInlineNode = async (x: number, y: number) => {
    console.log('createInlineNode called with:', { x, y, currentGraph: currentGraph?.id, currentUser: currentUser?.id });
    if (!currentGraph?.id) {
      console.log('No current graph selected');
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
        priorityExec: DEFAULT_NODE_CONFIG.priorityExec,
        priorityIndiv: DEFAULT_NODE_CONFIG.priorityIndiv,
        priorityComm: DEFAULT_NODE_CONFIG.priorityComm,
        priorityComp: 0.0,
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
        refetch();
      }
    } catch (_error) {
      // Error handled by mutation error state
    }
  };

  // Define initializeVisualization function with access to nodes data
  const initializeVisualization = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Handle empty state
    if (nodes.length === 0) {
      initializeEmptyVisualization();
      return;
    }

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    
    // Clear previous content
    svg.selectAll('*').remove();
    
    // Clear any existing HTML label containers
    d3.select(containerRef.current).selectAll('.node-labels-container').remove();

    const width = container.clientWidth;
    const height = container.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    svg.attr('width', width).attr('height', height);
    
    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4]);

    const g = svg.append('g');

    // Add background for capturing clicks to show context menu
    const background = g.append('rect')
      .attr('class', 'background')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', 'default');

    // Apply zoom behavior to the svg
    svg.call(zoom);

    // Add click handler for context menu
    background.on('click', function(event: MouseEvent) {
      event.stopPropagation();
      
      // Close all existing dialogs first (exclusive dialog behavior)
      setEditingEdge(null);
      
      // Check if there was already a context menu open - if so, close it and show context menu on next click
      if (contextMenuPosition) {
        setContextMenuPosition(null);
        return; // Don't show menu on this click, wait for next click
      }
      
      const [graphX, graphY] = d3.pointer(event, g.node());
      
      // Set the context menu position (screen coordinates for menu, graph coordinates for node creation)
      setContextMenuPosition({
        x: event.clientX,
        y: event.clientY,
        graphX,
        graphY
      });
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
      if (!node.x) node.x = centerX + (Math.random() - 0.5) * 100;
      if (!node.y) node.y = centerY + (Math.random() - 0.5) * 100;
      node.fx = null;
      node.fy = null;
    });

    // Viewport culling - only render visible nodes for performance
    const margin = 200;
    const visibleNodes = currentTransform.scale < LOD_THRESHOLDS.VERY_FAR ? 
      nodes.filter((node: WorkItem) => {
        const nodeX = (node.positionX || 0) * currentTransform.scale + currentTransform.x;
        const nodeY = (node.positionY || 0) * currentTransform.scale + currentTransform.y;
        return nodeX >= -margin && nodeX <= width + margin && 
               nodeY >= -margin && nodeY <= height + margin;
      }) : nodes;
    
    // Simple 2D force simulation
    const simulation = d3.forceSimulation(visibleNodes as any);
    simulationRef.current = simulation; // Store reference for resize handling
    
    simulation
      .force('link', d3.forceLink(validatedEdges)
        .id((d: any) => d.id)
        .distance(500) // Much larger distance for massive spread
        .strength(0.05) // Weaker to allow more flexibility
      )
      .force('charge', d3.forceManyBody()
        .strength((d: any) => {
          // Much stronger repulsion for maximum spread
          switch (d.type) {
            case 'EPIC':
              return -1200; // Extreme repulsion
            case 'OUTCOME': 
              return -1000; 
            case 'MILESTONE':
              return -900;
            case 'FEATURE':
              return -800;
            case 'TASK':
              return -700;
            case 'BUG':
              return -700;
            case 'IDEA':
              return -600;
            default:
              return -800;
          }
        })
        .distanceMax(1500) // Much larger max distance for wider influence
      )
      .force('center', d3.forceCenter(centerX, centerY).strength(0.01)) // Minimal centering
      .force('x', d3.forceX(centerX).strength(0.002)) // Extremely weak horizontal centering for maximum width
      .force('y', d3.forceY(centerY).strength(0.002)) // Extremely weak vertical centering for maximum height
      .force('collision', d3.forceCollide(250) // Much larger collision radius for maximum spacing
        .strength(0.95) // Very strong collision prevention
        .iterations(5) // More iterations for better separation
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
      .attr('class', 'edge')
      .attr('stroke', (d: WorkItemEdge) => {
        const config = getRelationshipConfig(d.type as RelationshipType);
        return config.hexColor;
      })
      .attr('stroke-width', (d: WorkItemEdge) => (d.strength || 0.8) * 3)
      .attr('stroke-opacity', 0.7);
    
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
        
        // Simple positioning - use mouse coordinates
        setEdgeDetailsPosition({ x: event.clientX, y: event.clientY });
        setSelectedEdge(d);
        setShowEdgeDetails(true);
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

    // Add arrowhead markers for middle of edges
    const defs = svg.append('defs');
    
    // Create different arrowhead colors for each edge type
    RELATIONSHIP_OPTIONS.forEach((option) => {
      defs.append('marker')
        .attr('id', `arrowhead-${option.type}`)
        .attr('viewBox', '-5 -5 10 10')
        .attr('refX', 0)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .append('path')
        .attr('d', 'M-3,-3 L0,0 L-3,3 L-1,0 Z')
        .attr('fill', option.hexColor)
        .attr('stroke', option.hexColor)
        .attr('stroke-width', currentTransform.scale >= LOD_THRESHOLDS.FAR ? 1 : 0.5)
      .style('opacity', currentTransform.scale >= LOD_THRESHOLDS.VERY_FAR ? 1 : 0.3);
    });

    // Create nodes AFTER edges (so they render on top)
    const nodeElements = g.append('g')
      .attr('class', 'nodes-group')
      .selectAll('.node')
      .data(visibleNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          
          // Check if this is an edge creation attempt (Alt/Option key held)
          if (event.sourceEvent.altKey) {
            mousedownNodeRef.current = d;
            return;
          }
          
          // Normal drag behavior
          if (!event.active) simulation.alphaTarget(0.2).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          // Get node radius
          const nodeRadius = 30;
          // Constrain to container bounds
          d.fx = Math.max(nodeRadius, Math.min(width - nodeRadius, event.x));
          d.fy = Math.max(nodeRadius, Math.min(height - nodeRadius, event.y));
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
              }).catch((error) => {
            });
            
            mousedownNodeRef.current = null;
            return;
          }
          
          // Normal drag end behavior
          if (!event.active) simulation.alphaTarget(0.05);
          // Keep position fixed for a short time to allow other nodes to settle
          setTimeout(() => {
            d.fx = null;
            d.fy = null;
            simulation.alphaTarget(0.02);
          }, 500);
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
      .attr('class', 'node-bg')
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
      .attr('stroke', (d: WorkItem) => {
        // Highlight selected node with bright border
        if (selectedNode && selectedNode.id === d.id) {
          return '#10b981'; // Bright green for selected node
        }
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          return '#4b5563';
        }
        return '#4b5563'; // Gray border
      })
      .attr('stroke-width', (d: WorkItem) => {
        // Thicker border for selected node
        if (selectedNode && selectedNode.id === d.id) {
          return 3;
        }
        return 1.5;
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
      .style('opacity', currentTransform.scale >= LOD_THRESHOLDS.FAR ? 1 : 0)
      .style('font-size', '13px')
      .style('font-weight', '700')
      .style('fill', (d: WorkItem) => {
        const config = getTypeConfig(d.type as WorkItemType);
        return config.hexColor;
      })
      .style('pointer-events', 'none');

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
          .style('opacity', currentTransform.scale >= LOD_THRESHOLDS.MEDIUM ? 1 : 0)
          .style('font-size', '14px')
          .style('font-weight', '600')
          .style('fill', () => {
            const isCompleted = d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE';
            return isCompleted ? '#9ca3af' : '#ffffff';
          })
          .style('pointer-events', 'none');
      });

      // Add eye icon at bottom after title text ends
      const titleEndY = startY + (lines.length * 16) + 8; // 8px gap after title text
      
      const eyeIconGroup = nodeGroup.append('g')
        .attr('class', 'eye-icon-group')
        .attr('transform', `translate(0, ${titleEndY})`)
        .style('cursor', 'pointer')
        .style('pointer-events', 'all')
        .on('click', function(event) {
          event.stopPropagation();
          handleViewNodeDetails(d);
        });
      
      // Eye icon at bottom center
      eyeIconGroup.append('path')
        .attr('class', 'eye-icon-path')
        .attr('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z')
        .attr('fill', 'none')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', '1')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('transform', 'translate(-12, -12) scale(0.5)')
        .style('opacity', '0.7');
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
      .style('opacity', currentTransform.scale >= LOD_THRESHOLDS.CLOSE ? 1 : 0)
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
      
      const priority = d.priorityComp || d.priorityExec || 0;
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
        // Use the source node's color for the arrow
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as any)?.id));
        if (sourceNode) {
          return getNodeColor(sourceNode);
        }
        // Fallback to edge type color if node not found
        const config = getRelationshipConfig(d.type as RelationshipType);
        return config.hexColor;
      })
      .attr('stroke', (d: WorkItemEdge) => {
        // Use the source node's color for the arrow stroke
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as any)?.id));
        if (sourceNode) {
          return getNodeColor(sourceNode);
        }
        // Fallback to edge type color if node not found
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
        
        // Get the actual mouse click position (most accurate)
        const clickX = event.clientX;
        const clickY = event.clientY;
        
        // Position dropdown very close to the click point
        setEditingEdge({
          edge: d,
          position: { 
            x: clickX,  // Use exact click position
            y: clickY + 5  // Just 5px below the click
          }
        });
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
      .style('opacity', currentTransform.scale >= LOD_THRESHOLDS.CLOSE ? 1 : 0);

    // Add icons positioned to the left of text
    edgeLabelGroups
      .append('foreignObject')
      .style('opacity', currentTransform.scale >= LOD_THRESHOLDS.CLOSE ? 1 : 0)
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
                  }).catch((error) => {
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
      // Constrain nodes to container bounds
      nodes.forEach((d: any) => {
        const nodeRadius = 30;
        d.x = Math.max(nodeRadius, Math.min(width - nodeRadius, d.x || centerX));
        d.y = Math.max(nodeRadius, Math.min(height - nodeRadius, d.y || centerY));
      });
      
      // Update node positions
      nodeElements
        .attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);
        
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
      
      // Update LOD based on zoom level
      const scale = event.transform.k;
      
      // Smooth opacity transitions based on zoom level
      const getSmoothedOpacity = (threshold: number, fadeRange: number = 0.2) => {
        if (scale >= threshold + fadeRange) return 1;
        if (scale <= threshold - fadeRange) return 0;
        return (scale - (threshold - fadeRange)) / (fadeRange * 2);
      };
      
      // Update text opacities with smooth transitions
      g.selectAll('.node-type-text')
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.FAR));
      g.selectAll('.node-title-text')
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.MEDIUM));
      g.selectAll('.node-description-text')
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.CLOSE));
      g.selectAll('.edge-label')
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.CLOSE));
      g.selectAll('.edge-label-icon')
        .style('opacity', getSmoothedOpacity(LOD_THRESHOLDS.CLOSE));
      g.selectAll('.edge')
        .style('opacity', Math.max(0.1, getSmoothedOpacity(LOD_THRESHOLDS.VERY_FAR, 0.1)))
        .attr('stroke-width', scale >= LOD_THRESHOLDS.FAR ? 1 : Math.max(0.3, scale * 0.8));
    });

    // Properly restart simulation to ensure initial positioning works
    simulation.alpha(0.8).restart();
    
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

  // Initialization effect
  useEffect(() => {
    // Always initialize visualization (handles both empty and populated states)
    initializeVisualization();

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
  }, [nodes.length, validatedEdges.length]); // Only re-initialize when data changes, not on every render

  // Handle case where no graph is selected
  if (!currentGraph) {
    return (
      <div className="graph-container relative w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-yellow-300 text-xl mb-4">📊 No Graph Selected</div>
          <div className="text-gray-400 text-lg font-medium mb-6">Choose a graph to start visualizing</div>
          <button 
            onClick={() => setShowGraphSwitcher(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Select Graph
          </button>
        </div>
      </div>
    );
  }

  if (loading || edgesLoading) {
    return (
      <div className="graph-container relative w-full h-full bg-gray-900 flex items-center justify-center">
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
      <div ref={containerRef} className="graph-container relative w-full h-full bg-gray-900">
        <svg ref={svgRef} className="w-full h-full" style={{ background: 'radial-gradient(circle at center, #1f2937 0%, #111827 100%)' }}>
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
    setShowEditModal(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedNode(null);
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
    <div ref={containerRef} className="graph-container relative w-full bg-gray-900" style={{ height: '100vh', minHeight: '900px' }}>
      <svg ref={svgRef} className="w-full h-full" style={{ background: 'radial-gradient(circle at center, #1f2937 0%, #111827 100%)' }} />
      
      
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
      
      {/* Graph Control Panel */}
      {showGraphPanel && !isFullscreen ? (
        <div className="absolute left-4 z-40" style={{ top: '20px' }}>
          <div className={`bg-gray-800/95 backdrop-blur-sm border border-gray-600/60 rounded-lg shadow-xl ${isFullscreen ? 'p-0 w-32' : 'p-4 w-64'}`}>
            {/* Current Graph Header */}
            <div className={`flex items-center space-x-2 mb-3 ${isFullscreen ? 'p-2' : ''}`}>
              <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center flex-shrink-0">
                {getGraphTypeIcon(currentGraph?.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{currentGraph?.name || 'No Graph'}</div>
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 animate-pulse"></div>
              <button
                onClick={() => setShowGraphPanel(false)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                title="Minimize graph panel"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>

{!isFullscreen && (
          /* Graph Stats */
          <div className="grid grid-cols-3 gap-1 mb-3">
            <div className="bg-gray-700/50 rounded p-1 text-center">
              <div className="text-white text-sm font-medium">{nodes.length}</div>
              <div className="text-gray-400 text-xs">Nodes</div>
            </div>
            <div className="bg-gray-700/50 rounded p-1 text-center">
              <div className="text-white text-sm font-medium">{validatedEdges.length}</div>
              <div className="text-gray-400 text-xs">Edges</div>
            </div>
            <div className="bg-gray-700/50 rounded p-1 text-center">
              <div className="text-white text-sm font-medium">{currentGraph?.contributorCount || 0}</div>
              <div className="text-gray-400 text-xs">Users</div>
            </div>
          </div>
          )}

          {/* Action Buttons */}
          <div className={isFullscreen ? "space-y-1 p-2" : "space-y-2"}>
            {isFullscreen ? (
              <>
                {/* Reset Layout Button */}
                <button 
                  onClick={() => {
                    nodes.forEach((node: any) => {
                      node.userPinned = false;
                      node.userPreferredPosition = null;
                      node.userPreferenceVector = null;
                      node.fx = null;
                      node.fy = null;
                    });
                    if (simulationRef.current) {
                      simulationRef.current.alpha(0.3).restart();
                    }
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-1 rounded text-xs flex items-center justify-center space-x-1"
                >
                  <Settings className="w-3 h-3" />
                  <span>Reset</span>
                </button>

                {/* Create Node Button */}
                <button 
                  onClick={() => setShowCreateNodeModal(true)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-1 rounded text-xs flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Create</span>
                </button>

                {/* Node Types - minimal */}
                <div className="border-t border-gray-600 pt-1">
                  <div className="grid grid-cols-2 gap-1">
                    <button 
                      onClick={() => createInlineNode(400, 300)}
                      className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-1 rounded flex items-center justify-center"
                      title="Task"
                    >
                      <ListTodo className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => createInlineNode(400, 300)}
                      className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-1 rounded flex items-center justify-center"
                      title="Goal"
                    >
                      <Target className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Create New Graph Button */}
                <button 
                  onClick={() => setShowCreateGraphModal(true)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-3 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm">Create New Graph</span>
                </button>

                {/* Switch Graph Button */}
                <button 
                  onClick={() => setShowGraphSwitcher(true)}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2.5 px-3 rounded-lg transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="text-sm">Switch Graph</span>
                  </div>
                  <span className="text-xs bg-white px-2 py-1 rounded-full text-yellow-700 font-bold shadow-md">{availableGraphs.length}</span>
                </button>

                {/* Update and Delete Graph Buttons */}
                {currentGraph && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button 
                      onClick={() => setShowUpdateGraphModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-3 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Edit</span>
                    </button>
                    <button 
                      onClick={() => setShowDeleteGraphModal(true)}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-3 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Delete</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      ) : !isFullscreen && (
        <button
          onClick={() => setShowGraphPanel(true)}
          className="absolute left-4 z-40 backdrop-blur-sm border-0 rounded-lg shadow-xl px-3 py-2 text-white font-semibold transition-all duration-300 flex items-center space-x-2 transform hover:scale-105 w-36 h-10"
          style={{ 
            ...getPanelPosition('graph'),
            background: 'linear-gradient(135deg, #4285f4, #0f9d58, #ea4335)',
            boxShadow: '0 10px 25px rgba(66, 133, 244, 0.4)'
          }}
          title="Show graph panel"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #1a73e8, #137333, #d93025)';
            e.currentTarget.style.boxShadow = '0 15px 35px rgba(66, 133, 244, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4285f4, #0f9d58, #ea4335)';
            e.currentTarget.style.boxShadow = '0 10px 25px rgba(66, 133, 244, 0.4)';
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span className="text-xs font-medium">Graph Panel</span>
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 animate-pulse"></div>
          </div>
        </button>
      )}

      {/* Data Health Indicator */}
      {validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
        <div className="absolute top-20 right-6 z-40">
          <button 
            onClick={() => setShowDataHealth(!showDataHealth)}
            className="bg-yellow-600/90 backdrop-blur-sm border border-yellow-500 rounded-lg px-3 py-2 shadow-md hover:bg-yellow-500 transition-all duration-200"
            data-testid="data-health-indicator"
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-100" />
              <span className="text-sm font-medium text-yellow-100">Data Issues</span>
              <span className="text-xs bg-yellow-500 text-yellow-900 rounded-full px-2 py-0.5">
                {validationResult.errors.length + validationResult.warnings.length}
              </span>
            </div>
          </button>
          
          {/* Data Health Dashboard */}
          {showDataHealth && (
            <div className="absolute top-full right-0 mt-2 w-96 bg-gray-800/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-gray-600" data-testid="validation-summary">
                <h3 className="text-sm font-medium text-yellow-300 mb-2">Data Health Summary</h3>
                <p className="text-xs text-gray-400 mb-3">{getValidationSummary(validationResult)}</p>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-green-900/30 border border-green-500/30 rounded p-2">
                    <div className="text-green-300 font-medium">Valid Data</div>
                    <div className="text-green-100">{validationResult.stats.validNodes} nodes, {validationResult.stats.validEdges} edges</div>
                  </div>
                  <div className="bg-red-900/30 border border-red-500/30 rounded p-2">
                    <div className="text-red-300 font-medium">Invalid Data</div>
                    <div className="text-red-100">{validationResult.stats.invalidNodes} nodes, {validationResult.stats.invalidEdges} edges</div>
                  </div>
                </div>
              </div>
              
              {/* Errors Section */}
              {validationResult.errors.length > 0 && (
                <div className="p-4 border-b border-gray-600">
                  <h4 className="text-sm font-medium text-red-300 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Errors ({validationResult.errors.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {validationResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-xs bg-red-900/20 border border-red-500/30 rounded p-2">
                        <div className="text-red-200 font-medium">{error.message}</div>
                        {error.suggestion && (
                          <div className="text-red-300 mt-1">💡 {error.suggestion}</div>
                        )}
                      </div>
                    ))}
                    {validationResult.errors.length > 5 && (
                      <div className="text-xs text-gray-400 text-center">... and {validationResult.errors.length - 5} more errors</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Warnings Section */}
              {validationResult.warnings.length > 0 && (
                <div className="p-4">
                  <h4 className="text-sm font-medium text-yellow-300 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Warnings ({validationResult.warnings.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {validationResult.warnings.slice(0, 3).map((warning, index) => (
                      <div key={index} className="text-xs bg-yellow-900/20 border border-yellow-500/30 rounded p-2">
                        <div className="text-yellow-200 font-medium">{warning.message}</div>
                        {warning.suggestion && (
                          <div className="text-yellow-300 mt-1">💡 {warning.suggestion}</div>
                        )}
                      </div>
                    ))}
                    {validationResult.warnings.length > 3 && (
                      <div className="text-xs text-gray-400 text-center">... and {validationResult.warnings.length - 3} more warnings</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Graph Controls */}
      <div className="absolute bottom-4 right-4 space-y-2">        
        <button
          onClick={() => {
            // Reset all user preferences and return to algorithmic positioning
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
          }}
          className="block w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg backdrop-blur-sm border border-green-500/30"
        >
          Reset Layout
        </button>
      </div>

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
                    const priority = nodeMenu.node?.priority?.computed || nodeMenu.node?.priorityComp || 0;
                    return getPriorityIconElement(priority, "h-3 w-3 mr-1");
                  })()}
                  <span className="text-gray-400">Priority:</span>
                  <span className="ml-1 font-medium">{Math.round((nodeMenu.node?.priority?.computed || nodeMenu.node?.priorityComp || 0) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      (nodeMenu.node?.priority?.computed || nodeMenu.node?.priorityComp || 0) >= 0.8 ? 'bg-red-400' :
                      (nodeMenu.node?.priority?.computed || nodeMenu.node?.priorityComp || 0) >= 0.6 ? 'bg-orange-400' :
                      (nodeMenu.node?.priority?.computed || nodeMenu.node?.priorityComp || 0) >= 0.4 ? 'bg-yellow-400' :
                      (nodeMenu.node?.priority?.computed || nodeMenu.node?.priorityComp || 0) >= 0.2 ? 'bg-blue-400' :
                      'bg-gray-400'
                    }`}
                    style={{ width: `${Math.round((nodeMenu.node?.priority?.computed || nodeMenu.node?.priorityComp || 0) * 100)}%` }}
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
              onClick={() => handleDeleteNode(nodeMenu.node!)}
              className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-red-900/50"
            >
              <Trash2 className="h-4 w-4 mr-3" />
              Delete Node
            </button>
          </div>
        </div>
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
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl py-2 min-w-[200px]"
          style={{
            left: Math.min(contextMenuPosition.x, window.innerWidth - 220),
            top: Math.min(contextMenuPosition.y, window.innerHeight - 200)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              createInlineNode(contextMenuPosition.graphX, contextMenuPosition.graphY);
              setContextMenuPosition(null);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-gray-200 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Node</span>
          </button>
          
          <button
            onClick={() => {
              // Zoom to fit all nodes
              const svg = d3.select(svgRef.current);
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (svg.node() && containerRect && nodes.length > 0) {
                // Find bounds of all nodes using actual simulation positions
                const margin = 150;
                const nodePositions = nodes.map(node => ({
                  x: node.x || node.positionX || 0,
                  y: node.y || node.positionY || 0
                }));
                
                const xExtent = d3.extent(nodePositions, d => d.x) as [number, number];
                const yExtent = d3.extent(nodePositions, d => d.y) as [number, number];
                
                const width = containerRect.width;
                const height = containerRect.height;
                
                // Calculate the bounding box of all nodes (add padding for node radius)
                const nodeRadius = 50; // Account for node size
                const nodeWidth = Math.max(xExtent[1] - xExtent[0] + 2 * nodeRadius, 300);
                const nodeHeight = Math.max(yExtent[1] - yExtent[0] + 2 * nodeRadius, 300);
                
                // Calculate scale to fit all nodes with margin (be more conservative)
                const scaleX = (width - 2 * margin) / nodeWidth;
                const scaleY = (height - 2 * margin) / nodeHeight;
                const scale = Math.min(scaleX, scaleY, 0.8); // Max scale of 0.8x to zoom out more
                
                // Calculate center position of all nodes
                const nodesCenterX = (xExtent[0] + xExtent[1]) / 2;
                const nodesCenterY = (yExtent[0] + yExtent[1]) / 2;
                
                // Calculate screen center
                const screenCenterX = width / 2;
                const screenCenterY = height / 2;
                
                // Calculate translation to put the center of nodes at the center of the screen
                // Formula: translate = screenCenter - (nodeCenter * scale)
                const translateX = screenCenterX - nodesCenterX * scale;
                const translateY = screenCenterY - nodesCenterY * scale;
                
                console.log('Zoom to fit:', { 
                  scale, 
                  translateX, 
                  translateY, 
                  nodesCenterX, 
                  nodesCenterY, 
                  screenCenterX, 
                  screenCenterY,
                  width,
                  height,
                  xExtent,
                  yExtent
                });
                
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
            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-gray-200 flex items-center space-x-2"
          >
            <div className="h-4 w-4 flex items-center justify-center">
              <div className="w-3 h-3 border border-gray-400 rounded"></div>
            </div>
            <span>Zoom to Fit</span>
          </button>
        </div>
      )}

      {/* Click outside handler for context menu */}
      {contextMenuPosition && (
        <div 
          className="fixed inset-0 z-[40]" 
          onClick={() => setContextMenuPosition(null)}
        />
      )}

      {/* Modern Inline Edge Type Editor Dropdown */}
      {editingEdge && (
        <div
          className="absolute z-50"
          style={{
            left: editingEdge.position.x,
            top: editingEdge.position.y,
            transform: 'translateX(-50%)',  // Center horizontally only
            minWidth: '250px',
            animation: 'fadeInScale 0.2s ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Remove arrow since dropdown is at same position as label */}
          
          {/* Dropdown content with professional shadow */}
          <div className="bg-gray-800/98 backdrop-blur-xl border border-gray-700/50 rounded-lg shadow-2xl overflow-hidden"
               style={{
                 boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)'
               }}>
            {/* Header */}
            <div className="px-3 py-2 bg-gradient-to-r from-gray-800 to-gray-700 border-b border-gray-700/50">
              <div className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>Select Relationship Type</span>
                <button
                  onClick={() => setEditingEdge(null)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
            
            {/* Options with scroll */}
            <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              <div className="p-1">
                {RELATIONSHIP_OPTIONS.map((option, index) => (
                  <button
                    key={option.type}
                    onClick={() => {
                      // Update the edge type with animation
                      updateEdgeMutation({
                        variables: {
                          where: { id: editingEdge.edge.id },
                          update: { type: option.type }
                        }
                      }).then((result) => {
                        
                        // Immediately update the D3 visualization without waiting for refetch
                        const svg = d3.select(svgRef.current);
                        const edgeId = editingEdge.edge.id;
                        const newType = option.type;
                        const config = getRelationshipConfig(newType);
                        
                        // Update edge label text and layout immediately
                        svg.selectAll('.edge-label-group')
                          .filter((d: any) => d.id === edgeId)
                          .each(function() {
                            const group = d3.select(this);
                            const textElement = group.select('.edge-label');
                            
                            // Update text
                            textElement.text(config.label);
                            
                            // Update icon to match new relationship type
                            const iconElement = group.select('.edge-label-icon');
                            const { IconComponent } = getRelationshipIconForD3(newType);
                            const iconContainer = iconElement.node();
                            if (iconContainer) {
                              const uniqueId = `edge-icon-${edgeId}-${Date.now()}`;
                              iconElement.html(`<div id="${uniqueId}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"></div>`);
                              
                              const newContainer = document.getElementById(uniqueId);
                              if (newContainer) {
                                const root = ReactDOM.createRoot(newContainer);
                                root.render(React.createElement(IconComponent, { 
                                  className: "h-3 w-3 text-white"
                                }));
                              }
                            }
                            
                            // Recalculate layout after text change
                            const bbox = (textElement.node() as SVGTextElement).getBBox();
                            const iconWidth = 14;
                            const spacing = 8;
                            const paddingLeft = 6;
                            const paddingRight = 8;
                            const totalWidth = paddingLeft + iconWidth + spacing + bbox.width + paddingRight;
                            const totalHeight = Math.max(22, bbox.height + 8);
                            
                            // Update background rectangle
                            group.select('.edge-label-bg')
                              .attr('width', totalWidth)
                              .attr('height', totalHeight)
                              .attr('x', -totalWidth / 2)
                              .attr('y', -totalHeight / 2)
                              .style('fill', config.hexColor);
                            
                            // Reposition icon
                            group.select('.edge-label-icon')
                              .attr('x', -totalWidth / 2 + paddingLeft)
                              .attr('y', -totalHeight / 2 + (totalHeight - 14) / 2);
                            
                            // Reposition text  
                            textElement
                              .attr('x', -totalWidth / 2 + paddingLeft + iconWidth + spacing)
                              .attr('text-anchor', 'start');
                          });
                        
                        // Update edge stroke color immediately
                        svg.selectAll('.edge')
                          .filter((d: any) => d.id === edgeId)
                          .attr('stroke', config.hexColor);
                        
                        
                        setEditingEdge(null);
                      }).catch((error) => {
                      });
                    }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                      editingEdge.edge.type === option.type
                        ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30'
                        : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    }`}
                    style={{
                      animationDelay: `${index * 20}ms`
                    }}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      {/* Icon with color */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${
                        editingEdge.edge.type === option.type 
                          ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20' 
                          : 'bg-gray-700/50'
                      }`}>
                        {getRelationshipIconElement(option.type, 'h-4 w-4')}
                      </div>
                      
                      {/* Label and description */}
                      <div className="text-left">
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                      </div>
                    </div>
                    
                    {/* Selected indicator */}
                    {editingEdge.edge.type === option.type && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-400 font-medium">Current</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Footer with current selection */}
            <div className="px-3 py-2 bg-gray-900/50 border-t border-gray-700/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  Current: <span className="text-gray-300 font-medium">
                    {getRelationshipConfig(editingEdge.edge.type as RelationshipType).label}
                  </span>
                </span>
                <kbd className="px-1.5 py-0.5 text-xs bg-gray-800 rounded border border-gray-700 text-gray-400">
                  ESC to close
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Node Button - Hide when no nodes exist */}
      {!showEmptyStateOverlay && !isFullscreen && (
      <button
        onClick={() => createInlineNode(400, 300)}
        className="absolute left-4 z-40 backdrop-blur-sm border-0 rounded-lg shadow-xl px-3 py-2 text-white font-semibold transition-all duration-300 flex items-center space-x-2 transform hover:scale-105 w-36 h-10"
        style={{ 
          ...getPanelPosition('create'),
          background: 'linear-gradient(135deg, #10b981, #059669)',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)'
        }}
        title="Create new node"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #059669, #047857)';
          e.currentTarget.style.boxShadow = '0 15px 35px rgba(16, 185, 129, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          e.currentTarget.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.4)';
        }}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span className="text-xs font-medium">Create Node</span>
          </div>
        </div>
      </button>
      )}


      {/* Legend */}
      {showLegend && !isFullscreen ? (
        <div className="absolute left-4 bg-gray-800/95 backdrop-blur-sm border border-gray-600/60 rounded-lg shadow-xl p-4 w-64" style={getPanelPosition('legend')}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-white">Node Types</div>
            <button
              onClick={() => setShowLegend(false)}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
              title="Minimize legend"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
            <div className="flex items-center space-x-2">
              {getTypeIconElement('EPIC', "w-4 h-4")}
              <span>Epic</span>
            </div>
            <div className="flex items-center space-x-2">
              {getTypeIconElement('TASK', "w-4 h-4")}
              <span>Task</span>
            </div>
            <div className="flex items-center space-x-2">
              {getTypeIconElement('MILESTONE', "w-4 h-4")}
              <span>Milestone</span>
            </div>
            <div className="flex items-center space-x-2">
              {getTypeIconElement('BUG', "w-4 h-4")}
              <span>Bug</span>
            </div>
            <div className="flex items-center space-x-2">
              {getTypeIconElement('OUTCOME', "w-4 h-4")}
              <span>Outcome</span>
            </div>
            <div className="flex items-center space-x-2">
              {getTypeIconElement('IDEA', "w-4 h-4")}
              <span>Idea</span>
            </div>
            <div className="flex items-center space-x-2">
              {getTypeIconElement('FEATURE', "w-4 h-4")}
              <span>Feature</span>
            </div>
            <div className="flex items-center space-x-2">
              {getTypeIconElement('RESEARCH', "w-4 h-4")}
              <span>Research</span>
            </div>
          </div>
          <hr className="border-gray-600 mt-3" />
          <div className="pt-3">
            <div className="text-sm text-gray-500 opacity-85 w-full leading-relaxed text-left">
              • Select nodes to access menu<br/>
              • Drag to reposition<br/>
              • Scroll for zoom<br/>
              • Select edges for options
            </div>
          </div>
        </div>
      ) : !isFullscreen && (
        <button
          onClick={() => setShowLegend(true)}
          className="absolute left-4 z-40 backdrop-blur-sm border-0 rounded-lg shadow-xl px-3 py-2 text-white font-semibold transition-all duration-300 flex items-center space-x-2 transform hover:scale-105 w-36 h-10"
          style={{ 
            ...getPanelPosition('legend'),
            background: 'linear-gradient(135deg, #ec4899, #f97316)',
            boxShadow: '0 10px 25px rgba(236, 72, 153, 0.4)'
          }}
          title="Show legend"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #f43f5e, #ec4899)';
            e.currentTarget.style.boxShadow = '0 15px 35px rgba(244, 63, 94, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #ec4899, #f97316)';
            e.currentTarget.style.boxShadow = '0 10px 25px rgba(236, 72, 153, 0.4)';
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium">Node Types</span>
            </div>
          </div>
        </button>
      )}

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
          onEdit={(node) => {
            setShowNodeDetailsModal(false);
            setShowEditModal(true);
            // Don't set selectedNode again since it's already the correct node
          }}
        />
      )}

      {/* Edit Node Modal */}
      {showEditModal && selectedNode && (
        <EditNodeModal
          isOpen={showEditModal}
          onClose={handleCloseEditModal}
          node={selectedNode}
        />
      )}

      {/* Delete Node Modal */}
      {showDeleteModal && selectedNode && (
        <DeleteNodeModal
          isOpen={showDeleteModal}
          onClose={handleCloseDeleteModal}
          nodeId={selectedNode.id}
          nodeTitle={selectedNode.title}
          nodeType={selectedNode.type}
          onOpenDisconnectModal={handleOpenDisconnectFromDelete}
        />
      )}

      {/* Create Graph Modal */}
      {showCreateGraphModal && (
        <CreateGraphModal
          isOpen={showCreateGraphModal}
          onClose={() => setShowCreateGraphModal(false)}
        />
      )}

      {/* Graph Selection Modal */}
      {showGraphSwitcher && (
        <GraphSelectionModal
          isOpen={showGraphSwitcher}
          onClose={() => setShowGraphSwitcher(false)}
        />
      )}

      {/* Update Graph Modal */}
      {showUpdateGraphModal && (
        <UpdateGraphModal
          isOpen={showUpdateGraphModal}
          onClose={() => setShowUpdateGraphModal(false)}
        />
      )}

      {/* Delete Graph Modal */}
      {showDeleteGraphModal && (
        <DeleteGraphModal
          isOpen={showDeleteGraphModal}
          onClose={() => setShowDeleteGraphModal(false)}
        />
      )}


      {/* Create Node Modal */}
      {showCreateNodeModal && selectedNode && (
        <CreateNodeModal
          isOpen={showCreateNodeModal}
          onClose={handleCloseCreateNodeModal}
          parentNodeId={selectedNode.id}
          position={createNodePosition}
        />
      )}

      {/* Create Node Modal - For Empty State */}
      {showCreateNodeModal && !selectedNode && (
        <CreateNodeModal
          isOpen={showCreateNodeModal}
          onClose={() => setShowCreateNodeModal(false)}
        />
      )}

      {/* Connect Node Modal - With Connect and Disconnect Tabs */}
      {showConnectModal && selectedNode && (
        <ConnectNodeModal
          isOpen={showConnectModal}
          onClose={handleCloseConnectModal}
          sourceNode={{
            id: selectedNode.id,
            title: selectedNode.title,
            type: selectedNode.type
          }}
          initialTab={connectModalInitialTab}
          onAllConnectionsRemoved={openedFromDeleteModal ? () => {
            // Auto-return to delete modal when all connections removed
            setShowConnectModal(false);
            setOpenedFromDeleteModal(false);
            setConnectModalInitialTab('connect');
            setShowDeleteModal(true);
          } : undefined}
        />
      )}

      {/* Edge Details Panel */}
      {showEdgeDetails && selectedEdge && (
        <div 
          className="fixed w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50"
          style={{
            left: `${edgeDetailsPosition ? Math.min(edgeDetailsPosition.x - 160, window.innerWidth - 320) : window.innerWidth - 340}px`,
            top: `${edgeDetailsPosition ? Math.max(edgeDetailsPosition.y - 100, 10) : 20}px`
          }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Edge Details</h3>
              <button
                onClick={() => {
                  setShowEdgeDetails(false);
                  setSelectedEdge(null);
                  setEdgeDetailsPosition(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-300">Relationship Type</label>
                <div className="flex items-center space-x-2 mt-1">
                  {getRelationshipIconElement(selectedEdge.type, 'h-4 w-4')}
                  <span className="text-white">{getRelationshipConfig(selectedEdge.type).label}</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">From</label>
                <p className="text-white text-sm mt-1">
                  {typeof selectedEdge.source === 'string' ? selectedEdge.source : (selectedEdge.source as any)?.title || (selectedEdge.source as any)?.id || 'Unknown'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">To</label>
                <p className="text-white text-sm mt-1">
                  {typeof selectedEdge.target === 'string' ? selectedEdge.target : (selectedEdge.target as any)?.title || (selectedEdge.target as any)?.id || 'Unknown'}
                </p>
              </div>
              
              {selectedEdge.description && (
                <div>
                  <label className="text-sm font-medium text-gray-300">Description</label>
                  <p className="text-white text-sm mt-1">{selectedEdge.description}</p>
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-600">
                <button
                  onClick={async () => {
                    try {
                      await deleteEdgeMutation({
                        variables: { where: { id: selectedEdge.id } }
                      });
                      setShowEdgeDetails(false);
                      setSelectedEdge(null);
                      setEdgeDetailsPosition(null);
                      showSuccess('Edge Deleted', 'Relationship removed successfully');
                    } catch (error: any) {
                      showError('Delete Failed', error.message || 'Could not delete edge');
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Relationship</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Toggle */}
      {isFullscreen ? (
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 right-6 z-50 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg border border-gray-600 flex items-center space-x-2 transition-colors shadow-lg"
          title="Back to Workspace"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
      ) : (
        <button
          onClick={() => navigate('/graph')}
          className="absolute top-4 right-6 z-50 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg border border-gray-600 flex items-center space-x-2 transition-colors shadow-lg"
          title="Full Zen Mode"
        >
          <Maximize2 className="h-5 w-5" />
          <span>Zen Mode</span>
        </button>
      )}

    </div>
  );
}
