import { useState, useEffect, useRef } from 'react';
import { X, Link2, Search, CheckCircle, ArrowRight, ExternalLink, Filter, CheckCircle2, Trash2, Unlink, ChevronDown } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_WORK_ITEMS, CREATE_EDGE, GET_EDGES, DELETE_EDGE } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  WorkItem, 
  Edge, 
  getExistingRelationships,
  hasAnyRelationship,
  filterValidSelectedNodes,
  validateNewConnection,
  detectDuplicateConnections,
  getCleanupRecommendations
} from '../lib/connectionUtils';
import { 
  RELATIONSHIP_OPTIONS,
  getRelationshipConfig,
  getRelationshipIconElement,
  getRelationshipArrow,
  getRelationshipDescription,
  RelationshipType
} from '../constants/workItemConstants';
import {
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  getTypeIconElement,
  getStatusIconElement,
  getPriorityIconElement,
  getTypeColorScheme,
  getStatusColorScheme,
  getPriorityColorScheme,
  AlertTriangle,
  Target
} from '../constants/workItemConstants';

interface ConnectNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: {
    id: string;
    title: string;
    type: string;
  };
  initialTab?: 'connect' | 'disconnect';
  onAllConnectionsRemoved?: () => void;
}

// Separate DisconnectNodeModal interface
interface DisconnectNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: {
    id: string;
    title: string;
    type: string;
  };
  onAllConnectionsRemoved?: () => void;
}



// Separate DisconnectNodeModal Component
export function DisconnectNodeModal({ isOpen, onClose, sourceNode, onAllConnectionsRemoved }: DisconnectNodeModalProps) {
  const { currentGraph } = useGraph();
  const { showSuccess, showError } = useNotifications();
  
  // Dynamic width measurement for smart truncation
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(480);
  
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [showDisconnectConfirmation, setShowDisconnectConfirmation] = useState(false);

  // Query existing edges for the source node
  const { data: edgesData, loading: loadingEdges, refetch: refetchEdges } = useQuery(GET_EDGES, {
    variables: {
      where: {
        OR: [
          { source: { id: sourceNode.id } },
          { target: { id: sourceNode.id } }
        ]
      }
    },
    skip: !isOpen,
    pollInterval: 1000, // Poll every second for real-time updates
    fetchPolicy: 'cache-and-network' // Always check for updates
  });

  // Fetch work items for context
  const { data: workItemsData } = useQuery(GET_WORK_ITEMS, {
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

  // Reset state and sync relationship type when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedConnections(new Set());
      
      // Wait a bit for data to load, then sync
      const syncTimeout = setTimeout(() => {
        // Logic for syncing relationship type was removed
      }, 100);
      
      return () => clearTimeout(syncTimeout);
    }
    return undefined;
  }, [isOpen]);

  // Dynamic width measurement with ResizeObserver
  useEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerWidth(Math.floor(rect.width - 32)); // Subtract padding
      }
    };

    // Initial measurement
    if (isOpen) {
      setTimeout(measureContainer, 100);
    }

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(measureContainer);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isOpen]);

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

      // Graceful disconnect with progress feedback
      const totalConnections = Array.from(selectedConnections).filter(id => !id.startsWith('workitem-'));
      let completedCount = 0;

      const disconnectPromises = Array.from(selectedConnections).map(async (connectionId) => {
        if (!connectionId.startsWith('workitem-')) {
          try {
            const result = await deleteEdgeMutation({
              variables: {
                where: { id: connectionId }
              }
            });
            completedCount++;
            
            // Show graceful progress for multiple connections
            if (totalConnections.length > 1) {
              const connection = selectedConnectionDetails.find(c => c?.id === connectionId);
              if (connection) {
                showSuccess(
                  `Connection Removed (${completedCount}/${totalConnections.length})`,
                  `${connection.source} → ${connection.target}`
                );
              }
            }
            
            return result;
          } catch (error) {
            const connection = selectedConnectionDetails.find(c => c?.id === connectionId);
            showError(
              'Connection Removal Failed',
              connection ? `Failed to remove: ${connection.source} → ${connection.target}` : 'Failed to remove connection'
            );
            throw error;
          }
        }
        return null;
      });

      await Promise.all(disconnectPromises.filter(Boolean));

      // Final graceful success message (only for single or final summary)
      if (totalConnections.length === 1) {
        const connection = selectedConnectionDetails[0];
        showSuccess(
          '✨ Connection Gracefully Removed',
          `"${connection?.source}" is no longer connected to "${connection?.target}" via ${connection?.type}`
        );
      } else if (totalConnections.length > 1) {
        showSuccess(
          `🎉 All ${totalConnections.length} Connections Removed Successfully`,
          `"${sourceNode.title}" has been gracefully disconnected from ${totalConnections.length} nodes`
        );
      }

      // Graceful UI cleanup with delay for visual feedback
      setTimeout(() => {
        setSelectedConnections(new Set());
        setShowDisconnectConfirmation(false);
        
        // Check if all connections are now removed
        // Since the query will refetch, we need to wait a moment for the data to update
        setTimeout(async () => {
          // Wait for GraphQL refetch to complete
          try {
            const { data: updatedEdgesData } = await refetchEdges();
            const updatedConnections = updatedEdgesData?.edges || [];
            const updatedDisconnectable = updatedConnections.filter((conn: any) => !conn.id.startsWith('workitem-'));
            
            if (updatedDisconnectable.length === 0 && onAllConnectionsRemoved) {
              // All connections removed - trigger callback to return to delete modal
              onAllConnectionsRemoved();
            } else {
              // Still have connections - close modal normally
              onClose();
            }
          } catch (error) {
            // If refetch fails, just close normally
            onClose();
          }
        }, 200);
      }, 300);

    } catch (error: any) {
      showError(
        '❌ Disconnect Operation Failed',
        error.message || 'Some connections could not be removed. Please try again or check your network connection.'
      );
      setShowDisconnectConfirmation(false);
    }
  };

  // Get all disconnectable connections (Edge entities only)
  const allConnections: Array<{id: string, type: string, connectedNode: {id: string, title: string, type: string}, direction: 'outgoing' | 'incoming'}> = [];
  
  existingEdges.forEach(edge => {
    if (edge.source.id === sourceNode.id) {
      allConnections.push({
        id: edge.id,
        type: edge.type,
        connectedNode: { id: edge.target.id, title: edge.target.title, type: 'unknown' },
        direction: 'outgoing'
      });
    } else if (edge.target.id === sourceNode.id) {
      allConnections.push({
        id: edge.id,
        type: edge.type,
        connectedNode: { id: edge.source.id, title: edge.source.title, type: 'unknown' },
        direction: 'incoming'
      });
    }
  });

  const disconnectableConnections = allConnections.filter(conn => !conn.id.startsWith('workitem-'));

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gradient-to-br from-red-900/40 via-gray-900/60 to-red-900/40 transition-all duration-300" onClick={onClose} />

        <div className="relative inline-block align-bottom bg-gradient-to-br from-gray-800 via-gray-800 to-red-900/20 rounded-2xl text-left overflow-hidden shadow-2xl border border-red-700/50 transform transition-all duration-300 hover:shadow-red-500/10 sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full z-[10000]" onClick={(e) => e.stopPropagation()}>
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
                          <div className="flex-1 min-w-0 pr-4">
                            {/* Dynamic Connection Display - Smart Adaptive Truncation */}
                            <div ref={containerRef} className="flex items-center space-x-2 text-sm w-full overflow-hidden whitespace-nowrap">
                              {(() => {
                                const relationshipLabel = relationshipType?.label || connection.type;
                                const sourceTitle = sourceNode.title;
                                const targetTitle = connection.connectedNode.title;
                                
                                // EXTREME SPACE UTILIZATION - Use 99.5% of available width
                                const actualBoxWidth = containerWidth;
                                const charWidth = 5.2; // Ultra-tight character packing
                                const fixedElements = 24; // Absolute minimum - just 2 arrows + 8px spacing
                                const relationshipMinWidth = 40; // Absolute minimum for relationship
                                
                                // Calculate relationship width - give it absolute minimal space
                                const relationshipWidth = Math.max(
                                  relationshipMinWidth,
                                  Math.min(relationshipLabel.length * charWidth + 16, actualBoxWidth * 0.12) // Only 12% max for relationship
                                );
                                
                                // Available space for titles - use everything possible
                                const availableForTitles = actualBoxWidth - fixedElements - relationshipWidth;
                                
                                // EXTREME SPACE DISTRIBUTION: Maximize every pixel
                                const totalTitleLength = sourceTitle.length + targetTitle.length;
                                const sourceRatio = totalTitleLength > 0 ? sourceTitle.length / totalTitleLength : 0.5;
                                const targetRatio = 1 - sourceRatio;
                                
                                // Distribute space - use every available pixel
                                let sourceMaxWidth = Math.floor(availableForTitles * sourceRatio);
                                let targetMaxWidth = Math.floor(availableForTitles * targetRatio);
                                
                                // Ensure minimum widths - but prioritize space usage
                                const minWidth = 50; // Reduced minimum to maximize space
                                if (sourceMaxWidth < minWidth) {
                                  const deficit = minWidth - sourceMaxWidth;
                                  sourceMaxWidth = minWidth;
                                  targetMaxWidth = Math.max(minWidth, targetMaxWidth - deficit);
                                }
                                if (targetMaxWidth < minWidth) {
                                  const deficit = minWidth - targetMaxWidth;
                                  targetMaxWidth = minWidth;
                                  sourceMaxWidth = Math.max(minWidth, sourceMaxWidth - deficit);
                                }
                                
                                // Add any remaining space back to the titles
                                const usedSpace = sourceMaxWidth + targetMaxWidth + relationshipWidth + fixedElements;
                                const remainingSpace = actualBoxWidth - usedSpace;
                                if (remainingSpace > 10) {
                                  // Distribute remaining space proportionally
                                  const extraSource = Math.floor(remainingSpace * sourceRatio);
                                  const extraTarget = remainingSpace - extraSource;
                                  sourceMaxWidth += extraSource;
                                  targetMaxWidth += extraTarget;
                                }
                                
                                // Convert to character limits - ultra-aggressive
                                const sourceMaxChars = Math.floor(sourceMaxWidth / charWidth);
                                const targetMaxChars = Math.floor(targetMaxWidth / charWidth);
                                
                                // Smart truncation function
                                const smartTruncate = (title: string, maxChars: number) => {
                                  if (title.length <= maxChars) return title;
                                  // Try to break at word boundaries
                                  const truncated = title.substring(0, maxChars - 1);
                                  const lastSpace = truncated.lastIndexOf(' ');
                                  if (lastSpace > maxChars * 0.7) { // If we can save 30% or more, break at word
                                    return truncated.substring(0, lastSpace) + '…';
                                  }
                                  return truncated + '…';
                                };
                                
                                // Show full relationship label
                                const truncatedRelationship = relationshipLabel;
                                
                                return (
                                  <>
                                    {/* Source - Dynamic width based on content */}
                                    <div className="flex items-center px-2 py-1 bg-gray-600/40 rounded-md flex-shrink-0" style={{ width: `${sourceMaxWidth}px`, minWidth: '60px' }}>
                                      <span className="text-white font-semibold text-xs truncate" title={sourceTitle}>
                                        {smartTruncate(sourceTitle, sourceMaxChars)}
                                      </span>
                                    </div>
                                    
                                    {/* Relationship - Adaptive display: symbol when tight, label when space allows */}
                                    <div className="flex items-center space-x-1 px-2 py-1 rounded bg-gray-600/40 flex-shrink-0" style={{ width: `${relationshipWidth}px` }} title={getRelationshipDescription(sourceTitle, targetTitle, relationshipType?.type || 'RELATES_TO')}>
                                      {relationshipType ? 
                                        getRelationshipIconElement(relationshipType.type, `h-2.5 w-2.5`) :
                                        getRelationshipIconElement('RELATES_TO', 'h-2.5 w-2.5 text-gray-400')
                                      }
                                      <span className={`text-xs font-medium ${relationshipType?.color || 'text-gray-400'} truncate`}>
                                        {getRelationshipConfig(relationshipType?.type || 'RELATES_TO').label}
                                      </span>
                                    </div>

                                    {/* Target - Dynamic width based on content */}
                                    <div className="flex items-center px-2 py-1 bg-gray-600/40 rounded-md flex-shrink-0" style={{ width: `${targetMaxWidth}px`, minWidth: '60px' }}>
                                      <span className="text-gray-200 font-medium text-xs truncate" title={targetTitle}>
                                        {smartTruncate(targetTitle, targetMaxChars)}
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
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

            <div className="relative inline-block align-bottom bg-gradient-to-br from-gray-800 via-gray-800 to-red-900/20 rounded-2xl text-left overflow-hidden shadow-2xl border border-red-700/50 transform transition-all duration-300 sm:my-8 sm:align-middle sm:max-w-md sm:w-full z-[10002]" onClick={(e) => e.stopPropagation()}>
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

export function ConnectNodeModal({ isOpen, onClose, sourceNode, initialTab = 'connect', onAllConnectionsRemoved: _onAllConnectionsRemoved }: ConnectNodeModalProps) {
  const { currentTeam } = useAuth();
  const { currentGraph } = useGraph();
  const { showSuccess, showError } = useNotifications();
  
  // Refs for dynamic width measurement
  const connectContainerRef = useRef<HTMLDivElement>(null);
  const disconnectContainerRef = useRef<HTMLDivElement>(null);
  const [connectContainerWidth, setConnectContainerWidth] = useState(600);
  
  const [activeTab, setActiveTab] = useState<'connect' | 'disconnect'>(initialTab);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [selectedRelationType, setSelectedRelationType] = useState('DEFAULT_EDGE');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [relationshipFilter, setRelationshipFilter] = useState<string[]>(RELATIONSHIP_OPTIONS.map(r => r.type));
  
  // Debug: Log available relationship options
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Custom dropdown states
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
  
  // Refs for dropdown management
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  
  // Use centralized options with JSX elements for dropdowns
  const statusOptions = STATUS_OPTIONS.map(option => ({
    ...option,
    icon: option.icon ? <option.icon className="h-4 w-4" /> : null
  }));
  
  const typeOptions = TYPE_OPTIONS.map(option => ({
    ...option,
    icon: option.icon ? <option.icon className="h-4 w-4" /> : null
  }));
  
  const priorityOptions = PRIORITY_OPTIONS.map(option => ({
    ...option,
    icon: option.icon ? <option.icon className="h-4 w-4" /> : null
  }));
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isValid: boolean;
    reason?: string;
    suggestion?: string;
  } | null>(null);
  const [showDisconnectConfirmation, setShowDisconnectConfirmation] = useState(false);

  // Fetch nodes only from the current graph
  const { data: workItemsData, loading: loadingNodes, error: queryError } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph?.id ? {
      where: {
        graph: { id: currentGraph.id }
      }
    } : {},
    skip: !isOpen || !currentGraph?.id
  });

  // Query existing edges for the source node
  const { data: edgesData, loading: loadingEdges, refetch: refetchEdges } = useQuery(GET_EDGES, {
    variables: {
      where: {
        OR: [
          { source: { id: sourceNode.id } },
          { target: { id: sourceNode.id } }
        ]
      }
    },
    skip: !isOpen,
    pollInterval: 1000, // Poll every second for real-time updates
    fetchPolicy: 'cache-and-network' // Always check for updates
  });


  const [createEdgeMutation, { loading: creatingConnection }] = useMutation(CREATE_EDGE, {
    refetchQueries: [
      // Refetch edges for the source node
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
      // Refetch all edges for graph visualization
      { 
        query: GET_EDGES,
        variables: {}
      },
      // Refetch work items for current graph
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

  const [deleteEdgeMutation, { loading: deletingConnection }] = useMutation(DELETE_EDGE, {
    refetchQueries: [
      // Refetch edges for the source node
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
      // Refetch all edges for graph visualization
      { 
        query: GET_EDGES,
        variables: {}
      },
      // Refetch work items for current graph
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

  // Reset state when modal opens/closes - but only on initial open, not every render
  useEffect(() => {
    if (isOpen) {
      // Only reset activeTab when modal first opens, not when sourceNode changes
      setSelectedNodes(new Set());
      setSelectedConnections(new Set());
      setSearchTerm('');
      setStatusFilter('all');
      setTypeFilter('all');
      setRelationshipFilter(RELATIONSHIP_OPTIONS.map(r => r.type));
      setIsFilterOpen(false);
    } else {
      // Reset to initial tab when modal closes
      setActiveTab(initialTab);
    }
  }, [isOpen]); // Only depend on isOpen to avoid unnecessary resets

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isFilterOpen && !(event.target as Element)?.closest('.relative')) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setIsPriorityDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dynamic width measurement with ResizeObserver
  useEffect(() => {
    const measureConnectContainer = () => {
      if (connectContainerRef.current) {
        const rect = connectContainerRef.current.getBoundingClientRect();
        setConnectContainerWidth(Math.floor(rect.width - 32)); // Subtract padding
      }
    };

    const measureDisconnectContainer = () => {
      if (disconnectContainerRef.current) {
        const rect = disconnectContainerRef.current.getBoundingClientRect();
        // Width measurement removed (was unused)
      }
    };

    // Initial measurement
    if (isOpen) {
      setTimeout(() => {
        measureConnectContainer();
        measureDisconnectContainer();
      }, 100); // Small delay to ensure DOM is rendered
    }

    // Set up ResizeObserver for continuous monitoring
    const resizeObserver = new ResizeObserver(() => {
      measureConnectContainer();
      measureDisconnectContainer();
    });

    if (connectContainerRef.current) {
      resizeObserver.observe(connectContainerRef.current);
    }
    if (disconnectContainerRef.current) {
      resizeObserver.observe(disconnectContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isOpen]);

  // Auto-deselect nodes that already have the selected relationship
  useEffect(() => {
    if (isOpen && selectedNodes.size > 0 && workItems.length > 0) {
      const validSelectedNodes = filterValidSelectedNodes(
        sourceNode.id,
        Array.from(selectedNodes),
        selectedRelationType,
        existingEdges,
        workItems
      );
      
      if (validSelectedNodes.length !== selectedNodes.size) {
        setSelectedNodes(new Set(validSelectedNodes));
      }
    }
  }, [selectedRelationType, workItems, existingEdges, isOpen]);

  // Validate new connections for duplicates when selection changes
  useEffect(() => {
    if (selectedNodes.size > 0 && workItems.length > 0) {
      // Check each selected node for potential duplicates
      const selectedNodeIds = Array.from(selectedNodes);
      let hasWarnings = false;
      let combinedWarning = { isValid: true, reason: '', suggestion: '' };
      
      for (const targetId of selectedNodeIds) {
        const validation = validateNewConnection(
          sourceNode.id,
          targetId,
          selectedRelationType,
          existingEdges,
          workItems
        );
        
        if (!validation.isValid) {
          hasWarnings = true;
          combinedWarning = {
            isValid: false,
            reason: validation.reason || '',
            suggestion: validation.suggestion || ''
          };
          break;
        } else if (validation.reason) {
          // Redundant relationship warning
          hasWarnings = true;
          combinedWarning = {
            isValid: true,
            reason: validation.reason || '',
            suggestion: validation.suggestion || ''
          };
        }
      }
      
      if (hasWarnings) {
        setDuplicateWarning(combinedWarning);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [selectedNodes, selectedRelationType, existingEdges, workItems, sourceNode.id]);

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

  const handleDeleteConnection = async (edgeId: string, connectionTitle: string) => {
    try {
      await deleteEdgeMutation({
        variables: {
          where: { id: edgeId }
        }
      });
      
      showSuccess(
        'Connection Removed Successfully!',
        `Connection "${connectionTitle}" has been removed.`
      );
    } catch (error: any) {
      showError(
        'Failed to Remove Connection',
        error.message || 'An unexpected error occurred while removing the connection.'
      );
    }
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

      // Create detailed success message similar to connect
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
    } catch (error: any) {
      showError(
        'Failed to Remove Connections',
        error.message || 'An unexpected error occurred while removing connections. Please try again.'
      );
      setShowDisconnectConfirmation(false);
    }
  };
  
  // Check if any relationship type is disabled (any relationship already exists with selected nodes)
  const isRelationshipDisabled = (relationshipType: string) => {
    if (selectedNodes.size === 0) return false;
    // With one-relationship-at-a-time policy, disable if ANY relationship exists
    return false; // Simplified for now
  };
  
  // Filter out the source node and apply search/filters
  const availableNodes = workItems.filter((node: WorkItem) => {
    if (node.id === sourceNode.id) return false;
    
    const matchesSearch = node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || node.status === statusFilter;
    const matchesType = typeFilter === 'all' || node.type === typeFilter;
    
    // Priority filter logic
    let matchesPriority = true;
    if (priorityFilter !== 'all' && node.priorityComp !== undefined && node.priorityComp !== null) {
      const priority = node.priorityComp;
      switch (priorityFilter) {
        case 'critical': matchesPriority = priority >= 0.8; break;
        case 'high': matchesPriority = priority >= 0.6 && priority < 0.8; break;
        case 'moderate': matchesPriority = priority >= 0.4 && priority < 0.6; break;
        case 'low': matchesPriority = priority >= 0.2 && priority < 0.4; break;
        case 'minimal': matchesPriority = priority < 0.2; break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  const uniqueStatuses = [...new Set(workItems.map((item: WorkItem) => item.status))];
  const uniqueTypes = [...new Set(workItems.map((item: WorkItem) => item.type))];

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleCreateConnections = async () => {
    if (selectedNodes.size === 0) {
      showError('No Nodes Selected', 'Please select at least one node to connect to.');
      return;
    }

    // Check if the selected relationship type is disabled
    if (isRelationshipDisabled(selectedRelationType)) {
      showError('Duplicate Connection', `The "${getRelationshipConfig(selectedRelationType as RelationshipType).label}" relationship already exists between these nodes.`);
      return;
    }

    try {
      
      // Create connections one by one instead of batch
      const connectionPromises = Array.from(selectedNodes).map(async (targetId) => {
        const variables = {
          input: [{
            type: selectedRelationType,
            weight: 0.8,
            source: { connect: { where: { node: { id: sourceNode.id } } } },
            target: { connect: { where: { node: { id: targetId } } } }
          }]
        };
        
        return createEdgeMutation({ variables });
      });
      
      await Promise.all(connectionPromises);

      const selectedNodeTitles = availableNodes
        .filter((node: WorkItem) => selectedNodes.has(node.id))
        .map((node: WorkItem) => node.title)
        .join(', ');

      showSuccess(
        'Connections Created Successfully!',
        `"${sourceNode.title}" is now connected to ${selectedNodes.size} node${selectedNodes.size > 1 ? 's' : ''}: ${selectedNodeTitles}`
      );

      onClose();
    } catch (error: any) {
      
      // Extract meaningful error message
      let errorMessage = 'Please try again or contact support.';
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error.networkError) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showError('Failed to Create Connections', errorMessage);
    }
  };

  const selectedRelation = getRelationshipConfig(selectedRelationType as RelationshipType);

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900/80 via-slate-900/90 to-gray-900/80 transition-all duration-300" onClick={onClose} />

        <div className="relative inline-block align-bottom bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-2xl text-left overflow-hidden shadow-2xl border border-gray-700/50 transform transition-all duration-300 hover:shadow-blue-500/10 sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full z-[10000]" onClick={(e) => e.stopPropagation()}>
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-emerald-900/30 via-green-800/25 to-teal-900/30 px-6 py-5 border-b border-emerald-600/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                  {activeTab === 'connect' ? (
                    <Link2 className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <Unlink className="h-6 w-6 text-red-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-200 to-green-100 bg-clip-text text-transparent">
                    {activeTab === 'connect' ? 'Connect Node' : 'Disconnect Node'}
                  </h3>
                  <p className="text-sm text-gray-300 mt-1">
                    {activeTab === 'connect' 
                      ? `Create connections from "${sourceNode.title}"` 
                      : `Remove connections from "${sourceNode.title}"`
                    }
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
            
            {/* Tab Navigation */}
            <div className="mt-4 flex space-x-1 bg-gray-700/30 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('connect')}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'connect'
                    ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-400/30'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-600/20'
                }`}
              >
                <Link2 className="h-4 w-4" />
                <span>Connect</span>
              </button>
              <button
                onClick={() => setActiveTab('disconnect')}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'disconnect'
                    ? 'bg-red-600/20 text-red-200 border border-red-400/30'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-600/20'
                }`}
              >
                <Unlink className="h-4 w-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>

          <div className="flex">
            {activeTab === 'connect' ? (
              <>
                {/* Left Panel - Connection Type Selection */}
            <div className="w-1/3 bg-gradient-to-b from-gray-800/50 to-gray-900/50 border-r border-gray-600/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full"></div>
                  <h4 className="text-sm font-bold text-gray-100 tracking-wide">Relationship Type ({RELATIONSHIP_OPTIONS.filter(relation => relationshipFilter.includes(relation.type)).length} available)</h4>
                </div>
                
                <div className="relative">
                  <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/60 border border-gray-600/30 hover:border-gray-500/50 transition-all duration-200"
                    title="Filter relationship types"
                  >
                    <Filter className="h-4 w-4 text-gray-400" />
                  </button>
                  
                  {isFilterOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-600/50 rounded-xl shadow-2xl z-50 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-200">Filter Types</span>
                        <button
                          onClick={() => {
                            const allSelected = relationshipFilter.length === RELATIONSHIP_OPTIONS.length;
                            setRelationshipFilter(allSelected ? [] : RELATIONSHIP_OPTIONS.map(r => r.type));
                          }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          {relationshipFilter.length === RELATIONSHIP_OPTIONS.length ? 'None' : 'All'}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {RELATIONSHIP_OPTIONS.map((relation) => (
                          <label key={relation.type} className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-700/50">
                            <input
                              type="checkbox"
                              checked={relationshipFilter.includes(relation.type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRelationshipFilter(prev => [...prev, relation.type]);
                                } else {
                                  setRelationshipFilter(prev => prev.filter(t => t !== relation.type));
                                }
                              }}
                              className="w-3 h-3 text-emerald-600 bg-gray-700 border-gray-600 rounded focus:ring-emerald-500"
                            />
                            <div className="flex items-center space-x-1">
                              {getRelationshipIconElement(relation.type, `h-3 w-3`)}
                              <span className="text-xs text-gray-300">{relation.label}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {RELATIONSHIP_OPTIONS.filter(relation => relationshipFilter.includes(relation.type)).map((relation) => {
                  // Debug: Log each relationship being rendered
                  const isDisabled = isRelationshipDisabled(relation.type);
                  const isSelected = selectedRelationType === relation.type;
                  
                  // DEBUG: Log selection state for important types
                  if (relation.type === 'BLOCKS' || relation.type === 'DEFAULT_EDGE' || isSelected) {
                    console.log(`🎛️ DROPDOWN OPTION - ${relation.type}: selected=${isSelected}, selectedRelationType=${selectedRelationType}`);
                  }
                  
                  // Get which nodes already have this relationship
                  const nodesWithExistingRelationship = selectedNodes.size > 0
                    ? Array.from(selectedNodes).filter(nodeId => 
                        getExistingRelationships(sourceNode.id, nodeId, existingEdges, workItems).includes(relation.type)
                      )
                    : [];
                  
                  return (
                    <button
                      key={relation.type}
                      onClick={() => {
                        if (!isDisabled) {
                          setSelectedRelationType(relation.type);
                        }
                      }}
                      disabled={isDisabled}
                      title={isDisabled ? `This relationship already exists with selected node(s)` : ''}
                      className={`w-full p-4 rounded-xl text-left transition-all duration-200 border group ${
                        isDisabled
                          ? 'bg-gray-800/30 border border-gray-700/50 opacity-40 cursor-not-allowed'
                          : selectedRelationType === relation.type
                            ? 'bg-gradient-to-br from-emerald-600/20 via-green-700/25 to-emerald-800/20 border border-emerald-400/50 shadow-lg shadow-emerald-500/10'
                            : 'bg-gradient-to-br from-gray-700/30 to-gray-800/30 hover:from-gray-600/40 hover:to-gray-700/40 border border-gray-600/30 hover:border-gray-500/50 cursor-pointer hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        {getRelationshipIconElement(relation.type, `h-5 w-5`)}
                        <span className={`font-medium ${relation.color}`}>{relation.label}</span>
                        {isDisabled && (
                          <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full ml-auto">
                            Already exists
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {isDisabled 
                          ? "This relationship already exists between these nodes"
                          : relation.description
                        }
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Connection Preview */}
              {selectedRelation && (
                <div className="mt-6 p-4 bg-gradient-to-r from-slate-800/40 to-gray-800/40 rounded-xl border border-gray-600/30 backdrop-blur-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full"></div>
                    <h5 className="text-xs font-bold text-gray-200 tracking-wide">Connection Preview</h5>
                  </div>
                  
                  {/* Summary boxes */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    {/* Already connected summary box - show first */}
                    {(() => {
                      const alreadyConnectedCount = workItems.filter((node: WorkItem) =>
                        node.id !== sourceNode.id &&
                        hasAnyRelationship(sourceNode.id, node.id, existingEdges, workItems)
                      ).length;
                      const totalNodes = workItems.filter(node => node.id !== sourceNode.id).length;
                      const isAllConnected = alreadyConnectedCount === totalNodes;
                      
                      return alreadyConnectedCount > 0 ? (
                        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-orange-500/10 rounded-md border border-orange-400/20">
                          <CheckCircle className="h-3 w-3 text-orange-400" />
                          <span className="text-orange-300 font-medium text-xs">
                            {isAllConnected ? `All ${alreadyConnectedCount}` : alreadyConnectedCount} node{alreadyConnectedCount !== 1 ? 's' : ''} already connected
                          </span>
                        </div>
                      ) : null;
                    })()}
                    
                    {/* Ready to connect box - always show */}
                    {(() => {
                      const availableToConnect = availableNodes.filter((node: WorkItem) => 
                        !hasAnyRelationship(sourceNode.id, node.id, existingEdges, workItems)
                      ).length;
                      const totalNodes = workItems.filter(node => node.id !== sourceNode.id).length;
                      const isAllAvailable = availableToConnect === totalNodes && availableToConnect > 0;
                      
                      return (
                        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md border ${
                          availableToConnect > 0 
                            ? 'bg-emerald-500/10 border-emerald-400/20' 
                            : 'bg-gray-500/10 border-gray-400/20'
                        }`}>
                          <Target className={`h-3 w-3 ${availableToConnect > 0 ? 'text-emerald-400' : 'text-gray-400'}`} />
                          <span className={`font-medium text-xs ${
                            availableToConnect > 0 ? 'text-emerald-300' : 'text-gray-400'
                          }`}>
                            {isAllAvailable ? `All ${availableToConnect}` : availableToConnect} node{availableToConnect !== 1 ? 's' : ''} ready to connect
                          </span>
                        </div>
                      );
                    })()}
                    
                    {/* Selected to connect box */}
                    {selectedNodes.size > 0 && (() => {
                      const selectedCount = selectedNodes.size;
                      const availableToConnect = availableNodes.filter((node: WorkItem) => 
                        !hasAnyRelationship(sourceNode.id, node.id, existingEdges, workItems)
                      ).length;
                      const isAllSelected = selectedCount === availableToConnect;
                      
                      return (
                        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-500/10 rounded-md border border-blue-400/20">
                          <CheckCircle2 className="h-3 w-3 text-blue-400" />
                          <span className="text-blue-300 font-medium text-xs">
                            {isAllSelected ? `All ${selectedCount}` : selectedCount} node{selectedCount !== 1 ? 's' : ''} selected to connect
                          </span>
                        </div>
                      );
                    })()}
                    
                    {/* No nodes available message */}
                    {(() => {
                      const availableToConnect = availableNodes.filter((node: WorkItem) => 
                        !hasAnyRelationship(sourceNode.id, node.id, existingEdges, workItems)
                      ).length;
                      const alreadyConnectedCount = workItems.filter((node: WorkItem) =>
                        node.id !== sourceNode.id &&
                        hasAnyRelationship(sourceNode.id, node.id, existingEdges, workItems)
                      ).length;
                      
                      if (availableToConnect === 0 && alreadyConnectedCount === 0) {
                        return (
                          <p className="text-xs text-gray-400">No nodes available for this relationship</p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="space-y-3">
                    {/* Main connection flow */}
                    <div className="flex items-center space-x-3 text-sm">
                      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-700/50 rounded-lg border border-gray-600/30">
                        <span className="text-white font-semibold truncate max-w-20">{sourceNode.title}</span>
                      </div>
                      <div className="flex flex-col items-center space-y-1">
                        <ArrowRight className={`h-4 w-4 ${selectedRelation.color}`} />
                        {getRelationshipIconElement(selectedRelation.type, `h-3 w-3`)}
                      </div>
                      {/* Selected nodes */}
                      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${
                        selectedNodes.size > 0 
                          ? 'bg-emerald-500/10 border-emerald-400/20' 
                          : 'bg-gray-600/10 border-gray-500/20'
                      }`}>
                        <Target className={`h-4 w-4 ${selectedNodes.size > 0 ? 'text-emerald-400' : 'text-gray-400'}`} />
                        <span className={`font-semibold text-xs ${
                          selectedNodes.size > 0 ? 'text-emerald-300' : 'text-gray-400'
                        }`}>
                          {selectedNodes.size > 0 
                            ? `${selectedNodes.size} selected` 
                            : 'Select nodes'
                          }
                        </span>
                      </div>
                    </div>
                    
                    {/* Professional Relationship Message */}
                    {selectedNodes.size > 0 && (
                      <div className="mt-4 p-3 bg-gradient-to-r from-emerald-900/20 to-green-900/20 rounded-lg border border-emerald-600/20">
                        <div className="flex items-start space-x-3">
                          <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 mt-0.5">
                            {getRelationshipIconElement(selectedRelation.type, `h-3.5 w-3.5`)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h6 className="text-xs font-semibold text-emerald-200">Relationship Impact</h6>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${selectedRelation.color} bg-current/10`}>
                                {selectedRelation.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                              {(() => {
                                const count = selectedNodes.size;
                                const plural = count !== 1 ? 's' : '';
                                switch (selectedRelationType) {
                                  case 'DEPENDS_ON':
                                    return `Creating ${count} dependency relationship${plural}. "${sourceNode.title}" will depend on the selected node${plural}, meaning this work cannot start until the target${count !== 1 ? 's are' : ' is'} completed.`;
                                  case 'BLOCKS':
                                    return `Creating ${count} blocking relationship${plural}. "${sourceNode.title}" will block the selected node${plural}, preventing them from progressing until this work is resolved.`;
                                  case 'ENABLES':
                                    return `Creating ${count} enabling relationship${plural}. "${sourceNode.title}" will enable the selected node${plural}, allowing them to proceed once this work is completed.`;
                                  case 'RELATES_TO':
                                    return `Creating ${count} general relationship${plural}. "${sourceNode.title}" will be related to the selected node${plural}, indicating a loose connection without strict dependencies.`;
                                  case 'IS_PART_OF':
                                    return `Creating ${count} hierarchical relationship${plural}. "${sourceNode.title}" will be part of the selected node${plural}, establishing a parent-child structure.`;
                                  case 'FOLLOWS':
                                    return `Creating ${count} sequential relationship${plural}. "${sourceNode.title}" will follow the selected node${plural}, establishing a clear order of execution.`;
                                  case 'PARALLEL_WITH':
                                    return `Creating ${count} parallel relationship${plural}. "${sourceNode.title}" will run parallel to the selected node${plural}, indicating they can be worked on simultaneously.`;
                                  case 'DUPLICATES':
                                    return `Creating ${count} duplication relationship${plural}. "${sourceNode.title}" duplicates the selected node${plural}, indicating similar or redundant work.`;
                                  case 'CONFLICTS_WITH':
                                    return `Creating ${count} conflict relationship${plural}. "${sourceNode.title}" conflicts with the selected node${plural}, indicating incompatible approaches or requirements.`;
                                  case 'VALIDATES':
                                    return `Creating ${count} validation relationship${plural}. "${sourceNode.title}" will validate the selected node${plural}, ensuring quality and correctness.`;
                                  case 'REFERENCES':
                                    return `Creating ${count} reference relationship${plural}. "${sourceNode.title}" references the selected node${plural}, indicating informational or documentation links.`;
                                  default:
                                    return `Creating ${count} ${selectedRelation.label.toLowerCase()} relationship${plural}. This will establish a connection between "${sourceNode.title}" and the selected node${plural}.`;
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Node Selection */}
            <div className="flex-1 p-6 bg-gradient-to-br from-gray-800/30 to-gray-900/40">
              {/* Existing Connections Section */}
              {(() => {
                // Get all connections for this node (both Edge entities and WorkItem relationships)
                const allConnections: Array<{id: string, type: string, connectedNode: {id: string, title: string, type: string}, direction: 'outgoing' | 'incoming'}> = [];
                
                // Add Edge entity connections
                existingEdges.forEach(edge => {
                  if (edge.source.id === sourceNode.id) {
                    allConnections.push({
                      id: edge.id,
                      type: edge.type,
                      connectedNode: { id: edge.target.id, title: edge.target.title, type: 'unknown' },
                      direction: 'outgoing'
                    });
                  } else if (edge.target.id === sourceNode.id) {
                    allConnections.push({
                      id: edge.id,
                      type: edge.type,
                      connectedNode: { id: edge.source.id, title: edge.source.title, type: 'unknown' },
                      direction: 'incoming'
                    });
                  }
                });
                
                // Add WorkItem dependency connections (only if not already covered by Edge entities)
                const currentNode = workItems.find(item => item.id === sourceNode.id);
                if (currentNode) {
                  // Dependencies (this node depends on others)
                  currentNode.dependencies?.forEach(dep => {
                    // Check if we already have this connection from Edge entities (any direction, any type)
                    const existsInEdges = allConnections.some(conn => 
                      conn.connectedNode.id === dep.id
                    );
                    if (!existsInEdges) {
                      allConnections.push({
                        id: `workitem-dep-${dep.id}`,
                        type: 'DEPENDS_ON',
                        connectedNode: { id: dep.id, title: dep.title, type: 'unknown' },
                        direction: 'outgoing'
                      });
                    }
                  });
                  
                  // Dependents (other nodes depend on this one) 
                  currentNode.dependents?.forEach(dep => {
                    // Check if we already have this connection from Edge entities (any direction, any type)
                    const existsInEdges = allConnections.some(conn => 
                      conn.connectedNode.id === dep.id
                    );
                    if (!existsInEdges) {
                      allConnections.push({
                        id: `workitem-dept-${dep.id}`,
                        type: 'DEPENDS_ON',
                        connectedNode: { id: dep.id, title: dep.title, type: 'unknown' },
                        direction: 'incoming'
                      });
                    }
                  });
                }
                
                // Remove any remaining duplicates by creating a unique key
                const uniqueConnections = allConnections.filter((connection, index, self) => 
                  index === self.findIndex(c => 
                    c.connectedNode.id === connection.connectedNode.id && 
                    c.type === connection.type &&
                    c.direction === connection.direction
                  )
                );
                
                return uniqueConnections.length > 0 ? (
                  <div className="mb-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                        <ExternalLink className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-100">Existing Connections</h4>
                        <p className="text-xs text-gray-400">{uniqueConnections.length} active connection{uniqueConnections.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-gray-800/40 to-slate-800/30 rounded-xl border border-gray-600/30 p-4 max-h-40 overflow-y-auto backdrop-blur-sm">
                      <div className="space-y-3">
                        {uniqueConnections.map((connection) => {
                          const relationshipType = getRelationshipConfig(connection.type as RelationshipType);
                          const isOutgoing = connection.direction === 'outgoing';
                          
                          return (
                            <div key={connection.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl border border-gray-600/20 hover:bg-gray-600/30 transition-all duration-200 group">
                              <div ref={connectContainerRef} className="flex items-center space-x-2 text-sm w-full overflow-hidden whitespace-nowrap">
                                {(() => {
                                  // Use real measured width from ResizeObserver
                                  const relationshipLabel = `${relationshipType?.label || connection.type}${!isOutgoing ? ' ↩' : ''}`;
                                  
                                  // Dynamic calculation based on actual container width
                                  const actualBoxWidth = connectContainerWidth;
                                  const charWidth = 6; // Approximate - could be refined with canvas measurement
                                  const fixedElements = 90; // Arrows, icons, padding, spacing
                                  const relationshipWidth = Math.min(relationshipLabel.length * charWidth, Math.floor(actualBoxWidth * 0.3)); // Max 30% of container
                                  const availableForTitles = actualBoxWidth - fixedElements - relationshipWidth;
                                  const charsPerTitle = Math.floor((availableForTitles / 2) / charWidth);
                                  const maxCharsPerTitle = Math.max(10, Math.min(charsPerTitle, Math.floor(actualBoxWidth / 15))); // Min 10, max based on container
                                  
                                  const truncateForConnect = (title: string) => {
                                    if (title.length <= maxCharsPerTitle) return title;
                                    return title.substring(0, maxCharsPerTitle - 1) + '…';
                                  };
                                  
                                  return (
                                    <>
                                      {/* Source - Generous for connect */}
                                      <div className="flex items-center px-2 py-1 bg-gray-600/40 rounded-md flex-shrink-0" style={{ width: `${maxCharsPerTitle * charWidth + 16}px` }}>
                                        <span className="text-white font-semibold text-xs truncate" title={sourceNode.title}>
                                          {truncateForConnect(sourceNode.title)}
                                        </span>
                                      </div>
                                      
                                      {/* Relationship - Adaptive arrow with smart labeling */}
                                      <div className="flex items-center space-x-1 px-2 py-1 rounded bg-gray-600/40 flex-shrink-0" title={getRelationshipDescription(sourceNode.title, connection.connectedNode.title, relationshipType?.type || 'RELATES_TO', !isOutgoing)}>
                                        <span className={`text-sm ${isOutgoing ? (relationshipType?.color || 'text-gray-400') : 'text-gray-400'}`}>
                                          {getRelationshipArrow(relationshipType?.type || 'RELATES_TO')}
                                        </span>
                                        {relationshipType ? 
                                          getRelationshipIconElement(relationshipType.type, `h-2.5 w-2.5`) :
                                          getRelationshipIconElement('RELATES_TO', 'h-2.5 w-2.5 text-gray-400')
                                        }
                                        <span className={`text-xs font-medium ${relationshipType?.color || 'text-gray-400'}`}>
                                          {getRelationshipConfig(connection.type as RelationshipType).label}
                                        </span>
                                      </div>

                                      {/* Target - Generous for connect */}
                                      <div className="flex items-center px-2 py-1 bg-gray-600/40 rounded-md flex-shrink-0" style={{ width: `${maxCharsPerTitle * charWidth + 16}px` }}>
                                        <span className="text-gray-200 font-medium text-xs truncate" title={connection.connectedNode.title}>
                                          {truncateForConnect(connection.connectedNode.title)}
                                        </span>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Duplicate Detection Warning */}
              {duplicateWarning && (
                <div className={`mb-6 p-4 rounded-xl border ${
                  duplicateWarning.isValid 
                    ? 'bg-yellow-900/20 border-yellow-600/30 text-yellow-200'
                    : 'bg-red-900/20 border-red-600/30 text-red-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${
                      duplicateWarning.isValid 
                        ? 'bg-yellow-500/20 border border-yellow-400/30'
                        : 'bg-red-500/20 border border-red-400/30'
                    }`}>
                      {duplicateWarning.isValid ? (
                        <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 8.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      ) : (
                        <X className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold mb-1">
                        {duplicateWarning.isValid ? 'Redundant Relationship Warning' : 'Duplicate Connection Detected'}
                      </h4>
                      <p className="text-sm mb-2">{duplicateWarning.reason}</p>
                      {duplicateWarning.suggestion && (
                        <p className="text-xs font-medium opacity-90">
                          💡 {duplicateWarning.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicate Detection Summary */}
              {(() => {
                const duplicates = detectDuplicateConnections(existingEdges, workItems);
                const recommendations = getCleanupRecommendations(duplicates);
                
                if (duplicates.length > 0) {
                  return (
                    <div className="mb-6 p-4 rounded-xl border border-orange-600/30 bg-orange-900/20">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-400/30">
                          <svg className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-orange-200 mb-1">
                            Graph Cleanup Recommendations
                          </h4>
                          <p className="text-sm text-orange-300 mb-3">
                            Found {duplicates.length} duplicate connection{duplicates.length !== 1 ? 's' : ''} in your graph
                          </p>
                          <div className="space-y-2">
                            {recommendations.slice(0, 2).map((rec, index) => (
                              <div key={index} className="flex items-center space-x-2 text-xs">
                                <div className={`h-1.5 w-1.5 rounded-full ${
                                  rec.priority === 'high' ? 'bg-red-400' :
                                  rec.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                                }`} />
                                <span className="text-orange-200">{rec.description}</span>
                              </div>
                            ))}
                            {recommendations.length > 2 && (
                              <p className="text-xs text-orange-300 italic">
                                +{recommendations.length - 2} more recommendation{recommendations.length - 2 !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Available Nodes Section */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-100">Available Nodes</h4>
                  <p className="text-xs text-gray-400">Select nodes to create connections</p>
                </div>
              </div>
              
              {/* Search and Filters */}
              <div className="mb-6">
                <div className="flex space-x-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search nodes by title or type"
                      className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                    />
                  </div>
                  {/* Type Filter */}
                  <div className="relative" ref={typeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                      className="flex items-center justify-between px-4 py-3 bg-gray-800 border border-gray-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 min-w-[140px]"
                    >
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const selectedType = typeOptions.find(option => option.value === typeFilter);
                          return selectedType ? (
                            <>
                              {selectedType.icon && (
                                <div className={`${selectedType.color}`}>
                                  {selectedType.icon}
                                </div>
                              )}
                              <span className="font-medium">{selectedType.label}</span>
                            </>
                          ) : (
                            <span className="font-medium">All Type</span>
                          );
                        })()}
                      </div>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isTypeDropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} />
                    </button>

                    {isTypeDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-full bg-gray-800 border border-gray-600/50 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                        <div className="p-2">
                          {typeOptions.map((option, index) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setTypeFilter(option.value);
                                setIsTypeDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-emerald-900/20 transition-all duration-200 rounded-lg group ${
                                typeFilter === option.value 
                                  ? 'bg-emerald-900/30 ring-1 ring-emerald-500/30' 
                                  : 'hover:shadow-sm'
                              } ${index !== 0 ? 'mt-1' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {option.icon && (
                                    <div className={`${option.color}`}>
                                      {option.icon}
                                    </div>
                                  )}
                                  <span className={`font-medium text-sm ${
                                    typeFilter === option.value 
                                      ? 'text-emerald-300' 
                                      : 'text-white'
                                  }`}>
                                    {option.label}
                                  </span>
                                </div>
                                {typeFilter === option.value && (
                                  <div className="w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                                    ✓
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Status Filter */}
                  <div className="relative" ref={statusDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                      className="flex items-center justify-between px-4 py-3 bg-gray-800 border border-gray-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 min-w-[140px]"
                    >
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const selectedStatus = statusOptions.find(option => option.value === statusFilter);
                          return selectedStatus ? (
                            <>
                              {selectedStatus.icon && (
                                <div className={`${selectedStatus.color}`}>
                                  {selectedStatus.icon}
                                </div>
                              )}
                              <span className="font-medium">{selectedStatus.label}</span>
                            </>
                          ) : (
                            <span className="font-medium">All Status</span>
                          );
                        })()}
                      </div>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isStatusDropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} />
                    </button>

                    {isStatusDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-full bg-gray-800 border border-gray-600/50 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                        <div className="p-2">
                          {statusOptions.map((option, index) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setStatusFilter(option.value);
                                setIsStatusDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-emerald-900/20 transition-all duration-200 rounded-lg group ${
                                statusFilter === option.value 
                                  ? 'bg-emerald-900/30 ring-1 ring-emerald-500/30' 
                                  : 'hover:shadow-sm'
                              } ${index !== 0 ? 'mt-1' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {option.icon && (
                                    <div className={`${option.color}`}>
                                      {option.icon}
                                    </div>
                                  )}
                                  <span className={`font-medium text-sm ${
                                    statusFilter === option.value 
                                      ? 'text-emerald-300' 
                                      : 'text-white'
                                  }`}>
                                    {option.label}
                                  </span>
                                </div>
                                {statusFilter === option.value && (
                                  <div className="w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                                    ✓
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Priority Filter */}
                  <div className="relative" ref={priorityDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsPriorityDropdownOpen(!isPriorityDropdownOpen)}
                      className="flex items-center justify-between px-4 py-3 bg-gray-800 border border-gray-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 min-w-[140px]"
                    >
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const selectedPriority = priorityOptions.find(option => option.value === priorityFilter);
                          return selectedPriority ? (
                            <>
                              {selectedPriority.icon && (
                                <div className={`${selectedPriority.color}`}>
                                  {selectedPriority.icon}
                                </div>
                              )}
                              <span className="font-medium">{selectedPriority.label}</span>
                            </>
                          ) : (
                            <span className="font-medium">All Priority</span>
                          );
                        })()}
                      </div>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isPriorityDropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} />
                    </button>

                    {isPriorityDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-full bg-gray-800 border border-gray-600/50 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                        <div className="p-2">
                          {priorityOptions.map((option, index) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setPriorityFilter(option.value);
                                setIsPriorityDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-emerald-900/20 transition-all duration-200 rounded-lg group ${
                                priorityFilter === option.value 
                                  ? 'bg-emerald-900/30 ring-1 ring-emerald-500/30' 
                                  : 'hover:shadow-sm'
                              } ${index !== 0 ? 'mt-1' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {option.icon && (
                                    <div className={`${option.color}`}>
                                      {option.icon}
                                    </div>
                                  )}
                                  <span className={`font-medium text-sm ${
                                    priorityFilter === option.value 
                                      ? 'text-emerald-300' 
                                      : 'text-white'
                                  }`}>
                                    {option.label}
                                  </span>
                                </div>
                                {priorityFilter === option.value && (
                                  <div className="w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                                    ✓
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl border border-gray-600/30">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-emerald-400 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-300">
                        {availableNodes.filter((node: WorkItem) => 
                          !hasAnyRelationship(sourceNode.id, node.id, existingEdges, workItems)
                        ).length} available
                      </span>
                    </div>
                    <div className="h-4 w-px bg-gray-600"></div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                      <span className="text-sm font-medium text-emerald-300">{selectedNodes.size} selected</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Node List */}
              <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                {loadingNodes ? (
                  <div className="text-center py-8 text-gray-400">Loading nodes...</div>
                ) : availableNodes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">No nodes found</div>
                ) : (
                  availableNodes.map((node: WorkItem) => {
                    // Check if this node already has ANY relationship with source node
                    const isNodeDisabled = hasAnyRelationship(
                      sourceNode.id, 
                      node.id, 
                      existingEdges, 
                      workItems
                    );
                    
                    return (
                      <button
                        key={node.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isNodeDisabled) {
                            toggleNodeSelection(node.id);
                          }
                        }}
                        disabled={isNodeDisabled}
                        title={isNodeDisabled ? `A relationship already exists with this node. Only one relationship per node pair is allowed.` : ''}
                        className={`w-full p-4 rounded-xl text-left transition-all duration-200 border group ${
                          isNodeDisabled
                            ? 'bg-gray-800/30 border-gray-700/50 opacity-40 cursor-not-allowed'
                            : selectedNodes.has(node.id)
                              ? 'bg-gradient-to-r from-emerald-600/20 to-green-700/15 border-emerald-400/60 shadow-lg shadow-emerald-500/10 cursor-pointer'
                              : 'bg-gradient-to-r from-gray-700/20 to-gray-800/25 border-gray-600/30 hover:from-gray-600/30 hover:to-gray-700/35 hover:border-gray-500/50 hover:shadow-md cursor-pointer'
                        }`}
                      >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="font-semibold text-white text-sm group-hover:text-emerald-100 transition-colors">{node.title}</p>
                              {isNodeDisabled && (
                                <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full border border-red-700/50">
                                  Has relationship
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-xs">
                              {/* Type with icon */}
                              <div className="flex items-center space-x-1">
                                <div className={getTypeColorScheme(node.type as any).text}>
                                  {getTypeIconElement(node.type as any)}
                                </div>
                                <span className="text-gray-300 font-medium">
                                  {node.type?.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </div>
                              
                              {/* Status with icon and label */}
                              <div className="flex items-center space-x-1">
                                <div className={getStatusColorScheme(node.status as any).text}>
                                  {getStatusIconElement(node.status as any)}
                                </div>
                                <span className="text-gray-300 font-medium">
                                  {node.status?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </div>
                              
                              {/* Priority with icon and progress bar */}
                              {(node.priorityComp !== undefined && node.priorityComp !== null) && (
                                <div className="flex items-center space-x-1">
                                  <div className={getPriorityColorScheme(node.priorityComp).text}>
                                    {getPriorityIconElement(node.priorityComp as any)}
                                  </div>
                                  <span className="text-gray-300 font-medium">Priority</span>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full transition-all duration-300"
                                        style={{ 
                                          width: `${Math.round(node.priorityComp * 100)}%`,
                                          backgroundColor: getPriorityColorScheme(node.priorityComp).hex
                                        }}
                                      />
                                    </div>
                                    <span className={`text-xs font-medium ${getPriorityColorScheme(node.priorityComp).text}`}>
                                      {Math.round(node.priorityComp * 100)}%
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          {!isNodeDisabled && selectedNodes.has(node.id) && (
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50">
                              <CheckCircle className="h-4 w-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-600/50 mt-6">
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/50 to-gray-800/50 border border-gray-600/50 rounded-xl hover:from-gray-600/60 hover:to-gray-700/60 hover:border-gray-500/60 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateConnections}
                  disabled={selectedNodes.size === 0 || creatingConnection || isRelationshipDisabled(selectedRelationType) || (duplicateWarning && !duplicateWarning.isValid) || false}
                  className={`px-8 py-3 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 font-semibold shadow-lg disabled:shadow-none ${
                    duplicateWarning && !duplicateWarning.isValid
                      ? 'bg-gray-600 cursor-not-allowed'
                      : duplicateWarning && duplicateWarning.isValid
                        ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 shadow-yellow-500/20'
                        : 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 shadow-emerald-500/20'
                  }`}
                  title={
                    duplicateWarning && !duplicateWarning.isValid
                      ? 'Cannot connect: Duplicate relationship detected'
                      : isRelationshipDisabled(selectedRelationType) 
                        ? 'This relationship already exists between the selected nodes' 
                        : duplicateWarning && duplicateWarning.isValid
                          ? 'Warning: This may create a redundant relationship'
                          : ''
                  }
                >
                  <Link2 className="w-5 h-5" />
                  <span>
                    {creatingConnection ? 'Connecting...' : 
                     duplicateWarning && !duplicateWarning.isValid ? 'Blocked - Duplicate' :
                     isRelationshipDisabled(selectedRelationType) ? 'Already Connected' :
                     duplicateWarning && duplicateWarning.isValid ? `Connect ${selectedNodes.size} (Warning)` :
                     `Connect ${selectedNodes.size} Node${selectedNodes.size !== 1 ? 's' : ''}`}
                  </span>
                </button>
              </div>
            </div>
              </>
            ) : (
              /* Disconnect Tab Content */
              <div className="flex-1 p-6 bg-gradient-to-br from-gray-800/30 to-gray-900/40">
                {(() => {
                  // Get all connections for this node
                  const allConnections: Array<{id: string, type: string, connectedNode: {id: string, title: string, type: string}, direction: 'outgoing' | 'incoming'}> = [];
                  
                  // Add Edge entity connections
                  existingEdges.forEach(edge => {
                    if (edge.source.id === sourceNode.id) {
                      allConnections.push({
                        id: edge.id,
                        type: edge.type,
                        connectedNode: { id: edge.target.id, title: edge.target.title, type: 'unknown' },
                        direction: 'outgoing'
                      });
                    } else if (edge.target.id === sourceNode.id) {
                      allConnections.push({
                        id: edge.id,
                        type: edge.type,
                        connectedNode: { id: edge.source.id, title: edge.source.title, type: 'unknown' },
                        direction: 'incoming'
                      });
                    }
                  });
                  
                  // Filter to only disconnectable connections (Edge entities only)
                  const disconnectableConnections = allConnections.filter(conn => !conn.id.startsWith('workitem-'));
                  
                  if (disconnectableConnections.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-96 text-gray-400">
                        <div className="text-center">
                          <Unlink className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                          <h4 className="text-lg font-medium text-gray-300 mb-2">No Connections to Disconnect</h4>
                          <div className="space-y-2 text-sm">
                            <p>This node has no disconnectable connections.</p>
                            <div className="bg-gray-800/50 rounded-lg p-3 text-left">
                              <p className="text-xs text-gray-400 mb-2">Debug Info:</p>
                              <p className="text-xs">• Existing edges: {existingEdges.length}</p>
                              <p className="text-xs">• All connections: {allConnections.length}</p>
                              <p className="text-xs">• Disconnectable: {disconnectableConnections.length}</p>
                              <p className="text-xs">• Source node: {sourceNode.id}</p>
                            </div>
                            <p className="text-amber-300 text-xs mt-2">
                              💡 Tip: Only Edge entities can be disconnected. WorkItem relationships are read-only.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
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
                                <div className="flex-1 min-w-0 pr-4">
                                  {/* Connection Display */}
                                  <div className="flex items-center space-x-2 text-sm w-full flex-wrap">
                                    <div className="flex items-center px-2 py-1 bg-gray-600/40 rounded-md">
                                      <span className="text-white font-semibold text-xs" title={sourceNode.title}>
                                        {sourceNode.title}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center space-x-1 px-2 py-1 rounded bg-gray-600/40" title={getRelationshipDescription(sourceNode.title, connection.connectedNode.title, relationshipType?.type || 'RELATES_TO')}>
                                      <span className={`text-sm ${relationshipType?.color || 'text-gray-400'}`}>
                                        {getRelationshipArrow(relationshipType?.type || 'RELATES_TO')}
                                      </span>
                                      {relationshipType ? 
                                        getRelationshipIconElement(relationshipType.type, `h-2.5 w-2.5`) :
                                        getRelationshipIconElement('RELATES_TO', 'h-2.5 w-2.5 text-gray-400')
                                      }
                                      <span className={`text-xs font-medium ${relationshipType?.color || 'text-gray-400'}`}>
                                        {relationshipType?.label || 'Relates To'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center px-2 py-1 bg-gray-600/40 rounded-md">
                                      <span className="text-gray-200 font-medium text-xs" title={connection.connectedNode.title}>
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
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirmation && (
        <div className="fixed inset-0 z-[10001] overflow-y-auto backdrop-blur-sm">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gradient-to-br from-red-900/40 via-gray-900/60 to-red-900/40 transition-all duration-300" onClick={() => setShowDisconnectConfirmation(false)} />

            <div className="relative inline-block align-bottom bg-gradient-to-br from-gray-800 via-gray-800 to-red-900/20 rounded-2xl text-left overflow-hidden shadow-2xl border border-red-700/50 transform transition-all duration-300 sm:my-8 sm:align-middle sm:max-w-md sm:w-full z-[10002]" onClick={(e) => e.stopPropagation()}>
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