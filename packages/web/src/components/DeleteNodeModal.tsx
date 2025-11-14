import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { X, Trash2, AlertTriangle, Shield, CheckCircle, GitBranch } from 'lucide-react';
import { DELETE_WORK_ITEM, GET_WORK_ITEMS, GET_EDGES, DELETE_EDGE } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getRelationshipConfig, type RelationshipType } from '../constants/workItemConstants';

// Custom styles for enhanced UI
const customStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(75, 85, 99, 0.2);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, rgb(251, 146, 60), rgb(251, 191, 36));
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, rgb(249, 115, 22), rgb(245, 158, 11));
  }
  
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-slide-in-up {
    animation: slideInUp 0.3s ease-out forwards;
  }
`;

interface DeleteNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  onOpenDisconnectModal?: () => void;
}

export function DeleteNodeModal({ isOpen, onClose, nodeId, nodeTitle, nodeType, onOpenDisconnectModal }: DeleteNodeModalProps) {
  const { currentTeam } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const [understandRisks, setUnderstandRisks] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setUnderstandRisks(false);
      setConfirmDeletion(false);
    }
  }, [isOpen]);

  // Query to check for node connections
  const { data: edgesData, loading: loadingEdges } = useQuery(GET_EDGES, {
    variables: {
      where: {
        OR: [
          { source: { id: nodeId } },
          { target: { id: nodeId } }
        ]
      }
    },
    skip: !isOpen || !nodeId
  });

  const nodeConnections = edgesData?.edges || [];
  const hasConnections = nodeConnections.length > 0;
  
  
  const [deleteWorkItem, { loading: deletingNode }] = useMutation(DELETE_WORK_ITEM, {
    refetchQueries: [
      { 
        query: GET_WORK_ITEMS,
        variables: {
          options: { limit: 100 }
        }
      },
      { 
        query: GET_WORK_ITEMS,
        variables: {
          where: {
            teamId: currentTeam?.id || 'team-1'
          }
        }
      }
    ],
    awaitRefetchQueries: true,
    update: (cache, { data }) => {
      if (data?.deleteWorkItems?.nodesDeleted > 0) {
        // Evict all workItems queries to ensure complete refresh across all views
        cache.evict({ fieldName: 'workItems' });
        cache.gc();
      }
    }
  });

  const [deleteEdge, { loading: deletingConnection }] = useMutation(DELETE_EDGE, {
    refetchQueries: [
      { 
        query: GET_EDGES,
        variables: {
          where: {
            OR: [
              { source: { id: nodeId } },
              { target: { id: nodeId } }
            ]
          }
        }
      }
    ],
    awaitRefetchQueries: true
  });

  const handleGoToDisconnect = () => {
    onClose(); // Close delete modal
    if (onOpenDisconnectModal) {
      onOpenDisconnectModal(); // Open disconnect modal
    }
  };

  const handleDisconnectAllConnections = async () => {
    if (nodeConnections.length === 0) return;

    try {
      // Disconnect all edges for this node
      for (const edge of nodeConnections) {
        await deleteEdge({
          variables: { 
            where: { id: edge.id }
          }
        });
      }
      
      showSuccess(
        'All Connections Removed!',
        `Disconnected all ${nodeConnections.length} connection${nodeConnections.length !== 1 ? 's' : ''} from "${nodeTitle}".`
      );
      
    } catch (error) {
      showError(
        'Failed to Remove All Connections',
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
      
    } catch (error) {
      showError(
        'Failed to Remove Connection',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const handleDelete = async () => {
    try {
      
      await deleteWorkItem({
        variables: { 
          where: { id: nodeId }
        }
      });
      

      showSuccess(
        'Node Deleted Successfully!',
        `"${nodeTitle}" has been permanently removed from the graph and all connected relationships have been cleaned up.`
      );
      
      onClose();
    } catch (error) {
      
      // Determine user-friendly error message
      let errorMessage = 'Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);
        if (message.includes('NetworkError') || message.includes('fetch')) {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        } else if (message.includes('Neo4j') || message.includes('database')) {
          errorMessage = 'Database error occurred. Please contact support.';
        } else if (message.includes('not found')) {
          errorMessage = 'Node no longer exists in the database.';
        }
      }
      
      showError(
        'Failed to Delete Node',
        errorMessage
      );
    }
  };


  if (!isOpen) return null;

  return (
    <>
      {/* Inject custom styles */}
      <style>{customStyles}</style>
      
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Enhanced backdrop with blur */}
        <div 
          className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm transition-all duration-300" 
          onClick={onClose} 
        />

        <div 
          className="inline-block align-bottom bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
          }}
        >
          {/* Modern header with gradient */}
          <div className="relative bg-gradient-to-r from-red-900/30 via-red-800/20 to-orange-900/30 px-8 py-6 border-b border-red-600/20">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-orange-500/5"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-10 h-10 bg-red-500/20 border border-red-400/30 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="h-5 w-5 text-red-400 drop-shadow-lg" />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-red-200 to-orange-200 bg-clip-text text-transparent">Delete Node</h3>
                  <p className="text-gray-400 text-sm">Permanent removal action</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="group p-2 hover:bg-red-500/10 rounded-lg transition-all duration-200"
              >
                <X className="h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
              </button>
            </div>
          </div>

          {/* Enhanced loading state */}
          {loadingEdges && (
            <div className="p-12">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-xl"></div>
                  <div className="relative w-12 h-12 border-4 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-gray-200 font-medium">Analyzing Connections</p>
                  <p className="text-gray-400 text-sm">Scanning node relationships...</p>
                </div>
              </div>
            </div>
          )}

          {/* Connections blocking screen - same pattern as DeleteGraphModal */}
          {!loadingEdges && hasConnections && (
            <div className="p-8">
              <div className="mb-8">
                {/* Modern icon with gradient background */}
                <div className="relative flex items-center justify-center w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-full blur-xl"></div>
                  <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-400/10 to-amber-400/10 border border-orange-400/30 rounded-full backdrop-blur-sm">
                    <GitBranch className="h-8 w-8 text-orange-400 drop-shadow-lg" />
                  </div>
                </div>
                
                {/* Modern typography */}
                <div className="space-y-3">
                  <h4 className="text-2xl font-bold bg-gradient-to-r from-orange-200 to-amber-200 bg-clip-text text-transparent text-center">
                    Connected Node Detected
                  </h4>
                  <p className="text-gray-300 text-center text-lg leading-relaxed max-w-md mx-auto">
                    This node has <span className="inline-flex items-center px-2 py-1 bg-orange-500/20 border border-orange-400/30 rounded-full text-orange-200 font-semibold text-sm">{nodeConnections.length} active connection{nodeConnections.length !== 1 ? 's' : ''}</span>
                  </p>
                  <p className="text-gray-400 text-center text-sm">
                    Remove all connections first to enable deletion
                  </p>
                </div>
              </div>

              {/* Inline disconnect actions - matching DeleteGraphModal pattern */}
              <div className="bg-orange-900/20 border border-orange-600/30 rounded-lg p-5 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-6 w-6 text-orange-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-orange-200 font-semibold mb-3">Disconnect Connections First</h4>
                    <p className="text-orange-300 text-sm mb-4">
                      This node has <strong className="text-orange-200">{nodeConnections.length} connection{nodeConnections.length !== 1 ? 's' : ''}</strong>. Remove them to enable deletion:
                    </p>
                    
                    {/* Disconnect All Button */}
                    <div className="mb-4">
                      <button
                        onClick={handleDisconnectAllConnections}
                        disabled={deletingConnection}
                        className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-2 font-medium disabled:cursor-not-allowed"
                      >
                        <GitBranch className="h-4 w-4" />
                        <span>{deletingConnection ? 'Disconnecting...' : 'Disconnect All Connections'}</span>
                      </button>
                    </div>
                    
                    {/* Individual connections with disconnect buttons */}
                    <div className="space-y-3">
                      {nodeConnections.map((edge: any, index: number) => (
                        <div key={edge.id} className="flex items-center justify-between p-3 bg-gray-700/50 border border-gray-600/30 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                            <div>
                              <span className="text-gray-300 text-sm">
                                {edge.source.id === nodeId ? 'connects to' : 'connected from'} "{edge.source.id === nodeId ? edge.target.title : edge.source.title}"
                              </span>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-400/30 rounded-full text-xs font-semibold text-orange-200">
                                  {getRelationshipConfig(edge.type as RelationshipType).label}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDisconnectEdge(
                              edge.id,
                              edge.source.title,
                              edge.target.title
                            )}
                            disabled={deletingConnection}
                            className="px-2 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded text-xs flex items-center space-x-1 disabled:cursor-not-allowed"
                            title="Disconnect this relationship"
                          >
                            <X className="h-3 w-3" />
                            <span>Disconnect</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modern button group */}
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/50 text-gray-200 font-medium rounded-xl transition-all duration-200 backdrop-blur-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Enhanced Warning and Risk Acknowledgment */}
          {!loadingEdges && !hasConnections && (
            <div className="p-8">
              <div className="mb-8">
                {/* Modern danger icon with glow effect */}
                <div className="relative flex items-center justify-center w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 to-orange-500/30 rounded-full blur-2xl animate-pulse"></div>
                  <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-400/40 rounded-full backdrop-blur-sm">
                    <Shield className="h-10 w-10 text-red-400 drop-shadow-lg" />
                  </div>
                </div>
                
                {/* Professional typography */}
                <div className="text-center space-y-3 mb-6">
                  <h4 className="text-lg font-semibold text-red-200">
                    Delete Node Permanently
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300">
                      You are about to permanently delete
                    </p>
                    <div className="inline-flex items-center px-3 py-2 bg-red-500/10 border border-red-400/30 rounded-lg">
                      <span className="font-semibold text-red-200 text-sm">"{nodeTitle}"</span>
                    </div>
                  </div>
                  <p className="text-red-300 text-xs bg-red-900/20 border border-red-600/30 rounded-lg px-3 py-2 mx-auto max-w-sm">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              {/* Enhanced Node Info Card */}
              <div className="relative bg-gradient-to-r from-gray-800/80 to-gray-700/60 border border-gray-600/50 rounded-xl p-6 mb-8 backdrop-blur-sm">
                <div className="absolute top-3 right-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-500/20 border border-red-400/30 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-300">Target Node</p>
                      <p className="text-xl font-bold text-white">{nodeTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-600/30">
                    <span className="text-sm text-gray-400">Node Type</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-blue-200">
                      {nodeType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced Risk Warning */}
              <div className="relative bg-gradient-to-r from-red-900/30 via-red-800/20 to-orange-900/20 border-2 border-red-500/30 rounded-xl p-6 mb-8 backdrop-blur-sm">
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full"></div>
                
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 border border-red-400/40 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-red-200 mb-4">Critical Data Loss Warning</h4>
                    <div className="space-y-3">
                      <p className="text-red-300 text-sm font-medium mb-4">The following will be permanently destroyed:</p>
                      <div className="grid gap-3">
                        {[
                          "Node data (description, tags, priorities)",
                          "All connections to other nodes", 
                          "Historical activity and comments",
                          "Assignment and contributor relationships",
                          "Dependencies and references"
                        ].map((item, index) => (
                          <div key={index} className="flex items-center space-x-3 p-3 bg-red-500/5 border border-red-400/20 rounded-lg">
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                            <span className="text-red-200 text-sm font-medium">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Security Confirmations */}
              <div className="space-y-5 mb-8">
                <div className="bg-gray-800/50 border border-gray-600/50 rounded-xl p-5 backdrop-blur-sm">
                  <h5 className="text-base font-semibold text-gray-200 mb-4 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                    Security Confirmations
                  </h5>
                  
                  <div className="space-y-4">
                    <label className="group flex items-start space-x-4 cursor-pointer p-3 rounded-lg hover:bg-gray-700/30 transition-colors select-text">
                      <input
                        type="checkbox"
                        checked={understandRisks}
                        onChange={(e) => setUnderstandRisks(e.target.checked)}
                        className="mt-1 h-5 w-5 text-red-600 focus:ring-red-500 focus:ring-offset-0 border-gray-500 rounded bg-gray-700/80 transition-colors pointer-events-auto"
                      />
                      <div className="space-y-1">
                        <span className="text-gray-200 font-medium text-sm leading-relaxed">
                          I understand this action is irreversible
                        </span>
                        <p className="text-gray-400 text-xs">
                          All node data and relationships will be permanently destroyed
                        </p>
                      </div>
                    </label>
                    
                    <label className="group flex items-start space-x-4 cursor-pointer p-3 rounded-lg hover:bg-gray-700/30 transition-colors select-text">
                      <input
                        type="checkbox"
                        checked={confirmDeletion}
                        onChange={(e) => setConfirmDeletion(e.target.checked)}
                        className="mt-1 h-5 w-5 text-red-600 focus:ring-red-500 focus:ring-offset-0 border-gray-500 rounded bg-gray-700/80 transition-colors pointer-events-auto"
                      />
                      <div className="space-y-1">
                        <span className="text-gray-200 font-medium text-sm leading-relaxed">
                          I confirm deletion of "<span className="text-red-300 font-semibold">{nodeTitle}</span>"
                        </span>
                        <p className="text-gray-400 text-xs">
                          I accept full responsibility for this permanent action
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Enhanced Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-gray-300 bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/50 font-medium rounded-xl transition-all duration-200 backdrop-blur-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!understandRisks || !confirmDeletion || deletingNode}
                  className="group relative px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 hover:shadow-lg hover:shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-red-600/20 rounded-xl blur opacity-0 group-hover:opacity-100 group-disabled:opacity-0 transition-opacity duration-200"></div>
                  {deletingNode ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10"></div>
                      <span className="relative z-10">Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5 relative z-10" />
                      <span className="relative z-10">Delete Forever</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      </div>
    </>
  );
}