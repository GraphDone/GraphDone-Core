import React from 'react';
import { GitBranch, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  WorkItemType,
  WorkItemStatus,
  getTypeConfig,
  getStatusConfig,
  getTypeIconElement,
  getStatusIconElement,
  getContributorColor,
  getDueDateColorScheme,
  getTypeGradientBackground
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

interface TableViewProps {
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

const getNodeTypeRowBackground = (type: string) => {
  return getTypeGradientBackground(type as WorkItemType, 'table');
};

const getNodeTypeBorderColor = (type: string) => {
  return getTypeConfig(type as WorkItemType).hexColor;
};

const getStatusColor = (status: string) => {
  const config = getStatusConfig(status as WorkItemStatus);
  return config.color;
};

const getNodePriority = (node: WorkItem) => {
  return node.priority || 0;
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

const TableView: React.FC<TableViewProps> = ({ filteredNodes, handleEditNode, edges }) => {
  return (
    <div className="p-6">
      <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-2xl overflow-hidden max-w-full">
        <div className="overflow-x-auto max-w-full">
          <table className="w-max min-w-full">
            <thead className="bg-gradient-to-r from-gray-700 to-gray-800 border-b border-gray-600/50">
              <tr>
                <th className="pr-4 py-12 text-left text-sm font-semibold text-gray-200 tracking-wider uppercase" style={{ paddingLeft: '80px' }}>Task</th>
                <th className="pl-2 pr-3 py-10 text-left text-sm font-semibold text-gray-200 tracking-wider uppercase">Type</th>
                <th className="pl-3 pr-3 py-10 text-left text-sm font-semibold text-gray-200 tracking-wider uppercase">Status</th>
                <th className="pl-3 pr-6 py-10 text-left text-sm font-semibold text-gray-200 tracking-wider uppercase">Contributor</th>
                <th className="pl-6 pr-6 py-10 text-left text-sm font-semibold text-gray-200 tracking-wider uppercase">Priority</th>
                <th className="pl-6 pr-6 py-10 text-left text-sm font-semibold text-gray-200 tracking-wider uppercase">Connections</th>
                <th className="pl-6 pr-6 py-10 text-left text-sm font-semibold text-gray-200 tracking-wider uppercase whitespace-nowrap">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600/30 backdrop-blur-sm">
              {[...filteredNodes]
                .sort((a, b) => {
                  const dateA = new Date(a.updatedAt || a.createdAt).getTime();
                  const dateB = new Date(b.updatedAt || b.createdAt).getTime();
                  return dateB - dateA; // Most recent first
                })
                .map((node, index) => {
                  console.log(`Row ${index}:`, {
                    id: node.id,
                    title: node.title,
                    type: node.type,
                    visible: 'rendering'
                  });
                  return (
                <tr 
                  key={node.id} 
                  onClick={() => handleEditNode(node)}
                  className={`${getNodeTypeRowBackground(node.type)} hover:scale-[1.01] transition-all duration-200 group dynamic-table-row cursor-pointer hover:shadow-xl hover:shadow-white/10 relative hover:brightness-125`}
                  style={{
                    borderLeft: `4px solid ${getNodeTypeBorderColor(node.type)}`,
                    borderRight: `2px solid ${getNodeTypeBorderColor(node.type)}`
                  }}
                >
                  <td className="pl-6 pr-4 py-12 dynamic-table-cell">
                    <div className="space-y-6">
                      <div className="text-white font-medium text-base table-text-content">{node.title}</div>
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
                    {(() => {
                      const { incomingCount, outgoingCount, totalCount } = getConnectionDetails(node, edges);
                      
                      if (totalCount === 0) {
                        return (
                          <div className="flex items-center space-x-2 text-gray-500">
                            <GitBranch className="h-4 w-4" />
                            <span className="text-sm">None</span>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1">
                            <GitBranch className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-white">{totalCount}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {incomingCount > 0 && (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-red-900/20 border border-red-500/30 rounded-md">
                                <ArrowLeft className="h-3 w-3 text-red-400" />
                                <span className="text-xs font-medium text-red-300">{incomingCount}</span>
                              </div>
                            )}
                            {outgoingCount > 0 && (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-purple-900/20 border border-purple-500/30 rounded-md">
                                <ArrowRight className="h-3 w-3 text-purple-400" />
                                <span className="text-xs font-medium text-purple-300">{outgoingCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TableView;