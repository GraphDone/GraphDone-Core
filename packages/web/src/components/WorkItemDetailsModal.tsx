import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, User, Flag, Edit3, Save, ChevronDown, Plus, Unlink, Trash2,
  GitBranch, ArrowRight, ArrowLeft, Ban, Link2, Folder, Split, Copy, Shield, Bookmark, Package,
  Sparkles, Hash, Crown, Activity, Gem, Rocket, Star, Brain, FileText, Eye, Sparkle
} from 'lucide-react';
import { useMutation } from '@apollo/client';
import { UPDATE_WORK_ITEM, GET_WORK_ITEMS, CREATE_EDGE, GET_EDGES, DELETE_EDGE, DELETE_WORK_ITEM } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useDialog } from '../hooks/useDialogManager';
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
  readOnly?: boolean;
}

export function WorkItemDetailsModal({
  isOpen,
  onClose,
  node,
  edges = [],
  nodes = [],
  onEdit,
  onConnectToExisting,
  onDisconnect,
  onDelete,
  readOnly = false
}: NodeDetailsModalProps) {
  const { currentGraph } = useGraph();
  const { currentUser } = useAuth();
  const { showSuccess, showError, showWarning } = useNotifications();
  const [editedNode, setEditedNode] = useState<WorkItem | null>(null);
  const [savedNode, setSavedNode] = useState<WorkItem | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showConnectDropdown, setShowConnectDropdown] = useState(false);
  const [showDisconnectDropdown, setShowDisconnectDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [selectedNodesForConnection, setSelectedNodesForConnection] = useState<string[]>([]);
  const [selectedEdgesForDisconnection, setSelectedEdgesForDisconnection] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const connectDropdownRef = useRef<HTMLDivElement>(null);
  const disconnectDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useDialog(isOpen, onClose);

  useEffect(() => {
    if (node) {
      setEditedNode({ ...node });
      setSavedNode({ ...node });
    }
  }, [node]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  const handleSaveRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.stopPropagation();
        e.preventDefault();
        if (handleSaveRef.current) {
          handleSaveRef.current();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!showConnectDropdown && !showDisconnectDropdown) return;

    function handleClickOutside(event: MouseEvent) {
      if (connectDropdownRef.current && !connectDropdownRef.current.contains(event.target as Node)) {
        setShowConnectDropdown(false);
      }
      if (disconnectDropdownRef.current && !disconnectDropdownRef.current.contains(event.target as Node)) {
        setShowDisconnectDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showConnectDropdown, showDisconnectDropdown]);

  const [createEdge] = useMutation(CREATE_EDGE, {
    refetchQueries: [{ query: GET_EDGES }],
    awaitRefetchQueries: true,
    onError: (error) => {
      showError(`Failed to create connection: ${error.message}`);
    },
    optimisticResponse: (vars) => {
      const edges = vars.input.map((input: any) => ({
        __typename: 'Edge',
        id: `temp-${Date.now()}-${Math.random()}`,
        type: input.type,
        weight: input.weight || 1.0,
        source: {
          __typename: 'WorkItem',
          id: input.source.connect.where.node.id,
          title: node?.title || '',
          type: node?.type || 'TASK'
        },
        target: {
          __typename: 'WorkItem',
          id: input.target.connect.where.node.id,
          title: nodes.find(n => n.id === input.target.connect.where.node.id)?.title || '',
          type: nodes.find(n => n.id === input.target.connect.where.node.id)?.type || 'TASK'
        },
        createdBy: input.createdBy ? {
          __typename: 'User',
          id: input.createdBy.connect.where.node.id,
          name: '',
          username: ''
        } : null,
        createdAt: new Date().toISOString()
      }));

      return {
        __typename: 'Mutation',
        createEdges: {
          __typename: 'CreateEdgesMutationResponse',
          edges
        }
      };
    }
  });

  const [deleteEdge] = useMutation(DELETE_EDGE, {
    refetchQueries: [{ query: GET_EDGES }],
    awaitRefetchQueries: true,
    onError: (error) => {
      showError(`Failed to remove connection: ${error.message}`);
    },
    optimisticResponse: () => ({
      __typename: 'Mutation',
      deleteEdges: {
        __typename: 'DeleteInfo',
        nodesDeleted: 0,
        relationshipsDeleted: 1
      }
    })
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
      const edgeInputs = selectedNodesForConnection.map(targetWorkItemId => ({
        type: RELATIONSHIP_TYPES.DEFAULT_EDGE.type,
        weight: 1.0,
        source: { connect: { where: { node: { id: currentNode.id } } } },
        target: { connect: { where: { node: { id: targetWorkItemId } } } }
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
      },
      { query: GET_EDGES }
    ],
    awaitRefetchQueries: true,
    onCompleted: (data) => {
      if (data?.updateWorkItems?.workItems?.[0]) {
        const updatedNode = data.updateWorkItems.workItems[0];
        setEditedNode({ ...updatedNode });
        setSavedNode({ ...updatedNode });
      }

      showSuccess('Work item updated successfully');
    },
    onError: (error) => {
      showError(`Failed to update work item: ${error.message}`);
      if (node) {
        setEditedNode({ ...node });
      }
    },
    optimisticResponse: (vars) => {
      if (!editedNode || !node) return;
      return {
        __typename: 'Mutation',
        updateWorkItems: {
          __typename: 'UpdateWorkItemsMutationResponse',
          workItems: [{
            __typename: 'WorkItem',
            id: node.id,
            title: vars.update.title !== undefined ? vars.update.title : editedNode.title,
            description: vars.update.description !== undefined ? vars.update.description : editedNode.description,
            type: vars.update.type || editedNode.type,
            status: vars.update.status || editedNode.status,
            priority: vars.update.priority !== undefined ? vars.update.priority : editedNode.priority,
            tags: vars.update.tags || editedNode.tags,
            dueDate: vars.update.dueDate !== undefined ? vars.update.dueDate : editedNode.dueDate,
            assignedTo: editedNode.assignedTo,
            owner: editedNode.owner,
            graph: editedNode.graph,
            contributors: editedNode.contributors,
            dependencies: editedNode.dependencies,
            dependents: editedNode.dependents,
            positionX: editedNode.positionX,
            positionY: editedNode.positionY,
            positionZ: editedNode.positionZ,
            radius: editedNode.radius,
            theta: editedNode.theta,
            phi: editedNode.phi,
            metadata: editedNode.metadata,
            createdAt: editedNode.createdAt,
            updatedAt: new Date().toISOString()
          }]
        }
      };
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
    awaitRefetchQueries: true,
    onCompleted: () => {
      showSuccess('Work item deleted successfully');
      onClose();
    },
    onError: (error) => {
      showError(`Failed to delete work item: ${error.message}`);
    },
    optimisticResponse: () => ({
      __typename: 'Mutation',
      deleteWorkItems: {
        __typename: 'DeleteInfo',
        nodesDeleted: 1,
        relationshipsDeleted: nodeConnections.length
      }
    })
  });

  const handleSave = useCallback(async () => {
    if (!editedNode || !node || isSavingRef.current) return;

    // Capture current values immediately to prevent stale closures
    const nodeToSave = { ...editedNode };
    const currentNodeRef = node;

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const updateInput: any = {
        title: nodeToSave.title,
        description: nodeToSave.description,
        type: nodeToSave.type,
        status: nodeToSave.status,
        priority: nodeToSave.priority,
        tags: nodeToSave.tags || [],
        dueDate: nodeToSave.dueDate,
      };

      // Handle assignedTo relationship properly for Neo4j GraphQL
      const currentAssignedToId = typeof currentNodeRef.assignedTo === 'string' ? currentNodeRef.assignedTo : currentNodeRef.assignedTo?.id;
      const newAssignedToId = typeof nodeToSave.assignedTo === 'string' ? nodeToSave.assignedTo : nodeToSave.assignedTo?.id;

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
          where: { id: currentNodeRef.id },
          update: updateInput
        }
      });
    } catch (error) {
      console.error('Failed to update work item:', error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [editedNode, node, updateWorkItem]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const handleDelete = async () => {
    if (!node) return;

    // Check if node has any connections
    const hasConnections = nodeConnections.length > 0;
    
    if (hasConnections) {
      // Use warning notification (yellow/orange) instead of error (red)
      showWarning(
        'Cannot Delete Work Item',
        `This work item has ${nodeConnections.length} connection(s). Please disconnect all relationships first before deleting.`
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
      console.error('Failed to delete work item:', error);
    }
  };

  
  if (!isOpen || !node) return null;

  const currentNode = editedNode || node;

  // Check if any changes have been made (compare with savedNode instead of node prop)
  const hasChanges = editedNode && savedNode && (
    editedNode.title !== savedNode.title ||
    editedNode.description !== savedNode.description ||
    editedNode.type !== savedNode.type ||
    editedNode.status !== savedNode.status ||
    editedNode.priority !== savedNode.priority ||
    JSON.stringify(editedNode.tags || []) !== JSON.stringify(savedNode.tags || []) ||
    (typeof editedNode.assignedTo === 'string' ? editedNode.assignedTo : editedNode.assignedTo?.id) !==
    (typeof savedNode.assignedTo === 'string' ? savedNode.assignedTo : savedNode.assignedTo?.id) ||
    editedNode.dueDate !== savedNode.dueDate
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
      borderColor: config.borderColor,
      flagColor: config.color
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${displayHours}:${displayMinutes} ${ampm}`;
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
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-600/50 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl animate-in fade-in zoom-in-95 duration-300 ring-1 ring-white/20 overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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

        {/* Title Header */}
        <div className="relative px-4 py-3 bg-gradient-to-r from-gray-800/40 via-gray-700/30 to-gray-800/40 border-b border-gray-600/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-2xl border ${
                readOnly
                  ? 'bg-gradient-to-br from-cyan-300/60 via-blue-400/50 to-cyan-300/40 border-cyan-200/50'
                  : 'bg-gradient-to-br from-teal-300/60 via-magenta-400/50 to-magenta-300/40 border-magenta-200/50'
              }`}>
                {readOnly ? (
                  <Eye className="h-6 w-6 text-cyan-200" />
                ) : (
                  <Edit3 className="h-6 w-6 text-teal-200" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {readOnly ? 'View Work Item' : 'Edit Work Item'}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {readOnly ? 'View work item information' : 'View and edit work item information'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {!readOnly && (
                <button
                  onClick={handleSave}
                  disabled={updating || !hasChanges || isSaving}
                  className={`flex items-center space-x-1 px-4 py-2 rounded-lg transition-all duration-300 text-sm font-semibold shadow-lg ${
                    hasChanges && !updating && !isSaving
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 hover:scale-105 transform border border-green-400/30'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600'
                  }`}
                  title={hasChanges ? "Save Changes (Ctrl+S)" : "No changes to save"}
                  aria-label={hasChanges ? "Save changes to work item" : "No changes to save"}
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-200 hover:scale-110 shadow-lg backdrop-blur-sm"
                aria-label="Close modal (ESC)"
                title="Close (ESC)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Header */}
        <div className="relative flex items-center justify-between px-3 py-2 border-b border-gray-600/50 bg-gradient-to-r from-gray-800/30 via-gray-700/20 to-gray-800/30 backdrop-blur-sm z-10">
          <div className="flex items-center space-x-6">
            {/* Enhanced Clickable Type Badge */}
            <div className="relative z-[100000]">
              <button
                onClick={() => !readOnly && setShowTypeDropdown(!showTypeDropdown)}
                disabled={readOnly}
                className={`w-36 flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold ${!readOnly ? 'hover:scale-105 cursor-pointer' : 'cursor-default opacity-75'} transition-all duration-200 shadow-lg backdrop-blur-sm ${getTypeColor(currentNode.type)} border border-opacity-30 hover:border-opacity-50`}
              >
                <div className="flex items-center space-x-1">
                  {getTypeIcon(currentNode.type)}
                  <span className="bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent font-bold">{getTypeConfig(currentNode.type as WorkItemType).label}</span>
                </div>
                {!readOnly && <ChevronDown className="h-4 w-4 opacity-70" />}
              </button>

              {/* Enhanced Type Dropdown with Staggered Animation */}
              {!readOnly && showTypeDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-600/30 shadow-2xl z-[99999] max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2">
                    {TYPE_OPTIONS.filter(opt => opt.value !== 'all').map((type, index) => (
                      <button
                        key={type.value}
                        onClick={() => {
                          setEditedNode(prev => prev ? { ...prev, type: type.value as WorkItemType } : null);
                          setShowTypeDropdown(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left transition-all duration-200 rounded-lg group ${
                          currentNode.type === type.value
                            ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-400/50 shadow-lg shadow-emerald-500/10'
                            : 'hover:bg-gray-700/50 border-2 border-transparent hover:border-gray-600/50'
                        } ${index !== 0 ? 'mt-1' : ''}`}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            {type.icon && <type.icon className={`h-4 w-4 ${getTypeColorScheme(type.value as WorkItemType).text} transition-transform group-hover:scale-110`} />}
                            <span className={`font-semibold text-xs ${
                              currentNode.type === type.value
                                ? 'text-emerald-400'
                                : 'text-gray-100'
                            }`}>{type.label}</span>
                          </div>
                          {currentNode.type === type.value && (
                            <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-full flex items-center justify-center text-[10px] ml-1 flex-shrink-0 shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-200">
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

            {/* Enhanced Clickable Status Badge */}
            <div className="relative z-[100000]">
              <button
                onClick={() => !readOnly && setShowStatusDropdown(!showStatusDropdown)}
                disabled={readOnly}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold ${!readOnly ? 'hover:scale-105 cursor-pointer' : 'cursor-default opacity-75'} transition-all duration-200 shadow-lg backdrop-blur-sm ${getStatusColor(currentNode.status)} border border-opacity-30 hover:border-opacity-50`}
              >
                <div className="flex items-center space-x-1">
                  {getStatusIcon(currentNode.status)}
                  <span className="bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent font-bold">{getStatusConfig(currentNode.status as WorkItemStatus).label}</span>
                </div>
                {!readOnly && <ChevronDown className="h-4 w-4 opacity-70" />}
              </button>

              {/* Enhanced Status Dropdown with Staggered Animation */}
              {!readOnly && showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-600/30 shadow-2xl z-[99999] max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2">
                    {STATUS_OPTIONS.filter(opt => opt.value !== 'all').map((status, index) => (
                      <button
                        key={status.value}
                        onClick={() => {
                          setEditedNode(prev => prev ? { ...prev, status: status.value as WorkItemStatus } : null);
                          setShowStatusDropdown(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left transition-all duration-200 rounded-lg group ${
                          currentNode.status === status.value
                            ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-400/50 shadow-lg shadow-emerald-500/10'
                            : 'hover:bg-gray-700/50 border-2 border-transparent hover:border-gray-600/50'
                        } ${index !== 0 ? 'mt-1' : ''}`}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            {status.icon && <status.icon className={`h-4 w-4 ${getStatusColorScheme(status.value as WorkItemStatus).text} transition-transform group-hover:scale-110`} />}
                            <span className={`font-semibold text-xs ${
                              currentNode.status === status.value
                                ? 'text-emerald-400'
                                : 'text-gray-100'
                            }`}>{status.label}</span>
                          </div>
                          {currentNode.status === status.value && (
                            <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-full flex items-center justify-center text-[10px] ml-1 flex-shrink-0 shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-200">
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
        </div>

        {/* Enhanced Content */}
        <div className="flex px-3 py-2 gap-3 bg-gradient-to-br from-gray-800/20 via-transparent to-gray-900/20">
          {/* Enhanced Left Column - Main Content */}
          <div className="flex-1">
          {/* Enhanced Title - Always Editable */}
          <div className="mb-2">
            <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
              <div className="p-1 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg mr-1 border border-blue-500/30">
                <FileText className="h-3 w-3 text-blue-400" />
              </div>
              Title
            </h3>
            <input
              id="modal-title"
              type="text"
              value={editedNode?.title || ''}
              onChange={(e) => {
                if (!readOnly) {
                  const newValue = e.target.value;
                  setEditedNode(prev => prev ? { ...prev, title: newValue } : null);
                }
              }}
              disabled={readOnly}
              readOnly={readOnly}
              className={`text-sm bg-gray-800 border-2 border-gray-600 text-white placeholder-gray-400 w-full focus:outline-none transition-all duration-300 p-2 rounded-lg shadow-lg ${
                readOnly ? 'cursor-default opacity-75' : 'focus:!border-green-400 hover:border-gray-500 cursor-text'
              }`}
              placeholder="Enter title"
              autoComplete="off"
              aria-label="Work item title"
            />
          </div>

          {/* Enhanced Description - Always Editable */}
          <div className="mb-2">
            <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
              <div className="p-1 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg mr-1 border border-emerald-500/30">
                <Edit3 className="h-3 w-3 text-emerald-400" />
              </div>
              Description
            </h3>
            <textarea
              value={editedNode?.description || ''}
              onChange={(e) => {
                if (!readOnly) {
                  setEditedNode(prev => prev ? { ...prev, description: e.target.value } : null);
                }
              }}
              disabled={readOnly}
              readOnly={readOnly}
              className={`w-full text-sm text-white bg-gray-800 border border-gray-600 rounded-lg placeholder-gray-400 p-2 focus:outline-none transition-all duration-300 resize-none shadow-lg ${
                readOnly ? 'cursor-default opacity-75' : 'focus:ring-2 focus:ring-green-500/50 focus:border-green-400 hover:border-gray-500 cursor-text'
              }`}
              placeholder="Enter description"
              rows={3}
              autoComplete="off"
            />
          </div>


          {/* Enhanced Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Enhanced Priority - Editable */}
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-lg p-2 shadow-lg backdrop-blur-sm">
              <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
                <div className={`p-1 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg mr-1 border border-orange-500/30`}>
                  <Flag className={`h-3 w-3 ${priorityInfo.flagColor}`} />
                </div>
                Priority
              </h3>
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editedNode?.priority || 0}
                  onChange={(e) => {
                    if (!readOnly) {
                      setEditedNode(prev => prev ? { ...prev, priority: parseFloat(e.target.value) } : null);
                    }
                  }}
                  disabled={readOnly}
                  className={`w-full h-2 bg-gray-700/50 rounded-lg appearance-none shadow-inner ${
                    readOnly ? 'cursor-default opacity-75' : 'cursor-pointer'
                  } ${
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
                  <span className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold border ${priorityInfo.borderColor} ${priorityInfo.color}`}>
                    {getPriorityIconElement(editedNode?.priority || 0, "h-3 w-3")}
                    <span>{priorityInfo.label}</span>
                  </span>
                  <span className="text-gray-300 text-xs font-medium bg-gray-700/30 px-2 py-1 rounded-lg">{Math.round((editedNode?.priority || 0) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Enhanced Assigned To - Editable */}
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-lg p-2 shadow-lg backdrop-blur-sm">
              <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg mr-1 border border-violet-500/30">
                  <User className="h-3 w-3 text-violet-400" />
                </div>
                Contributor
              </h3>
              <div className="relative">
                <select
                  value={typeof editedNode?.assignedTo === 'string' ? editedNode.assignedTo : (editedNode?.assignedTo?.id || '')}
                  onChange={(e) => {
                    if (!readOnly) {
                      const value = e.target.value;
                      setEditedNode(prev => prev ? {
                        ...prev,
                        assignedTo: value ? { id: value, name: e.target.selectedOptions[0].text.split(' (')[0], username: value } : undefined
                      } : null);
                    }
                  }}
                  disabled={readOnly}
                  className={`w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none transition-all duration-300 appearance-none shadow-lg font-medium ${
                    readOnly ? 'cursor-default opacity-75' : 'focus:ring-2 focus:ring-green-500/50 focus:border-green-400 hover:border-gray-500'
                  }`}
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
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-lg p-2 shadow-lg backdrop-blur-sm">
              <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-lg mr-1 border border-amber-500/30">
                  <Crown className="h-3 w-3 text-amber-400" />
                </div>
                Owner
              </h3>
              {currentNode.owner ? (
                <div className="bg-gradient-to-r from-gray-700/50 to-gray-600/30 border border-gray-600/40 rounded-lg p-1 backdrop-blur-sm">
                  <div className="text-gray-200 text-sm font-medium">{currentNode.owner.name}</div>
                  <div className="text-gray-400 text-xs">@{currentNode.owner.username}</div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-gray-700/50 to-gray-600/30 border border-gray-600/40 rounded-lg p-1 backdrop-blur-sm">
                  <div className="text-gray-200 text-sm font-medium">System Administrator</div>
                  <div className="text-gray-400 text-xs">@admin</div>
                </div>
              )}
            </div>

            {/* Enhanced Due Date - Editable */}
            <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-lg p-2 shadow-lg backdrop-blur-sm">
              <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg mr-1 border border-teal-500/30">
                  <Calendar className="h-3 w-3 text-teal-400" />
                </div>
                Due date
              </h3>
              <input
                type="date"
                value={editedNode?.dueDate ? editedNode.dueDate.split('T')[0] : ''}
                onChange={(e) => {
                  if (!readOnly) {
                    const value = e.target.value;
                    setEditedNode(prev => prev ? {
                      ...prev,
                      dueDate: value ? `${value}T23:59:59.999Z` : undefined
                    } : null);
                  }
                }}
                disabled={readOnly}
                readOnly={readOnly}
                className={`w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none transition-all duration-300 shadow-lg font-medium ${
                  readOnly ? 'cursor-default opacity-75' : 'focus:ring-2 focus:ring-green-500/50 focus:border-green-400 hover:border-gray-500'
                }`}
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
          <div className="mt-2">
            <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
              <div className="p-1 bg-gradient-to-br from-sky-500/20 to-blue-500/20 rounded-lg mr-1 border border-sky-500/30">
                <Hash className="h-3 w-3 text-sky-400" />
              </div>
              Tags
            </h3>
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-lg p-2 shadow-lg backdrop-blur-sm">
              <div className="flex flex-wrap gap-2">
                {/* Enhanced Existing Tags */}
                {editedNode?.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="flex items-center px-2 py-1 bg-gradient-to-r from-gray-700/60 to-gray-600/40 text-gray-200 rounded-lg text-xs font-medium group hover:from-gray-600/60 hover:to-gray-500/40 transition-all duration-200 hover:scale-105 shadow-md border border-gray-600/30"
                  >
                    <span>{tag}</span>
                    {!readOnly && (
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
                    )}
                  </span>
              ))}
                
                {/* Enhanced Inline Add Tag Input */}
                {(!editedNode?.tags || editedNode.tags.length < 5) && !readOnly && (
                  <div className="flex items-center">
                    <input
                      type="text"
                      placeholder="Add Tag"
                      disabled={readOnly}
                      className="text-xs bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 min-w-20 shadow-lg font-medium"
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
              <div className="mt-2 text-xs text-gray-400 italic flex items-center">
                <div className="w-1 h-1 bg-sky-400 rounded-full mr-2"></div>
                Press Enter to add • Max 5 tags
              </div>
            </div>
          </div>

          {/* Enhanced DateTime */}
          <div className="mt-2">
            <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
              <div className="p-1 bg-gradient-to-br from-lime-500/20 to-green-500/20 rounded-lg mr-1 border border-lime-500/30">
                <Clock className="h-3 w-3 text-lime-400" />
              </div>
              DateTime
            </h3>
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-lg p-2 shadow-lg backdrop-blur-sm space-y-1">
              {currentNode.createdAt && (
                <div className="text-xs flex justify-between items-center">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-gray-200 bg-gray-700/50 px-2 py-0.5 rounded text-xs">{formatDate(currentNode.createdAt)}</span>
                </div>
              )}
              {currentNode.updatedAt && (
                <div className="text-xs flex justify-between items-center">
                  <span className="text-gray-400">Updated:</span>
                  <span className="text-gray-200 bg-gray-700/50 px-2 py-0.5 rounded text-xs">{formatDate(currentNode.updatedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Connections */}
          <div className="mt-2">
            <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
              <div className="p-1 bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 rounded-lg mr-1 border border-fuchsia-500/30">
                <GitBranch className="h-3 w-3 text-fuchsia-400" />
              </div>
              Connections ({nodeConnections.length})
            </h3>

            {nodeConnections.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-lg p-2 shadow-lg backdrop-blur-sm text-center">
                <div className="p-2 bg-gradient-to-br from-gray-700/30 to-gray-600/20 rounded-lg inline-block mb-1 border border-gray-600/30">
                  <GitBranch className="h-8 w-8 text-gray-500 mx-auto" />
                </div>
                <p className="text-gray-400 text-xs font-medium mb-1">No connections yet</p>
                <p className="text-gray-500 text-[10px]">Use Connect button to link nodes</p>
              </div>
            ) : (

              <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-lg p-1.5 shadow-lg backdrop-blur-sm space-y-1.5">
                {/* Enhanced Incoming Connections */}
                {incomingConnections.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 mb-0.5 flex items-center">
                      <div className="p-0.5 bg-gradient-to-br from-emerald-500/20 to-green-600/20 rounded mr-1 border border-emerald-500/30">
                        <ArrowRight className="h-2.5 w-2.5 text-emerald-400" />
                      </div>
                      Incoming ({incomingConnections.length})
                    </h4>
                    <div className="space-y-0.5">
                      {incomingConnections.map((edge, index) => {
                        const connectedNode = getConnectedNode(edge.source);
                        return (
                          <div key={edge.id} className="p-1.5 bg-gradient-to-r from-emerald-900/30 to-gray-800/50 border border-emerald-500/30 rounded hover:from-emerald-900/50 hover:to-gray-800/70 hover:border-emerald-400/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg shadow-sm backdrop-blur-sm cursor-pointer group animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${index * 50}ms` }}>
                            <div className="flex items-center gap-1.5">
                              {connectedNode && (
                                <div className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-medium ${getTypeColor(connectedNode.type)} group-hover:scale-105 transition-transform duration-200`}>
                                  {getTypeIcon(connectedNode.type)}
                                  <span>{connectedNode.title}</span>
                                </div>
                              )}
                              <div className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${getRelationshipColor(edge.type)} flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}>
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
                    <h4 className="text-xs font-medium text-gray-400 mb-0.5 flex items-center">
                      <div className="p-0.5 bg-gradient-to-br from-red-500/20 to-rose-600/20 rounded mr-1 border border-red-500/30">
                        <ArrowLeft className="h-2.5 w-2.5 text-red-400" />
                      </div>
                      Outgoing ({outgoingConnections.length})
                    </h4>
                    <div className="space-y-0.5">
                      {outgoingConnections.map((edge, index) => {
                        const connectedNode = getConnectedNode(edge.target);
                        return (
                          <div key={edge.id} className="p-1.5 bg-gradient-to-r from-red-900/30 to-gray-800/50 border border-red-500/30 rounded hover:from-red-900/50 hover:to-gray-800/70 hover:border-red-400/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg shadow-sm backdrop-blur-sm cursor-pointer group animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${index * 50}ms` }}>
                            <div className="flex items-center gap-1.5">
                              {connectedNode && (
                                <div className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-medium ${getTypeColor(connectedNode.type)} group-hover:scale-105 transition-transform duration-200`}>
                                  {getTypeIcon(connectedNode.type)}
                                  <span>{connectedNode.title}</span>
                                </div>
                              )}
                              <div className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${getRelationshipColor(edge.type)} flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}>
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

            {/* Enhanced Work Item ID */}
            <div className="mt-2 pt-2 border-t border-gray-600/50">
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-700/30 border border-gray-600/40 rounded-lg p-2 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <div className="p-1 bg-gradient-to-br rounded-lg border" style={{
                      backgroundImage: 'linear-gradient(to bottom right, rgba(240, 230, 140, 0.2), rgba(218, 165, 32, 0.2))',
                      borderColor: 'rgba(240, 230, 140, 0.3)'
                    }}>
                      <Star className="h-3 w-3" style={{ color: '#f0e68c' }} />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">Work Item ID</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono bg-gray-700/50 px-1.5 py-0.5 rounded border border-gray-600/40">{currentNode.id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Right Column - Action Buttons */}
          <div className="w-36 flex-shrink-0 relative">
            <h3 className="text-base font-medium text-gray-300 mb-1 flex items-center">
              <div className="p-1 bg-gradient-to-br from-indigo-500/20 to-blue-600/20 rounded-lg mr-1 border border-indigo-500/30">
                <Rocket className="h-3 w-3 text-indigo-400" />
              </div>
              Actions
            </h3>
            <div className="space-y-2">
              {/* Enhanced Connect Dropdown */}
              <div className="relative" ref={connectDropdownRef}>
                <button
                  onClick={() => setShowConnectDropdown(!showConnectDropdown)}
                  disabled={getAvailableNodes().length === 0}
                  className="w-full flex flex-row items-center justify-start gap-2 px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-300 text-xs font-semibold shadow-lg hover:scale-105 transform border border-green-400/30"
                  aria-label={`Connect to other work items (${getAvailableNodes().length} available)`}
                  title={getAvailableNodes().length === 0 ? "No work items available to connect" : "Connect to other work items"}
                >
                  <Link2 className="h-4 w-4" />
                  <span className="leading-tight">Connect ({getAvailableNodes().length})</span>
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
                  className="w-full flex flex-row items-center justify-start gap-2 px-3 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-300 text-xs font-semibold shadow-lg hover:scale-105 transform border border-yellow-400/30"
                  aria-label={`Disconnect from work items (${getConnectedNodes().length} connected)`}
                  title={getConnectedNodes().length === 0 ? "No connections to disconnect" : "Disconnect from work items"}
                >
                  <Unlink className="h-4 w-4" />
                  <span className="leading-tight">Disconnect ({getConnectedNodes().length})</span>
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
                  className="w-full flex flex-row items-center justify-start gap-2 px-3 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-red-400 disabled:to-rose-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-300 text-xs font-semibold shadow-lg hover:scale-105 transform border border-red-400/30"
                  aria-label="Delete work item"
                  title="Delete this work item (requires disconnecting all relationships first)"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="leading-tight">{deleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              ) : (
                <div className="space-y-2 p-2 bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-500/40 rounded-lg shadow-lg backdrop-blur-sm">
                  <div className="text-xs text-red-300 text-center font-semibold">
                    Delete?
                  </div>
                  
                  {/* Confirmation Checkbox */}
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <div
                      onClick={() => setDeleteConfirmed(!deleteConfirmed)}
                      className={`w-3 h-3 min-w-[12px] min-h-[12px] border flex items-center justify-center transition-colors cursor-pointer ${
                        deleteConfirmed
                          ? 'bg-red-600 border-red-600'
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {deleteConfirmed && (
                        <span className="text-white text-[8px] font-bold">✓</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 leading-tight">
                      Confirm
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmed(false);
                      }}
                      className="px-2 py-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:bg-red-600 hover:text-white text-white rounded-lg transition-all duration-200 text-xs font-semibold shadow-lg hover:scale-105 transform"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={deleting || !deleteConfirmed}
                      className="px-2 py-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-red-400 disabled:to-rose-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 text-xs font-semibold shadow-lg hover:scale-105 transform"
                    >
                      {deleting ? 'Del...' : 'Del'}
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