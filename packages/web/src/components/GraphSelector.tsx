import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Folder, FolderOpen, Share2, Eye, Edit3, Crown } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { CreateGraphModal } from './CreateGraphModal';

export function GraphSelector() {
  const { currentGraph, graphHierarchy, selectGraph } = useGraph();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside (EXACT same pattern as UserSelector)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Graph selection handler - DON'T close dropdown automatically
  const handleGraphSelect = (graphId: string) => {
    selectGraph(graphId);
    // setIsOpen(false); // Commented out - let it stay open
  };

  const getGraphTypeColor = (type: string) => {
    switch (type) {
      case 'PROJECT': return 'text-blue-300 bg-blue-900/30';
      case 'WORKSPACE': return 'text-purple-300 bg-purple-900/30';
      case 'SUBGRAPH': return 'text-green-300 bg-green-900/30';
      case 'TEMPLATE': return 'text-orange-300 bg-orange-900/30';
      default: return 'text-gray-300 bg-gray-700/30';
    }
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'OWNER': return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'ADMIN': return <Edit3 className="h-3 w-3 text-purple-500" />;
      case 'EDIT': return <Edit3 className="h-3 w-3 text-blue-500" />;
      case 'VIEW': return <Eye className="h-3 w-3 text-gray-500" />;
      default: return null;
    }
  };

  if (!currentGraph) {
    return (
      <div className="p-3">
        <div className="text-center text-gray-400">
          <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No graphs available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Graph selector button (EXACT same pattern as UserSelector) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 w-full p-3 text-left hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${getGraphTypeColor(currentGraph.type)}`}>
            {currentGraph.name.charAt(0).toUpperCase()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-green-300 truncate">
            {currentGraph.name}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`px-1.5 py-0.5 rounded ${getGraphTypeColor(currentGraph.type)}`}>
              {currentGraph.type}
            </span>
            <span>{currentGraph.nodeCount} nodes</span>
            {currentGraph.isShared && <Share2 className="h-3 w-3" />}
          </div>
        </div>
        
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu (EXACT same pattern as UserSelector) */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-600">
            <span className="text-sm font-medium text-gray-300">Select Graph</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setIsOpen(false);
                }}
                className="p-1.5 text-green-400 hover:bg-gray-700 rounded transition-colors"
                title="Create new graph"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:bg-gray-700 rounded transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Graph List (EXACT same pattern as UserSelector) */}
          <div className="max-h-64 overflow-y-auto">
            <div className="p-2">
              {graphHierarchy.length > 0 ? (
                graphHierarchy.map((graph) => (
                  <button
                    key={graph.id}
                    onClick={() => handleGraphSelect(graph.id)}
                    className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left transition-colors ${
                      graph.id === currentGraph.id
                        ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                        : 'hover:bg-gray-700 text-gray-300'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {graph.children && graph.children.length > 0 ? (
                        <FolderOpen className="h-4 w-4" />
                      ) : (
                        <div className="w-4 h-4 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{graph.name}</span>
                        {graph.isShared && <Share2 className="h-3 w-3 text-blue-400" />}
                        {getPermissionIcon(graph.permissions)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className={`px-1.5 py-0.5 rounded ${getGraphTypeColor(graph.type)}`}>
                          {graph.type}
                        </span>
                        <span>{graph.nodeCount} nodes</span>
                      </div>
                    </div>
                    {graph.id === currentGraph.id && (
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No graphs found</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          {graphHierarchy.length > 0 && (
            <div className="border-t border-gray-600 p-2 bg-gray-700/50">
              <div className="text-xs text-gray-400 text-center">
                {graphHierarchy.length} graph{graphHierarchy.length !== 1 ? 's' : ''} available
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Graph Modal */}
      <CreateGraphModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        parentGraphId={currentGraph?.id}
      />
    </div>
  );
}