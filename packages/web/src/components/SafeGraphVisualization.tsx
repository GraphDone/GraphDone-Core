import React from 'react';
import { GraphErrorBoundary } from './GraphErrorBoundary';
import { InteractiveGraphVisualization } from './InteractiveGraphVisualization';

/**
 * Wrapper component that adds error handling to the graph visualization
 * without modifying the core InteractiveGraphVisualization component.
 * This prevents breaking the UI when implementing error handling.
 */
export function SafeGraphVisualization() {
  return (
    <GraphErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Graph visualization error caught by boundary:', error, errorInfo);
      }}
    >
      <InteractiveGraphVisualization />
    </GraphErrorBoundary>
  );
}