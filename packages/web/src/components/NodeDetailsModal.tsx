import React from 'react';
import { 
  X, Calendar, Clock, User, Flag, Edit3, 
  Layers, Trophy, Target, Sparkles, ListTodo, AlertTriangle, Lightbulb, Microscope,
  ClipboardList, CheckCircle, AlertCircle, Flame, Zap, Triangle, Circle, ArrowDown,
  GitBranch, ArrowRight, ArrowLeft, Ban, Link2, Folder, Split, Copy, Shield, Bookmark, Package
} from 'lucide-react';
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
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'text-green-400 bg-green-400/10';
      case 'IN_PROGRESS': return 'text-yellow-400 bg-yellow-400/10';
      case 'BLOCKED': return 'text-red-500 bg-red-500/10';
      case 'PLANNED': return 'text-purple-400 bg-purple-400/10';
      case 'PROPOSED': return 'text-cyan-400 bg-cyan-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PROPOSED': return <ClipboardList className="h-5 w-5 text-cyan-400" />;
      case 'PLANNED': return <Calendar className="h-5 w-5 text-purple-400" />;
      case 'IN_PROGRESS': return <Clock className="h-5 w-5 text-yellow-400" />;
      case 'COMPLETED': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'BLOCKED': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'EPIC': return 'text-fuchsia-400 bg-fuchsia-400/10';
      case 'MILESTONE': return 'text-orange-400 bg-orange-400/10';
      case 'OUTCOME': return 'text-indigo-400 bg-indigo-400/10';
      case 'FEATURE': return 'text-sky-400 bg-sky-400/10';
      case 'TASK': return 'text-green-400 bg-green-400/10';
      case 'BUG': return 'text-red-500 bg-red-500/10';
      case 'IDEA': return 'text-yellow-500 bg-yellow-500/10';
      case 'RESEARCH': return 'text-teal-400 bg-teal-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EPIC': return <Layers className="h-5 w-5 text-fuchsia-400" />;
      case 'MILESTONE': return <Trophy className="h-5 w-5 text-orange-400" />;
      case 'OUTCOME': return <Target className="h-5 w-5 text-indigo-400" />;
      case 'FEATURE': return <Sparkles className="h-5 w-5 text-sky-400" />;
      case 'TASK': return <ListTodo className="h-5 w-5 text-green-400" />;
      case 'BUG': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'IDEA': return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      case 'RESEARCH': return <Microscope className="h-5 w-5 text-teal-400" />;
      default: return <ListTodo className="h-5 w-5 text-green-400" />;
    }
  };

  const getPriorityIcon = (priority: number) => {
    if (priority >= 0.8) return <Flame className="h-5 w-5 text-red-400" />;
    if (priority >= 0.6) return <Zap className="h-5 w-5 text-orange-400" />;
    if (priority >= 0.4) return <Triangle className="h-5 w-5 text-yellow-400" />;
    if (priority >= 0.2) return <Circle className="h-5 w-5 text-blue-400" />;
    return <ArrowDown className="h-5 w-5 text-gray-400" />;
  };

  // Use the same priority levels as ListView (0.0-1.0 scale)
  const getPriorityLevel = (priority: number) => {
    if (priority >= 0.8) return { label: 'Critical', color: 'text-red-400 bg-red-400/10', flagColor: 'text-red-400' };
    if (priority >= 0.6) return { label: 'High', color: 'text-orange-400 bg-orange-400/10', flagColor: 'text-orange-400' };
    if (priority >= 0.4) return { label: 'Medium', color: 'text-yellow-400 bg-yellow-400/10', flagColor: 'text-yellow-400' };
    if (priority >= 0.2) return { label: 'Low', color: 'text-blue-400 bg-blue-400/10', flagColor: 'text-blue-400' };
    return { label: 'Minimal', color: 'text-gray-400 bg-gray-400/10', flagColor: 'text-gray-400' };
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
    const relationshipColors: Record<string, string> = {
      'DEPENDS_ON': 'text-emerald-400 bg-emerald-400/10',
      'BLOCKS': 'text-red-400 bg-red-400/10',
      'ENABLES': 'text-green-400 bg-green-400/10',
      'RELATES_TO': 'text-purple-400 bg-purple-400/10',
      'IS_PART_OF': 'text-orange-400 bg-orange-400/10',
      'FOLLOWS': 'text-indigo-400 bg-indigo-400/10',
      'PARALLEL_WITH': 'text-teal-400 bg-teal-400/10',
      'DUPLICATES': 'text-yellow-400 bg-yellow-400/10',
      'CONFLICTS_WITH': 'text-red-500 bg-red-500/10',
      'VALIDATES': 'text-emerald-400 bg-emerald-400/10',
      'REFERENCES': 'text-slate-400 bg-slate-400/10',
      'CONTAINS': 'text-blue-400 bg-blue-400/10',
    };
    return relationshipColors[type] || 'text-gray-400 bg-gray-400/10';
  };

  const getRelationshipDisplayName = (type: string) => {
    const relationshipNames: Record<string, string> = {
      'DEPENDS_ON': 'Depends On',
      'BLOCKS': 'Blocks',
      'ENABLES': 'Enables',
      'RELATES_TO': 'Related To',
      'IS_PART_OF': 'Is Part Of',
      'FOLLOWS': 'Follows',
      'PARALLEL_WITH': 'Parallel With',
      'DUPLICATES': 'Duplicates',
      'CONFLICTS_WITH': 'Conflicts With',
      'VALIDATES': 'Validates',
      'REFERENCES': 'References',
      'CONTAINS': 'Contains',
    };
    return relationshipNames[type] || type.replace('_', ' ');
  };

  const getRelationshipIcon = (type: string) => {
    switch (type) {
      case 'DEPENDS_ON': return <ArrowLeft className="h-3 w-3" />;
      case 'BLOCKS': return <Ban className="h-3 w-3" />;
      case 'ENABLES': return <CheckCircle className="h-3 w-3" />;
      case 'RELATES_TO': return <Link2 className="h-3 w-3" />;
      case 'IS_PART_OF': return <Folder className="h-3 w-3" />;
      case 'FOLLOWS': return <ArrowRight className="h-3 w-3" />;
      case 'PARALLEL_WITH': return <Split className="h-3 w-3" />;
      case 'DUPLICATES': return <Copy className="h-3 w-3" />;
      case 'CONFLICTS_WITH': return <Zap className="h-3 w-3" />;
      case 'VALIDATES': return <Shield className="h-3 w-3" />;
      case 'REFERENCES': return <Bookmark className="h-3 w-3" />;
      case 'CONTAINS': return <Package className="h-3 w-3" />;
      default: return <Link2 className="h-3 w-3" />;
    }
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
              <span>{node.status}</span>
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
                  <span>{node.status.replace('_', ' ')}</span>
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
              <div className="flex items-center space-x-3">
                <span className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium ${priorityInfo.color}`}>
                  {getPriorityIcon(totalPriority)}
                  <span>{priorityInfo.label}</span>
                </span>
                <span className="text-gray-500 text-sm">({Math.round(totalPriority * 100)}%)</span>
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