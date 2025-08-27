import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  ChevronDown, 
  Calendar as CalendarIcon, 
  Activity,
  Clock,
  User,
  CheckCircle,
  Circle,
  AlertCircle,
  MessageSquare,
  Plus,
  GitBranch,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lightbulb
} from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { mockProjectNodes, MockNode, mockProjectEdges } from '../types/projectData';

type TimelineViewType = 'gantt' | 'calendar' | 'activity';

interface TimelineViewOption {
  id: TimelineViewType;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const timelineViewOptions: TimelineViewOption[] = [
  {
    id: 'gantt',
    name: 'Gantt Chart',
    description: 'Interactive timeline with dependencies and milestones',
    icon: <GitBranch className="h-4 w-4" />
  },
  {
    id: 'calendar',
    name: 'Calendar View',
    description: 'Monthly calendar with due dates and milestones',
    icon: <CalendarIcon className="h-4 w-4" />
  },
  {
    id: 'activity',
    name: 'Activity Feed',
    description: 'Recent updates, changes, and collaboration',
    icon: <Activity className="h-4 w-4" />
  }
];

export function TimelineView() {
  const { currentGraph } = useGraph();
  const [currentView, setCurrentView] = useState<TimelineViewType>('gantt');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [activityTimeRange, setActivityTimeRange] = useState<string>('week');
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Activity pagination state
  const [activitiesPerPage] = useState(10);
  const [loadedActivitiesCount, setLoadedActivitiesCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Reset pagination when filters change
  useEffect(() => {
    setLoadedActivitiesCount(activitiesPerPage);
  }, [activityFilter, activityTimeRange, searchTerm, activitiesPerPage]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
        setIsTimeDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!searchTerm) return mockProjectNodes;
    return mockProjectNodes.filter(node =>
      node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm]);

  // Helper functions
  const getNodeTypeColor = (type: string) => {
    switch (type) {
      // Strategic Planning
      case 'EPIC': return 'bg-purple-500 text-white';
      case 'PROJECT': return 'bg-purple-600 text-white';
      case 'MILESTONE': return 'bg-yellow-500 text-black';
      case 'GOAL': return 'bg-purple-400 text-white';
      
      // Development Work  
      case 'STORY': return 'bg-blue-500 text-white';
      case 'FEATURE': return 'bg-blue-600 text-white';
      case 'TASK': return 'bg-green-500 text-white';
      case 'RESEARCH': return 'bg-blue-400 text-white';
      
      // Quality & Issues
      case 'BUG': return 'bg-red-500 text-white';
      case 'ISSUE': return 'bg-red-400 text-white';
      case 'HOTFIX': return 'bg-red-600 text-white';
      
      // Operations & Maintenance
      case 'MAINTENANCE': return 'bg-orange-500 text-white';
      case 'DEPLOYMENT': return 'bg-orange-600 text-white';
      case 'MONITORING': return 'bg-orange-400 text-white';
      
      // Documentation
      case 'DOCUMENTATION': return 'bg-indigo-500 text-white';
      case 'SPECIFICATION': return 'bg-indigo-600 text-white';
      case 'GUIDE': return 'bg-indigo-400 text-white';
      
      // Testing & Validation
      case 'TEST': return 'bg-emerald-500 text-white';
      case 'REVIEW': return 'bg-emerald-600 text-white';
      case 'QA': return 'bg-emerald-400 text-white';
      
      // Business & Sales
      case 'LEAD': return 'bg-teal-500 text-white';
      case 'OPPORTUNITY': return 'bg-teal-600 text-white';
      case 'CONTRACT': return 'bg-teal-400 text-white';
      
      // Creative & Design
      case 'MOCKUP': return 'bg-pink-500 text-white';
      case 'PROTOTYPE': return 'bg-pink-600 text-white';
      case 'UI_DESIGN': return 'bg-pink-400 text-white';
      
      // Support & Training
      case 'SUPPORT': return 'bg-cyan-500 text-white';
      case 'TRAINING': return 'bg-cyan-600 text-white';
      
      // Other
      case 'NOTE': return 'bg-slate-500 text-white';
      case 'ACTION_ITEM': return 'bg-slate-600 text-white';
      case 'DECISION': return 'bg-slate-400 text-white';
      
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROPOSED': return 'text-blue-400';
      case 'PLANNED': return 'text-purple-400';
      case 'IN_PROGRESS': return 'text-yellow-400';
      case 'COMPLETED': return 'text-green-400';
      case 'BLOCKED': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PROPOSED': return <Lightbulb className="h-4 w-4" />;
      case 'PLANNED': return <CalendarIcon className="h-4 w-4" />;
      case 'IN_PROGRESS': return <Clock className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      case 'BLOCKED': return <AlertCircle className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'In Progress';
      case 'COMPLETED': return 'Completed';
      case 'PLANNED': return 'Planned';
      case 'PROPOSED': return 'Proposed';
      case 'BLOCKED': return 'Blocked';
      default: return status.replace('_', ' ');
    }
  };

  const getContributorColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500'
    ];
    
    // Generate consistent color based on name
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getPriorityIndicator = (priority: number) => {
    if (priority >= 0.8) return 'bg-red-500';
    if (priority >= 0.6) return 'bg-orange-500';
    if (priority >= 0.4) return 'bg-yellow-500';
    if (priority >= 0.2) return 'bg-blue-500';
    return 'bg-gray-500';
  };

  // Gantt Timeline View
  const renderGanttView = () => {
    // Calculate timeline bounds
    const today = new Date();
    const startDate = new Date(2025, 7, 1); // August 1, 2025
    const endDate = new Date(2026, 2, 31); // March 31, 2026
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Enhanced month calculation with weeks
    const getWeeksInMonth = (year: number, month: number) => {
      const lastDay = new Date(year, month + 1, 0);
      const totalDaysInMonth = lastDay.getDate();
      return Math.ceil(totalDaysInMonth / 7);
    };
    
    // Generate month headers with enhanced info
    const months = [];
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      const monthDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      months.push({
        name: d.toLocaleDateString('en-US', { month: 'short' }),
        year: d.getFullYear(),
        days: monthDays,
        weeks: getWeeksInMonth(d.getFullYear(), d.getMonth()),
        percentage: (monthDays / totalDays) * 100
      });
    }

    // Calculate node positions
    const getNodePosition = (node: MockNode) => {
      const nodeStart = node.createdAt ? new Date(node.createdAt) : startDate;
      const nodeEnd = node.dueDate ? new Date(node.dueDate) : new Date(nodeStart.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      const startOffset = Math.max(0, Math.ceil((nodeStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const duration = Math.max(1, Math.ceil((nodeEnd.getTime() - nodeStart.getTime()) / (1000 * 60 * 60 * 24)));
      
      return {
        left: (startOffset / totalDays) * 100,
        width: (duration / totalDays) * 100,
        startDate: nodeStart,
        endDate: nodeEnd,
        duration
      };
    };

    // Group nodes by type
    const groupedNodes = filteredNodes.reduce((acc, node) => {
      const type = node.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(node);
      return acc;
    }, {} as Record<string, MockNode[]>);

    return (
      <div className="h-full flex flex-col">
        {/* Timeline Controls */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setZoomLevel(prev => Math.min(prev * 1.5, 3))}
              className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors" 
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4 text-gray-300" />
            </button>
            <button 
              onClick={() => setZoomLevel(prev => Math.max(prev / 1.5, 0.5))}
              className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors" 
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4 text-gray-300" />
            </button>
            <button 
              onClick={() => setZoomLevel(1)}
              className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors" 
              title="Fit to Screen"
            >
              <Maximize2 className="h-4 w-4 text-gray-300" />
            </button>
          </div>
          
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded bg-purple-500"></div>
              <span className="text-gray-300">Epic</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-gray-300">Feature</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-gray-300">Task</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-gray-300">Bug</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-300">Milestone</span>
            </div>
          </div>
        </div>

        {/* Timeline Grid */}
        <div className="flex-1 overflow-auto scrollbar-gray">
          <div className="min-w-[1200px]" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
            {/* Enhanced Month Headers */}
            <div className="bg-gray-700 border-b border-gray-600 sticky top-0 z-10">
              <div className="flex">
                <div className="w-48 flex-shrink-0 px-4 py-3 border-r border-gray-600 bg-gray-750">
                  <div className="text-sm font-medium text-gray-300">Tasks & Timeline</div>
                  <div className="text-xs text-gray-400 mt-1">{filteredNodes.length} items</div>
                </div>
                <div className="flex-1 flex relative">
                  {months.map((month, index) => (
                    <div
                      key={index}
                      className="flex-1 px-2 py-2 border-r border-gray-600 text-center bg-gradient-to-b from-gray-700 to-gray-750 hover:from-gray-650 hover:to-gray-700 transition-all"
                      style={{ flex: `0 0 ${month.percentage}%` }}
                    >
                      <div className="text-sm font-semibold text-gray-200">
                        {month.name} {month.year}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 flex justify-center space-x-3">
                        <span>{month.days}d</span>
                        <span>•</span>
                        <span>{month.weeks}w</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Today indicator in header */}
                  {(() => {
                    const todayOffset = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                    const todayPosition = (todayOffset / totalDays) * 100;
                    if (todayPosition >= 0 && todayPosition <= 100) {
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-80 z-20 shadow-lg"
                          style={{ left: `${todayPosition}%` }}
                          title={`Today: ${today.toLocaleDateString()}`}
                        >
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-red-400 rounded-full shadow-md"></div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* Task Rows */}
            <div className="bg-gray-800">
              {Object.entries(groupedNodes).map(([type, nodes]) => (
                <div key={type} className="border-b border-gray-700">
                  {/* Type Header */}
                  <div className="bg-gray-750 px-4 py-2 border-b border-gray-600">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(type)}`}>
                      {type} ({nodes.length})
                    </span>
                  </div>
                  
                  {/* Task Items */}
                  {nodes.map((node) => {
                    const position = getNodePosition(node);
                    const isMilestone = node.type === 'MILESTONE';
                    
                    return (
                      <div key={node.id} className="flex border-b border-gray-700 hover:bg-gray-750 group">
                        {/* Task Name */}
                        <div className="w-48 flex-shrink-0 px-4 py-3 border-r border-gray-600">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(node.status)}
                            <span className="text-sm text-white truncate" title={node.title}>
                              {node.title}
                            </span>
                          </div>
                          {node.contributor && (
                            <div className="text-xs text-gray-400 mt-1">{node.contributor}</div>
                          )}
                        </div>
                        
                        {/* Timeline Bar */}
                        <div className="flex-1 relative py-3 px-2">
                          <div className="relative h-8">
                            {/* Progress Track */}
                            <div className="absolute inset-0 bg-gray-700 rounded opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            
                            {/* Current Date Indicator */}
                            {(() => {
                              const todayOffset = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                              const todayPosition = (todayOffset / totalDays) * 100;
                              if (todayPosition >= 0 && todayPosition <= 100) {
                                return (
                                  <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 opacity-70 z-10"
                                    style={{ left: `${todayPosition}%` }}
                                    title={`Today: ${today.toLocaleDateString()}`}
                                  ></div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Enhanced Task Bar or Milestone */}
                            {isMilestone ? (
                              <div
                                className="absolute top-1/2 transform -translate-y-1/2 z-20 group"
                                style={{ left: `${position.left}%` }}
                              >
                                <div className="relative">
                                  {/* Milestone diamond with enhanced styling */}
                                  <div className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-600 transform rotate-45 hover:scale-125 transition-all duration-200 cursor-pointer shadow-lg border-2 border-yellow-300 hover:border-yellow-200" 
                                       title={`${node.title} - Due: ${position.endDate.toLocaleDateString()}`}>
                                  </div>
                                  
                                  {/* Milestone pulse effect */}
                                  <div className="absolute inset-0 w-5 h-5 bg-yellow-400 transform rotate-45 animate-ping opacity-25"></div>
                                  
                                  {/* Milestone label on hover */}
                                  <div className="absolute left-6 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30 border border-gray-600">
                                    <div className="font-medium">{node.title}</div>
                                    <div className="text-gray-300">{position.endDate.toLocaleDateString()}</div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`absolute h-8 rounded-lg cursor-pointer hover:opacity-95 transition-all hover:shadow-xl hover:scale-105 flex items-center px-2 border-l-4 group overflow-hidden ${
                                  node.status === 'PROPOSED' ? 'bg-gradient-to-r from-blue-600 to-blue-500 border-blue-400 shadow-blue-500/20' :
                                  node.status === 'PLANNED' ? 'bg-gradient-to-r from-purple-600 to-purple-500 border-purple-400 shadow-purple-500/20' :
                                  node.status === 'IN_PROGRESS' ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 border-yellow-400 shadow-yellow-500/20' :
                                  node.status === 'COMPLETED' ? 'bg-gradient-to-r from-green-600 to-green-500 border-green-400 shadow-green-500/20' :
                                  node.status === 'BLOCKED' ? 'bg-gradient-to-r from-red-600 to-red-500 border-red-400 shadow-red-500/20' :
                                  'bg-gradient-to-r from-gray-600 to-gray-500 border-gray-400 shadow-gray-500/20'
                                } shadow-lg`}
                                style={{
                                  left: `${position.left}%`,
                                  width: `${Math.max(position.width, 2)}%`
                                }}
                                title={`${node.title}\n${position.startDate.toLocaleDateString()} - ${position.endDate.toLocaleDateString()}\n${position.duration} days\nProgress: ${node.actualHours && node.estimatedHours ? Math.round((node.actualHours / node.estimatedHours) * 100) : 0}%\nContributor: ${node.contributor || 'Available'}`}
                              >
                                {/* Enhanced Priority Indicator */}
                                <div className={`w-3 h-3 rounded-full mr-2 ${getPriorityIndicator(node.priority.computed)} ring-2 ring-white shadow-md flex-shrink-0`}></div>
                                
                                {/* Task Name with better handling */}
                                {position.width > 6 && (
                                  <span className="text-white text-xs font-semibold truncate flex-1">
                                    {position.width > 15 ? node.title : node.title.substring(0, Math.floor(position.width / 1.5))}
                                  </span>
                                )}
                                
                                {/* Enhanced Progress Bar */}
                                {node.estimatedHours && node.actualHours && (
                                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black bg-opacity-40 rounded-b-lg overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-white to-gray-200 transition-all duration-500 shadow-sm"
                                      style={{ width: `${Math.min(100, (node.actualHours / node.estimatedHours) * 100)}%` }}
                                    ></div>
                                  </div>
                                )}
                                
                                {/* Completion Status Indicator */}
                                {node.status === 'COMPLETED' && (
                                  <div className="absolute top-1 right-1 w-3 h-3 bg-green-400 rounded-full flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                  </div>
                                )}
                                
                                {/* Blocked Status Indicator */}
                                {node.status === 'BLOCKED' && (
                                  <div className="absolute top-1 right-1 w-3 h-3 bg-red-400 rounded-full flex items-center justify-center">
                                    <div className="w-1 h-1 bg-white rounded-full"></div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Enhanced Dependencies Lines */}
                            {mockProjectEdges
                              .filter(edge => edge.source === node.id && ['DEPENDS_ON', 'BLOCKS', 'ENABLES'].includes(edge.type))
                              .map(edge => {
                                const targetNode = filteredNodes.find(n => n.id === edge.target);
                                if (!targetNode) return null;
                                const targetPosition = getNodePosition(targetNode);
                                
                                // Calculate dependency line style based on type
                                const lineStyleMap = {
                                  DEPENDS_ON: { color: '#dc2626', dasharray: '6 3', width: 2, opacity: 0.7 },
                                  BLOCKS: { color: '#dc2626', dasharray: '4 4', width: 2.5, opacity: 0.8 },
                                  ENABLES: { color: '#3b82f6', dasharray: '8 2', width: 1.5, opacity: 0.6 },
                                  RELATES_TO: { color: '#6b7280', dasharray: '2 2', width: 1, opacity: 0.4 },
                                  PART_OF: { color: '#059669', dasharray: '6 3', width: 2, opacity: 0.7 },
                                  FOLLOWS: { color: '#7c3aed', dasharray: '6 3', width: 2, opacity: 0.6 },
                                  PARALLEL_WITH: { color: '#0891b2', dasharray: '2 2', width: 1, opacity: 0.4 },
                                  DUPLICATES: { color: '#ea580c', dasharray: '4 4', width: 2, opacity: 0.5 },
                                  CONFLICTS_WITH: { color: '#be123c', dasharray: '4 4', width: 2.5, opacity: 0.8 },
                                  VALIDATES: { color: '#16a34a', dasharray: '2 2', width: 1, opacity: 0.6 }
                                } as const;
                                const lineStyle = lineStyleMap[edge.type as keyof typeof lineStyleMap] || { color: '#6b7280', dasharray: '2 2', width: 1, opacity: 0.4 };
                                
                                // Calculate arrow positions
                                const sourceX = position.left + position.width;
                                const targetX = targetPosition.left;
                                const midX = sourceX + (targetX - sourceX) / 2;
                                
                                return (
                                  <svg
                                    key={edge.id}
                                    className="absolute inset-0 pointer-events-none z-10"
                                    style={{ overflow: 'visible' }}
                                  >
                                    <defs>
                                      <marker
                                        id={`arrowhead-${edge.id}`}
                                        markerWidth="8"
                                        markerHeight="6"
                                        refX="7"
                                        refY="3"
                                        orient="auto"
                                        fill={lineStyle.color}
                                      >
                                        <polygon points="0 0, 8 3, 0 6" />
                                      </marker>
                                    </defs>
                                    
                                    {/* Curved dependency line */}
                                    <path
                                      d={`M ${sourceX}% 50% Q ${midX}% 30% ${targetX}% 50%`}
                                      stroke={lineStyle.color}
                                      strokeWidth={lineStyle.width}
                                      strokeDasharray={lineStyle.dasharray}
                                      opacity={lineStyle.opacity}
                                      fill="none"
                                      markerEnd={`url(#arrowhead-${edge.id})`}
                                      className="hover:opacity-100 hover:stroke-width-3 transition-all duration-200"
                                    />
                                    
                                    {/* Dependency type indicator (subtle icon instead of text) */}
                                    <circle
                                      cx={`${midX}%`}
                                      cy="25%"
                                      r="2"
                                      fill={lineStyle.color}
                                      opacity="0.6"
                                    />
                                  </svg>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Timeline Footer */}
        <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-gray-300">
                <span className="font-medium">{filteredNodes.length}</span> items across <span className="font-medium">{months.length}</span> months
              </div>
              
              {/* Project Statistics */}
              <div className="flex items-center space-x-4 text-xs">
                {(() => {
                  const stats = filteredNodes.reduce((acc, node) => {
                    acc[node.status] = (acc[node.status] || 0) + 1;
                    if (node.estimatedHours) acc.totalEstimated += node.estimatedHours;
                    if (node.actualHours) acc.totalActual += node.actualHours;
                    return acc;
                  }, { totalEstimated: 0, totalActual: 0 } as any);
                  
                  return (
                    <>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-400">{stats.COMPLETED || 0} done</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-yellow-400">{stats.IN_PROGRESS || 0} active</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-purple-400">{stats.PLANNED || 0} planned</span>
                      </div>
                      {stats.BLOCKED > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-red-600">{stats.BLOCKED} blocked</span>
                        </div>
                      )}
                      <div className="text-gray-400">
                        {Math.round(stats.totalActual)}h / {Math.round(stats.totalEstimated)}h logged
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            
            <div className="flex items-center space-x-6 text-xs text-gray-400">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-1 bg-red-500"></div>
                  <span>Dependencies</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-1 bg-red-600"></div>
                  <span>Blocks</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-1 bg-blue-500"></div>
                  <span>Enables</span>
                </div>
              </div>
              <div className="text-gray-500">Hover for details • Click to edit</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced Calendar View
  const renderCalendarView = () => {
    const today = new Date();
    const currentMonth = 7; // August (0-indexed)
    const currentYear = 2025;
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Enhanced calendar days with previous/next month context
    const calendarDays = [];
    const prevMonth = new Date(currentYear, currentMonth - 1, 0);
    
    // Previous month's trailing days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      calendarDays.push({
        day: prevMonth.getDate() - i,
        isCurrentMonth: false,
        isPrevMonth: true,
        date: new Date(currentYear, currentMonth - 1, prevMonth.getDate() - i)
      });
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push({
        day: day,
        isCurrentMonth: true,
        isPrevMonth: false,
        date: new Date(currentYear, currentMonth, day)
      });
    }
    
    // Next month's leading days
    const remainingSlots = 42 - calendarDays.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingSlots; day++) {
      calendarDays.push({
        day: day,
        isCurrentMonth: false,
        isPrevMonth: false,
        date: new Date(currentYear, currentMonth + 1, day)
      });
    }

    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    
    // Calculate month statistics
    const monthStats = filteredNodes.reduce((acc, node) => {
      if (node.dueDate) {
        const dueDate = new Date(node.dueDate);
        if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
          acc.totalItems++;
          acc[node.status] = (acc[node.status] || 0) + 1;
          if (node.estimatedHours) acc.totalHours += node.estimatedHours;
        }
      }
      return acc;
    }, { totalItems: 0, totalHours: 0 } as any);

    // Group nodes by due date
    const nodesByDate = filteredNodes.reduce((acc, node) => {
      if (node.dueDate) {
        const dueDate = new Date(node.dueDate);
        if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
          const dateKey = dueDate.getDate();
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(node);
        }
      }
      return acc;
    }, {} as Record<number, MockNode[]>);

    return (
      <div className="p-6 bg-gray-900">
        {/* Enhanced Calendar Header */}
        <div className="bg-gray-800 rounded-t-lg border border-gray-700 border-b-0 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <button className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors" title="Previous Month">
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-green-300">
                    {monthNames[currentMonth]} {currentYear}
                  </h2>
                  <div className="text-sm text-gray-400 mt-1">
                    {monthStats.totalItems} items scheduled • {Math.round(monthStats.totalHours)}h estimated
                  </div>
                </div>
                
                <button className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors" title="Next Month">
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              <button className="px-3 py-2 bg-green-700 text-green-100 rounded-lg hover:bg-green-600 transition-colors text-sm font-medium">
                Today
              </button>
            </div>
            
            {/* Enhanced Priority Legend */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-md"></div>
                  <span className="text-gray-300">Critical</span>
                  <span className="text-gray-500">({monthStats.BLOCKED || 0})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-md"></div>
                  <span className="text-gray-300">Medium</span>
                  <span className="text-gray-500">({monthStats.IN_PROGRESS || 0})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 shadow-md"></div>
                  <span className="text-gray-300">Low</span>
                  <span className="text-gray-500">({monthStats.COMPLETED || 0})</span>
                </div>
              </div>
              
              {/* Calendar View Options */}
              <div className="flex items-center space-x-2 border-l border-gray-600 pl-6">
                <button className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors" title="Month View">
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button className="p-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors" title="Week View">
                  <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Month Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>Month Progress</span>
              <span>{Math.round((today.getDate() / daysInMonth) * 100)}% complete</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500"
                style={{ width: `${(today.getDate() / daysInMonth) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Enhanced Calendar Grid */}
        <div className="bg-gray-800 rounded-b-lg overflow-hidden border border-gray-700 border-t-0 shadow-lg">
          {/* Enhanced Day Headers */}
          <div className="grid grid-cols-7 bg-gradient-to-r from-gray-700 to-gray-750">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
              <div key={day} className={`p-4 text-center font-semibold border-r border-gray-600 last:border-r-0 ${
                index === 0 || index === 6 ? 'text-green-300 bg-gray-750' : 'text-gray-300'
              }`}>
                <div className="text-sm">{day.substring(0, 3)}</div>
                <div className="text-xs text-gray-400 mt-1">{day.substring(3)}</div>
              </div>
            ))}
          </div>

          {/* Enhanced Calendar Days Grid */}
          <div className="grid grid-cols-7 border-t border-gray-600">
            {calendarDays.map((dayData, index) => {
              const isToday = dayData.isCurrentMonth && dayData.day === today.getDate();
              const isPastDay = dayData.isCurrentMonth && dayData.day < today.getDate();
              const isWeekend = index % 7 === 0 || index % 7 === 6;
              
              return (
                <div 
                  key={index} 
                  className={`min-h-[140px] border-r border-b border-gray-600 last:border-r-0 p-3 transition-all duration-200 cursor-pointer group ${
                    dayData.isCurrentMonth 
                      ? isToday 
                        ? 'bg-green-900/20 border-green-500/30 hover:bg-green-900/30' 
                        : isPastDay
                        ? 'bg-gray-800 hover:bg-gray-750'
                        : 'bg-gray-800 hover:bg-gray-750'
                      : 'bg-gray-850 text-gray-500 hover:bg-gray-800'
                  } ${isWeekend ? 'bg-gray-825' : ''}`}
                >
                  {/* Enhanced Day Number */}
                  <div className={`flex items-center justify-between mb-2 ${
                    !dayData.isCurrentMonth ? 'opacity-50' : ''
                  }`}>
                    <span className={`font-semibold text-sm ${
                      isToday 
                        ? 'text-green-300 bg-green-700 rounded-full w-6 h-6 flex items-center justify-center text-xs' 
                        : dayData.isCurrentMonth 
                        ? 'text-gray-200' 
                        : 'text-gray-500'
                    }`}>
                      {dayData.day}
                    </span>
                    
                    {/* Day Status Indicator */}
                    {dayData.isCurrentMonth && nodesByDate[dayData.day] && (
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${
                          nodesByDate[dayData.day].some(n => n.status === 'BLOCKED') ? 'bg-red-500' :
                          nodesByDate[dayData.day].some(n => n.status === 'IN_PROGRESS') ? 'bg-yellow-500' :
                          nodesByDate[dayData.day].every(n => n.status === 'COMPLETED') ? 'bg-green-500' :
                          'bg-purple-500'
                        }`}></div>
                        <span className="text-xs text-gray-400">{nodesByDate[dayData.day].length}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced Task Items */}
                  {dayData.isCurrentMonth && nodesByDate[dayData.day] && (
                    <div className="space-y-1.5">
                      {nodesByDate[dayData.day].slice(0, 3).map((node) => (
                        <div
                          key={node.id}
                          className={`text-xs p-2 rounded-lg border-l-3 cursor-pointer transition-all duration-200 group-hover:shadow-md ${
                            node.status === 'PROPOSED' ? 'bg-blue-900/30 border-blue-500 hover:bg-blue-900/50' :
                            node.status === 'PLANNED' ? 'bg-purple-900/30 border-purple-500 hover:bg-purple-900/50' :
                            node.status === 'IN_PROGRESS' ? 'bg-yellow-900/30 border-yellow-500 hover:bg-yellow-900/50' :
                            node.status === 'COMPLETED' ? 'bg-green-900/30 border-green-500 hover:bg-green-900/50' :
                            node.status === 'BLOCKED' ? 'bg-red-900/30 border-red-500 hover:bg-red-900/50' :
                            'bg-gray-700 border-gray-500 hover:bg-gray-600'
                          }`}
                          title={`${node.title}\nType: ${node.type}\nStatus: ${node.status}\nContributor: ${node.contributor || 'Available'}\nPriority: ${Math.round(node.priority.computed * 100)}%`}
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityIndicator(node.priority.computed)}`}></div>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getNodeTypeColor(node.type)} text-xs`}>
                              {node.type.charAt(0)}
                            </span>
                          </div>
                          <div className="text-white font-medium leading-tight">
                            {node.title.length > 25 ? `${node.title.substring(0, 25)}...` : node.title}
                          </div>
                          {node.contributor && (
                            <div className="text-gray-400 mt-1 text-xs">
                              {node.contributor.split(' ')[0]}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* More Items Indicator */}
                      {nodesByDate[dayData.day].length > 3 && (
                        <div className="text-xs text-gray-400 bg-gray-700/50 rounded px-2 py-1 text-center hover:bg-gray-700 transition-colors cursor-pointer">
                          +{nodesByDate[dayData.day].length - 3} more items
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Empty Day Indicator */}
                  {dayData.isCurrentMonth && !nodesByDate[dayData.day] && (
                    <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-gray-400 hover:text-green-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Items without due dates */}
        {filteredNodes.filter(node => !node.dueDate).length > 0 && (
          <div className="mt-8">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Backlog Items</h3>
                  <p className="text-gray-400 text-sm">
                    {filteredNodes.filter(node => !node.dueDate).length} items without scheduled due dates
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button className="px-3 py-2 bg-blue-700 text-blue-100 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
                    Schedule All
                  </button>
                  <button className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium">
                    Bulk Edit
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredNodes.filter(node => !node.dueDate).map(node => (
                  <div
                    key={node.id}
                    className="bg-gray-750 border border-gray-600 rounded-lg p-4 hover:bg-gray-700 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 group"
                  >
                    {/* Enhanced Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getNodeTypeColor(node.type)}`}>
                          {node.type}
                        </span>
                        <div className={`w-3 h-3 rounded-full ring-2 ring-white ${getPriorityIndicator(node.priority.computed)}`}></div>
                      </div>
                      
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-gray-400 hover:text-green-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Enhanced Content */}
                    <h4 className="text-sm font-semibold text-white mb-2 leading-tight group-hover:text-green-100 transition-colors">
                      {node.title}
                    </h4>
                    
                    {node.description && (
                      <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                        {node.description.length > 60 ? `${node.description.substring(0, 60)}...` : node.description}
                      </p>
                    )}
                    
                    {/* Enhanced Status and Details */}
                    <div className="space-y-2">
                      <div className={`flex items-center text-xs font-medium ${getStatusColor(node.status)}`}>
                        {getStatusIcon(node.status)}
                        <span className="ml-2">{formatStatus(node.status)}</span>
                      </div>
                      
                      {node.contributor && (
                        <div className="flex items-center text-xs text-gray-400">
                          <div className={`w-4 h-4 ${getContributorColor(node.contributor)} rounded-full flex items-center justify-center mr-2`}>
                            <span className="text-xs font-medium text-white">
                              {node.contributor.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <span>{node.contributor}</span>
                        </div>
                      )}
                      
                      {node.estimatedHours && (
                        <div className="flex items-center text-xs text-gray-400">
                          <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{node.estimatedHours}h estimated</span>
                        </div>
                      )}
                      
                      {node.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {node.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-300">
                              {tag}
                            </span>
                          ))}
                          {node.tags.length > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-400">
                              +{node.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Priority Indicator */}
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Priority</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-1 bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${getPriorityIndicator(node.priority.computed)}`}
                              style={{ width: `${node.priority.computed * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-gray-300 font-medium">{Math.round(node.priority.computed * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Backlog Statistics */}
              <div className="mt-6 pt-4 border-t border-gray-600">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  {(() => {
                    const backlogNodes = filteredNodes.filter(node => !node.dueDate);
                    const backlogStats = backlogNodes.reduce((acc, node) => {
                      acc[node.status] = (acc[node.status] || 0) + 1;
                      if (node.estimatedHours) acc.totalHours += node.estimatedHours;
                      return acc;
                    }, { totalHours: 0 } as any);
                    
                    return (
                      <>
                        <div>
                          <div className="text-lg font-bold text-blue-400">{backlogStats.PROPOSED || 0}</div>
                          <div className="text-xs text-gray-400">Proposed</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-purple-400">{backlogStats.PLANNED || 0}</div>
                          <div className="text-xs text-gray-400">Planned</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-yellow-400">{backlogStats.IN_PROGRESS || 0}</div>
                          <div className="text-xs text-gray-400">In Progress</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-400">{Math.round(backlogStats.totalHours)}h</div>
                          <div className="text-xs text-gray-400">Total Effort</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Enhanced Activity Feed View  
  const renderActivityView = () => {
    // Generate enhanced activities from nodes
    const activities = filteredNodes.flatMap(node => {
      const baseActivities = [];
      
      // Created activity
      baseActivities.push({
        id: `${node.id}-created`,
        type: 'created',
        action: 'created',
        title: `Created ${node.type.toLowerCase()}`,
        description: node.title,
        user: node.contributor || 'System',
        timestamp: node.createdAt,
        node: node,
        icon: <Plus className="h-4 w-4" />,
        priority: 'normal',
        category: 'content',
        color: 'bg-green-600'
      });
      
      // Status change activity
      baseActivities.push({
        id: `${node.id}-status`,
        type: 'status_change',
        action: 'updated status',
        title: `Status changed to ${formatStatus(node.status).toLowerCase()}`,
        description: node.title,
        user: node.contributor || 'System',
        timestamp: node.updatedAt,
        node: node,
        icon: getStatusIcon(node.status),
        priority: node.status === 'BLOCKED' ? 'high' : node.status === 'COMPLETED' ? 'high' : 'normal',
        category: 'status',
        color: 'bg-blue-600',
        details: `From planned to ${formatStatus(node.status).toLowerCase()}`
      });
      
      // Contribution activity
      if (node.contributor) {
        baseActivities.push({
          id: `${node.id}-assigned`,
          type: 'assigned',
          action: 'picked-up',
          title: `Picked up by ${node.contributor}`,
          description: node.title,
          user: 'System',
          timestamp: node.updatedAt,
          node: node,
          icon: <User className="h-4 w-4" />,
          priority: 'normal',
          category: 'contribution',
          color: 'bg-purple-600'
        });
      }
      
      // Progress activity
      if (node.estimatedHours && node.actualHours) {
        baseActivities.push({
          id: `${node.id}-progress`,
          type: 'progress',
          action: 'logged time',
          title: `Logged ${node.actualHours}h of work`,
          description: node.title,
          user: node.contributor || 'System',
          timestamp: node.updatedAt,
          node: node,
          icon: <Clock className="h-4 w-4" />,
          priority: 'normal',
          category: 'progress',
          color: 'bg-orange-600',
          details: `${node.actualHours}h / ${node.estimatedHours}h (${Math.round((node.actualHours / node.estimatedHours) * 100)}%)`
        });
      }
      
      return baseActivities;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter activities based on selected filters
    const filteredActivities = activities.filter(activity => {
      if (activityFilter !== 'all' && activity.category !== activityFilter) return false;
      
      const activityDate = new Date(activity.timestamp);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (activityTimeRange) {
        case 'today': return daysDiff === 0;
        case 'week': return daysDiff <= 7;
        case 'month': return daysDiff <= 30;
        default: return true;
      }
    });

    // Apply pagination to filtered activities
    const displayedActivities = filteredActivities.slice(0, loadedActivitiesCount);
    const hasMoreActivities = filteredActivities.length > loadedActivitiesCount;

    // Group displayed activities by date
    const groupedActivities = displayedActivities.reduce((acc, activity) => {
      const date = new Date(activity.timestamp).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {} as Record<string, typeof activities>);

    // Calculate activity statistics
    const activityStats = activities.reduce((acc, activity) => {
      acc.total++;
      acc[activity.category] = (acc[activity.category] || 0) + 1;
      if (activity.priority === 'high') acc.highPriority++;
      return acc;
    }, { total: 0, highPriority: 0 } as any);

    // Handle load more activities
    const handleLoadMoreActivities = async () => {
      setIsLoadingMore(true);
      
      // Simulate loading delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setLoadedActivitiesCount(prev => prev + activitiesPerPage);
      setIsLoadingMore(false);
    };

    return (
      <div className="p-6 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          {/* Professional Activity Feed Header */}
          <div className="bg-gray-800 rounded-t-lg border border-gray-700 border-b-0 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-green-300 mb-2">Activity Feed</h2>
                <p className="text-gray-400">
                  {displayedActivities.length} of {filteredActivities.length} activities across {Object.keys(groupedActivities).length} days
                  {activityStats.highPriority > 0 && (
                    <span className="ml-2 px-2 py-1 bg-red-900/30 text-red-600 rounded text-sm">
                      {activityStats.highPriority} high priority
                    </span>
                  )}
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Real-time indicator */}
                <div className="flex items-center space-x-2 px-3 py-2 bg-green-900/30 rounded-lg">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-300 text-sm font-medium">Live</span>
                </div>
                
                {/* Export button */}
                <button className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium">
                  Export
                </button>
              </div>
            </div>
            
            {/* Enhanced Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                {/* Time Range Dropdown */}
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-400 font-medium">Time:</span>
                  <div className="relative" ref={timeDropdownRef}>
                    <button
                      onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors text-white min-w-[100px]"
                    >
                      <span className="text-sm font-medium">
                        {activityTimeRange === 'today' ? 'Today' :
                         activityTimeRange === 'week' ? 'Week' :
                         activityTimeRange === 'month' ? 'Month' : 'All'}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isTimeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isTimeDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
                        <div className="p-2">
                          {[
                            { id: 'today', label: 'Today', description: 'Activities from today' },
                            { id: 'week', label: 'Week', description: 'Last 7 days' },
                            { id: 'month', label: 'Month', description: 'Last 30 days' },
                            { id: 'all', label: 'All', description: 'All activities' }
                          ].map((range) => (
                            <button
                              key={range.id}
                              onClick={() => {
                                setActivityTimeRange(range.id);
                                setIsTimeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                                activityTimeRange === range.id
                                  ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                                  : 'hover:bg-gray-700 text-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`text-sm font-medium ${
                                    activityTimeRange === range.id ? 'text-green-300' : 'text-white'
                                  }`}>{range.label}</div>
                                  <div className="text-xs text-gray-400 mt-0.5">{range.description}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Category Type Dropdown */}
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-400 font-medium">Type:</span>
                  <div className="relative" ref={typeDropdownRef}>
                    <button
                      onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors text-white min-w-[140px]"
                    >
                      <span className="text-sm font-medium">
                        {activityFilter === 'all' ? `All (${activityStats.total})` :
                         activityFilter === 'content' ? `Created (${activityStats.content || 0})` :
                         activityFilter === 'status' ? `Status (${activityStats.status || 0})` :
                         activityFilter === 'contribution' ? `Picked up (${activityStats.contribution || 0})` :
                         `Progress (${activityStats.progress || 0})`}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isTypeDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
                        <div className="p-2">
                          {[
                            { 
                              id: 'all', 
                              label: 'All', 
                              count: activityStats.total, 
                              description: 'All activity types',
                              color: 'bg-gray-500'
                            },
                            { 
                              id: 'content', 
                              label: 'Created', 
                              count: activityStats.content || 0, 
                              description: 'Item creation activities',
                              color: 'bg-green-500'
                            },
                            { 
                              id: 'status', 
                              label: 'Status', 
                              count: activityStats.status || 0, 
                              description: 'Status change activities',
                              color: 'bg-blue-500'
                            },
                            { 
                              id: 'contribution', 
                              label: 'Picked up', 
                              count: activityStats.contribution || 0, 
                              description: 'Contribution activities',
                              color: 'bg-purple-500'
                            },
                            { 
                              id: 'progress', 
                              label: 'Progress', 
                              count: activityStats.progress || 0, 
                              description: 'Time and progress logs',
                              color: 'bg-orange-500'
                            }
                          ].map((category) => (
                            <button
                              key={category.id}
                              onClick={() => {
                                setActivityFilter(category.id);
                                setIsTypeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                                activityFilter === category.id
                                  ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                                  : 'hover:bg-gray-700 text-gray-300'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm font-medium ${
                                      activityFilter === category.id ? 'text-green-300' : 'text-white'
                                    }`}>
                                      {category.label}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-300 bg-gray-700 px-2 py-0.5 rounded">
                                      {category.count}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-0.5">{category.description}</div>
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
              
              {/* Activity Statistics */}
              <div className="flex items-center space-x-6 text-base">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300 font-medium">{activityStats.status || 0} status changes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-300 font-medium">{activityStats.contribution || 0} contributions</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300 font-medium">{activityStats.content || 0} created</span>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Activity Timeline */}
          <div className="bg-gray-800 rounded-b-lg border border-gray-700 border-t-0 shadow-lg">
            {Object.keys(groupedActivities).length > 0 ? (
              <div className="divide-y divide-gray-700">
                {Object.entries(groupedActivities).map(([date, dayActivities]) => (
                  <div key={date} className="p-6">
                    {/* Date Header */}
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="flex-shrink-0">
                        <div className="text-sm font-semibold text-green-300">
                          {new Date(date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {dayActivities.length} {dayActivities.length === 1 ? 'activity' : 'activities'}
                        </div>
                      </div>
                      <div className="flex-1 h-px bg-gray-600"></div>
                      <div className="text-xs text-gray-400">
                        {new Date(date) >= new Date(new Date().setDate(new Date().getDate() - 1)) ? 'Recent' : 'Historical'}
                      </div>
                    </div>
                    
                    {/* Activity Items */}
                    <div className="space-y-4">
                      {dayActivities.map((activity, index) => (
                        <div 
                          key={activity.id} 
                          className="group relative pl-12 pb-6 last:pb-0 cursor-pointer"
                          onClick={() => console.log('Activity clicked:', activity)}
                        >
                          {/* Timeline connector */}
                          {index < dayActivities.length - 1 && (
                            <div className="absolute left-6 top-12 w-0.5 h-full bg-gray-600 transform -translate-x-1/2"></div>
                          )}
                          
                          {/* Enhanced Activity Card */}
                          <div className={`relative rounded-xl p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border ${
                            activity.priority === 'high' 
                              ? 'bg-gradient-to-br from-red-900/20 to-red-800/10 border-red-500/30 hover:border-red-400/50' 
                              : 'bg-gradient-to-br from-gray-750 to-gray-700 border-gray-600 hover:border-gray-500'
                          }`}>
                            {/* Activity Icon */}
                            <div className={`absolute -left-6 top-5 w-10 h-10 rounded-full flex items-center justify-center border-3 border-gray-800 shadow-lg ${activity.color}`}>
                              <div className="text-white">
                                {activity.icon}
                              </div>
                            </div>
                            
                            {/* Priority Indicator */}
                            {activity.priority === 'high' && (
                              <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg"></div>
                            )}
                            
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                {/* Activity Header */}
                                <div className="flex items-center space-x-3 mb-3">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center border border-gray-500">
                                      <span className="text-xs font-bold text-white">
                                        {activity.user.split(' ').map(n => n[0]).join('')}
                                      </span>
                                    </div>
                                    <span className="text-sm font-semibold text-white">{activity.user}</span>
                                  </div>
                                  <span className="text-sm text-gray-300">{activity.action}</span>
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getNodeTypeColor(activity.node.type)}`}>
                                    {activity.node.type}
                                  </span>
                                </div>
                                
                                {/* Activity Content */}
                                <div className="bg-gray-700/40 rounded-lg p-4 mb-4 group-hover:bg-gray-700/60 transition-all duration-300">
                                  <h4 className="text-base font-semibold text-white mb-2 group-hover:text-green-100 transition-colors">
                                    {activity.description}
                                  </h4>
                                  {activity.details && (
                                    <p className="text-sm text-gray-300 leading-relaxed">{activity.details}</p>
                                  )}
                                </div>
                                
                                {/* Activity Metadata */}
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center space-x-6 text-gray-400">
                                    <div className={`flex items-center space-x-2 ${getStatusColor(activity.node.status)}`}>
                                      {getStatusIcon(activity.node.status)}
                                      <span className="font-medium">{formatStatus(activity.node.status)}</span>
                                    </div>
                                    {activity.node.contributor && (
                                      <div className="flex items-center space-x-2">
                                        <div className={`w-6 h-6 rounded-full ${getContributorColor(activity.node.contributor)} flex items-center justify-center`}>
                                          <span className="text-white text-xs font-medium">
                                            {activity.node.contributor.split(' ').map(n => n[0]).join('')}
                                          </span>
                                        </div>
                                        <span className="text-gray-300 text-sm">{activity.node.contributor}</span>
                                      </div>
                                    )}
                                    {activity.node.priority && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-gray-400 text-sm">Priority:</span>
                                        <div className="flex items-center space-x-2">
                                          <div className="w-12 h-2 bg-gray-600 rounded-full overflow-hidden">
                                            <div 
                                              className={`h-full transition-all duration-300 ${
                                                activity.node.priority.computed >= 0.8 ? 'bg-red-500' :
                                                activity.node.priority.computed >= 0.6 ? 'bg-orange-500' :
                                                activity.node.priority.computed >= 0.4 ? 'bg-yellow-500' :
                                                activity.node.priority.computed >= 0.2 ? 'bg-blue-500' :
                                                'bg-gray-500'
                                              }`}
                                              style={{ 
                                                width: `${Math.max(activity.node.priority.computed * 100, 2)}%`,
                                                borderRadius: activity.node.priority.computed >= 1 ? '9999px' : '9999px 0 0 9999px'
                                              }}
                                            ></div>
                                          </div>
                                          <span className="text-white font-medium text-sm min-w-[30px]">{Math.round(activity.node.priority.computed * 100)}%</span>
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex items-center space-x-2">
                                      <span className="text-gray-400 text-sm">Due Date:</span>
                                      <span className="text-gray-300 text-sm">
                                        {activity.node.dueDate ? new Date(activity.node.dueDate).toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric',
                                          year: 'numeric'
                                        }) : 
                                          <span className="text-gray-500">No date</span>
                                        }
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-3 text-gray-400">
                                    <span className="font-medium">{new Date(activity.timestamp).toLocaleTimeString('en-US', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}</span>
                                    <button className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 hover:bg-gray-600 rounded-lg">
                                      <MessageSquare className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Load More Activities */}
                {hasMoreActivities && (
                  <div className="p-6 text-center border-t border-gray-700">
                    <button 
                      onClick={handleLoadMoreActivities}
                      disabled={isLoadingMore}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-500 disabled:cursor-not-allowed font-medium cursor-pointer flex items-center space-x-2 mx-auto transition-all duration-300"
                    >
                      {isLoadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          <span>Load More Activities</span>
                          <span className="text-xs bg-green-800 px-2 py-1 rounded-full">
                            {filteredActivities.length - loadedActivitiesCount} more
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* End of Activities Message */}
                {!hasMoreActivities && displayedActivities.length > 0 && (
                  <div className="p-6 text-center border-t border-gray-700">
                    <div className="text-gray-300 text-sm flex items-center justify-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>All activities loaded ({filteredActivities.length} total)</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Activity className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">No Activity Found</h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  {activityFilter === 'all' 
                    ? "No recent activity to display. Activities will appear here as team members work on projects."
                    : `No ${activityFilter} activities found. Try adjusting your filters.`
                  }
                </p>
                <button 
                  onClick={() => {
                    setActivityFilter('all');
                    setActivityTimeRange('all');
                  }}
                  className="px-6 py-3 bg-green-700 text-green-100 rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentViewOption = timelineViewOptions.find(option => option.id === currentView)!;

  if (!currentGraph) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Graph Selected</h3>
          <p className="text-gray-400">Select a graph to view its timeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-green-300">
              {currentGraph.name}
            </h2>
            
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
                    {timelineViewOptions.map((option) => (
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
          
          <div className="text-sm text-gray-400">
            <div className="bg-gray-750 rounded-lg p-4 border border-gray-600">
              <h3 className="text-lg font-semibold text-white mb-3">Project Overview</h3>
              
              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  <span>Overall Progress</span>
                  <span>{Math.round((filteredNodes.filter(node => node.status === 'COMPLETED').length / filteredNodes.length) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(filteredNodes.filter(node => node.status === 'COMPLETED').length / filteredNodes.length) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Task Count */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{filteredNodes.length}</div>
                <div className="text-sm text-gray-400">Total Tasks</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search timeline..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {currentView === 'gantt' && renderGanttView()}
        {currentView === 'calendar' && renderCalendarView()}
        {currentView === 'activity' && renderActivityView()}
      </div>
    </div>
  );
}