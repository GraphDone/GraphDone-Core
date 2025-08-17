import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Link2, Edit3, Trash2, Eye } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';
import { relationshipTypeInfo, RelationshipType } from '../types/projectData';

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
  
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({ node: null, position: { x: 0, y: 0 }, visible: false });
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState>({ edge: null, position: { x: 0, y: 0 }, visible: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType>('DEPENDS_ON');
  const [showGraphSwitcher, setShowGraphSwitcher] = useState(false);

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
        const newEdge: WorkItemEdge = {
          id: `edge-${Date.now()}`,
          source: connectionSource,
          target: node.id,
          type: selectedRelationType,
          strength: 0.8,
          description: `${selectedRelationType.toLowerCase().replace('_', ' ')} relationship`
        };
        
        // In a real app, this would create the edge in the backend
        
        // Update visualization
        workItemEdges.push(newEdge);
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

  // Convert work items to format expected by D3
  const nodes = workItems.map(item => ({
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

  // Define initializeVisualization function with access to nodes data
  const initializeVisualization = useCallback(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    console.log('Initializing visualization with', nodes.length, 'nodes and', workItemEdges.length, 'edges');

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
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(workItemEdges)
        .id((d: any) => d.id)
        .distance(120)
        .strength(0.3)
      )
      .force('charge', d3.forceManyBody()
        .strength(-200)
        .distanceMax(400)
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
      .alphaTarget(0.1)
      .alphaDecay(0.01);

    // Create edges FIRST (so they render under nodes)
    const linkElements = g.append('g')
      .attr('class', 'edges-group')
      .selectAll('.edge')
      .data(workItemEdges)
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('stroke', (d: WorkItemEdge) => {
        switch (d.type) {
          case 'DEPENDS_ON': return '#10b981';
          case 'BLOCKS': return '#ef4444';
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
    const edgeColors = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'];
    
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
        switch (d.type) {
          case 'EPIC': return '#8b5cf6';
          case 'FEATURE': return '#3b82f6';
          case 'TASK': return '#10b981';
          case 'BUG': return '#ef4444';
          case 'MILESTONE': return '#f59e0b';
          case 'OUTCOME': return '#6366f1';
          case 'IDEA': return '#f97316';
          default: return '#6b7280';
        }
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Add SVG text labels directly to node elements
    nodeElements.each(function(d: WorkItem) {
      const nodeGroup = d3.select(this);
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
      .data(workItemEdges)
      .enter()
      .append('path')
      .attr('class', 'arrow')
      .attr('d', 'M-4,-2 L0,0 L-4,2 L-2,0 Z')
      .attr('fill', (d: WorkItemEdge) => {
        switch (d.type) {
          case 'DEPENDS_ON': return '#10b981';
          case 'BLOCKS': return '#ef4444';
          case 'RELATES_TO': return '#3b82f6';
          case 'PART_OF': return '#f59e0b';
          default: return '#6b7280';
        }
      })
      .attr('stroke', (d: WorkItemEdge) => {
        switch (d.type) {
          case 'DEPENDS_ON': return '#10b981';
          case 'BLOCKS': return '#ef4444';
          case 'RELATES_TO': return '#3b82f6';
          case 'PART_OF': return '#f59e0b';
          default: return '#6b7280';
        }
      })
      .attr('stroke-width', 1)
      .attr('opacity', 0.9);

    // Add click handlers to nodes
    nodeElements.on('click', (event: MouseEvent, d: WorkItem) => {
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
  }, [nodes, workItemEdges]); // Remove handleNodeClick from dependencies to prevent constant re-initialization

  // Initialization effect - NOW with access to nodes data
  useEffect(() => {
    if (nodes.length > 0) {
      console.log('useEffect: Initializing visualization with', nodes.length, 'nodes');
      initializeVisualization();
    }

    const handleResize = () => {
      if (nodes.length > 0) {
        initializeVisualization();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [nodes.length, workItemEdges.length]); // Only re-initialize when data changes, not on every render

  // Early returns AFTER all hooks are called
  if (loading || edgesLoading) {
    return (
      <div className="graph-container relative w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-green-300">Loading graph data...</div>
      </div>
    );
  }

  if (error || edgesError) {
    return (
      <div className="graph-container relative w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-red-300">Error loading graph: {error?.message || edgesError?.message}</div>
      </div>
    );
  }

  const getNodeColor = (node: WorkItem) => {
    switch (node.type) {
      case 'EPIC': return '#8b5cf6';
      case 'FEATURE': return '#3b82f6';
      case 'TASK': return '#10b981';
      case 'BUG': return '#ef4444';
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
      case 'BLOCKED': return '#ef4444';
      case 'PLANNED': return '#f59e0b';
      case 'PROPOSED': return '#8b5cf6';
      case 'CANCELLED': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const startConnection = (nodeId: string) => {
    setConnectionSource(nodeId);
    setIsConnecting(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
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
            <button className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700">
              <Eye className="h-4 w-4 mr-3" />
              Edit Details
            </button>
            <button className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-red-900/50">
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
      <div className="absolute bottom-4 left-4 bg-gray-800/90 border border-gray-600 rounded-lg shadow-lg p-3 max-w-xs backdrop-blur-sm">
        <div className="text-sm font-medium text-green-400 mb-2">Node Types</div>
        <div className="space-y-1 text-xs text-gray-300">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Epic</span>
            <div className="w-3 h-3 rounded-full bg-blue-500 ml-auto" />
            <span>Feature</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Task</span>
            <div className="w-3 h-3 rounded-full bg-red-500 ml-auto" />
            <span>Bug</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Milestone</span>
          </div>
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="text-xs text-gray-500 mb-1">Click node for menu • Drag to move</div>
            <div className="text-xs text-gray-500">Scroll to zoom • Click edge for options</div>
          </div>
        </div>
      </div>
    </div>
  );
}