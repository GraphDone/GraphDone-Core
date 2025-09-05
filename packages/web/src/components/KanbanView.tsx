import React from 'react';
import { 
  GitBranch,
  ArrowRight,
  ArrowLeft
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
  WORK_ITEM_STATUSES,
  getContributorColor,
  getDueDateColorScheme
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
  priority: number;
  dueDate?: string;
  tags?: string[];
  metadata?: string;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; username: string; };
  assignedTo?: { id: string; name: string; username: string; };
  graph?: { id: string; name: string; team?: { id: string; name: string; } };
  contributors?: Array<{ id: string; name: string; type: string; }>;
  dependencies?: Array<{ id: string; title: string; type: string; status: string; }>;
  dependents?: Array<{ id: string; title: string; type: string; status: string; }>;
}

interface Edge {
  id: string;
  type: string;
  source: { id: string; title: string; type: string; };
  target: { id: string; title: string; type: string; };
}

interface KanbanViewProps {
  filteredNodes: WorkItem[];
  handleEditNode: (node: WorkItem) => void;
  edges: Edge[];
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

const getNodeTypeKanbanBackground = (type: string) => {
  const config = getTypeConfig(type as WorkItemType);
  // Create enhanced backgrounds for kanban cards - matching Card view opacity levels
  switch (type) {
    case 'EPIC':
      return 'bg-gradient-to-br from-fuchsia-500/10 via-gray-800 to-fuchsia-500/5 hover:from-fuchsia-500/20 hover:to-fuchsia-500/15';
    case 'MILESTONE':
      return 'bg-gradient-to-br from-orange-500/10 via-gray-800 to-orange-500/5 hover:from-orange-500/20 hover:to-orange-500/15';
    case 'OUTCOME':
      return 'bg-gradient-to-br from-indigo-500/10 via-gray-800 to-indigo-500/5 hover:from-indigo-500/20 hover:to-indigo-500/15';
    case 'FEATURE':
      return 'bg-gradient-to-br from-sky-500/10 via-gray-800 to-sky-500/5 hover:from-sky-500/20 hover:to-sky-500/15';
    case 'TASK':
      return 'bg-gradient-to-br from-green-500/10 via-gray-800 to-green-500/5 hover:from-green-500/20 hover:to-green-500/15';
    case 'BUG':
      return 'bg-gradient-to-br from-red-500/10 via-gray-800 to-red-500/5 hover:from-red-500/20 hover:to-red-500/15';
    case 'IDEA':
      return 'bg-gradient-to-br from-yellow-500/10 via-gray-800 to-yellow-500/5 hover:from-yellow-500/20 hover:to-yellow-500/15';
    case 'RESEARCH':
      return 'bg-gradient-to-br from-teal-500/10 via-gray-800 to-teal-500/5 hover:from-teal-500/20 hover:to-teal-500/15';
    default:
      return 'bg-gradient-to-br from-gray-500/10 via-gray-800 to-gray-500/5 hover:from-gray-500/20 hover:to-gray-500/15';
  }
};

const getNodePriority = (node: WorkItem) => {
  return node.priority || 0;
};

const getNodeTypeKanbanBorderColor = (type: string) => {
  return getTypeConfig(type as WorkItemType).hexColor;
};

const getConnectionDetails = (node: WorkItem, edges: Edge[]) => {
  const incomingEdges = edges.filter(edge => edge.target.id === node.id);
  const outgoingEdges = edges.filter(edge => edge.source.id === node.id);
  const incomingCount = incomingEdges.length;
  const outgoingCount = outgoingEdges.length;
  const totalCount = incomingCount + outgoingCount;
  return { 
    incomingCount, 
    outgoingCount, 
    totalCount,
    incomingEdges,
    outgoingEdges
  };
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

const KanbanView: React.FC<KanbanViewProps> = ({ filteredNodes, handleEditNode, edges }) => {
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
                    onClick={() => handleEditNode(node)}
                    className={`${getNodeTypeKanbanBackground(node.type)} rounded-lg p-4 shadow-md hover:shadow-lg hover:shadow-white/10 transition-all duration-200 cursor-pointer border border-gray-600/40 hover:border-gray-500/60 hover:bg-white/5 hover:scale-[1.02] hover:-translate-y-1 hover:brightness-125 group backdrop-blur-sm`}
                    style={{
                      borderLeft: `4px solid ${getNodeTypeKanbanBorderColor(node.type)}`,
                      borderLeftWidth: '4px',
                      borderLeftStyle: 'solid',
                      borderLeftColor: getNodeTypeKanbanBorderColor(node.type)
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(node.type)}`}>
                        {getTypeIconElement(node.type as WorkItemType, "w-3 h-3")}
                        <span className="ml-1">{formatLabel(node.type)}</span>
                      </span>
                      
                      {/* Connections */}
                      {(() => {
                        const { incomingCount, outgoingCount, totalCount } = getConnectionDetails(node, edges);
                        
                        if (totalCount === 0) {
                          return (
                            <div className="flex items-center space-x-1 text-gray-400 dark:text-gray-500">
                              <GitBranch className="h-3 w-3" />
                              <span className="text-xs">0</span>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1">
                              <GitBranch className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{totalCount}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              {incomingCount > 0 && (
                                <div className="flex items-center space-x-1 px-1 py-0.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-500/30 rounded">
                                  <ArrowLeft className="h-2 w-2 text-red-500" />
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400">{incomingCount}</span>
                                </div>
                              )}
                              {outgoingCount > 0 && (
                                <div className="flex items-center space-x-1 px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-500/30 rounded">
                                  <ArrowRight className="h-2 w-2 text-purple-500" />
                                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{outgoingCount}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
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
                            <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border transition-colors ${getDueDateColorScheme(node.dueDate).bg} ${getDueDateColorScheme(node.dueDate).border} ${getDueDateColorScheme(node.dueDate).text}`}>
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