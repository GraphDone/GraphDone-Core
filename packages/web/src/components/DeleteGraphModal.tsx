import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useNotifications } from '../contexts/NotificationContext';

interface DeleteGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteGraphModal({ isOpen, onClose }: DeleteGraphModalProps) {
  const { currentGraph, deleteGraph } = useGraph();
  const { showSuccess, showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState<'warning' | 'confirm'>('warning');
  const [understandRisks, setUnderstandRisks] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setStep('warning');
      setConfirmText('');
      setUnderstandRisks(false);
      setConfirmDeletion(false);
    }
  }, [isOpen]);

  if (!isOpen || !currentGraph) return null;

  const isConfirmValid = confirmText === currentGraph.name;

  const handleDelete = async () => {
    if (!isConfirmValid) return;
    
    setLoading(true);
    const graphName = currentGraph.name; // Store name before deletion
    try {
      await deleteGraph(currentGraph.id);
      
      // Show success notification
      showSuccess(
        'Graph Deleted Successfully!',
        `"${graphName}" and all its data have been permanently removed.`
      );
      
      onClose();
    } catch (error) {
      console.error('Failed to delete graph:', error);
      showError(
        'Failed to Delete Graph',
        error instanceof Error ? error.message : 'An unexpected error occurred while deleting the graph. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-gray-800 rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-red-900/20 px-6 py-4 border-b border-red-600/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <h3 className="text-lg font-semibold text-red-200">Delete Graph</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Step 1: Warning and Risk Acknowledgment */}
          {step === 'warning' && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-center w-16 h-16 bg-red-900/20 rounded-full mx-auto mb-4">
                  <Shield className="h-8 w-8 text-red-400" />
                </div>
                <h4 className="text-xl font-semibold text-red-200 text-center mb-2">
                  Permanent Graph Deletion
                </h4>
                <p className="text-gray-300 text-center mb-6">
                  You are about to permanently delete <strong className="text-white">"{currentGraph.name}"</strong>
                </p>
              </div>

              {/* Risk Warning */}
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-5 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-6 w-6 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-red-200 font-semibold mb-3">What will be permanently deleted:</h4>
                    <ul className="text-red-300 text-sm space-y-2">
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        The entire graph structure and all work items
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        All connections and relationships between nodes
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        Historical data, comments, and activity logs
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        Any links to this graph from other graphs
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                        Team member access and permissions
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Confirmation Checkboxes */}
              <div className="space-y-4 mb-6">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={understandRisks}
                    onChange={(e) => setUnderstandRisks(e.target.checked)}
                    className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-600 rounded bg-gray-700"
                  />
                  <span className="text-gray-300 text-sm">
                    I understand that this action cannot be undone and all data will be permanently lost
                  </span>
                </label>
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmDeletion}
                    onChange={(e) => setConfirmDeletion(e.target.checked)}
                    className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-600 rounded bg-gray-700"
                  />
                  <span className="text-gray-300 text-sm">
                    I confirm that I want to delete "{currentGraph.name}" and understand the consequences
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!understandRisks || !confirmDeletion}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Continue to Final Step</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Final Confirmation */}
          {step === 'confirm' && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-center w-16 h-16 bg-red-900/20 rounded-full mx-auto mb-4">
                  <Trash2 className="h-8 w-8 text-red-400" />
                </div>
                <h4 className="text-xl font-semibold text-red-200 text-center mb-2">
                  Final Confirmation Required
                </h4>
                <p className="text-gray-300 text-center">
                  This is your last chance to cancel this action
                </p>
              </div>

              {/* Final Warning */}
              <div className="bg-red-900/30 border-2 border-red-600/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center mb-3">
                  <AlertTriangle className="h-6 w-6 text-red-400 mr-2" />
                  <span className="text-red-200 font-semibold">IRREVERSIBLE ACTION</span>
                </div>
                <p className="text-red-300 text-center text-sm">
                  Once you click "Delete Forever", the graph "{currentGraph.name}" and all its data will be permanently destroyed.
                </p>
              </div>

              {/* Confirmation Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  To proceed, type the exact graph name:
                </label>
                <div className="text-center mb-3">
                  <span className="text-white font-mono bg-gray-700 px-3 py-1 rounded text-sm">
                    {currentGraph.name}
                  </span>
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500 text-center"
                  placeholder="Type the graph name here"
                  autoFocus
                />
                {confirmText && confirmText !== currentGraph.name && (
                  <p className="text-red-400 text-xs mt-1 text-center">Graph name doesn't match</p>
                )}
                {isConfirmValid && (
                  <p className="text-green-400 text-xs mt-1 text-center flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Graph name confirmed
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep('warning')}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!isConfirmValid || loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{loading ? 'Deleting Forever...' : 'Delete Forever'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}