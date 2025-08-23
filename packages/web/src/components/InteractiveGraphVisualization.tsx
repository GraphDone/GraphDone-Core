import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Link2, Edit3, Trash2, AlertTriangle, AlertCircle, Layers, Sparkles, ListTodo, Trophy, Target, Lightbulb, Microscope } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { GET_WORK_ITEMS, GET_EDGES, CREATE_EDGE } from '../lib/queries';
import { relationshipTypeInfo, RelationshipType } from '../types/projectData';
import { validateGraphData, getValidationSummary, ValidationResult } from '../utils/graphDataValidation';
import { EditNodeModal } from './EditNodeModal';
import { DeleteNodeModal } from './DeleteNodeModal';

interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  positionX: number;
  positionY: number;
  positionZ?: number;
  priorityExec: number;
  priorityIndiv: number;
  priorityComm: number;
  priorityComp: number;
  teamId: string;
  userId: string;
  tags?: string[];
  dueDate?: string;
  assignedTo?: string;
  dependencies?: WorkItem[];
  dependents?: WorkItem[];
  priority?: {
    executive: number;
    individual: number;
    community: number;
    computed: number;
  };
}

interface WorkItemEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  strength?: number;
  description?: string;
}

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
  const { currentGraph, availableGraphs, selectGraph } = useGraph();
  const { currentTeam } = useAuth();
  
  // Fetch work items from Neo4j with team/user filtering for data isolation
  const { data: workItemsData, loading, error } = useQuery(GET_WORK_ITEMS, {
    variables: {
      where: {
        teamId: currentTeam?.id || 'default-team',
        // Optional: Also filter by user for additional privacy
        // userId: currentUser?.id || 'default-user'
      }
    },
    pollInterval: 5000, // Poll every 5 seconds to get updates
    errorPolicy: 'all',
    skip: !currentTeam // Don't fetch until we have a team selected
  });

  // Fetch edges from Neo4j
  const { data: edgesData, loading: edgesLoading, error: edgesError } = useQuery(GET_EDGES, {
    variables: {
      where: {
        teamId: currentTeam?.id || 'default-team'
      }
    },
    pollInterval: 5000,
    errorPolicy: 'all',
    skip: !currentTeam
  });

  // Mutation for creating edges
  const [createEdgeMutation] = useMutation(CREATE_EDGE, {
    refetchQueries: [{ query: GET_EDGES, variables: { where: { teamId: currentTeam?.id || 'default-team' } } }],
    onError: (error) => {
      console.error('Failed to create edge:', error);
    }
  });
  
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({ node: null, position: { x: 0, y: 0 }, visible: false });
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState>({ edge: null, position: { x: 0, y: 0 }, visible: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType>('DEPENDS_ON');
  const [showGraphSwitcher, setShowGraphSwitcher] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showDataHealth, setShowDataHealth] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkItem | null>(null);

  // ALL HOOK CALLS MUST BE AT THE TOP
  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setNodeMenu(prev => ({ ...prev, visible: false }));
      setEdgeMenu(prev => ({ ...prev, visible: false }));
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
              teamId: currentTeam?.id || 'default-team'
            }]
          }
        }).then(() => {
          console.log('✅ Edge created successfully');
        }).catch((error) => {
          console.error('❌ Failed to create edge:', error);
        });
        initializeVisualization();
      }
      
      setIsConnecting(false);
      setConnectionSource(null);
    } else {
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

  // initializeVisualization function defined after data processing

  // Process work items data after all hooks are called
  const workItems: WorkItem[] = workItemsData?.workItems || [];
  
  // Process edges from Neo4j database
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
    
    // Log validation issues if any
    if (currentValidationResult && (currentValidationResult.errors.length > 0 || currentValidationResult.warnings.length > 0)) {
      console.warn('Graph validation issues:', {
        errors: currentValidationResult.errors,
        warnings: currentValidationResult.warnings,
        stats: currentValidationResult.stats
      });
    }
  }, [currentValidationResult.errors.length, currentValidationResult.warnings.length]);

  // Use only validated nodes and edges for rendering
  const validatedNodes = currentValidationResult.validNodes;
  const validatedEdges = currentValidationResult.validEdges;

  // Convert work items to format expected by D3
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
          strength: 0.3, // Strong attraction
          distance: 120 // Moderate distance
        });
      });
    });
    
    // MILESTONE -> FEATURE attraction
    milestones.forEach(milestone => {
      features.forEach(feature => {
        hierarchyLinks.push({
          source: milestone.id,
          target: feature.id,
          strength: 0.2,
          distance: 100
        });
      });
    });
    
    // FEATURE -> TASK/BUG attraction (tasks attach to features)
    features.forEach(feature => {
      tasks.forEach(task => {
        hierarchyLinks.push({
          source: feature.id,
          target: task.id,
          strength: 0.25, // Tasks strongly attach to features
          distance: 80
        });
      });
      bugs.forEach(bug => {
        hierarchyLinks.push({
          source: feature.id,
          target: bug.id,
          strength: 0.25, // Bugs also attach to features
          distance: 80
        });
      });
    });
    
    // EPIC -> OUTCOME attraction (outcomes relate to epics)
    epics.forEach(epic => {
      outcomes.forEach(outcome => {
        hierarchyLinks.push({
          source: epic.id,
          target: outcome.id,
          strength: 0.15,
          distance: 140
        });
      });
    });
    
    return hierarchyLinks;
  };

  // Define initializeVisualization function with access to nodes data
  const initializeVisualization = useCallback(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    console.log('Initializing visualization with', nodes.length, 'nodes and', validatedEdges.length, 'edges');

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
        .distance(120)
        .strength(0.3)
      )
      .force('charge', d3.forceManyBody()
        .strength((d: any) => {
          // Hierarchical repulsion forces
          switch (d.type) {
            case 'EPIC':
              return -300; // Epics strongly repel each other
            case 'OUTCOME': 
              return -200; // Outcomes need space too
            case 'MILESTONE':
              return -80; // Milestones have moderate repulsion
            case 'FEATURE':
              return -100; // Features need some space
            case 'TASK':
              return -50; // Tasks can be closer together
            case 'BUG':
              return -50; // Bugs can cluster with tasks
            case 'IDEA':
              return -30; // Ideas cluster easily
            default:
              return -80; // Default moderate repulsion
          }
        })
        .distanceMax(350) // Increased for epic spacing
      )
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collision', d3.forceCollide()
        .radius((d: any) => {
          const baseRadius = d.type === 'EPIC' ? 60 : 
                            d.type === 'MILESTONE' ? 52 : 
                            d.type === 'FEATURE' ? 48 : 42;
          return baseRadius;
        })
        .strength(0.7)
      )
      // Add hierarchical attraction forces (Epic->Milestone, Feature->Task, etc.)
      .force('hierarchy', d3.forceLink()
        .id((d: any) => d.id)
        .links(createHierarchicalLinks(nodes))
        .distance((d: any) => d.distance || 100)
        .strength((d: any) => d.strength || 0.2)
      )
      .alphaTarget(0.1)
      .alphaDecay(0.01);

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
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
          
          // Add expanding ring effect to selected node
          const nodeGroup = d3.select(event.currentTarget);
          nodeGroup.select('circle').classed('node-selected', true);
          
          // Create multiple expanding rings for effect
          const radius = parseFloat(nodeGroup.select('circle').attr('r'));
          const color = nodeGroup.select('circle').attr('fill');
          
          // Create 2-3 rings with staggered animations
          for (let i = 0; i < 2; i++) {
            setTimeout(() => {
              const ring = nodeGroup.append('circle')
                .attr('class', 'expanding-ring')
                .attr('r', radius)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', 3)
                .attr('opacity', 0.6);
              
              // Animate the ring expanding
              ring.transition()
                .duration(1500)
                .attr('r', radius * 2.5)
                .attr('stroke-width', 0.5)
                .attr('opacity', 0)
                .on('end', function() { d3.select(this).remove(); })
                .transition()
                .duration(0)
                .attr('r', radius)
                .attr('stroke-width', 3)
                .attr('opacity', 0.6)
                .on('end', function() {
                  // Repeat if node is still selected
                  if (nodeGroup.select('circle').classed('node-selected')) {
                    d3.select(this).transition()
                      .duration(1500)
                      .attr('r', radius * 2.5)
                      .attr('stroke-width', 0.5)
                      .attr('opacity', 0)
                      .on('end', function() { d3.select(this).remove(); });
                  } else {
                    d3.select(this).remove();
                  }
                });
            }, i * 750); // Stagger the rings
          }
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
          d.x = event.x;
          d.y = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.05);
          d.fx = null;
          d.fy = null;
          
          // Remove expanding ring effect
          const nodeGroup = d3.select(event.currentTarget);
          nodeGroup.select('circle').classed('node-selected', false);
          nodeGroup.selectAll('.expanding-ring').remove();
        }));

    // Node circles - increased minimum sizes
    nodeElements.append('circle')
      .attr('class', 'node-circle')
      .attr('r', (d: WorkItem) => {
        switch (d.type) {
          case 'EPIC': return 45;
          case 'MILESTONE': return 40;
          case 'FEATURE': return 35;
          case 'TASK': return 30;
          case 'BUG': return 28;
          case 'OUTCOME': return 42;
          case 'IDEA': return 25;
          default: return 30;
        }
      })
      .attr('fill', (d: WorkItem) => {
        // Desaturate completed nodes to gray
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          return '#374151'; // Dark gray for completed nodes
        }
        
        switch (d.type) {
          case 'EPIC': return '#a855f7';
          case 'FEATURE': return '#3b82f6';
          case 'TASK': return '#10b981';
          case 'BUG': return '#dc2626';
          case 'MILESTONE': return '#f59e0b';
          case 'OUTCOME': return '#6366f1';
          case 'IDEA': return '#f97316';
          default: return '#6b7280';
        }
      })
      .attr('stroke', (d: WorkItem) => {
        // Use colored ring for completed nodes to show original type
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          switch (d.type) {
            case 'EPIC': return '#a855f7';
            case 'FEATURE': return '#3b82f6';
            case 'TASK': return '#10b981';
            case 'BUG': return '#dc2626';
            case 'MILESTONE': return '#f59e0b';
            case 'OUTCOME': return '#6366f1';
            case 'IDEA': return '#f97316';
            default: return '#6b7280';
          }
        }
        return '#ffffff'; // White stroke for active nodes
      })
      .attr('stroke-width', (d: WorkItem) => {
        // Thicker stroke for completed nodes to make the type ring visible
        if (d.status === 'COMPLETED' || d.status === 'Completed' || d.status === 'Done' || d.status === 'DONE') {
          return 4;
        }
        return 2;
      })
      .attr('opacity', 1); // Keep all nodes fully opaque

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
      const nodeRadius = d.type === 'OUTCOME' ? 42 : d.type === 'MILESTONE' ? 40 : d.type === 'TASK' ? 30 : 25;
      
      // Multi-line text wrapping function
      const wrapText = (text: string, maxChars: number) => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          if ((currentLine + ' ' + word).length <= maxChars) {
            currentLine = currentLine ? currentLine + ' ' + word : word;
          } else {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              // Single word too long, truncate it
              lines.push(word.length > maxChars ? word.substring(0, maxChars - 3) + '...' : word);
              currentLine = '';
            }
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
        
        // Limit to 2 lines max
        if (lines.length > 2) {
          lines[1] = lines[1].substring(0, Math.max(0, maxChars - 3)) + '...';
          return lines.slice(0, 2);
        }
        
        return lines;
      };
      
      const maxChars = nodeRadius > 35 ? 14 : nodeRadius > 25 ? 10 : 8;
      const lines = wrapText(d.title, maxChars);
      const fontSize = nodeRadius > 35 ? 12 : nodeRadius > 25 ? 10 : 9;
      const lineHeight = fontSize * 1.2;
      
      // Calculate vertical offset to center multi-line text
      const totalHeight = lines.length * lineHeight;
      const startY = -(totalHeight / 2) + (lineHeight / 2);
      
      // Determine text color based on node background color for contrast
      const getTextColor = (nodeType: string) => {
        switch (nodeType) {
          case 'EPIC': return '#ffffff'; // Purple background - white text
          case 'FEATURE': return '#ffffff'; // Blue background - white text
          case 'TASK': return '#000000'; // Green background - black text  
          case 'BUG': return '#ffffff'; // Red background - white text
          case 'MILESTONE': return '#000000'; // Yellow background - black text
          case 'OUTCOME': return '#ffffff'; // Indigo background - white text
          case 'IDEA': return '#000000'; // Orange background - black text
          default: return '#000000'; // Gray background - black text
        }
      };

      const textColor = getTextColor(d.type);
      const shadowColor = textColor === '#ffffff' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';

      // Add text elements for each line
      lines.forEach((line, index) => {
        nodeGroup.append('text')
          .attr('class', 'node-label')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('y', startY + (index * lineHeight))
          .style('font-size', `${fontSize}px`)
          .style('font-weight', '700')
          .style('fill', textColor)
          .style('text-shadow', `1px 1px 2px ${shadowColor}`)
          .style('pointer-events', 'none')
          .style('user-select', 'none')
          .text(line);
      });
    });

    // Create arrow symbols for middle of edges
    const arrowElements = g.append('g')
      .attr('class', 'arrows-group')
      .selectAll('.arrow')
      .data(validatedEdges)
      .enter()
      .append('path')
      .attr('class', 'arrow')
      .attr('d', 'M-4,-2 L0,0 L-4,2 L-2,0 Z')
      .attr('fill', (d: WorkItemEdge) => {
        switch (d.type) {
          case 'DEPENDS_ON': return '#10b981';
          case 'BLOCKS': return '#dc2626';
          case 'RELATES_TO': return '#3b82f6';
          case 'PART_OF': return '#f59e0b';
          default: return '#6b7280';
        }
      })
      .attr('stroke', (d: WorkItemEdge) => {
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
      // Remove previous selection
      d3.selectAll('.node-selected').classed('node-selected', false);
      
      // Add pulsating glow to clicked node
      d3.select(event.currentTarget as SVGElement)
        .select('circle')
        .classed('node-selected', true);
      
      handleNodeClick(event, d);
    });

    // TODO: Edge tracking still not working properly
    // FIXME: Edges don't stick to node centers during drag operations
    // ISSUE: Edge vertices lag behind or offset from actual node positions
    // NEEDS: Complete rewrite of edge positioning system
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

    // Simulation tick - ONLY update nodes, edges are handled separately
    simulation.on('tick', () => {
      // Update node positions
      nodeElements
        .attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);
        
      // Always update edges to stay anchored to nodes
      updateEdgePositions();
    });

    // Update zoom
    zoom.on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

    console.log('✅ Visualization initialized with', nodes.length, 'nodes');
  }, [nodes, validatedEdges, handleNodeClick]); // Include handleNodeClick to get fresh connection state

  // Store simulation reference for resize handling
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

  // Initialization effect - NOW with access to nodes data
  useEffect(() => {
    if (nodes.length > 0) {
      console.log('useEffect: Initializing visualization with', nodes.length, 'nodes');
      initializeVisualization();
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
      
      console.log('🔄 Resized visualization to', newWidth, 'x', newHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [nodes.length, validatedEdges.length]); // Only re-initialize when data changes, not on every render

  // Early returns AFTER all hooks are called
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
      case 'EPIC': return '#a855f7';
      case 'FEATURE': return '#3b82f6';
      case 'TASK': return '#10b981';
      case 'BUG': return '#dc2626';
      case 'MILESTONE': return '#f59e0b';
      case 'OUTCOME': return '#6366f1';
      case 'IDEA': return '#f97316';
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

  const startConnection = (nodeId: string) => {
    setConnectionSource(nodeId);
    setIsConnecting(true);
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

  // Layout and edge systems removed to fix TypeScript unused variable warnings

  return (
    <div ref={containerRef} className="graph-container relative w-full h-full bg-gray-900">
      <svg ref={svgRef} className="w-full h-full" style={{ background: 'radial-gradient(circle at center, #1f2937 0%, #111827 100%)' }} />
      
      {/* Graph Switcher Trigger */}
      <div 
        className="absolute top-4 left-4 z-40"
        onMouseEnter={() => setShowGraphSwitcher(true)}
        onMouseLeave={() => setShowGraphSwitcher(false)}
      >
        <button 
          className="bg-gray-800/90 backdrop-blur-sm border border-gray-600 rounded-lg px-3 py-2 shadow-md hover:bg-gray-700 transition-all duration-200"
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-sm font-medium text-green-100">{currentGraph?.name || 'Select Graph'}</span>
            <div className="w-3 h-3 text-gray-400">
              <svg viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </button>

        {/* Floating Graph Switcher */}
        {showGraphSwitcher && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 border-b border-gray-600">
              <h3 className="text-sm font-medium text-green-300">Switch Graph</h3>
              <p className="text-xs text-gray-400 mt-1">Select a different graph to visualize</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {availableGraphs.map((graph) => (
                <button
                  key={graph.id}
                  onClick={() => {
                    selectGraph(graph.id);
                    setShowGraphSwitcher(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-600 last:border-b-0 transition-colors ${
                    currentGraph?.id === graph.id ? 'bg-green-900/30 border-green-500/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        graph.type === 'PROJECT' ? 'bg-blue-500' :
                        graph.type === 'WORKSPACE' ? 'bg-purple-500' :
                        graph.type === 'SUBGRAPH' ? 'bg-green-500' : 'bg-gray-500'
                      }`} />
                      <div>
                        <div className="font-medium text-gray-200 text-sm">{graph.name}</div>
                        <div className="text-xs text-gray-400">{graph.type}</div>
                      </div>
                    </div>
                    {currentGraph?.id === graph.id && (
                      <div className="w-4 h-4 text-green-400">
                        <svg viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  {graph.parentGraphId && (
                    <div className="ml-6 mt-1 text-xs text-gray-400">
                      Part of: {availableGraphs.find(g => g.id === graph.parentGraphId)?.name || 'Unknown'}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-gray-600">
              <button className="w-full text-center text-xs text-green-400 hover:text-green-300 transition-colors">
                + Create New Graph
              </button>
            </div>
          </div>
        )}
      </div>

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
          className="absolute bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 z-50"
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
                <span className={`w-2 h-2 rounded-full mr-1`} style={{ backgroundColor: getStatusColor(nodeMenu.node.status) }} />
                {nodeMenu.node.status}
              </span>
              <span>{nodeMenu.node.type}</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="px-4 py-2 border-b border-gray-600">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Priority:</span>
                <span className="ml-1 font-medium">{Math.round((nodeMenu.node.priority?.computed || nodeMenu.node.priorityComp) * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={() => startConnection(nodeMenu.node!.id)}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <Link2 className="h-4 w-4 mr-3" />
              Add Connected Item
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
            <button className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700">
              <Edit3 className="h-4 w-4 mr-3" />
              Edit Relationship
            </button>
            <button className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-red-900/50">
              <Trash2 className="h-4 w-4 mr-3" />
              Delete Relationship
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-800/90 border border-gray-600 rounded-lg shadow-lg p-1 w-72 backdrop-blur-sm">
        <div className="text-base font-medium text-green-400 mb-2 text-center">Node Types</div>
        <div className="grid grid-cols-2 grid-rows-4 gap-x-4 gap-y-3 text-base text-gray-300">
          <div className="flex items-center space-x-3">
            <Layers className="w-5 h-5 text-purple-500" />
            <span>Epic</span>
          </div>
          <div className="flex items-center space-x-3">
            <ListTodo className="w-5 h-5 text-green-500" />
            <span>Task</span>
          </div>
          <div className="flex items-center space-x-3">
            <Trophy className="w-5 h-5 text-orange-500" />
            <span>Milestone</span>
          </div>
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span>Bug</span>
          </div>
          <div className="flex items-center space-x-3">
            <Target className="w-5 h-5 text-indigo-500" />
            <span>Outcome</span>
          </div>
          <div className="flex items-center space-x-3">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span>Idea</span>
          </div>
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <span>Feature</span>
          </div>
          <div className="flex items-center space-x-3">
            <Microscope className="w-5 h-5 text-teal-500" />
            <span>Research</span>
          </div>
        </div>
        <hr className="border-gray-600 mt-3" />
        <div className="pt-3">
          <div className="text-sm text-gray-500 opacity-75 w-full leading-relaxed text-left">
            • Select nodes to access menu<br/>
            • Drag to reposition<br/>
            • Scroll for zoom<br/>
            • Select edges for options
          </div>
        </div>
      </div>

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
    </div>
  );
}