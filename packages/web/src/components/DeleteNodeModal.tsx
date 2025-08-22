import { useMutation } from '@apollo/client';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { DELETE_WORK_ITEM, GET_WORK_ITEMS } from '../lib/queries';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

interface DeleteNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
}

export function DeleteNodeModal({ isOpen, onClose, nodeId, nodeTitle, nodeType }: DeleteNodeModalProps) {
  const { currentTeam } = useAuth();
  const { showSuccess, showError } = useNotifications();
  
  const [deleteWorkItem, { loading: deletingNode }] = useMutation(DELETE_WORK_ITEM, {
    refetchQueries: [
      { 
        query: GET_WORK_ITEMS,
        variables: {
          options: { limit: 100 }
        }
      },
      { 
        query: GET_WORK_ITEMS,
        variables: {
          where: {
            teamId: currentTeam?.id || 'team-1'
          }
        }
      }
    ],
    awaitRefetchQueries: true,
    update: (cache, { data }) => {
      if (data?.deleteWorkItems?.nodesDeleted > 0) {
        // Evict all workItems queries to ensure complete refresh across all views
        cache.evict({ fieldName: 'workItems' });
        cache.gc();
      }
    }
  });

  const handleDelete = async () => {
    try {
      
      await deleteWorkItem({
        variables: { 
          where: { id: nodeId }
        }
      });
      

      showSuccess(
        'Node Deleted Successfully!',
        `"${nodeTitle}" has been permanently removed from the graph and all connected relationships have been cleaned up.`
      );
      
      onClose();
    } catch (error) {
      
      // Determine user-friendly error message
      let errorMessage = 'Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);
        if (message.includes('NetworkError') || message.includes('fetch')) {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        } else if (message.includes('Neo4j') || message.includes('database')) {
          errorMessage = 'Database error occurred. Please contact support.';
        } else if (message.includes('not found')) {
          errorMessage = 'Node no longer exists in the database.';
        }
      }
      
      showError(
        'Failed to Delete Node',
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
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Node
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                  This action cannot be undone
                </p>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">
                Deleting this node will permanently remove it from the graph and break any existing connections.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Node to delete:</span>
                <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{nodeTitle}</p>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>Type:</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">
                          {nodeType}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-base font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 border border-green-600 dark:border-green-500 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingNode}
                className="px-4 py-2 text-base font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-red-400 dark:bg-red-600 dark:hover:bg-red-700 dark:disabled:bg-red-400 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>{deletingNode ? 'Deleting...' : 'Delete Node'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}