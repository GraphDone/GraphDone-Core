import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle, Filter, Eye, Plus, MoreHorizontal, User, Flag, Target, CalendarDays, ChevronDown, Search } from 'lucide-react';
import { getStatusConfig, WorkItemStatus, getTypeConfig, WorkItemType, getPriorityConfig, STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS } from '../constants/workItemConstants';

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

interface CalendarViewProps {
  filteredNodes: WorkItem[];
}

const formatLabel = (label: string) => {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getStatusColor = (status: string) => {
  const config = getStatusConfig(status as WorkItemStatus);
  return `${config.bgColor} ${config.color}`;
};

const CalendarViewComponent: React.FC<CalendarViewProps> = ({ filteredNodes }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter and group nodes by date
  const nodesByDate = useMemo(() => {
    const filtered = filteredNodes.filter(node => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!node.title.toLowerCase().includes(query) &&
            !node.description?.toLowerCase().includes(query) &&
            !node.owner?.name.toLowerCase().includes(query) &&
            !node.assignedTo?.name.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      if (!showCompleted && node.status === 'COMPLETED') return false;
      if (filterPriority !== 'all') {
        const priority = node.priorityExec || node.priorityComp || 0;
        const priorityLevel = getPriorityConfig(priority).value;
        if (priorityLevel !== filterPriority) return false;
      }
      if (filterType !== 'all' && node.type !== filterType) return false;
      if (filterStatus !== 'all' && node.status !== filterStatus) return false;
      return true;
    });

    const grouped: Record<string, WorkItem[]> = {};
    
    filtered.forEach(node => {
      if (node.dueDate) {
        const dateKey = new Date(node.dueDate).toDateString();
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(node);
      }
      
      // Also add created date for context (only if it has a due date)
      if (node.dueDate) {
        const createdKey = new Date(node.createdAt).toDateString();
        const dueDateKey = new Date(node.dueDate).toDateString();
        if (createdKey !== dueDateKey && !grouped[createdKey]) {
          grouped[createdKey] = [];
        }
      }
    });
    
    // Sort tasks within each day by priority
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => {
        const aPriority = a.priorityExec || a.priorityComp || 0;
        const bPriority = b.priorityExec || b.priorityComp || 0;
        return bPriority - aPriority;
      });
    });
    
    return grouped;
  }, [filteredNodes, showCompleted, filterPriority, filterType, filterStatus, searchQuery]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstCalendarDay = new Date(firstDayOfMonth);
    firstCalendarDay.setDate(firstCalendarDay.getDate() - firstDayOfMonth.getDay());
    
    const days = [];
    const currentDay = new Date(firstCalendarDay);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-dropdown="priority"]')) {
        setPriorityDropdownOpen(false);
      }
      if (!target.closest('[data-dropdown="type"]')) {
        setTypeDropdownOpen(false);
      }
      if (!target.closest('[data-dropdown="status"]')) {
        setStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(selectedDate?.toDateString() === date.toDateString() ? null : date);
  }, [selectedDate]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const uniqueTypes = [...new Set(filteredNodes.map(node => node.type))];
  const getTaskCountForDate = (date: Date) => {
    const dateKey = date.toDateString();
    return nodesByDate[dateKey]?.length || 0;
  };

  const getHighestPriorityForDate = (date: Date) => {
    const dateKey = date.toDateString();
    const tasks = nodesByDate[dateKey] || [];
    if (tasks.length === 0) return 0;
    return Math.max(...tasks.map(t => t.priorityExec || t.priorityComp || 0));
  };

  const formatDateRange = () => {
    if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CalendarDays className="h-6 w-6 text-green-400" />
            <h2 className="text-2xl font-bold text-white">Calendar View</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Today
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
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* View Mode */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-300">View:</label>
            <div className="flex bg-gray-700 rounded-lg p-1">
              {(['month', 'week', 'agenda'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    viewMode === mode 
                      ? 'bg-green-600 text-white' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-2 relative" data-dropdown="type">
            <Target className="h-4 w-4 text-gray-400" />
            <div className="relative">
              <button
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2 min-w-28"
              >
                {(() => {
                  const selectedOption = TYPE_OPTIONS.find(opt => opt.value === filterType);
                  return (
                    <>
                      {selectedOption?.icon && React.createElement(selectedOption.icon as any, { 
                        className: `h-3 w-3 ${selectedOption.color || 'text-gray-400'}` 
                      })}
                      <span className="truncate">{selectedOption?.label || 'All Types'}</span>
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
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2 min-w-28"
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
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2 min-w-32"
              >
                {(() => {
                  const selectedOption = PRIORITY_OPTIONS.find(opt => opt.value === filterPriority);
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
                        setFilterPriority(option.value);
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

        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 h-full flex flex-col">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <h3 className="text-xl font-semibold text-white">
              {formatDateRange()}
            </h3>
            
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 p-2 border-b border-gray-700">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
              <div key={day} className={`text-center py-3 text-sm font-medium ${
                index === 0 || index === 6 ? 'text-gray-500' : 'text-gray-400'
              }`}>
                <div className="hidden md:block">{day}</div>
                <div className="md:hidden">{day.substring(0, 3)}</div>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 p-2 overflow-auto">
            <div className="grid grid-cols-7 gap-1 h-full">
              {calendarDays.map((day, index) => {
                const dateKey = day.toDateString();
                const dayNodes = nodesByDate[dateKey] || [];
                const isCurrentMonthDay = isCurrentMonth(day);
                const isTodayDay = isToday(day);
                const isSelected = selectedDate?.toDateString() === dateKey;
                const taskCount = getTaskCountForDate(day);
                const highestPriority = getHighestPriorityForDate(day);
                const priorityColor = highestPriority >= 0.8 ? 'border-red-500' :
                                     highestPriority >= 0.6 ? 'border-orange-500' :
                                     highestPriority >= 0.4 ? 'border-yellow-500' :
                                     highestPriority >= 0.2 ? 'border-blue-500' : 'border-gray-600';

                return (
                  <div
                    key={index}
                    onClick={() => handleDateClick(day)}
                    className={`
                      min-h-[120px] p-3 border-2 rounded-lg transition-all duration-200 cursor-pointer
                      ${isCurrentMonthDay ? 'bg-gray-700' : 'bg-gray-800/50'}
                      ${isTodayDay ? 'ring-2 ring-green-500' : ''}
                      ${isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}
                      ${taskCount > 0 ? priorityColor : 'border-gray-600'}
                      hover:bg-gray-600 hover:border-gray-500
                    `}
                  >
                    {/* Date Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-sm font-medium ${
                        isCurrentMonthDay ? 'text-white' : 'text-gray-500'
                      } ${isTodayDay ? 'text-green-400' : ''}`}>
                        {day.getDate()}
                      </div>
                      {taskCount > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${
                            highestPriority >= 0.8 ? 'bg-red-500' :
                            highestPriority >= 0.6 ? 'bg-orange-500' :
                            highestPriority >= 0.4 ? 'bg-yellow-500' :
                            highestPriority >= 0.2 ? 'bg-blue-500' : 'bg-gray-500'
                          }`} title={`Highest priority: ${Math.round(highestPriority * 100)}%`} />
                          <span className="text-xs text-gray-400">{taskCount}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Tasks */}
                    <div className="space-y-1">
                      {dayNodes.slice(0, 4).map((node, nodeIndex) => {
                        const statusConfig = getStatusConfig(node.status as WorkItemStatus);
                        const typeConfig = getTypeConfig(node.type as WorkItemType);
                        const priority = node.priorityExec || node.priorityComp || 0;
                        
                        return (
                          <div
                            key={nodeIndex}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(selectedTask === node.id ? null : node.id);
                            }}
                            className={`text-xs px-2 py-1 rounded-md truncate transition-all cursor-pointer border ${
                              selectedTask === node.id 
                                ? 'border-green-500 bg-green-500/20' 
                                : `${statusConfig.bgColor} ${statusConfig.color} border-transparent hover:border-gray-400`
                            }`}
                            title={`${node.title}\nType: ${node.type}\nStatus: ${node.status.replace('_', ' ')}\nPriority: ${Math.round(priority * 100)}%\nDue: ${node.dueDate ? new Date(node.dueDate).toLocaleDateString() : 'No due date'}`}
                          >
                            <div className="flex items-center space-x-1">
                              <span className="text-xs opacity-70">{React.createElement(typeConfig.icon as any, { className: 'h-3 w-3' })}</span>
                              <span className="truncate">
                                {node.title.length > 15 ? node.title.substring(0, 15) + '...' : node.title}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {dayNodes.length > 4 && (
                        <div 
                          className="text-xs text-gray-400 px-2 py-1 hover:text-gray-300 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDateClick(day);
                          }}
                        >
                          +{dayNodes.length - 4} more tasks
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Selected Date Details Panel */}
        {selectedDate && (
          <div className="mt-4 bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-white">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h4>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            
            {nodesByDate[selectedDate.toDateString()]?.length ? (
              <div className="space-y-2">
                {nodesByDate[selectedDate.toDateString()].map((node, index) => {
                  const statusConfig = getStatusConfig(node.status as WorkItemStatus);
                  const typeConfig = getTypeConfig(node.type as WorkItemType);
                  const priority = node.priorityExec || node.priorityComp || 0;
                  const priorityConfig = getPriorityConfig(priority);
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${statusConfig.bgColor}`} />
                        <div>
                          <div className="text-sm font-medium text-white">{node.title}</div>
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <span>{React.createElement(typeConfig.icon as any, { className: 'h-3 w-3 inline mr-1' })} {node.type}</span>
                            <span>•</span>
                            <span className={priorityConfig.color}>{priorityConfig.label} Priority</span>
                            {node.assignedTo && (
                              <>
                                <span>•</span>
                                <span>{node.assignedTo.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {node.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tasks scheduled for this date</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Statistics */}
      <div className="border-t border-gray-700 p-4 bg-gray-800">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-white">
              {Object.values(nodesByDate).flat().filter(node => {
                if (!node.dueDate) return false;
                const dueDate = new Date(node.dueDate);
                return dueDate.getMonth() === currentDate.getMonth() && 
                       dueDate.getFullYear() === currentDate.getFullYear();
              }).length}
            </div>
            <div className="text-xs text-gray-400">This Month</div>
          </div>
          
          <div>
            <div className="text-xl font-bold text-yellow-400">
              {(nodesByDate[new Date().toDateString()] || []).length}
            </div>
            <div className="text-xs text-gray-400">Due Today</div>
          </div>
          
          <div>
            <div className="text-xl font-bold text-red-400">
              {filteredNodes.filter(node => {
                if (!node.dueDate) return false;
                return new Date(node.dueDate) < new Date() && node.status !== 'COMPLETED';
              }).length}
            </div>
            <div className="text-xs text-gray-400">Overdue</div>
          </div>
          
          <div>
            <div className="text-xl font-bold text-green-400">
              {filteredNodes.filter(node => node.status === 'COMPLETED').length}
            </div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
          
          <div>
            <div className="text-xl font-bold text-blue-400">
              {filteredNodes.filter(node => node.status === 'IN_PROGRESS').length}
            </div>
            <div className="text-xs text-gray-400">In Progress</div>
          </div>
          
          <div>
            <div className="text-xl font-bold text-purple-400">
              {filteredNodes.filter(node => !node.dueDate).length}
            </div>
            <div className="text-xs text-gray-400">No Due Date</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarViewComponent;