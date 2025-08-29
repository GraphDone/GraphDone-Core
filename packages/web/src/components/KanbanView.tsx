import React from 'react';
import { 
  Edit,
  Trash2
} from 'lucide-react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  ClipboardList,
  WorkItemType,
  WorkItemStatus,
  getTypeConfig,
  getTypeIconElement,
  getStatusConfig,
  getStatusIconElement,
  WORK_ITEM_STATUSES
} from '../constants/workItemConstants';
import { TagDisplay } from './TagDisplay';
import { AnimatedPriority } from './AnimatedPriority';

// WorkItem interface matching GraphQL schema
interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priorityExec: number;
  priorityIndiv: number;
  priorityComm: number;
  priorityComp: number;
  dueDate?: string;
  tags?: string[];
  metadata?: string;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; username: string; };
  assignedTo?: { id: string; name: string; username: string; };
  graph?: { id: string; name: string; team?: { id: string; name: string; } };
  contributors?: Array<{ id: string; name: string; type: string; }>;
  dependencies?: Array<{ id: string; title: string; type: string; }>;
  dependents?: Array<{ id: string; title: string; type: string; }>;
}

interface KanbanViewProps {
  filteredNodes: WorkItem[];
  handleEditNode: (node: WorkItem) => void;
  handleDeleteNode: (node: WorkItem) => void;
}

const formatLabel = (label: string) => {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getNodeTypeColor = (type: string) => {
  const config = getTypeConfig(type as WorkItemType);
  return `${config.color} ${config.bgColor} ${config.borderColor} border`;
};

const getNodePriority = (node: WorkItem) => {
  return node.priorityExec || 0;
};

const getContributorColor = (name: string) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500',
    'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500'
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const getContributorAvatar = (contributor?: string) => {
  if (!contributor) return null;
  
  const initials = contributor.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-7 h-7 rounded-full ${getContributorColor(contributor)} flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-gray-700 shadow-sm`}>
        {initials}
      </div>
      <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">{contributor}</span>
    </div>
  );
};

const KanbanView: React.FC<KanbanViewProps> = ({ filteredNodes, handleEditNode, handleDeleteNode }) => {
  const statuses = Object.keys(WORK_ITEM_STATUSES) as WorkItemStatus[];

  const nodesByStatus = statuses.reduce((acc, status) => {
    acc[status] = filteredNodes.filter(node => node.status === status);
    return acc;
  }, {} as Record<string, WorkItem[]>);

  return (
    <div className="flex space-x-4 p-6 overflow-x-auto h-full">
      {statuses.map((status) => {
        const nodes = nodesByStatus[status] || [];
        const config = getStatusConfig(status);
        
        return (
          <div key={status} className="flex-shrink-0 w-80">
            <div className="bg-gray-800 rounded-lg h-full">
              <div className={`p-4 border-b border-gray-600`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`${config.bgColor} rounded-lg p-2 border ${config.borderColor}`}>
                      <span className={`${config.color} text-sm font-semibold`}>{nodes.length}</span>
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-base">{config.label}</h3>
                      <p className="text-sm text-gray-400">{nodes.length} {nodes.length === 1 ? 'task' : 'tasks'}</p>
                    </div>
                  </div>
                  <div className="text-white">{getStatusIconElement(status, "h-4 w-4")}</div>
                </div>
              </div>
              
              <div className="p-4 space-y-3">
                {[...nodes]
                  .sort((a, b) => {
                    const dateA = new Date(a.updatedAt || a.createdAt).getTime();
                    const dateB = new Date(b.updatedAt || b.createdAt).getTime();
                    return dateB - dateA; // Most recent first
                  })
                  .map((node) => (
                  <div
                    key={node.id}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-[1.02] hover:-translate-y-1 group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(node.type)}`}>
                        {getTypeIconElement(node.type as WorkItemType, "w-3 h-3")}
                        <span className="ml-1">{formatLabel(node.type)}</span>
                      </span>
                      
                      {/* Action buttons - appear on hover */}
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditNode(node);
                          }}
                          className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                          title="Edit node"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode(node);
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                          title="Delete node"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="text-gray-900 dark:text-white font-medium mb-2 text-base break-words">{node.title}</h4>
                    
                    {/* Description */}
                    {node.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 break-words">
                        {node.description}
                      </p>
                    )}

                    {/* Tags */}
                    <TagDisplay tags={node.tags} className="mb-3" compact />
                    
                    {/* Priority and Due Date */}
                    <div className="mb-3 flex items-start justify-between">
                      {/* Priority - Left Side */}
                      <div className="flex items-center relative">
                        <AnimatedPriority
                          value={getNodePriority(node)}
                          className="text-xs font-bold"
                          renderBar={(animatedValue, animatedColor) => (
                            <div className="w-4 h-12 bg-gray-600 rounded overflow-hidden flex flex-col justify-end relative">
                              <div 
                                className="w-full transition-colors duration-300"
                                style={{ 
                                  height: `${Math.max(animatedValue * 100, 5)}%`,
                                  backgroundColor: animatedColor
                                }}
                              ></div>
                            </div>
                          )}
                        />
                      </div>

                      {/* Due Date - Right Side */}
                      <div className="flex flex-col items-start">
                        {node.dueDate ? (
                          <div className="space-y-1 text-left">
                            <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border transition-colors ${
                              new Date(node.dueDate) < new Date() 
                                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' 
                                : new Date(node.dueDate).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000 
                                  ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' 
                                  : 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                            }`}>
                              {new Date(node.dueDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className={`text-xs font-medium ${
                              new Date(node.dueDate) < new Date() 
                                ? 'text-red-600 dark:text-red-400' 
                                : new Date(node.dueDate).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000 
                                  ? 'text-amber-600 dark:text-amber-400' 
                                  : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {(() => {
                                const today = new Date();
                                const due = new Date(node.dueDate);
                                const diffTime = due.getTime() - today.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                
                                if (diffDays < 0) {
                                  return `${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'} overdue`;
                                } else if (diffDays === 0) {
                                  return 'Due today';
                                } else if (diffDays === 1) {
                                  return 'Due tomorrow';
                                } else if (diffDays <= 7) {
                                  return `${diffDays} days remaining`;
                                } else {
                                  return `${diffDays} days remaining`;
                                }
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1 text-left">
                            <div className="inline-flex items-center px-2 py-1 bg-gray-100 border border-gray-200 text-gray-600 text-xs font-medium rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                              No due date
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Schedule recommended
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Contributor */}
                    <div className="mt-3 flex items-center">
                      {node.assignedTo ? (
                        getContributorAvatar(node.assignedTo.name)
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-sm">
                            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">?</span>
                          </div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Available</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanView;