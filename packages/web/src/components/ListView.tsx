import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  ChevronDown, 
  Grid3X3, 
  Kanban, 
  BarChart3, 
  Circle,
  Table,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Lightbulb,
  Calendar,
  Zap,
  Triangle,
  ArrowDown,
  Flame,
  Layers,
  Sparkles,
  ListTodo,
  Trophy,
  AlertTriangle,
  Target,
  Microscope,
  ClipboardList
} from 'lucide-react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { GET_WORK_ITEMS } from '../lib/queries';
import { EditNodeModal } from './EditNodeModal';
import { DeleteNodeModal } from './DeleteNodeModal';
import { TagDisplay } from './TagDisplay';

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
  assignedTo?: string;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  contributors?: Array<{ id: string; name: string; type: string; }>;
  dependencies?: Array<{ id: string; title: string; }>;
  dependents?: Array<{ id: string; title: string; }>;
}

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
  const { currentTeam } = useAuth();
  
  // Fetch real work items from GraphQL
  const { data, loading, error, refetch } = useQuery(GET_WORK_ITEMS, {
    variables: {
      where: {
        teamId: currentTeam?.id || 'team-1'
      }
    },
    fetchPolicy: 'cache-and-network'  // Use cache first, then update from network
  });
  
  const workItems: WorkItem[] = data?.workItems || [];
  
  
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [contributorFilter, setContributorFilter] = useState('All Contributors');
  const [priorityFilter, setPriorityFilter] = useState('All Priorities');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkItem | null>(null);
  const [showAllRecentTasks, setShowAllRecentTasks] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
  const [isContributorDropdownOpen, setIsContributorDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const contributorDropdownRef = useRef<HTMLDivElement>(null);

  // Type options with icons
  const typeOptions = [
    { value: 'All Types', label: 'All Types', icon: null, color: 'text-gray-400' },
    { value: 'EPIC', label: 'Epic', icon: <Layers className="h-6 w-6" />, color: 'text-fuchsia-400' },
    { value: 'MILESTONE', label: 'Milestone', icon: <Trophy className="h-6 w-6" />, color: 'text-orange-400' },
    { value: 'OUTCOME', label: 'Outcome', icon: <Target className="h-6 w-6" />, color: 'text-indigo-400' },
    { value: 'FEATURE', label: 'Feature', icon: <Sparkles className="h-6 w-6" />, color: 'text-sky-400' },
    { value: 'TASK', label: 'Task', icon: <ListTodo className="h-6 w-6" />, color: 'text-green-400' },
    { value: 'BUG', label: 'Bug', icon: <AlertTriangle className="h-6 w-6" />, color: 'text-red-400' },
    { value: 'IDEA', label: 'Idea', icon: <Lightbulb className="h-6 w-6" />, color: 'text-yellow-300' },
    { value: 'RESEARCH', label: 'Research', icon: <Microscope className="h-6 w-6" />, color: 'text-teal-400' }
  ];

  // Status options with icons
  const statusOptions = [
    { value: 'All Statuses', label: 'All Statuses', icon: null, color: 'text-gray-400' },
    { value: 'PROPOSED', label: 'Proposed', icon: <ClipboardList className="h-6 w-6" />, color: 'text-cyan-400' },
    { value: 'PLANNED', label: 'Planned', icon: <Calendar className="h-6 w-6" />, color: 'text-purple-400' },
    { value: 'IN_PROGRESS', label: 'In Progress', icon: <Clock className="h-6 w-6" />, color: 'text-yellow-400' },
    { value: 'COMPLETED', label: 'Completed', icon: <CheckCircle className="h-6 w-6" />, color: 'text-green-400' },
    { value: 'BLOCKED', label: 'Blocked', icon: <AlertCircle className="h-6 w-6" />, color: 'text-red-400' }
  ];

  // Priority options with icons
  const priorityOptions = [
    { value: 'All Priorities', label: 'All Priorities', icon: null, color: 'text-gray-400' },
    { value: 'Critical', label: 'Critical', icon: <Flame className="h-6 w-6" />, color: 'text-red-500' },
    { value: 'High', label: 'High', icon: <Zap className="h-6 w-6" />, color: 'text-orange-500' },
    { value: 'Moderate', label: 'Moderate', icon: <Triangle className="h-6 w-6" />, color: 'text-yellow-500' },
    { value: 'Low', label: 'Low', icon: <Circle className="h-6 w-6" />, color: 'text-blue-500' },
    { value: 'Minimal', label: 'Minimal', icon: <ArrowDown className="h-6 w-6" />, color: 'text-green-500' }
  ];




  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setIsPriorityDropdownOpen(false);
      }
      if (contributorDropdownRef.current && !contributorDropdownRef.current.contains(event.target as Node)) {
        setIsContributorDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Transform WorkItem to EditNode format
  const transformNodeForEdit = (node: WorkItem) => ({
    id: node.id,
    title: node.title,
    description: node.description,
    type: node.type,
    status: node.status,
    priorityExec: node.priorityExec,
    priorityIndiv: node.priorityIndiv,
    priorityComm: node.priorityComm,
    tags: node.tags || [],
    dueDate: node.dueDate || '',
    assignedTo: node.assignedTo || '',
  });

  // Modal handlers
  const handleEditNode = (node: WorkItem) => {
    setSelectedNode(node);
    setShowEditModal(true);
  };

  const handleDeleteNode = (node: WorkItem) => {
    setSelectedNode(node);
    setShowDeleteModal(true);
  };

  const handleCloseModals = () => {
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedNode(null);
  };

  // Get unique values for filter options
  const uniqueContributors = useMemo(() => {
    const contributors = workItems
      .map(node => node.assignedTo)
      .filter(contributor => contributor && typeof contributor === 'string' && contributor.trim().length > 0)
      .filter((contributor, index, arr) => arr.indexOf(contributor) === index)
      .sort();
    
    return contributors;
  }, [workItems]);

  // Contributor options without icons
  const contributorOptions = useMemo(() => [
    { value: 'All Contributors', label: 'All Contributors' },
    { value: 'Available', label: 'Available', color: 'text-orange-400' },
    ...uniqueContributors.map(contributor => ({
      value: contributor,
      label: contributor
    }))
  ], [uniqueContributors]);


  // Filter nodes based on search and filters
  const filteredNodes = useMemo(() => {
    let filtered = workItems;
    
    // Text search across multiple fields
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(node =>
        node.title.toLowerCase().includes(searchLower) ||
        node.description?.toLowerCase().includes(searchLower) ||
        node.type.toLowerCase().includes(searchLower) ||
        node.status.toLowerCase().includes(searchLower) ||
        node.assignedTo?.toLowerCase().includes(searchLower) ||
        node.id.toLowerCase().includes(searchLower) ||
        (node.dueDate && new Date(node.dueDate).toLocaleDateString().includes(searchLower))
      );
    }

    // Type filter
    if (typeFilter !== 'All Types') {
      filtered = filtered.filter(node => node.type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'All Statuses') {
      filtered = filtered.filter(node => node.status === statusFilter);
    }

    // Contributor filter
    if (contributorFilter !== 'All Contributors') {
      if (contributorFilter === 'Available') {
        filtered = filtered.filter(node => !node.assignedTo);
      } else {
        filtered = filtered.filter(node => node.assignedTo === contributorFilter);
      }
    }

    // Priority filter
    if (priorityFilter !== 'All Priorities') {
      filtered = filtered.filter(node => {
        const priority = node.priorityComp || node.priorityExec;
        switch (priorityFilter) {
          case 'Critical': return priority >= 0.8;
          case 'High': return priority >= 0.6 && priority < 0.8;
          case 'Medium': return priority >= 0.4 && priority < 0.6;
          case 'Low': return priority >= 0.2 && priority < 0.4;
          case 'Minimal': return priority < 0.2;
          default: return true;
        }
      });
    }


    return filtered;
  }, [workItems, searchTerm, typeFilter, statusFilter, contributorFilter, priorityFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredNodes.length;
    const completed = filteredNodes.filter(node => node.status === 'COMPLETED').length;
    const inProgress = filteredNodes.filter(node => node.status === 'IN_PROGRESS').length;
    const blocked = filteredNodes.filter(node => node.status === 'BLOCKED').length;
    const planned = filteredNodes.filter(node => node.status === 'PLANNED').length;
    const proposed = filteredNodes.filter(node => node.status === 'PROPOSED').length;

    const typeStats = filteredNodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityStats = {
      critical: filteredNodes.filter(node => (node.priorityComp || node.priorityExec) >= 0.8).length,
      high: filteredNodes.filter(node => (node.priorityComp || node.priorityExec) >= 0.6 && (node.priorityComp || node.priorityExec) < 0.8).length,
      moderate: filteredNodes.filter(node => (node.priorityComp || node.priorityExec) >= 0.4 && (node.priorityComp || node.priorityExec) < 0.6).length,
      low: filteredNodes.filter(node => (node.priorityComp || node.priorityExec) >= 0.2 && (node.priorityComp || node.priorityExec) < 0.4).length,
      minimal: filteredNodes.filter(node => (node.priorityComp || node.priorityExec) < 0.2).length
    };

    return {
      total,
      completed,
      inProgress,
      blocked,
      planned,
      proposed,
      typeStats,
      priorityStats
    };
  }, [filteredNodes]);

  // Helper functions
  const getNodePriority = (node: WorkItem) => {
    return node.priorityComp || node.priorityExec || 0;
  };

  const formatLabel = (label: string) => {
    // Convert SNAKE_CASE to Proper Case
    return label
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'EPIC': return 'bg-purple-500 text-white';
      case 'FEATURE': return 'bg-blue-600 text-white';
      case 'TASK': return 'bg-green-500 text-white';
      case 'BUG': return 'bg-red-500 text-white';
      case 'MILESTONE': return 'bg-orange-500 text-black';
      case 'IDEA': return 'bg-yellow-500 text-white';
      case 'OUTCOME': return 'bg-indigo-500 text-white';
      case 'RESEARCH': return 'bg-teal-500 text-white';
      
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROPOSED': return 'text-cyan-400';
      case 'PLANNED': return 'text-purple-400';
      case 'IN_PROGRESS': return 'text-yellow-400';
      case 'COMPLETED': return 'text-green-400';
      case 'BLOCKED': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };



  // Card View
  const renderCardView = () => (
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
          className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 group"
        >
          <div className="flex items-start justify-between mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${getNodeTypeColor(node.type)}`}>
              {formatLabel(node.type)}
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
                <div className="flex items-center relative">
                  <div className="w-3 h-12 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden flex flex-col justify-end relative">
                    <div className={`w-full transition-all duration-300 ${
                      getNodePriority(node) >= 0.8 ? 'bg-red-500' :
                      getNodePriority(node) >= 0.6 ? 'bg-orange-500' :
                      getNodePriority(node) >= 0.4 ? 'bg-yellow-500' :
                      getNodePriority(node) >= 0.2 ? 'bg-blue-500' : 'bg-green-500'
                    }`} style={{ height: `${Math.max(getNodePriority(node) * 100, 8)}%` }}></div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-semibold ${
                    getNodePriority(node) >= 0.8 ? 'text-red-500' :
                    getNodePriority(node) >= 0.6 ? 'text-orange-500' :
                    getNodePriority(node) >= 0.4 ? 'text-yellow-500' :
                    getNodePriority(node) >= 0.2 ? 'text-blue-500' : 'text-green-500'
                  }`}>
                    {Math.round(getNodePriority(node) * 100)}%
                  </span>
                  <span className={`text-xs font-medium ${
                    getNodePriority(node) >= 0.8 ? 'text-red-500' :
                    getNodePriority(node) >= 0.6 ? 'text-orange-500' :
                    getNodePriority(node) >= 0.4 ? 'text-yellow-500' :
                    getNodePriority(node) >= 0.2 ? 'text-blue-500' :
                    'text-green-500'
                  }`}>
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
                getContributorAvatar(node.assignedTo)
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
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm ${
              node.status === 'PROPOSED' ? 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-900/20 dark:border-cyan-800 dark:text-cyan-400' :
              node.status === 'PLANNED' ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400' :
              node.status === 'IN_PROGRESS' ? 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400' :
              node.status === 'COMPLETED' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' :
              node.status === 'BLOCKED' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' :
              'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-900/20 dark:border-gray-800 dark:text-gray-400'
            }`}>
              <div>
                {node.status === 'PROPOSED' && <ClipboardList className="h-4 w-4" />}
                {node.status === 'PLANNED' && <Calendar className="h-4 w-4" />}
                {node.status === 'IN_PROGRESS' && <Clock className="h-4 w-4" />}
                {node.status === 'COMPLETED' && <CheckCircle className="h-4 w-4" />}
                {node.status === 'BLOCKED' && <AlertCircle className="h-4 w-4" />}
              </div>
              <span>{formatLabel(node.status)}</span>
            </div>
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
        icon: <ClipboardList className="h-4 w-4 text-cyan-400" />, 
        color: 'bg-cyan-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-cyan-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-cyan-400'
      },
      'PLANNED': { 
        label: 'Planned', 
        icon: <Calendar className="h-4 w-4 text-purple-400" />, 
        color: 'bg-purple-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-purple-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-purple-400'
      },
      'IN_PROGRESS': { 
        label: 'In Progress', 
        icon: <Clock className="h-4 w-4 text-yellow-400" />, 
        color: 'bg-yellow-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-yellow-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-yellow-400'
      },
      'BLOCKED': { 
        label: 'Blocked', 
        icon: <AlertCircle className="h-4 w-4 text-red-600" />, 
        color: 'bg-red-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-red-600',
        borderColor: 'border-gray-600',
        dotColor: 'bg-red-400'
      },
      'COMPLETED': { 
        label: 'Completed', 
        icon: <CheckCircle className="h-4 w-4 text-green-400" />, 
        color: 'bg-green-500',
        bgColor: 'bg-gray-750',
        textColor: 'text-green-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-green-400'
      }
    };

    const nodesByStatus = statuses.reduce((acc, status) => {
      acc[status] = filteredNodes.filter(node => node.status === status);
      return acc;
    }, {} as Record<string, WorkItem[]>);

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
                    <div className="text-white">{config.icon}</div>
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
                      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(node.type)}`}>
                          {formatLabel(node.type)}
                        </span>
                        
                        {/* Action buttons - appear on hover */}
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                          <div className="w-4 h-12 bg-gray-600 rounded overflow-hidden flex flex-col justify-end relative">
                            <div className={`w-full transition-all duration-300 ${
                              getNodePriority(node) >= 0.8 ? 'bg-red-500' :
                              getNodePriority(node) >= 0.6 ? 'bg-orange-500' :
                              getNodePriority(node) >= 0.4 ? 'bg-yellow-500' :
                              getNodePriority(node) >= 0.2 ? 'bg-blue-500' : 'bg-green-500'
                            }`} style={{ height: `${Math.max(getNodePriority(node) * 100, 5)}%` }}></div>
                          </div>
                          <span className={`absolute text-xs font-bold left-6 ml-1 ${
                            getNodePriority(node) >= 0.8 ? 'text-red-500' :
                            getNodePriority(node) >= 0.6 ? 'text-orange-500' :
                            getNodePriority(node) >= 0.4 ? 'text-yellow-500' :
                            getNodePriority(node) >= 0.2 ? 'text-blue-500' : 'text-green-500'
                          }`} style={{ 
                            bottom: `${Math.max(getNodePriority(node) * 100, 5)}%`,
                            transform: 'translateY(50%)'
                          }}>
                            {Math.round(getNodePriority(node) * 100)}%
                          </span>
                        </div>

                        {/* Due Date - Right Side */}
                        <div className="flex flex-col items-start">
                          {node.dueDate ? (
                            <div className="space-y-1 text-left">
                              <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border transition-colors ${
                                new Date(node.dueDate) < new Date() 
                                  ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' 
                                  : new Date(node.dueDate).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000 
                                    ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' 
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
                      
                      {node.assignedTo && getContributorAvatar(node.assignedTo)}
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

  // Consistent contributor color function (matches TimelineView)
  const getContributorColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500'
    ];
    
    // Generate consistent color based on name (same as TimelineView)
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Helper function to get contributor avatar
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
                <tr key={node.id} className="hover:bg-gray-750 transition-colors cursor-pointer group dynamic-table-row">
                  <td className="pl-6 pr-4 py-12 dynamic-table-cell">
                    <div className="space-y-3">
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
                      {/* Old tag implementation - removed
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
                      )} */}
                    </div>
                  </td>
                  <td className="pl-2 pr-3 py-10 dynamic-table-cell">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getNodeTypeColor(node.type)} shadow-sm`}>
                      {formatLabel(node.type)}
                    </span>
                  </td>
                  <td className="pl-3 pr-3 py-10 dynamic-table-cell">
                    <div className="flex items-center whitespace-nowrap">
                      <div className={`mr-2 ${
                        node.status === 'PROPOSED' ? 'text-cyan-400' :
                        node.status === 'PLANNED' ? 'text-purple-400' :
                        node.status === 'IN_PROGRESS' ? 'text-yellow-400' :
                        node.status === 'COMPLETED' ? 'text-green-400' :
                        node.status === 'BLOCKED' ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        {node.status === 'PROPOSED' && <ClipboardList className="h-4 w-4" />}
                        {node.status === 'PLANNED' && <Calendar className="h-4 w-4" />}
                        {node.status === 'IN_PROGRESS' && <Clock className="h-4 w-4" />}
                        {node.status === 'COMPLETED' && <CheckCircle className="h-4 w-4" />}
                        {node.status === 'BLOCKED' && <AlertCircle className="h-4 w-4" />}
                      </div>
                      <span className={`text-sm font-medium ${getStatusColor(node.status)}`}>
                        {formatLabel(node.status)}
                      </span>
                    </div>
                  </td>
                  <td className="pl-3 pr-6 py-10 dynamic-table-cell">
                    {node.assignedTo ? (
                      getContributorAvatar(node.assignedTo)
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
                      <div className="w-4 h-16 bg-gray-600 rounded overflow-hidden flex flex-col justify-end relative">
                        <div 
                          className={`w-full transition-all duration-300 ${
                            getNodePriority(node) >= 0.8 ? 'bg-red-500' :
                            getNodePriority(node) >= 0.6 ? 'bg-orange-500' :
                            getNodePriority(node) >= 0.4 ? 'bg-yellow-500' :
                            getNodePriority(node) >= 0.2 ? 'bg-blue-500' :
                            'bg-green-500'
                          }`}
                          style={{ 
                            height: `${Math.max(getNodePriority(node) * 100, 5)}%`
                          }}
                        ></div>
                      </div>
                      <span 
                        className={`absolute text-xs font-bold left-6 ml-1 ${
                          getNodePriority(node) >= 0.8 ? 'text-red-500' :
                          getNodePriority(node) >= 0.6 ? 'text-orange-500' :
                          getNodePriority(node) >= 0.4 ? 'text-yellow-500' :
                          getNodePriority(node) >= 0.2 ? 'text-blue-500' :
                          'text-green-500'
                        }`}
                        style={{ 
                          bottom: `${Math.max(getNodePriority(node) * 100, 5)}%`,
                          transform: 'translateY(50%)'
                        }}
                      >
                        {Math.round(getNodePriority(node) * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="pl-6 pr-6 py-10 dynamic-table-cell">
                    {node.dueDate ? (
                      <div className="space-y-1">
                        <div className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          new Date(node.dueDate) < new Date() 
                            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' 
                            : new Date(node.dueDate).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000 
                              ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' 
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

  // Pie Chart Component
  const PieChart = ({ data, title }: { data: Array<{label: string, value: number, color: string}>, title: string }) => {
    const filteredData = data.filter(item => item.value > 0);
    const total = filteredData.reduce((sum, item) => sum + item.value, 0);
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

    if (total === 0) {
      return (
        <div className="bg-gray-800 rounded-lg p-4 pl-2 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 text-center">{title}</h3>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="text-gray-400 text-sm mb-2">No data to display</div>
              <div className="text-gray-500 text-xs">Try adjusting your filters</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gray-800 rounded-lg p-4 pl-2 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 text-center">{title}</h3>
        <div className="flex items-center space-x-0">
          <svg width="220" height="220" viewBox="0 0 100 100" className="flex-shrink-0">
            {filteredData.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const path = createPath(percentage, cumulativePercentage);
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
            {filteredData.map((item, index) => (
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
    const filteredData = data.filter(item => item.value > 0);
    const maxValue = filteredData.length > 0 ? Math.max(...filteredData.map(item => item.value)) : 0;
    if (filteredData.length === 0) {
      return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="text-gray-400 text-sm mb-2">No data to display</div>
              <div className="text-gray-500 text-xs">Try adjusting your filters</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="space-y-3">
          {filteredData.map((item, index) => (
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
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.inProgress}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">In Progress</div>
              <div className="text-2xl font-bold text-yellow-400">{stats.inProgress}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.blocked}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">Blocked</div>
              <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.planned}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">Planned</div>
              <div className="text-2xl font-bold text-purple-400">{stats.planned}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.proposed}</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-300">Proposed</div>
              <div className="text-2xl font-bold text-blue-400">{stats.proposed}</div>
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
            { label: 'Proposed', value: stats.proposed, color: '#3b82f6' },
            { label: 'Planned', value: stats.planned, color: '#a855f7' },
            { label: 'In Progress', value: stats.inProgress, color: '#eab308' },
            { label: 'Completed', value: stats.completed, color: '#10b981' },
            { label: 'Blocked', value: stats.blocked, color: '#dc2626' }
          ]}
        />

        {/* Task Types Bar Chart */}
        <BarChart 
          title="Task Types"
          data={Object.entries(stats.typeStats).map(([type, count]) => ({
            label: formatLabel(type),
            value: count,
            color: type === 'EPIC' ? '#3b82f6' : 
                   type === 'FEATURE' ? '#3b82f6' :
                   type === 'TASK' ? '#10b981' :
                   type === 'BUG' ? '#dc2626' :
                   type === 'MILESTONE' ? '#f59e0b' : '#6b7280'
          }))}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Recent Tasks</h3>
          <div className="text-xs text-gray-400 bg-gray-700/50 px-3 py-1 rounded-full">
            {filteredNodes.length} items
          </div>
        </div>
        <div className="space-y-3">
          {[...filteredNodes]
            .sort((a, b) => {
              const dateA = new Date(a.updatedAt || a.createdAt).getTime();
              const dateB = new Date(b.updatedAt || b.createdAt).getTime();
              return dateB - dateA; // Most recent first
            })
            .slice(0, showAllRecentTasks ? filteredNodes.length : 5)
            .map((node, index) => (
            <div key={node.id} className="group flex items-center space-x-4 p-4 hover:bg-gray-750/70 rounded-xl transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-600/30">
              {/* Type Icon */}
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                  node.type === 'EPIC' ? 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' :
                  node.type === 'FEATURE' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' :
                  node.type === 'TASK' ? 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                  node.type === 'BUG' ? 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                  node.type === 'MILESTONE' ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' :
                  'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                }`}>
                  {node.type === 'EPIC' && <Layers className="h-4 w-4" />}
                  {node.type === 'FEATURE' && <Sparkles className="h-4 w-4" />}
                  {node.type === 'TASK' && <ListTodo className="h-4 w-4" />}
                  {node.type === 'BUG' && <AlertTriangle className="h-4 w-4" />}
                  {node.type === 'MILESTONE' && <Trophy className="h-4 w-4" />}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                    node.type === 'EPIC' ? 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' :
                    node.type === 'FEATURE' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' :
                    node.type === 'TASK' ? 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                    node.type === 'BUG' ? 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                    node.type === 'MILESTONE' ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' :
                    'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                  }`}>
                    {node.type === 'EPIC' && <Layers className="h-3 w-3" />}
                    {node.type === 'FEATURE' && <Sparkles className="h-3 w-3" />}
                    {node.type === 'TASK' && <ListTodo className="h-3 w-3" />}
                    {node.type === 'BUG' && <AlertTriangle className="h-3 w-3" />}
                    {node.type === 'MILESTONE' && <Trophy className="h-3 w-3" />}
                    <span>{formatLabel(node.type)}</span>
                  </span>
                </div>
                <div className="text-sm font-semibold text-white mb-1 truncate group-hover:text-blue-300 transition-colors">
                  {node.title}
                </div>
                {/* Tags */}
                <TagDisplay tags={node.tags} className="mb-2" compact />
                <div className="flex items-center justify-between">
                  <div className={`text-xs flex items-center space-x-2 ${
                    node.status === 'PROPOSED' ? 'text-cyan-400' :
                    node.status === 'PLANNED' ? 'text-purple-400' :
                    node.status === 'IN_PROGRESS' ? 'text-yellow-400' :
                    node.status === 'COMPLETED' ? 'text-green-400' :
                    node.status === 'BLOCKED' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {node.status === 'PROPOSED' && <ClipboardList className="h-3 w-3" />}
                    {node.status === 'PLANNED' && <Calendar className="h-3 w-3" />}
                    {node.status === 'IN_PROGRESS' && <Clock className="h-3 w-3" />}
                    {node.status === 'COMPLETED' && <CheckCircle className="h-3 w-3" />}
                    {node.status === 'BLOCKED' && <AlertCircle className="h-3 w-3" />}
                    <span className="font-medium">{formatLabel(node.status)}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const now = new Date();
                      const lastActivity = node.updatedAt ? new Date(node.updatedAt) : 
                                          node.createdAt ? new Date(node.createdAt) : 
                                          new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
                      const diffMs = now.getTime() - lastActivity.getTime();
                      const diffMins = Math.floor(diffMs / (1000 * 60));
                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                      const diffWeeks = Math.floor(diffDays / 7);
                      const diffMonths = Math.floor(diffDays / 30);
                      
                      if (diffMins < 1) return 'just now';
                      if (diffMins < 60) return `${diffMins}m ago`;
                      if (diffHours < 24) return `${diffHours}h ago`;
                      if (diffDays < 7) return `${diffDays}d ago`;
                      if (diffWeeks < 4) return `${diffWeeks}w ago`;
                      return `${diffMonths}mo ago`;
                    })()}
                  </div>
                </div>
              </div>

              {/* Index */}
              <div className="flex-shrink-0">
                <div className="text-xs text-gray-500 font-medium bg-gray-700/50 px-2 py-1 rounded-md min-w-[1.5rem] text-center">
                  #{index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {filteredNodes.length > 5 && (
          <div className="mt-6 pt-4 border-t border-gray-700/50">
            <button 
              onClick={() => setShowAllRecentTasks(!showAllRecentTasks)}
              className="w-full text-sm font-medium flex items-center justify-center py-3 rounded-lg hover:bg-gray-700/50 transition-all duration-200"
            >
              <span className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md transition-all duration-200 flex items-center space-x-2">
                <span>
                  {showAllRecentTasks 
                    ? 'Show less tasks' 
                    : `View ${filteredNodes.length - 5} more tasks`}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAllRecentTasks ? 'rotate-180' : ''}`} />
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );


  const currentViewOption = viewOptions.find(option => option.id === currentView)!;

  // Show loading state while fetching data
  if (loading && !data) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading work items...</p>
        </div>
      </div>
    );
  }

  // Show error state if data fetch failed
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error loading work items</p>
          <p className="text-gray-400 text-sm mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
          <div className="space-y-4">
            {/* Primary Search Row */}
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search nodes"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-400"
                />
              </div>
              
              {/* Quick Clear Button */}
              {(searchTerm || typeFilter !== 'All Types' || statusFilter !== 'All Statuses' || contributorFilter !== 'All Contributors' || priorityFilter !== 'All Priorities') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('All Types');
                    setStatusFilter('All Statuses');
                    setContributorFilter('All Contributors');
                    setPriorityFilter('All Priorities');
                  }}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Advanced Filters Row */}
            <div className="flex items-center space-x-8 flex-wrap gap-y-2">
              <div className="relative" ref={typeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className="flex items-center justify-between px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent hover:border-gray-500 transition-all duration-200 min-w-[160px]"
                >
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const selectedType = typeOptions.find(option => option.value === typeFilter);
                      return selectedType ? (
                        <>
                          {selectedType.icon && (
                            <div className={`${selectedType.color}`}>
                              {selectedType.icon}
                            </div>
                          )}
                          <span className="font-medium">{selectedType.label}</span>
                        </>
                      ) : (
                        <span className="font-medium">All Types</span>
                      );
                    })()}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isTypeDropdownOpen ? 'rotate-180 text-green-500' : ''}`} />
                </button>

                {isTypeDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      {typeOptions.map((option, index) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTypeFilter(option.value);
                            setIsTypeDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-green-900/20 transition-all duration-200 rounded-lg group ${
                            typeFilter === option.value 
                              ? 'bg-green-900/30 ring-1 ring-green-500/30' 
                              : 'hover:shadow-sm'
                          } ${index !== 0 ? 'mt-1' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {option.icon && (
                                <div className={`${option.color}`}>
                                  {option.icon}
                                </div>
                              )}
                              <span className={`font-medium text-sm ${
                                typeFilter === option.value 
                                  ? 'text-green-300' 
                                  : 'text-white'
                              }`}>
                                {option.label}
                              </span>
                            </div>
                            {typeFilter === option.value && (
                              <div className="w-4 h-4 bg-green-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                                ✓
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className="flex items-center justify-between px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent hover:border-gray-500 transition-all duration-200 min-w-[150px]"
                >
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const selectedStatus = statusOptions.find(option => option.value === statusFilter);
                      return selectedStatus ? (
                        <>
                          {selectedStatus.icon && (
                            <div className={`${selectedStatus.color}`}>
                              {selectedStatus.icon}
                            </div>
                          )}
                          <span className="font-medium">{selectedStatus.label}</span>
                        </>
                      ) : (
                        <span className="font-medium">All Statuses</span>
                      );
                    })()}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isStatusDropdownOpen ? 'rotate-180 text-green-500' : ''}`} />
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      {statusOptions.map((option, index) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setStatusFilter(option.value);
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-green-900/20 transition-all duration-200 rounded-lg group ${
                            statusFilter === option.value 
                              ? 'bg-green-900/30 ring-1 ring-green-500/30' 
                              : 'hover:shadow-sm'
                          } ${index !== 0 ? 'mt-1' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {option.icon && (
                                <div className={`${option.color}`}>
                                  {option.icon}
                                </div>
                              )}
                              <span className={`font-medium text-sm ${
                                statusFilter === option.value 
                                  ? 'text-green-300' 
                                  : 'text-white'
                              }`}>
                                {option.label}
                              </span>
                            </div>
                            {statusFilter === option.value && (
                              <div className="w-4 h-4 bg-green-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                                ✓
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={contributorDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsContributorDropdownOpen(!isContributorDropdownOpen)}
                  className="flex items-center justify-between px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent hover:border-gray-500 transition-all duration-200 min-w-[180px]"
                >
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const selectedContributor = contributorOptions.find(option => option.value === contributorFilter);
                      return selectedContributor ? (
                        <span className={`font-medium ${'color' in selectedContributor ? selectedContributor.color : 'text-white'}`}>{selectedContributor.label}</span>
                      ) : (
                        <span className="font-medium">All Contributors</span>
                      );
                    })()}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isContributorDropdownOpen ? 'rotate-180 text-green-500' : ''}`} />
                </button>

                {isContributorDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      {contributorOptions.map((option, index) => (
                        <button
                          key={option.value || `option-${index}`}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContributorFilter(option.value || '');
                            setIsContributorDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-green-900/20 transition-all duration-200 rounded-lg group ${
                            contributorFilter === option.value 
                              ? 'bg-green-900/30 ring-1 ring-green-500/30' 
                              : 'hover:shadow-sm'
                          } ${index !== 0 ? 'mt-1' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium text-sm ${
                              contributorFilter === option.value 
                                ? 'text-green-300' 
                                : ('color' in option ? option.color : 'text-white')
                            }`}>
                              {option.label}
                            </span>
                            {contributorFilter === option.value && (
                              <div className="w-4 h-4 bg-green-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                                ✓
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={priorityDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsPriorityDropdownOpen(!isPriorityDropdownOpen)}
                  className="flex items-center justify-between px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent hover:border-gray-500 transition-all duration-200 min-w-[140px]"
                >
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const selectedPriority = priorityOptions.find(option => option.value === priorityFilter);
                      return selectedPriority ? (
                        <>
                          {selectedPriority.icon && (
                            <div className={`${selectedPriority.color}`}>
                              {selectedPriority.icon}
                            </div>
                          )}
                          <span className="font-medium">{selectedPriority.label}</span>
                        </>
                      ) : (
                        <span className="font-medium">All Priorities</span>
                      );
                    })()}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isPriorityDropdownOpen ? 'rotate-180 text-green-500' : ''}`} />
                </button>

                {isPriorityDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      {priorityOptions.map((option, index) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setPriorityFilter(option.value);
                            setIsPriorityDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-green-900/20 transition-all duration-200 rounded-lg group ${
                            priorityFilter === option.value 
                              ? 'bg-green-900/30 ring-1 ring-green-500/30' 
                              : 'hover:shadow-sm'
                          } ${index !== 0 ? 'mt-1' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {option.icon && (
                                <div className={`${option.color}`}>
                                  {option.icon}
                                </div>
                              )}
                              <span className={`font-medium text-sm ${
                                priorityFilter === option.value 
                                  ? 'text-green-300' 
                                  : 'text-white'
                              }`}>
                                {option.label}
                              </span>
                            </div>
                            {priorityFilter === option.value && (
                              <div className="w-4 h-4 bg-green-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                                ✓
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

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
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
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
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-cyan-400 text-lg">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-gray-300">Proposed</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-cyan-400">{stats.proposed}</div>
                  <div className="text-xs text-gray-500">{stats.total > 0 ? Math.round((stats.proposed / stats.total) * 100) : 0}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-purple-400 text-lg">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-gray-300">Planned</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-400">{stats.planned}</div>
                  <div className="text-xs text-gray-500">{stats.total > 0 ? Math.round((stats.planned / stats.total) * 100) : 0}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-yellow-400 text-lg">
                      <Clock className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-gray-300">In Progress</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-400">{stats.inProgress}</div>
                  <div className="text-xs text-gray-500">{stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-red-400 text-lg">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-gray-300">Blocked</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-400">{stats.blocked}</div>
                  <div className="text-xs text-gray-500">{stats.total > 0 ? Math.round((stats.blocked / stats.total) * 100) : 0}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-green-400 text-lg">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-gray-300">Completed</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-400">{stats.completed}</div>
                  <div className="text-xs text-gray-500">{stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Node Types */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Node Types</h3>
            <div className="space-y-3">
              {Object.entries(stats.typeStats).length > 0 ? (
                Object.entries(stats.typeStats).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(type)}`}>
                        {formatLabel(type)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">{count}</span>
                      <div className="w-16 h-2 bg-gray-700 rounded-full">
                        <div 
                          className="h-2 bg-green-500 rounded-full" 
                          style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <div className="text-gray-400 text-sm">No items match current filters</div>
                  <button 
                    onClick={() => {
                      setSearchTerm('');
                      setTypeFilter('All Types');
                      setStatusFilter('All Statuses');
                      setContributorFilter('All Contributors');
                      setPriorityFilter('All Priorities');
                      }}
                    className="text-green-400 text-sm hover:text-green-300 mt-2"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Priority Distribution */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 ml-2">Priority Distribution</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Flame className="h-6 w-6 text-red-500" />
                    <span className="text-gray-300">Critical</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.critical}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-red-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.priorityStats.critical / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-6 w-6 text-orange-500" />
                    <span className="text-gray-300">High</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.high}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-orange-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.priorityStats.high / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Triangle className="h-6 w-6 text-yellow-500" />
                    <span className="text-gray-300">Moderate</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.moderate}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-yellow-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.priorityStats.moderate / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Circle className="h-6 w-6 text-blue-500" />
                    <span className="text-gray-300">Low</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.low}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-blue-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.priorityStats.low / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <ArrowDown className="h-6 w-6 text-green-500" />
                    <span className="text-gray-300">Minimal</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.priorityStats.minimal}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-green-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.priorityStats.minimal / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Node Modal */}
      {showEditModal && selectedNode && (
        <EditNodeModal
          isOpen={showEditModal}
          onClose={handleCloseModals}
          node={transformNodeForEdit(selectedNode)}
        />
      )}

      {/* Delete Node Modal */}
      {showDeleteModal && selectedNode && (
        <DeleteNodeModal
          isOpen={showDeleteModal}
          onClose={handleCloseModals}
          nodeId={selectedNode.id}
          nodeTitle={selectedNode.title}
          nodeType={selectedNode.type}
        />
      )}
    </div>
  );
}