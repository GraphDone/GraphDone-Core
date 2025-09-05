import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, Flag, Edit3, Save, ChevronDown, Plus, Unlink, Trash2,
  GitBranch, ArrowRight, ArrowLeft, Ban, Link2, Folder, Split, Copy, Shield, Bookmark, Package,
  Sparkles, Hash, Crown, Activity, Gem, Rocket, Star, Brain
} from 'lucide-react';
import { useMutation } from '@apollo/client';
import { UPDATE_WORK_ITEM, GET_WORK_ITEMS, CREATE_EDGE, GET_EDGES, DELETE_EDGE, DELETE_WORK_ITEM } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  Calendar, Clock,
  Layers, Trophy, Target, ListTodo, AlertTriangle, Lightbulb, Microscope,
  ClipboardList, CheckCircle, AlertCircle, Flame, Zap, Triangle, Circle, ArrowDown,
  getRelationshipIconElement,
  getRelationshipConfig,
  RelationshipType,
  WorkItemType,
  WorkItemStatus,
  getTypeConfig,
  getStatusConfig,
  getPriorityConfig,
  getTypeIconElement,
  getStatusIconElement,
  getPriorityIconElement,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  DEFAULT_NODE_CONFIG,
  RELATIONSHIP_TYPES,
  getTypeColorScheme,
  getStatusColorScheme,
  getPriorityColorScheme
} from '../constants/workItemConstants';
import { WorkItem, WorkItemEdge } from '../types/graph';

interface NodeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: WorkItem | null;
  edges?: WorkItemEdge[];
  nodes?: WorkItem[];
  onEdit?: (node: WorkItem) => void;
  onConnectToExisting?: (node: WorkItem) => void;
  onDisconnect?: (node: WorkItem) => void;
  onDelete?: (node: WorkItem) => void;
}

export function NodeDetailsModal({ 
  isOpen, 
  onClose, 
  node, 
  edges = [], 
  nodes = [], 
  onEdit,
  onConnectToExisting,
  onDisconnect,
  onDelete 
}: NodeDetailsModalProps) {
  const { currentGraph } = useGraph();
  const { showSuccess, showError, showWarning } = useNotifications();
  const [editedNode, setEditedNode] = useState<WorkItem | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showConnectDropdown, setShowConnectDropdown] = useState(false);
  const [showDisconnectDropdown, setShowDisconnectDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedNodesForConnection, setSelectedNodesForConnection] = useState<string[]>([]);
  const [selectedEdgesForDisconnection, setSelectedEdgesForDisconnection] = useState<string[]>([]);
  const connectDropdownRef = useRef<HTMLDivElement>(null);
  const disconnectDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (node) {
      setEditedNode({ ...node });
    }
  }, [node]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (connectDropdownRef.current && !connectDropdownRef.current.contains(event.target as Node)) {
        setShowConnectDropdown(false);
      }
      if (disconnectDropdownRef.current && !disconnectDropdownRef.current.contains(event.target as Node)) {
        setShowDisconnectDropdown(false);
      }
    }

    if (showConnectDropdown || showDisconnectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return () => {}; // Ensure all code paths return a value
  }, [showConnectDropdown, showDisconnectDropdown]);

  const [createEdge] = useMutation(CREATE_EDGE, {
    refetchQueries: [{ query: GET_EDGES }],
    // Remove individual success messages - we'll show a batch message instead
    onError: (error) => {
      showError(`Failed to create connection: ${error.message}`);
    }
  });

  const [deleteEdge] = useMutation(DELETE_EDGE, {
    refetchQueries: [{ query: GET_EDGES }],
    // Remove individual success messages - we'll show a batch message instead
    onError: (error) => {
      showError(`Failed to remove connection: ${error.message}`);
    }
  });

  // Toggle node selection for batch connection
  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodesForConnection(prev => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  // Toggle edge selection for batch disconnection
  const toggleEdgeSelection = (edgeId: string) => {
    setSelectedEdgesForDisconnection(prev => 
      prev.includes(edgeId) 
        ? prev.filter(id => id !== edgeId)
        : [...prev, edgeId]
    );
  };

  // Connect to selected nodes
  const handleConnectSelected = async () => {
    if (selectedNodesForConnection.length === 0) return;
    
    const count = selectedNodesForConnection.length;
    const isPlural = count > 1;
    
    try {
      const edgeInputs = selectedNodesForConnection.map(targetNodeId => ({
        type: RELATIONSHIP_TYPES.DEFAULT_EDGE.type,
        weight: 1.0,
        source: { connect: { where: { node: { id: currentNode.id } } } },
        target: { connect: { where: { node: { id: targetNodeId } } } }
      }));

      await createEdge({
        variables: { input: edgeInputs }
      });

      showSuccess(`Connected to ${count} node${isPlural ? 's' : ''} successfully`);
      setSelectedNodesForConnection([]);
      setShowConnectDropdown(false);
    } catch (error) {
      console.error('Error creating connections:', error);
      showError('Failed to create some connections');
    }
  };

  // Disconnect selected edges
  const handleDisconnectSelected = async () => {
    if (selectedEdgesForDisconnection.length === 0) return;
    
    const count = selectedEdgesForDisconnection.length;
    const isPlural = count > 1;
    
    try {
      for (const edgeId of selectedEdgesForDisconnection) {
        await deleteEdge({
          variables: { where: { id: edgeId } }
        });
      }

      showSuccess(`Removed ${count} connection${isPlural ? 's' : ''} successfully`);
      setSelectedEdgesForDisconnection([]);
      setShowDisconnectDropdown(false);
    } catch (error) {
      console.error('Error removing connections:', error);
      showError('Failed to remove some connections');
    }
  };

  // Handle disconnecting from a node
  const handleDisconnect = async (edgeId: string) => {
    try {
      await deleteEdge({
        variables: {
          where: { id: edgeId }
        }
      });
    } catch (error) {
      console.error('Error removing connection:', error);
    }
  };

  const [updateWorkItem, { loading: updating }] = useMutation(UPDATE_WORK_ITEM, {
    refetchQueries: [
      { 
        query: GET_WORK_ITEMS,
        variables: currentGraph ? {
          where: { graph: { id: currentGraph.id } }
        } : { where: {} }
      }
    ],
    onCompleted: () => {
      showSuccess('Node updated successfully');
    },
    onError: (error) => {
      showError(`Failed to update node: ${error.message}`);
    }
  });

  const [deleteWorkItem, { loading: deleting }] = useMutation(DELETE_WORK_ITEM, {
    refetchQueries: [
      { 
        query: GET_WORK_ITEMS,
        variables: currentGraph ? {
          where: { graph: { id: currentGraph.id } }
        } : { where: {} }
      },
      { query: GET_EDGES }
    ],
    onCompleted: () => {
      showSuccess('Node deleted successfully');
      onClose();
    },
    onError: (error) => {
      showError(`Failed to delete node: ${error.message}`);
    }
  });

  const handleSave = async () => {
    if (!editedNode || !node) return;

    try {
      const updateInput: any = {
        title: editedNode.title,
        description: editedNode.description,
        type: editedNode.type,
        status: editedNode.status,
        priority: editedNode.priority,
        tags: editedNode.tags || [],
        dueDate: editedNode.dueDate,
      };

      // Handle assignedTo relationship properly for Neo4j GraphQL
      const currentAssignedToId = typeof node.assignedTo === 'string' ? node.assignedTo : node.assignedTo?.id;
      const newAssignedToId = typeof editedNode.assignedTo === 'string' ? editedNode.assignedTo : editedNode.assignedTo?.id;
      
      if (newAssignedToId && newAssignedToId !== currentAssignedToId) {
        // Connect to new user
        updateInput.assignedTo = {
          connect: {
            where: { node: { id: newAssignedToId } }
          }
        };
      } else if (!newAssignedToId && currentAssignedToId) {
        // Disconnect current user
        updateInput.assignedTo = {
          disconnect: {
            where: { node: { id: currentAssignedToId } }
          }
        };
      }

      await updateWorkItem({
        variables: {
          where: { id: node.id },
          update: updateInput
        }
      });
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  };

  const handleDelete = async () => {
    if (!node) return;

    // Check if node has any connections
    const hasConnections = nodeConnections.length > 0;
    
    if (hasConnections) {
      // Use warning notification (yellow/orange) instead of error (red)
      showWarning(
        'Cannot Delete Node',
        `This node has ${nodeConnections.length} connection(s). Please disconnect all relationships first before deleting.`
      );
      return;
    }

    // Show inline confirmation instead of browser popup
    setShowDeleteConfirm(true);
    setDeleteConfirmed(false); // Reset checkbox
  };

  const confirmDelete = async () => {
    if (!node) return;

    try {
      await deleteWorkItem({
        variables: {
          where: { id: node.id }
        }
      });
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  
  if (!isOpen || !node) return null;

  const currentNode = editedNode || node;

  // Check if any changes have been made
  const hasChanges = editedNode && node && (
    editedNode.title !== node.title ||
    editedNode.description !== node.description ||
    editedNode.type !== node.type ||
    editedNode.status !== node.status ||
    editedNode.priority !== node.priority ||
    JSON.stringify(editedNode.tags || []) !== JSON.stringify(node.tags || []) ||
    (typeof editedNode.assignedTo === 'string' ? editedNode.assignedTo : editedNode.assignedTo?.id) !== 
    (typeof node.assignedTo === 'string' ? node.assignedTo : node.assignedTo?.id) ||
    editedNode.dueDate !== node.dueDate
  );

  // Use the same priority calculation as ListView for consistency
  const getNodePriority = (node: WorkItem) => {
    return node.priority || 0;
  };
  
  const totalPriority = getNodePriority(currentNode);

  const getStatusColor = (status: string) => {
    const statusScheme = getStatusColorScheme(status as WorkItemStatus);
    return `${statusScheme.text} ${statusScheme.background}`;
  };

  const getStatusIcon = (status: string) => {
    return getStatusIconElement(status as WorkItemStatus, "h-5 w-5");
  };

  const getTypeColor = (type: string) => {
    const typeScheme = getTypeColorScheme(type as WorkItemType);
    return `${typeScheme.text} ${typeScheme.background}`;
  };

  const getTypeIcon = (type: string) => {
    return getTypeIconElement(type as WorkItemType, "h-5 w-5");
  };

  const getPriorityIcon = (priority: number) => {
    return getPriorityIconElement(priority, "h-5 w-5");
  };

  // Use the same priority levels as ListView (0.0-1.0 scale)
  const getPriorityLevel = (priority: number) => {
    const config = getPriorityConfig(priority);
    return { 
      label: config.label, 
      color: `${config.color} ${config.bgColor}`, 
      flagColor: config.color 
    };
  };

  const formatDate = (dateString: string) => {
    // Parse the ISO date string directly to avoid timezone issues
    const date = new Date(dateString);
    const day = date.getUTCDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
  };

  const priorityInfo = getPriorityLevel(editedNode?.priority || totalPriority);

  // Get connections for this node
  const nodeConnections = edges.filter(edge => 
    edge.source === currentNode.id || edge.target === currentNode.id
  );

  const incomingConnections = nodeConnections.filter(edge => edge.target === currentNode.id);
  const outgoingConnections = nodeConnections.filter(edge => edge.source === currentNode.id);


  const getConnectedNode = (nodeId: string) => {
    return nodes.find(n => n.id === nodeId);
  };

  // Get nodes available for connection (exclude current node and already connected nodes)
  const getAvailableNodes = () => {
    const connectedNodeIds = nodeConnections.map(edge => 
      edge.source === currentNode.id ? edge.target : edge.source
    );
    return nodes.filter(n => 
      n.id !== currentNode.id && !connectedNodeIds.includes(n.id)
    );
  };

  // Get currently connected nodes with their connection info
  const getConnectedNodes = () => {
    return nodeConnections.map(edge => {
      const isIncoming = edge.target === currentNode.id;
      const connectedNodeId = isIncoming ? edge.source : edge.target;
      const connectedNode = getConnectedNode(connectedNodeId);
      return {
        node: connectedNode,
        edge,
        isIncoming
      };
    }).filter(item => item.node);
  };

  const getRelationshipColor = (type: string) => {
    const config = getRelationshipConfig(type as RelationshipType);
    return `${config.color} ${config.color.replace('text-', 'bg-')}/10`;
  };

  const getRelationshipDisplayName = (type: string) => {
    const config = getRelationshipConfig(type as RelationshipType);
    return config.label;
  };

  const getRelationshipIcon = (type: string) => {
    return getRelationshipIconElement(type as RelationshipType, "h-4 w-4");
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 cursor-pointer" 
        onClick={onClose}
      />
      <div 
        className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-600/50 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl animate-in fade-in zoom-in-95 duration-300 ring-1 ring-white/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-green-500 to-purple-500"></div>
        
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}></div>
        </div>

        {/* Enhanced Header */}
        <div className="relative flex items-center justify-between p-8 border-b border-gray-600/50 bg-gradient-to-r from-gray-800/30 via-gray-700/20 to-gray-800/30 backdrop-blur-sm">
          <div className="flex items-center space-x-20">
            {/* Enhanced Clickable Type Badge */}
            <div className="relative">
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className={`flex items-center space-x-3 px-5 py-3 rounded-xl text-sm font-semibold hover:scale-105 transition-all duration-200 cursor-pointer shadow-lg backdrop-blur-sm ${getTypeColor(currentNode.type)} border border-opacity-30 hover:border-opacity-50`}
              >
                <div className="flex items-center space-x-2">
                  {getTypeIcon(currentNode.type)}
                  <span className="bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent font-bold">{currentNode.type}</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </button>
              
              {/* Enhanced Type Dropdown */}
              {showTypeDropdown && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-gray-900 border-2 border-gray-500 rounded-lg shadow-2xl z-[9999] max-h-[350px] overflow-y-auto overflow-x-hidden">
                  {TYPE_OPTIONS.filter(opt => opt.value !== 'all').map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setEditedNode(prev => prev ? { ...prev, type: type.value as WorkItemType } : null);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-600 last:border-b-0 ${getTypeColorScheme(type.value as WorkItemType).text} text-white`}
                    >
                      <div className="flex items-center space-x-2">
                        {type.icon && <type.icon className={`h-4 w-4 ${getTypeColorScheme(type.value as WorkItemType).text}`} />}
                        <span>{type.label}</span>
                      </div>
                      {currentNode.type === type.value && (
                        <span className="text-green-400 ml-1">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Enhanced Clickable Status Badge */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className={`flex items-center space-x-3 px-5 py-3 rounded-xl text-sm font-semibold hover:scale-105 transition-all duration-200 cursor-pointer shadow-lg backdrop-blur-sm ${getStatusColor(currentNode.status)} border border-opacity-30 hover:border-opacity-50`}
              >
                <div className="flex items-center space-x-2">
                  {getStatusIcon(currentNode.status)}
                  <span className="bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent font-bold">{currentNode.status.replace(/_/g, ' ')}</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </button>
              
              {/* Enhanced Status Dropdown */}
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-gray-900 border-2 border-gray-500 rounded-lg shadow-2xl z-[9999] max-h-[350px] overflow-y-auto overflow-x-hidden">
                  {STATUS_OPTIONS.filter(opt => opt.value !== 'all').map((status) => (
                    <button
                      key={status.value}
                      onClick={() => {
                        setEditedNode(prev => prev ? { ...prev, status: status.value as WorkItemStatus } : null);
                        setShowStatusDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-600 last:border-b-0 ${getStatusColorScheme(status.value as WorkItemStatus).text} text-white`}
                    >
                      <div className="flex items-center space-x-2">
                        {status.icon && <status.icon className={`h-4 w-4 ${getStatusColorScheme(status.value as WorkItemStatus).text}`} />}
                        <span>{status.label}</span>
                      </div>
                      {currentNode.status === status.value && (
                        <span className="text-green-400 ml-2">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              disabled={updating || !hasChanges}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-300 text-sm font-semibold shadow-lg ${
                hasChanges && !updating
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 hover:scale-105 transform border border-green-400/30'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600'
              }`}
              title={hasChanges ? "Save Changes" : "No changes to save"}
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
            <button
              onClick={onClose}
              className="p-3 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110 shadow-lg backdrop-blur-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Enhanced Content */}
        <div className="flex p-8 gap-8 bg-gradient-to-br from-gray-800/20 via-transparent to-gray-900/20">
          {/* Enhanced Left Column - Main Content */}
          <div className="flex-1">
          {/* Enhanced Title - Always Editable */}
          <div className="mb-6">
            <input
              type="text"
              value={editedNode?.title || ''}
              onChange={(e) => setEditedNode(prev => prev ? { ...prev, title: e.target.value } : null)}
              className="text-2xl font-bold bg-gray-800 border border-gray-600 text-white placeholder-gray-400 mb-2 w-full focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 hover:border-gray-500 p-4 rounded-xl shadow-lg cursor-text"
              placeholder="Enter title..."
              autoComplete="off"
            />
          </div>

          {/* Enhanced Description - Always Editable */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
              <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg mr-3 border border-emerald-500/30">
                <Edit3 className="h-4 w-4 text-emerald-400" />
              </div>
              Description
            </h3>
            <textarea
              value={editedNode?.description || ''}
              onChange={(e) => setEditedNode(prev => prev ? { ...prev, description: e.target.value } : null)}
              className="w-full text-white bg-gray-800 border border-gray-600 rounded-xl placeholder-gray-400 p-5 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 resize-none hover:border-gray-500 shadow-lg cursor-text"
              placeholder="Enter description"
              rows={4}
              autoComplete="off"
            />
          </div>


          {/* Enhanced Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Enhanced Priority - Editable */}
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
                <div className={`p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg mr-3 border border-orange-500/30`}>
                  <Flag className={`h-4 w-4 ${priorityInfo.flagColor}`} />
                </div>
                Priority
              </h3>
              <div className="space-y-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editedNode?.priority || 0}
                  onChange={(e) => setEditedNode(prev => prev ? { ...prev, priority: parseFloat(e.target.value) } : null)}
                  className={`w-full h-3 bg-gray-700/50 rounded-xl appearance-none cursor-pointer slider shadow-inner ${
                    getPriorityConfig(editedNode?.priority || 0).value === 'critical' ? 'accent-red-500' :
                    getPriorityConfig(editedNode?.priority || 0).value === 'high' ? 'accent-orange-500' :
                    getPriorityConfig(editedNode?.priority || 0).value === 'moderate' ? 'accent-yellow-500' :
                    getPriorityConfig(editedNode?.priority || 0).value === 'low' ? 'accent-blue-500' :
                    'accent-gray-500'
                  }`}
                  style={{
                    background: `linear-gradient(to right, ${
                      getPriorityColorScheme(editedNode?.priority || 0).hex
                    } 0%, ${
                      getPriorityColorScheme(editedNode?.priority || 0).hex
                    } ${((editedNode?.priority || 0) * 100)}%, #374151 ${((editedNode?.priority || 0) * 100)}%, #374151 100%)`
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className={`flex items-center space-x-3 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg ${priorityInfo.color} ${getPriorityColorScheme(editedNode?.priority || 0).background} border border-opacity-30`}>
                    {getPriorityIconElement(editedNode?.priority || 0, "h-4 w-4")}
                    <span>{priorityInfo.label}</span>
                  </span>
                  <span className="text-gray-300 text-sm font-medium bg-gray-700/30 px-3 py-1 rounded-lg">{Math.round((editedNode?.priority || 0) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Enhanced Assigned To - Editable */}
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
                <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg mr-3 border border-violet-500/30">
                  <User className="h-4 w-4 text-violet-400" />
                </div>
                Contributor
              </h3>
              <div className="relative">
                <select
                  value={typeof editedNode?.assignedTo === 'string' ? editedNode.assignedTo : (editedNode?.assignedTo?.id || '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditedNode(prev => prev ? { 
                      ...prev, 
                      assignedTo: value ? { id: value, name: e.target.selectedOptions[0].text.split(' (')[0], username: value } : undefined 
                    } : null);
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 appearance-none hover:border-gray-500 shadow-lg font-medium"
                >
                  <option value="">No contributor</option>
                  <option value="user-1">John Doe (@john)</option>
                  <option value="user-2">Jane Smith (@jane)</option>
                  <option value="user-3">Mike Johnson (@mike)</option>
                  <option value="user-4">Sarah Wilson (@sarah)</option>
                  <option value="user-5">Alex Chen (@alex)</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
              {editedNode?.assignedTo && typeof editedNode.assignedTo === 'object' && (
                <div className="mt-2 text-xs text-gray-500">@{editedNode.assignedTo.username}</div>
              )}
            </div>

            {/* Enhanced Owner */}
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
                <div className="p-2 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-lg mr-3 border border-amber-500/30">
                  <Crown className="h-4 w-4 text-amber-400" />
                </div>
                Owner
              </h3>
              {currentNode.owner ? (
                <div className="bg-gradient-to-r from-gray-700/50 to-gray-600/30 border border-gray-600/40 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-gray-200 font-medium">{currentNode.owner.name}</div>
                  <div className="text-gray-400 text-sm mt-1">@{currentNode.owner.username}</div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-gray-700/50 to-gray-600/30 border border-gray-600/40 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-gray-200 font-medium">System Administrator</div>
                  <div className="text-gray-400 text-sm mt-1">@admin</div>
                </div>
              )}
            </div>

            {/* Enhanced Due Date - Editable */}
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
                <div className="p-2 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg mr-3 border border-teal-500/30">
                  <Calendar className="h-4 w-4 text-teal-400" />
                </div>
                Due Date
              </h3>
              <input
                type="date"
                value={editedNode?.dueDate ? editedNode.dueDate.split('T')[0] : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditedNode(prev => prev ? { 
                    ...prev, 
                    dueDate: value ? `${value}T23:59:59.999Z` : undefined 
                  } : null);
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-5 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 hover:border-gray-500 shadow-lg font-medium"
                placeholder="dd/mm/yyyy"
              />
              {editedNode?.dueDate && (
                <div className="mt-1 text-xs text-gray-500">
                  {formatDate(editedNode.dueDate)}
                </div>
              )}
            </div>

          </div>

          {/* Enhanced Tags - Editable */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
              <div className="p-2 bg-gradient-to-br from-sky-500/20 to-blue-500/20 rounded-lg mr-3 border border-sky-500/30">
                <Hash className="h-4 w-4 text-sky-400" />
              </div>
              Tags
            </h3>
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-xl p-5 shadow-lg backdrop-blur-sm">
              <div className="flex flex-wrap gap-3">
                {/* Enhanced Existing Tags */}
                {editedNode?.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="flex items-center px-3 py-2 bg-gradient-to-r from-gray-700/60 to-gray-600/40 text-gray-200 rounded-lg text-xs font-medium group hover:from-gray-600/60 hover:to-gray-500/40 transition-all duration-200 hover:scale-105 shadow-md border border-gray-600/30"
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => {
                        const newTags = editedNode.tags?.filter((_, i) => i !== index) || [];
                        setEditedNode(prev => prev ? { ...prev, tags: newTags } : null);
                      }}
                      className="ml-2 text-gray-400 hover:text-red-400 transition-all duration-200 hover:scale-125"
                      title="Remove tag"
                    >
                      ×
                    </button>
                  </span>
              ))}
                
                {/* Enhanced Inline Add Tag Input */}
                {(!editedNode?.tags || editedNode.tags.length < 5) && (
                  <div className="flex items-center">
                    <input
                      type="text"
                      placeholder="Add Tag"
                      className="text-xs bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 min-w-20 shadow-lg font-medium"
                      style={{ width: `${Math.max(20, 8)}ch` }}
                      onInput={(e) => {
                        const input = e.target as HTMLInputElement;
                        const textLength = input.value.length;
                        input.style.width = `${Math.max(20, textLength + 2)}ch`;
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          const newTag = input.value.trim();
                          const currentTags = editedNode?.tags || [];
                          if (newTag && !currentTags.includes(newTag) && currentTags.length < 5) {
                            setEditedNode(prev => prev ? { ...prev, tags: [...currentTags, newTag] } : null);
                            input.value = '';
                            input.style.width = '20ch';
                          }
                        }
                      }}
                    />
                  </div>
                )}
                
                {/* Enhanced Max tags indicator */}
                {editedNode?.tags && editedNode.tags.length >= 5 && (
                  <span className="text-xs text-amber-400 italic font-medium bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">Max 5 tags</span>
                )}
              </div>
              {/* Tip for creating tags */}
              <div className="mt-3 text-xs text-gray-400 italic flex items-center">
                <div className="w-1 h-1 bg-sky-400 rounded-full mr-2"></div>
                Type and press Enter to create tags • Maximum 5 tags allowed
              </div>
            </div>
          </div>

          {/* Enhanced Timestamps */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
              <div className="p-2 bg-gradient-to-br from-lime-500/20 to-green-500/20 rounded-lg mr-3 border border-lime-500/30">
                <Clock className="h-4 w-4 text-lime-400" />
              </div>
              Timestamps
            </h3>
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-3">
              {currentNode.createdAt && (
                <div className="text-sm flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Created:</span> 
                  <span className="text-gray-200 font-semibold bg-gray-700/50 px-3 py-1 rounded-lg">{formatDate(currentNode.createdAt)}</span>
                </div>
              )}
              {currentNode.updatedAt && (
                <div className="text-sm flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Updated:</span> 
                  <span className="text-gray-200 font-semibold bg-gray-700/50 px-3 py-1 rounded-lg">{formatDate(currentNode.updatedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Connections */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-6 flex items-center">
              <div className="p-2 bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 rounded-lg mr-3 border border-fuchsia-500/30">
                <GitBranch className="h-4 w-4 text-fuchsia-400" />
              </div>
              Connections ({nodeConnections.length})
            </h3>
            
            {nodeConnections.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-xl p-8 shadow-lg backdrop-blur-sm text-center">
                <div className="p-4 bg-gradient-to-br from-gray-700/30 to-gray-600/20 rounded-xl inline-block mb-4 border border-gray-600/30">
                  <GitBranch className="h-12 w-12 text-gray-500 mx-auto" />
                </div>
                <p className="text-gray-400 text-sm font-medium mb-2">No connections yet</p>
                <p className="text-gray-500 text-xs">Connect this node to other nodes to see relationships here</p>
              </div>
            ) : (
              
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-xl p-6 shadow-lg backdrop-blur-sm space-y-6">
                {/* Enhanced Incoming Connections */}
                {incomingConnections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                      <div className="p-2 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-lg mr-3 border border-red-500/30">
                        <ArrowRight className="h-4 w-4 text-red-400" />
                      </div>
                      Incoming ({incomingConnections.length})
                    </h4>
                    <div className="space-y-3">
                      {incomingConnections.map((edge) => {
                        const connectedNode = getConnectedNode(edge.source);
                        return (
                          <div key={edge.id} className="p-4 bg-gradient-to-r from-red-900/30 to-gray-800/50 border border-red-500/30 rounded-xl hover:from-red-900/40 hover:to-gray-800/60 hover:border-red-400/40 transition-all duration-200 hover:scale-[1.02] shadow-md backdrop-blur-sm">
                            <div className="flex items-start gap-2">
                              {connectedNode && (
                                <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-sm font-medium ${getTypeColor(connectedNode.type)}`}>
                                  {getTypeIcon(connectedNode.type)}
                                  <span>{connectedNode.title}</span>
                                </div>
                              )}
                              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${getRelationshipColor(edge.type)} flex-shrink-0`}>
                                {getRelationshipIcon(edge.type)}
                                <span className="whitespace-nowrap">{getRelationshipDisplayName(edge.type)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Enhanced Outgoing Connections */}
                {outgoingConnections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                      <div className="p-2 bg-gradient-to-br from-purple-500/20 to-violet-500/20 rounded-lg mr-3 border border-purple-500/30">
                        <ArrowLeft className="h-4 w-4 text-purple-400" />
                      </div>
                      Outgoing ({outgoingConnections.length})
                    </h4>
                    <div className="space-y-3">
                      {outgoingConnections.map((edge) => {
                        const connectedNode = getConnectedNode(edge.target);
                        return (
                          <div key={edge.id} className="p-4 bg-gradient-to-r from-purple-900/30 to-gray-800/50 border border-purple-500/30 rounded-xl hover:from-purple-900/40 hover:to-gray-800/60 hover:border-purple-400/40 transition-all duration-200 hover:scale-[1.02] shadow-md backdrop-blur-sm">
                            <div className="flex items-start gap-2">
                              {connectedNode && (
                                <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-sm font-medium ${getTypeColor(connectedNode.type)}`}>
                                  {getTypeIcon(connectedNode.type)}
                                  <span>{connectedNode.title}</span>
                                </div>
                              )}
                              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${getRelationshipColor(edge.type)} flex-shrink-0`}>
                                {getRelationshipIcon(edge.type)}
                                <span className="whitespace-nowrap">{getRelationshipDisplayName(edge.type)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Enhanced Node ID */}
            <div className="mt-8 pt-6 border-t border-gray-600/50">
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-xl p-5 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-lg border border-amber-500/30">
                      <Star className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="text-sm text-gray-300 uppercase font-semibold">Node ID</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-600/40">{currentNode.id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Right Column - Action Buttons */}
          <div className="w-56 flex-shrink-0 relative">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-6 flex items-center">
              <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg mr-3 border border-cyan-500/30">
                <Rocket className="h-4 w-4 text-cyan-400" />
              </div>
              Actions
            </h3>
            <div className="space-y-4">
              {/* Enhanced Connect Dropdown */}
              <div className="relative" ref={connectDropdownRef}>
                <button
                  onClick={() => setShowConnectDropdown(!showConnectDropdown)}
                  disabled={getAvailableNodes().length === 0}
                  className="w-full flex items-center justify-between space-x-2 px-5 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 text-sm font-semibold shadow-lg hover:scale-105 transform border border-green-400/30"
                >
                  <div className="flex items-center space-x-2">
                    <Link2 className="h-4 w-4" />
                    <span>Connect ({getAvailableNodes().length})</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showConnectDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showConnectDropdown && getAvailableNodes().length > 0 && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-gray-900 border border-gray-600 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                    {/* Multi-select list */}
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {getAvailableNodes().map((availableNode) => (
                        <label
                          key={availableNode.id}
                          className="flex items-center space-x-3 p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                        >
                          <div
                            onClick={() => toggleNodeSelection(availableNode.id)}
                            className={`w-4 h-4 min-w-[16px] min-h-[16px] border flex items-center justify-center transition-colors cursor-pointer ${
                              selectedNodesForConnection.includes(availableNode.id)
                                ? 'bg-green-600 border-green-600' 
                                : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                            }`}
                          >
                            {selectedNodesForConnection.includes(availableNode.id) && (
                              <span className="text-white text-xs font-bold">✓</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 flex-1">
                            {getTypeIcon(availableNode.type)}
                            <div>
                              <div className="text-white font-medium text-sm">{availableNode.title}</div>
                              <div className="text-xs text-gray-400">{availableNode.type}</div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="border-t border-gray-600 p-2 space-y-2">
                      <button
                        onClick={handleConnectSelected}
                        disabled={selectedNodesForConnection.length === 0}
                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
                      >
                        Connect Selected ({selectedNodesForConnection.length})
                      </button>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedNodesForConnection(getAvailableNodes().map(n => n.id))}
                          className="flex-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedNodesForConnection([])}
                          className="flex-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Disconnect Dropdown */}
              <div className="relative" ref={disconnectDropdownRef}>
                <button
                  onClick={() => setShowDisconnectDropdown(!showDisconnectDropdown)}
                  disabled={getConnectedNodes().length === 0}
                  className="w-full flex items-center justify-between space-x-2 px-5 py-4 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 text-sm font-semibold shadow-lg hover:scale-105 transform border border-yellow-400/30"
                >
                  <div className="flex items-center space-x-2">
                    <Unlink className="h-4 w-4" />
                    <span>Disconnect ({getConnectedNodes().length})</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showDisconnectDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showDisconnectDropdown && getConnectedNodes().length > 0 && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-gray-900 border border-gray-600 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                    {/* Multi-select list */}
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {getConnectedNodes().map(({ node: connectedNode, edge, isIncoming }) => (
                        <label
                          key={edge.id}
                          className="flex items-center space-x-3 p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                        >
                          <div
                            onClick={() => toggleEdgeSelection(edge.id)}
                            className={`w-4 h-4 min-w-[16px] min-h-[16px] border flex items-center justify-center transition-colors cursor-pointer ${
                              selectedEdgesForDisconnection.includes(edge.id)
                                ? 'bg-yellow-600 border-yellow-600' 
                                : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                            }`}
                          >
                            {selectedEdgesForDisconnection.includes(edge.id) && (
                              <span className="text-white text-xs font-bold">✓</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 flex-1">
                            {getTypeIcon(connectedNode!.type)}
                            <div>
                              <div className="text-white font-medium text-sm">{connectedNode!.title}</div>
                              <div className="text-xs text-gray-400">{connectedNode!.type}</div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="border-t border-gray-600 p-2 space-y-2">
                      <button
                        onClick={handleDisconnectSelected}
                        disabled={selectedEdgesForDisconnection.length === 0}
                        className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
                      >
                        Remove Selected ({selectedEdgesForDisconnection.length})
                      </button>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedEdgesForDisconnection(getConnectedNodes().map(item => item.edge.id))}
                          className="flex-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedEdgesForDisconnection([])}
                          className="flex-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!showDeleteConfirm ? (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center justify-center space-x-2 px-5 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-red-400 disabled:to-rose-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 text-sm font-semibold shadow-lg hover:scale-105 transform border border-red-400/30"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{deleting ? 'Deleting...' : 'Delete Node'}</span>
                </button>
              ) : (
                <div className="space-y-4 p-6 bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-500/40 rounded-xl shadow-lg backdrop-blur-sm">
                  <div className="text-sm text-red-300 text-center font-semibold">
                    Delete "{currentNode.title}"?
                  </div>
                  <div className="text-xs text-red-400 text-center leading-relaxed">
                    This action cannot be undone and will permanently remove this node.
                  </div>
                  
                  {/* Confirmation Checkbox */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <div
                      onClick={() => setDeleteConfirmed(!deleteConfirmed)}
                      className={`w-4 h-4 min-w-[16px] min-h-[16px] border flex items-center justify-center transition-colors cursor-pointer ${
                        deleteConfirmed 
                          ? 'bg-red-600 border-red-600' 
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {deleteConfirmed && (
                        <span className="text-white text-xs font-bold">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      I understand this action cannot be undone
                    </span>
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmed(false);
                      }}
                      className="px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white rounded-xl transition-all duration-200 text-sm font-semibold shadow-lg hover:scale-105 transform"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={deleting || !deleteConfirmed}
                      className="px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-red-400 disabled:to-rose-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 text-sm font-semibold shadow-lg hover:scale-105 transform"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}