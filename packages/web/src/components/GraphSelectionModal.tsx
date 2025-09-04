import { useState } from 'react';
import { X, Folder, FolderOpen, Plus, FileText } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { CreateGraphModal } from './CreateGraphModal';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';

interface GraphSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GraphItemProps {
  graph: any;
  onSelect: (graphId: string) => void;
  getGraphTypeIcon: (type?: string) => React.ReactNode;
}

function GraphItem({ graph, onSelect, getGraphTypeIcon }: GraphItemProps) {
  const { currentTeam } = useAuth();
  
  // Get real-time counts for this specific graph
  const { data: workItemsData } = useQuery(GET_WORK_ITEMS, {
    variables: {
      where: {
        graph: {
          id: graph.id
        }
      }
    },
    pollInterval: 10000,
    fetchPolicy: 'cache-and-network'
  });

  const { data: edgesData } = useQuery(GET_EDGES, {
    variables: {
      where: {
        source: {
          graph: {
            id: graph.id
          }
        }
      }
    },
    pollInterval: 10000,
    fetchPolicy: 'cache-and-network'
  });

  const actualNodeCount = workItemsData?.workItems?.length || 0;
  const actualEdgeCount = edgesData?.edges?.length || 0;

  const getGraphTypeColor = (type: string) => {
    switch (type) {
      case 'PROJECT': return 'text-blue-400 bg-gradient-to-br from-blue-500/20 to-blue-600/30 border border-blue-400/20';
      case 'WORKSPACE': return 'text-purple-400 bg-gradient-to-br from-purple-500/20 to-purple-600/30 border border-purple-400/20';
      case 'SUBGRAPH': return 'text-emerald-400 bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-400/20';
      case 'TEMPLATE': return 'text-amber-400 bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-400/20';
      default: return 'text-slate-400 bg-gradient-to-br from-slate-500/20 to-slate-600/30 border border-slate-400/20';
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'PROJECT': return 'bg-blue-500/20 text-blue-300 border border-blue-400/30';
      case 'WORKSPACE': return 'bg-purple-500/20 text-purple-300 border border-purple-400/30';
      case 'SUBGRAPH': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
      case 'TEMPLATE': return 'bg-amber-500/20 text-amber-300 border border-amber-400/30';
      default: return 'bg-slate-500/20 text-slate-300 border border-slate-400/30';
    }
  };

  const getCardBackgroundColor = (type: string) => {
    switch (type) {
      case 'PROJECT': return 'bg-gradient-to-br from-blue-900/20 via-blue-800/10 to-indigo-900/20 hover:from-blue-800/30 hover:via-blue-700/20 hover:to-indigo-800/30 border-blue-500/30 hover:border-blue-400/50';
      case 'WORKSPACE': return 'bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-violet-900/20 hover:from-purple-800/30 hover:via-purple-700/20 hover:to-violet-800/30 border-purple-500/30 hover:border-purple-400/50';
      case 'SUBGRAPH': return 'bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-teal-900/20 hover:from-emerald-800/30 hover:via-green-700/20 hover:to-teal-800/30 border-emerald-500/30 hover:border-emerald-400/50';
      case 'TEMPLATE': return 'bg-gradient-to-br from-amber-900/20 via-orange-800/10 to-red-900/20 hover:from-amber-800/30 hover:via-orange-700/20 hover:to-red-800/30 border-amber-500/30 hover:border-amber-400/50';
      default: return 'bg-gradient-to-br from-slate-900/20 via-gray-800/10 to-stone-900/20 hover:from-slate-800/30 hover:via-gray-700/20 hover:to-stone-800/30 border-slate-500/30 hover:border-slate-400/50';
    }
  };

  return (
    <button
      onClick={() => onSelect(graph.id)}
      className={`w-full flex items-center px-6 py-5 transition-all duration-300 text-left group rounded-xl border shadow-lg hover:shadow-xl hover:scale-[1.01] transform backdrop-blur-sm overflow-hidden ${getCardBackgroundColor(graph.type)}`}
    >
      <div className="flex-shrink-0 mr-4">
        <div className={`w-10 h-10 rounded flex items-center justify-center ${getGraphTypeColor(graph.type)}`}>
          {getGraphTypeIcon(graph.type)}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-lg font-semibold text-white group-hover:text-green-300 truncate">
            {graph.name}
          </h4>
          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded ${
            graph.type === 'PROJECT' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' :
            graph.type === 'WORKSPACE' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30' :
            graph.type === 'SUBGRAPH' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' :
            graph.type === 'TEMPLATE' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' :
            'bg-slate-500/20 text-slate-300 border border-slate-400/30'
          }`}>
            {graph.type}
          </span>
        </div>
        
        <p className="text-sm text-gray-400 group-hover:text-gray-300 truncate mb-2">
          {graph.description || 'No description provided'}
        </p>
        
        <div className="flex items-center gap-3 text-xs text-gray-500 group-hover:text-gray-400">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
            {actualNodeCount} node{actualNodeCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
            {actualEdgeCount} connection{actualEdgeCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
            {graph.contributorCount} contributor{graph.contributorCount !== 1 ? 's' : ''}
          </span>
          {graph.status && (
            <span className={`px-2 py-0.5 rounded text-xs ${
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
  );
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
      <div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          {/* Enhanced Backdrop with gradient */}
          <div 
            className="fixed inset-0 transition-opacity bg-gradient-to-br from-gray-900/90 via-black/80 to-blue-900/90 animate-in fade-in duration-300"
            onClick={onClose}
          />

          {/* Enhanced Modal with better styling */}
          <div className="inline-block w-full max-w-4xl p-0 my-6 overflow-hidden text-left align-middle transition-all transform bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 shadow-2xl rounded-2xl border border-gray-600/50 animate-in slide-in-from-bottom-4 duration-300 relative">
            {/* Gradient accent line at top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-green-500 to-purple-500"></div>
            
            {/* Enhanced Header with gradient background */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-600/50 bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Folder className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-white via-green-100 to-blue-100 bg-clip-text text-transparent">
                    Select Graph
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-8 pt-1 pb-8 space-y-4 relative">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="w-full h-full" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                  backgroundSize: '20px 20px'
                }}></div>
              </div>
              
              <div className="relative z-10 mb-4">
                <p className="text-lg font-medium text-gray-200 mb-2">Choose your graph to begin</p>
                <p className="text-sm text-gray-400">Select from your available graphs</p>
              </div>
              
              {availableGraphs.length > 0 ? (
                <div className="relative z-10">
                <div className="max-h-80 overflow-y-auto space-y-3 px-1" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                  <style>{`
                    div::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  {availableGraphs.map((graph) => (
                    <GraphItem
                      key={graph.id}
                      graph={graph}
                      onSelect={handleGraphSelect}
                      getGraphTypeIcon={getGraphTypeIcon}
                    />
                  ))}
                </div>
                </div>
              ) : (
                <div className="py-12 relative z-10">
                <div className="text-center max-w-md mx-auto">
                  {/* Icon */}
                  <div className="mx-auto mb-6 w-16 h-16 bg-gray-700 rounded flex items-center justify-center">
                    <Folder className="h-8 w-8 text-gray-400" />
                  </div>

                  {/* Content */}
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-green-300 mb-3">
                      No Graphs Available
                    </h4>
                    <p className="text-gray-400 leading-relaxed">
                      Create your first graph to start organizing your projects with visual tools and collaborative features.
                    </p>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={handleCreateGraph}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 via-emerald-600 to-blue-600 text-white rounded-xl hover:from-green-500 hover:via-emerald-500 hover:to-blue-500 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform border border-green-400/30 font-semibold"
                  >
                    <div className="flex items-center justify-center">
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