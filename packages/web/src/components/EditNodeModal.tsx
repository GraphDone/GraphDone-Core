import React from 'react';
import { useMutation } from '@apollo/client';
import { X, Edit, Save } from 'lucide-react';
import { UPDATE_WORK_ITEM, GET_WORK_ITEMS } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';

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
  const { currentTeam, currentUser } = useAuth();
  
  const [formData, setFormData] = React.useState({
    title: node.title,
    description: node.description || '',
    type: node.type,
    status: node.status,
    priorityExec: node.priorityExec || 0,
    priorityIndiv: node.priorityIndiv || 0,
    priorityComm: node.priorityComm || 0,
  });

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
      });
    }
  }, [isOpen, node]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updateInput = {
        ...formData,
        priorityComp: (formData.priorityExec + formData.priorityIndiv + formData.priorityComm) / 3,
      };

      console.log('Updating node with input:', updateInput);
      
      const result = await updateWorkItem({
        variables: { 
          id: node.id,
          input: updateInput
        }
      });

      console.log('Node updated successfully:', result);
      onClose();
    } catch (error) {
      console.error('Error updating node:', error);
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
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Node Type
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="EPIC">Epic</option>
                <option value="STORY">Story</option>
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="MILESTONE">Milestone</option>
                <option value="IDEA">Idea</option>
                <option value="SPIKE">Spike</option>
                <option value="DOCUMENTATION">Documentation</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="PROPOSED">Proposed</option>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="BLOCKED">Blocked</option>
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
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority Settings</label>
              
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Executive Priority (0-1)
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
                  className="w-full accent-blue-500"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{formData.priorityExec}</div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Individual Priority (0-1)
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
                  className="w-full accent-blue-500"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{formData.priorityIndiv}</div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Community Priority (0-1)
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
                  className="w-full accent-blue-500"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{formData.priorityComm}</div>
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
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-400 rounded-lg transition-colors flex items-center space-x-2"
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