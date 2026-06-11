import React from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { X, Link, ChevronDown, Plus } from 'lucide-react';
import { CREATE_WORK_ITEM, GET_WORK_ITEMS, GET_EDGES, CREATE_EDGE } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import { WorkItemTypeSelector } from './WorkItemTypeSelector';
import { TagInput } from './TagInput';
import {
  RELATIONSHIP_OPTIONS,
  getRelationshipConfig,
  getRelationshipIconElement,
  RelationshipType
} from '../constants/workItemConstants';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  getPriorityIcon as getCentralizedPriorityIcon,
  getPriorityIconElement,
  ClipboardList
} from '../constants/workItemConstants';
import { Edit3, Flag, User, Calendar, Hash, FileText, Layers, Activity, PenTool } from 'lucide-react';

interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: number;
  assignedTo?: string;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  contributors?: Array<{ id: string; name: string; type: string; }>;
}

interface CreateWorkItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentWorkItemId?: string; // If provided, creates a connection to this work item
  position?: { x: number; y: number; z: number }; // Position for floating work items
  onSubmit?: (nodeData: any) => Promise<void>; // Optional callback after work item creation
}


export function CreateWorkItemModal({ isOpen, onClose, parentWorkItemId, position, onSubmit }: CreateWorkItemModalProps) {
  const { currentUser, currentTeam } = useAuth();
  const { currentGraph } = useGraph();
  const { showSuccess, showError } = useNotifications();

  // Query to get existing work items count for dynamic messaging
  const { data: existingNodesData } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph ? {
      where: {
        graph: {
          id: currentGraph.id
        }
      }
    } : { where: {} },
    skip: !currentGraph?.id || !isOpen,
    fetchPolicy: 'cache-first'
  });
  
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    type: 'DEFAULT',
    priority: 0,
    status: 'NOT_STARTED',
    assignedTo: '',
    dueDate: '',
    tags: [] as string[]
  });

  const [selectedRelationType, setSelectedRelationType] = React.useState('DEFAULT_EDGE');

  const [isStatusOpen, setIsStatusOpen] = React.useState(false);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);

  // Status options from centralized constants (excluding 'all' option)
  const statusOptions = STATUS_OPTIONS.filter(option => option.value !== 'all').map(option => ({
    ...option,
    icon: option.icon ? <option.icon className="h-4 w-4" /> : null,
    background: option.bgColor,
    border: option.borderColor
  }));

  // Close status dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Check for duplicate names
  const existingNodes = existingNodesData?.workItems || [];
  const isDuplicateName = existingNodes.some((node: any) => 
    node.title.toLowerCase().trim() === formData.title.toLowerCase().trim()
  );
  
  // Check if all required fields are filled and no duplicate name
  const isFormValid = formData.title.trim() !== '' && !isDuplicateName;


  const [createWorkItem, { loading: creatingWorkItem }] = useMutation(CREATE_WORK_ITEM, {
    refetchQueries: [
      // Refetch work items for graph visualization
      { 
        query: GET_WORK_ITEMS,
        variables: {
          options: { limit: 100 }
        }
      },
      // Refetch work items for list view
      { 
        query: GET_WORK_ITEMS,
        variables: {
          where: {
            teamId: currentTeam?.id || 'team-1'
          }
        }
      },
      // Refetch all edges if creating a connected work item
      ...(parentWorkItemId ? [
        { 
          query: GET_EDGES,
          variables: {}
        },
        // Also refetch edges for the parent work item specifically
        { 
          query: GET_EDGES,
          variables: {
            where: {
              OR: [
                { source: { id: parentWorkItemId } },
                { target: { id: parentWorkItemId } }
              ]
            }
          }
        }
      ] : [])
    ],
    awaitRefetchQueries: true,
    update: (cache, { data }) => {
      // Update Apollo cache for immediate UI refresh
      if (data?.createWorkItems?.workItems) {
        const newNode = data.createWorkItems.workItems[0];
        
        // Update cache for GraphVisualization (no team filter)
        try {
          const graphData = cache.readQuery({
            query: GET_WORK_ITEMS,
            variables: {
              options: { limit: 100 }
            }
          }) as { workItems: WorkItem[] } | null;
          
          if (graphData) {
            cache.writeQuery({
              query: GET_WORK_ITEMS,
              variables: {
                options: { limit: 100 }
              },
              data: {
                workItems: [newNode, ...graphData.workItems]
              }
            });
          }
        } catch {
          // Silently fail if cache read fails
        }

        // Update cache for ListView (with team filter)
        try {
          const listData = cache.readQuery({
            query: GET_WORK_ITEMS,
            variables: {
              where: {
                teamId: currentTeam?.id || 'team-1'
              }
            }
          }) as { workItems: WorkItem[] } | null;
          
          if (listData) {
            cache.writeQuery({
              query: GET_WORK_ITEMS,
              variables: {
                where: {
                  teamId: currentTeam?.id || 'team-1'
                }
              },
              data: {
                workItems: [newNode, ...listData.workItems]
              }
            });
          }
        } catch {
          // Silently fail if cache read fails
        }
      }
    }
  });

  // Edge creation mutation for connected work items
  const [createEdge] = useMutation(CREATE_EDGE, {
    refetchQueries: [
      { query: GET_EDGES, variables: {} },
      { query: GET_WORK_ITEMS, variables: { options: { limit: 100 } } }
    ]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    

    if (!currentGraph) {
      showError('No Graph Selected', 'Please select a graph before creating work items.');
      return;
    }
    
    try {
      // Clean up the form data - remove empty strings and null values
      const cleanFormData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        status: formData.status,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
        tags: formData.tags || [],
      };
      
      const workItemInput: any = {
        ...cleanFormData,
        positionX: position?.x || (400 + Math.random() * 200),
        positionY: position?.y || (300 + Math.random() * 200),
        positionZ: position?.z || 0,
        radius: 1.0,
        theta: 0.0,
        phi: 0.0,
        priorityComp: formData.priority,
      };

      // Handle assignedTo relationship properly for Neo4j GraphQL
      if (formData.assignedTo) {
        workItemInput.assignedTo = {
          connect: {
            where: { node: { id: formData.assignedTo } }
          }
        };
      }

      // Add required relationships
      workItemInput.owner = {
        connect: {
          where: { node: { id: currentUser?.id } }
        }
      };
      
      workItemInput.graph = {
        connect: {
          where: { node: { id: currentGraph?.id } }
        }
      };

      const result = await createWorkItem({
        variables: { input: [workItemInput] }
      });

      if (result.data?.createWorkItems?.workItems?.[0]) {
        const createdNode = result.data.createWorkItems.workItems[0];
        
        // If parentWorkItemId is provided, create the edge with the correct relationship type
        if (parentWorkItemId) {
          const edgeInput = {
            type: selectedRelationType,
            source: { connect: { where: { node: { id: parentWorkItemId } } } },
            target: { connect: { where: { node: { id: createdNode.id } } } }
          };
          
          await createEdge({ variables: { input: [edgeInput] } });
          
          const relationshipLabel = getRelationshipConfig(selectedRelationType as RelationshipType).label;
          showSuccess(
            'Work Item Created and Connected Successfully!',
            `"${createdNode.title}" has been created with a "${relationshipLabel}" relationship.`
          );
        } else {
          showSuccess(
            'Work Item Created Successfully!',
            `"${createdNode.title}" has been added to your workspace and is now visible in all views.`
          );
        }

        onClose();
        setFormData({
          title: '',
          description: '',
          type: 'DEFAULT',
          priority: 0,
          status: 'NOT_STARTED',
          assignedTo: '',
          dueDate: '',
          tags: []
        });
        setSelectedRelationType('DEFAULT_EDGE');
      }
    } catch (error) {
      
      // Show more specific error message if available
      let errorMessage = 'There was an error creating the work item. Please try again or contact support if the problem persists.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      showError(
        'Failed to Create Work Item',
        errorMessage
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-800/90 animate-in fade-in duration-300"
          onClick={onClose}
        />

        <div className="inline-block w-full max-w-lg p-0 my-8 overflow-hidden text-left align-middle transition-all transform bg-gradient-to-br from-gray-800/98 via-gray-850/98 to-gray-900/98 backdrop-blur-2xl shadow-2xl rounded-2xl border border-gray-600/30 focus-within:ring-2 focus-within:ring-blue-500/50 animate-in slide-in-from-bottom-4 duration-300 relative" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-green-500/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-green-500"></div>

          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/30 bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm relative">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl blur opacity-50 animate-pulse"></div>
                {parentWorkItemId ? <Link className="h-5 w-5 text-white relative z-10" /> : <Plus className="h-5 w-5 text-white relative z-10" />}
              </div>
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-white via-green-100 to-emerald-100 bg-clip-text text-transparent">
                  {parentWorkItemId ? 'Create & Connect Work Item' : 'Create New Work Item'}
                </h3>
                <p className="text-xs text-gray-400">
                  {parentWorkItemId
                    ? 'Add a new work item with automatic connection'
                    : existingNodesData?.workItems?.length > 0
                      ? 'Add another work item to expand your graph'
                      : 'Add your first work item to begin the journey'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-200 hover:scale-110"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500">
          <form onSubmit={handleSubmit} className="px-3 py-2 space-y-2 relative">
            {parentWorkItemId && (
              <div className="space-y-2 mb-2">
                <div className="bg-gradient-to-br from-gray-800/30 to-gray-700/20 border border-gray-600/30 rounded-lg p-2 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center space-x-2 mb-1">
                    <p className="text-xs font-semibold text-blue-200">Connection Setup</p>
                  </div>
                  <p className="text-xs text-blue-100 leading-relaxed">
                    A new work item will be created and automatically connected with your selected relationship type.
                  </p>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <label className="text-base font-bold text-gray-100 tracking-wide">
                      Relationship Type
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {RELATIONSHIP_OPTIONS.map((relation) => (
                      <button
                        key={relation.type}
                        type="button"
                        onClick={() => setSelectedRelationType(relation.type)}
                        className={`p-2 rounded-lg text-left transition-all duration-200 border group ${
                          selectedRelationType === relation.type
                            ? 'bg-gradient-to-br from-blue-600/20 via-blue-700/25 to-blue-800/20 border-blue-400/50 shadow-lg shadow-blue-500/10'
                            : 'bg-gradient-to-br from-gray-700/30 to-gray-800/30 hover:from-gray-600/40 hover:to-gray-700/40 border-gray-600/30 hover:border-gray-500/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5 mb-0.5">
                          {getRelationshipIconElement(relation.type, `h-4 w-4 ${selectedRelationType === relation.type ? 'text-blue-400' : ''}`)}
                          <span className={`font-medium text-xs ${selectedRelationType === relation.type ? 'text-blue-400' : relation.color}`}>
                            {relation.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {relation.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-base font-bold text-gray-100 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg mr-1 border border-blue-500/30">
                  <FileText className="h-3 w-3 text-blue-400" />
                </div>
                Title *
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className={`w-full border-2 bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none transition-all duration-200 placeholder-gray-400 text-sm ${
                  isDuplicateName
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-600 focus:!border-green-400'
                }`}
                placeholder="Enter a descriptive title for your work item"
              />
              {isDuplicateName && formData.title.trim() && (
                <div className="mt-1 flex items-center space-x-2 text-red-400 text-xs">
                  <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                  <span>A work item with this name already exists. Please choose a different name.</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-base font-bold text-gray-100 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg mr-1 border border-emerald-500/30">
                  <Edit3 className="h-3 w-3 text-emerald-400" />
                </div>
                Description
              </label>
              <textarea
                id="description"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border-2 border-gray-600 bg-gray-800 text-white rounded-lg placeholder-gray-400 px-4 py-3 focus:outline-none focus:!border-green-400 transition-all duration-200 text-sm"
                placeholder="Describe the work item"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-base font-bold text-gray-100 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-sky-500/20 to-blue-500/20 rounded-lg mr-1 border border-sky-500/30">
                  <Hash className="h-3 w-3 text-sky-400" />
                </div>
                Tags
              </label>
              <TagInput
                tags={formData.tags}
                onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                maxTags={5}
              />
            </div>

            <div>
              <label className="block text-base font-bold text-gray-100 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg mr-1 border border-purple-500/30">
                  <PenTool className="h-3 w-3 text-purple-400" />
                </div>
                Work Item Type
              </label>

              <WorkItemTypeSelector
                selectedType={formData.type}
                onTypeChange={(type) => setFormData(prev => ({ ...prev, type }))}
                placeholder="Select work item type"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-gray-100 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg mr-1 border border-green-500/30">
                  <Activity className="h-3 w-3 text-green-400" />
                </div>
                Status
              </label>
              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusOpen(!isStatusOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white transition-all duration-200 focus:!border-green-400 focus:outline-none text-sm"
                >
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const selectedStatus = statusOptions.find(option => option.value === formData.status);
                      return selectedStatus ? (
                        <>
                          <div className={`${selectedStatus.color} text-base`}>
                            {selectedStatus.icon}
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{selectedStatus.label}</span>
                        </>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300 font-medium text-xs">Select status</span>
                      );
                    })()}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isStatusOpen ? 'rotate-180 text-green-500' : ''}`} />
                </button>

                {isStatusOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-600/30 shadow-2xl z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      {statusOptions.map((option, index) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, status: option.value }));
                            setIsStatusOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 text-left transition-all duration-200 rounded-lg group ${
                            formData.status === option.value
                              ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-400/50 shadow-lg shadow-emerald-500/10'
                              : 'hover:bg-gray-700/50 border-2 border-transparent hover:border-gray-600/50'
                          } ${index !== 0 ? 'mt-1' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                              <div className={`${option.color} text-base transition-transform group-hover:scale-110`}>
                                {option.icon}
                              </div>
                              <span className={`font-semibold text-xs ${
                                formData.status === option.value
                                  ? 'text-emerald-400'
                                  : 'text-gray-100'
                              }`}>
                                {option.label}
                              </span>
                            </div>
                            {formData.status === option.value && (
                              <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-full flex items-center justify-center text-[10px] ml-1 flex-shrink-0 shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-200">
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

            {/* Contributor and Due Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label htmlFor="contributorId" className="block text-base font-bold text-gray-100 mb-1 flex items-center">
                  <div className="p-1 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg mr-1 border border-violet-500/30">
                    <User className="h-3 w-3 text-violet-400" />
                  </div>
                  Contributor
                </label>
                <select
                  id="contributorId"
                  value={formData.assignedTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="w-full bg-gray-800 border-2 border-gray-600 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:!border-green-400 transition-all duration-200 placeholder-gray-400"
                >
                  <option value="">No contributor</option>
                  <option value="user-1">John Doe</option>
                  <option value="user-2">Jane Smith</option>
                  <option value="user-3">Mike Johnson</option>
                  <option value="user-4">Sarah Wilson</option>
                  <option value="user-5">Alex Chen</option>
                </select>
              </div>

              <div>
                <label htmlFor="dueDate" className="block text-base font-bold text-gray-100 mb-1 flex items-center">
                  <div className="p-1 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg mr-1 border border-teal-500/30">
                    <Calendar className="h-3 w-3 text-teal-400" />
                  </div>
                  Due Date
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full bg-gray-800 border-2 border-gray-600 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:!border-green-400 transition-all duration-200 placeholder-gray-400"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="block text-base font-bold text-gray-100 mb-1 flex items-center">
                <div className="p-1 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg mr-1 border border-orange-500/30">
                  <Flag className="h-3 w-3 text-orange-400" />
                </div>
                Priority Level
              </label>

              {/* Modern Priority Selector */}
              <div className="grid grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: 0.1 }))}
                  className={`group relative overflow-hidden rounded-xl p-3 border-2 transition-all duration-200 ${
                    formData.priority < 0.2
                      ? 'border-gray-500 bg-gray-500/20 shadow-lg shadow-gray-500/20'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-400 hover:bg-gray-500/10'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    {getPriorityIconElement(0.1, "w-5 h-5 text-gray-500")}
                    <span className={`text-xs font-semibold ${formData.priority < 0.2 ? 'text-gray-400' : 'text-gray-500'}`}>
                      Minimal
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: 0.3 }))}
                  className={`group relative overflow-hidden rounded-xl p-3 border-2 transition-all duration-200 ${
                    formData.priority >= 0.2 && formData.priority < 0.4
                      ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                      : 'border-gray-600 bg-gray-800 hover:border-blue-400 hover:bg-blue-500/10'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    {getPriorityIconElement(0.3, "w-5 h-5 text-blue-500")}
                    <span className={`text-xs font-semibold ${formData.priority >= 0.2 && formData.priority < 0.4 ? 'text-blue-400' : 'text-gray-400'}`}>
                      Low
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: 0.5 }))}
                  className={`group relative overflow-hidden rounded-xl p-3 border-2 transition-all duration-200 ${
                    formData.priority >= 0.4 && formData.priority < 0.6
                      ? 'border-yellow-500 bg-yellow-500/20 shadow-lg shadow-yellow-500/20'
                      : 'border-gray-600 bg-gray-800 hover:border-yellow-400 hover:bg-yellow-500/10'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    {getPriorityIconElement(0.5, "w-5 h-5 text-yellow-500")}
                    <span className={`text-xs font-semibold ${formData.priority >= 0.4 && formData.priority < 0.6 ? 'text-yellow-400' : 'text-gray-400'}`}>
                      Medium
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: 0.7 }))}
                  className={`group relative overflow-hidden rounded-xl p-3 border-2 transition-all duration-200 ${
                    formData.priority >= 0.6 && formData.priority < 0.8
                      ? 'border-orange-500 bg-orange-500/20 shadow-lg shadow-orange-500/20'
                      : 'border-gray-600 bg-gray-800 hover:border-orange-400 hover:bg-orange-500/10'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    {getPriorityIconElement(0.7, "w-5 h-5 text-orange-500")}
                    <span className={`text-xs font-semibold ${formData.priority >= 0.6 && formData.priority < 0.8 ? 'text-orange-400' : 'text-gray-400'}`}>
                      High
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: 0.9 }))}
                  className={`group relative overflow-hidden rounded-xl p-3 border-2 transition-all duration-200 ${
                    formData.priority >= 0.8
                      ? 'border-red-500 bg-red-500/20 shadow-lg shadow-red-500/20'
                      : 'border-gray-600 bg-gray-800 hover:border-red-400 hover:bg-red-500/10'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    {getPriorityIconElement(0.9, "w-5 h-5 text-red-500")}
                    <span className={`text-xs font-semibold ${formData.priority >= 0.8 ? 'text-red-400' : 'text-gray-400'}`}>
                      Critical
                    </span>
                  </div>
                </button>
              </div>

              <div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    priority: parseFloat(e.target.value)
                  }))}
                  className={`w-full ${
                    formData.priority >= 0.8 ? 'accent-red-500' :
                    formData.priority >= 0.6 ? 'accent-orange-500' :
                    formData.priority >= 0.4 ? 'accent-yellow-500' :
                    formData.priority >= 0.2 ? 'accent-blue-500' :
                    'accent-gray-500'
                  }`}
                />
                <div className={`text-[10px] text-center font-medium ${
                  formData.priority >= 0.8 ? 'text-red-500' :
                  formData.priority >= 0.6 ? 'text-orange-500' :
                  formData.priority >= 0.4 ? 'text-yellow-500' :
                  formData.priority >= 0.2 ? 'text-blue-500' :
                  'text-gray-500'
                }`}>
                  {(() => {
                    const PriorityIcon = getCentralizedPriorityIcon(formData.priority);
                    const priorityConfig = PRIORITY_OPTIONS.find(p => p.value !== 'all' &&
                      formData.priority >= p.threshold!.min && formData.priority <= p.threshold!.max);
                    return (
                      <>
                        {PriorityIcon && <PriorityIcon className="h-3 w-3 inline mr-0.5" />}
                        {priorityConfig?.label || 'Minimal'} ({Math.round(formData.priority * 100)}%)
                      </>
                    );
                  })()}
                </div>
              </div>
              
            </div>
            
            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-700/30">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-gray-300 bg-gray-700/50 rounded-lg hover:bg-red-600 hover:text-white transition-all duration-200 font-medium hover:scale-105 border border-gray-600/30 hover:border-red-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingWorkItem || !isFormValid}
                className={`px-4 py-2 text-xs rounded-lg transition-all duration-200 font-semibold flex items-center space-x-1.5 hover:scale-105 shadow-lg ${
                  !isFormValid || creatingWorkItem
                    ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white hover:from-green-500 hover:via-emerald-500 hover:to-teal-500 shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/40'
                }`}
              >
                {creatingWorkItem ? (
                  <>
                    <span>Creating...</span>
                    <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  </>
                ) : (
                  <>
                    <span>{parentWorkItemId ? 'Create & Connect' : 'Create Work Item'}</span>
                    <Plus className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}