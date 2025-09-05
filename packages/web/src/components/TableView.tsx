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

interface TableViewProps {
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

const getStatusColor = (status: string) => {
  const config = getStatusConfig(status as WorkItemStatus);
  return config.color;
};

const getNodePriority = (node: WorkItem) => {
  return node.priority || 0;
};

// Using centralized contributor color function

const getContributorAvatar = (contributor?: string) => {
  if (!contributor) return null;
  
  const initials = contributor.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-8 h-8 rounded-full ${getContributorColor(contributor)} flex items-center justify-center text-white text-xs font-medium`}>
        {initials}
      </div>
      <span className="text-gray-300 text-sm">{contributor}</span>
    </div>
  );
};

const TableView: React.FC<TableViewProps> = ({ filteredNodes, handleEditNode, handleDeleteNode }) => {
  return (
    <div className="p-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden max-w-full">
        <div className="overflow-x-auto max-w-full">
          <table className="w-max min-w-full">
            <thead className="bg-gray-700 border-b border-gray-700">
              <tr>
                <th className="pr-4 py-12 text-left text-sm font-semibold text-gray-300 tracking-wider" style={{ paddingLeft: '80px' }}>Task</th>
                <th className="pl-2 pr-3 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider">Type</th>
                <th className="pl-3 pr-3 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider">Status</th>
                <th className="pl-3 pr-6 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider">Contributor</th>
                <th className="pl-6 pr-6 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider">Priority</th>
                <th className="pl-6 pr-6 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider whitespace-nowrap">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {[...filteredNodes]
                .sort((a, b) => {
                  const dateA = new Date(a.updatedAt || a.createdAt).getTime();
                  const dateB = new Date(b.updatedAt || b.createdAt).getTime();
                  return dateB - dateA; // Most recent first
                })
                .map((node) => (
                <tr key={node.id} className="hover:bg-gray-700/50 transition-colors group dynamic-table-row">
                  <td className="pl-6 pr-4 py-12 dynamic-table-cell">
                    <div className="space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="text-white font-medium text-base flex-1 table-text-content min-w-0">{node.title}</div>
                        {/* Action buttons - appear on hover */}
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
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
                      {node.description && (
                        <div className="text-gray-400 text-sm table-text-content min-w-0">{node.description}</div>
                      )}
                      {/* Tags */}
                      <TagDisplay tags={node.tags} className="mt-2" compact />
                    </div>
                  </td>
                  <td className="pl-2 pr-3 py-10 dynamic-table-cell">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getNodeTypeColor(node.type)} shadow-sm`}>
                      {getTypeIconElement(node.type as WorkItemType, "w-3 h-3")}
                      <span className="ml-1">{formatLabel(node.type)}</span>
                    </span>
                  </td>
                  <td className="pl-3 pr-3 py-10 dynamic-table-cell">
                    <div className="flex items-center whitespace-nowrap">
                      <div className={`mr-2 ${getStatusConfig(node.status as WorkItemStatus).color}`}>
                        {getStatusIconElement(node.status as WorkItemStatus, "h-4 w-4")}
                      </div>
                      <span className={`text-sm font-medium ${getStatusColor(node.status)}`}>
                        {formatLabel(node.status)}
                      </span>
                    </div>
                  </td>
                  <td className="pl-3 pr-6 py-10 dynamic-table-cell">
                    {node.assignedTo ? (
                      getContributorAvatar(node.assignedTo.name)
                    ) : (
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">?</span>
                        </div>
                        <span className="text-gray-500 text-sm">Available</span>
                      </div>
                    )}
                  </td>
                  <td className="pl-6 pr-6 py-10 dynamic-table-cell">
                    <div className="flex items-center w-full relative">
                      <AnimatedPriority
                        value={getNodePriority(node)}
                        className="text-xs font-bold"
                        renderBar={(animatedValue, animatedColor) => (
                          <div className="w-4 h-16 bg-gray-600 rounded overflow-hidden flex flex-col justify-end relative">
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
                  </td>
                  <td className="pl-6 pr-6 py-10 dynamic-table-cell">
                    {node.dueDate ? (
                      <div className="space-y-1">
                        <div className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${getDueDateColorScheme(node.dueDate).bg} ${getDueDateColorScheme(node.dueDate).border} ${getDueDateColorScheme(node.dueDate).text}`}>
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
                      <div className="space-y-1">
                        <div className="inline-flex items-center px-3 py-2 bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                          No due date
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Schedule recommended
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TableView;