import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { GitBranch, ZoomIn, ZoomOut, Calendar, ChevronLeft, ChevronRight, Filter, Download, MoreVertical, Link2, BarChart3, GanttChartSquare, Flag, ChevronDown, Target, Search } from 'lucide-react';
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

interface GanttChartProps {
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
  return config.bgColor;
};

const GanttChart: React.FC<GanttChartProps> = ({ filteredNodes }) => {
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5x to 3x
  const [viewMode, setViewMode] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [showDependencies, setShowDependencies] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'startDate' | 'duration' | 'status'>('priority');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  // Generate and sort timeline data
  const timelineData = useMemo(() => {
    let data = filteredNodes
      .filter(node => {
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
        
        // Status filter
        if (filterStatus !== 'all' && node.status !== filterStatus) return false;
        
        // Priority filter
        if (filterPriority !== 'all') {
          const priority = node.priorityExec || node.priorityComp || 0;
          const priorityLevel = getPriorityConfig(priority).value;
          if (priorityLevel !== filterPriority) return false;
        }
        
        // Type filter
        if (filterType !== 'all' && node.type !== filterType) return false;
        
        return true;
      })
      .map((node, index) => {
        const startDate = new Date(node.createdAt);
        const endDate = node.dueDate ? new Date(node.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const progress = node.status === 'COMPLETED' ? 100 : 
                        node.status === 'IN_PROGRESS' ? 65 : 
                        node.status === 'PLANNED' ? 25 : 10;
        const priority = node.priorityExec || node.priorityComp || 0;
        
        return {
          ...node,
          startDate,
          endDate,
          duration,
          progress,
          priority,
          row: index,
          dependencies: node.dependencies || [],
          dependents: node.dependents || []
        };
      });

    // Sort data
    data.sort((a, b) => {
      switch (sortBy) {
        case 'priority': return b.priority - a.priority;
        case 'startDate': return a.startDate.getTime() - b.startDate.getTime();
        case 'duration': return b.duration - a.duration;
        case 'status': return a.status.localeCompare(b.status);
        default: return 0;
      }
    });

    return data.map((item, index) => ({ ...item, row: index }));
  }, [filteredNodes, filterStatus, filterPriority, filterType, sortBy, searchQuery]);

  // Calculate timeline bounds with padding
  const timelineBounds = useMemo(() => {
    if (timelineData.length === 0) {
      const today = new Date();
      return {
        minDate: new Date(today.getFullYear(), today.getMonth(), 1),
        maxDate: new Date(today.getFullYear(), today.getMonth() + 3, 0),
        totalDays: 90
      };
    }

    const allDates = timelineData.flatMap(item => [item.startDate, item.endDate]);
    const rawMinDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const rawMaxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Add padding
    const minDate = new Date(rawMinDate);
    minDate.setDate(minDate.getDate() - 7);
    const maxDate = new Date(rawMaxDate);
    maxDate.setDate(maxDate.getDate() + 14);
    
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return { minDate, maxDate, totalDays };
  }, [timelineData]);

  const { minDate, maxDate, totalDays } = timelineBounds;

  // Generate timeline headers based on view mode
  const timelineHeaders = useMemo(() => {
    const headers = [];
    const current = new Date(minDate);
    
    if (viewMode === 'days') {
      while (current <= maxDate) {
        headers.push({
          date: new Date(current),
          label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          isWeekend: current.getDay() === 0 || current.getDay() === 6
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (viewMode === 'weeks') {
      current.setDate(current.getDate() - current.getDay()); // Start of week
      while (current <= maxDate) {
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        headers.push({
          date: new Date(current),
          label: `${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { day: 'numeric' })}`,
          isWeekend: false
        });
        current.setDate(current.getDate() + 7);
      }
    } else {
      current.setDate(1); // Start of month
      while (current <= maxDate) {
        headers.push({
          date: new Date(current),
          label: current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          isWeekend: false
        });
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    return headers;
  }, [minDate, maxDate, viewMode]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-dropdown="status"]')) {
        setStatusDropdownOpen(false);
      }
      if (!target.closest('[data-dropdown="priority"]')) {
        setPriorityDropdownOpen(false);
      }
      if (!target.closest('[data-dropdown="type"]')) {
        setTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-green-400';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-gray-500';
  };

  const getDependencyPath = (fromTask: any, toTask: any) => {
    const fromY = fromTask.row * 60 + 30; // Task row center
    const toY = toTask.row * 60 + 30;
    const fromX = ((fromTask.endDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
    const toX = ((toTask.startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
    
    return `M ${fromX}% ${fromY}px L ${toX}% ${toY}px`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <GanttChartSquare className="h-6 w-6 text-green-400" />
            <h2 className="text-2xl font-bold text-white">Gantt Chart</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <Download className="h-4 w-4" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <MoreVertical className="h-4 w-4" />
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
        
        {/* Primary Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-3">
          {/* View Mode */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-300">View:</label>
            <div className="flex bg-gray-700 rounded-lg p-1">
              {(['days', 'weeks', 'months'] as const).map(mode => (
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

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              disabled={zoomLevel <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-300 px-2">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              disabled={zoomLevel >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-4">
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

          {/* Sort */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="priority">Priority</option>
              <option value="startDate">Start Date</option>
              <option value="duration">Duration</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto" ref={scrollRef}>
          <div className="bg-gray-800 border border-gray-700">
            <div className="overflow-x-auto">
              <div className="relative" style={{ minWidth: `${800 * zoomLevel}px`, transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
                {/* Timeline Header */}
                <div className="flex bg-gray-700 border-b border-gray-600 sticky top-0 z-10">
                  <div className="w-80 px-4 py-3 border-r border-gray-600 bg-gray-700">
                    <span className="text-sm font-medium text-gray-300">Tasks ({timelineData.length})</span>
                  </div>
                  <div className="flex-1 flex">
                    {timelineHeaders.map((header, index) => (
                      <div 
                        key={index} 
                        className={`flex-1 min-w-[120px] px-3 py-3 border-r border-gray-600 text-center ${
                          header.isWeekend ? 'bg-gray-600' : 'bg-gray-700'
                        }`}
                      >
                        <div className="text-xs font-medium text-gray-300">
                          {header.label}
                        </div>
                        {viewMode === 'days' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {header.date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline Rows */}
                <div className="relative">
                  {/* Dependency Lines (SVG Overlay) */}
                  {showDependencies && (
                    <svg className="absolute inset-0 pointer-events-none z-20" style={{ height: timelineData.length * 60 }}>
                      <defs>
                        <marker
                          id="arrowhead"
                          markerWidth="10"
                          markerHeight="7"
                          refX="9"
                          refY="3.5"
                          orient="auto"
                        >
                          <polygon
                            points="0 0, 10 3.5, 0 7"
                            fill="#6b7280"
                          />
                        </marker>
                      </defs>
                      {timelineData.map(task => 
                        task.dependencies?.map((dep: any) => {
                          const depTask = timelineData.find(t => t.id === dep.id);
                          if (!depTask) return null;
                          
                          const fromY = depTask.row * 60 + 30;
                          const toY = task.row * 60 + 30;
                          const fromX = ((depTask.endDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                          const toX = ((task.startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                          
                          return (
                            <g key={`${depTask.id}-${task.id}`}>
                              <line
                                x1={`${fromX}%`}
                                y1={fromY}
                                x2={`${toX}%`}
                                y2={toY}
                                stroke="#6b7280"
                                strokeWidth="2"
                                strokeDasharray="4,4"
                                markerEnd="url(#arrowhead)"
                              />
                            </g>
                          );
                        })
                      ).flat().filter(Boolean)}
                    </svg>
                  )}
                  
                  {timelineData.map((item, index) => {
                    const startOffset = Math.floor((item.startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
                    const barWidth = (item.duration / totalDays) * 100;
                    const barLeft = (startOffset / totalDays) * 100;
                    const isSelected = selectedTask === item.id;
                    const priorityConfig = getPriorityConfig(item.priority);
                    const statusConfig = getStatusConfig(item.status as WorkItemStatus);
                    const typeConfig = getTypeConfig(item.type as WorkItemType);

                    return (
                      <div 
                        key={item.id} 
                        className={`flex border-b border-gray-700 transition-all duration-200 h-15 ${
                          isSelected ? 'bg-green-500/10 border-green-500/50' : 'hover:bg-gray-700/30'
                        }`}
                        onClick={() => setSelectedTask(isSelected ? null : item.id)}
                        style={{ height: '60px' }}
                      >
                        {/* Task Info Panel */}
                        <div className="w-80 px-4 py-3 border-r border-gray-600 flex items-center">
                          <div className="flex items-center space-x-3 flex-1">
                            {/* Priority Indicator */}
                            <div 
                              className="w-1 h-8 rounded-full"
                              style={{ backgroundColor: priorityConfig.color.replace('text-', '') }}
                              title={`Priority: ${priorityConfig.label}`}
                            />
                            
                            {/* Status & Type */}
                            <div className="flex flex-col space-y-1">
                              <div className={`w-3 h-3 rounded-full ${statusConfig.bgColor}`} title={item.status.replace('_', ' ')}></div>
                              <div className="text-xs text-gray-500">{React.createElement(typeConfig.icon as any, { className: 'h-3 w-3' })}</div>
                            </div>
                            
                            {/* Task Details */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate mb-1">{item.title}</div>
                              <div className="flex items-center space-x-2 text-xs text-gray-400">
                                <span>{item.status.replace('_', ' ')}</span>
                                <span>•</span>
                                <span>{item.duration}d</span>
                                {item.assignedTo && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-20">{item.assignedTo.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Timeline Bar */}
                        <div className="flex-1 relative py-3 px-2">
                          <div className="relative h-9">
                            {/* Main Task Bar */}
                            <div 
                              className={`absolute h-6 bg-gray-600 rounded-lg shadow-sm border transition-all duration-200 cursor-pointer ${
                                isSelected ? 'border-green-500 shadow-lg shadow-green-500/25' : 'border-gray-500'
                              }`}
                              style={{
                                left: `${Math.max(barLeft, 0)}%`,
                                width: `${Math.max(barWidth, 2)}%`,
                                top: '6px'
                              }}
                              title={`${item.title}\nStart: ${item.startDate.toLocaleDateString()}\nEnd: ${item.endDate.toLocaleDateString()}\nDuration: ${item.duration} days\nProgress: ${item.progress}%`}
                            >
                              {/* Progress Fill */}
                              <div 
                                className={`h-full rounded-lg transition-all duration-300 ${getProgressColor(item.progress)}`}
                                style={{ width: `${item.progress}%` }}
                              />
                              
                              {/* Task Label */}
                              <div className="absolute inset-0 flex items-center px-2">
                                <span className="text-xs font-medium text-white truncate drop-shadow-sm">
                                  {item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title}
                                </span>
                              </div>
                              
                              {/* Progress Percentage */}
                              <div className="absolute -top-5 right-0 text-xs text-gray-400">
                                {item.progress}%
                              </div>
                            </div>
                            
                            {/* Milestone Indicator */}
                            {item.type === 'MILESTONE' && (
                              <div 
                                className="absolute w-3 h-3 bg-orange-500 rotate-45 border border-orange-400"
                                style={{
                                  left: `${barLeft + barWidth}%`,
                                  top: '9px',
                                  transform: 'translateX(-50%) rotate(45deg)'
                                }}
                                title="Milestone"
                              />
                            )}
                            
                            {/* Overdue Indicator */}
                            {new Date() > item.endDate && item.status !== 'COMPLETED' && (
                              <div className="absolute -top-1 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Overdue" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Statistics and Legend */}
      <div className="border-t border-gray-700 p-4 bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Statistics */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-gray-300">
              <span className="font-medium">{timelineData.length}</span> tasks
            </div>
            <div className="text-gray-300">
              <span className="font-medium">
                {timelineData.filter(t => t.status === 'COMPLETED').length}
              </span> completed
            </div>
            <div className="text-gray-300">
              <span className="font-medium">
                {timelineData.filter(t => new Date() > t.endDate && t.status !== 'COMPLETED').length}
              </span> overdue
            </div>
            <div className="text-gray-300">
              <span className="font-medium">
                {Math.round(timelineData.reduce((sum, t) => sum + t.progress, 0) / Math.max(timelineData.length, 1))}%
              </span> avg progress
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-2 bg-gray-500 rounded"></div>
              <span className="text-gray-400">Not Started</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-2 bg-yellow-500 rounded"></div>
              <span className="text-gray-400">In Progress</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-2 bg-green-500 rounded"></div>
              <span className="text-gray-400">Completed</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-gray-400">Overdue</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-orange-500 rotate-45"></div>
              <span className="text-gray-400">Milestone</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;