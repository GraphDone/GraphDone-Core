import React from 'react';
import { 
  X, User, Flag, Edit3, 
  GitBranch, ArrowRight, ArrowLeft, Ban, Link2, Folder, Split, Copy, Shield, Bookmark, Package
} from 'lucide-react';
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
  getPriorityIconElement
} from '../constants/workItemConstants';
import { WorkItem, WorkItemEdge } from '../types/graph';

interface NodeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: WorkItem | null;
  edges?: WorkItemEdge[];
  nodes?: WorkItem[];
  onEdit?: (node: WorkItem) => void;
}

export function NodeDetailsModal({ isOpen, onClose, node, edges = [], nodes = [], onEdit }: NodeDetailsModalProps) {
  if (!isOpen || !node) return null;

  // Use the same priority calculation as ListView for consistency
  const getNodePriority = (node: WorkItem) => {
    return node.priorityComp || node.priorityExec || 0;
  };
  
  const totalPriority = getNodePriority(node);

  const getStatusColor = (status: string) => {
    const statusConfig = getStatusConfig(status as WorkItemStatus);
    return `${statusConfig.color} ${statusConfig.bgColor}`;
  };

  const getStatusIcon = (status: string) => {
    return getStatusIconElement(status as WorkItemStatus, "h-5 w-5");
  };

  const getTypeColor = (type: string) => {
    const typeConfig = getTypeConfig(type as WorkItemType);
    return `${typeConfig.color} ${typeConfig.bgColor}`;
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const priorityInfo = getPriorityLevel(totalPriority);

  // Get connections for this node
  const nodeConnections = edges.filter(edge => 
    edge.source === node.id || edge.target === node.id
  );

  const incomingConnections = nodeConnections.filter(edge => edge.target === node.id);
  const outgoingConnections = nodeConnections.filter(edge => edge.source === node.id);


  const getConnectedNode = (nodeId: string) => {
    return nodes.find(n => n.id === nodeId);
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
        className="relative bg-gray-900 border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <span className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium ${getTypeColor(node.type)}`}>
              {getTypeIcon(node.type)}
              <span>{node.type}</span>
            </span>
            <span className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium ${getStatusColor(node.status)}`}>
              {getStatusIcon(node.status)}
              <span>{node.status.replace(/_/g, ' ')}</span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(node)}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                title="Edit Node"
              >
                <Edit3 className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-4">{node.title}</h2>

          {/* Description */}
          {node.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
              <p className="text-gray-300 leading-relaxed">{node.description}</p>
            </div>
          )}

          {/* Type and Status */}
          <div className="flex items-center space-x-4 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Type</h3>
              <span className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium ${getTypeColor(node.type)}`}>
                {getTypeIcon(node.type)}
                <span>{node.type}</span>
              </span>
            </div>
            {node.status && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Status</h3>
                <span className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium ${getStatusColor(node.status)}`}>
                  {getStatusIcon(node.status)}
                  <span>{node.status.replace(/_/g, ' ')}</span>
                </span>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                <Flag className={`h-4 w-4 mr-2 ${priorityInfo.flagColor}`} />
                Priority
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <span className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium ${priorityInfo.color}`}>
                    {getPriorityIcon(totalPriority)}
                    <span>{priorityInfo.label}</span>
                  </span>
                  <span className="text-gray-500 text-sm">({Math.round(totalPriority * 100)}%)</span>
                </div>
                
                {/* Simple Priority Progress Bar - matching node style */}
                <div className="flex items-center space-x-2">
                  <div className="relative w-32 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.round(totalPriority * 100)}%`,
                        backgroundColor: totalPriority >= 0.8 ? '#ef4444' : // Critical - red
                                       totalPriority >= 0.6 ? '#f97316' : // High - orange
                                       totalPriority >= 0.4 ? '#eab308' : // Medium - yellow
                                       totalPriority >= 0.2 ? '#3b82f6' : // Low - blue
                                       '#6b7280' // Minimal - gray
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned To */}
            {node.assignedTo && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Assigned To
                </h3>
                {typeof node.assignedTo === 'string' ? (
                  <div className="text-gray-300">{node.assignedTo}</div>
                ) : (
                  <>
                    <div className="text-gray-300">{node.assignedTo.name}</div>
                    <div className="text-gray-500 text-sm">@{node.assignedTo.username}</div>
                  </>
                )}
              </div>
            )}

            {/* Owner */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Owner</h3>
              {node.owner ? (
                <>
                  <div className="text-gray-300">{node.owner.name}</div>
                  <div className="text-gray-500 text-sm">@{node.owner.username}</div>
                </>
              ) : (
                <>
                  <div className="text-gray-300">Default Admin</div>
                  <div className="text-gray-500 text-sm">@admin</div>
                </>
              )}
            </div>

            {/* Due Date */}
            {node.dueDate && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Due Date
                </h3>
                <div className="text-gray-300">{formatDate(node.dueDate)}</div>
              </div>
            )}

            {/* Created/Updated */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Timestamps
              </h3>
              <div className="text-gray-300 space-y-1">
                {node.createdAt && (
                  <div className="text-sm">
                    <span className="text-gray-500">Created:</span> {formatDate(node.createdAt)}
                  </div>
                )}
                {node.updatedAt && (
                  <div className="text-sm">
                    <span className="text-gray-500">Updated:</span> {formatDate(node.updatedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {node.tags && node.tags.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {node.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-700 text-gray-300 rounded-md text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Connections */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center">
              <GitBranch className="h-4 w-4 mr-2" />
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
              <span className="font-mono">{node.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}