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

interface DeleteWorkItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  workItemId: string;
  workItemTitle: string;
  workItemType: string;
  onOpenDisconnectModal?: () => void;
}

export function DeleteWorkItemModal({ isOpen, onClose, workItemId, workItemTitle, workItemType, onOpenDisconnectModal }: DeleteWorkItemModalProps) {
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

  // Query to check for work item connections
  const { data: edgesData, loading: loadingEdges } = useQuery(GET_EDGES, {
    variables: {
      where: {
        OR: [
          { source: { id: workItemId } },
          { target: { id: workItemId } }
        ]
      }
    },
    skip: !isOpen || !workItemId
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
              { source: { id: workItemId } },
              { target: { id: workItemId } }
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
        `Disconnected all ${nodeConnections.length} connection${nodeConnections.length !== 1 ? 's' : ''} from "${workItemTitle}".`
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
          where: { id: workItemId }
        }
      });
      

      showSuccess(
        'Work Item Deleted Successfully!',
        `"${workItemTitle}" has been permanently removed from the graph and all connected relationships have been cleaned up.`
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
        'Failed to Delete Work Item',
        errorMessage
      );
    }
  };


  if (!isOpen) return null;

  return (
    <>
      {/* Inject custom styles */}
      <style>{customStyles}</style>
      
      <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Enhanced Backdrop with gradient */}
        <div
          className="fixed inset-0 z-0 transition-opacity bg-gradient-to-br from-red-900/90 via-black/80 to-gray-900/90 animate-in fade-in duration-300"
          onClick={onClose}
        />

        <div
          className="inline-block align-bottom bg-gradient-to-br from-gray-800/98 via-gray-850/98 to-gray-900/98 backdrop-blur-2xl rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-red-600/30 animate-in slide-in-from-bottom-4 duration-300 relative z-10 focus-within:ring-2 focus-within:ring-red-500/50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient accent line at top - red for danger */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 via-pink-500 to-red-600"></div>

          {/* Modern header with glow */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/30 bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm relative">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 via-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/30 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-orange-600 rounded-lg blur opacity-50 animate-pulse"></div>
                <AlertTriangle className="h-4 w-4 text-white relative z-10" />
              </div>
              <div>
                <h3 className="text-base font-bold bg-gradient-to-r from-white via-red-100 to-orange-100 bg-clip-text text-transparent">
                  Delete Work Item
                </h3>
                <p className="text-[10px] text-gray-400">Permanent removal</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-200 hover:scale-110"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Enhanced loading state */}
          {loadingEdges && (
            <div className="p-6">
              <div className="flex flex-col items-center justify-center space-y-2.5">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-lg"></div>
                  <div className="relative w-8 h-8 border-4 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-gray-200 font-medium text-xs">Analyzing Connections</p>
                  <p className="text-gray-400 text-[10px]">Scanning relationships...</p>
                </div>
              </div>
            </div>
          )}

          {/* Connections blocking screen - same pattern as DeleteGraphModal */}
          {!loadingEdges && hasConnections && (
            <div className="p-4">
              <div className="mb-3">
                {/* Modern icon with gradient background */}
                <div className="relative flex items-center justify-center w-14 h-14 mx-auto mb-3">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-full blur-lg"></div>
                  <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-orange-400/10 to-amber-400/10 border border-orange-400/30 rounded-full backdrop-blur-sm">
                    <GitBranch className="h-6 w-6 text-orange-400 drop-shadow-lg" />
                  </div>
                </div>

                {/* Modern typography */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold bg-gradient-to-r from-orange-200 to-amber-200 bg-clip-text text-transparent text-center">
                    Connected Work Item Detected
                  </h4>
                  <p className="text-gray-300 text-center text-xs leading-relaxed max-w-md mx-auto">
                    This work item has <span className="inline-flex items-center px-1.5 py-0.5 bg-orange-500/20 border border-orange-400/30 rounded-full text-orange-200 font-semibold text-[10px]">{nodeConnections.length} active connection{nodeConnections.length !== 1 ? 's' : ''}</span>
                  </p>
                  <p className="text-gray-400 text-center text-[10px]">
                    Remove all connections first to enable deletion
                  </p>
                </div>
              </div>

              {/* Inline disconnect actions - matching DeleteGraphModal pattern */}
              <div className="bg-orange-900/20 border border-orange-600/30 rounded-lg p-3.5 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 mr-2.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-orange-200 font-semibold mb-2 text-sm">Disconnect Connections First</h4>
                    <p className="text-orange-300 text-xs mb-3">
                      This work item has <strong className="text-orange-200">{nodeConnections.length} connection{nodeConnections.length !== 1 ? 's' : ''}</strong>. Remove them to enable deletion:
                    </p>
                    
                    {/* Disconnect All Button */}
                    <div className="mb-3">
                      <button
                        onClick={handleDisconnectAllConnections}
                        disabled={deletingConnection}
                        className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-1.5 font-medium disabled:cursor-not-allowed text-sm"
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>{deletingConnection ? 'Disconnecting...' : 'Disconnect All Connections'}</span>
                      </button>
                    </div>

                    {/* Individual connections with disconnect buttons */}
                    <div className="space-y-2">
                      {nodeConnections.map((edge: any, index: number) => (
                        <div key={edge.id} className="flex items-center justify-between p-2.5 bg-gray-700/50 border border-gray-600/30 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                            <div>
                              <span className="text-gray-300 text-xs">
                                {edge.source.id === workItemId ? 'connects to' : 'connected from'} "{edge.source.id === workItemId ? edge.target.title : edge.source.title}"
                              </span>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-400/30 rounded-full text-[10px] font-semibold text-orange-200">
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
                            className="px-2 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded text-[10px] flex items-center space-x-1 disabled:cursor-not-allowed"
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
                  className="px-4 py-2 bg-gray-700/50 hover:bg-red-600 hover:text-white border border-gray-600/30 hover:border-red-600 text-gray-200 font-medium rounded-lg transition-all duration-200 backdrop-blur-sm text-xs hover:scale-105"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Enhanced Warning and Risk Acknowledgment */}
          {!loadingEdges && !hasConnections && (
            <div className="p-4">
              <div className="mb-3">
                {/* Modern danger icon with glow effect */}
                <div className="relative flex items-center justify-center w-14 h-14 mx-auto mb-3">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 to-orange-500/30 rounded-full blur-lg animate-pulse"></div>
                  <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-400/40 rounded-full backdrop-blur-sm">
                    <Shield className="h-6 w-6 text-red-400 drop-shadow-lg" />
                  </div>
                </div>

                {/* Professional typography */}
                <div className="text-center space-y-1.5 mb-3">
                  <h4 className="text-sm font-semibold text-red-200">
                    Delete Work Item Permanently
                  </h4>
                  <p className="text-xs text-gray-300">
                    You are about to permanently delete <span className="font-semibold text-red-200">"{workItemTitle}"</span>
                  </p>
                  <p className="text-red-300 text-[10px] bg-red-900/20 border border-red-600/30 rounded px-2 py-1 mx-auto inline-block">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              {/* Enhanced Node Info Card */}
              <div className="relative bg-gradient-to-r from-gray-800/80 to-gray-700/60 border border-gray-600/50 rounded-lg p-3 mb-3 backdrop-blur-sm">
                <div className="absolute top-2 right-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-red-500/20 border border-red-400/30 rounded flex items-center justify-center">
                      <AlertTriangle className="h-3 w-3 text-red-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-400">Target Work Item</p>
                      <p className="text-sm font-bold text-white">{workItemTitle}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-blue-200">
                    {workItemType}
                  </span>
                </div>
              </div>

              {/* Enhanced Risk Warning */}
              <div className="relative bg-gradient-to-r from-red-900/30 via-red-800/20 to-orange-900/20 border border-red-500/30 rounded-lg p-3 mb-3 backdrop-blur-sm">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-7 h-7 bg-red-500/20 border border-red-400/40 rounded flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-red-200 mb-1.5">Data Loss Warning</h4>
                    <p className="text-red-300 text-[10px] leading-relaxed">
                      This will permanently destroy all work item data, connections, activity history, assignments, and dependencies.
                    </p>
                  </div>
                </div>
              </div>

              {/* Enhanced Security Confirmations */}
              <div className="bg-gray-800/50 border border-gray-600/50 rounded-lg p-3 mb-3 backdrop-blur-sm">
                <h5 className="text-xs font-bold text-gray-200 mb-2 flex items-center">
                  <CheckCircle className="h-3.5 w-3.5 text-green-400 mr-1.5" />
                  Confirmations Required
                </h5>

                <div className="space-y-2">
                  <label className="group flex items-start space-x-2 cursor-pointer p-1.5 rounded hover:bg-gray-700/30 transition-colors select-text">
                    <input
                      type="checkbox"
                      checked={understandRisks}
                      onChange={(e) => setUnderstandRisks(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 text-red-600 focus:ring-red-500 focus:ring-offset-0 border-gray-500 rounded bg-gray-700/80 transition-colors pointer-events-auto"
                    />
                    <span className="text-gray-200 font-medium text-[10px] leading-relaxed">
                      I understand this action is irreversible and all data will be destroyed
                    </span>
                  </label>

                  <label className="group flex items-start space-x-2 cursor-pointer p-1.5 rounded hover:bg-gray-700/30 transition-colors select-text">
                    <input
                      type="checkbox"
                      checked={confirmDeletion}
                      onChange={(e) => setConfirmDeletion(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 text-red-600 focus:ring-red-500 focus:ring-offset-0 border-gray-500 rounded bg-gray-700/80 transition-colors pointer-events-auto"
                    />
                    <span className="text-gray-200 font-medium text-[10px] leading-relaxed">
                      I confirm deletion of "<span className="text-red-300 font-semibold">{workItemTitle}</span>"
                    </span>
                  </label>
                </div>
              </div>

              {/* Enhanced Actions */}
              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 bg-gray-700/50 hover:bg-red-600 hover:text-white border border-gray-600/30 hover:border-red-600 font-medium rounded-lg transition-all duration-200 backdrop-blur-sm text-xs hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!understandRisks || !confirmDeletion || deletingNode}
                  className="group relative px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 hover:shadow-lg hover:shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 text-xs"
                >
                  {deletingNode ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Forever</span>
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