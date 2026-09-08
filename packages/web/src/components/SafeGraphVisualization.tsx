import { GraphErrorBoundary } from './GraphErrorBoundary';
import { InteractiveGraphVisualization } from './InteractiveGraphVisualization';
import type { WorkItem } from '../types/graph';

/**
 * Wrapper component that adds error handling to the graph visualization
 * without modifying the core InteractiveGraphVisualization component.
 * This prevents breaking the UI when implementing error handling.
 */
interface SafeGraphVisualizationProps {
  onNodeSelected?: (node: WorkItem | null) => void;
  interactionLocked?: boolean;
  quickEditRequest?: WorkItem | null;
  onQuickEditRequestHandled?: () => void;
}

export function SafeGraphVisualization({ onNodeSelected, interactionLocked, quickEditRequest, onQuickEditRequestHandled }: SafeGraphVisualizationProps = {}) {
  return (
    <GraphErrorBoundary
      onError={() => {
        // Error logged by boundary for debugging
      }}
    >
      <InteractiveGraphVisualization onNodeSelected={onNodeSelected} interactionLocked={interactionLocked} quickEditRequest={quickEditRequest} onQuickEditRequestHandled={onQuickEditRequestHandled} />
    </GraphErrorBoundary>
  );
}
