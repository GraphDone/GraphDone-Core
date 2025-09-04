import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, Flag, Edit3, Save, ChevronDown, Plus, Unlink, Trash2,
  GitBranch, ArrowRight, ArrowLeft, Ban, Link2, Folder, Split, Copy, Shield, Bookmark, Package
} from 'lucide-react';
import { useMutation } from '@apollo/client';
import { UPDATE_WORK_ITEM, GET_WORK_ITEMS, CREATE_EDGE, GET_EDGES, DELETE_EDGE, DELETE_WORK_ITEM } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  Calendar, Clock,
  Layers, Trophy, Target, Sparkles, ListTodo, AlertTriangle, Lightbulb, Microscope,
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
    return getRelationshipIconElement(type as RelationshipType, "h-3 w-3");
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 cursor-pointer" 
        onClick={onClose}
      />
      <div 
        className="relative bg-gray-900 border border-gray-700 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-8">
            {/* Clickable Type Badge */}
            <div className="relative">
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium hover:opacity-80 transition-opacity cursor-pointer ${getTypeColor(currentNode.type)}`}
              >
                {getTypeIcon(currentNode.type)}
                <span>{currentNode.type}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              
              {/* Type Dropdown */}
              {showTypeDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
                  {TYPE_OPTIONS.filter(opt => opt.value !== 'all').map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setEditedNode(prev => prev ? { ...prev, type: type.value as WorkItemType } : null);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 transition-colors text-left ${getTypeColorScheme(type.value as WorkItemType).text}`}
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

            {/* Clickable Status Badge */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium hover:opacity-80 transition-opacity cursor-pointer ${getStatusColor(currentNode.status)}`}
              >
                {getStatusIcon(currentNode.status)}
                <span>{currentNode.status.replace(/_/g, ' ')}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              
              {/* Status Dropdown */}
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
                  {STATUS_OPTIONS.filter(opt => opt.value !== 'all').map((status) => (
                    <button
                      key={status.value}
                      onClick={() => {
                        setEditedNode(prev => prev ? { ...prev, status: status.value as WorkItemStatus } : null);
                        setShowStatusDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 transition-colors text-left ${getStatusColorScheme(status.value as WorkItemStatus).text}`}
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
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={updating || !hasChanges}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                hasChanges && !updating
                  ? 'text-green-400 hover:text-green-300 hover:bg-gray-800'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
              title={hasChanges ? "Save Changes" : "No changes to save"}
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex p-4 gap-4">
          {/* Left Column - Main Content */}
          <div className="flex-1">
          {/* Title - Always Editable */}
          <input
            type="text"
            value={editedNode?.title || ''}
            onChange={(e) => setEditedNode(prev => prev ? { ...prev, title: e.target.value } : null)}
            className="text-xl font-semibold bg-transparent border-b border-gray-700 text-white mb-3 w-full focus:outline-none focus:border-blue-500 transition-colors hover:border-gray-600 pb-1"
            placeholder="Enter title..."
          />

          {/* Description - Always Editable */}
          <div className="mb-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Description</h3>
            <textarea
              value={editedNode?.description || ''}
              onChange={(e) => setEditedNode(prev => prev ? { ...prev, description: e.target.value } : null)}
              className="w-full text-gray-300 bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors resize-none hover:border-gray-500"
              placeholder="Enter description..."
              rows={4}
            />
          </div>


          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority - Editable */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                <Flag className={`h-3 w-3 mr-1.5 ${priorityInfo.flagColor}`} />
                Priority
              </h3>
              <div className="space-y-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editedNode?.priority || 0}
                  onChange={(e) => setEditedNode(prev => prev ? { ...prev, priority: parseFloat(e.target.value) } : null)}
                  className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ${
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
                  <span className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium ${priorityInfo.color} ${getPriorityColorScheme(editedNode?.priority || 0).background}`}>
                    {getPriorityIconElement(editedNode?.priority || 0, "h-4 w-4")}
                    <span>{priorityInfo.label}</span>
                  </span>
                  <span className="text-gray-400 text-sm">{Math.round((editedNode?.priority || 0) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Assigned To - Editable */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                <User className="h-3 w-3 mr-1.5" />
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
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 transition-colors appearance-none hover:border-gray-500"
                >
                  <option value="">No contributor</option>
                  <option value="user-1">John Doe (@john)</option>
                  <option value="user-2">Jane Smith (@jane)</option>
                  <option value="user-3">Mike Johnson (@mike)</option>
                  <option value="user-4">Sarah Wilson (@sarah)</option>
                  <option value="user-5">Alex Chen (@alex)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              {editedNode?.assignedTo && typeof editedNode.assignedTo === 'object' && (
                <div className="mt-2 text-xs text-gray-500">@{editedNode.assignedTo.username}</div>
              )}
            </div>

            {/* Owner */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Owner</h3>
              {currentNode.owner ? (
                <>
                  <div className="text-gray-300">{currentNode.owner.name}</div>
                  <div className="text-gray-500 text-sm">@{currentNode.owner.username}</div>
                </>
              ) : (
                <>
                  <div className="text-gray-300">Default Admin</div>
                  <div className="text-gray-500 text-sm">@admin</div>
                </>
              )}
            </div>

            {/* Due Date - Editable */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                <Calendar className="h-3 w-3 mr-1.5" />
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 transition-colors hover:border-gray-500"
              />
              {editedNode?.dueDate && (
                <div className="mt-1 text-xs text-gray-500">
                  {formatDate(editedNode.dueDate)}
                </div>
              )}
            </div>

          </div>

          {/* Tags - Editable */}
          <div className="mt-6">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {/* Existing Tags */}
              {editedNode?.tags?.map((tag, index) => (
                <span
                  key={index}
                  className="flex items-center px-2 py-1 bg-gray-700 text-gray-300 rounded-md text-xs group hover:bg-gray-600 transition-colors"
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => {
                      const newTags = editedNode.tags?.filter((_, i) => i !== index) || [];
                      setEditedNode(prev => prev ? { ...prev, tags: newTags } : null);
                    }}
                    className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove tag"
                  >
                    ×
                  </button>
                </span>
              ))}
              
              {/* Inline Add Tag Input */}
              {(!editedNode?.tags || editedNode.tags.length < 5) && (
                <div className="flex items-center">
                  <input
                    type="text"
                    placeholder="Add Tag"
                    className="text-xs bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-gray-300 focus:outline-none focus:border-blue-500 transition-colors min-w-16"
                    style={{ width: `${Math.max(16, 8)}ch` }}
                    onInput={(e) => {
                      const input = e.target as HTMLInputElement;
                      const textLength = input.value.length;
                      input.style.width = `${Math.max(16, textLength + 2)}ch`;
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        const newTag = input.value.trim();
                        const currentTags = editedNode?.tags || [];
                        if (newTag && !currentTags.includes(newTag) && currentTags.length < 5) {
                          setEditedNode(prev => prev ? { ...prev, tags: [...currentTags, newTag] } : null);
                          input.value = '';
                          input.style.width = '16ch';
                        }
                      }
                    }}
                  />
                </div>
              )}
              
              {/* Max tags indicator */}
              {editedNode?.tags && editedNode.tags.length >= 5 && (
                <span className="text-xs text-gray-500 italic">Max 5 tags</span>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="mt-6">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
              <Clock className="h-3 w-3 mr-1.5" />
              Timestamps
            </h3>
            <div className="text-gray-300 space-y-1">
              {currentNode.createdAt && (
                <div className="text-sm">
                  <span className="text-gray-500">Created:</span> {formatDate(currentNode.createdAt)}
                </div>
              )}
              {currentNode.updatedAt && (
                <div className="text-sm">
                  <span className="text-gray-500">Updated:</span> {formatDate(currentNode.updatedAt)}
                </div>
              )}
            </div>
          </div>

          {/* Connections */}
          <div className="mt-6">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Connections ({nodeConnections.length})
            </h3>
            
            {nodeConnections.length === 0 ? (
              <div className="text-center py-8">
                <GitBranch className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No connections yet</p>
                <p className="text-gray-600 text-xs mt-1">Connect this node to other nodes to see relationships here</p>
              </div>
            ) : (
              
              <div className="space-y-4">
                {/* Incoming Connections */}
                {incomingConnections.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Incoming ({incomingConnections.length})
                    </h4>
                    <div className="space-y-2">
                      {incomingConnections.map((edge) => {
                        const connectedNode = getConnectedNode(edge.source);
                        return (
                          <div key={edge.id} className="flex items-center space-x-3 p-2 bg-gray-800/50 rounded-md">
                            <div className="flex items-center space-x-2 flex-1">
                              {connectedNode && (
                                <span className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${getTypeColor(connectedNode.type)}`}>
                                  {getTypeIcon(connectedNode.type)}
                                  <span className="max-w-32 truncate">{connectedNode.title}</span>
                                </span>
                              )}
                              <span className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${getRelationshipColor(edge.type)}`}>
                                {getRelationshipIcon(edge.type)}
                                <span>{getRelationshipDisplayName(edge.type)}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Outgoing Connections */}
                {outgoingConnections.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Outgoing ({outgoingConnections.length})
                    </h4>
                    <div className="space-y-2">
                      {outgoingConnections.map((edge) => {
                        const connectedNode = getConnectedNode(edge.target);
                        return (
                          <div key={edge.id} className="flex items-center space-x-3 p-2 bg-gray-800/50 rounded-md">
                            <div className="flex items-center space-x-2 flex-1">
                              {connectedNode && (
                                <span className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${getTypeColor(connectedNode.type)}`}>
                                  {getTypeIcon(connectedNode.type)}
                                  <span className="max-w-32 truncate">{connectedNode.title}</span>
                                </span>
                              )}
                              <span className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${getRelationshipColor(edge.type)}`}>
                                {getRelationshipIcon(edge.type)}
                                <span>{getRelationshipDisplayName(edge.type)}</span>
                              </span>
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

            {/* Node ID */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-500">
                <span className="font-mono">{currentNode.id}</span>
              </div>
            </div>
          </div>

          {/* Right Column - Action Buttons */}
          <div className="w-48 flex-shrink-0">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Actions</h3>
            <div className="space-y-2">
              {/* Connect Dropdown */}
              <div className="relative" ref={connectDropdownRef}>
                <button
                  onClick={() => setShowConnectDropdown(!showConnectDropdown)}
                  disabled={getAvailableNodes().length === 0}
                  className="w-full flex items-center justify-between space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
                >
                  <div className="flex items-center space-x-2">
                    <GitBranch className="h-4 w-4" />
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

              {/* Disconnect Dropdown */}
              <div className="relative" ref={disconnectDropdownRef}>
                <button
                  onClick={() => setShowDisconnectDropdown(!showDisconnectDropdown)}
                  disabled={getConnectedNodes().length === 0}
                  className="w-full flex items-center justify-between space-x-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
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
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{deleting ? 'Deleting...' : 'Delete Node'}</span>
                </button>
              ) : (
                <div className="space-y-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="text-sm text-red-800 dark:text-red-400 text-center font-medium">
                    Delete "{currentNode.title}"?
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400 text-left">
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
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmed(false);
                      }}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={deleting || !deleteConfirmed}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
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