import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  title: string;
  type: string;
  priority: number;
  x?: number;
  y?: number;
  z?: number;
}

interface Edge {
  source: string;
  target: string;
  type: string;
}

export function GraphVisualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sample data for POC
  const sampleNodes: Node[] = [
    { id: '1', title: 'Core Architecture', type: 'outcome', priority: 0.9 },
    { id: '2', title: 'User Authentication', type: 'task', priority: 0.7 },
    { id: '3', title: 'Graph Visualization', type: 'task', priority: 0.8 },
    { id: '4', title: 'API Design', type: 'milestone', priority: 0.6 },
    { id: '5', title: 'Mobile Support', type: 'idea', priority: 0.3 },
  ];

  const sampleEdges: Edge[] = [
    { source: '1', target: '2', type: 'dependency' },
    { source: '1', target: '3', type: 'dependency' },
    { source: '2', target: '4', type: 'dependency' },
    { source: '3', target: '4', type: 'dependency' },
    { source: '4', target: '5', type: 'relates_to' },
  ];

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

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

    // Create scales for priority-based positioning (spherical model)
    const radiusScale = d3.scaleLinear()
      .domain([0, 1])
      .range([50, Math.min(width, height) / 3]);

    // Position nodes in spherical model
    const positionedNodes = sampleNodes.map((node, i) => {
      const radius = radiusScale(1 - node.priority); // Higher priority = closer to center
      const angle = (i / sampleNodes.length) * 2 * Math.PI;
      
      return {
        ...node,
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      };
    });

    // Create links
    mainGroup.selectAll('.edge')
      .data(sampleEdges)
      .enter().append('line')
      .attr('class', d => `edge edge-${d.type}`)
      .attr('stroke-width', 2)
      .attr('x1', d => {
        const source = positionedNodes.find(n => n.id === d.source);
        return source?.x || 0;
      })
      .attr('y1', d => {
        const source = positionedNodes.find(n => n.id === d.source);
        return source?.y || 0;
      })
      .attr('x2', d => {
        const target = positionedNodes.find(n => n.id === d.target);
        return target?.x || 0;
      })
      .attr('y2', d => {
        const target = positionedNodes.find(n => n.id === d.target);
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
      .attr('r', d => 8 + d.priority * 12) // Size based on priority
      .attr('fill', d => {
        const colors = {
          outcome: '#3b82f6',
          task: '#10b981',
          milestone: '#f59e0b',
          idea: '#8b5cf6'
        };
        return colors[d.type as keyof typeof colors] || '#6b7280';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Add node labels
    nodeGroup.append('text')
      .attr('class', 'node-text')
      .attr('dy', -25)
      .attr('text-anchor', 'middle')
      .text(d => d.title)
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#374151');

    // Add priority indicators
    nodeGroup.append('circle')
      .attr('class', 'priority-indicator')
      .attr('r', 3)
      .attr('cy', 15)
      .attr('fill', d => {
        if (d.priority > 0.7) return '#dc2626';
        if (d.priority > 0.4) return '#d97706';
        return '#059669';
      });

    // Add hover effects
    nodeGroup
      .on('mouseenter', function(_event, d) {
        d3.select(this).select('circle.node-circle')
          .transition()
          .duration(200)
          .attr('r', (8 + d.priority * 12) * 1.2);
      })
      .on('mouseleave', function(_event, d) {
        d3.select(this).select('circle.node-circle')
          .transition()
          .duration(200)
          .attr('r', 8 + d.priority * 12);
      })
      .on('click', function(_event, _d) {
        // Handle node click interaction
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

  }, []);

  return (
    <div ref={containerRef} className="graph-container">
      <svg ref={svgRef} className="w-full h-full" />
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Node Types</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-600">Outcome</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-600">Task</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-600">Milestone</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-xs text-gray-600">Idea</span>
          </div>
        </div>
        
        <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-3">Priority</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-xs text-gray-600">High (0.7+)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
            <span className="text-xs text-gray-600">Medium (0.4-0.7)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-xs text-gray-600">Low (0-0.4)</span>
          </div>
        </div>
      </div>
    </div>
  );
}