import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Folder, FolderOpen, FileText, Share2, Eye, Edit3, Crown } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';

export function GraphSelector() {
  const { currentGraph, graphHierarchy, selectGraph } = useGraph();
  const { currentTeam } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get real-time counts for current graph
  const { data: workItemsData } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph ? {
      where: {
        graph: {
          id: currentGraph.id
        }
      }
    } : {},
    skip: !currentGraph,
    pollInterval: 5000,
    fetchPolicy: 'cache-and-network'
  });

  const { data: edgesData } = useQuery(GET_EDGES, {
    variables: currentGraph ? {
      where: {
        source: {
          graph: {
            id: currentGraph.id
          }
        }
      }
    } : {},
    skip: !currentGraph,
    pollInterval: 5000,
    fetchPolicy: 'cache-and-network'
  });

  const actualNodeCount = workItemsData?.workItems?.length || 0;
  const actualEdgeCount = edgesData?.edges?.length || 0;

  // Function to get icon based on graph type - matches CreateGraphModal exactly
  const getGraphTypeIcon = (type?: string) => {
    switch (type) {
      case 'PROJECT':
        return <Folder className="h-4 w-4" />;
      case 'WORKSPACE':
        return <FolderOpen className="h-4 w-4" />;
      case 'SUBGRAPH':
        return <Plus className="h-4 w-4" />;
      case 'TEMPLATE':
        return <FileText className="h-4 w-4" />;
      default:
        return <Plus className="h-4 w-4" />;
    }
  };

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
      case 'PROJECT': return 'text-blue-400 bg-gradient-to-br from-blue-500/20 to-blue-600/30 border border-blue-400/20';
      case 'WORKSPACE': return 'text-purple-400 bg-gradient-to-br from-purple-500/20 to-purple-600/30 border border-purple-400/20';
      case 'SUBGRAPH': return 'text-emerald-400 bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-400/20';
      case 'TEMPLATE': return 'text-amber-400 bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-400/20';
      default: return 'text-slate-400 bg-gradient-to-br from-slate-500/20 to-slate-600/30 border border-slate-400/20';
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
          <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
        className="flex items-center space-x-3 w-full p-3 text-left hover:bg-gray-700/80 rounded-xl transition-all duration-200 hover:scale-[1.02] border border-gray-600/30 hover:border-gray-500/50 shadow-lg hover:shadow-xl backdrop-blur-sm bg-gray-800/50"
      >
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getGraphTypeColor(currentGraph.type)}`}>
            {getGraphTypeIcon(currentGraph.type)}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-green-300 truncate">
            {currentGraph.name}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{actualNodeCount} node{actualNodeCount !== 1 ? 's' : ''}, {actualEdgeCount} connection{actualEdgeCount !== 1 ? 's' : ''}</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(!showDetails);
              }}
              className="hover:text-green-400 transition-colors p-0.5 rounded"
              title="Graph details"
            >
              <Eye className="h-3 w-3" />
            </button>
            {showDetails && (
              <span className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1">
                {currentGraph.type}{currentGraph.isShared && ' • Shared'}
              </span>
            )}
          </div>
        </div>
        
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu (EXACT same pattern as UserSelector) */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800/95 backdrop-blur-lg border border-gray-600/60 rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-600/60 bg-gradient-to-r from-emerald-500/10 to-green-500/10 backdrop-blur-sm">
            <span className="text-sm font-semibold bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">Select Graph</span>
            <div className="flex items-center gap-2">
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
                    className={`w-full flex items-center space-x-3 p-3 rounded-xl text-left transition-all duration-200 ${
                      graph.id === currentGraph.id
                        ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border border-emerald-400/30 shadow-md'
                        : 'hover:bg-gray-700/60 text-gray-300 hover:border-gray-600/40 border border-transparent hover:shadow-md hover:scale-[1.02]'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${getGraphTypeColor(graph.type)}`}>
                        {getGraphTypeIcon(graph.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{graph.name}</span>
                        {graph.isShared && <Share2 className="h-3 w-3 text-blue-400" />}
                        {getPermissionIcon(graph.permissions)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{graph.id === currentGraph.id ? actualNodeCount : (graph.nodeCount || 0)} node{(graph.id === currentGraph.id ? actualNodeCount : (graph.nodeCount || 0)) !== 1 ? 's' : ''}, {graph.id === currentGraph.id ? actualEdgeCount : (graph.edgeCount || 0)} connection{(graph.id === currentGraph.id ? actualEdgeCount : (graph.edgeCount || 0)) !== 1 ? 's' : ''}</span>
                        <Eye className="h-3 w-3 opacity-50" title={`${graph.type}${graph.isShared ? ' • Shared' : ''}`} />
                      </div>
                    </div>
                    {graph.id === currentGraph.id && (
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
    </div>
  );
}