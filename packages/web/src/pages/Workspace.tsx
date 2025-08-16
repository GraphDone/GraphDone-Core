import { useState } from 'react';
import { Plus, Zap, RotateCcw, Share2, Users, Filter } from 'lucide-react';
import { InteractiveGraphVisualization } from '../components/InteractiveGraphVisualization';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';

export function Workspace() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'list' | 'timeline'>('graph');
  const { currentGraph } = useGraph();
  const { currentTeam, currentUser } = useAuth();

  const canEdit = currentGraph && currentUser; // Simplified for demo

  return (
    <div className="h-screen flex flex-col">
      {/* Header with Graph Context */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-green-300">
                {currentGraph?.name || 'Select a Graph'}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-400 mt-1">
                {currentTeam && (
                  <>
                    <span>{currentTeam.name}</span>
                    <span>•</span>
                  </>
                )}
                {currentGraph && (
                  <>
                    <span>{currentGraph.nodeCount} nodes</span>
                    <span>•</span>
                    <span>{currentGraph.edgeCount} connections</span>
                    <span>•</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      currentGraph.type === 'PROJECT' ? 'bg-blue-100 text-blue-800' :
                      currentGraph.type === 'WORKSPACE' ? 'bg-purple-100 text-purple-800' :
                      currentGraph.type === 'SUBGRAPH' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {currentGraph.type}
                    </span>
                    {currentGraph.isShared && (
                      <>
                        <span>•</span>
                        <Share2 className="h-3 w-3 text-blue-500" />
                        <span>Shared</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* View Mode Selector */}
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('graph')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'graph' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Graph
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'timeline' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Timeline
              </button>
            </div>

            {/* Actions */}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!currentGraph}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={!currentGraph}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset View
            </button>
            
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!currentGraph}
            >
              <Zap className="h-4 w-4 mr-2" />
              Auto-layout
            </button>

            {currentGraph?.isShared && (
              <button
                type="button"
                className="btn btn-secondary"
              >
                <Users className="h-4 w-4 mr-2" />
                Collaborators
              </button>
            )}
            
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={!canEdit || !currentGraph}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Node
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {!currentGraph ? (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Graph Selected</h3>
              <p className="text-gray-500 mb-4">
                Select a graph from the sidebar to start working, or create a new one.
              </p>
              <button
                onClick={() => {/* Open graph selection modal */}}
                className="btn btn-primary"
              >
                Select Graph
              </button>
            </div>
          </div>
        ) : viewMode === 'graph' ? (
          <InteractiveGraphVisualization />
        ) : viewMode === 'list' ? (
          <div className="h-full overflow-auto p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">List View</h3>
              <p className="text-gray-500">Detailed list view coming soon...</p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Timeline View</h3>
              <p className="text-gray-500">Timeline view for project progress coming soon...</p>
            </div>
          </div>
        )}
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