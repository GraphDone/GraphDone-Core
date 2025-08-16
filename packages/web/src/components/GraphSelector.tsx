import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Folder, FolderOpen, Share2, Lock, Eye, Edit3, Crown, Users } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { Graph, GraphHierarchy } from '../types/graph';

export function GraphSelector() {
  const { currentGraph, graphHierarchy, selectGraph } = useGraph();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGraphs, setExpandedGraphs] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGraphSelect = (graphId: string) => {
    selectGraph(graphId);
    setIsOpen(false);
  };

  const toggleExpanded = (graphId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedGraphs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(graphId)) {
        newSet.delete(graphId);
      } else {
        newSet.add(graphId);
      }
      return newSet;
    });
  };

  const getGraphTypeColor = (type: Graph['type']) => {
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
      case 'OWNER': return <Crown className="h-3 w-3 text-yellow-600" />;
      case 'ADMIN': return <Edit3 className="h-3 w-3 text-purple-600" />;
      case 'EDIT': return <Edit3 className="h-3 w-3 text-blue-600" />;
      case 'VIEW': return <Eye className="h-3 w-3 text-gray-600" />;
      default: return null;
    }
  };

  const renderGraphHierarchy = (hierarchy: GraphHierarchy[], depth = 0) => {
    return hierarchy.map((graph) => {
      const isExpanded = expandedGraphs.has(graph.id);
      const hasChildren = graph.children.length > 0;
      const isSelected = currentGraph?.id === graph.id;
      
      return (
        <div key={graph.id}>
          <button
            onClick={() => handleGraphSelect(graph.id)}
            className={`w-full flex items-center p-2 rounded-lg text-left transition-colors ${
              isSelected
                ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                : 'hover:bg-gray-700 text-gray-300'
            }`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpanded(graph.id, e)}
                className="mr-1 p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <FolderOpen className="h-3 w-3" />
                ) : (
                  <Folder className="h-3 w-3" />
                )}
              </button>
            ) : (
              <div className="w-5 h-5 flex items-center justify-center mr-1">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium truncate">{graph.name}</span>
                
                {graph.isShared ? (
                  <Share2 className="h-3 w-3 text-blue-500" />
                ) : (
                  <Lock className="h-3 w-3 text-gray-400" />
                )}
                
                {getPermissionIcon(graph.permissions)}
              </div>
              
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <span className={`px-1.5 py-0.5 rounded text-xs ${getGraphTypeColor(graph.type)}`}>
                  {graph.type}
                </span>
                <span>{graph.nodeCount} nodes</span>
              </div>
            </div>
            
            {isSelected && (
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
            )}
          </button>
          
          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderGraphHierarchy(graph.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (!currentGraph) {
    return (
      <div className="p-3 text-center text-gray-500">
        <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No graphs available</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Graph selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 w-full p-3 text-left hover:bg-gray-700 rounded-lg transition-colors border-b border-gray-600"
      >
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${getGraphTypeColor(currentGraph.type)}`}>
            {currentGraph.name.charAt(0).toUpperCase()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-green-300 truncate">
            {currentGraph.name}
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <span className={`px-1.5 py-0.5 rounded ${getGraphTypeColor(currentGraph.type)}`}>
              {currentGraph.type}
            </span>
            <span>{currentGraph.nodeCount} nodes</span>
            {currentGraph.isShared && <Share2 className="h-3 w-3" />}
          </div>
        </div>
        
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-600 bg-gray-700">
            <span className="text-sm font-medium text-green-300">Select Graph</span>
            <button
              onClick={() => {/* Open create graph modal */}}
              className="p-1 text-green-400 hover:bg-gray-600 rounded transition-colors"
              title="Create new graph"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Graph list */}
          <div className="max-h-80 overflow-y-auto p-2">
            {graphHierarchy.length > 0 ? (
              renderGraphHierarchy(graphHierarchy)
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No graphs found</p>
                <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm">
                  Create your first graph
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-600 p-3 bg-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{graphHierarchy.length} graphs available</span>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <Users className="h-3 w-3" />
                  <span>Team</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Share2 className="h-3 w-3" />
                  <span>Shared</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}