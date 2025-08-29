import React from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { X, Link, ChevronDown } from 'lucide-react';
import { CREATE_WORK_ITEM, GET_WORK_ITEMS, GET_EDGES, CREATE_EDGE } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';
import { NodeTypeSelector } from './NodeCategorySelector';
import { TagInput } from './TagInput';
import { RELATIONSHIP_TYPES, getRelationshipIcon } from '../lib/connectionUtils';
import { 
  getStatusColor as getStatusColorScheme,
  getTypeColor, 
  getPriorityColor,
  suggestSimilarNodes
} from '../utils/nodeColorSystem';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  getPriorityIcon as getCentralizedPriorityIcon,
  getPriorityIconElement,
  getPriorityColor as getCentralizedPriorityColor,
  getStatusColorScheme as getCentralizedStatusColorScheme,
  ClipboardList
} from '../constants/workItemConstants';

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
}

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentNodeId?: string; // If provided, creates a connection to this node
  position?: { x: number; y: number; z: number }; // Position for floating nodes
}


export function CreateNodeModal({ isOpen, onClose, parentNodeId, position }: CreateNodeModalProps) {
  const { currentUser, currentTeam } = useAuth();
  const { currentGraph } = useGraph();
  const { showSuccess, showError } = useNotifications();

  // Query to get existing nodes count for dynamic messaging
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
    type: '',
    priorityExec: 0,
    priorityIndiv: 0,
    priorityComm: 0,
    status: 'PROPOSED',
    assignedTo: '',
    dueDate: '',
    tags: [] as string[]
  });

  const [selectedRelationType, setSelectedRelationType] = React.useState('DEPENDS_ON');

  const [isStatusOpen, setIsStatusOpen] = React.useState(false);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);

  // Status options from centralized constants (excluding 'all' option)
  const statusOptions = STATUS_OPTIONS.filter(option => option.value !== 'all').map(option => ({
    ...option,
    icon: option.icon ? <option.icon className="h-6 w-6" /> : null,
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


  // Check if all required fields are filled
  const isFormValid = formData.title.trim() !== '' && formData.type !== '';


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
      // Refetch all edges if creating a connected node
      ...(parentNodeId ? [
        { 
          query: GET_EDGES,
          variables: {}
        },
        // Also refetch edges for the parent node specifically
        { 
          query: GET_EDGES,
          variables: {
            where: {
              OR: [
                { source: { id: parentNodeId } },
                { target: { id: parentNodeId } }
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

  // Edge creation mutation for connected nodes
  const [createEdge] = useMutation(CREATE_EDGE, {
    refetchQueries: [
      { query: GET_EDGES, variables: {} },
      { query: GET_WORK_ITEMS, variables: { options: { limit: 100 } } }
    ]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    
    if (!formData.type) {
      showError('Validation Error', 'Please select a node type.');
      return;
    }

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
        priorityExec: formData.priorityExec,
        priorityIndiv: formData.priorityIndiv,
        priorityComm: formData.priorityComm,
        assignedTo: formData.assignedTo || undefined,
        dueDate: formData.dueDate || undefined,
        tags: formData.tags || [],
      };
      
      const workItemInput = {
        ...cleanFormData,
        positionX: position?.x || (400 + Math.random() * 200),
        positionY: position?.y || (300 + Math.random() * 200),
        positionZ: position?.z || 0,
        radius: 1.0,
        theta: 0.0,
        phi: 0.0,
        priorityComp: (formData.priorityExec + formData.priorityIndiv + formData.priorityComm) / 3,
        
        // Relationships - connect to current user and graph
        owner: {
          connect: {
            where: { node: { id: currentUser?.id } }
          }
        },
        graph: {
          connect: {
            where: { node: { id: currentGraph?.id } }
          }
        },
        
        // If parentNodeId is provided, create a dependency relationship
        ...(parentNodeId && {
          dependencies: {
            connect: {
              where: { node: { id: parentNodeId } }
            }
          }
        })
      };

      const result = await createWorkItem({
        variables: { input: [workItemInput] }
      });

      if (result.data?.createWorkItems?.workItems?.[0]) {
        const createdNode = result.data.createWorkItems.workItems[0];
        
        // If parentNodeId exists, also create an Edge entity for the connection
        if (parentNodeId) {
          try {
            await createEdge({
              variables: {
                input: [{
                  type: selectedRelationType,
                  weight: 0.8,
                  source: { connect: { where: { node: { id: createdNode.id } } } },
                  target: { connect: { where: { node: { id: parentNodeId } } } }
                }]
              }
            });
            
            const relationshipLabel = RELATIONSHIP_TYPES.find(r => r.type === selectedRelationType)?.label || selectedRelationType;
            showSuccess(
              'Node Created and Connected Successfully!',
              `"${createdNode.title}" has been created with a "${relationshipLabel}" relationship.`
            );
          } catch (edgeError) {
            console.error('Failed to create edge:', edgeError);
            showSuccess(
              'Node Created Successfully!',
              `"${createdNode.title}" has been created but the connection failed. You can connect it manually.`
            );
          }
        } else {
          showSuccess(
            'Node Created Successfully!',
            `"${createdNode.title}" has been added to your workspace and is now visible in all views.`
          );
        }

        onClose();
        setFormData({
          title: '',
          description: '',
          type: '',
          priorityExec: 0,
          priorityIndiv: 0,
          priorityComm: 0,
          status: 'PROPOSED',
          assignedTo: '',
          dueDate: '',
          tags: []
        });
        setSelectedRelationType('DEPENDS_ON');
      }
    } catch (error) {
      
      // Show more specific error message if available
      let errorMessage = 'There was an error creating the node. Please try again or contact support if the problem persists.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      showError(
        'Failed to Create Node',
        errorMessage
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900/80 via-slate-900/90 to-gray-900/80 transition-all duration-300" onClick={onClose} />
        
        <div className="relative bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 max-w-lg w-full transform transition-all duration-300" onClick={(e) => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-emerald-900/30 via-green-800/25 to-teal-900/30 px-6 py-5 border-b border-green-600/20 backdrop-blur-sm rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                  {parentNodeId ? <Link className="h-6 w-6 text-emerald-400" /> : <ClipboardList className="h-6 w-6 text-emerald-400" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-200 to-green-100 bg-clip-text text-transparent">
                    {parentNodeId ? 'Create & Connect Node' : 'Create New Node'}
                  </h2>
                  <p className="text-sm text-gray-300 mt-1">
                    {parentNodeId 
                      ? 'Add a new node with automatic connection' 
                      : existingNodesData?.workItems?.length > 0
                        ? 'Add another node to expand your graph'
                        : 'Add your first node to begin the journey'
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-gradient-to-br from-gray-800/30 to-gray-900/40">
            {parentNodeId && (
              <div className="space-y-5 mb-6">
                <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/15 to-blue-800/20 border border-blue-600/30 rounded-xl p-4 backdrop-blur-sm">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                    <p className="text-sm font-semibold text-blue-200">Connection Setup</p>
                  </div>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    A new node will be created and automatically connected with your selected relationship type.
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full"></div>
                    <label className="text-sm font-bold text-gray-100 tracking-wide">
                      Relationship Type *
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {RELATIONSHIP_TYPES.map((relation) => (
                      <button
                        key={relation.type}
                        type="button"
                        onClick={() => setSelectedRelationType(relation.type)}
                        className={`p-4 rounded-xl text-left transition-all duration-200 border group ${
                          selectedRelationType === relation.type
                            ? 'bg-gradient-to-br from-blue-600/20 via-blue-700/25 to-blue-800/20 border-blue-400/50 shadow-lg shadow-blue-500/10'
                            : 'bg-gradient-to-br from-gray-700/30 to-gray-800/30 hover:from-gray-600/40 hover:to-gray-700/40 border-gray-600/30 hover:border-gray-500/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          {getRelationshipIcon(relation.icon, `h-5 w-5 ${selectedRelationType === relation.type ? 'text-blue-400' : relation.color}`)}
                          <span className={`font-medium text-sm ${selectedRelationType === relation.type ? 'text-blue-400' : relation.color}`}>
                            {relation.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {relation.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-1.5 w-1.5 bg-green-400 rounded-full"></div>
                <label htmlFor="title" className="text-sm font-bold text-gray-100 tracking-wide">
                  Title *
                </label>
              </div>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-600/50 bg-gray-800 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400/70 transition-all duration-200 placeholder-gray-400"
                placeholder="Enter a descriptive title for your node"
              />
            </div>
            
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-1.5 w-1.5 bg-purple-400 rounded-full"></div>
                <label className="text-sm font-bold text-gray-100 tracking-wide">
                  Node Type *
                </label>
              </div>
              
              <NodeTypeSelector
                selectedType={formData.type}
                onTypeChange={(type) => setFormData(prev => ({ ...prev, type }))}
                placeholder="Select node type"
              />
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-1.5 w-1.5 bg-orange-400 rounded-full"></div>
                <label className="text-sm font-bold text-gray-100 tracking-wide">
                  Status
                </label>
              </div>
              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusOpen(!isStatusOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                >
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const selectedStatus = statusOptions.find(option => option.value === formData.status);
                      return selectedStatus ? (
                        <>
                          <div className={`${selectedStatus.color} text-lg`}>
                            {selectedStatus.icon}
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedStatus.label}</span>
                        </>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300 font-medium">Select status</span>
                      );
                    })()}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-all duration-200 ${isStatusOpen ? 'rotate-180 text-blue-500' : ''}`} />
                </button>

                {isStatusOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto backdrop-blur-sm">
                    <div className="p-2">
                      {statusOptions.map((option, index) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, status: option.value }));
                            setIsStatusOpen(false);
                          }}
                          className={`w-full px-3 py-3 text-left transition-all duration-200 rounded-lg group ${
                            formData.status === option.value 
                              ? `${option.background} ${option.border} ring-1` 
                              : 'hover:bg-gray-700/30 hover:shadow-sm'
                          } ${index !== 0 ? 'mt-1' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`${option.color} text-lg`}>
                                {option.icon}
                              </div>
                              <span className={`font-semibold ${
                                formData.status === option.value 
                                  ? option.color 
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {option.label}
                              </span>
                            </div>
                            {formData.status === option.value && (
                              <div className={`w-5 h-5 ${option.color} rounded-full flex items-center justify-center text-xs ml-2 flex-shrink-0 shadow-sm`}>
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
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the node"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <TagInput
                tags={formData.tags}
                onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                maxTags={5}
              />
            </div>

            {/* Contributor and Due Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contributorId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contributor
                </label>
                <select
                  id="contributorId"
                  value={formData.assignedTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority Distribution</label>
              
              {/* Professional Priority Guide */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 shadow-sm">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Priority Level</div>
                </div>
                
                <div className="space-y-3">
                  {/* First Row - 3 items */}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          priorityExec: 0.9,
                          priorityIndiv: 0.9,
                          priorityComm: 0.9
                        }));
                      }}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-red-500/30 text-center hover:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        {getPriorityIconElement(0.9, "w-6 h-6 text-red-500")}
                        <div className="text-red-500 font-bold text-sm">Critical</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">80% - 100%</div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          priorityExec: 0.7,
                          priorityIndiv: 0.7,
                          priorityComm: 0.7
                        }));
                      }}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-orange-500/30 text-center hover:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        {getPriorityIconElement(0.7, "w-6 h-6 text-orange-500")}
                        <div className="text-orange-400 font-bold text-sm">High</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">60% - 79%</div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          priorityExec: 0.5,
                          priorityIndiv: 0.5,
                          priorityComm: 0.5
                        }));
                      }}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-yellow-500/30 text-center hover:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        {getPriorityIconElement(0.5, "w-6 h-6 text-yellow-500")}
                        <div className="text-yellow-400 font-bold text-sm">Moderate</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">40% - 59%</div>
                    </button>
                  </div>
                  
                  {/* Second Row - 2 items centered */}
                  <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          priorityExec: 0.3,
                          priorityIndiv: 0.3,
                          priorityComm: 0.3
                        }));
                      }}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-blue-500/30 text-center hover:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        {getPriorityIconElement(0.3, "w-6 h-6 text-blue-500")}
                        <div className="text-blue-400 font-bold text-sm">Low</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">20% - 39%</div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          priorityExec: 0.1,
                          priorityIndiv: 0.1,
                          priorityComm: 0.1
                        }));
                      }}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-gray-500/30 text-center hover:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        {getPriorityIconElement(0.1, "w-6 h-6 text-gray-500")}
                        <div className="text-gray-400 font-bold text-sm">Minimal</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">0% - 19%</div>
                    </button>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Executive Priority
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.priorityExec}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    priorityExec: parseFloat(e.target.value)
                  }))}
                  className={`w-full ${
                    formData.priorityExec >= 0.8 ? 'accent-red-500' :
                    formData.priorityExec >= 0.6 ? 'accent-orange-500' :
                    formData.priorityExec >= 0.4 ? 'accent-yellow-500' :
                    formData.priorityExec >= 0.2 ? 'accent-blue-500' :
                    'accent-gray-500'
                  }`}
                />
                <div className={`text-sm text-center font-medium ${
                  formData.priorityExec >= 0.8 ? 'text-red-500' :
                  formData.priorityExec >= 0.6 ? 'text-orange-500' :
                  formData.priorityExec >= 0.4 ? 'text-yellow-500' :
                  formData.priorityExec >= 0.2 ? 'text-blue-500' :
                  'text-gray-500'
                }`}>
                  {(() => {
                    const PriorityIcon = getCentralizedPriorityIcon(formData.priorityExec);
                    const priorityConfig = PRIORITY_OPTIONS.find(p => p.value !== 'all' && 
                      formData.priorityExec >= p.threshold!.min && formData.priorityExec <= p.threshold!.max);
                    return (
                      <>
                        {PriorityIcon && <PriorityIcon className="h-6 w-6 inline mr-1" />}
                        {priorityConfig?.label || 'Minimal'} ({Math.round(formData.priorityExec * 100)}%)
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Individual Priority
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.priorityIndiv}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    priorityIndiv: parseFloat(e.target.value)
                  }))}
                  className={`w-full ${
                    formData.priorityIndiv >= 0.8 ? 'accent-red-500' :
                    formData.priorityIndiv >= 0.6 ? 'accent-orange-500' :
                    formData.priorityIndiv >= 0.4 ? 'accent-yellow-500' :
                    formData.priorityIndiv >= 0.2 ? 'accent-blue-500' :
                    'accent-gray-500'
                  }`}
                />
                <div className={`text-sm text-center font-medium ${
                  formData.priorityIndiv >= 0.8 ? 'text-red-500' :
                  formData.priorityIndiv >= 0.6 ? 'text-orange-500' :
                  formData.priorityIndiv >= 0.4 ? 'text-yellow-500' :
                  formData.priorityIndiv >= 0.2 ? 'text-blue-500' :
                  'text-gray-500'
                }`}>
                  {(() => {
                    const PriorityIcon = getCentralizedPriorityIcon(formData.priorityIndiv);
                    const priorityConfig = PRIORITY_OPTIONS.find(p => p.value !== 'all' && 
                      formData.priorityIndiv >= p.threshold!.min && formData.priorityIndiv <= p.threshold!.max);
                    return (
                      <>
                        {PriorityIcon && <PriorityIcon className="h-6 w-6 inline mr-1" />}
                        {priorityConfig?.label || 'Minimal'} ({Math.round(formData.priorityIndiv * 100)}%)
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Community Priority
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.priorityComm}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    priorityComm: parseFloat(e.target.value)
                  }))}
                  className={`w-full ${
                    formData.priorityComm >= 0.8 ? 'accent-red-500' :
                    formData.priorityComm >= 0.6 ? 'accent-orange-500' :
                    formData.priorityComm >= 0.4 ? 'accent-yellow-500' :
                    formData.priorityComm >= 0.2 ? 'accent-blue-500' :
                    'accent-gray-500'
                  }`}
                />
                <div className={`text-sm text-center font-medium ${
                  formData.priorityComm >= 0.8 ? 'text-red-500' :
                  formData.priorityComm >= 0.6 ? 'text-orange-500' :
                  formData.priorityComm >= 0.4 ? 'text-yellow-500' :
                  formData.priorityComm >= 0.2 ? 'text-blue-500' :
                  'text-gray-500'
                }`}>
                  {(() => {
                    const PriorityIcon = getCentralizedPriorityIcon(formData.priorityComm);
                    const priorityConfig = PRIORITY_OPTIONS.find(p => p.value !== 'all' && 
                      formData.priorityComm >= p.threshold!.min && formData.priorityComm <= p.threshold!.max);
                    return (
                      <>
                        {PriorityIcon && <PriorityIcon className="h-6 w-6 inline mr-1" />}
                        {priorityConfig?.label || 'Minimal'} ({Math.round(formData.priorityComm * 100)}%)
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-600/50 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/50 to-gray-800/50 border border-gray-600/50 rounded-xl hover:from-gray-600/60 hover:to-gray-700/60 hover:border-gray-500/60 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingWorkItem || !isFormValid}
                className={`px-8 py-3 text-white rounded-xl transition-all duration-200 flex items-center space-x-3 font-semibold shadow-lg disabled:shadow-none ${
                  !isFormValid 
                    ? 'bg-gray-600/50 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 shadow-emerald-500/20'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                <span>{creatingWorkItem ? 'Creating...' : (parentNodeId ? 'Create & Connect' : 'Create Node')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}