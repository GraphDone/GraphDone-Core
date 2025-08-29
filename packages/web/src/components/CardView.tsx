import React from 'react';
import { 
  Edit,
  Trash2
} from 'lucide-react';
import {
  WorkItemType,
  WorkItemStatus,
  getTypeConfig,
  getStatusConfig,
  getTypeIconElement,
  getStatusIconElement
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

interface CardViewProps {
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
  return `${config.bgColor} ${config.color}`;
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

const CardView: React.FC<CardViewProps> = ({ filteredNodes, handleEditNode, handleDeleteNode }) => {
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
          className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-[1.02] hover:-translate-y-1 group"
        >
          <div className="flex items-start justify-between mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${getNodeTypeColor(node.type)}`}>
              {getTypeIconElement(node.type as WorkItemType, "w-3 h-3")}
              <span className="ml-1">{formatLabel(node.type)}</span>
            </span>
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditNode(node);
                }}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
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
                    <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md shadow-sm ${
                      new Date(node.dueDate) < new Date() 
                        ? 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' 
                        : new Date(node.dueDate).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' 
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
                    <div className="inline-flex items-center px-2 py-1 bg-gray-100 border border-gray-200 text-gray-600 text-xs font-medium rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                      No due date
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
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