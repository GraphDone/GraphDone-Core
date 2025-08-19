import React from 'react';
import { useMutation } from '@apollo/client';
import { X, Edit, Save } from 'lucide-react';
import { UPDATE_WORK_ITEM, GET_WORK_ITEMS } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { NodeCategorySelector } from './NodeCategorySelector';

interface EditNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: {
    id: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    priorityExec: number;
    priorityIndiv: number;
    priorityComm: number;
  };
}

export function EditNodeModal({ isOpen, onClose, node }: EditNodeModalProps) {
  const { currentTeam } = useAuth();
  const { showSuccess, showError } = useNotifications();
  
  // Function to find category for a given node type
  const findCategoryForType = (nodeType: string) => {
    const nodeCategories = {
      'Strategic Planning': ['EPIC', 'PROJECT', 'MILESTONE', 'GOAL'],
      'Development Work': ['STORY', 'FEATURE', 'TASK', 'RESEARCH'],
      'Quality & Issues': ['BUG', 'ISSUE', 'HOTFIX'],
      'Operations & Maintenance': ['MAINTENANCE', 'DEPLOYMENT', 'MONITORING'],
      'Documentation': ['DOCUMENTATION', 'SPECIFICATION', 'GUIDE'],
      'Testing & Validation': ['TEST', 'REVIEW', 'QA'],
      'Business & Sales': ['LEAD', 'OPPORTUNITY', 'CONTRACT'],
      'Creative & Design': ['MOCKUP', 'PROTOTYPE', 'UI_DESIGN'],
      'Support & Training': ['SUPPORT', 'TRAINING'],
      'Other': ['NOTE', 'ACTION_ITEM', 'DECISION']
    };
    
    for (const [category, types] of Object.entries(nodeCategories)) {
      if (types.includes(nodeType)) {
        return category;
      }
    }
    return '';
  };
  
  const [formData, setFormData] = React.useState({
    title: node.title,
    description: node.description || '',
    type: node.type,
    status: node.status,
    priorityExec: node.priorityExec || 0,
    priorityIndiv: node.priorityIndiv || 0,
    priorityComm: node.priorityComm || 0,
    assignedTo: '',
    dueDate: '',
  });
  
  const [selectedCategory, setSelectedCategory] = React.useState(findCategoryForType(node.type));

  const [updateWorkItem, { loading: updatingNode }] = useMutation(UPDATE_WORK_ITEM, {
    refetchQueries: [{ 
      query: GET_WORK_ITEMS,
      variables: {
        where: {
          teamId: currentTeam?.id || 'default-team'
        }
      }
    }],
  });

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        title: node.title,
        description: node.description || '',
        type: node.type,
        status: node.status,
        priorityExec: node.priorityExec || 0,
        priorityIndiv: node.priorityIndiv || 0,
        priorityComm: node.priorityComm || 0,
        assignedTo: '',
        dueDate: '',
      });
      setSelectedCategory(findCategoryForType(node.type));
    }
  }, [isOpen, node]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      
      const updateInput = {
        ...cleanFormData,
        priorityComp: (formData.priorityExec + formData.priorityIndiv + formData.priorityComm) / 3,
      };

      console.log('Updating node with input:', updateInput);
      
      const result = await updateWorkItem({
        variables: { 
          where: { id: node.id },
          update: updateInput
        }
      });

      if (result.data?.updateWorkItems?.workItems?.[0]) {
        const updatedNode = result.data.updateWorkItems.workItems[0];
        
        showSuccess(
          'Node Updated Successfully!',
          `"${updatedNode.title}" has been updated and changes are now visible in all views.`
        );

        onClose();
      }
    } catch (error) {
      console.error('Error updating node:', error);
      
      // Show more specific error message if available
      let errorMessage = 'There was an error updating the node. Please try again or contact support if the problem persists.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      showError(
        'Failed to Update Node',
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
              <Edit className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Node
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  formData.status === 'PLANNED' ? 'text-violet-600 dark:text-violet-400' :
                  formData.status === 'IN_PROGRESS' ? 'text-yellow-600 dark:text-yellow-400' :
                  formData.status === 'COMPLETED' ? 'text-green-600 dark:text-green-400' :
                  formData.status === 'BLOCKED' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-900 dark:text-white'
                }`}
              >
                <option value="PROPOSED" className="text-blue-600">Proposed</option>
                <option value="PLANNED" className="text-violet-600">Planned</option>
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
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{formData.priorityExec.toFixed(1)}</div>
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
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{formData.priorityIndiv.toFixed(1)}</div>
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
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{formData.priorityComm.toFixed(1)}</div>
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
                disabled={updatingNode}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-green-400 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{updatingNode ? 'Updating...' : 'Update Node'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}