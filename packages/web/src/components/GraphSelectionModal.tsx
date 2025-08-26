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

  return (
    <button
      onClick={() => onSelect(graph.id)}
      className="w-full flex items-center px-4 py-4 hover:bg-gray-700 transition-colors text-left group rounded-lg border border-gray-600 hover:border-green-500 bg-gray-800 mb-2"
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
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 transition-opacity bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="inline-block w-full max-w-4xl p-0 my-6 overflow-hidden text-left align-middle transition-all transform bg-gray-800 shadow-lg rounded border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
              <div>
                <h3 className="text-xl font-semibold text-green-300">
                  Select Graph
                </h3>
                <p className="text-sm text-gray-400 mt-1">Choose your graph to begin</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            {availableGraphs.length > 0 ? (
              <div className="p-4">
                <div className="max-h-80 overflow-y-auto space-y-2" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                  <style jsx>{`
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
              <div className="p-8">
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
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
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