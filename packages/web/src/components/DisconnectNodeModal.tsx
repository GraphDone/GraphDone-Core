import { useState, useEffect, useRef } from 'react';
import { X, Unlink, ArrowRight, Trash2 } from 'lucide-react';
import { CheckCircle, AlertTriangle } from '../constants/workItemConstants';
import { useQuery, useMutation } from '@apollo/client';
import { GET_WORK_ITEMS, GET_EDGES, DELETE_EDGE } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  WorkItem, 
  Edge
} from '../lib/connectionUtils';
import { 
  RELATIONSHIP_OPTIONS,
  getRelationshipConfig,
  getRelationshipIconElement,
  RelationshipType
} from '../constants/workItemConstants';

interface DisconnectNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: {
    id: string;
    title: string;
    type: string;
  };
}

export function DisconnectNodeModal({ isOpen, onClose, sourceNode }: DisconnectNodeModalProps) {
  const { currentGraph } = useGraph();
  const { showSuccess, showError } = useNotifications();
  
  // Container ref for stable layout
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [showDisconnectConfirmation, setShowDisconnectConfirmation] = useState(false);

  // Query existing edges for the source node
  const { data: edgesData, loading: loadingEdges } = useQuery(GET_EDGES, {
    variables: {
      where: {
        OR: [
          { source: { id: sourceNode.id } },
          { target: { id: sourceNode.id } }
        ]
      }
    },
    skip: !isOpen
  });

  // Fetch work items for context
  const { data: workItemsData, loading: loadingNodes } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph?.id ? {
      where: {
        graph: { id: currentGraph.id }
      }
    } : {},
    skip: !isOpen || !currentGraph?.id
  });

  const [deleteEdgeMutation, { loading: deletingConnection }] = useMutation(DELETE_EDGE, {
    refetchQueries: [
      { 
        query: GET_EDGES,
        variables: {
          where: {
            OR: [
              { source: { id: sourceNode.id } },
              { target: { id: sourceNode.id } }
            ]
          }
        }
      },
      { 
        query: GET_EDGES,
        variables: {}
      },
      { 
        query: GET_WORK_ITEMS, 
        variables: currentGraph?.id ? {
          where: {
            graph: { id: currentGraph.id }
          }
        } : {}
      }
    ],
    awaitRefetchQueries: true
  });

  // Initialize data arrays
  const workItems: WorkItem[] = workItemsData?.workItems || [];
  const existingEdges: Edge[] = edgesData?.edges || [];

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedConnections(new Set());
    }
  }, [isOpen]);

  // No dynamic width measurement needed - using fixed layouts

  if (!isOpen) return null;

  const toggleConnectionSelection = (connectionId: string) => {
    setSelectedConnections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(connectionId)) {
        newSet.delete(connectionId);
      } else {
        newSet.add(connectionId);
      }
      return newSet;
    });
  };

  const handleDisconnectClick = () => {
    if (selectedConnections.size === 0) return;
    setShowDisconnectConfirmation(true);
  };

  const handleConfirmDisconnect = async (): Promise<void> => {
    if (selectedConnections.size === 0) return;

    try {
      // Get the selected connection details for better notifications
      const selectedConnectionDetails = Array.from(selectedConnections).map(connectionId => {
        const connection = existingEdges.find(edge => edge.id === connectionId);
        if (connection) {
          const relationshipType = getRelationshipConfig(connection.type as RelationshipType);
          return {
            id: connectionId,
            source: connection.source.title,
            target: connection.target.title,
            type: relationshipType?.label || connection.type
          };
        }
        return null;
      }).filter(Boolean);

      const disconnectPromises = Array.from(selectedConnections).map(async (connectionId) => {
        if (!connectionId.startsWith('workitem-')) {
          return deleteEdgeMutation({
            variables: {
              where: { id: connectionId }
            }
          });
        }
        return null;
      });

      await Promise.all(disconnectPromises.filter(Boolean));

      // Create detailed success message
      const connectionsList = selectedConnectionDetails.slice(0, 3).map(conn => 
        `${conn?.source} → ${conn?.target} (${conn?.type})`
      ).join(', ');
      
      const moreCount = selectedConnectionDetails.length - 3;
      const detailedMessage = selectedConnectionDetails.length <= 3 
        ? connectionsList
        : `${connectionsList}${moreCount > 0 ? ` and ${moreCount} more` : ''}`;

      showSuccess(
        'Connections Removed Successfully!',
        `Removed ${selectedConnections.size} connection${selectedConnections.size !== 1 ? 's' : ''} from "${sourceNode.title}": ${detailedMessage}`
      );

      setSelectedConnections(new Set());
      setShowDisconnectConfirmation(false);
      onClose();
    } catch (error: any) {
      console.error('Failed to remove connections:', error);
      showError(
        'Failed to Remove Connections',
        error.message || 'An unexpected error occurred while removing connections. Please try again.'
      );
      setShowDisconnectConfirmation(false);
    }
  };

  // Get all disconnectable connections (Edge entities only) - deduplicated by edge ID
  const connectionMap = new Map<string, {id: string, type: string, connectedNode: {id: string, title: string, type: string}, direction: 'outgoing' | 'incoming'}>();
  
  existingEdges.forEach(edge => {
    // Skip if we've already processed this edge ID
    if (connectionMap.has(edge.id)) return;
    
    if (edge.source.id === sourceNode.id) {
      connectionMap.set(edge.id, {
        id: edge.id,
        type: edge.type,
        connectedNode: { id: edge.target.id, title: edge.target.title, type: 'unknown' },
        direction: 'outgoing'
      });
    } else if (edge.target.id === sourceNode.id) {
      connectionMap.set(edge.id, {
        id: edge.id,
        type: edge.type,
        connectedNode: { id: edge.source.id, title: edge.source.title, type: 'unknown' },
        direction: 'incoming'
      });
    }
  });

  const allConnections = Array.from(connectionMap.values());
  const disconnectableConnections = allConnections.filter(conn => !conn.id.startsWith('workitem-'));

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gradient-to-br from-red-900/40 via-gray-900/60 to-red-900/40 transition-all duration-300" onClick={onClose} />

        <div className="relative inline-block align-bottom bg-gradient-to-br from-gray-800 via-gray-800 to-red-900/20 rounded-2xl text-left overflow-hidden shadow-2xl border border-red-700/50 transform transition-all duration-300 hover:shadow-red-500/10 sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full z-[10000]">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-900/30 via-orange-800/25 to-red-900/30 px-6 py-5 border-b border-red-600/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 rounded-xl bg-red-500/20 border border-red-400/30">
                  <Unlink className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-red-200 to-orange-100 bg-clip-text text-transparent">
                    Disconnect Node
                  </h3>
                  <p className="text-sm text-gray-300 mt-1">
                    Remove connections from "{sourceNode.title}"
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {disconnectableConnections.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                  <Unlink className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-300 mb-2">No Connections to Disconnect</h4>
                  <div className="space-y-2 text-sm">
                    <p>This node has no disconnectable connections.</p>
                    <p className="text-amber-300 text-xs mt-2">
                      💡 Tip: Only Edge entities can be disconnected. WorkItem relationships are read-only.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 rounded-lg bg-red-500/20 border border-red-400/30">
                    <Unlink className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-100">Existing Connections</h4>
                    <p className="text-xs text-gray-400">Select connections to remove</p>
                  </div>
                </div>

                {/* Selection Summary */}
                <div className="mb-6 p-4 bg-gray-800/30 rounded-xl border border-gray-600/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-red-400 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-300">
                          {disconnectableConnections.length} connection{disconnectableConnections.length !== 1 ? 's' : ''} available
                        </span>
                      </div>
                      <div className="h-4 w-px bg-gray-600"></div>
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-orange-400 rounded-full"></div>
                        <span className="text-sm font-medium text-orange-300">{selectedConnections.size} selected</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connections List */}
                <div className="max-h-96 overflow-y-auto space-y-3 pr-2 mb-6">
                  {disconnectableConnections.map((connection) => {
                    const relationshipType = getRelationshipConfig(connection.type as RelationshipType);
                    const isSelected = selectedConnections.has(connection.id);
                    
                    return (
                      <button
                        key={connection.id}
                        onClick={() => toggleConnectionSelection(connection.id)}
                        className={`w-full p-4 rounded-xl text-left transition-all duration-200 border group cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-red-600/20 to-orange-700/15 border-red-400/60 shadow-lg shadow-red-500/10'
                            : 'bg-gradient-to-r from-gray-700/20 to-gray-800/25 border-gray-600/30 hover:from-gray-600/30 hover:to-gray-700/35 hover:border-gray-500/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-4">
                            {/* Connection Display */}
                            <div className="flex items-center space-x-2 text-sm w-full">
                                <div className="flex items-center px-2 py-1 bg-gray-600/40 rounded-md min-w-0 flex-shrink">
                                  <span className="text-white font-semibold text-xs truncate" title={sourceNode.title}>
                                    {sourceNode.title}
                                  </span>
                                </div>
                                
                                <ArrowRight className={`h-3 w-3 flex-shrink-0 ${relationshipType?.color || 'text-gray-400'}`} />
                                
                                <div className="flex items-center space-x-1 px-2 py-1 rounded bg-gray-600/40 min-w-0">
                                  {relationshipType ? 
                                    getRelationshipIconElement(relationshipType.type, `h-2.5 w-2.5 flex-shrink-0`) :
                                    getRelationshipIconElement('RELATES_TO', 'h-2.5 w-2.5 flex-shrink-0 text-gray-400')
                                  }
                                  <span className={`text-xs font-medium whitespace-nowrap ${relationshipType?.color || 'text-gray-400'}`} title={relationshipType?.label || connection.type}>
                                    {relationshipType?.label || connection.type}
                                  </span>
                                </div>
                                
                                <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-400" />
                                
                                <div className="flex items-center px-2 py-1 bg-gray-600/40 rounded-md min-w-0 flex-shrink">
                                  <span className="text-gray-200 font-medium text-xs truncate" title={connection.connectedNode.title}>
                                    {connection.connectedNode.title}
                                  </span>
                                </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            {isSelected && (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 border border-red-400/50">
                                <CheckCircle className="h-4 w-4 text-red-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-600/50">
                  <button
                    onClick={onClose}
                    className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/50 to-gray-800/50 border border-gray-600/50 rounded-xl hover:from-gray-600/60 hover:to-gray-700/60 hover:border-gray-500/60 transition-all duration-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisconnectClick}
                    disabled={selectedConnections.size === 0 || deletingConnection}
                    className="px-8 py-3 bg-gradient-to-r from-red-600 to-orange-700 hover:from-red-500 hover:to-orange-600 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 font-semibold shadow-lg shadow-red-500/20 disabled:shadow-none"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>
                      {deletingConnection ? 'Disconnecting...' : 
                       selectedConnections.size === 0 ? 'Select connections to disconnect' :
                       `Disconnect ${selectedConnections.size} Connection${selectedConnections.size !== 1 ? 's' : ''}`}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirmation && (
        <div className="fixed inset-0 z-[10001] overflow-y-auto backdrop-blur-sm">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gradient-to-br from-red-900/40 via-gray-900/60 to-red-900/40 transition-all duration-300" onClick={() => setShowDisconnectConfirmation(false)} />

            <div className="relative inline-block align-bottom bg-gradient-to-br from-gray-800 via-gray-800 to-red-900/20 rounded-2xl text-left overflow-hidden shadow-2xl border border-red-700/50 transform transition-all duration-300 sm:my-8 sm:align-middle sm:max-w-md sm:w-full z-[10002]">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-900/30 via-orange-800/25 to-red-900/30 px-6 py-4 border-b border-red-600/20">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-red-500/20 border border-red-400/30">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-red-200">Confirm Disconnect</h3>
                    <p className="text-sm text-gray-300 mt-1">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="mb-6">
                  <p className="text-gray-200 mb-4">
                    Are you sure you want to remove {selectedConnections.size} connection{selectedConnections.size !== 1 ? 's' : ''} from <span className="font-semibold text-white">"{sourceNode.title}"</span>?
                  </p>
                  
                  {selectedConnections.size <= 3 && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600/30">
                      <p className="text-xs text-gray-400 mb-2">Connections to be removed:</p>
                      <div className="space-y-1">
                        {Array.from(selectedConnections).map(connectionId => {
                          const connection = existingEdges.find(edge => edge.id === connectionId);
                          if (!connection) return null;
                          const relationshipType = getRelationshipConfig(connection.type as RelationshipType);
                          return (
                            <div key={connectionId} className="flex items-center space-x-2 text-xs">
                              <div className="h-1 w-1 bg-red-400 rounded-full"></div>
                              <span className="text-gray-300">
                                {connection.source.title} → {connection.target.title} ({relationshipType?.label || connection.type})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDisconnectConfirmation(false)}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDisconnect}
                    disabled={deletingConnection}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{deletingConnection ? 'Removing...' : 'Remove Connections'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}