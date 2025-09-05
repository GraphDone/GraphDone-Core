import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { Search, X, ChevronDown } from 'lucide-react';
import { STATUS_OPTIONS, TYPE_OPTIONS, PRIORITY_OPTIONS } from '../constants/workItemConstants';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';
import { EditNodeModal } from './EditNodeModal';
import { DeleteNodeModal } from './DeleteNodeModal';
import { NodeDetailsModal } from './NodeDetailsModal';
import Dashboard from './Dashboard';
import TableView from './TableView';
import CardView from './CardView';
import KanbanView from './KanbanView';
import RightSidebar from './RightSidebar';
import GanttChart from './GanttChart';
import CalendarView from './CalendarView';
import ActivityFeed from './ActivityFeed';

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

type ViewType = 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity';

interface ViewManagerProps {
  viewMode: ViewType;
}

const ViewManager: React.FC<ViewManagerProps> = ({ viewMode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<WorkItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNodeDetailsModal, setShowNodeDetailsModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [contributorFilter, setContributorFilter] = useState<string>('');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
  const [isContributorDropdownOpen, setIsContributorDropdownOpen] = useState(false);

  // Refs for dropdown management
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const contributorDropdownRef = useRef<HTMLDivElement>(null);

  const { currentUser } = useAuth();
  const { currentGraph } = useGraph();

  // Fetch work items
  const { data, loading, error } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph ? {
      where: {
        graph: {
          id: currentGraph.id
        }
      }
    } : { where: {} },
    pollInterval: currentGraph ? 5000 : 0,
    fetchPolicy: currentGraph ? 'cache-and-network' : 'cache-only'
  });

  const workItems: WorkItem[] = data?.workItems || [];

  // Fetch edges to compute connections manually
  const { data: edgeData } = useQuery(GET_EDGES, {
    variables: currentGraph ? {
      where: {
        OR: [
          { source: { graph: { id: currentGraph.id } } },
          { target: { graph: { id: currentGraph.id } } }
        ]
      }
    } : { where: {} },
    pollInterval: currentGraph ? 5000 : 0,
    fetchPolicy: currentGraph ? 'cache-and-network' : 'cache-only'
  });

  const edges = edgeData?.edges || [];
  
  // Convert edges to WorkItemEdge format for NodeDetailsModal
  const workItemEdges = edges.map((edge: any) => ({
    id: edge.id,
    source: edge.source.id,
    target: edge.target.id,
    type: edge.type,
    strength: edge.weight
  }));


  // Convert centralized options to ViewManager format
  const statusOptions = STATUS_OPTIONS.map(option => ({
    ...option,
    value: option.value === 'all' ? 'All Statuses' : option.value,
    label: option.value === 'all' ? 'All Statuses' : option.label,
    icon: option.icon ? <option.icon className="h-6 w-6" /> : null
  }));

  const typeOptions = TYPE_OPTIONS.map(option => ({
    ...option,
    value: option.value === 'all' ? 'All Types' : option.value,
    label: option.value === 'all' ? 'All Types' : option.label,
    icon: option.icon ? <option.icon className="h-6 w-6" /> : null
  }));

  const priorityOptions = PRIORITY_OPTIONS.map(option => ({
    ...option,
    value: option.value === 'all' ? 'All Priorities' : option.label,
    label: option.value === 'all' ? 'All Priorities' : option.label,
    icon: option.icon ? <option.icon className="h-6 w-6" /> : null
  }));

  const uniqueContributors = useMemo(() => {
    const contributors = workItems
      .map(node => node.assignedTo?.name)
      .filter(contributor => contributor && contributor.trim().length > 0)
      .filter((contributor, index, arr) => arr.indexOf(contributor) === index)
      .sort();
    
    return contributors;
  }, [workItems]);

  // Contributor options matching ListView pattern
  const contributorOptions = useMemo(() => [
    { value: 'All Contributors', label: 'All Contributors' },
    { value: 'Available', label: 'Available', color: 'text-orange-400' },
    ...uniqueContributors.map(contributor => ({
      value: contributor,
      label: contributor
    }))
  ], [uniqueContributors]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
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

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setTypeFilter('');
    setPriorityFilter('');
    setContributorFilter('');
  };

  // Handle node actions
  const handleEditNode = (node: WorkItem) => {
    setSelectedNode(node);
    setShowNodeDetailsModal(true);
  };

  const handleDeleteNode = (node: WorkItem) => {
    setSelectedNode(node);
    setShowDeleteModal(true);
  };

  const handleCloseModals = () => {
    setSelectedNode(null);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowNodeDetailsModal(false);
  };

  // Transform node data for EditNodeModal
  const transformNodeForEdit = (node: WorkItem) => ({
    id: node.id,
    title: node.title,
    description: node.description || '',
    type: node.type,
    status: node.status,
    priority: node.priority,
    dueDate: node.dueDate,
    tags: node.tags || [],
    metadata: node.metadata || '',
    assignedToId: node.assignedTo?.id
  });

  // Filter nodes based on search and dropdown filters
  const filteredNodes = useMemo(() => {
    let filtered = workItems;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(node => 
        node.title.toLowerCase().includes(query) ||
        (node.description && node.description.toLowerCase().includes(query)) ||
        node.type.toLowerCase().includes(query) ||
        node.status.toLowerCase().includes(query) ||
        (node.tags && node.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // Status filter
    if (statusFilter && statusFilter !== '' && statusFilter !== 'All Statuses') {
      filtered = filtered.filter(node => node.status === statusFilter);
    }

    // Type filter
    if (typeFilter && typeFilter !== '' && typeFilter !== 'All Types') {
      filtered = filtered.filter(node => node.type === typeFilter);
    }

    // Priority filter
    if (priorityFilter && priorityFilter !== '' && priorityFilter !== 'All Priorities') {
      const priority = (node: WorkItem) => node.priority || 0;
      switch (priorityFilter) {
        case 'Critical':
          filtered = filtered.filter(node => priority(node) >= 0.8);
          break;
        case 'High':
          filtered = filtered.filter(node => priority(node) >= 0.6 && priority(node) < 0.8);
          break;
        case 'Moderate':
          filtered = filtered.filter(node => priority(node) >= 0.4 && priority(node) < 0.6);
          break;
        case 'Low':
          filtered = filtered.filter(node => priority(node) >= 0.2 && priority(node) < 0.4);
          break;
        case 'Minimal':
          filtered = filtered.filter(node => priority(node) < 0.2);
          break;
      }
    }

    // Contributor filter
    if (contributorFilter && contributorFilter !== '' && contributorFilter !== 'All Contributors') {
      if (contributorFilter === 'Available') {
        filtered = filtered.filter(node => !node.assignedTo);
      } else {
        filtered = filtered.filter(node => node.assignedTo?.name === contributorFilter);
      }
    }

    return filtered;
  }, [workItems, searchQuery, statusFilter, typeFilter, priorityFilter, contributorFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredNodes.length;
    const notStarted = filteredNodes.filter(node => node.status === 'NOT_STARTED').length;
    const proposed = filteredNodes.filter(node => node.status === 'PROPOSED').length;
    const planned = filteredNodes.filter(node => node.status === 'PLANNED').length;
    const inProgress = filteredNodes.filter(node => node.status === 'IN_PROGRESS').length;
    const inReview = filteredNodes.filter(node => node.status === 'IN_REVIEW').length;
    const blocked = filteredNodes.filter(node => node.status === 'BLOCKED').length;
    const onHold = filteredNodes.filter(node => node.status === 'ON_HOLD').length;
    const completed = filteredNodes.filter(node => node.status === 'COMPLETED').length;
    const cancelled = filteredNodes.filter(node => node.status === 'CANCELLED').length;

    const typeStats = filteredNodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityStats = {
      critical: filteredNodes.filter(node => node.priority >= 0.8).length,
      high: filteredNodes.filter(node => node.priority >= 0.6 && node.priority < 0.8).length,
      moderate: filteredNodes.filter(node => node.priority >= 0.4 && node.priority < 0.6).length,
      low: filteredNodes.filter(node => node.priority >= 0.2 && node.priority < 0.4).length,
      minimal: filteredNodes.filter(node => node.priority < 0.2).length
    };

    return {
      total,
      notStarted,
      proposed,
      planned,
      inProgress,
      inReview,
      blocked,
      onHold,
      completed,
      cancelled,
      typeStats,
      priorityStats
    };
  }, [filteredNodes]);

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
          <div className="text-red-500 text-xl mb-4">⚠️ Error Loading Data</div>
          <p className="text-gray-400 mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (viewMode) {
      case 'dashboard':
        return <Dashboard filteredNodes={filteredNodes} stats={stats} />;
      case 'table':
        return <TableView filteredNodes={filteredNodes} handleEditNode={handleEditNode} edges={edges} />;
      case 'cards':
        return <CardView filteredNodes={filteredNodes} handleEditNode={handleEditNode} edges={edges} />;
      case 'kanban':
        return <KanbanView filteredNodes={filteredNodes} handleEditNode={handleEditNode} edges={edges} />;
      case 'gantt':
        return <GanttChart filteredNodes={filteredNodes} />;
      case 'calendar':
        return <CalendarView filteredNodes={filteredNodes} />;
      case 'activity':
        return <ActivityFeed filteredNodes={filteredNodes} />;
      default:
        return <Dashboard filteredNodes={filteredNodes} stats={stats} />;
    }
  };

  // Check if current view should show search and filters
  const shouldShowFilters = ['table', 'cards', 'kanban'].includes(viewMode);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Search and Filter Bar - Only for table, card, kanban views */}
      {shouldShowFilters && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Search Input */}
            <div className="relative w-full sm:w-80 md:w-96 lg:w-[28rem]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks by type, status, priority"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex gap-3">
              {/* Type Filter */}
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

              {/* Status Filter */}
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

              {/* Priority Filter */}
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
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isPriorityDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
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

              {/* Contributors Filter */}
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

              {/* Clear Filters */}
              {(searchQuery || statusFilter || typeFilter || priorityFilter || contributorFilter) && (
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-3 text-sm text-gray-400">
            Showing {filteredNodes.length} of {workItems.length} nodes
            {(searchQuery || statusFilter || typeFilter || priorityFilter || contributorFilter) && (
              <span className="text-green-400 ml-2">
                (filtered)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {renderView()}
        </div>

        {/* Right Sidebar */}
        <RightSidebar currentView={viewMode} stats={stats} />
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

      {/* Node Details Modal */}
      {showNodeDetailsModal && selectedNode && (
        <NodeDetailsModal
          isOpen={showNodeDetailsModal}
          onClose={handleCloseModals}
          node={selectedNode}
          edges={workItemEdges}
          nodes={filteredNodes}
        />
      )}
    </div>
  );
};

export default ViewManager;