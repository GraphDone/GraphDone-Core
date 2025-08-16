import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Link2, Edit3, Trash2, Eye, Clock, User, Tag } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { mockProjectNodes, mockProjectEdges, relationshipTypeInfo, MockNode, MockEdge, RelationshipType } from '../types/projectData';

interface NodeMenuState {
  node: MockNode | null;
  position: { x: number; y: number };
  visible: boolean;
}

interface EdgeMenuState {
  edge: MockEdge | null;
  position: { x: number; y: number };
  visible: boolean;
}

export function InteractiveGraphVisualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentGraph, availableGraphs, selectGraph } = useGraph();
  
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({ node: null, position: { x: 0, y: 0 }, visible: false });
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState>({ edge: null, position: { x: 0, y: 0 }, visible: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType>('DEPENDS_ON');
  const [showGraphSwitcher, setShowGraphSwitcher] = useState(false);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setNodeMenu(prev => ({ ...prev, visible: false }));
      setEdgeMenu(prev => ({ ...prev, visible: false }));
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getNodeColor = (node: MockNode) => {
    switch (node.type) {
      case 'EPIC': return '#8b5cf6';
      case 'FEATURE': return '#3b82f6';
      case 'TASK': return '#10b981';
      case 'BUG': return '#ef4444';
      case 'MILESTONE': return '#f59e0b';
      case 'OUTCOME': return '#6366f1';
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

  const handleNodeClick = useCallback((event: MouseEvent, node: MockNode) => {
    event.stopPropagation();
    
    if (isConnecting && connectionSource) {
      // Complete connection
      if (connectionSource !== node.id) {
        const newEdge: MockEdge = {
          id: `edge-${Date.now()}`,
          source: connectionSource,
          target: node.id,
          type: selectedRelationType,
          strength: 0.8,
          description: `${selectedRelationType.toLowerCase().replace('_', ' ')} relationship`,
          createdAt: new Date().toISOString()
        };
        
        // In a real app, this would create the edge in the backend
        
        // Update visualization
        mockProjectEdges.push(newEdge);
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

  const handleEdgeClick = useCallback((event: MouseEvent, edge: MockEdge) => {
    event.stopPropagation();
    
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setEdgeMenu({
        edge,
        position: {
          x: event.clientX - containerRect.left,
          y: event.clientY - containerRect.top
        },
        visible: true
      });
    }
  }, []);

  const startConnection = (nodeId: string) => {
    setConnectionSource(nodeId);
    setIsConnecting(true);
    setNodeMenu(prev => ({ ...prev, visible: false }));
  };

  // Simple 2D layout system with intelligent clustering
  const layoutSystem = {
    // Create clusters based on node types and relationships
    createClusters: (nodes: any[]) => {
      const clusters: Array<{nodes: any[], priority: number, type: string}> = [];
      
      // Group by node type first
      const typeGroups = new Map<string, any[]>();
      nodes.forEach(node => {
        if (!typeGroups.has(node.type)) {
          typeGroups.set(node.type, []);
        }
        typeGroups.get(node.type)!.push(node);
      });
      
      // Create clusters for each type
      typeGroups.forEach((nodesOfType, type) => {
        const avgPriority = nodesOfType.reduce((sum, n) => sum + n.priority.computed, 0) / nodesOfType.length;
        clusters.push({
          nodes: nodesOfType,
          priority: avgPriority,
          type: type
        });
      });
      
      // Sort clusters by priority
      clusters.sort((a, b) => b.priority - a.priority);
      return clusters;
    },
    
    // Position clusters in a clean 2D layout
    positionClusters: (clusters: any[], centerX: number, centerY: number, width: number, height: number) => {
      const maxRadius = Math.min(width, height) * 0.4; // Use 40% of screen space
      
      clusters.forEach((cluster, clusterIndex) => {
        // Position clusters in a circle around the center
        const angle = (clusterIndex / clusters.length) * 2 * Math.PI;
        const clusterDistance = maxRadius * (0.3 + cluster.priority * 0.7); // Higher priority closer to center
        
        const clusterCenterX = centerX + Math.cos(angle) * clusterDistance;
        const clusterCenterY = centerY + Math.sin(angle) * clusterDistance;
        
        // Position nodes within each cluster
        cluster.nodes.forEach((node: any, nodeIndex: number) => {
          const nodeAngle = (nodeIndex / cluster.nodes.length) * 2 * Math.PI;
          const nodeDistance = 80 + (nodeIndex * 20); // Generous spacing within cluster
          
          node.targetX = clusterCenterX + Math.cos(nodeAngle) * nodeDistance;
          node.targetY = clusterCenterY + Math.sin(nodeAngle) * nodeDistance;
          
          // Initialize position if not set
          if (!node.x) node.x = node.targetX;
          if (!node.y) node.y = node.targetY;
        });
      });
    }
  };

  // Simple 2D edge system
  const edgeSystem = {
    // Calculate simple 2D edge paths
    calculateEdgePath: (edge: MockEdge | any, nodes: any[]) => {
      // D3 force simulation converts source/target strings to node objects
      const sourceNode = typeof edge.source === 'object' ? edge.source : nodes.find(n => n.id === edge.source);
      const targetNode = typeof edge.target === 'object' ? edge.target : nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) {
        return null;
      }
      
      if (!sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) {
        return null;
      }
      
      const source = { x: sourceNode.x, y: sourceNode.y };
      const target = { x: targetNode.x, y: targetNode.y };
      
      // Calculate vector
      const vector = {
        x: target.x - source.x,
        y: target.y - source.y
      };
      
      const distance = Math.sqrt(vector.x ** 2 + vector.y ** 2);
      
      // Simple straight line path
      const straightPath = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
      
      return {
        path: straightPath,
        midpoint: { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 },
        distance
      };
    }
  };

  const initializeVisualization = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

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
    const maxRadius = Math.min(width, height) * 0.55; // Use 55% for generous spacing

    svg.attr('width', width).attr('height', height);
    
    
    // Initialize 2D cluster layout
    const clusters = layoutSystem.createClusters(mockProjectNodes);
    layoutSystem.positionClusters(clusters, centerX, centerY, width, height);
    

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4]);

    svg.call(zoom);

    const g = svg.append('g');

    // Subtle origin marker
    const originGroup = g.append('g').attr('class', 'origin-marker');
    
    // Draw subtle gray origin marker
    const drawOrigin = () => {
      originGroup.selectAll('*').remove();
      
      // Simple subtle cross at origin
      const crossSize = 12;
      const crossColor = 'rgba(156, 163, 175, 0.4)'; // gray-400 with low opacity
      
      // Horizontal line
      originGroup.append('line')
        .attr('x1', centerX - crossSize)
        .attr('y1', centerY)
        .attr('x2', centerX + crossSize)
        .attr('y2', centerY)
        .attr('stroke', crossColor)
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');
        
      // Vertical line
      originGroup.append('line')
        .attr('x1', centerX)
        .attr('y1', centerY - crossSize)
        .attr('x2', centerX)
        .attr('y2', centerY + crossSize)
        .attr('stroke', crossColor)
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');
        
      // Small center dot
      originGroup.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', 2)
        .attr('fill', crossColor)
        .style('pointer-events', 'none');
    };
    
    drawOrigin();
    
    // Optional: Add 2D grid background for visual reference
    const gridGroup = g.append('g').attr('class', 'grid-background');
    
    const createGrid = () => {
      gridGroup.selectAll('*').remove();
      
      const gridSpacing = 60;
      const gridOpacity = 0.1;
      
      // Vertical lines
      for (let x = centerX % gridSpacing; x < width; x += gridSpacing) {
        gridGroup.append('line')
          .attr('x1', x)
          .attr('y1', 0)
          .attr('x2', x)
          .attr('y2', height)
          .attr('stroke', 'rgba(100, 200, 100, ' + gridOpacity + ')')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none');
      }
      
      // Horizontal lines
      for (let y = centerY % gridSpacing; y < height; y += gridSpacing) {
        gridGroup.append('line')
          .attr('x1', 0)
          .attr('y1', y)
          .attr('x2', width)
          .attr('y2', y)
          .attr('stroke', 'rgba(100, 200, 100, ' + gridOpacity + ')')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none');
      }
    };
    
    createGrid();
    
    // 2D Priority zone visualization
    const priorityGroup = g.append('g').attr('class', 'priority-zones');
    
    // Concentric circles to show priority levels in 2D
    const priorityRings = [0.3, 0.6, 0.9];
    priorityRings.forEach((priority) => {
      const radius = maxRadius * priority;
      priorityGroup.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', radius)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(59, 130, 246, 0.15)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,6')
        .style('pointer-events', 'none');
        
      // Priority level labels
      priorityGroup.append('text')
        .attr('x', centerX + radius - 25)
        .attr('y', centerY - 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', '#ffffff')
        .attr('font-weight', '500')
        .style('pointer-events', 'none')
        .text(`Priority ${Math.round(priority * 100)}%`);
    });

    // Initialize all nodes at screen center for 2D layout
    mockProjectNodes.forEach((node: any) => {
      // Clear any existing positioning to start fresh
      if (!node.x) node.x = centerX;
      if (!node.y) node.y = centerY;
      node.fx = null;
      node.fy = null;
      
    });

    // Simple 2D force simulation
    
    const simulation = d3.forceSimulation(mockProjectNodes as any)
      .force('link', d3.forceLink(mockProjectEdges)
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
      .force('target-position', () => {
        // Pull nodes toward their target cluster positions
        mockProjectNodes.forEach((node: any) => {
          if (node.targetX && node.targetY && !node.userPinned) {
            const pullStrength = 0.1;
            const dx = node.targetX - node.x;
            const dy = node.targetY - node.y;
            
            node.vx += dx * pullStrength;
            node.vy += dy * pullStrength;
          }
        });
      })
      .force('label-separation', () => {
        // Force to prevent node labels from overlapping with other nodes
        const separationRadius = 80; // Minimum distance between node centers
        
        for (let i = 0; i < mockProjectNodes.length; i++) {
          for (let j = i + 1; j < mockProjectNodes.length; j++) {
            const nodeA = mockProjectNodes[i] as any;
            const nodeB = mockProjectNodes[j] as any;
            
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < separationRadius) {
              const force = (separationRadius - distance) / distance * 0.1;
              const fx = dx * force;
              const fy = dy * force;
              
              nodeB.vx += fx;
              nodeB.vy += fy;
              nodeA.vx -= fx;
              nodeA.vy -= fy;
            }
          }
        }
      })
      .alphaTarget(0.05)
      .alphaDecay(0.01);

    // Create arrow markers for edges
    const arrowDefs = g.append('defs');
    
    Object.entries(relationshipTypeInfo).forEach(([type, info]) => {
      arrowDefs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', info.color);
    });

    // Create edges
    const links = g.append('g')
      .attr('class', 'edges-container')
      .selectAll('.edge')
      .data(mockProjectEdges)
      .enter()
      .append('g')
      .attr('class', 'edge')
      .style('cursor', 'pointer');


    // Dynamic vector paths instead of static lines
    const linkPaths = links.append('path')
      .attr('stroke', (d: MockEdge) => {
        const color = relationshipTypeInfo[d.type]?.color || '#666666';
        return color;
      })
      .attr('stroke-width', (d: MockEdge) => 4 + d.strength * 2) // Thick enough to be visible
      .attr('stroke-dasharray', (d: MockEdge) => {
        const style = relationshipTypeInfo[d.type]?.style || 'solid';
        return style === 'dashed' ? '8,4' : style === 'dotted' ? '3,3' : 'none';
      })
      .attr('marker-end', (d: MockEdge) => `url(#arrow-${d.type})`)
      .attr('opacity', 0.8) // Increase opacity for better visibility
      .attr('fill', 'none');

    // Add edge labels with background rectangles for visibility
    const labelGroups = links.append('g')
      .attr('class', 'edge-label-group')
      .style('pointer-events', 'none');

    // Add background rectangles for labels
    const labelBgs = labelGroups.append('rect')
      .attr('class', 'edge-label-bg')
      .attr('fill', 'rgba(0, 0, 0, 0.8)')
      .attr('stroke', 'rgba(255, 255, 255, 0.3)')
      .attr('stroke-width', 1)
      .attr('rx', 4)
      .attr('ry', 4);

    // Add the text labels
    labelGroups.append('text')
      .attr('class', 'edge-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '13px') // Larger font
      .attr('fill', '#ffffff') // Pure white
      .attr('font-weight', '700') // Extra bold
      .attr('dy', 4) // Center vertically in background
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text((d: MockEdge) => d.type.replace('_', ' '));

    // Size the background rectangles to fit the text
    labelBgs.each(function() {
      const parentNode = this.parentNode as Element;
      if (parentNode) {
        const textElement = d3.select(parentNode).select('text').node() as SVGTextElement;
        if (textElement) {
          const bbox = textElement.getBBox();
          d3.select(this)
            .attr('x', bbox.x - 4)
            .attr('y', bbox.y - 2)
            .attr('width', bbox.width + 8)
            .attr('height', bbox.height + 4);
        }
      }
    });


    // Add click handlers to edges
    links.on('click', (event: MouseEvent, d: MockEdge) => {
      handleEdgeClick(event, d);
    });

    // Create nodes
    const nodes = g.append('g')
      .selectAll('.node')
      .data(mockProjectNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.2).restart();
          d.fx = d.x;
          d.fy = d.y;
          d.dragStartPos = { x: d.x, y: d.y };
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
          d.x = event.x;
          d.y = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.1);
          
          // Calculate drag distance to determine if user intentionally moved the node
          const dragDistance = Math.sqrt(
            Math.pow(d.x - d.dragStartPos.x, 2) + Math.pow(d.y - d.dragStartPos.y, 2)
          );
          
          if (dragDistance > 20) {
            // User intentionally moved the node - save their preference
            d.userPinned = true;
            d.userPreferredPosition = { x: d.x, y: d.y };
            
            // Convert screen position back to 2D coordinates for storage
            const centerX = width / 2;
            const centerY = height / 2;
            const relativeX = d.x - centerX;
            const relativeY = d.y - centerY;
            const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
            
            // Store as preference vector (this would normally be saved to backend)
            d.userPreferenceVector = {
              x: relativeX,
              y: relativeY,
              magnitude: distance,
              timestamp: new Date().toISOString()
            };
            
            
            // Keep the node fixed at user's preferred position
            d.fx = d.x;
            d.fy = d.y;
          } else {
            // Small movement - likely accidental, return to cluster positioning
            d.userPinned = false;
            d.fx = null;
            d.fy = null;
          }
        }));

    // Node circles - larger sizes for generous spacing and visibility
    nodes.append('circle')
      .attr('r', (d: MockNode) => {
        switch (d.type) {
          case 'EPIC': return 50;      // Large for clear hierarchy
          case 'MILESTONE': return 42; // Large
          case 'FEATURE': return 38;   // Large
          case 'TASK': return 32;      // Large
          case 'BUG': return 28;       // Large
          default: return 32;          // Large default
        }
      })
      .attr('fill', (d: MockNode) => getNodeColor(d))
      .attr('stroke', (d: MockNode) => getStatusColor(d.status))
      .attr('stroke-width', 3)
      .attr('opacity', 0.9);

    // Priority indicators
    nodes.append('circle')
      .attr('r', 6)
      .attr('cx', 20)
      .attr('cy', -20)
      .attr('fill', (d: MockNode) => {
        const priority = d.priority.computed;
        if (priority > 0.8) return '#ef4444';
        if (priority > 0.6) return '#f59e0b';
        return '#10b981';
      })
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // Add click handlers to nodes
    nodes.on('click', (event: MouseEvent, d: MockNode) => {
      handleNodeClick(event, d);
    });

    // Create HTML overlay container for node labels (easier to style than SVG text)
    const labelContainer = d3.select(containerRef.current)
      .append('div')
      .attr('class', 'node-labels-container')
      .style('position', 'absolute')
      .style('top', '0px')
      .style('left', '0px')
      .style('width', '100%')
      .style('height', '100%')
      .style('pointer-events', 'none')
      .style('z-index', '10')
      .style('overflow', 'visible');

    // Create comprehensive HTML labels for each node (includes type icon + title)
    const htmlLabels = labelContainer.selectAll('.node-label')
      .data(mockProjectNodes)
      .enter()
      .append('div')
      .attr('class', 'node-label')
      .style('position', 'absolute')
      .style('text-align', 'center')
      .style('font-size', '14px')
      .style('font-weight', '700')
      .style('color', '#ffffff')
      .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.9)')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .style('white-space', 'nowrap')
      .style('z-index', '100')
      .html((d: MockNode) => {
        const getTypeIcon = (type: string) => {
          switch (type) {
            case 'EPIC': return 'E';
            case 'FEATURE': return 'F';
            case 'TASK': return 'T';
            case 'BUG': return 'B';
            case 'MILESTONE': return 'M';
            case 'OUTCOME': return 'O';
            default: return '?';
          }
        };
        
        const labelText = d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title;
        const typeIcon = getTypeIcon(d.type);
        
        // Create a label with type icon and title
        return `<div style="background: rgba(0,0,0,0.7); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);">
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 2px;">[${typeIcon}]</div>
          <div style="font-size: 11px;">${labelText}</div>
        </div>`;
      });
    

    // Simple 2D simulation tick
    simulation.on('tick', () => {
      
      // Update edge paths
      linkPaths
        .attr('d', (d: MockEdge) => {
          const edgeData = edgeSystem.calculateEdgePath(d, mockProjectNodes);
          if (!edgeData) {
            return '';
          }
          return edgeData.path;
        });
        

      // Update edge label groups (both background and text)
      labelGroups
        .attr('transform', (d: MockEdge) => {
          const edgeData = edgeSystem.calculateEdgePath(d, mockProjectNodes);
          if (!edgeData) return 'translate(0,0)';
          return `translate(${edgeData.midpoint.x}, ${edgeData.midpoint.y})`;
        });

      // Update node positions
      nodes
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
        
      updateHtmlLabels();
    });

    // Function to update HTML labels with current zoom transform
    const updateHtmlLabels = () => {
      const transform = d3.zoomTransform(svg.node()!);
      
      htmlLabels
        .style('left', (d: any) => `${transform.applyX(d.x)}px`)
        .style('top', (d: any) => {
          const nodeRadius = d.type === 'EPIC' ? 50 : 
                            d.type === 'MILESTONE' ? 42 : 
                            d.type === 'FEATURE' ? 38 : 32;
          return `${transform.applyY(d.y + nodeRadius + 20)}px`;
        })
        .style('transform', `scale(${transform.k})`)
        .style('transform-origin', 'center top');
    };

    // Update labels on zoom
    zoom.on('zoom', (event) => {
      g.attr('transform', event.transform);
      updateHtmlLabels();
    });

    // Add zoom controls
    const zoomControls = svg.append('g')
      .attr('class', 'zoom-controls')
      .attr('transform', 'translate(20, 20)');

    const zoomIn = zoomControls.append('g')
      .attr('class', 'zoom-button')
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.5);
      });

    zoomIn.append('rect')
      .attr('width', 30)
      .attr('height', 30)
      .attr('fill', '#374151')
      .attr('stroke', '#6b7280')
      .attr('rx', 4);

    zoomIn.append('text')
      .attr('x', 15)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .text('+');

    const zoomOut = zoomControls.append('g')
      .attr('class', 'zoom-button')
      .attr('transform', 'translate(0, 35)')
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().duration(300).call(zoom.scaleBy, 0.67);
      });

    zoomOut.append('rect')
      .attr('width', 30)
      .attr('height', 30)
      .attr('fill', '#374151')
      .attr('stroke', '#6b7280')
      .attr('rx', 4);

    zoomOut.append('text')
      .attr('x', 15)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .text('−');

  }, [handleNodeClick, handleEdgeClick]);

  useEffect(() => {
    initializeVisualization();

    const handleResize = () => {
      initializeVisualization();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initializeVisualization]);

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
            mockProjectNodes.forEach((node: any) => {
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
              {nodeMenu.node.assignee && (
                <span className="flex items-center">
                  <User className="h-3 w-3 mr-1" />
                  {nodeMenu.node.assignee}
                </span>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="px-4 py-2 border-b border-gray-600">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Priority:</span>
                <span className="ml-1 font-medium">{Math.round(nodeMenu.node.priority.computed * 100)}%</span>
              </div>
              {nodeMenu.node.estimatedHours && (
                <div>
                  <span className="text-gray-400">Est:</span>
                  <span className="ml-1 font-medium">{nodeMenu.node.estimatedHours}h</span>
                </div>
              )}
              {nodeMenu.node.actualHours && (
                <div>
                  <span className="text-gray-400">Actual:</span>
                  <span className="ml-1 font-medium">{nodeMenu.node.actualHours}h</span>
                </div>
              )}
              {nodeMenu.node.dueDate && (
                <div className="flex items-center">
                  <Clock className="h-3 w-3 text-gray-400 mr-1" />
                  <span className="font-medium">{new Date(nodeMenu.node.dueDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            
            {nodeMenu.node.tags.length > 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1">
                  {nodeMenu.node.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      <Tag className="h-2 w-2 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={() => startConnection(nodeMenu.node!.id)}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              <Link2 className="h-4 w-4 mr-3" />
              Add Connection
            </button>
            <button className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700">
              <Eye className="h-4 w-4 mr-3" />
              View Details
            </button>
            <button className="w-full flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700">
              <Edit3 className="h-4 w-4 mr-3" />
              Edit Node
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
              <span className="text-gray-300">Strength: {Math.round(edgeMenu.edge.strength * 100)}%</span>
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