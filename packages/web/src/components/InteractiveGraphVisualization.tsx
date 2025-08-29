import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Link2, Edit3, Trash2, AlertTriangle, AlertCircle, Layers, Sparkles, ListTodo, Trophy, Target, Lightbulb, Microscope, Folder, FolderOpen, Plus, FileText, Settings, Unlink, ClipboardList, Calendar, Clock, CheckCircle, Zap, Flame, Triangle, Circle, ArrowDown, X, GitBranch, Minus } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { GET_WORK_ITEMS, GET_EDGES, CREATE_EDGE, UPDATE_EDGE, DELETE_EDGE } from '../lib/queries';
import { relationshipTypeInfo } from '../types/projectData';
import { validateGraphData, getValidationSummary, ValidationResult } from '../utils/graphDataValidation';
import { EditNodeModal } from './EditNodeModal';
import { DeleteNodeModal } from './DeleteNodeModal';
import { CreateNodeModal } from './CreateNodeModal';
import { CreateGraphModal } from './CreateGraphModal';
import { GraphSelectionModal } from './GraphSelectionModal';
import { UpdateGraphModal } from './UpdateGraphModal';
import { DeleteGraphModal } from './DeleteGraphModal';
import { ConnectNodeModal } from './ConnectNodeModal';
import { NodeDetailsModal } from './NodeDetailsModal';

import { WorkItem, WorkItemEdge, RelationshipType } from '../types/graph';

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
  
  const { data: workItemsData, loading, error, refetch } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph ? {
      where: {
        graph: {
          id: currentGraph.id
        }
      }
    } : { where: {} },
    fetchPolicy: currentGraph ? 'cache-and-network' : 'cache-only',
    pollInterval: currentGraph ? 5000 : 0,
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
    pollInterval: currentGraph ? 5000 : 0,
    errorPolicy: 'all'
  });

  // Mutation for creating edges
  const [createEdgeMutation] = useMutation(CREATE_EDGE, {
    refetchQueries: [
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
    onError: (error) => {
      if (import.meta.env.DEV) {
        console.error('Failed to create edge:', error);
      }
    }
  });
  
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({ node: null, position: { x: 0, y: 0 }, visible: false });
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState>({ edge: null, position: { x: 0, y: 0 }, visible: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType>('DEPENDS_ON');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showDataHealth, setShowDataHealth] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateNodeModal, setShowCreateNodeModal] = useState(false);
  const [showNodeDetailsModal, setShowNodeDetailsModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectModalInitialTab, setConnectModalInitialTab] = useState<'connect' | 'disconnect'>('connect');
  const [showCreateGraphModal, setShowCreateGraphModal] = useState(false);
  const [showGraphSwitcher, setShowGraphSwitcher] = useState(false);
  const [showUpdateGraphModal, setShowUpdateGraphModal] = useState(false);
  const [showDeleteGraphModal, setShowDeleteGraphModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkItem | null>(null);
  const [createNodePosition, setCreateNodePosition] = useState<{ x: number; y: number; z: number } | undefined>(undefined);
  const [currentTransform, setCurrentTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [showLegend, setShowLegend] = useState(true);
  const [showGraphPanel, setShowGraphPanel] = useState(true);

  // Calculate dynamic positioning for panels and minimized buttons to avoid overlap
  const getPanelPosition = (panelType: 'graph' | 'legend' | 'create') => {
    const graphPanelHeight = 295; // Height of expanded graph panel
    const legendPanelHeight = 220; // Height of expanded legend panel
    const createPanelHeight = 80; // Height of expanded create panel
    const buttonHeight = 48; // Height of minimized buttons (h-12 = 48px)
    const compactSpacing = 27; // Spacing when panel is minimized
    const expandedSpacing = 32; // Spacing when panel is expanded
    
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
      
      // Add create button height (always a button)
      topOffset += buttonHeight + compactSpacing;
      
      return { top: `${topOffset}px` };
    }
    
    return { top: '20px' };
  };

  // Additional edge operations
  const [updateEdgeMutation] = useMutation(UPDATE_EDGE, {
    refetchQueries: [{ 
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
    }],
  });

  const [deleteEdgeMutation] = useMutation(DELETE_EDGE, {
    refetchQueries: [{ 
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
    }],
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


  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setNodeMenu(prev => ({ ...prev, visible: false }));
      setEdgeMenu(prev => ({ ...prev, visible: false }));
      setSelectedNode(null); // Clear selected node when clicking outside
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleNodeClick = useCallback((event: MouseEvent, node: WorkItem) => {
    event.stopPropagation();
    
    if (isConnecting && connectionSource) {
      // Complete connection
      if (connectionSource !== node.id) {
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
          if (import.meta.env.DEV) {
            console.log('✅ Edge created successfully');
          }
        }).catch((error) => {
          if (import.meta.env.DEV) {
            console.error('❌ Failed to create edge:', error);
          }
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
        description: `${edge.type.toLowerCase().replace('_', ' ')} relationship`
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
  

  const nodes = validatedNodes.map(item => ({
    ...item,
    x: item.positionX,
    y: item.positionY,
    priority: {
      executive: item.priorityExec,
      individual: item.priorityIndiv,
      community: item.priorityComm,
      computed: item.priorityComp
    }
  }));
  
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

    svg.call(zoom);
    const g = svg.append('g');

    // Initialize all nodes at screen center for 2D layout
    nodes.forEach((node: any) => {
      if (!node.x) node.x = centerX + (Math.random() - 0.5) * 100;
      if (!node.y) node.y = centerY + (Math.random() - 0.5) * 100;
      node.fx = null;
      node.fy = null;
    });

    // Simple 2D force simulation
    const simulation = d3.forceSimulation(nodes as any);
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

    // Create edges FIRST (so they render under nodes)
    const linkElements = g.append('g')
      .attr('class', 'edges-group')
      .selectAll('.edge')
      .data(validatedEdges)
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('stroke', (d: WorkItemEdge) => {
        switch (d.type) {
          case 'DEPENDS_ON': return '#10b981';
          case 'BLOCKS': return '#dc2626';
          case 'RELATES_TO': return '#3b82f6';
          case 'PART_OF': return '#f59e0b';
          default: return '#6b7280';
        }
      })
      .attr('stroke-width', (d: WorkItemEdge) => (d.strength || 0.8) * 3)
      .attr('stroke-opacity', 0.7);

    // Add arrowhead markers for middle of edges
    const defs = svg.append('defs');
    
    // Create different arrowhead colors for each edge type
    const edgeTypes = ['DEPENDS_ON', 'BLOCKS', 'RELATES_TO', 'PART_OF'];
    const edgeColors = ['#10b981', '#dc2626', '#3b82f6', '#f59e0b'];
    
    edgeTypes.forEach((type, index) => {
      defs.append('marker')
        .attr('id', `arrowhead-${type}`)
        .attr('viewBox', '-5 -5 10 10')
        .attr('refX', 0)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .append('path')
        .attr('d', 'M-3,-3 L0,0 L-3,3 L-1,0 Z')
        .attr('fill', edgeColors[index])
        .attr('stroke', edgeColors[index])
        .attr('stroke-width', 1);
    });

    // Create nodes AFTER edges (so they render on top)
    const nodeElements = g.append('g')
      .attr('class', 'nodes-group')
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
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
          if (!event.active) simulation.alphaTarget(0.05);
          // Keep position fixed for a short time to allow other nodes to settle
          setTimeout(() => {
            d.fx = null;
            d.fy = null;
            simulation.alphaTarget(0.02);
          }, 500);
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
        
        const colors: Record<string, string> = {
          EPIC: '#c084fc',      // fuchsia-400 - exact match with icon
          MILESTONE: '#fb923c', // orange-400 - exact match with icon  
          OUTCOME: '#818cf8',   // indigo-400 - exact match with icon
          FEATURE: '#38bdf8',   // sky-400 - exact match with icon
          TASK: '#4ade80',      // green-400 - exact match with icon
          BUG: '#ef4444',       // red-500 - exact match with icon
          IDEA: '#eab308',      // yellow-500 - exact match with icon
          RESEARCH: '#2dd4bf'   // teal-400 - exact match with icon
        };
        return colors[d.type] || '#6B7280';
      })
      .attr('stroke', (d: WorkItem) => {
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          return '#6b7280';
        }
        
        const borderColors: Record<string, string> = {
          EPIC: '#a855f7',      // fuchsia-500 - slightly darker than bg
          MILESTONE: '#f97316', // orange-500 - slightly darker than bg
          OUTCOME: '#6366f1',   // indigo-500 - slightly darker than bg
          FEATURE: '#0ea5e9',   // sky-500 - slightly darker than bg
          TASK: '#22c55e',      // green-500 - slightly darker than bg
          BUG: '#dc2626',       // red-600 - slightly darker than bg
          IDEA: '#d97706',      // yellow-600 - darker border
          RESEARCH: '#14b8a6'   // teal-500 - slightly darker than bg
        };
        return borderColors[d.type] || '#4B5563';
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
      .style('font-size', '13px')
      .style('font-weight', '700')
      .style('fill', (d: WorkItem) => {
        switch (d.type.toUpperCase()) {
          case 'EPIC': return '#c084fc'; // fuchsia-400
          case 'STORY': return '#60a5fa'; // blue-400
          case 'TASK': return '#4ade80'; // green-400
          case 'MILESTONE': return '#fb923c'; // orange-400
          case 'BUG': return '#ef4444'; // red-500
          case 'FEATURE': return '#38bdf8'; // sky-400
          case 'OUTCOME': return '#818cf8'; // indigo-400
          case 'IDEA': return '#eab308'; // yellow-500
          case 'RESEARCH': return '#2dd4bf'; // teal-400
          default: return '#ffffff';
        }
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
      
      // Calculate status percentage
      const statusPercentage = (() => {
        switch (d.status) {
          case 'PROPOSED': return 20;
          case 'PLANNED': return 40;
          case 'BLOCKED': return 50;
          case 'IN_PROGRESS': return 70;
          case 'COMPLETED': return 100;
          default: return 0;
        }
      })();
      
      // Get status color
      const statusColor = (() => {
        switch (d.status) {
          case 'PROPOSED': return '#06b6d4'; // cyan
          case 'PLANNED': return '#a855f7'; // purple
          case 'IN_PROGRESS': return '#eab308'; // yellow
          case 'COMPLETED': return '#22c55e'; // green
          case 'BLOCKED': return '#ef4444'; // red
          default: return '#9ca3af'; // gray
        }
      })();
      
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
      
      // Status icon (SVG) - positioned after "Status" text
      const statusLabelX = barX + barWidth / 2 - 8;
      const statusIconX = statusLabelX + 15; // Position after "Status" text
      nodeGroup.append('svg')
        .attr('class', 'status-icon-svg')
        .attr('x', statusIconX)
        .attr('y', barY - 22)
        .attr('width', 10)
        .attr('height', 10)
        .attr('viewBox', '0 0 24 24')
        .style('pointer-events', 'none')
        .append('path')
        .attr('d', getStatusIconPath(d.status))
        .attr('fill', 'none')
        .attr('stroke', statusColor)
        .attr('stroke-width', '2')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');

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
      
      // Priority icon (SVG) - positioned after "Priority" text
      const priorityLabelX = barX + barWidth / 2;
      const priorityIconX = priorityLabelX + 18 - 2; // Position after "Priority" text, shifted left by 2
      nodeGroup.append('svg')
        .attr('class', 'priority-icon-svg')
        .attr('x', priorityIconX)
        .attr('y', barY - 22)
        .attr('width', 10)
        .attr('height', 10)
        .attr('viewBox', '0 0 24 24')
        .style('pointer-events', 'none')
        .append('path')
        .attr('d', getPriorityIconPath(priority))
        .attr('fill', 'none')
        .attr('stroke', priorityColor)
        .attr('stroke-width', '2')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');

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
        switch (d.type) {
          case 'DEPENDS_ON': return '#10b981';
          case 'BLOCKS': return '#dc2626';
          case 'RELATES_TO': return '#3b82f6';
          case 'PART_OF': return '#f59e0b';
          default: return '#6b7280';
        }
      })
      .attr('stroke', (d: WorkItemEdge) => {
        // Use the source node's color for the arrow stroke
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as any)?.id));
        if (sourceNode) {
          return getNodeColor(sourceNode);
        }
        // Fallback to edge type color if node not found
        switch (d.type) {
          case 'DEPENDS_ON': return '#10b981';
          case 'BLOCKS': return '#dc2626';
          case 'RELATES_TO': return '#3b82f6';
          case 'PART_OF': return '#f59e0b';
          default: return '#6b7280';
        }
      })
      .attr('stroke-width', 1)
      .attr('opacity', 1);

    // Add click handlers to nodes
    nodeElements.on('click', (event: MouseEvent, d: WorkItem) => {
      handleNodeClick(event, d);
    });

    const updateEdgePositions = () => {
      // Update edge positions - D3 has already updated source/target with current positions
      linkElements
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

    // Update zoom
    zoom.on('zoom', (event) => {
      g.attr('transform', event.transform);
      setCurrentTransform({ 
        x: event.transform.x, 
        y: event.transform.y, 
        scale: event.transform.k 
      });
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
    switch (node.type) {
      case 'EPIC': return '#c084fc';      // fuchsia-400 - matches icon
      case 'FEATURE': return '#38bdf8';   // sky-400 - matches icon
      case 'TASK': return '#4ade80';      // green-400 - matches icon
      case 'BUG': return '#ef4444';       // red-500 - matches icon
      case 'MILESTONE': return '#fb923c'; // orange-400 - matches icon
      case 'OUTCOME': return '#818cf8';   // indigo-400 - matches icon
      case 'IDEA': return '#eab308';      // yellow-500 - matches icon
      case 'RESEARCH': return '#2dd4bf';  // teal-400 - matches icon
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#22c55e';
      case 'IN_PROGRESS': return '#3b82f6';
      case 'BLOCKED': return '#dc2626';
      case 'PLANNED': return '#f59e0b';
      case 'PROPOSED': return '#a855f7';
      case 'CANCELLED': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Helper function to get status icon SVG path (Lucide React icons)
  const getStatusIconPath = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PROPOSED': return 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'; // ClipboardList
      case 'PLANNED': return 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'; // Calendar
      case 'IN_PROGRESS': return 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm0-13v6l4 2'; // Clock with circle
      case 'COMPLETED': return 'M22 11.08V12a10 10 0 1 1-5.93-9.14m4.93 0L12 9l-2 2'; // CheckCircle
      case 'BLOCKED': return 'M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'; // AlertCircle
      default: return 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01';
    }
  };

  // Helper function to get priority icon SVG path (Lucide React icons)
  const getPriorityIconPath = (priority: number) => {
    if (priority >= 0.8) return 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'; // Flame
    if (priority >= 0.6) return 'M13 2L3 14h9l-1 8 10-12h-9z'; // Zap  
    if (priority >= 0.4) return 'M12 2L2 22h20z'; // Triangle
    if (priority >= 0.2) return 'M12 22a10 10 0 1 1 10-10 10 10 0 0 1-10 10z'; // Circle
    return 'M12 5v14m-7-7l7 7 7-7'; // ArrowDown - simpler path
  };

  // Helper function to get node type icon SVG path (exact Lucide React icons)
  const getNodeTypeIconPath = (type: string) => {
    switch (type.toUpperCase()) {
      case 'EPIC': return 'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.84l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84L12.83 2.18ZM22 17.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'; // Layers
      case 'MILESTONE': return 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M4 15l1-1h4l2 2h2l2-2h4l1 1M8 21l4-7 4 7'; // Trophy
      case 'OUTCOME': return 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z'; // Target
      case 'FEATURE': return 'm9.937 15.5-.5-8.5h5.126l-.5 8.5m-4.126 0h4.126m-4.126 0c-.476 2.837-1.961 5.5-3.437 5.5-1.476 0-2.961-2.663-3.437-5.5m10.437 0c.476 2.837 1.961 5.5 3.437 5.5 1.476 0 2.961-2.663 3.437-5.5'; // Sparkles
      case 'TASK': return 'M3 6h18M3 12h18m-9 6h9'; // ListTodo
      case 'BUG': return 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4m0 4h.01'; // AlertTriangle
      case 'IDEA': return 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6m-5 4h4'; // Lightbulb
      case 'RESEARCH': return 'M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1M9 14h.01M9 18h.01'; // Microscope
      default: return 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z'; // Default - Target
    }
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

  const handleCreateConnectedNode = (node: WorkItem, event: any) => {
    console.log('Creating connected node from parent:', node);
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
    console.log('Connect to existing clicked for node:', node);
    setSelectedNode(node);
    setConnectModalInitialTab('connect'); // Open to connect tab
    setShowConnectModal(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  const handleDisconnectNodes = (node: WorkItem) => {
    console.log('Disconnect clicked for node:', node);
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
    setSelectedNode(null);
    setConnectModalInitialTab('connect'); // Reset to connect tab
  };


  const handleEditEdge = (edge: WorkItemEdge) => {
    // For now, just allow changing the relationship type
    const sourceTitle = edge.source || 'Unknown';
    const targetTitle = edge.target || 'Unknown';
    const newType = prompt(`Change relationship type for "${sourceTitle}" → "${targetTitle}". Current: ${edge.type}`, edge.type);
    if (newType && newType !== edge.type) {
      updateEdgeMutation({
        variables: {
          where: { id: edge.id },
          update: { type: newType }
        }
      });
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
              onClick={() => setShowCreateNodeModal(true)}
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
      {showGraphPanel ? (
        <div className="absolute left-4 z-40" style={{ top: '20px' }}>
          <div className="bg-gray-800/95 backdrop-blur-sm border border-gray-600/60 rounded-lg shadow-xl p-4 w-64">
            {/* Current Graph Header */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                {getGraphTypeIcon(currentGraph?.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{currentGraph?.name || 'No Graph Selected'}</div>
                <div className="text-xs text-gray-400">{currentGraph?.type || 'Select a graph to begin'}</div>
              </div>
              <div className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0 animate-pulse"></div>
              <button
                onClick={() => setShowGraphPanel(false)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                title="Minimize graph panel"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>

          {/* Graph Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-700/50 rounded-md p-2 text-center">
              <div className="text-white text-lg font-medium">{nodes.length}</div>
              <div className="text-gray-400 text-xs">Nodes</div>
            </div>
            <div className="bg-gray-700/50 rounded-md p-2 text-center">
              <div className="text-white text-lg font-medium">{validatedEdges.length}</div>
              <div className="text-gray-400 text-xs">Edges</div>
            </div>
            <div className="bg-gray-700/50 rounded-md p-2 text-center">
              <div className="text-white text-lg font-medium">{currentGraph?.contributorCount || 0}</div>
              <div className="text-gray-400 text-xs">Users</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
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
          </div>
        </div>
      </div>
      ) : (
        <button
          onClick={() => setShowGraphPanel(true)}
          className="absolute left-4 z-40 backdrop-blur-sm border-0 rounded-lg shadow-xl px-4 py-3 text-white font-semibold transition-all duration-300 flex items-center space-x-2 transform hover:scale-105 w-40 h-12"
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
              <span className="text-sm font-medium">Graph Panel</span>
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 animate-pulse"></div>
          </div>
        </button>
      )}

      {/* Data Health Indicator */}
      {validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
        <div className="absolute top-4 right-4 z-40">
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
            {Object.entries(relationshipTypeInfo).map(([type, info]) => (
              <option key={type} value={type}>
                {type.replace('_', ' ')} - {info.description}
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
          {/* Node Info Header */}
          <div className="px-4 py-2 border-b border-gray-600">
            <div className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getNodeColor(nodeMenu.node) }}
              />
              <span className="font-medium text-gray-100">{nodeMenu.node.title}</span>
            </div>
            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
              <span className="flex items-center">
                {(() => {
                  const status = nodeMenu.node?.status?.toUpperCase() || '';
                  const getStatusIcon = () => {
                    switch (status) {
                      case 'PROPOSED': return <ClipboardList className="h-3 w-3 mr-1 text-cyan-400" />;
                      case 'PLANNED': return <Calendar className="h-3 w-3 mr-1 text-purple-400" />;
                      case 'IN_PROGRESS': return <Clock className="h-3 w-3 mr-1 text-yellow-400" />;
                      case 'COMPLETED': return <CheckCircle className="h-3 w-3 mr-1 text-green-400" />;
                      case 'BLOCKED': return <AlertCircle className="h-3 w-3 mr-1 text-red-400" />;
                      default: return <span className={`w-2 h-2 rounded-full mr-1`} style={{ backgroundColor: getStatusColor(nodeMenu.node?.status || '') }} />;
                    }
                  };
                  const getStatusBgColor = () => {
                    switch (status) {
                      case 'PROPOSED': return 'text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded';
                      case 'PLANNED': return 'text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded';
                      case 'IN_PROGRESS': return 'text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded';
                      case 'COMPLETED': return 'text-green-400 bg-green-400/10 px-2 py-0.5 rounded';
                      case 'BLOCKED': return 'text-red-400 bg-red-400/10 px-2 py-0.5 rounded';
                      default: return '';
                    }
                  };
                  const formatStatus = (status: string) => {
                    switch (status.toUpperCase()) {
                      case 'IN_PROGRESS': return 'In Progress';
                      case 'PROPOSED': return 'Proposed';
                      case 'PLANNED': return 'Planned';
                      case 'COMPLETED': return 'Completed';
                      case 'BLOCKED': return 'Blocked';
                      default: return status;
                    }
                  };
                  return (
                    <>
                      {getStatusIcon()}
                      <span className={getStatusBgColor()}>{formatStatus(nodeMenu.node.status)}</span>
                    </>
                  );
                })()}
              </span>
              <span className="flex items-center">
                {(() => {
                  const getTypeIcon = () => {
                    switch (nodeMenu.node?.type) {
                      case 'EPIC': return <Layers className="h-3 w-3 mr-1 text-fuchsia-400" />;
                      case 'STORY': return <FileText className="h-3 w-3 mr-1 text-blue-400" />;
                      case 'TASK': return <ListTodo className="h-3 w-3 mr-1 text-green-400" />;
                      case 'MILESTONE': return <Trophy className="h-3 w-3 mr-1 text-orange-400" />;
                      case 'BUG': return <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />;
                      case 'FEATURE': return <Sparkles className="h-3 w-3 mr-1 text-sky-400" />;
                      case 'OUTCOME': return <Target className="h-3 w-3 mr-1 text-indigo-400" />;
                      case 'IDEA': return <Lightbulb className="h-3 w-3 mr-1 text-yellow-500" />;
                      case 'RESEARCH': return <Microscope className="h-3 w-3 mr-1 text-teal-400" />;
                      default: return null;
                    }
                  };
                  const getTypeBgColor = () => {
                    switch (nodeMenu.node?.type) {
                      case 'EPIC': return 'text-fuchsia-400 bg-fuchsia-400/10 px-2 py-0.5 rounded';
                      case 'STORY': return 'text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded';
                      case 'TASK': return 'text-green-400 bg-green-400/10 px-2 py-0.5 rounded';
                      case 'MILESTONE': return 'text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded';
                      case 'BUG': return 'text-red-500 bg-red-500/10 px-2 py-0.5 rounded';
                      case 'FEATURE': return 'text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded';
                      case 'OUTCOME': return 'text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded';
                      case 'IDEA': return 'text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded';
                      case 'RESEARCH': return 'text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded';
                      default: return '';
                    }
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
                    const getPriorityIcon = () => {
                      if (priority >= 0.8) return <Flame className="h-3 w-3 mr-1 text-red-400" />;
                      if (priority >= 0.6) return <Zap className="h-3 w-3 mr-1 text-orange-400" />;
                      if (priority >= 0.4) return <Triangle className="h-3 w-3 mr-1 text-yellow-400" />;
                      if (priority >= 0.2) return <Circle className="h-3 w-3 mr-1 text-blue-400" />;
                      return <ArrowDown className="h-3 w-3 mr-1 text-gray-400" />;
                    };
                    return getPriorityIcon();
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
                  backgroundColor: relationshipTypeInfo[edgeMenu.edge.type].color,
                  borderStyle: relationshipTypeInfo[edgeMenu.edge.type].style
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

      {/* Create Node Button */}
      <button
        onClick={() => setShowCreateNodeModal(true)}
        className="absolute left-4 z-40 backdrop-blur-sm border-0 rounded-lg shadow-xl px-4 py-3 text-white font-semibold transition-all duration-300 flex items-center space-x-2 transform hover:scale-105 w-40 h-12"
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
            <span className="text-sm font-medium">Create Node</span>
          </div>
        </div>
      </button>

      {/* Legend */}
      {showLegend ? (
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
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Epic</span>
            </div>
            <div className="flex items-center space-x-2">
              <ListTodo className="w-4 h-4 text-green-400" />
              <span>Task</span>
            </div>
            <div className="flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-orange-400" />
              <span>Milestone</span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Bug</span>
            </div>
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-indigo-400" />
              <span>Outcome</span>
            </div>
            <div className="flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <span>Idea</span>
            </div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Feature</span>
            </div>
            <div className="flex items-center space-x-2">
              <Microscope className="w-4 h-4 text-teal-400" />
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
      ) : (
        <button
          onClick={() => setShowLegend(true)}
          className="absolute left-4 z-40 backdrop-blur-sm border-0 rounded-lg shadow-xl px-4 py-3 text-white font-semibold transition-all duration-300 flex items-center space-x-2 transform hover:scale-105 w-40 h-12"
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
              <span className="text-sm font-medium">Node Types</span>
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
        />
      )}

    </div>
  );
}
