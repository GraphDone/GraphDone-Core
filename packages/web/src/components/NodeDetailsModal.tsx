import React from 'react';
import { X, Calendar, Clock, User, Flag, Edit3 } from 'lucide-react';
import { WorkItem } from '../types/graph';

interface NodeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: WorkItem | null;
  onEdit?: (node: WorkItem) => void;
}

export function NodeDetailsModal({ isOpen, onClose, node, onEdit }: NodeDetailsModalProps) {
  if (!isOpen || !node) return null;

  // Use the same priority calculation as ListView for consistency
  const getNodePriority = (node: WorkItem) => {
    return node.priorityComp || node.priorityExec || 0;
  };
  
  const totalPriority = getNodePriority(node);

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'text-green-400 bg-green-400/10';
      case 'IN_PROGRESS': return 'text-blue-400 bg-blue-400/10';
      case 'BLOCKED': return 'text-red-400 bg-red-400/10';
      case 'PLANNED': return 'text-orange-400 bg-orange-400/10';
      case 'PROPOSED': return 'text-purple-400 bg-purple-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'EPIC': return 'text-purple-400 bg-purple-400/10';
      case 'MILESTONE': return 'text-orange-400 bg-orange-400/10';
      case 'FEATURE': return 'text-blue-400 bg-blue-400/10';
      case 'TASK': return 'text-green-400 bg-green-400/10';
      case 'BUG': return 'text-red-400 bg-red-400/10';
      case 'IDEA': return 'text-yellow-400 bg-yellow-400/10';
      case 'RESEARCH': return 'text-teal-400 bg-teal-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${getTypeColor(node.type)}`}>
              {node.type}
            </span>
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(node.status)}`}>
              {node.status}
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
              <span className={`px-3 py-1 rounded-md text-sm font-medium ${getTypeColor(node.type)}`}>
                {node.type}
              </span>
            </div>
            {node.status && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Status</h3>
                <span className={`px-3 py-1 rounded-md text-sm font-medium ${getStatusColor(node.status)}`}>
                  {node.status.replace('_', ' ')}
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
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${priorityInfo.color}`}>
                  {priorityInfo.label}
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
            {node.owner && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Owner</h3>
                <div className="text-gray-300">{node.owner.name}</div>
                <div className="text-gray-500 text-sm">@{node.owner.username}</div>
              </div>
            )}

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