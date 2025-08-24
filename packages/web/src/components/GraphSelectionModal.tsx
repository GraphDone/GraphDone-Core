import { useState } from 'react';
import { X, Folder, FolderOpen, Plus, FileText } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { CreateGraphModal } from './CreateGraphModal';

interface GraphSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GraphSelectionModal({ isOpen, onClose }: GraphSelectionModalProps) {
  const { availableGraphs, selectGraph } = useGraph();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Function to get icon based on graph type - matches CreateGraphModal exactly
  const getGraphTypeIcon = (type?: string) => {
    switch (type) {
      case 'PROJECT':
        return <Folder className="h-5 w-5 text-blue-400" />;
      case 'WORKSPACE':
        return <FolderOpen className="h-5 w-5 text-purple-400" />;
      case 'SUBGRAPH':
        return <Plus className="h-5 w-5 text-green-400" />;
      case 'TEMPLATE':
        return <FileText className="h-5 w-5 text-orange-400" />;
      default:
        return <Plus className="h-5 w-5 text-gray-400" />;
    }
  };

  const handleGraphSelect = async (graphId: string) => {
    await selectGraph(graphId);
    onClose();
  };

  const handleCreateGraph = () => {
    setShowCreateModal(true);
  };

  const handleCreateModalClose = () => {
    setShowCreateModal(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 transition-opacity bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="inline-block w-full max-w-2xl p-0 my-8 overflow-hidden text-left align-middle transition-all transform bg-gray-800 shadow-xl rounded-lg border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
              <h3 className="text-xl font-semibold text-green-300">
                Select Graph
              </h3>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            {availableGraphs.length > 0 ? (
              <div className="p-6 space-y-4">
                <p className="text-gray-300">Choose a graph to start working with</p>
                <div className="divide-y divide-gray-700 max-h-80 overflow-y-auto">
                {availableGraphs.map((graph) => (
                  <button
                    key={graph.id}
                    onClick={() => handleGraphSelect(graph.id)}
                    className="w-full flex items-center px-6 py-4 hover:bg-gray-700/50 transition-colors text-left group"
                  >
                    <div className="flex-shrink-0 mr-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        graph.type === 'PROJECT' ? 'bg-blue-600/20 text-blue-400' :
                        graph.type === 'WORKSPACE' ? 'bg-purple-600/20 text-purple-400' :
                        graph.type === 'SUBGRAPH' ? 'bg-green-600/20 text-green-400' :
                        'bg-orange-600/20 text-orange-400'
                      }`}>
                        {getGraphTypeIcon(graph.type)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-base font-medium text-green-300 group-hover:text-green-200 truncate">
                          {graph.name}
                        </h4>
                        <span className={`ml-2 px-3 py-1 text-xs font-medium rounded-full ${
                          graph.type === 'PROJECT' ? 'bg-blue-600/20 text-blue-300' :
                          graph.type === 'WORKSPACE' ? 'bg-purple-600/20 text-purple-300' :
                          graph.type === 'SUBGRAPH' ? 'bg-green-600/20 text-green-300' :
                          'bg-orange-600/20 text-orange-300'
                        }`}>
                          {graph.type}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-400 group-hover:text-gray-300 truncate mb-2">
                        {graph.description || 'No description provided'}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                          {graph.nodeCount} nodes
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                          {graph.edgeCount || 0} connections
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                          {graph.contributorCount} contributors
                        </span>
                        {graph.status && (
                          <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                            graph.status === 'ACTIVE' ? 'bg-green-900/30 text-green-300' :
                            graph.status === 'DRAFT' ? 'bg-yellow-900/30 text-yellow-300' :
                            'bg-gray-700/30 text-gray-400'
                          }`}>
                            {graph.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <p className="text-gray-300">Choose a graph to start working with</p>
                <div className="text-center py-8">
                {/* Compact Icon */}
                <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Folder className="h-8 w-8 text-white" />
                </div>

                {/* Content */}
                <div className="mb-8">
                  <h4 className="text-lg font-medium text-green-300 mb-3">
                    No graphs yet
                  </h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Create your first graph to start organizing projects with powerful visualization tools.
                  </p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={handleCreateGraph}
                  className="group relative px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white rounded-lg font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 mb-6"
                >
                  <div className="relative flex items-center justify-center">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Graph
                  </div>
                </button>

                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Graph Modal */}
      {showCreateModal && (
        <CreateGraphModal
          isOpen={showCreateModal}
          onClose={handleCreateModalClose}
        />
      )}
    </>
  );
}