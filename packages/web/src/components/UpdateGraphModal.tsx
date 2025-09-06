import { useState, useEffect } from 'react';
import { X, Folder, FolderOpen, Plus, FileText, Save } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

interface UpdateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpdateGraphModal({ isOpen, onClose }: UpdateGraphModalProps) {
  const { currentGraph, updateGraph, availableGraphs } = useGraph();
  const { currentTeam } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'PROJECT' as 'PROJECT' | 'WORKSPACE' | 'SUBGRAPH' | 'TEMPLATE',
    tags: [] as string[],
    defaultRole: 'VIEWER',
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
        defaultRole: currentGraph.defaultRole || 'VIEWER',
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
      showError('Validation Error', 'Please enter a graph name');
      return;
    }

    // Check for duplicate graph names (excluding current graph)
    const existingGraph = availableGraphs.find(g => 
      g.id !== currentGraph.id && 
      g.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
    );
    if (existingGraph) {
      showError('Duplicate Name', `A graph with the name "${formData.name}" already exists. Please choose a different name.`);
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
      
      // Show success notification
      showSuccess(
        'Graph Updated Successfully!',
        `"${formData.name}" has been updated with your changes.`
      );
      
      onClose();
    } catch (error) {
      console.error('Failed to update graph:', error);
      showError(
        'Failed to Update Graph',
        error instanceof Error ? error.message : 'An unexpected error occurred while updating the graph. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Enhanced Backdrop with gradient */}
        <div 
          className="fixed inset-0 transition-opacity bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-800/90 animate-in fade-in duration-300"
          onClick={onClose}
        />

        {/* Enhanced Modal with better styling */}
        <div className="inline-block align-bottom bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full border border-gray-600/50 animate-in slide-in-from-bottom-4 duration-300 relative">
          {/* Gradient accent line at top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"></div>
          
          {/* Enhanced Header with gradient background */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-600/50 bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <Save className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-white via-green-100 to-blue-100 bg-clip-text text-transparent">Edit Graph</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-8 pt-0 pb-8 max-h-[70vh] overflow-y-auto relative">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="w-full h-full" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                backgroundSize: '20px 20px'
              }}></div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            {/* Graph Details */}
            <div className="space-y-6 mb-8">
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
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Graph Name</span>
                  <span className="text-red-400">*</span>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-300 hover:border-gray-500 shadow-lg"
                    placeholder="Enter a descriptive name for your graph"
                    required
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-all duration-300"></div>
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  <span>Choose a clear, descriptive name that team members will recognize</span>
                </p>
              </div>

              {/* Description */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Description</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </label>
                <div className="relative">
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 hover:border-gray-500 shadow-lg resize-none"
                    placeholder="Describe the purpose and scope of your graph"
                    rows={4}
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-500/5 to-emerald-500/5 pointer-events-none group-hover:from-green-500/10 group-hover:to-emerald-500/10 transition-all duration-300"></div>
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                  <span>Optional but recommended for team collaboration</span>
                </p>
              </div>

              {/* Tags */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Tags</span>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                </label>
                
                {/* Enhanced Tag Display Area - matching CreateGraphModal */}
                <div className="relative">
                  <div className="w-full min-h-[3.5rem] px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-400 transition-all duration-300 hover:border-gray-500 shadow-lg">
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Existing Tags */}
                      {formData.tags && formData.tags.slice(0, 5).map((tag, index) => {
                        const colorIndex = index % colors.length;
                        const color = colors[colorIndex];
                        return (
                          <div
                            key={index}
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r ${color.bg} ${color.text} border-2 ${color.border} transition-all duration-200 hover:scale-105 shadow-md animate-in slide-in-from-left-2`}
                            style={{
                              animationDelay: `${index * 100}ms`
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
                      
                      {/* Tag Input */}
                      {formData.tags.length < 5 && (
                        <input
                          type="text"
                          value={tagInput}
                          onChange={handleTagInputChange}
                          onKeyDown={handleTagInput}
                          placeholder={formData.tags.length === 0 ? "Type and press comma to add tags (max 5)" : "Add more tags"}
                          className="flex-1 min-w-[200px] px-2 py-1 bg-transparent border-0 outline-0 text-white placeholder-gray-400 text-sm"
                        />
                      )}
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none group-hover:from-purple-500/10 group-hover:to-pink-500/10 transition-all duration-300"></div>
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                  <span>Type and press comma to add tags (max 5) • Click × to remove</span>
                </p>
              </div>

              {/* Default Role for Team Members */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Default Role for Team Members</span>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                </label>
                <div className="relative">
                  <select
                    value={formData.defaultRole}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultRole: e.target.value }))}
                    className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 transition-all duration-300 hover:border-gray-500 shadow-lg appearance-none"
                  >
                    <option value="GUEST" className="bg-gray-800 text-white">Guest - Anonymous demo access (read-only)</option>
                    <option value="VIEWER" className="bg-gray-800 text-white">Viewer - Can view graphs and nodes (read-only)</option>
                    <option value="USER" className="bg-gray-800 text-white">User - Can create and work on tasks</option>
                    <option value="ADMIN" className="bg-gray-800 text-white">Admin - Full system administration access</option>
                  </select>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/5 to-red-500/5 pointer-events-none group-hover:from-orange-500/10 group-hover:to-red-500/10 transition-all duration-300"></div>
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                  <span>Default permission level for new team members joining this graph</span>
                </p>
              </div>

              {/* Additional Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Privacy Setting */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                    <span>Privacy</span>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.isShared ? 'shared' : 'private'}
                      onChange={(e) => setFormData(prev => ({ ...prev, isShared: e.target.value === 'shared' }))}
                      className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all duration-300 hover:border-gray-500 shadow-lg appearance-none"
                    >
                      <option value="private" className="bg-gray-800 text-white">Private to team</option>
                      <option value="shared" className="bg-gray-800 text-white">Shared with others</option>
                    </select>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/5 to-blue-500/5 pointer-events-none group-hover:from-indigo-500/10 group-hover:to-blue-500/10 transition-all duration-300"></div>
                  </div>
                </div>

                {/* Status */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                    <span>Status</span>
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'ACTIVE' | 'ARCHIVED' | 'DRAFT' }))}
                      className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400 transition-all duration-300 hover:border-gray-500 shadow-lg appearance-none"
                    >
                      <option value="DRAFT" className="bg-gray-800 text-white">Draft</option>
                      <option value="ACTIVE" className="bg-gray-800 text-white">Active</option>
                      <option value="ARCHIVED" className="bg-gray-800 text-white">Archived</option>
                    </select>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500/5 to-cyan-500/5 pointer-events-none group-hover:from-teal-500/10 group-hover:to-cyan-500/10 transition-all duration-300"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gradient-to-r from-gray-600/30 via-gray-500/50 to-gray-600/30 relative z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/80 to-gray-600/80 rounded-xl hover:from-gray-600/80 hover:to-gray-500/80 transition-all duration-300 hover:scale-105 shadow-lg backdrop-blur-sm border border-gray-500/30 hover:border-gray-400/50 hover:text-white font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform border border-blue-400/30 font-semibold flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100"
              >
                <Save className="w-5 h-5" />
                <span>{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}