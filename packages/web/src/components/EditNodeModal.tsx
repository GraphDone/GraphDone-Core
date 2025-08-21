import React from 'react';
import { useMutation } from '@apollo/client';
import { X, Edit, Save, Lightbulb, Calendar, Clock, CheckCircle, AlertCircle, ChevronDown, Flame, Zap, Triangle, Circle, ArrowDown } from 'lucide-react';
import { UPDATE_WORK_ITEM, GET_WORK_ITEMS } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { NodeTypeSelector } from './NodeCategorySelector';

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

  const [isStatusOpen, setIsStatusOpen] = React.useState(false);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);

  // Status options with icons
  const statusOptions = [
    { value: 'PROPOSED', label: 'Proposed', icon: <Lightbulb className="h-4 w-4" />, color: 'text-blue-600' },
    { value: 'PLANNED', label: 'Planned', icon: <Calendar className="h-4 w-4" />, color: 'text-purple-600' },
    { value: 'IN_PROGRESS', label: 'In Progress', icon: <Clock className="h-4 w-4" />, color: 'text-yellow-600' },
    { value: 'COMPLETED', label: 'Completed', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
    { value: 'BLOCKED', label: 'Blocked', icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-600' }
  ];

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

  const [updateWorkItem, { loading: updatingNode }] = useMutation(UPDATE_WORK_ITEM, {
    // Smart cache updates instead of aggressive network fetching
    refetchQueries: [
      { 
        query: GET_WORK_ITEMS,
        variables: { options: { limit: 100 } }
      },
      { 
        query: GET_WORK_ITEMS,
        variables: { where: { teamId: currentTeam?.id || 'team-1' } }
      }
    ],
    awaitRefetchQueries: true,
    notifyOnNetworkStatusChange: true,
    update: (cache, { data }) => {
      // Force cache invalidation for immediate UI updates across all views
      if (data?.updateWorkItems?.workItems) {
        // Invalidate all workItems cache to force UI refresh
        cache.evict({ fieldName: 'workItems' });
        cache.gc();
        
        // Also evict root query to ensure complete refresh
        cache.evict({ 
          id: 'ROOT_QUERY',
          fieldName: 'workItems'
        });
      }
    }
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
    }
  }, [isOpen, node]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      
      const updateInput = {
        ...cleanFormData,
        priorityComp: (formData.priorityExec + formData.priorityIndiv + formData.priorityComm) / 3,
      };

      
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
      } else {
        showError(
          'Update Failed',
          'The node update did not return valid data. Please try again.'
        );
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
              
              <NodeTypeSelector
                selectedType={formData.type}
                onTypeChange={(type) => setFormData(prev => ({ ...prev, type }))}
                placeholder="Select node type..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
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
                        <span className="text-gray-600 dark:text-gray-300 font-medium">Select status...</span>
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
                          className={`w-full px-3 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 rounded-lg group ${
                            formData.status === option.value 
                              ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700' 
                              : 'hover:shadow-sm'
                          } ${index !== 0 ? 'mt-1' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`${option.color} text-lg`}>
                                {option.icon}
                              </div>
                              <span className={`font-semibold ${
                                formData.status === option.value 
                                  ? 'text-blue-700 dark:text-blue-300' 
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {option.label}
                              </span>
                            </div>
                            {formData.status === option.value && (
                              <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs ml-2 flex-shrink-0 shadow-sm">
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
                placeholder="Describe the node..."
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
                        <Flame className="w-3 h-3 text-red-500" />
                        <div className="text-red-400 font-bold text-xs">Critical</div>
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
                        <Zap className="w-3 h-3 text-orange-500" />
                        <div className="text-orange-400 font-bold text-xs">High</div>
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
                        <Triangle className="w-3 h-3 text-yellow-500" />
                        <div className="text-yellow-400 font-bold text-xs">Moderate</div>
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
                        <Circle className="w-3 h-3 text-blue-500" />
                        <div className="text-blue-400 font-bold text-xs">Low</div>
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
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-green-500/30 text-center hover:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <ArrowDown className="w-3 h-3 text-green-500" />
                        <div className="text-green-400 font-bold text-xs">Minimal</div>
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
                  {formData.priorityExec >= 0.8 ? (
                    <><Flame className="h-3 w-3 inline mr-1" />Critical</>
                  ) : formData.priorityExec >= 0.6 ? (
                    <><Zap className="h-3 w-3 inline mr-1" />High</>
                  ) : formData.priorityExec >= 0.4 ? (
                    <><Triangle className="h-3 w-3 inline mr-1" />Moderate</>
                  ) : formData.priorityExec >= 0.2 ? (
                    <><Circle className="h-3 w-3 inline mr-1" />Low</>
                  ) : (
                    <><ArrowDown className="h-3 w-3 inline mr-1" />Minimal</>
                  )} ({Math.round(formData.priorityExec * 100)}%)
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
                  {formData.priorityIndiv >= 0.8 ? (
                    <><Flame className="h-3 w-3 inline mr-1" />Critical</>
                  ) : formData.priorityIndiv >= 0.6 ? (
                    <><Zap className="h-3 w-3 inline mr-1" />High</>
                  ) : formData.priorityIndiv >= 0.4 ? (
                    <><Triangle className="h-3 w-3 inline mr-1" />Moderate</>
                  ) : formData.priorityIndiv >= 0.2 ? (
                    <><Circle className="h-3 w-3 inline mr-1" />Low</>
                  ) : (
                    <><ArrowDown className="h-3 w-3 inline mr-1" />Minimal</>
                  )} ({Math.round(formData.priorityIndiv * 100)}%)
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
                  {formData.priorityComm >= 0.8 ? (
                    <><Flame className="h-3 w-3 inline mr-1" />Critical</>
                  ) : formData.priorityComm >= 0.6 ? (
                    <><Zap className="h-3 w-3 inline mr-1" />High</>
                  ) : formData.priorityComm >= 0.4 ? (
                    <><Triangle className="h-3 w-3 inline mr-1" />Moderate</>
                  ) : formData.priorityComm >= 0.2 ? (
                    <><Circle className="h-3 w-3 inline mr-1" />Low</>
                  ) : (
                    <><ArrowDown className="h-3 w-3 inline mr-1" />Minimal</>
                  )} ({Math.round(formData.priorityComm * 100)}%)
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
                disabled={updatingNode || !isFormValid}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center space-x-2 ${
                  !isFormValid 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 disabled:bg-green-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-green-400'
                }`}
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