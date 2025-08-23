import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface RadarDataPoint {
  axis: string;
  value: number;
  maxValue: number;
  color?: string;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  width?: number;
  height?: number;
  margin?: number;
  levels?: number;
  className?: string;
}

export function RadarChart({
  data,
  width = 300,
  height = 300,
  margin = 50,
  levels = 5,
  className = ''
}: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = Math.min(width - 2 * margin, height - 2 * margin) / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    const angleSlice = (Math.PI * 2) / data.length;

    // Create the container group
    const g = svg.append('g')
      .attr('transform', `translate(${centerX},${centerY})`);

    // Create the circular grid lines
    const levelFactor = radius / levels;
    
    for (let level = 1; level <= levels; level++) {
      g.append('circle')
        .attr('r', levelFactor * level)
        .attr('fill', 'none')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.2);
    }

    // Create the axis lines
    data.forEach((d, i) => {
      const angle = i * angleSlice;
      const x = Math.cos(angle - Math.PI / 2) * radius;
      const y = Math.sin(angle - Math.PI / 2) * radius;

      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.3);

      // Add axis labels with rounded rectangle background
      const labelX = Math.cos(angle - Math.PI / 2) * (radius + 30);
      const labelY = Math.sin(angle - Math.PI / 2) * (radius + 30);

      // Create the label text first to measure its size
      const labelText = `${d.axis} (${d.value})`;
      const tempText = g.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', '500')
        .attr('opacity', 0)
        .text(labelText);

      // Get text dimensions
      const textBBox = (tempText.node() as SVGTextElement).getBBox();
      tempText.remove();

      // Add rounded rectangle background
      const padding = 6;
      g.append('rect')
        .attr('x', labelX - textBBox.width / 2 - padding)
        .attr('y', labelY - textBBox.height / 2 - padding)
        .attr('width', textBBox.width + padding * 2)
        .attr('height', textBBox.height + padding * 2)
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('fill', 'rgba(31, 41, 55, 0.9)')
        .attr('stroke', d.color || 'rgb(99, 102, 241)')
        .attr('stroke-width', 1);

      // Add the actual text
      g.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', '500')
        .attr('fill', 'white')
        .text(labelText);
    });

    // Create the radar area
    const radarLine = d3.line<RadarDataPoint>()
      .x((d, i) => {
        const angle = i * angleSlice;
        const value = Math.max(0, d.value);
        const normalizedValue = d.maxValue > 0 ? value / d.maxValue : 0;
        return Math.cos(angle - Math.PI / 2) * (normalizedValue * radius);
      })
      .y((d, i) => {
        const angle = i * angleSlice;
        const value = Math.max(0, d.value);
        const normalizedValue = d.maxValue > 0 ? value / d.maxValue : 0;
        return Math.sin(angle - Math.PI / 2) * (normalizedValue * radius);
      })
      .curve(d3.curveLinearClosed);

    // Add the radar area
    g.append('path')
      .datum(data)
      .attr('d', radarLine)
      .attr('fill', 'rgba(128, 128, 0, 0.2)')
      .attr('stroke', '#808000')
      .attr('stroke-width', 2);

    // Add data points with status-based colors
    data.forEach((d, i) => {
      const angle = i * angleSlice;
      const value = Math.max(0, d.value);
      const normalizedValue = d.maxValue > 0 ? value / d.maxValue : 0;
      const x = Math.cos(angle - Math.PI / 2) * (normalizedValue * radius);
      const y = Math.sin(angle - Math.PI / 2) * (normalizedValue * radius);

      const pointColor = d.color || 'rgb(99, 102, 241)';
      const strokeColor = d3.color(pointColor)?.darker(0.3)?.toString() || pointColor;

      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 6)
        .attr('fill', pointColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', 2);
    });

    // Add level labels with actual numbers
    for (let level = 1; level <= levels; level++) {
      const maxDataValue = Math.max(...data.map(d => d.maxValue), 1);
      const value = Math.round((level / levels) * maxDataValue);
      g.append('text')
        .attr('x', 5)
        .attr('y', -(levelFactor * level) + 3)
        .attr('font-size', '11px')
        .attr('font-weight', '400')
        .attr('fill', 'white')
        .attr('opacity', 0.7)
        .text(`${value}`);
    }

  }, [data, width, height, margin, levels]);

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ background: 'transparent' }}
      />
    </div>
  );
}