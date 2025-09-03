import React, { useState, useMemo, useEffect } from 'react';
import { Clock, User, MessageSquare, AlertCircle, Filter, Search, Trash2, Eye, TrendingUp, UserPlus, Target, Flag, Bell, BellOff, ChevronDown, Calendar } from 'lucide-react';
import { getStatusConfig, WorkItemStatus, getTypeConfig, WorkItemType, getPriorityConfig, STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS, WORK_ITEM_PRIORITIES, WORK_ITEM_STATUSES, WORK_ITEM_TYPES } from '../constants/workItemConstants';

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

interface ActivityFeedProps {
  filteredNodes: WorkItem[];
}

interface ActivityItem {
  id: string;
  type: 'created' | 'updated' | 'completed' | 'commented' | 'assigned' | 'priority_changed' | 'status_changed' | 'due_date_changed';
  title: string;
  description: string;
  timestamp: Date;
  user: string;
  nodeId: string;
  nodeTitle: string;
  icon: React.ReactNode;
  color: string;
  priority: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  category: 'task' | 'user' | 'system';
  metadata?: {
    oldValue?: string;
    newValue?: string;
    changes?: string[];
  };
}

const formatLabel = (label: string) => {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ filteredNodes }) => {
  const [filter, setFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'hour' | 'today' | 'week' | 'month' | 'all'>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'task' | 'user' | 'system'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'minimal' | 'low' | 'moderate' | 'high' | 'critical'>('all');
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Enhanced activity generation with more realistic data
  const activities = useMemo(() => {
    const activityList: ActivityItem[] = [];
    
    filteredNodes.forEach(node => {
      const priority = node.priorityExec || node.priorityComp || 0;
      const activityPriority = priority >= 0.8 ? 'critical' : 
                              priority >= 0.6 ? 'high' : 
                              priority >= 0.4 ? 'moderate' : 
                              priority >= 0.2 ? 'low' : 'minimal';
      
      // Creation activity
      const typeConfig = getTypeConfig(node.type as WorkItemType);
      activityList.push({
        id: `${node.id}-created`,
        type: 'created',
        title: 'Task Created',
        description: `Created new ${typeConfig.label.toLowerCase()} "${node.title}"`,
        timestamp: new Date(node.createdAt),
        user: node.owner?.name || 'System User',
        nodeId: node.id,
        nodeTitle: node.title,
        icon: React.createElement(typeConfig.icon as any, { className: 'h-4 w-4' }),
        color: typeConfig.color,
        priority: activityPriority,
        category: 'task',
        metadata: {
          changes: [`Type: ${typeConfig.label}`, `Priority: ${Math.round(priority * 100)}%`]
        }
      });

      // Status change activity
      if (node.updatedAt && new Date(node.updatedAt).getTime() !== new Date(node.createdAt).getTime()) {
        const statusConfig = getStatusConfig(node.status as WorkItemStatus);
        activityList.push({
          id: `${node.id}-status-changed`,
          type: 'status_changed',
          title: 'Status Changed',
          description: `Changed "${node.title}" status to ${statusConfig.label}`,
          timestamp: new Date(node.updatedAt),
          user: node.assignedTo?.name || node.owner?.name || 'System User',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: React.createElement(statusConfig.icon as any, { className: 'h-4 w-4' }),
          color: statusConfig.color,
          priority: activityPriority,
          category: 'task',
          metadata: {
            oldValue: 'PENDING',
            newValue: node.status,
            changes: [`Status updated to ${statusConfig.label}`]
          }
        });
      }

      // Assignment activity
      if (node.assignedTo) {
        activityList.push({
          id: `${node.id}-assigned`,
          type: 'assigned',
          title: 'Task Assigned',
          description: `Assigned "${node.title}" to ${node.assignedTo.name}`,
          timestamp: new Date(new Date(node.createdAt).getTime() + Math.random() * 3600000), // Within an hour of creation
          user: node.owner?.name || 'Project Manager',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: <UserPlus className="h-4 w-4" />,
          color: 'text-purple-400',
          priority: activityPriority,
          category: 'user',
          metadata: {
            newValue: node.assignedTo.name,
            changes: [`Assigned to ${node.assignedTo.name}`]
          }
        });
      }

      // Priority change activity
      if (priority > 0.5) {
        const priorityConfig = getPriorityConfig(priority);
        activityList.push({
          id: `${node.id}-priority-changed`,
          type: 'priority_changed',
          title: 'Priority Updated',
          description: `Updated priority for "${node.title}" to ${priorityConfig.label}`,
          timestamp: new Date(node.updatedAt || node.createdAt),
          user: node.owner?.name || 'Project Manager',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: React.createElement(priorityConfig.icon as any, { className: 'h-4 w-4' }),
          color: priorityConfig.color,
          priority: activityPriority,
          category: 'task',
          metadata: {
            oldValue: '30%',
            newValue: `${priorityConfig.label} (${Math.round(priority * 100)}%)`,
            changes: [`Priority set to ${priorityConfig.label}`]
          }
        });
      }

      // Due date activity
      if (node.dueDate) {
        activityList.push({
          id: `${node.id}-due-date-set`,
          type: 'due_date_changed',
          title: 'Due Date Set',
          description: `Set due date for "${node.title}" to ${new Date(node.dueDate).toLocaleDateString()}`,
          timestamp: new Date(new Date(node.createdAt).getTime() + Math.random() * 7200000), // Within 2 hours
          user: node.assignedTo?.name || node.owner?.name || 'Project Manager',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: <Calendar className="h-4 w-4" />,
          color: 'text-blue-400',
          priority: activityPriority,
          category: 'task',
          metadata: {
            newValue: new Date(node.dueDate).toLocaleDateString(),
            changes: [`Due date set to ${new Date(node.dueDate).toLocaleDateString()}`]
          }
        });
      }

      // Completion activity
      if (node.status === 'COMPLETED') {
        const completedConfig = getStatusConfig('COMPLETED');
        activityList.push({
          id: `${node.id}-completed`,
          type: 'completed',
          title: 'Task Completed',
          description: `Completed "${node.title}" successfully`,
          timestamp: new Date(node.updatedAt || node.createdAt),
          user: node.assignedTo?.name || 'Team Member',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: React.createElement(completedConfig.icon as any, { className: 'h-4 w-4' }),
          color: completedConfig.color,
          priority: activityPriority,
          category: 'task',
          metadata: {
            changes: [`Task marked as completed`]
          }
        });
      }

      // Mock comment activity (more realistic)
      if (Math.random() > 0.6) {
        const commentTypes = ['progress update', 'question', 'blocker', 'suggestion'];
        const commentType = commentTypes[Math.floor(Math.random() * commentTypes.length)];
        
        activityList.push({
          id: `${node.id}-commented-${Date.now()}`,
          type: 'commented',
          title: 'Comment Added',
          description: `Added a ${commentType} comment on "${node.title}"`,
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          user: node.assignedTo?.name || node.owner?.name || 'Team Member',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: <MessageSquare className="h-4 w-4" />,
          color: 'text-purple-400',
          priority: commentType === 'blocker' ? 'high' : 'moderate',
          category: 'user',
          metadata: {
            changes: [`Added ${commentType} comment`]
          }
        });
      }
    });

    return activityList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [filteredNodes]);

  // Real-time activity updates simulation
  useEffect(() => {
    if (!isRealTimeEnabled) return;
    
    const interval = setInterval(() => {
      // Simulate new activities occasionally
      if (Math.random() > 0.95 && activities.length > 0) {
        // This would normally trigger a re-fetch of activities
        console.log('New activity detected (simulation)');
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isRealTimeEnabled, activities.length]);

  // Advanced filtering with search and multiple filters
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(activity => 
        activity.title.toLowerCase().includes(query) ||
        activity.description.toLowerCase().includes(query) ||
        activity.user.toLowerCase().includes(query) ||
        activity.nodeTitle.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filter !== 'all') {
      filtered = filtered.filter(activity => activity.type === filter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(activity => activity.category === categoryFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(activity => activity.priority === priorityFilter);
    }

    // Time range filter
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timeRange) {
      case 'hour':
        cutoffDate.setHours(now.getHours() - 1);
        break;
      case 'today':
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        cutoffDate.setFullYear(2000);
        break;
    }

    if (timeRange !== 'all') {
      filtered = filtered.filter(activity => activity.timestamp >= cutoffDate);
    }

    return filtered;
  }, [activities, filter, timeRange, searchQuery, categoryFilter, priorityFilter]);

  // Pagination
  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredActivities.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredActivities, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'moderate': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const handleClearFilters = () => {
    setFilter('all');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setSearchQuery('');
    setTimeRange('week');
    setCurrentPage(1);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-dropdown="priority"]')) {
        setPriorityDropdownOpen(false);
      }
      if (!target.closest('[data-dropdown="status"]')) {
        setStatusDropdownOpen(false);
      }
      if (!target.closest('[data-dropdown="type"]')) {
        setTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-green-400/10 border border-green-400/20">
              <TrendingUp className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Activity Feed</h2>
              <div className="flex items-center space-x-3 text-sm">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 ${WORK_ITEM_STATUSES.COMPLETED.color.replace('text-', 'bg-')} rounded-full animate-pulse`} />
                  <span className="text-gray-400">{filteredActivities.length} activities</span>
                </div>
                <div className="text-gray-500">•</div>
                <div className="text-gray-400">
                  {isRealTimeEnabled ? 'Live updates enabled' : 'Live updates paused'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
              className={`p-3 rounded-xl transition-all duration-200 border ${
                isRealTimeEnabled 
                  ? 'text-green-400 bg-green-400/10 border-green-400/20 hover:bg-green-400/20' 
                  : 'text-gray-400 bg-gray-700/50 border-gray-600 hover:bg-gray-600 hover:text-white'
              }`}
              title={`Real-time updates ${isRealTimeEnabled ? 'enabled' : 'disabled'}`}
            >
              {isRealTimeEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks by type, status, priority"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="px-6 pb-4 border-b border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Type Filter */}
          <div className="flex items-center space-x-2 relative" data-dropdown="type">
            <Target className="h-4 w-4 text-gray-400" />
            <div className="relative">
              <button
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2 min-w-28"
              >
                {(() => {
                  const selectedOption = TYPE_OPTIONS.find(opt => opt.value === filterType);
                  return (
                    <>
                      {selectedOption?.icon && React.createElement(selectedOption.icon as any, { 
                        className: `h-3 w-3 ${selectedOption.color || 'text-gray-400'}` 
                      })}
                      <span className="truncate">{selectedOption?.label || 'All Type'}</span>
                      <ChevronDown className="h-3 w-3 ml-auto" />
                    </>
                  );
                })()}
              </button>
              {typeDropdownOpen && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg min-w-full max-h-48 overflow-y-auto">
                  {TYPE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilterType(option.value);
                        setTypeDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-600 flex items-center space-x-2 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {option.icon && React.createElement(option.icon as any, { 
                        className: `h-3 w-3 ${option.color || 'text-gray-400'}` 
                      })}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2 relative" data-dropdown="status">
            <Filter className="h-4 w-4 text-gray-400" />
            <div className="relative">
              <button
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2 min-w-28"
              >
                {(() => {
                  const selectedOption = STATUS_OPTIONS.find(opt => opt.value === filterStatus);
                  return (
                    <>
                      {selectedOption?.icon && React.createElement(selectedOption.icon as any, { 
                        className: `h-3 w-3 ${selectedOption.color || 'text-gray-400'}` 
                      })}
                      <span className="truncate">{selectedOption?.label || 'All Status'}</span>
                      <ChevronDown className="h-3 w-3 ml-auto" />
                    </>
                  );
                })()}
              </button>
              {statusDropdownOpen && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg min-w-full max-h-48 overflow-y-auto">
                  {STATUS_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilterStatus(option.value);
                        setStatusDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-600 flex items-center space-x-2 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {option.icon && React.createElement(option.icon as any, { 
                        className: `h-3 w-3 ${option.color || 'text-gray-400'}` 
                      })}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center space-x-2 relative" data-dropdown="priority">
            <Flag className="h-4 w-4 text-gray-400" />
            <div className="relative">
              <button
                onClick={() => setPriorityDropdownOpen(!priorityDropdownOpen)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2 min-w-32"
              >
                {(() => {
                  const selectedOption = PRIORITY_OPTIONS.find(opt => opt.value === priorityFilter);
                  return (
                    <>
                      {selectedOption?.icon && React.createElement(selectedOption.icon as any, { 
                        className: `h-3 w-3 ${selectedOption.color || 'text-gray-400'}` 
                      })}
                      <span className="truncate">{selectedOption?.label || 'All Priority'}</span>
                      <ChevronDown className="h-3 w-3 ml-auto" />
                    </>
                  );
                })()}
              </button>
              {priorityDropdownOpen && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg min-w-full max-h-48 overflow-y-auto">
                  {PRIORITY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setPriorityFilter(option.value as any);
                        setPriorityDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-600 flex items-center space-x-2 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {option.icon && React.createElement(option.icon as any, { 
                        className: `h-3 w-3 ${option.color || 'text-gray-400'}` 
                      })}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="hour">Last Hour</option>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="all">All Time</option>
            </select>
          </div>


          {(filter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || searchQuery) && (
            <button
              onClick={handleClearFilters}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-auto p-6">
        {paginatedActivities.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No activities found for the selected filters.</p>
            <button
              onClick={handleClearFilters}
              className="text-green-400 hover:text-green-300 text-sm underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedActivities.map((activity) => {
              const isSelected = selectedActivity === activity.id;
              
              return (
                <div 
                  key={activity.id} 
                  className={`bg-gray-800 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isSelected 
                      ? `${WORK_ITEM_STATUSES.COMPLETED.borderColor} ${WORK_ITEM_STATUSES.COMPLETED.bgColor} shadow-lg shadow-green-500/10` 
                      : 'border-gray-700 hover:border-gray-600 hover:bg-gray-750'
                  }`}
                  onClick={() => setSelectedActivity(isSelected ? null : activity.id)}
                >
                  <div className="p-4">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-xl ${activity.color.replace('text-', 'bg-')}/10 border ${activity.color.replace('text-', 'border-')}/20`}>
                        <div className={activity.color}>
                          {activity.icon}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-base font-semibold text-white">{activity.title}</h3>
                            {(() => {
                              const priorityConfig = PRIORITY_OPTIONS.find(opt => opt.value === activity.priority);
                              return priorityConfig && priorityConfig.value !== 'all' ? (
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${priorityConfig.color} ${priorityConfig.color.replace('text-', 'bg-')}/10 ${priorityConfig.color.replace('text-', 'border-')}/20`}>
                                  {priorityConfig.icon && React.createElement(priorityConfig.icon as any, { className: 'h-3 w-3 mr-1' })}
                                  {priorityConfig.label}
                                </span>
                              ) : null;
                            })()} 
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              activity.category === 'task' ? `${WORK_ITEM_TYPES.TASK.bgColor} ${WORK_ITEM_TYPES.TASK.color} ${WORK_ITEM_TYPES.TASK.borderColor}` :
                              activity.category === 'user' ? `${WORK_ITEM_TYPES.EPIC.bgColor} ${WORK_ITEM_TYPES.EPIC.color} ${WORK_ITEM_TYPES.EPIC.borderColor}` :
                              'bg-gray-500/10 text-gray-400 border border-gray-400/20'
                            }`}>
                              {activity.category}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-xs text-gray-400 font-medium">{getTimeAgo(activity.timestamp)}</span>
                            {isSelected && (
                              <div className={`p-1 rounded-full ${WORK_ITEM_STATUSES.COMPLETED.bgColor}`}>
                                <Eye className="h-3 w-3 text-green-400" />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-300 mb-4 leading-relaxed">{activity.description}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-xs">
                            <div className="flex items-center space-x-2 px-2 py-1 bg-gray-700/50 rounded-lg">
                              <User className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-300 font-medium">{activity.user}</span>
                            </div>
                            <div className="flex items-center space-x-2 px-2 py-1 bg-gray-700/50 rounded-lg">
                              <Target className="h-3 w-3 text-gray-400" />
                              <span className="truncate max-w-32 text-gray-300 font-medium">{activity.nodeTitle}</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-700/30 px-2 py-1 rounded">
                            {activity.timestamp.toLocaleString()}
                          </div>
                        </div>
                        
                        {/* Expanded Details */}
                        {isSelected && activity.metadata && (
                          <div className="mt-4 pt-3 border-t border-gray-600">
                            <div className="space-y-2">
                              {activity.metadata.oldValue && activity.metadata.newValue && (
                                <div className="flex items-center space-x-2 text-xs">
                                  <span className="text-gray-400">Changed from:</span>
                                  <span className={`px-2 py-1 ${WORK_ITEM_STATUSES.BLOCKED.bgColor} ${WORK_ITEM_STATUSES.BLOCKED.color} rounded`}>
                                    {activity.metadata.oldValue}
                                  </span>
                                  <span className="text-gray-400">to:</span>
                                  <span className={`px-2 py-1 ${WORK_ITEM_STATUSES.COMPLETED.bgColor} ${WORK_ITEM_STATUSES.COMPLETED.color} rounded`}>
                                    {activity.metadata.newValue}
                                  </span>
                                </div>
                              )}
                              {activity.metadata.changes && (
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-400">Changes:</div>
                                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-300 ml-2">
                                    {activity.metadata.changes.map((change, index) => (
                                      <li key={index}>{change}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-gray-700 p-4 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredActivities.length)} of {filteredActivities.length} activities
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i));
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded transition-colors ${
                        currentPage === pageNum 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;