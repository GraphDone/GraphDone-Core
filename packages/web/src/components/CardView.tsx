import React from 'react';
import { 
  GitBranch,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import {
  WorkItemType,
  WorkItemStatus,
  getTypeConfig,
  getStatusConfig,
  getTypeIconElement,
  getStatusIconElement,
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

interface CardViewProps {
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
  return `${config.bgColor} ${config.color}`;
};

const getNodeTypeCardBackground = (type: string) => {
  const config = getTypeConfig(type as WorkItemType);
  // Create enhanced backgrounds based on type with improved hover states
  switch (type) {
    case 'EPIC':
      return 'bg-gradient-to-br from-fuchsia-500/10 via-gray-800 to-fuchsia-500/5 border-l-4 border-l-fuchsia-400/40 hover:from-fuchsia-500/20 hover:to-fuchsia-500/15 hover:border-l-fuchsia-300/60';
    case 'MILESTONE':
      return 'bg-gradient-to-br from-orange-500/10 via-gray-800 to-orange-500/5 border-l-4 border-l-orange-400/40 hover:from-orange-500/20 hover:to-orange-500/15 hover:border-l-orange-300/60';
    case 'OUTCOME':
      return 'bg-gradient-to-br from-indigo-500/10 via-gray-800 to-indigo-500/5 border-l-4 border-l-indigo-400/40 hover:from-indigo-500/20 hover:to-indigo-500/15 hover:border-l-indigo-300/60';
    case 'FEATURE':
      return 'bg-gradient-to-br from-sky-500/10 via-gray-800 to-sky-500/5 border-l-4 border-l-sky-400/40 hover:from-sky-500/20 hover:to-sky-500/15 hover:border-l-sky-300/60';
    case 'TASK':
      return 'bg-gradient-to-br from-green-500/10 via-gray-800 to-green-500/5 border-l-4 border-l-green-400/40 hover:from-green-500/20 hover:to-green-500/15 hover:border-l-green-300/60';
    case 'BUG':
      return 'bg-gradient-to-br from-red-500/10 via-gray-800 to-red-500/5 border-l-4 border-l-red-500/40 hover:from-red-500/20 hover:to-red-500/15 hover:border-l-red-400/60';
    case 'IDEA':
      return 'bg-gradient-to-br from-yellow-500/10 via-gray-800 to-yellow-500/5 border-l-4 border-l-yellow-400/40 hover:from-yellow-500/20 hover:to-yellow-500/15 hover:border-l-yellow-300/60';
    case 'RESEARCH':
      return 'bg-gradient-to-br from-teal-500/10 via-gray-800 to-teal-500/5 border-l-4 border-l-teal-400/40 hover:from-teal-500/20 hover:to-teal-500/15 hover:border-l-teal-300/60';
    default:
      return 'bg-gradient-to-br from-gray-500/10 via-gray-800 to-gray-500/5 border-l-4 border-l-gray-500/40 hover:from-gray-500/20 hover:to-gray-500/15 hover:border-l-gray-400/60';
  }
};

const getNodePriority = (node: WorkItem) => {
  return node.priority || 0;
};

const getNodeTypeCardBorderColor = (type: string) => {
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

const CardView: React.FC<CardViewProps> = ({ filteredNodes, handleEditNode, edges }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {[...filteredNodes]
        .sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateB - dateA; // Most recent first
        })
        .map((node) => (
        <div
          key={node.id}
          onClick={() => handleEditNode(node)}
          className={`${getNodeTypeCardBackground(node.type)} rounded-xl p-6 shadow-lg hover:shadow-xl hover:shadow-white/10 transition-all duration-200 cursor-pointer border border-gray-600/50 hover:border-gray-500/70 hover:bg-white/5 hover:scale-[1.02] hover:-translate-y-1 hover:brightness-125 group backdrop-blur-sm`}
          style={{
            borderLeft: `4px solid ${getNodeTypeCardBorderColor(node.type)}`,
            borderLeftWidth: '4px',
            borderLeftStyle: 'solid',
            borderLeftColor: getNodeTypeCardBorderColor(node.type)
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${getNodeTypeColor(node.type)}`}>
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
                      <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-500/30 rounded">
                        <ArrowLeft className="h-2.5 w-2.5 text-red-500" />
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">{incomingCount}</span>
                      </div>
                    )}
                    {outgoingCount > 0 && (
                      <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-500/30 rounded">
                        <ArrowRight className="h-2.5 w-2.5 text-purple-500" />
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{outgoingCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          
          <h3 className="text-gray-900 dark:text-white font-semibold mb-3 text-lg leading-tight break-words">{node.title}</h3>
          
          {node.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed break-words">{node.description}</p>
          )}

          {/* Tags */}
          <TagDisplay tags={node.tags} className="mb-4" />

          {/* Priority and Due Date */}
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Priority</span>
            </div>
            <div className="flex items-center justify-between">
              {/* Priority - Left Side */}
              <div className="flex items-center space-x-3">
                <AnimatedPriority
                  value={getNodePriority(node)}
                  className="text-sm font-semibold"
                  renderBar={(animatedValue, animatedColor) => (
                    <div className="flex items-center relative">
                      <div className="w-3 h-12 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden flex flex-col justify-end relative">
                        <div 
                          className="w-full transition-colors duration-300"
                          style={{ 
                            height: `${Math.max(animatedValue * 100, 8)}%`,
                            backgroundColor: animatedColor
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                />
                
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {getNodePriority(node) >= 0.8 ? 'Critical' :
                     getNodePriority(node) >= 0.6 ? 'High' :
                     getNodePriority(node) >= 0.4 ? 'Medium' :
                     getNodePriority(node) >= 0.2 ? 'Low' : 'Minimal'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start justify-center mr-2">
                {node.dueDate ? (
                  <div className="space-y-1 text-left">
                    <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md shadow-sm ${getDueDateColorScheme(node.dueDate).bg} ${getDueDateColorScheme(node.dueDate).border} ${getDueDateColorScheme(node.dueDate).text}`}>
                      {new Date(node.dueDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div className={`text-xs font-medium ${getDueDateColorScheme(node.dueDate).textSecondary}`}>
                      {(() => {
                        const today = new Date();
                        const due = new Date(node.dueDate);
                        const diffTime = due.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                          return `${Math.abs(diffDays)}d overdue`;
                        } else if (diffDays === 0) {
                          return 'Due today';
                        } else if (diffDays === 1) {
                          return 'Due tomorrow';
                        } else if (diffDays <= 7) {
                          return `${diffDays}d remaining`;
                        } else {
                          return `${diffDays}d remaining`;
                        }
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-left">
                    <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${getDueDateColorScheme().bg} ${getDueDateColorScheme().border} ${getDueDateColorScheme().text}`}>
                      No due date
                    </div>
                    <div className={`text-xs ${getDueDateColorScheme().textSecondary}`}>
                      Schedule recommended
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
            {/* Contributor */}
            <div className="flex items-center">
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

            
            {/* Status */}
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm ${(() => {
              const config = getStatusConfig(node.status as WorkItemStatus);
              return `${config.bgColor} ${config.borderColor} ${config.color}`;
            })()}`}>
              <div>
                {getStatusIconElement(node.status as WorkItemStatus, "h-4 w-4")}
              </div>
              <span>{formatLabel(node.status)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardView;