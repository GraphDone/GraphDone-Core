import { useState, useEffect } from 'react';
import { X, Link2, Search, CheckCircle, ArrowRight, Target, ExternalLink, Filter, ChevronDown } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_WORK_ITEMS, CREATE_EDGE, GET_EDGES } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  RELATIONSHIP_TYPES, 
  WorkItem, 
  Edge, 
  getExistingRelationships,
  relationshipExists,
  getNodesWithExistingRelationship,
  hasExistingRelationshipWithSelected,
  filterValidSelectedNodes,
  getRelationshipIcon
} from '../lib/connectionUtils';

interface ConnectNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: {
    id: string;
    title: string;
    type: string;
  };
}


const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'completed': return '#22c55e';
    case 'in_progress': return '#f59e0b';
    case 'blocked': return '#ef4444';
    case 'planned': return '#8b5cf6';
    default: return '#6b7280';
  }
};

const getNodeTypeIcon = (type: string): string => {
  const iconMap: { [key: string]: string } = {
    'EPIC': '🎯', 'STORY': '📖', 'TASK': '✅', 'BUG': '🐛',
    'FEATURE': '⭐', 'ENHANCEMENT': '🚀', 'RESEARCH': '🔍',
    'DOCUMENTATION': '📝', 'TEST': '🧪', 'REVIEW': '👀',
    'MILESTONE': '🏁', 'GOAL': '🎯', 'OBJECTIVE': '🎪'
  };
  return iconMap[type] || '📋';
};

export function ConnectNodeModal({ isOpen, onClose, sourceNode }: ConnectNodeModalProps) {
  const { currentTeam } = useAuth();
  const { currentGraph } = useGraph();
  const { showSuccess, showError } = useNotifications();
  
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedRelationType, setSelectedRelationType] = useState('DEPENDS_ON');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [relationshipFilter, setRelationshipFilter] = useState<string[]>(RELATIONSHIP_TYPES.map(r => r.type));
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // First try: fetch ALL nodes without filtering
  const { data: workItemsData, loading: loadingNodes, error: queryError } = useQuery(GET_WORK_ITEMS, {
    variables: {}, // No filtering - get all nodes
    skip: !isOpen
  });

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

  console.log('ConnectNodeModal - currentGraph:', currentGraph);
  console.log('ConnectNodeModal - currentTeam:', currentTeam);
  console.log('Existing edges:', edgesData?.edges || []);

  console.log('Query result:', { data: workItemsData, loading: loadingNodes, error: queryError });

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
      // Refetch work items without filter (for graph visualization)
      { 
        query: GET_WORK_ITEMS, 
        variables: { options: { limit: 100 } }
      },
      // Refetch work items with team filter (for list view)
      { 
        query: GET_WORK_ITEMS,
        variables: {
          where: {
            teamId: currentTeam?.id || 'team-1'
          }
        }
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
      console.log('ConnectNodeModal opened for node:', sourceNode);
      console.log('Available work items:', workItems.length || 0);
      setSelectedNodes(new Set());
      setSearchTerm('');
      setStatusFilter('all');
      setTypeFilter('all');
      setRelationshipFilter(RELATIONSHIP_TYPES.map(r => r.type));
      setIsFilterOpen(false);
    }
  }, [isOpen, sourceNode]);

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

  if (!isOpen) return null;
  
  // Check if a relationship type is disabled (already exists with any selected node)
  const isRelationshipDisabled = (relationshipType: string) => {
    if (selectedNodes.size === 0) return false;
    return hasExistingRelationshipWithSelected(
      sourceNode.id,
      Array.from(selectedNodes),
      relationshipType,
      existingEdges,
      workItems
    );
  };
  
  // Filter out the source node and apply search/filters
  const availableNodes = workItems.filter((node: WorkItem) => {
    if (node.id === sourceNode.id) return false;
    
    const matchesSearch = node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || node.status.toLowerCase() === statusFilter;
    const matchesType = typeFilter === 'all' || node.type.toLowerCase() === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const uniqueStatuses = [...new Set(workItems.map((item: WorkItem) => item.status))];
  const uniqueTypes = [...new Set(workItems.map((item: WorkItem) => item.type))];

  const toggleNodeSelection = (nodeId: string) => {
    console.log('toggleNodeSelection called with nodeId:', nodeId);
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        console.log('Removing node from selection:', nodeId);
        newSet.delete(nodeId);
      } else {
        console.log('Adding node to selection:', nodeId);
        newSet.add(nodeId);
      }
      console.log('New selection set:', Array.from(newSet));
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
      showError('Duplicate Connection', `The "${RELATIONSHIP_TYPES.find(r => r.type === selectedRelationType)?.label}" relationship already exists between these nodes.`);
      return;
    }

    try {
      console.log('Creating connections with:', {
        sourceNodeId: sourceNode.id,
        targetNodeIds: Array.from(selectedNodes),
        relationshipType: selectedRelationType
      });
      
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
        
        console.log('Creating single connection:', variables);
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
      console.error('Failed to create connections:', error);
      console.error('Error details:', {
        message: error.message,
        graphQLErrors: error.graphQLErrors,
        networkError: error.networkError,
        extraInfo: error.extraInfo
      });
      
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

  const selectedRelation = RELATIONSHIP_TYPES.find(r => r.type === selectedRelationType);

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900/80 via-slate-900/90 to-gray-900/80 transition-all duration-300" onClick={onClose} />

        <div className="relative inline-block align-bottom bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-2xl text-left overflow-hidden shadow-2xl border border-gray-700/50 transform transition-all duration-300 hover:shadow-blue-500/10 sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full z-[10000]">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-emerald-900/30 via-green-800/25 to-teal-900/30 px-6 py-5 border-b border-emerald-600/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                  <Link2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-200 to-green-100 bg-clip-text text-transparent">Connect Node</h3>
                  <p className="text-sm text-gray-300 mt-1">Create connections from <span className="font-semibold text-emerald-300">"{sourceNode.title}"</span></p>
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

          <div className="flex">
            {/* Left Panel - Connection Type Selection */}
            <div className="w-1/3 bg-gradient-to-b from-gray-800/50 to-gray-900/50 border-r border-gray-600/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full"></div>
                  <h4 className="text-sm font-bold text-gray-100 tracking-wide">Relationship Type</h4>
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
                            const allSelected = relationshipFilter.length === RELATIONSHIP_TYPES.length;
                            setRelationshipFilter(allSelected ? [] : RELATIONSHIP_TYPES.map(r => r.type));
                          }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          {relationshipFilter.length === RELATIONSHIP_TYPES.length ? 'None' : 'All'}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {RELATIONSHIP_TYPES.map((relation) => (
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
                              {getRelationshipIcon(relation.icon, `h-3 w-3 ${relation.color}`)}
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
                {RELATIONSHIP_TYPES.filter(relation => relationshipFilter.includes(relation.type)).map((relation) => {
                  const isDisabled = isRelationshipDisabled(relation.type);
                  
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
                        {getRelationshipIcon(relation.icon, `h-5 w-5 ${relation.color}`)}
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
                        relationshipExists(sourceNode.id, node.id, selectedRelationType, existingEdges, workItems)
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
                        !relationshipExists(sourceNode.id, node.id, selectedRelationType, existingEdges, workItems)
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
                        !relationshipExists(sourceNode.id, node.id, selectedRelationType, existingEdges, workItems)
                      ).length;
                      const isAllSelected = selectedCount === availableToConnect;
                      
                      return (
                        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-500/10 rounded-md border border-blue-400/20">
                          <Target className="h-3 w-3 text-blue-400" />
                          <span className="text-blue-300 font-medium text-xs">
                            {isAllSelected ? `All ${selectedCount}` : selectedCount} node{selectedCount !== 1 ? 's' : ''} selected to connect
                          </span>
                        </div>
                      );
                    })()}
                    
                    {/* No nodes available message */}
                    {(() => {
                      const availableToConnect = availableNodes.filter((node: WorkItem) => 
                        !relationshipExists(sourceNode.id, node.id, selectedRelationType, existingEdges, workItems)
                      ).length;
                      const alreadyConnectedCount = workItems.filter((node: WorkItem) =>
                        node.id !== sourceNode.id &&
                        relationshipExists(sourceNode.id, node.id, selectedRelationType, existingEdges, workItems)
                      ).length;
                      
                      if (availableToConnect === 0 && alreadyConnectedCount === 0) {
                        return (
                          <p className="text-xs text-gray-400">No nodes available for this relationship</p>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* No nodes available message */}
                    {(() => {
                      const availableToConnect = availableNodes.filter((node: WorkItem) => 
                        !relationshipExists(sourceNode.id, node.id, selectedRelationType, existingEdges, workItems)
                      ).length;
                      const alreadyConnectedCount = workItems.filter((node: WorkItem) =>
                        node.id !== sourceNode.id &&
                        relationshipExists(sourceNode.id, node.id, selectedRelationType, existingEdges, workItems)
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
                        {getRelationshipIcon(selectedRelation.icon, `h-3 w-3 ${selectedRelation.color}`)}
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
                          const relationshipType = RELATIONSHIP_TYPES.find(r => r.type === connection.type);
                          const isOutgoing = connection.direction === 'outgoing';
                          
                          return (
                            <div key={connection.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl border border-gray-600/20 hover:bg-gray-600/30 transition-all duration-200 group">
                              <div className="flex items-center space-x-4 text-sm">
                                <div className="flex items-center space-x-2 px-2 py-1 bg-gray-600/40 rounded-md">
                                  <span className="text-white font-semibold text-xs max-w-16 truncate">{sourceNode.title}</span>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <ArrowRight className={`h-3 w-3 ${isOutgoing ? (relationshipType?.color || 'text-gray-400') : 'text-gray-400'}`} />
                                  <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-gray-600/40">
                                    {relationshipType ? 
                                      getRelationshipIcon(relationshipType.icon, `h-3 w-3 ${relationshipType.color}`) :
                                      getRelationshipIcon('Link2', 'h-3 w-3 text-gray-400')
                                    }
                                    <span className={`text-xs font-medium ${relationshipType?.color || 'text-gray-400'}`}>
                                      {relationshipType?.label || connection.type}
                                      {!isOutgoing && ' ↩'}
                                    </span>
                                  </div>
                                  <ArrowRight className="h-3 w-3 text-gray-400" />
                                </div>

                                <div className="flex items-center space-x-2 px-2 py-1 bg-gray-600/40 rounded-md">
                                  <span className="text-gray-200 font-medium text-xs max-w-16 truncate">{connection.connectedNode.title}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null;
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
                      placeholder="Search nodes by title or type..."
                      className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 bg-gray-800 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                  >
                    <option value="all" className="bg-gray-800 text-white">All Status</option>
                    {uniqueStatuses.map((status: string) => (
                      <option key={status} value={status.toLowerCase()} className="bg-gray-800 text-white">{status}</option>
                    ))}
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-3 bg-gray-800 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                  >
                    <option value="all" className="bg-gray-800 text-white">All Types</option>
                    {uniqueTypes.map((type: string) => (
                      <option key={type} value={type.toLowerCase()} className="bg-gray-800 text-white">{type}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl border border-gray-600/30">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-emerald-400 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-300">
                        {availableNodes.filter((node: WorkItem) => 
                          !relationshipExists(sourceNode.id, node.id, selectedRelationType, existingEdges, workItems)
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
                    // Check if this node already has the selected relationship type with source node
                    const isNodeDisabled = relationshipExists(
                      sourceNode.id, 
                      node.id, 
                      selectedRelationType, 
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
                            console.log('Node button clicked!', node.id);
                            toggleNodeSelection(node.id);
                          }
                        }}
                        disabled={isNodeDisabled}
                        title={isNodeDisabled ? `"${selectedRelationType.replace(/_/g, ' ').toLowerCase()}" relationship already exists with this node` : ''}
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
                                  Already connected
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 text-xs">
                              <div className="flex items-center space-x-1">
                                <span 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getStatusColor(node.status) }}
                                />
                                <span className="text-gray-300 font-medium">{node.status}</span>
                              </div>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-300 font-medium">{node.type}</span>
                              {node.priorityComp && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-emerald-300 font-medium">{Math.round(node.priorityComp * 100)}%</span>
                                </>
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
                  disabled={selectedNodes.size === 0 || creatingConnection || isRelationshipDisabled(selectedRelationType)}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 font-semibold shadow-lg shadow-emerald-500/20 disabled:shadow-none"
                  title={isRelationshipDisabled(selectedRelationType) ? 'This relationship already exists between the selected nodes' : ''}
                >
                  <Link2 className="w-5 h-5" />
                  <span>
                    {creatingConnection ? 'Connecting...' : 
                     isRelationshipDisabled(selectedRelationType) ? 'Already Connected' :
                     `Connect ${selectedNodes.size} Node${selectedNodes.size !== 1 ? 's' : ''}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}