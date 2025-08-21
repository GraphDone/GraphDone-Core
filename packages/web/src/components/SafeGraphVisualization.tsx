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
      onError={() => {
        // Error logged by boundary for debugging
      }}
    >
      <InteractiveGraphVisualization />
    </GraphErrorBoundary>
  );
}