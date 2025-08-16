import React from 'react';
import { Plus, Zap, RotateCcw } from 'lucide-react';
import { GraphVisualization } from '../components/GraphVisualization';
import { CreateNodeModal } from '../components/CreateNodeModal';

export function GraphView() {
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Graph View</h1>
            <p className="text-sm text-gray-400 mt-1">
              Visualize work as interconnected outcomes and dependencies
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              type="button"
              className="btn btn-secondary"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset View
            </button>
            
            <button
              type="button"
              className="btn btn-secondary"
            >
              <Zap className="h-4 w-4 mr-2" />
              Auto-layout
            </button>
            
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Node
            </button>
          </div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative">
        <GraphVisualization />
      </div>

      {/* Create Node Modal */}
      {showCreateModal && (
        <CreateNodeModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}