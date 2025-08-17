import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  ChevronDown, 
  Grid3X3, 
  Kanban, 
  BarChart3, 
  Circle,
  Table,
  Tag
} from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { mockProjectNodes, MockNode } from '../types/projectData';

type ViewType = 'dashboard' | 'cards' | 'kanban' | 'table';

interface ViewOption {
  id: ViewType;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const viewOptions: ViewOption[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Track progress, analyze trends, and view project statistics',
    icon: <BarChart3 className="h-4 w-4" />
  },
  {
    id: 'table',
    name: 'Table View',
    description: 'Browse detailed task information with sorting and filtering',
    icon: <Table className="h-4 w-4" />
  },
  {
    id: 'cards',
    name: 'Card View',
    description: 'Scan tasks quickly in an organized visual grid layout',
    icon: <Grid3X3 className="h-4 w-4" />
  },
  {
    id: 'kanban',
    name: 'Kanban View',
    description: 'Manage workflow and move tasks through status columns',
    icon: <Kanban className="h-4 w-4" />
  }
];

export function ListView() {
  const { currentGraph } = useGraph();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter nodes based on search and filters
  const filteredNodes = useMemo(() => {
    let filtered = mockProjectNodes;
    
    if (searchTerm) {
      filtered = filtered.filter(node =>
        node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'All Types') {
      filtered = filtered.filter(node => node.type === typeFilter);
    }

    if (statusFilter !== 'All Statuses') {
      filtered = filtered.filter(node => node.status === statusFilter);
    }

    return filtered;
  }, [searchTerm, typeFilter, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = mockProjectNodes.length;
    const completed = mockProjectNodes.filter(node => node.status === 'COMPLETED').length;
    const inProgress = mockProjectNodes.filter(node => node.status === 'IN_PROGRESS').length;
    const blocked = mockProjectNodes.filter(node => node.status === 'BLOCKED').length;
    const planned = mockProjectNodes.filter(node => node.status === 'PLANNED').length;

    const typeStats = mockProjectNodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityStats = {
      critical: mockProjectNodes.filter(node => node.priority.computed >= 0.8).length,
      high: mockProjectNodes.filter(node => node.priority.computed >= 0.6 && node.priority.computed < 0.8).length,
      moderate: mockProjectNodes.filter(node => node.priority.computed >= 0.4 && node.priority.computed < 0.6).length,
      low: mockProjectNodes.filter(node => node.priority.computed >= 0.2 && node.priority.computed < 0.4).length,
      minimal: mockProjectNodes.filter(node => node.priority.computed < 0.2).length
    };

    return {
      total,
      completed,
      inProgress,
      blocked,
      planned,
      typeStats,
      priorityStats
    };
  }, []);

  // Helper functions
  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'EPIC': return 'bg-purple-500 text-white';
      case 'FEATURE': return 'bg-blue-500 text-white';
      case 'TASK': return 'bg-green-500 text-white';
      case 'BUG': return 'bg-red-500 text-white';
      case 'MILESTONE': return 'bg-yellow-500 text-black';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-400';
      case 'IN_PROGRESS': return 'text-blue-400';
      case 'BLOCKED': return 'text-red-400';
      case 'PLANNED': return 'text-yellow-400';
      case 'PROPOSED': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const getPriorityIndicator = (priority: number) => {
    if (priority > 0.7) return 'bg-red-500';
    if (priority > 0.4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Card View
  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      {filteredNodes.map((node) => (
        <div
          key={node.id}
          className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600"
        >
          <div className="flex items-start justify-between mb-3">
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(node.type)}`}>
              {node.type}
            </span>
            <div className={`w-3 h-3 rounded-full ${getPriorityIndicator(node.priority.computed)}`}></div>
          </div>
          
          <h3 className="text-white font-medium mb-2 line-clamp-2">{node.title}</h3>
          
          {node.description && (
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">{node.description}</p>
          )}
          
          <div className="flex items-center justify-between">
            {node.assignee ? (
              <div className="flex items-center space-x-2">
                <span className="text-gray-300 text-sm">{node.assignee}</span>
              </div>
            ) : (
              <span className="text-gray-500 text-sm">Unassigned</span>
            )}
          </div>
          
          <div className={`mt-2 text-sm ${getStatusColor(node.status)}`}>
            <Circle className="h-3 w-3 inline mr-1" />
            {node.status.replace('_', ' ')}
          </div>
        </div>
      ))}
    </div>
  );

  // Kanban View
  const renderKanbanView = () => {
    const statuses = ['PROPOSED', 'PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];
    const statusConfig = {
      'PROPOSED': { 
        label: 'Proposed', 
        icon: '💡', 
        color: 'bg-slate-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-slate-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-slate-400'
      },
      'PLANNED': { 
        label: 'Planned', 
        icon: '📋', 
        color: 'bg-blue-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-blue-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-blue-400'
      },
      'IN_PROGRESS': { 
        label: 'In Progress', 
        icon: '⚡', 
        color: 'bg-amber-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-amber-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-amber-400'
      },
      'BLOCKED': { 
        label: 'Blocked', 
        icon: '🚫', 
        color: 'bg-red-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-red-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-red-400'
      },
      'COMPLETED': { 
        label: 'Completed', 
        icon: '✅', 
        color: 'bg-emerald-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-emerald-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-emerald-400'
      }
    };

    const nodesByStatus = statuses.reduce((acc, status) => {
      acc[status] = filteredNodes.filter(node => node.status === status);
      return acc;
    }, {} as Record<string, MockNode[]>);

    return (
      <div className="flex space-x-4 p-6 overflow-x-auto h-full">
        {statuses.map((status) => {
          const nodes = nodesByStatus[status] || [];
          const config = statusConfig[status as keyof typeof statusConfig];
          
          return (
            <div key={status} className="flex-shrink-0 w-80">
              <div className="bg-gray-800 rounded-lg h-full">
                <div className={`p-4 border-b ${config.borderColor}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`${config.color} rounded-lg p-2`}>
                        <span className="text-white text-sm font-semibold">{nodes.length}</span>
                      </div>
                      <div>
                        <h3 className="text-white font-medium text-base">{config.label}</h3>
                        <p className="text-sm text-gray-400">{nodes.length} {nodes.length === 1 ? 'task' : 'tasks'}</p>
                      </div>
                    </div>
                    <span className="text-lg">{config.icon}</span>
                  </div>
                </div>
                
                <div className="p-4 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {nodes.map((node) => (
                    <div
                      key={node.id}
                      className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(node.type)}`}>
                          {node.type}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${getPriorityIndicator(node.priority.computed)}`}></div>
                      </div>
                      
                      <h4 className="text-white font-medium mb-2 line-clamp-2 text-base">{node.title}</h4>
                      
                      {node.assignee && (
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-300 text-base">{node.assignee}</span>
                        </div>
                      )}
                      
                      <div className={`${config.dotColor} w-2 h-2 rounded-full mt-2`}></div>
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

  // Helper function to get assignee avatar
  const getAssigneeAvatar = (assignee?: string) => {
    if (!assignee) return null;
    
    // Generate avatar color based on name
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-teal-500'
    ];
    const colorIndex = assignee.length % colors.length;
    const initials = assignee.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    return (
      <div className="flex items-center space-x-2">
        <div className={`w-8 h-8 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-xs font-medium`}>
          {initials}
        </div>
        <span className="text-gray-300 text-sm">{assignee}</span>
      </div>
    );
  };

  // Table View
  const renderTableView = () => (
    <div className="p-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden max-w-full">
        <div className="overflow-x-auto max-w-full">
          <table className="w-max min-w-full">
            <thead className="bg-gray-750 border-b border-gray-700">
              <tr>
                <th className="pr-4 py-12 text-left text-sm font-semibold text-gray-300 tracking-wider" style={{ paddingLeft: '80px' }}>Task</th>
                <th className="pl-2 pr-3 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider">Type</th>
                <th className="pl-3 pr-3 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider">Status</th>
                <th className="pl-3 pr-6 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider">Assignee</th>
                <th className="pl-6 pr-6 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider">Priority</th>
                <th className="pl-6 pr-6 py-10 text-left text-sm font-semibold text-gray-300 tracking-wider whitespace-nowrap">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredNodes.map((node) => (
                <tr key={node.id} className="hover:bg-gray-750 transition-colors cursor-pointer group">
                  <td className="pl-6 pr-4 py-12">
                    <div className="space-y-3">
                      <div className="text-white font-medium text-base leading-snug">{node.title}</div>
                      {node.description && (
                        <div className="text-gray-400 text-sm leading-relaxed line-clamp-3">{node.description}</div>
                      )}
                      {node.tags && node.tags.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto">
                          {node.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-600 text-gray-200 whitespace-nowrap flex-shrink-0"
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="pl-2 pr-3 py-10">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getNodeTypeColor(node.type)} shadow-sm`}>
                      {node.type}
                    </span>
                  </td>
                  <td className="pl-3 pr-3 py-10">
                    <div className="flex items-center whitespace-nowrap">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        node.status === 'COMPLETED' ? 'bg-green-400' :
                        node.status === 'IN_PROGRESS' ? 'bg-blue-400' :
                        node.status === 'BLOCKED' ? 'bg-red-400' :
                        node.status === 'PLANNED' ? 'bg-yellow-400' :
                        'bg-purple-400'
                      }`}></div>
                      <span className={`text-sm font-medium ${getStatusColor(node.status)}`}>
                        {node.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="pl-3 pr-6 py-10">
                    {node.assignee ? (
                      getAssigneeAvatar(node.assignee)
                    ) : (
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">?</span>
                        </div>
                        <span className="text-gray-500 text-sm">Unassigned</span>
                      </div>
                    )}
                  </td>
                  <td className="pl-6 pr-6 py-10">
                    <div className="flex items-center w-full">
                      <div className="flex-1 h-4 bg-gray-600 rounded-full overflow-hidden border border-gray-500">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            node.priority.computed >= 0.8 ? 'bg-red-500' :
                            node.priority.computed >= 0.6 ? 'bg-orange-500' :
                            node.priority.computed >= 0.4 ? 'bg-yellow-500' :
                            node.priority.computed >= 0.2 ? 'bg-blue-500' :
                            'bg-green-500'
                          }`}
                          style={{ 
                            width: `${Math.max(node.priority.computed * 100, 2)}%`,
                            borderRadius: node.priority.computed >= 1 ? '9999px' : '9999px 0 0 9999px'
                          }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="pl-6 pr-6 py-10">
                    <span className="text-sm text-gray-300 whitespace-nowrap">
                      {node.dueDate ? new Date(node.dueDate).toLocaleDateString() : 
                        <span className="text-gray-500">No date</span>
                      }
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Pie Chart Component
  const PieChart = ({ data, title }: { data: Array<{label: string, value: number, color: string}>, title: string }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativePercentage = 0;

    const createPath = (percentage: number, startPercentage: number) => {
      const startAngle = startPercentage * 3.6 - 90;
      const endAngle = (startPercentage + percentage) * 3.6 - 90;
      const largeArcFlag = percentage > 50 ? 1 : 0;
      
      const startX = 50 + 40 * Math.cos(startAngle * Math.PI / 180);
      const startY = 50 + 40 * Math.sin(startAngle * Math.PI / 180);
      const endX = 50 + 40 * Math.cos(endAngle * Math.PI / 180);
      const endY = 50 + 40 * Math.sin(endAngle * Math.PI / 180);

      return `M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
    };

    return (
      <div className="bg-gray-800 rounded-lg p-4 pl-2 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 text-center">{title}</h3>
        <div className="flex items-center space-x-0">
          <svg width="220" height="220" viewBox="0 0 100 100" className="flex-shrink-0">
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const path = createPath(percentage, cumulativePercentage);
              const currentCumulative = cumulativePercentage;
              cumulativePercentage += percentage;
              
              return (
                <path
                  key={index}
                  d={path}
                  fill={item.color}
                  stroke="#374151"
                  strokeWidth="0.5"
                  className="hover:opacity-80 transition-opacity"
                />
              );
            })}
          </svg>
          <div className="space-y-2">
            {data.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-sm text-gray-300">{item.label}</span>
                <span className="text-sm font-medium text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Bar Chart Component
  const BarChart = ({ data, title }: { data: Array<{label: string, value: number, color: string}>, title: string }) => {
    const maxValue = Math.max(...data.map(item => item.value));

    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">{item.label}</span>
                <span className="text-sm font-medium text-white">{item.value}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: item.color
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Dashboard View
  const renderDashboardView = () => (
    <div className="p-6 space-y-6">
      {/* Stats Cards - First Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.total}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">Total Tasks</div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.completed}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">Completed</div>
              <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.inProgress}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">In Progress</div>
              <div className="text-2xl font-bold text-blue-400">{stats.inProgress}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.blocked}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">Blocked</div>
              <div className="text-2xl font-bold text-red-400">{stats.blocked}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.planned}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">Planned</div>
              <div className="text-2xl font-bold text-yellow-400">{stats.planned}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{mockProjectNodes.filter(n => n.status === 'PROPOSED').length}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">Proposed</div>
              <div className="text-2xl font-bold text-purple-400">{mockProjectNodes.filter(n => n.status === 'PROPOSED').length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution Pie Chart */}
        <PieChart 
          title="Status Distribution"
          data={[
            { label: 'Completed', value: stats.completed, color: '#10b981' },
            { label: 'In Progress', value: stats.inProgress, color: '#3b82f6' },
            { label: 'Blocked', value: stats.blocked, color: '#ef4444' },
            { label: 'Planned', value: stats.planned, color: '#f59e0b' },
            { label: 'Proposed', value: mockProjectNodes.filter(n => n.status === 'PROPOSED').length, color: '#8b5cf6' }
          ]}
        />

        {/* Task Types Bar Chart */}
        <BarChart 
          title="Task Types"
          data={Object.entries(stats.typeStats).map(([type, count]) => ({
            label: type,
            value: count,
            color: type === 'EPIC' ? '#3b82f6' : 
                   type === 'FEATURE' ? '#3b82f6' :
                   type === 'TASK' ? '#10b981' :
                   type === 'BUG' ? '#ef4444' :
                   type === 'MILESTONE' ? '#f59e0b' : '#6b7280'
          }))}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Tasks</h3>
        <div className="space-y-3">
          {filteredNodes.slice(0, 5).map((node) => (
            <div key={node.id} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(node.type)}`}>
                {node.type}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{node.title}</div>
                <div className={`text-xs ${getStatusColor(node.status)}`}>{node.status}</div>
              </div>
              <div className={`w-3 h-3 rounded-full ${getPriorityIndicator(node.priority.computed)}`}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );


  const currentViewOption = viewOptions.find(option => option.id === currentView)!;

  if (!currentGraph) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h3 className="text-lg font-medium text-white mb-2">No Graph Selected</h3>
          <p className="text-gray-400">Select a graph to view its data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-green-300">
                {currentGraph.name}
              </h1>
              
              {/* View Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors text-white"
                >
                  {currentViewOption.icon}
                  <span className="text-sm font-medium">{currentViewOption.name}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isViewDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      {viewOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setCurrentView(option.id);
                            setIsViewDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                            currentView === option.id
                              ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                              : 'hover:bg-gray-700 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${
                              currentView === option.id ? 'bg-green-900/30' : 'bg-gray-700'
                            }`}>
                              {option.icon}
                            </div>
                            <div>
                              <div className={`text-sm font-medium ${
                                currentView === option.id ? 'text-green-300' : 'text-white'
                              }`}>{option.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{option.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-400"
              />
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="All Types">All Types</option>
              <option value="EPIC">EPIC</option>
              <option value="FEATURE">FEATURE</option>
              <option value="TASK">TASK</option>
              <option value="BUG">BUG</option>
              <option value="MILESTONE">MILESTONE</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="All Statuses">All Statuses</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="PLANNED">PLANNED</option>
              <option value="PROPOSED">PROPOSED</option>
            </select>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {currentView === 'dashboard' && renderDashboardView()}
          {currentView === 'table' && renderTableView()}
          {currentView === 'cards' && renderCardView()}
          {currentView === 'kanban' && renderKanbanView()}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 p-6">
        <div className="space-y-6">
          {/* Project Overview */}
          <div className="bg-gray-750 rounded-lg p-10 border border-gray-600">
            <h3 className="text-2xl font-semibold text-white mb-7">Project Overview</h3>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">Overall Progress</span>
                <span className="text-sm font-medium text-green-400">
                  {Math.round((stats.completed / stats.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Total Count */}
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">Total Tasks</div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-gray-750 rounded-lg p-6 border border-gray-600">
            <h3 className="text-xl font-semibold text-white mb-6">Task Status</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-300">✅ Completed</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-400">{stats.completed}</div>
                  <div className="text-xs text-gray-500">{Math.round((stats.completed / stats.total) * 100)}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-300">⚡ In Progress</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-400">{stats.inProgress}</div>
                  <div className="text-xs text-gray-500">{Math.round((stats.inProgress / stats.total) * 100)}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-300">🚫 Blocked</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-400">{stats.blocked}</div>
                  <div className="text-xs text-gray-500">{Math.round((stats.blocked / stats.total) * 100)}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-300">📋 Planned</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-400">{stats.planned}</div>
                  <div className="text-xs text-gray-500">{Math.round((stats.planned / stats.total) * 100)}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-300">💡 Proposed</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-400">{mockProjectNodes.filter(n => n.status === 'PROPOSED').length}</div>
                  <div className="text-xs text-gray-500">{Math.round((mockProjectNodes.filter(n => n.status === 'PROPOSED').length / stats.total) * 100)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Node Types */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Node Types</h3>
            <div className="space-y-3">
              {Object.entries(stats.typeStats).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(type)}`}>
                      {type}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{count}</span>
                    <div className="w-16 h-2 bg-gray-700 rounded-full">
                      <div 
                        className="h-2 bg-green-500 rounded-full" 
                        style={{ width: `${(count / stats.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Distribution */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Priority Distribution</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-300">🔴 Critical Priority</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.critical}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-red-500 rounded-full" 
                      style={{ width: `${(stats.priorityStats.critical / stats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-300">🟠 High Priority</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.high}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-orange-500 rounded-full" 
                      style={{ width: `${(stats.priorityStats.high / stats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-300">🟡 Moderate Priority</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.moderate}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-yellow-500 rounded-full" 
                      style={{ width: `${(stats.priorityStats.moderate / stats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-300">🔵 Low Priority</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.low}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-blue-500 rounded-full" 
                      style={{ width: `${(stats.priorityStats.low / stats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-300">🟢 Minimal Priority</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.minimal}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-green-500 rounded-full" 
                      style={{ width: `${(stats.priorityStats.minimal / stats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}