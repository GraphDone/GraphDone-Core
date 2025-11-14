import { useState, useEffect } from 'react';
import { X, Folder, FolderOpen, Plus, FileText, Save } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

interface UpdateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphToEdit: any;
}

export function UpdateGraphModal({ isOpen, onClose, graphToEdit }: UpdateGraphModalProps) {
  const { updateGraph, availableGraphs } = useGraph();
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
  const [showReviewConfig, setShowReviewConfig] = useState(true);

  // Initialize form data when modal opens or graphToEdit changes
  useEffect(() => {
    if (graphToEdit && isOpen) {
      setFormData({
        name: graphToEdit.name,
        description: graphToEdit.description || '',
        type: (graphToEdit.type as 'PROJECT' | 'WORKSPACE' | 'SUBGRAPH' | 'TEMPLATE') || 'PROJECT',
        tags: graphToEdit.tags || [],
        defaultRole: graphToEdit.defaultRole || 'VIEWER',
        status: (graphToEdit.status as 'ACTIVE' | 'ARCHIVED' | 'DRAFT') || 'ACTIVE',
        isShared: graphToEdit.isShared || false
      });
      setTagInput('');
    }
  }, [graphToEdit, isOpen]);

  if (!isOpen || !graphToEdit) return null;

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
      g.id !== graphToEdit.id &&
      g.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
    );
    if (existingGraph) {
      showError('Duplicate Name', `A graph with the name "${formData.name}" already exists. Please choose a different name.`);
      return;
    }

    setLoading(true);
    try {
      await updateGraph(graphToEdit.id, {
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
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-green-500"></div>

          {/* Modern header with glow */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/30 bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm relative">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl blur opacity-50 animate-pulse"></div>
                <Save className="h-5 w-5 text-white relative z-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
                  Edit Graph
                </h3>
                <p className="text-xs text-gray-400">Update graph settings</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-200 hover:scale-110"
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
              <div className="group/input">
                <label className="block text-sm font-semibold text-gray-200 mb-2 flex items-center space-x-1.5">
                  <span>Graph Name</span>
                  <span className="text-red-400 text-lg">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 text-sm bg-gray-800/80 border-2 border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/70 transition-all duration-200 hover:border-gray-500/70 shadow-inner"
                    placeholder="Enter a descriptive name for your graph"
                    required
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-500/5 to-emerald-500/5 pointer-events-none opacity-0 group-hover/input:opacity-100 transition-opacity"></div>
                </div>
              </div>

              {/* Description */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Description</span>
                </label>
                <div className="relative">
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 hover:border-gray-500 shadow-lg resize-none"
                    placeholder="Describe the purpose and scope of this graph"
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-500/5 to-emerald-500/5 pointer-events-none group-hover:from-green-500/10 group-hover:to-emerald-500/10 transition-all duration-300"></div>
                </div>
              </div>

              {/* Tags */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Tags (optional)</span>
                </label>
                <div className="relative">
                  <div className="w-full min-h-[4rem] px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-400 transition-all duration-300 hover:border-gray-500 shadow-lg">
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Existing Tags */}
                      {formData.tags && formData.tags.slice(0, 5).map((tag, index) => {
                        const colorScheme = colors[index % colors.length];
                        return (
                          <span
                            key={index}
                            className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-br ${colorScheme.bg} ${colorScheme.text} border-2 ${colorScheme.border} shadow-lg transform hover:scale-105 transition-all duration-200`}
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(index)}
                              className="ml-2 hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:rotate-90"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}

                      {/* Tag Input */}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={handleTagInputChange}
                        onKeyDown={handleTagInput}
                        placeholder={(!formData.tags || formData.tags.length === 0) ? "Add tags (comma-separated)" : formData.tags.length >= 5 ? "Max 5 tags" : "Add more"}
                        className="flex-1 min-w-[200px] bg-transparent border-none outline-none text-gray-200 placeholder-gray-500"
                        disabled={formData.tags && formData.tags.length >= 5}
                      />
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none group-hover:from-purple-500/10 group-hover:to-pink-500/10 transition-all duration-300"></div>
                </div>
              </div>

              {/* Default Role for Team Members */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Default Role for Team Members</span>
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
              </div>

              {/* Privacy Setting */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Privacy</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.isShared ? 'shared' : 'private'}
                    onChange={(e) => setFormData(prev => ({ ...prev, isShared: e.target.value === 'shared' }))}
                    className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all duration-300 hover:border-gray-500 shadow-lg appearance-none"
                  >
                    <option value="private" className="bg-gray-800 text-white">Private - Only you and invited members</option>
                    <option value="shared" className="bg-gray-800 text-white">Shared - Everyone in your team</option>
                  </select>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/5 to-blue-500/5 pointer-events-none group-hover:from-indigo-500/10 group-hover:to-blue-500/10 transition-all duration-300"></div>
                </div>
              </div>

              {/* Status */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                  <span>Status</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.status || 'DRAFT'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400 transition-all duration-300 hover:border-gray-500 shadow-lg appearance-none"
                  >
                    <option value="DRAFT" className="bg-gray-800 text-white">Draft - Work in progress</option>
                    <option value="ACTIVE" className="bg-gray-800 text-white">Active - Published and ready</option>
                  </select>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500/5 to-cyan-500/5 pointer-events-none group-hover:from-teal-500/10 group-hover:to-cyan-500/10 transition-all duration-300"></div>
                </div>
              </div>

              {/* Review Configuration - Modern Collapsible */}
              <div className="border-2 border-gray-600/40 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-gray-800/40 to-gray-900/40">
                <button
                  type="button"
                  onClick={() => setShowReviewConfig(!showReviewConfig)}
                  className="w-full p-4 bg-gradient-to-r from-gray-700/40 to-gray-800/40 hover:from-gray-700/60 hover:to-gray-800/60 transition-all duration-200 flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-white">Review Configuration</h4>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-300 group-hover:text-white ${showReviewConfig ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>

                {showReviewConfig && (
                  <div className="p-5 bg-gray-900/20 border-t border-gray-700/50">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-2">
                        <div className="flex justify-between p-3 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-colors shadow-sm">
                          <span className="text-gray-400 font-medium">Type:</span>
                          <span className="font-semibold text-blue-300 capitalize">{formData.type?.toLowerCase()}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-colors shadow-sm">
                          <span className="text-gray-400 font-medium">Privacy:</span>
                          <span className="font-semibold text-cyan-300">{formData.isShared ? 'Shared' : 'Private'}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-colors shadow-sm">
                          <span className="text-gray-400 font-medium">Status:</span>
                          <span className={`font-semibold ${formData.status === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'}`}>
                            {formData.status || 'Draft'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between p-3 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-colors shadow-sm">
                          <span className="text-gray-400 font-medium">Team:</span>
                          <span className="font-semibold text-purple-300">{currentTeam?.name || 'Default'}</span>
                        </div>
                        {formData.tags && formData.tags.length > 0 && (
                          <div className="flex justify-between p-3 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-colors shadow-sm">
                            <span className="text-gray-400 font-medium">Tags:</span>
                            <span className="font-semibold text-indigo-300">{formData.tags.length} tag{formData.tags.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        <div className="flex justify-between p-3 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-colors shadow-sm">
                          <span className="text-gray-400 font-medium">Ready:</span>
                          <span className={`font-semibold ${formData.name ? 'text-green-300' : 'text-red-300'}`}>
                            {formData.name ? 'Yes' : 'Name Required'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gradient-to-r from-gray-600/30 via-gray-500/50 to-gray-600/30 relative z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/80 to-gray-600/80 rounded-xl hover:bg-red-600 hover:text-white transition-all duration-300 hover:scale-105 shadow-lg backdrop-blur-sm border border-gray-500/30 hover:border-red-600 font-medium"
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