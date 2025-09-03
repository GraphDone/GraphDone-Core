import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import * as d3 from 'd3';
import { Plus, Edit } from 'lucide-react';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';
import { CreateNodeModal } from './CreateNodeModal';
import { EditNodeModal } from './EditNodeModal';

interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priorityComp: number;
  priorityExec: number;
  priorityIndiv: number;
  priorityComm: number;
  tags?: string[];
  dueDate?: string;
  assignedTo?: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  x?: number;
  y?: number;
  dependencies?: WorkItem[];
}

interface Edge {
  id: string;
  source: {
    id: string;
    title: string;
    type: string;
  };
  target: {
    id: string;
    title: string;
    type: string;
  };
  type: string;
  weight: number;
}

interface NodeMenuState {
  workItem: WorkItem | null;
  position: { x: number; y: number };
  visible: boolean;
}

export function GraphVisualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({ workItem: null, position: { x: 0, y: 0 }, visible: false });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [selectedNodeForEdit, setSelectedNodeForEdit] = useState<WorkItem | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number; z: number } | undefined>();
  
  // Store stable positions for nodes to prevent re-randomization
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  
  // Store the current positioned nodes for access in click handlers
  const currentNodesRef = useRef<WorkItem[]>([]);

  const { data: workItemsData, loading: workItemsLoading, error: workItemsError } = useQuery(GET_WORK_ITEMS, {
    variables: {
      options: { limit: 100 }
    },
    fetchPolicy: 'cache-and-network',
    pollInterval: 100,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all'
  });

  const { data: edgesData, loading: edgesLoading } = useQuery(GET_EDGES, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 100,  // Also poll edges for consistency
    notifyOnNetworkStatusChange: true
  });

  const workItems: WorkItem[] = workItemsData?.workItems || [];
  const edges: Edge[] = edgesData?.edges || [];
  
  
  // Convert dependency relationships to edges for visualization
  const dependencyEdges: Edge[] = workItems.flatMap(item => 
    (item.dependencies || []).map((dep: any) => ({
      id: `dep-${item.id}-${dep.id}`,
      type: 'DEPENDS_ON',
      weight: 1.0,
      source: dep,
      target: item
    }))
  );
  
  // Combine actual edges with dependency edges
  const allEdges = [...edges, ...dependencyEdges];
  const loading = workItemsLoading || edgesLoading;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setNodeMenu(prev => ({ ...prev, visible: false }));
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || loading) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    
    // Clear previous content
    svg.selectAll('*').remove();

    // Get container dimensions
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    svg.attr('width', width).attr('height', height);

    // Create main group for zoom/pan
    const mainGroup = svg.append('g');

    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        mainGroup.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Handle background clicks to create floating nodes
    svg.on('click', (event) => {
      if (event.target === svg.node()) {
        const [x, y] = d3.pointer(event, svg.node());
        setClickPosition({ x, y, z: 0 });
        setSelectedNodeId(undefined);
        setShowCreateModal(true);
      }
    });

    if (workItems.length === 0) {
      // Show empty state
      mainGroup.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-gray-500 dark:text-gray-400')
        .style('font-size', '18px')
        .text('No work items yet. Click anywhere to create one!');
      return;
    }

    // Position nodes using stored positions or default layout
    const positionedNodes = workItems.map((item) => {
      // Check if we have a stable position for this node
      let x, y;
      
      if (item.positionX !== null && item.positionX !== undefined && 
          item.positionY !== null && item.positionY !== undefined) {
        // Use database-stored position
        x = item.positionX;
        y = item.positionY;
      } else if (nodePositionsRef.current.has(item.id)) {
        // Use previously calculated position
        const stored = nodePositionsRef.current.get(item.id)!;
        x = stored.x;
        y = stored.y;
      } else {
        // Generate new random position only for truly new nodes
        x = width / 2 + (Math.random() - 0.5) * 200;
        y = height / 2 + (Math.random() - 0.5) * 200;
        // Store this position for future renders
        nodePositionsRef.current.set(item.id, { x, y });
      }
      
      return {
        ...item,
        x,
        y,
      };
    });
    
    // Store positioned nodes for access in click handlers
    currentNodesRef.current = positionedNodes;

    // Create links  
    mainGroup.selectAll('.edge')
      .data(allEdges)
      .enter().append('line')
      .attr('class', d => `edge edge-${d.type}`)
      .attr('stroke', '#6b7280')
      .attr('stroke-width', d => Math.max(1, d.weight * 3))
      .attr('opacity', 0.6)
      .attr('x1', d => {
        const source = positionedNodes.find(n => n.id === d.source.id);
        return source?.x || 0;
      })
      .attr('y1', d => {
        const source = positionedNodes.find(n => n.id === d.source.id);
        return source?.y || 0;
      })
      .attr('x2', d => {
        const target = positionedNodes.find(n => n.id === d.target.id);
        return target?.x || 0;
      })
      .attr('y2', d => {
        const target = positionedNodes.find(n => n.id === d.target.id);
        return target?.y || 0;
      });

    // Create node groups
    const nodeGroup = mainGroup.selectAll('.node')
      .data(positionedNodes)
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Add node circles
    nodeGroup.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => 15 + (d.priorityComp || 0) * 15) // Size based on priority
      .attr('fill', d => {
        // Lighter, more vibrant colors
        const colors: Record<string, string> = {
          EPIC: '#c084fc',      // purple-400
          MILESTONE: '#fb923c', // orange-400
          OUTCOME: '#818cf8',   // indigo-400
          FEATURE: '#38bdf8',   // sky-400
          TASK: '#4ade80',      // green-400
          BUG: '#f87171',       // red-400
          IDEA: '#fbbf24',      // yellow-400
          RESEARCH: '#2dd4bf'   // teal-400
        };
        return colors[d.type] || '#6b7280';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        
        // Don't open node menu if create modal is already open
        if (showCreateModal) {
          return;
        }
        
        const [x, y] = d3.pointer(event, document.body);
        setNodeMenu({
          workItem: d,
          position: { x, y },
          visible: true
        });
      });

    // Add node labels
    nodeGroup.append('text')
      .attr('class', 'node-text')
      .attr('dy', -25)
      .attr('text-anchor', 'middle')
      .text(d => d.title)
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#374151')
      .style('pointer-events', 'none'); // Prevent text from blocking click events

    // Add priority indicators
    nodeGroup.append('circle')
      .attr('class', 'priority-indicator')
      .attr('r', 3)
      .attr('cy', 15)
      .attr('fill', d => {
        if (d.priorityComp > 0.7) return '#dc2626';
        if (d.priorityComp > 0.4) return '#d97706';
        return '#059669';
      });

    // Add hover effects
    nodeGroup
      .on('mouseenter', function(_event, d) {
        d3.select(this).select('circle.node-circle')
          .transition()
          .duration(200)
          .attr('r', (15 + (d.priorityComp || 0) * 15) * 1.2);
      })
      .on('mouseleave', function(_event, d) {
        d3.select(this).select('circle.node-circle')
          .transition()
          .duration(200)
          .attr('r', 15 + (d.priorityComp || 0) * 15);
      });

    // Center the view
    const bounds = mainGroup.node()?.getBBox();
    if (bounds) {
      const centerX = width / 2;
      const centerY = height / 2;
      const scale = 0.8;
      
      svg.call(
        zoom.transform,
        d3.zoomIdentity
          .translate(centerX, centerY)
          .scale(scale)
          .translate(-bounds.x - bounds.width / 2, -bounds.y - bounds.height / 2)
      );
    }

    // Handle resize
    const handleResize = () => {
      const newRect = container.getBoundingClientRect();
      svg.attr('width', newRect.width).attr('height', newRect.height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, [workItems, allEdges, loading]);

  return (
    <div ref={containerRef} className="graph-container relative">
      <svg ref={svgRef} className="w-full h-full" />
      
      {/* Auto-refresh indicator */}
      {loading && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>Auto-refreshing...</span>
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute top-20 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Node Types</h3>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Epic</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Milestone</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6366f1' }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Outcome</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Feature</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Task</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Bug</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Idea</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#14b8a6' }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Research</span>
          </div>
        </div>
        
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-4 mb-3">Priority</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">High (0.7+)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Medium (0.4-0.7)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-xs text-gray-600 dark:text-gray-300">Low (0-0.4)</span>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <div>Click node for menu • Drag to move</div>
            <div>Scroll to zoom • Click edge for options</div>
          </div>
        </div>
      </div>
      
      {/* Node interaction menu */}
      {nodeMenu.visible && nodeMenu.workItem && (
        <div 
          className="absolute z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 min-w-[180px]"
          style={{
            left: nodeMenu.position.x,
            top: nodeMenu.position.y,
            transform: 'translate(-50%, -100%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate" title={nodeMenu.workItem.title}>
              {nodeMenu.workItem.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{nodeMenu.workItem.type}</div>
            {nodeMenu.workItem.description && (
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 max-w-[200px] truncate" title={nodeMenu.workItem.description}>
                {nodeMenu.workItem.description}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedNodeId(nodeMenu.workItem?.id);
              
              // Set position near the clicked node for the new connected item
              if (nodeMenu.workItem) {
                const nodePosition = currentNodesRef.current.find(n => n.id === nodeMenu.workItem?.id);
                if (nodePosition && nodePosition.x && nodePosition.y) {
                  setClickPosition({
                    x: nodePosition.x + 100, // Offset to the right of the parent node
                    y: nodePosition.y + 50,  // Slight vertical offset
                    z: 0
                  });
                }
              }
              
              setShowCreateModal(true);
              setNodeMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Connected Item
          </button>
          <button
            onClick={() => {
              setSelectedNodeId(undefined);
              setClickPosition(undefined);
              setShowCreateModal(true);
              setNodeMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Node
          </button>
          <button
            onClick={() => {
              setSelectedNodeForEdit(nodeMenu.workItem);
              setShowEditModal(true);
              setNodeMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Node Details
          </button>
        </div>
      )}
      
      {/* Create Node Modal */}
      {showCreateModal && (
        <CreateNodeModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedNodeId(undefined);
            setClickPosition(undefined);
          }}
          parentNodeId={selectedNodeId}
          position={clickPosition}
        />
      )}
      
      {/* Edit Node Modal */}
      {showEditModal && selectedNodeForEdit && (
        <EditNodeModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedNodeForEdit(null);
          }}
          node={selectedNodeForEdit}
        />
      )}
    </div>
  );
}