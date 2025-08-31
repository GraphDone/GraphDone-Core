import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { X, Trash2, Shield, GitBranch } from 'lucide-react';
import { AlertTriangle, CheckCircle, WORK_ITEM_TYPES } from '../constants/workItemConstants';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import { GET_WORK_ITEMS, GET_EDGES, DELETE_WORK_ITEM, DELETE_EDGE } from '../lib/queries';

interface DeleteGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteGraphModal({ isOpen, onClose }: DeleteGraphModalProps) {
  const { currentGraph, deleteGraph } = useGraph();
  const { showSuccess, showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState<'warning' | 'confirm'>('warning');
  const [understandRisks, setUnderstandRisks] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [nodes, setNodes] = useState<any[]>([]);
  const [nodeConnections, setNodeConnections] = useState<{[key: string]: any[]}>({});

  // Query to get the nodes in the graph
  const { loading: loadingNodes } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph ? {
      where: {
        graph: {
          id: currentGraph.id
        }
      }
    } : undefined,
    skip: !isOpen || !currentGraph,
    onCompleted: (data) => {
      const workItems = data?.workItems || [];
      setNodeCount(workItems.length);
      setNodes(workItems);
    }
  });

  // Query to get all edges for connection information
  const { data: edgesData } = useQuery(GET_EDGES, {
    variables: currentGraph ? {
      where: {
        source: {
          graph: {
            id: currentGraph.id
          }
        }
      }
    } : undefined,
    skip: !isOpen || !currentGraph,
    onCompleted: (data) => {
      const edges = data?.edges || [];
      const connections: {[key: string]: any[]} = {};
      
      // Group edges by node
      edges.forEach((edge: any) => {
        if (!connections[edge.source.id]) connections[edge.source.id] = [];
        if (!connections[edge.target.id]) connections[edge.target.id] = [];
        
        connections[edge.source.id].push({...edge, direction: 'outgoing'});
        connections[edge.target.id].push({...edge, direction: 'incoming'});
      });
      
      setNodeConnections(connections);
    }
  });

  // Delete work item mutation
  const [deleteWorkItem] = useMutation(DELETE_WORK_ITEM, {
    refetchQueries: [
      { 
        query: GET_WORK_ITEMS,
        variables: currentGraph ? {
          where: {
            graph: {
              id: currentGraph.id
            }
          }
        } : undefined
      },
      {
        query: GET_EDGES,
        variables: currentGraph ? {
          where: {
            source: {
              graph: {
                id: currentGraph.id
              }
            }
          }
        } : undefined
      }
    ]
  });

  // Delete edge mutation
  const [deleteEdge] = useMutation(DELETE_EDGE, {
    refetchQueries: [
      {
        query: GET_EDGES,
        variables: currentGraph ? {
          where: {
            source: {
              graph: {
                id: currentGraph.id
              }
            }
          }
        } : undefined
      }
    ]
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('warning');
      setConfirmText('');
      setUnderstandRisks(false);
      setConfirmDeletion(false);
    }
  }, [isOpen]);

  const handleDeleteNode = async (nodeId: string, nodeTitle: string) => {
    try {
      await deleteWorkItem({
        variables: { 
          where: { id: nodeId }
        }
      });
      
      showSuccess(
        'Node Deleted Successfully!',
        `"${nodeTitle}" has been removed from the graph.`
      );
      
      // Update local state
      setNodes(prev => prev.filter(node => node.id !== nodeId));
      setNodeCount(prev => prev - 1);
      
    } catch (error) {
      showError(
        'Failed to Delete Node',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const handleDisconnectAllNodeConnections = async (nodeId: string, nodeTitle: string) => {
    const connections = nodeConnections[nodeId] || [];
    if (connections.length === 0) return;

    try {
      // Disconnect all edges for this node
      for (const conn of connections) {
        await deleteEdge({
          variables: { 
            where: { id: conn.id }
          }
        });
      }
      
      showSuccess(
        'All Connections Removed!',
        `Disconnected all ${connections.length} connection${connections.length !== 1 ? 's' : ''} from "${nodeTitle}".`
      );
      
      // Update local connections state - remove all connections for this node
      setNodeConnections(prev => {
        const updated = { ...prev };
        delete updated[nodeId]; // Remove all connections for this node
        // Also remove this node from other nodes' connections
        Object.keys(updated).forEach(otherNodeId => {
          updated[otherNodeId] = updated[otherNodeId].filter(conn => 
            conn.source.id !== nodeId && conn.target.id !== nodeId
          );
        });
        return updated;
      });
      
    } catch (error) {
      showError(
        'Failed to Remove Connections',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const handleDisconnectEdge = async (edgeId: string, sourceTitle: string, targetTitle: string) => {
    try {
      await deleteEdge({
        variables: { 
          where: { id: edgeId }
        }
      });
      
      showSuccess(
        'Connection Removed!',
        `Disconnected "${sourceTitle}" from "${targetTitle}".`
      );
      
      // Update local connections state
      setNodeConnections(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(nodeId => {
          updated[nodeId] = updated[nodeId].filter(conn => conn.id !== edgeId);
        });
        return updated;
      });
      
    } catch (error) {
      showError(
        'Failed to Remove Connection',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  if (!isOpen || !currentGraph) return null;

  const isConfirmValid = confirmText === currentGraph.name;

  const handleDelete = async () => {
    if (!isConfirmValid) return;
    
    setLoading(true);
    const graphName = currentGraph.name; // Store name before deletion
    
    try {
      await deleteGraph(currentGraph.id);
      
      // Show success notification
      showSuccess(
        'Graph Deleted Successfully!',
        `"${graphName}" has been permanently removed.`
      );
      
      onClose();
    } catch (error) {
      showError(
        'Failed to Delete Graph',
        error instanceof Error ? error.message : 'An unexpected error occurred while deleting the graph. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-gray-800 rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-red-900/20 px-6 py-4 border-b border-red-600/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <h3 className="text-lg font-semibold text-red-200">Delete Graph</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Loading state */}
          {loadingNodes && (
            <div className="p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
              <p className="text-center text-gray-400 mt-3">Analyzing graph structure...</p>
            </div>
          )}

          {/* Block deletion if graph has nodes */}
          {!loadingNodes && nodeCount > 0 && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-center w-16 h-16 bg-orange-900/20 rounded-full mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-orange-400" />
                </div>
                <h4 className="text-xl font-semibold text-orange-200 text-center mb-2">
                  Graph Contains Active Nodes
                </h4>
                <p className="text-gray-300 text-center mb-6">
                  Cannot delete <strong className="text-white">"{currentGraph.name}"</strong> while it contains nodes
                </p>
              </div>

              {/* Nodes list with connections and delete buttons */}
              <div className="bg-orange-900/20 border border-orange-600/30 rounded-lg p-5 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-6 w-6 text-orange-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-orange-200 font-semibold mb-3">Delete Nodes First</h4>
                    <p className="text-orange-300 text-sm mb-4">
                      This graph contains <strong className="text-orange-200">{nodeCount} node{nodeCount !== 1 ? 's' : ''}</strong>. Remove connections first, then delete nodes:
                    </p>
                    
                    {/* Nodes list */}
                    <div className="max-h-64 overflow-y-auto space-y-3">
                      {nodes.map((node) => {
                        const connections = nodeConnections[node.id] || [];
                        const hasConnections = connections.length > 0;
                        
                        return (
                          <div key={node.id} className="bg-gray-800/60 border border-gray-600/50 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  {(() => {
                                    const typeConfig = WORK_ITEM_TYPES[node.type as keyof typeof WORK_ITEM_TYPES];
                                    const IconComponent = typeConfig?.icon;
                                    return (
                                      <div className="flex items-center space-x-2">
                                        {IconComponent && (
                                          <div className={`w-5 h-5 ${typeConfig.bgColor} ${typeConfig.borderColor} border rounded-sm flex items-center justify-center`}>
                                            <IconComponent className={`h-3 w-3 ${typeConfig.color}`} />
                                          </div>
                                        )}
                                        <span className={`px-2 py-1 ${typeConfig?.bgColor || 'bg-gray-900/30'} ${typeConfig?.borderColor || 'border-gray-600/30'} border rounded text-xs ${typeConfig?.color || 'text-gray-300'}`}>
                                          {typeConfig?.label || node.type}
                                        </span>
                                        <h5 className="text-white font-medium">{node.title}</h5>
                                      </div>
                                    );
                                  })()}
                                </div>
                                
                                {hasConnections && (
                                  <div className="mb-3">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <GitBranch className="h-4 w-4 text-orange-400" />
                                      <span className="text-orange-300 text-sm font-medium">
                                        {connections.length} connection{connections.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {connections.map((conn, index) => (
                                        <div key={conn.id} className="flex items-center justify-between p-2 bg-gray-700/50 border border-gray-600/30 rounded">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
                                            <span className="text-xs text-gray-300">
                                              {conn.direction === 'outgoing' ? 'connects to' : 'connected from'} "{conn.direction === 'outgoing' ? conn.target.title : conn.source.title}"
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => handleDisconnectEdge(
                                              conn.id,
                                              conn.source.title,
                                              conn.target.title
                                            )}
                                            className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs flex items-center space-x-1"
                                            title="Disconnect this relationship"
                                          >
                                            <X className="h-3 w-3" />
                                            <span>Disconnect</span>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {!hasConnections && (
                                  <div className="flex items-center space-x-2 mb-2">
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                    <span className="text-green-300 text-sm">No connections - ready to delete</span>
                                  </div>
                                )}
                              </div>
                              
                              {hasConnections ? (
                                <button
                                  onClick={() => handleDisconnectAllNodeConnections(node.id, node.title)}
                                  className="ml-4 flex flex-col items-center justify-center p-3 bg-orange-800/30 border border-orange-600/50 rounded-lg min-w-[120px] hover:bg-orange-700/40 transition-colors"
                                >
                                  <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center mb-1">
                                    <GitBranch className="h-3 w-3 text-orange-400" />
                                  </div>
                                  <span className="text-xs font-medium text-orange-300 text-center leading-tight">
                                    Disconnect First
                                  </span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDeleteNode(node.id, node.title)}
                                  className="ml-4 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h5 className="text-blue-200 font-semibold mb-2">Why this restriction?</h5>
                    <p className="text-blue-300 text-sm">
                      This safety measure ensures that you consciously review and delete each node before removing the graph structure. 
                      It prevents accidental loss of important work items and their relationships.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                {nodeCount === 0 && (
                  <button
                    onClick={() => setStep('warning')}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Now Delete Graph</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Warning and Risk Acknowledgment - Only shown when graph is empty */}
          {!loadingNodes && nodeCount === 0 && step === 'warning' && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-center w-16 h-16 bg-red-900/20 rounded-full mx-auto mb-4">
                  <Shield className="h-8 w-8 text-red-400" />
                </div>
                <h4 className="text-xl font-semibold text-red-200 text-center mb-2">
                  Delete Empty Graph
                </h4>
                <p className="text-gray-300 text-center mb-6">
                  You are about to permanently delete the empty graph <strong className="text-white">"{currentGraph.name}"</strong>
                </p>
                
                {/* Confirmation that graph is empty */}
                <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-green-200 font-semibold">
                        Graph is empty and ready for deletion
                      </p>
                      <p className="text-green-300 text-sm mt-1">
                        This graph contains no nodes or edges.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Warning */}
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-5 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-6 w-6 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-red-200 font-semibold mb-3">What will be permanently deleted:</h4>
                    <ul className="text-red-300 text-sm space-y-2">
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        The graph structure and metadata
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        Graph settings and configuration
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        Team member access and permissions for this graph
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        Any links from other graphs to this graph
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        Graph activity history and audit logs
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Confirmation Checkboxes */}
              <div className="space-y-4 mb-6">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={understandRisks}
                    onChange={(e) => setUnderstandRisks(e.target.checked)}
                    className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-600 rounded bg-gray-700"
                  />
                  <span className="text-gray-300 text-sm">
                    I understand that this action cannot be undone and the graph structure will be permanently lost
                  </span>
                </label>
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmDeletion}
                    onChange={(e) => setConfirmDeletion(e.target.checked)}
                    className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-600 rounded bg-gray-700"
                  />
                  <span className="text-gray-300 text-sm">
                    I confirm that I want to delete the empty graph "{currentGraph.name}"
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!understandRisks || !confirmDeletion}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Continue to Final Step</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Final Confirmation - Only shown when graph is empty */}
          {!loadingNodes && nodeCount === 0 && step === 'confirm' && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-center w-16 h-16 bg-red-900/20 rounded-full mx-auto mb-4">
                  <Trash2 className="h-8 w-8 text-red-400" />
                </div>
                <h4 className="text-xl font-semibold text-red-200 text-center mb-2">
                  Final Confirmation Required
                </h4>
                <p className="text-gray-300 text-center">
                  This is your last chance to cancel this action
                </p>
              </div>

              {/* Process explanation */}
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h5 className="text-blue-200 font-semibold mb-2">Deletion Process:</h5>
                    <ol className="text-blue-300 text-sm space-y-1 list-decimal list-inside">
                      <li>Delete all {nodeCount} nodes (edges are removed automatically)</li>
                      <li>Delete the graph structure and metadata</li>
                      <li>Clear all permissions and access rights</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Final Warning */}
              <div className="bg-red-900/30 border-2 border-red-600/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center mb-3">
                  <AlertTriangle className="h-6 w-6 text-red-400 mr-2" />
                  <span className="text-red-200 font-semibold">IRREVERSIBLE ACTION</span>
                </div>
                <p className="text-red-300 text-center text-sm">
                  Once you click "Delete Forever", the graph "{currentGraph.name}" and all its data will be permanently destroyed.
                </p>
              </div>

              {/* Confirmation Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  To proceed, type the exact graph name:
                </label>
                <div className="text-center mb-3">
                  <span className="text-white font-mono bg-gray-700 px-3 py-1 rounded text-sm">
                    {currentGraph.name}
                  </span>
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500 text-center"
                  placeholder="Type the graph name here"
                  autoFocus
                />
                {confirmText && confirmText !== currentGraph.name && (
                  <p className="text-red-400 text-xs mt-1 text-center">Graph name doesn't match</p>
                )}
                {isConfirmValid && (
                  <p className="text-green-400 text-xs mt-1 text-center flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Graph name confirmed
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep('warning')}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!isConfirmValid || loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{loading ? 'Deleting Forever...' : 'Delete Forever'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}