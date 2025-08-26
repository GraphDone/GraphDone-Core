import { useState, useEffect } from 'react';
import { X, Folder, FolderOpen, Plus, FileText, Save } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';

interface UpdateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpdateGraphModal({ isOpen, onClose }: UpdateGraphModalProps) {
  const { currentGraph, updateGraph } = useGraph();
  const { currentTeam } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'PROJECT' as 'PROJECT' | 'WORKSPACE' | 'SUBGRAPH' | 'TEMPLATE',
    tags: [] as string[],
    defaultRole: 'NodeWatcher',
    status: 'ACTIVE' as 'ACTIVE' | 'ARCHIVED' | 'DRAFT',
    isShared: false
  });

  const [tagInput, setTagInput] = useState<string>('');

  // Initialize form data when modal opens or currentGraph changes
  useEffect(() => {
    if (currentGraph && isOpen) {
      setFormData({
        name: currentGraph.name,
        description: currentGraph.description || '',
        type: (currentGraph.type as 'PROJECT' | 'WORKSPACE' | 'SUBGRAPH' | 'TEMPLATE') || 'PROJECT',
        tags: currentGraph.tags || [],
        defaultRole: currentGraph.defaultRole || 'NodeWatcher',
        status: (currentGraph.status as 'ACTIVE' | 'ARCHIVED' | 'DRAFT') || 'ACTIVE',
        isShared: currentGraph.isShared || false
      });
      setTagInput('');
    }
  }, [currentGraph, isOpen]);

  if (!isOpen || !currentGraph) return null;

  const graphTypes = [
    {
      type: 'PROJECT' as const,
      title: 'Project',
      description: 'A main project with goals, tasks, and deliverables',
      icon: <Folder className="h-8 w-8 text-blue-400" />,
      color: 'border-blue-500/50 bg-blue-900/20 hover:bg-blue-900/30'
    },
    {
      type: 'WORKSPACE' as const,
      title: 'Workspace',
      description: 'A collaborative space for brainstorming and experimentation',
      icon: <FolderOpen className="h-8 w-8 text-purple-400" />,
      color: 'border-purple-500/50 bg-purple-900/20 hover:bg-purple-900/30'
    },
    {
      type: 'SUBGRAPH' as const,
      title: 'Subgraph',
      description: 'A focused subset within a larger project or workspace',
      icon: <Plus className="h-8 w-8 text-green-400" />,
      color: 'border-green-500/50 bg-green-900/20 hover:bg-green-900/30'
    },
    {
      type: 'TEMPLATE' as const,
      title: 'Template',
      description: 'A reusable template for creating similar graphs',
      icon: <FileText className="h-8 w-8 text-orange-400" />,
      color: 'border-orange-500/50 bg-orange-900/20 hover:bg-orange-900/30'
    }
  ];

  const roleOptions = [
    { value: 'GUEST', label: 'Guest', description: 'Anonymous demo access (read-only)' },
    { value: 'VIEWER', label: 'Viewer', description: 'Can view graphs and nodes (read-only)' },
    { value: 'USER', label: 'User', description: 'Can create and work on tasks' },
    { value: 'ADMIN', label: 'Admin', description: 'Full system administration access' }
  ];

  // Tag handling functions (same as CreateGraphModal)
  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.includes(',')) {
      const parts = value.split(',');
      const newTag = parts[0].trim();
      if (newTag) {
        addTagFromString(newTag);
      }
      setTagInput(parts.slice(1).join(','));
    } else {
      setTagInput(value);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 5) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  const addTagFromString = (tag: string) => {
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 5) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const removeTag = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, index) => index !== indexToRemove)
    }));
  };

  const colors = [
    { bg: 'from-blue-600/40 to-indigo-600/40', text: 'text-blue-100', border: 'border-blue-400/60 hover:border-blue-400/80' },
    { bg: 'from-green-600/40 to-emerald-600/40', text: 'text-green-100', border: 'border-green-400/60 hover:border-green-400/80' },
    { bg: 'from-purple-600/40 to-violet-600/40', text: 'text-purple-100', border: 'border-purple-400/60 hover:border-purple-400/80' },
    { bg: 'from-orange-600/40 to-red-600/40', text: 'text-orange-100', border: 'border-orange-400/60 hover:border-orange-400/80' },
    { bg: 'from-pink-600/40 to-rose-600/40', text: 'text-pink-100', border: 'border-pink-400/60 hover:border-pink-400/80' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    setLoading(true);
    try {
      await updateGraph(currentGraph.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        tags: formData.tags,
        defaultRole: formData.defaultRole,
        status: formData.status,
        isShared: formData.isShared
      });
      onClose();
    } catch (error) {
      console.error('Failed to update graph:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-gray-800 rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-800 px-6 py-4 border-b border-gray-600">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Edit Graph</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Graph Details */}
            <div className="space-y-4">
              {/* Current Graph Type Display */}
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-3">
                  {(() => {
                    const currentType = graphTypes.find(type => type.type === formData.type);
                    return currentType ? (
                      <>
                        {currentType.icon}
                        <div>
                          <p className="text-white font-medium">{currentType.title}</p>
                          <p className="text-gray-400 text-sm">{currentType.description}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400">Unknown graph type</p>
                    );
                  })()}
                </div>
              </div>

              {/* Graph Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Graph Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                  placeholder="Enter a descriptive name for your graph"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                  placeholder="Describe the purpose and scope of your graph"
                  rows={3}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags / Categories
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={handleTagInputChange}
                    onKeyDown={handleTagInput}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                    placeholder="Type and press comma to add tags (max 5)"
                    disabled={formData.tags.length >= 5}
                  />
                  <p className="text-xs text-gray-500">Type and press comma to add tags (max 5)</p>
                  
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => {
                        const colorIndex = index % colors.length;
                        const color = colors[colorIndex];
                        return (
                          <div
                            key={index}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border-2 bg-gradient-to-r ${color.bg} ${color.text} ${color.border} cursor-pointer hover:scale-105 transition-all duration-200 shadow-sm`}
                            style={{
                              clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)'
                            }}
                          >
                            <span className="mr-2">{tag}</span>
                            <button
                              type="button"
                              onClick={() => removeTag(index)}
                              className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Default Role for Team Members */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Role for Team Members
                </label>
                <select
                  value={formData.defaultRole}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultRole: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                >
                  <option value="NodeWatcher">NodeWatcher - View only access</option>
                  <option value="Connector">Connector - Can create connections between nodes</option>
                  <option value="OriginNode">OriginNode - Can create and edit nodes</option>
                  <option value="PathKeeper">PathKeeper - Can manage workflows and paths</option>
                  <option value="GraphMaster">GraphMaster - Full administrative access</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Default permission level for new team members joining this graph</p>
              </div>

              {/* Additional Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Privacy Setting */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Privacy
                  </label>
                  <select
                    value={formData.isShared ? 'shared' : 'private'}
                    onChange={(e) => setFormData(prev => ({ ...prev, isShared: e.target.value === 'shared' }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="private">Private to team</option>
                    <option value="shared">Shared with others</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'ACTIVE' | 'ARCHIVED' | 'DRAFT' }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-600">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}