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
  Sigma,
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
  ClipboardList,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { TaskDistributionRadar } from './TaskDistributionRadar';
import { PriorityDistributionRadar } from './PriorityDistributionRadar';
import { NodeDistributionRadar } from './NodeDistributionRadar';
import { GET_WORK_ITEMS } from '../lib/queries';
import { EditNodeModal } from './EditNodeModal';
import { DeleteNodeModal } from './DeleteNodeModal';
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
      where: currentGraph ? {
        graph: {
          id: currentGraph.id
        }
      } : undefined
    },
    fetchPolicy: 'cache-and-network',  // Use cache first, then update from network
    pollInterval: 5000,  // Poll every 5 seconds to catch external changes
    errorPolicy: 'all'
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

  // Update selectedNode when workItems data changes and modal is open
  useEffect(() => {
    if (showEditModal && selectedNode) {
      const updatedNode = workItems.find(item => item.id === selectedNode.id);
      if (updatedNode) {
        setSelectedNode(updatedNode);
      }
    }
  }, [workItems, showEditModal, selectedNode?.id]);

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
    { value: 'BUG', label: 'Bug', icon: <AlertTriangle className="h-6 w-6" />, color: 'text-red-500' },
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
    { value: 'BLOCKED', label: 'Blocked', icon: <AlertCircle className="h-6 w-6" />, color: 'text-red-500' }
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
    assignedTo: node.assignedTo?.name || '',
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
      .map(node => node.assignedTo?.name)
      .filter(contributor => contributor && contributor.trim().length > 0)
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
        node.assignedTo?.name?.toLowerCase().includes(searchLower) ||
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
        filtered = filtered.filter(node => node.assignedTo?.name === contributorFilter);
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
    return node.priorityExec || 0;
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
      case 'BLOCKED': return 'text-red-500';
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
          className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-[1.02] hover:-translate-y-1 group"
        >
          <div className="flex items-start justify-between mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${getNodeTypeColor(node.type)}`}>
              {node.type === 'EPIC' && <Layers className="w-3 h-3" />}
              {node.type === 'MILESTONE' && <Trophy className="w-3 h-3" />}
              {node.type === 'OUTCOME' && <Target className="w-3 h-3" />}
              {node.type === 'FEATURE' && <Sparkles className="w-3 h-3" />}
              {node.type === 'TASK' && <ListTodo className="w-3 h-3" />}
              {node.type === 'BUG' && <AlertTriangle className="w-3 h-3" />}
              {node.type === 'IDEA' && <Lightbulb className="w-3 h-3" />}
              {node.type === 'RESEARCH' && <Microscope className="w-3 h-3" />}
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
        bgColor: 'bg-gray-700',
        textColor: 'text-cyan-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-cyan-400'
      },
      'PLANNED': { 
        label: 'Planned', 
        icon: <Calendar className="h-4 w-4 text-purple-400" />, 
        color: 'bg-purple-500',
        bgColor: 'bg-gray-700',
        textColor: 'text-purple-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-purple-400'
      },
      'IN_PROGRESS': { 
        label: 'In Progress', 
        icon: <Clock className="h-4 w-4 text-yellow-400" />, 
        color: 'bg-yellow-500',
        bgColor: 'bg-gray-700',
        textColor: 'text-yellow-400',
        borderColor: 'border-gray-600',
        dotColor: 'bg-yellow-400'
      },
      'BLOCKED': { 
        label: 'Blocked', 
        icon: <AlertCircle className="h-4 w-4 text-red-600" />, 
        color: 'bg-red-500',
        bgColor: 'bg-gray-700',
        textColor: 'text-red-600',
        borderColor: 'border-gray-600',
        dotColor: 'bg-red-400'
      },
      'COMPLETED': { 
        label: 'Completed', 
        icon: <CheckCircle className="h-4 w-4 text-green-400" />, 
        color: 'bg-green-500',
        bgColor: 'bg-gray-700',
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
                      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-[1.02] hover:-translate-y-1 group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getNodeTypeColor(node.type)}`}>
                          {node.type === 'EPIC' && <Layers className="w-3 h-3" />}
                          {node.type === 'MILESTONE' && <Trophy className="w-3 h-3" />}
                          {node.type === 'OUTCOME' && <Target className="w-3 h-3" />}
                          {node.type === 'FEATURE' && <Sparkles className="w-3 h-3" />}
                          {node.type === 'TASK' && <ListTodo className="w-3 h-3" />}
                          {node.type === 'BUG' && <AlertTriangle className="w-3 h-3" />}
                          {node.type === 'IDEA' && <Lightbulb className="w-3 h-3" />}
                          {node.type === 'RESEARCH' && <Microscope className="w-3 h-3" />}
                          <span className="ml-1">{formatLabel(node.type)}</span>
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
                          <AnimatedPriority
                            value={getNodePriority(node)}
                            className="text-xs font-bold"
                            renderBar={(animatedValue, animatedColor) => (
                              <div className="w-4 h-12 bg-gray-600 rounded overflow-hidden flex flex-col justify-end relative">
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
                      
                      {/* Contributor */}
                      <div className="mt-3 flex items-center">
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
                <tr key={node.id} className="hover:bg-gray-700/50 transition-colors cursor-pointer group dynamic-table-row">
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
                      {node.type === 'EPIC' && <Layers className="w-3 h-3" />}
                      {node.type === 'MILESTONE' && <Trophy className="w-3 h-3" />}
                      {node.type === 'OUTCOME' && <Target className="w-3 h-3" />}
                      {node.type === 'FEATURE' && <Sparkles className="w-3 h-3" />}
                      {node.type === 'TASK' && <ListTodo className="w-3 h-3" />}
                      {node.type === 'BUG' && <AlertTriangle className="w-3 h-3" />}
                      {node.type === 'IDEA' && <Lightbulb className="w-3 h-3" />}
                      {node.type === 'RESEARCH' && <Microscope className="w-3 h-3" />}
                      <span className="ml-1">{formatLabel(node.type)}</span>
                    </span>
                  </td>
                  <td className="pl-3 pr-3 py-10 dynamic-table-cell">
                    <div className="flex items-center whitespace-nowrap">
                      <div className={`mr-2 ${
                        node.status === 'PROPOSED' ? 'text-cyan-400' :
                        node.status === 'PLANNED' ? 'text-purple-400' :
                        node.status === 'IN_PROGRESS' ? 'text-yellow-400' :
                        node.status === 'COMPLETED' ? 'text-green-400' :
                        node.status === 'BLOCKED' ? 'text-red-500' :
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
    const [zoomLevel, setZoomLevel] = useState(1);
    const filteredData = data.filter(item => item.value > 0);
    const total = filteredData.reduce((sum, item) => sum + item.value, 0);
    let cumulativePercentage = 0;
    
    const handleZoomIn = () => {
      setZoomLevel(prev => Math.min(prev + 0.1, 2));
    };
    
    const handleZoomOut = () => {
      setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
    };

    const handleResetLayout = () => {
      setZoomLevel(1);
    };

    

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
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        </div>
        <div className="relative">
          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
            <button
              onClick={handleZoomIn}
              className="p-2 text-white rounded shadow-lg transition-all duration-200"
              style={{ backgroundColor: '#228B22', boxShadow: '0 4px 6px rgba(34, 139, 34, 0.25)' }}
              title="Zoom In"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#32CD32'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#228B22'}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 text-white rounded shadow-lg transition-all duration-200"
              style={{ backgroundColor: '#DC143C', boxShadow: '0 4px 6px rgba(220, 20, 60, 0.25)' }}
              title="Zoom Out"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FF6347'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC143C'}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={handleResetLayout}
              className="p-2 text-white rounded shadow-lg transition-all duration-200"
              style={{ backgroundColor: '#4682B4', boxShadow: '0 4px 6px rgba(70, 130, 180, 0.25)' }}
              title="Reset Zoom"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5A9BD4'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4682B4'}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        
          <div className="flex justify-center">
            <div 
              style={{ 
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              <svg 
                width="350" 
                height="350" 
                viewBox="0 0 100 100"
              >
              {filteredData.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const path = createPath(percentage, cumulativePercentage);
              
              // Use pre-calculated dynamic positions
              // const position = labelPositions[index];
              
              cumulativePercentage += percentage;
              
              return (
                <g key={index}>
                  <path
                    d={path}
                    fill={item.color}
                    stroke="#374151"
                    strokeWidth="0.5"
                    className="hover:opacity-80 transition-opacity"
                  />
                </g>
              );
            })}
              </svg>
            </div>
          </div>
        </div>
        {/* Legend section */}
        <div className="mt-4">
          {(() => {
            // Determine chart type and set appropriate grid
            const isPriorityChart = filteredData.some(item => ['Critical', 'High', 'Moderate', 'Low', 'Minimal'].includes(item.label));
            const isStatusChart = filteredData.some(item => ['Proposed', 'Planned', 'In Progress', 'Completed', 'Blocked'].includes(item.label));
            const gridCols = (isPriorityChart || isStatusChart) ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2";
            
            return (
              <div className={gridCols}>
                {filteredData.map((item, index) => {
                  const percentage = ((item.value / total) * 100).toFixed(1);
                  const getIcon = (label: string) => {
                switch(label) {
                  case 'Proposed': return <ClipboardList className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Planned': return <Calendar className="h-5 w-5" style={{ color: item.color }} />;
                  case 'In Progress': return <Clock className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Completed': return <CheckCircle className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Blocked': return <AlertCircle className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Critical': return <Flame className="h-5 w-5" style={{ color: item.color }} />;
                  case 'High': return <Zap className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Moderate': return <Triangle className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Low': return <Circle className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Minimal': return <ArrowDown className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Epic': return <Layers className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Milestone': return <Trophy className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Outcome': return <Target className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Feature': return <Sparkles className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Task': return <ListTodo className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Bug': return <AlertTriangle className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Idea': return <Lightbulb className="h-5 w-5" style={{ color: item.color }} />;
                  case 'Research': return <Microscope className="h-5 w-5" style={{ color: item.color }} />;
                  default: return <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>;
                }
              };
              
              return (
                <div key={index} className="bg-gray-700 hover:bg-gray-650 rounded p-2 transition-all duration-200 hover:scale-105 hover:shadow-lg border border-gray-600 hover:border-gray-500">
                  <div className="flex items-center mb-1">
                    {getIcon(item.label)}
                    <span className="text-gray-200 text-sm ml-2">{item.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">{item.value}</span>
                    <span className="text-sm text-gray-400 ml-1">({percentage}%)</span>
                  </div>
                </div>
                  );
                })}
              </div>
            );
          })()}
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
              <Sigma className="h-10 w-10 text-lime-500" />
            </div>
            <div className="ml-4">
              <div className="text-lg font-bold text-gray-300">Total Tasks</div>
              <div className="text-4xl font-bold text-lime-400">{stats.total}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Completed</div>
              <div className="text-3xl font-bold text-green-400">{stats.completed}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">In Progress</div>
              <div className="text-3xl font-bold text-yellow-400">{stats.inProgress}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Blocked</div>
              <div className="text-3xl font-bold text-red-500">{stats.blocked}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Planned</div>
              <div className="text-3xl font-bold text-purple-400">{stats.planned}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClipboardList className="h-8 w-8 text-cyan-500" />
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Proposed</div>
              <div className="text-3xl font-bold text-cyan-400">{stats.proposed}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="space-y-8 relative">
        {/* Dashboard Header */}
        <div className="text-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent rounded-lg"></div>
          <div className="relative py-4">
            <div className="flex items-center justify-center space-x-3">
              <BarChart3 className="h-8 w-8" style={{ color: 'gold' }} />
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'gold' }}>Analytics Dashboard</h2>
            </div>
            <p className="text-sm font-medium" style={{ color: 'mediumspringgreen' }}>Project metrics and distributions</p>
          </div>
        </div>

        {/* Pie Charts Container */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-600 rounded-lg p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-gray-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <svg className="h-6 w-6" viewBox="0 0 90 90" style={{ fill: '#00FFFF' }}>
                <path d="M 41.808 45.075 L 56.531 1.497 C 52.85 0.524 48.987 0 45 0 C 20.147 0 0 20.147 0 45 c 0 24.853 20.147 45 45 45 c 4.727 0 9.283 -0.733 13.563 -2.085 L 41.808 45.075 z" fill="#00FFFF" fillOpacity="0.7"/>
                <path d="M 86.934 28.656 c -4.452 -11.41 -13.425 -20.558 -24.72 -25.239 L 49.59 40.788 L 86.934 28.656 z" fill="#00FFFF" fillOpacity="0.9"/>
                <path d="M 49.104 47.255 L 64.15 85.725 C 79.424 78.53 90 63.003 90 45 c 0 -3.659 -0.442 -7.214 -1.267 -10.62 L 49.104 47.255 z" fill="#00FFFF" fillOpacity="1"/>
              </svg>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#00FFFF' }}>Distribution Overview</h3>
                <p className="text-xs" style={{ color: '#FF6B35' }}>Statistical breakdown by status, priority, and type</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50"></div>
              <span className="text-xs text-gray-300 font-medium">Pie Charts</span>
            </div>
          </div>
          
          <div className="space-y-8">
            {/* Status Distribution */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Status Distribution</h4>
              <div className="w-full">
                <PieChart 
                  title=""
                  data={[
                    { label: 'Proposed', value: stats.proposed, color: '#22d3ee' },
                    { label: 'Planned', value: stats.planned, color: '#c084fc' },
                    { label: 'In Progress', value: stats.inProgress, color: '#facc15' },
                    { label: 'Completed', value: stats.completed, color: '#4ade80' },
                    { label: 'Blocked', value: stats.blocked, color: '#ef4444' }
                  ]}
                />
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Priority Distribution</h4>
              <div className="w-full">
                <PieChart 
                  title=""
                  data={[
                    { label: 'Critical', value: stats.priorityStats.critical, color: '#ef4444' },
                    { label: 'High', value: stats.priorityStats.high, color: '#f97316' },
                    { label: 'Moderate', value: stats.priorityStats.moderate, color: '#eab308' },
                    { label: 'Low', value: stats.priorityStats.low, color: '#3b82f6' },
                    { label: 'Minimal', value: stats.priorityStats.minimal, color: '#22c55e' }
                  ]}
                />
              </div>
            </div>

            {/* Node Distribution */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Node Distribution</h4>
              <div className="w-full">
                <PieChart 
                  title=""
                  data={Object.entries(stats.typeStats)
                    .filter(([, count]) => count > 0)
                    .map(([type, count]) => ({
                      label: formatLabel(type),
                      value: count,
                      color: type === 'EPIC' ? '#c084fc' : 
                             type === 'MILESTONE' ? '#fb923c' :
                             type === 'OUTCOME' ? '#818cf8' :
                             type === 'FEATURE' ? '#38bdf8' :
                             type === 'TASK' ? '#4ade80' :
                             type === 'BUG' ? '#ef4444' :
                             type === 'IDEA' ? '#fde047' :
                             type === 'RESEARCH' ? '#2dd4bf' : '#6b7280'
                    }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Radar Charts Container */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-600 rounded-lg p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-gray-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="hotpink">
                <path d="M12 2l2.5 7h7l-5.5 4.5 2 6.5-6-4.5-6 4.5 2-6.5L2 9h7L12 2z" fillOpacity="0.3"/>
                <circle cx="12" cy="12" r="8" fill="none" stroke="hotpink" strokeWidth="1" strokeDasharray="2,2"/>
                <circle cx="12" cy="12" r="5" fill="none" stroke="hotpink" strokeWidth="1" strokeDasharray="1,1"/>
                <circle cx="12" cy="12" r="2" fill="none" stroke="hotpink" strokeWidth="1"/>
                <line x1="12" y1="4" x2="12" y2="20" stroke="hotpink" strokeWidth="0.5"/>
                <line x1="4" y1="12" x2="20" y2="12" stroke="hotpink" strokeWidth="0.5"/>
                <line x1="6.34" y1="6.34" x2="17.66" y2="17.66" stroke="hotpink" strokeWidth="0.5"/>
                <line x1="17.66" y1="6.34" x2="6.34" y2="17.66" stroke="hotpink" strokeWidth="0.5"/>
              </svg>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'hotpink' }}>Radar Analysis</h3>
                <p className="text-xs" style={{ color: 'goldenrod' }}>Multi-dimensional data patterns</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
              <span className="text-xs text-gray-300 font-medium">Radar Charts</span>
            </div>
          </div>

          <div className="space-y-8">
            {/* Task Category Distribution Radar */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Task Category Distribution</h4>
              <div className="w-full">
                <TaskDistributionRadar showLegend={false} />
              </div>
            </div>

            {/* Priority Category Distribution Radar */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Priority Category Distribution</h4>
              <div className="w-full">
                <PriorityDistributionRadar showLegend={false} />
              </div>
            </div>

            {/* Node Category Distribution Radar */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Node Category Distribution</h4>
              <div className="w-full">
                <NodeDistributionRadar showLegend={false} />
              </div>
            </div>
          </div>
        </div>
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
      <div className={`${
        currentView === 'table' ? 'w-96' : // Wider for table view (384px)
        currentView === 'dashboard' ? 'w-72' : // Narrower for dashboard (288px)
        'w-80' // Default for cards/kanban (320px)
      } bg-gray-800 border-l border-gray-700 p-6 transition-all duration-300 ease-in-out`}>
        <div className="space-y-6">
          {/* Project Overview */}
          <div className="bg-gray-800 rounded-lg p-10 border border-gray-600">
            <div className="flex items-center space-x-3 mb-7">
              {/* Dynamic Health Icon - Energy Efficiency */}
              <div className="relative group cursor-pointer">
                {/* Tooltip */}
                <div className={`absolute -top-14 left-1/2 transform -translate-x-1/2 px-3 py-2 rounded-lg text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap ${
                  stats.total > 0 
                    ? (stats.completed / stats.total) >= 0.9 ? 'bg-green-600' :
                      (stats.completed / stats.total) >= 0.7 ? 'bg-blue-600' :
                      (stats.completed / stats.total) >= 0.5 ? 'bg-purple-600' :
                      (stats.completed / stats.total) >= 0.3 ? 'bg-amber-600' :
                      'bg-rose-600'
                    : 'bg-gray-600'
                }`}>
                  {stats.total > 0 
                    ? `Project Health: ${Math.round((stats.completed / stats.total) * 100)}% - ${
                        (stats.completed / stats.total) >= 0.9 ? 'Outstanding 🌟' :
                        (stats.completed / stats.total) >= 0.7 ? 'Excellent ✨' :
                        (stats.completed / stats.total) >= 0.5 ? 'Good 👍' :
                        (stats.completed / stats.total) >= 0.3 ? 'Fair ⚠️' :
                        'Critical 🚨'
                      }`
                    : 'No data available'
                  }
                  {/* Tooltip arrow */}
                  <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 ${
                    stats.total > 0 
                      ? (stats.completed / stats.total) >= 0.9 ? 'bg-green-600' :
                        (stats.completed / stats.total) >= 0.7 ? 'bg-blue-600' :
                        (stats.completed / stats.total) >= 0.5 ? 'bg-purple-600' :
                        (stats.completed / stats.total) >= 0.3 ? 'bg-amber-600' :
                        'bg-rose-600'
                      : 'bg-gray-600'
                  }`} />
                </div>
                <svg className="h-12 w-12" viewBox="0 0 118.83 122.88">
                  <path 
                    d="M32.07,112.54H54.74A1.52,1.52,0,0,1,56.25,114v7.33a1.52,1.52,0,0,1-1.51,1.51H30.9a1.52,1.52,0,0,1-1.51-1.51V114a1.52,1.52,0,0,1,1.51-1.51h1.17ZM24.85,39.83a2.51,2.51,0,0,1-1.78-.69,2.55,2.55,0,0,1-.8-1.76v-.13a2.53,2.53,0,0,1,2.45-2.48c1.85-.08,3.7-.13,5.54-.19a2.53,2.53,0,1,1,.16,5.06l-5.57.19Zm69-7.86a2.54,2.54,0,0,1,2.66,2.28v.12A2.51,2.51,0,0,1,96,36.1a2.54,2.54,0,0,1-1.7.93l-5.51.58A2.54,2.54,0,0,1,86,35.34a2.47,2.47,0,0,1,.55-1.85,2.52,2.52,0,0,1,1.71-.93c1.85-.19,3.78-.45,5.63-.59Zm-11-22.06a2.54,2.54,0,0,1,3.5-.67h0a2.53,2.53,0,0,1,.68,3.5L84,17.36a2.52,2.52,0,0,1-3.52.69h0a2.48,2.48,0,0,1-1.06-1.6,2.5,2.5,0,0,1,.38-1.9c1.06-1.5,2-3.1,3.09-4.63ZM58.94,2.5a1,1,0,0,1,0-.17A2.54,2.54,0,0,1,61.51,0h.16A2.52,2.52,0,0,1,64,2.56a.28.28,0,0,1,0,.13L63.86,8.1a1,1,0,0,1,0,.17A2.54,2.54,0,0,1,61.3,10.6h-.16a2.52,2.52,0,0,1-1.64-.78A2.56,2.56,0,0,1,58.8,8a.53.53,0,0,1,0-.13l.13-5.41ZM31.48,11.94a2.53,2.53,0,0,1-.8-1.77,2.5,2.5,0,0,1,.67-1.81,2.58,2.58,0,0,1,1.77-.81,2.52,2.52,0,0,1,1.81.68L39,12a2.49,2.49,0,0,1,.8,1.76,2.52,2.52,0,0,1-.67,1.82,2.58,2.58,0,0,1-1.77.81,2.55,2.55,0,0,1-1.81-.68l-4.06-3.78ZM45.76,53.27a31.39,31.39,0,0,1-5.3-7.59,22.92,22.92,0,0,1-2.3-9.94A23.45,23.45,0,0,1,41,25.1L41,25h0a20.2,20.2,0,0,1,9.85-8.6A21.76,21.76,0,0,1,61.09,15a23.51,23.51,0,0,1,9.78,3.14,20.17,20.17,0,0,1,8.54,9.68A21.4,21.4,0,0,1,81,35.31a21.62,21.62,0,0,1-1.66,8.83,31.11,31.11,0,0,1-6,9.24l-3.4,5.43a1.39,1.39,0,0,0-.5,0l-5.1.76,6.09-21.22a.84.84,0,0,0-1.62-.46l-6.31,22-6.09.91L49.94,40.16l.1.07a1,1,0,0,0,1.3-.34l4.54-7.73,2.36,5.4a.95.95,0,0,0,1.75,0l2.12-5.36,2.46,6.48A1,1,0,1,0,66.35,38L63,29.26a1,1,0,0,0-.56-.6.94.94,0,0,0-1.23.53l-2.19,5.52-2.19-5a.92.92,0,0,0-.39-.44.94.94,0,0,0-1.29.34L49.7,38.93a1.76,1.76,0,0,0-.09.2l-.52-1.66a.84.84,0,0,0-1.61.51l7.24,23-4.44.66a25.64,25.64,0,0,0-4.52-8.37Zm22.65,8.64L68,63.82l-.11,1.35L51.53,67.61a20.47,20.47,0,0,0-.46-3.12l17.34-2.58Zm-.54,6.23V69l0,.29a12.34,12.34,0,0,1,0,1.61L67.67,72,52.47,74.3l-.27-.61-.59-2.43,0-.7,16.28-2.42Zm-1.2,7a8.69,8.69,0,0,1-3.11,3.12A8.1,8.1,0,0,1,60,79.36a7.35,7.35,0,0,1-3.68-.71A7.5,7.5,0,0,1,54.13,77l12.54-1.86ZM86.38,109H64.09a1.5,1.5,0,0,1-1.44-1.57c0-1,.1-2,.17-2.88s.17-1.9.29-2.87c.19-1.62.35-3,.57-4.27a16.93,16.93,0,0,1,.94-3.54,12.06,12.06,0,0,1,1.8-3.07,21.6,21.6,0,0,1,3.07-3.07l.76-.64c.25-.2.52-.42.82-.64s.54-.4.83-.59a9.32,9.32,0,0,1,.88-.53c3-1.65,6.8-5.65,10-9.08,1.39-1.48,2.68-2.85,3.82-3.93,1.73-1.69,3.59-3.4,5.27-5.14h0a14.16,14.16,0,0,1,2-1.93A8.85,8.85,0,0,1,96,63.93a5.08,5.08,0,0,1,3.23-.24,4.16,4.16,0,0,1,1.48.72,3.51,3.51,0,0,1,1.08,1.41,4,4,0,0,1,.12,2.6,6.17,6.17,0,0,1-.77,1.72,8.55,8.55,0,0,1-1.26,1.51c-4.77,5.2-9.52,11.89-14.37,16.74a.57.57,0,0,0,0,.79.53.53,0,0,0,.41.14.47.47,0,0,0,.35-.15l.12-.12,15.74-15a9.32,9.32,0,0,0,.91-1,7.72,7.72,0,0,0,.72-1.07.8.8,0,0,1,.13-.19l0-.08,7.92-18.86a1.67,1.67,0,0,1,.28-.43,6.23,6.23,0,0,1,1.44-1.18,4.32,4.32,0,0,1,1.71-.59,2.93,2.93,0,0,1,.89.05,2.53,2.53,0,0,1,.87.35,3.32,3.32,0,0,1,.8.79,4.49,4.49,0,0,1,.48.93,9.34,9.34,0,0,1,.35,4.21,24.9,24.9,0,0,1-1.27,5.28l-2.67,9.39-.57,2-.47,1.74a36.44,36.44,0,0,1-2.37,7.09,33.84,33.84,0,0,1-5.15,7.21c-2.27,2.61-4.5,5-6.69,7.15s-4.33,4.21-6.42,6.18l-2.85,2.7-.07.08c-.94.89-1.84,1.77-2.7,2.62a1.48,1.48,0,0,1-1.14.52Zm1.55,3.54A1.52,1.52,0,0,1,89.44,114v7.33a1.52,1.52,0,0,1-1.51,1.51H64.1a1.51,1.51,0,0,1-1.51-1.51V114a1.51,1.51,0,0,1,1.51-1.51H86.76c.47,0,.7,0,1.17,0ZM54.68,109H32.45a1.51,1.51,0,0,1-1.14-.52c-.86-.85-1.76-1.73-2.69-2.62l-2.93-2.78c-2.08-2-4.22-4-6.41-6.18s-4.43-4.54-6.69-7.15a34,34,0,0,1-5.16-7.21,36.44,36.44,0,0,1-2.37-7.09L4.59,73.7l-.57-2c-.89-3.14-1.75-6.32-2.69-9.44A25.46,25.46,0,0,1,.08,57a9.34,9.34,0,0,1,.35-4.21,4.06,4.06,0,0,1,.49-.93,3.12,3.12,0,0,1,.79-.79,2.5,2.5,0,0,1,.88-.35,2.86,2.86,0,0,1,.88-.05,4.26,4.26,0,0,1,1.71.59,6.23,6.23,0,0,1,1.44,1.18,1.67,1.67,0,0,1,.28.43l7.92,18.86,0,.08A1.27,1.27,0,0,1,15,72a8.62,8.62,0,0,0,.71,1.07,9.45,9.45,0,0,0,.92,1l15.73,15,.12.12a.49.49,0,0,0,.35.15.57.57,0,0,0,.36-.09l.1-.09a.62.62,0,0,0,.13-.34.55.55,0,0,0-.1-.35,1,1,0,0,1-.13-.16c-4.47-5.2-9.61-11.88-14.29-16.65a8.09,8.09,0,0,1-1.25-1.5,6.17,6.17,0,0,1-.77-1.72,4,4,0,0,1,.12-2.6,3.6,3.6,0,0,1,1.08-1.41,4.12,4.12,0,0,1,1.49-.72,5,5,0,0,1,3.22.24,8.85,8.85,0,0,1,2.15,1.29,13.64,13.64,0,0,1,2,1.93h0c1.67,1.74,3.53,3.45,5.27,5.14,1.13,1.08,2.43,2.45,3.82,3.93,3.24,3.43,7,7.43,10,9.08a9.13,9.13,0,0,1,.87.53c.3.19.57.39.84.59s.52.4.81.64c0,0,.74.64.77.64a22,22,0,0,1,3.06,3.07,12.41,12.41,0,0,1,1.81,3.07l0,.09a17.54,17.54,0,0,1,.9,3.45c.22,1.25.39,2.65.58,4.27.06.55.13,1.21.2,2s.12,1.37.15,1.93l.11,1.86A1.51,1.51,0,0,1,54.75,109Z"
                    fill={
                      stats.total > 0 
                        ? (stats.completed / stats.total) >= 0.9 ? '#22c55e' // green - outstanding
                        : (stats.completed / stats.total) >= 0.7 ? '#3b82f6' // blue - excellent
                        : (stats.completed / stats.total) >= 0.5 ? '#a855f7' // purple - good
                        : (stats.completed / stats.total) >= 0.3 ? '#f59e0b' // amber - fair
                        : '#f43f5e' // rose - critical
                        : '#6b7280' // gray - no data
                    }
                  />
                  {/* Pulse animation for critical health */}
                  {stats.total > 0 && (stats.completed / stats.total) < 0.25 && (
                    <animate 
                      attributeName="opacity" 
                      values="1;0.5;1" 
                      dur="1.5s" 
                      repeatCount="indefinite"
                    />
                  )}
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white">Project Health</h3>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">Overall Progress</span>
                <span className="text-sm font-medium" style={{
                  color: stats.total > 0 
                    ? (stats.completed / stats.total) >= 0.9 ? '#22c55e' // green - outstanding
                    : (stats.completed / stats.total) >= 0.7 ? '#3b82f6' // blue - excellent
                    : (stats.completed / stats.total) >= 0.5 ? '#a855f7' // purple - good
                    : (stats.completed / stats.total) >= 0.3 ? '#f59e0b' // amber - fair
                    : '#f43f5e' // rose - critical
                    : '#6b7280' // gray - no data
                }}>
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
                    backgroundColor: stats.total > 0 
                      ? (stats.completed / stats.total) >= 0.9 ? '#22c55e' // green - outstanding
                      : (stats.completed / stats.total) >= 0.7 ? '#3b82f6' // blue - excellent
                      : (stats.completed / stats.total) >= 0.5 ? '#a855f7' // purple - good
                      : (stats.completed / stats.total) >= 0.3 ? '#f59e0b' // amber - fair
                      : '#f43f5e' // rose - critical
                      : '#6b7280' // gray - no data
                  }}
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
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-600">
            <h3 className="text-xl font-semibold text-white mb-6">Task Status</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <ClipboardList className="h-6 w-6 text-cyan-500" />
                    <span className="text-gray-300">Proposed</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.proposed}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-cyan-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.proposed / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-6 w-6 text-purple-500" />
                    <span className="text-gray-300">Planned</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.planned}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-purple-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.planned / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-6 w-6 text-yellow-500" />
                    <span className="text-gray-300">In Progress</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.inProgress}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-yellow-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                    <span className="text-gray-300">Blocked</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.blocked}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-red-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.blocked / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <span className="text-gray-300">Completed</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{stats.completed}</span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-green-500 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Priority Distribution */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-600">
            <h3 className="text-xl font-semibold text-white mb-6">Priority Distribution</h3>
            <div className="space-y-6">
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

          {/* Node Types */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-600">
            <h3 className="text-xl font-semibold text-white mb-6">Node Types</h3>
            <div className="space-y-6">
              {(() => {
                // Define all possible node types in order
                const allNodeTypes = [
                  'EPIC', 'MILESTONE', 'OUTCOME', 'FEATURE', 
                  'TASK', 'BUG', 'IDEA', 'RESEARCH'
                ];
                
                return allNodeTypes.map((type) => {
                  const count = stats.typeStats[type] || 0;
                  return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const iconProps = "h-6 w-6";
                          switch(type) {
                            case 'EPIC': return <Layers className={`${iconProps} text-purple-500`} />;
                            case 'MILESTONE': return <Trophy className={`${iconProps} text-orange-500`} />;
                            case 'OUTCOME': return <Target className={`${iconProps} text-indigo-500`} />;
                            case 'FEATURE': return <Sparkles className={`${iconProps} text-blue-500`} />;
                            case 'TASK': return <ListTodo className={`${iconProps} text-green-500`} />;
                            case 'BUG': return <AlertTriangle className={`${iconProps} text-red-500`} />;
                            case 'IDEA': return <Lightbulb className={`${iconProps} text-yellow-500`} />;
                            case 'RESEARCH': return <Microscope className={`${iconProps} text-teal-500`} />;
                            default: return <Circle className={`${iconProps} text-gray-500`} />;
                          }
                        })()}
                        <span className="text-gray-300">{formatLabel(type)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">{count}</span>
                      <div className="w-16 h-2 bg-gray-700 rounded-full">
                        <div 
                          className={`h-2 rounded-full ${(() => {
                            switch(type) {
                              case 'EPIC': return 'bg-purple-500';
                              case 'MILESTONE': return 'bg-orange-500';
                              case 'OUTCOME': return 'bg-indigo-500';
                              case 'FEATURE': return 'bg-blue-500';
                              case 'TASK': return 'bg-green-500';
                              case 'BUG': return 'bg-red-500';
                              case 'IDEA': return 'bg-yellow-500';
                              case 'RESEARCH': return 'bg-teal-500';
                              default: return 'bg-gray-500';
                            }
                          })()}`}
                          style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
                });
              })()}
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