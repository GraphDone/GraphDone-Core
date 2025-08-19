import React from 'react';
import { useMutation } from '@apollo/client';
import { X, Link } from 'lucide-react';
import { CREATE_WORK_ITEM, GET_WORK_ITEMS } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { NodeCategorySelector } from './NodeCategorySelector';

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentNodeId?: string; // If provided, creates a connection to this node
  position?: { x: number; y: number; z: number }; // Position for floating nodes
}

export function CreateNodeModal({ isOpen, onClose, parentNodeId, position }: CreateNodeModalProps) {
  const { currentUser, currentTeam } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    type: '',
    priorityExec: 0,
    priorityIndiv: 0,
    priorityComm: 0,
    status: 'PROPOSED',
    assignedTo: '',
    dueDate: ''
  });

  const [selectedCategory, setSelectedCategory] = React.useState('');

  // Check if all required fields are filled
  const isFormValid = formData.title.trim() !== '' && formData.type !== '' && selectedCategory !== '';

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Optional: Close the dropdown overlay when clicking outside
        // setSelectedCategory('');
      }
    }

    if (selectedCategory) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [selectedCategory]);

  const nodeCategories = {
    'Strategic Planning': {
      emoji: '🎯',
      types: [
        { value: 'EPIC', label: 'Epic', description: 'Large initiative spanning multiple deliverables' },
        { value: 'PROJECT', label: 'Project', description: 'Temporary endeavor with specific deliverables' },
        { value: 'MILESTONE', label: 'Milestone', description: 'Key project checkpoint' },
        { value: 'GOAL', label: 'Goal', description: 'Target outcome or achievement' }
      ]
    },
    'Development Work': {
      emoji: '⚡',
      types: [
        { value: 'STORY', label: 'Story', description: 'General work item or requirement' },
        { value: 'FEATURE', label: 'Feature', description: 'New functionality or capability' },
        { value: 'TASK', label: 'Task', description: 'Specific work item to be completed' },
        { value: 'RESEARCH', label: 'Research', description: 'Information gathering and analysis' }
      ]
    },
    'Quality & Issues': {
      emoji: '🔍',
      types: [
        { value: 'BUG', label: 'Bug', description: 'Software defect requiring resolution' },
        { value: 'ISSUE', label: 'Issue', description: 'General problem or concern' },
        { value: 'HOTFIX', label: 'Hotfix', description: 'Urgent fix for critical issue' }
      ]
    },
    'Operations & Maintenance': {
      emoji: '🔧',
      types: [
        { value: 'MAINTENANCE', label: 'Maintenance', description: 'System upkeep and care' },
        { value: 'DEPLOYMENT', label: 'Deployment', description: 'Software release or rollout' },
        { value: 'MONITORING', label: 'Monitoring', description: 'System observation and alerting' }
      ]
    },
    'Documentation': {
      emoji: '📋',
      types: [
        { value: 'DOCUMENTATION', label: 'Documentation', description: 'Technical or process documentation' },
        { value: 'SPECIFICATION', label: 'Specification', description: 'Detailed requirements document' },
        { value: 'GUIDE', label: 'Guide', description: 'How-to or instructional content' }
      ]
    },
    'Testing & Validation': {
      emoji: '✅',
      types: [
        { value: 'TEST', label: 'Test', description: 'General testing activity' },
        { value: 'REVIEW', label: 'Review', description: 'General review activity' },
        { value: 'QA', label: 'QA', description: 'Quality assurance activity' }
      ]
    },
    'Business & Sales': {
      emoji: '💼',
      types: [
        { value: 'LEAD', label: 'Lead', description: 'Potential customer or prospect' },
        { value: 'OPPORTUNITY', label: 'Opportunity', description: 'Sales opportunity or deal' },
        { value: 'CONTRACT', label: 'Contract', description: 'Legal agreement or proposal' }
      ]
    },
    'Creative & Design': {
      emoji: '🎨',
      types: [
        { value: 'MOCKUP', label: 'Mockup', description: 'Visual design representation' },
        { value: 'PROTOTYPE', label: 'Prototype', description: 'Working model or proof of concept' },
        { value: 'UI_DESIGN', label: 'UI Design', description: 'User interface design work' }
      ]
    },
    'Support & Training': {
      emoji: '🎓',
      types: [
        { value: 'SUPPORT', label: 'Support', description: 'Customer or user assistance' },
        { value: 'TRAINING', label: 'Training', description: 'Learning and development activity' }
      ]
    },
    'Other': {
      emoji: '🔧',
      types: [
        { value: 'NOTE', label: 'Note', description: 'General note or observation' },
        { value: 'ACTION_ITEM', label: 'Action Item', description: 'Specific action to be taken' },
        { value: 'DECISION', label: 'Decision', description: 'Choice or determination to be made' }
      ]
    }
  };

  const [createWorkItem, { loading: creatingWorkItem }] = useMutation(CREATE_WORK_ITEM, {
    refetchQueries: [{ 
      query: GET_WORK_ITEMS,
      variables: {
        where: {
          teamId: currentTeam?.id || 'default-team'
        }
      }
    }],
    awaitRefetchQueries: true,
    update: (cache, { data }) => {
      // Update Apollo cache for immediate UI refresh
      if (data?.createWorkItems?.workItems) {
        const newNode = data.createWorkItems.workItems[0];
        
        // Update existing cached query
        const existingData = cache.readQuery({
          query: GET_WORK_ITEMS,
          variables: {
            where: {
              teamId: currentTeam?.id || 'default-team'
            }
          }
        });
        
        if (existingData) {
          cache.writeQuery({
            query: GET_WORK_ITEMS,
            variables: {
              where: {
                teamId: currentTeam?.id || 'default-team'
              }
            },
            data: {
              workItems: [newNode, ...existingData.workItems]
            }
          });
        }
      }
    }
  });

  // Note: Edge creation temporarily disabled - will be implemented later
  // const [createEdge] = useMutation(CREATE_EDGE, {
  //   refetchQueries: [{ query: GET_WORK_ITEMS }],
  // });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that both category and type are selected
    if (!selectedCategory) {
      showError('Validation Error', 'Please select a category first.');
      return;
    }
    
    if (!formData.type) {
      showError('Validation Error', 'Please select a node type.');
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
        
        // Data isolation - assign to current team and user
        teamId: currentTeam?.id || 'default-team',
        userId: currentUser?.id || 'default-user',
        
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
        
        showSuccess(
          'Node Created Successfully!',
          `"${createdNode.title}" has been added to your workspace and is now visible in all views.`
        );

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
          dueDate: ''
        });
        setSelectedCategory('');
      }
    } catch (error) {
      console.error('Error creating work item:', error);
      console.error('Work item input:', workItemInput);
      
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-75 dark:bg-black dark:bg-opacity-80" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {parentNodeId ? 'Add Connected Node' : 'Create New Node'}
              </h2>
              {parentNodeId && <Link className="h-4 w-4 text-blue-500" />}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {parentNodeId && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This node will be connected as a dependency to the selected node.
                </p>
              </div>
            )}
            
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter node title..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Node Type *
              </label>
              
              <NodeCategorySelector
                selectedCategory={selectedCategory}
                selectedType={formData.type}
                onCategoryChange={(category) => {
                  setSelectedCategory(category);
                  setFormData(prev => ({ ...prev, type: '' }));
                }}
                onTypeChange={(type) => setFormData(prev => ({ ...prev, type }))}
                showTypeSelection={true}
                placeholder="Select category..."
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className={`w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium ${
                  formData.status === 'PROPOSED' ? 'text-blue-600 dark:text-blue-400' :
                  formData.status === 'PLANNED' ? 'text-purple-600 dark:text-purple-400' :
                  formData.status === 'IN_PROGRESS' ? 'text-yellow-600 dark:text-yellow-400' :
                  formData.status === 'COMPLETED' ? 'text-green-600 dark:text-green-400' :
                  formData.status === 'BLOCKED' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-900 dark:text-white'
                }`}
              >
                <option value="PROPOSED" className="text-blue-600">Proposed</option>
                <option value="PLANNED" className="text-purple-600">Planned</option>
                <option value="IN_PROGRESS" className="text-yellow-600">In Progress</option>
                <option value="COMPLETED" className="text-green-600">Completed</option>
                <option value="BLOCKED" className="text-red-600">Blocked</option>
              </select>
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
                placeholder="Describe the node..."
              />
            </div>

            {/* Contributor and Due Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contributor
                </label>
                <select
                  id="assignedTo"
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
              <div className="bg-gray-800 dark:bg-gray-750 border border-gray-600 dark:border-gray-600 rounded-xl p-4 mb-4 shadow-sm">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-gray-300">Priority Level</div>
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
                      className="bg-gray-700 rounded-lg p-2 border border-red-500/30 text-center hover:shadow-sm hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="text-red-400 font-bold text-xs">Critical</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">0.80 - 1.00</div>
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
                      className="bg-gray-700 rounded-lg p-2 border border-orange-500/30 text-center hover:shadow-sm hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <div className="text-orange-400 font-bold text-xs">High</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">0.60 - 0.79</div>
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
                      className="bg-gray-700 rounded-lg p-2 border border-yellow-500/30 text-center hover:shadow-sm hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="text-yellow-400 font-bold text-xs">Moderate</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">0.40 - 0.59</div>
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
                      className="bg-gray-700 rounded-lg p-2 border border-blue-500/30 text-center hover:shadow-sm hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <div className="text-blue-400 font-bold text-xs">Low</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">0.20 - 0.39</div>
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
                      className="bg-gray-700 rounded-lg p-2 border border-green-500/30 text-center hover:shadow-sm hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div className="text-green-400 font-bold text-xs">Minimal</div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">0.00 - 0.19</div>
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
                    'accent-green-500'
                  }`}
                />
                <div className={`text-xs text-center font-medium ${
                  formData.priorityExec >= 0.8 ? 'text-red-500' :
                  formData.priorityExec >= 0.6 ? 'text-orange-500' :
                  formData.priorityExec >= 0.4 ? 'text-yellow-500' :
                  formData.priorityExec >= 0.2 ? 'text-blue-500' :
                  'text-green-500'
                }`}>
                  {formData.priorityExec >= 0.8 ? '🔴 Critical' :
                   formData.priorityExec >= 0.6 ? '🟠 High' :
                   formData.priorityExec >= 0.4 ? '🟡 Moderate' :
                   formData.priorityExec >= 0.2 ? '🔵 Low' :
                   '🟢 Minimal'} ({formData.priorityExec})
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
                    'accent-green-500'
                  }`}
                />
                <div className={`text-xs text-center font-medium ${
                  formData.priorityIndiv >= 0.8 ? 'text-red-500' :
                  formData.priorityIndiv >= 0.6 ? 'text-orange-500' :
                  formData.priorityIndiv >= 0.4 ? 'text-yellow-500' :
                  formData.priorityIndiv >= 0.2 ? 'text-blue-500' :
                  'text-green-500'
                }`}>
                  {formData.priorityIndiv >= 0.8 ? '🔴 Critical' :
                   formData.priorityIndiv >= 0.6 ? '🟠 High' :
                   formData.priorityIndiv >= 0.4 ? '🟡 Moderate' :
                   formData.priorityIndiv >= 0.2 ? '🔵 Low' :
                   '🟢 Minimal'} ({formData.priorityIndiv})
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
                    'accent-green-500'
                  }`}
                />
                <div className={`text-xs text-center font-medium ${
                  formData.priorityComm >= 0.8 ? 'text-red-500' :
                  formData.priorityComm >= 0.6 ? 'text-orange-500' :
                  formData.priorityComm >= 0.4 ? 'text-yellow-500' :
                  formData.priorityComm >= 0.2 ? 'text-blue-500' :
                  'text-green-500'
                }`}>
                  {formData.priorityComm >= 0.8 ? '🔴 Critical' :
                   formData.priorityComm >= 0.6 ? '🟠 High' :
                   formData.priorityComm >= 0.4 ? '🟡 Moderate' :
                   formData.priorityComm >= 0.2 ? '🔵 Low' :
                   '🟢 Minimal'} ({formData.priorityComm})
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingWorkItem || !isFormValid}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  !isFormValid 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 disabled:bg-green-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-green-400'
                }`}
              >
                {creatingWorkItem ? 'Creating...' : (parentNodeId ? 'Create & Connect' : 'Create Node')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}