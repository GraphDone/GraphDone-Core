import React from 'react';
import { X } from 'lucide-react';

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateNodeModal({ isOpen, onClose }: CreateNodeModalProps) {
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    type: 'task',
    priority: {
      executive: 0,
      individual: 0,
      community: 0
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement GraphQL mutation
    onClose();
    setFormData({
      title: '',
      description: '',
      type: 'task',
      priority: {
        executive: 0,
        individual: 0,
        community: 0
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Create New Node</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter node title..."
              />
            </div>
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="outcome">Outcome</option>
                <option value="task">Task</option>
                <option value="milestone">Milestone</option>
                <option value="idea">Idea</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the node..."
              />
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Priority Settings</label>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Executive Priority (0-1)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.priority.executive}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    priority: { ...prev.priority, executive: parseFloat(e.target.value) }
                  }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 text-center">{formData.priority.executive}</div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Individual Priority (0-1)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.priority.individual}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    priority: { ...prev.priority, individual: parseFloat(e.target.value) }
                  }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 text-center">{formData.priority.individual}</div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Community Priority (0-1)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.priority.community}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    priority: { ...prev.priority, community: parseFloat(e.target.value) }
                  }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 text-center">{formData.priority.community}</div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Create Node
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}