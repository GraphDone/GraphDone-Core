import React from 'react';
import { useMutation } from '@apollo/client';
import { X, Link } from 'lucide-react';
import { CREATE_WORK_ITEM, GET_WORK_ITEMS } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentNodeId?: string; // If provided, creates a connection to this node
  position?: { x: number; y: number; z: number }; // Position for floating nodes
}

export function CreateNodeModal({ isOpen, onClose, parentNodeId, position }: CreateNodeModalProps) {
  const { currentUser, currentTeam } = useAuth();
  
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    type: 'TASK',
    priorityExec: 0,
    priorityIndiv: 0,
    priorityComm: 0,
    status: 'PROPOSED'
  });

  const [createWorkItem, { loading: creatingWorkItem }] = useMutation(CREATE_WORK_ITEM, {
    refetchQueries: [{ 
      query: GET_WORK_ITEMS,
      variables: {
        where: {
          teamId: currentTeam?.id || 'default-team'
        }
      }
    }],
  });

  // Note: Edge creation temporarily disabled - will be implemented later
  // const [createEdge] = useMutation(CREATE_EDGE, {
  //   refetchQueries: [{ query: GET_WORK_ITEMS }],
  // });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const workItemInput = {
        ...formData,
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

      console.log('Creating work item with input:', workItemInput);
      
      const result = await createWorkItem({
        variables: { input: [workItemInput] }
      });

      console.log('Work item created successfully:', result);

      onClose();
      setFormData({
        title: '',
        description: '',
        type: 'TASK',
        priorityExec: 0,
        priorityIndiv: 0,
        priorityComm: 0,
        status: 'PROPOSED'
      });
    } catch (error) {
      console.error('Error creating work item:', error);
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
                {parentNodeId ? 'Add Connected Work Item' : 'Create New Work Item'}
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
                  This work item will be connected as a dependency to the selected node.
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
                placeholder="Enter work item title..."
              />
            </div>
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="OUTCOME">Outcome</option>
                <option value="TASK">Task</option>
                <option value="MILESTONE">Milestone</option>
                <option value="IDEA">Idea</option>
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
                placeholder="Describe the work item..."
              />
            </div>
            
            <div className="space-y-3">
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
                disabled={creatingWorkItem}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-400 rounded-lg transition-colors"
              >
                {creatingWorkItem ? 'Creating...' : (parentNodeId ? 'Create & Connect' : 'Create Work Item')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}