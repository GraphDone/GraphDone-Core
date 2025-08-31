import { useState } from 'react';
import { X, Folder, FolderOpen, Plus, Copy, FileText } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { CreateGraphInput } from '../types/graph';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentGraphId?: string;
}

export function CreateGraphModal({ isOpen, onClose, parentGraphId }: CreateGraphModalProps) {
  const { currentTeam, currentUser } = useAuth();
  const { createGraph, availableGraphs, isCreating } = useGraph();
  const { showSuccess, showError } = useNotifications();
  
  const [step, setStep] = useState<'type' | 'details' | 'template'>('type');
  const [formData, setFormData] = useState<Partial<CreateGraphInput>>({
    type: 'PROJECT',
    parentGraphId,
    teamId: currentTeam?.id || 'default-team',
    tags: [],
    defaultRole: 'VIEWER',
    isShared: false,
    status: 'DRAFT'
  });
  
  const [tagInput, setTagInput] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);

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
      icon: <FileText className="h-8 w-8 text-gray-500" />,
      color: 'border-gray-600/50 bg-gray-800/20 cursor-not-allowed opacity-60',
      disabled: true,
      comingSoon: true
    }
  ];

  const templates = [
    {
      id: 'agile-project',
      name: 'Agile Project',
      description: 'Sprint planning, user stories, and backlog management',
      type: 'PROJECT' as const,
      nodeCount: 25
    },
    {
      id: 'product-roadmap',
      name: 'Product Roadmap',
      description: 'Feature planning and release timeline',
      type: 'PROJECT' as const,
      nodeCount: 18
    },
    {
      id: 'research-workspace',
      name: 'Research Workspace',
      description: 'Hypothesis, experiments, and findings',
      type: 'WORKSPACE' as const,
      nodeCount: 15
    },
    {
      id: 'feature-development',
      name: 'Feature Development',
      description: 'Design, development, testing, and deployment',
      type: 'SUBGRAPH' as const,
      nodeCount: 12
    }
  ];

  const copyableGraphs = availableGraphs.filter(graph => 
    graph.teamId === currentTeam?.id && graph.type === formData.type
  );

  const handleSubmit = async () => {
    console.log('=== CREATE GRAPH SUBMISSION START ===');
    console.log('Current user:', currentUser);
    console.log('Current team:', currentTeam);
    console.log('Form data before validation:', formData);
    
    if (!formData.name) {
      console.error('Graph name is required');
      alert('Please enter a graph name');
      return;
    }
    
    // For development: provide fallback team and user if authentication is not set up
    const fallbackTeamId = currentTeam?.id || formData.teamId || 'default-team';
    const fallbackUserId = currentUser?.id || 'default-user';
    
    console.log('Using team ID:', fallbackTeamId);
    console.log('Using user ID:', fallbackUserId);

    try {
      const graphInput = {
        ...formData,
        teamId: fallbackTeamId,
        // Ensure we have a user ID for createdBy field
        createdBy: fallbackUserId
      };
      
      console.log('Creating graph with data:', graphInput);
      console.log('Tags in form data:', formData.tags);
      await createGraph(graphInput as CreateGraphInput);
      
      // Show success notification
      showSuccess(
        'Graph Created Successfully!',
        `"${formData.name}" has been created and is ready for use.`
      );
      
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating graph:', error);
      showError(
        'Failed to Create Graph',
        error instanceof Error ? error.message : 'An unexpected error occurred while creating the graph. Please try again.'
      );
    }
  };

  const resetForm = () => {
    setStep('type');
    setShowTemplates(false);
    setTagInput('');
    setFormData({
      type: 'PROJECT',
      parentGraphId,
      teamId: currentTeam?.id || 'default-team',
      tags: [],
      defaultRole: 'VIEWER',
      isShared: false,
      status: 'DRAFT'
    });
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-black bg-opacity-50"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl p-0 my-8 overflow-hidden text-left align-middle transition-all transform bg-gray-800 shadow-xl rounded-lg border border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
            <h3 className="text-xl font-semibold text-green-300">
              {step === 'type' && 'Create New Graph'}
              {step === 'details' && 'Graph Details'}
              {step === 'template' && 'Choose Starting Point'}
            </h3>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step 1: Choose Type */}
          {step === 'type' && (
            <div className="p-6 space-y-6">
              <p className="text-gray-300">What type of graph would you like to create?</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {graphTypes.map((type) => (
                  <button
                    key={type.type}
                    onClick={() => type.disabled ? null : setFormData(prev => ({ ...prev, type: type.type }))}
                    disabled={type.disabled}
                    title={type.comingSoon ? "Template functionality coming soon!" : undefined}
                    className={`p-4 border-2 rounded-lg text-left transition-all relative ${
                      formData.type === type.type
                        ? `${type.color} border-current`
                        : type.disabled
                        ? type.color
                        : 'border-gray-600 bg-gray-700/50 hover:bg-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {type.comingSoon && (
                      <div className="absolute top-2 right-2 bg-gray-700 text-xs text-gray-400 px-2 py-1 rounded">
                        Coming Soon
                      </div>
                    )}
                    <div className="flex items-center space-x-3 mb-3">
                      {type.icon}
                      <h4 className={`font-semibold ${type.disabled ? 'text-gray-500' : 'text-gray-200'}`}>{type.title}</h4>
                    </div>
                    <p className={`text-sm ${type.disabled ? 'text-gray-500' : 'text-gray-400'}`}>{type.description}</p>
                  </button>
                ))}
              </div>

              {parentGraphId && (
                <div className="p-4 bg-blue-900/20 border border-blue-600/30 rounded-xl">
                  <div className="flex items-center space-x-2 text-blue-300">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Creating subgraph</span>
                  </div>
                  <p className="text-sm text-blue-400 mt-1">
                    This graph will be created as a child of the selected parent graph.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('template')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Choose Template/Starting Point */}
          {step === 'template' && (
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-200 mb-2">Choose Starting Point</h4>
                <p className="text-gray-400 text-sm mb-6">Select how you want to create your graph</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setShowTemplates(false);
                    setFormData(prev => ({ ...prev, templateId: undefined, copyFromGraphId: undefined }));
                  }}
                  className={`p-4 border-2 rounded-xl text-center transition-all ${
                    !showTemplates && !formData.copyFromGraphId
                      ? 'border-green-500 bg-green-900/20 text-white'
                      : 'border-gray-600 bg-gray-700/30 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-600 rounded-lg flex items-center justify-center">
                    <Plus className="h-6 w-6 text-gray-300" />
                  </div>
                  <h5 className="font-medium mb-1">Start Empty</h5>
                  <p className="text-xs text-gray-400">Create a blank graph from scratch</p>
                </button>
                
                <button
                  disabled
                  title="Template functionality coming soon!"
                  className="p-4 border-2 rounded-xl text-center transition-all border-gray-700 bg-gray-800/30 text-gray-500 cursor-not-allowed opacity-60 relative"
                >
                  <div className="absolute top-2 right-2 bg-gray-700 text-xs text-gray-400 px-2 py-1 rounded">
                    Coming Soon
                  </div>
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-700/50 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-gray-500" />
                  </div>
                  <h5 className="font-medium mb-1">Use Template</h5>
                  <p className="text-xs text-gray-500">Start with a pre-built template</p>
                </button>

                {copyableGraphs.length > 0 && (
                  <button
                    onClick={() => {
                      setShowTemplates(false);
                      setFormData(prev => ({ ...prev, templateId: undefined, copyFromGraphId: 'select' }));
                    }}
                    className={`p-4 border-2 rounded-xl text-center transition-all ${
                      formData.copyFromGraphId
                        ? 'border-green-500 bg-green-900/20 text-white'
                        : 'border-gray-600 bg-gray-700/30 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 bg-purple-600/20 rounded-lg flex items-center justify-center">
                      <Copy className="h-6 w-6 text-purple-400" />
                    </div>
                    <h5 className="font-medium mb-1">Copy Existing</h5>
                    <p className="text-xs text-gray-400">Duplicate an existing graph</p>
                  </button>
                )}
              </div>

              {/* Templates */}
              {showTemplates && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-200">Available Templates</h4>
                  {templates.filter(template => template.type === formData.type).length > 0 ? (
                    <div className="grid gap-3">
                      {templates
                        .filter(template => template.type === formData.type)
                        .map((template) => (
                          <button
                            key={template.id}
                            disabled
                            title="Template functionality coming soon!"
                            className="p-4 border rounded-lg text-left cursor-not-allowed opacity-60 relative border-gray-700 bg-gray-800/30"
                          >
                            <div className="absolute top-2 right-2 bg-gray-700 text-xs text-gray-400 px-2 py-1 rounded">
                              Coming Soon
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="font-medium text-gray-500">{template.name}</h5>
                                <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                              </div>
                              <div className="text-sm text-gray-500">
                                {template.nodeCount} nodes
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-600 rounded-lg bg-gray-700/30">
                      <div className="text-gray-400 mb-2">
                        <svg className="w-8 h-8 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">We're working on adding templates</p>
                      <p className="text-xs text-gray-500">Meanwhile, you can create a graph and continue</p>
                    </div>
                  )}
                </div>
              )}

              {/* Copy from existing */}
              {formData.copyFromGraphId && copyableGraphs.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-200 mb-1">Choose Graph to Copy</h4>
                    <p className="text-sm text-gray-400">Select an existing graph to duplicate</p>
                  </div>
                  <div className="grid gap-3 max-h-48 overflow-y-auto">
                    {copyableGraphs.map((graph) => (
                      <button
                        key={graph.id}
                        onClick={() => setFormData(prev => ({ ...prev, copyFromGraphId: graph.id }))}
                        className={`p-4 border rounded-xl text-left transition-all group ${
                          formData.copyFromGraphId === graph.id
                            ? 'border-green-500 bg-green-900/20'
                            : 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50 hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              graph.type === 'PROJECT' ? 'bg-blue-600/20' :
                              graph.type === 'WORKSPACE' ? 'bg-purple-600/20' :
                              graph.type === 'SUBGRAPH' ? 'bg-green-600/20' :
                              'bg-orange-600/20'
                            }`}>
                              <Copy className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-200 group-hover:text-white">{graph.name}</h5>
                              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{graph.description || 'No description'}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  graph.type === 'PROJECT' ? 'bg-blue-600/20 text-blue-300' :
                                  graph.type === 'WORKSPACE' ? 'bg-purple-600/20 text-purple-300' :
                                  graph.type === 'SUBGRAPH' ? 'bg-green-600/20 text-green-300' :
                                  'bg-orange-600/20 text-orange-300'
                                }`}>
                                  {graph.type}
                                </span>
                                <span className="text-xs text-gray-500">{graph.nodeCount} nodes</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('type')}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Graph Details */}
          {step === 'details' && (
            <div className="p-6 space-y-6">
              <div className="mb-6">
                <p className="text-gray-400 text-sm">Provide essential information to set up your graph</p>
              </div>

              <div className="space-y-5">
                {/* Graph Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Graph Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => {
                      console.log('Name input changed to:', e.target.value);
                      setFormData(prev => {
                        const newData = { ...prev, name: e.target.value };
                        console.log('New form data will be:', newData);
                        return newData;
                      });
                    }}
                    placeholder="Enter a descriptive name for your graph"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">Choose a clear, descriptive name that team members will recognize</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the purpose and scope of this graph"
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Help team members understand the purpose and context</p>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Tags
                  </label>
                  
                  {/* Tag Display Area */}
                  <div className="w-full min-h-[3rem] px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-colors">
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Existing Tags */}
                      {formData.tags && formData.tags.slice(0, 5).map((tag, index) => {
                        const colors = [
                          { bg: 'from-blue-600/40 to-indigo-600/40', text: 'text-blue-100', border: 'border-blue-400/60 hover:border-blue-400/80' },
                          { bg: 'from-green-600/40 to-emerald-600/40', text: 'text-green-100', border: 'border-green-400/60 hover:border-green-400/80' },
                          { bg: 'from-purple-600/40 to-violet-600/40', text: 'text-purple-100', border: 'border-purple-400/60 hover:border-purple-400/80' },
                          { bg: 'from-orange-600/40 to-red-600/40', text: 'text-orange-100', border: 'border-orange-400/60 hover:border-orange-400/80' },
                          { bg: 'from-pink-600/40 to-rose-600/40', text: 'text-pink-100', border: 'border-pink-400/60 hover:border-pink-400/80' },
                        ];
                        const colorScheme = colors[index % colors.length];
                        
                        return (
                          <span
                            key={index}
                            className={`inline-flex items-center pl-2 pr-3 py-1 text-sm font-medium bg-gradient-to-r ${colorScheme.bg} ${colorScheme.text} border ${colorScheme.border} transition-colors`}
                            style={{
                              clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)'
                            }}
                          >
                            {/* Tag Icon */}
                            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M17.707 9.293l-5-5A.997.997 0 0012 4H5a3 3 0 00-3 3v6a3 3 0 003 3h7a.997.997 0 00.707-.293l5-5a.999.999 0 000-1.414zM6.5 9.5a1.5 1.5 0 111.5-1.5 1.5 1.5 0 01-1.5 1.5z" clipRule="evenodd" />
                            </svg>
                            {tag}
                            <button
                              type="button"
                              onClick={() => {
                                const newTags = formData.tags?.filter((_, i) => i !== index) || [];
                                setFormData(prev => ({ ...prev, tags: newTags }));
                                // Don't update tagInput when removing tags - keep it for current typing
                              }}
                              className={`ml-2 transition-colors ${colorScheme.text.replace('text-', 'text-')}/60 hover:${colorScheme.text}`}
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                      
                      {/* Input Field */}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTagInput(value);
                          
                          // Process tags when user types comma or space
                          if (value.includes(',') || value.includes(' ')) {
                            const separator = value.includes(',') ? ',' : ' ';
                            const newTags = value.split(separator).map(tag => tag.trim()).filter(tag => tag.length > 0);
                            const existingTags = formData.tags || [];
                            const allTags = [...existingTags, ...newTags.slice(0, -1)]
                              .filter((tag, index, arr) => arr.indexOf(tag) === index) // Remove duplicates
                              .slice(0, 5); // Limit to 5 tags
                            
                            setFormData(prev => ({ 
                              ...prev, 
                              tags: allTags
                            }));
                            
                            // Keep the last part (after last separator) as current input
                            const remainingInput = newTags[newTags.length - 1] || '';
                            setTagInput(remainingInput);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            if (tagInput.trim()) {
                              const existingTags = formData.tags || [];
                              const newTag = tagInput.trim();
                              if (!existingTags.includes(newTag) && existingTags.length < 5) {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  tags: [...existingTags, newTag]
                                }));
                              }
                              setTagInput('');
                            }
                          } else if (e.key === 'Backspace' && tagInput === '' && formData.tags && formData.tags.length > 0) {
                            // Remove last tag when backspacing on empty input
                            const newTags = formData.tags.slice(0, -1);
                            setFormData(prev => ({ ...prev, tags: newTags }));
                          }
                        }}
                        placeholder={(!formData.tags || formData.tags.length === 0) ? "project, frontend, urgent, team-alpha" : formData.tags.length >= 5 ? "Maximum 5 tags reached" : "Add more tags..."}
                        className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-gray-200 placeholder-gray-400"
                        disabled={formData.tags && formData.tags.length >= 5}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Type and press comma to add tags (max 5) • Click × to remove</p>
                </div>

                {/* Default Role for Team Members */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Default Role for Team Members
                  </label>
                  <select
                    value={formData.defaultRole || 'VIEWER'}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultRole: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                  >
                    <option value="GUEST">Guest - Anonymous demo access (read-only)</option>
                    <option value="VIEWER">Viewer - Can view graphs and nodes (read-only)</option>
                    <option value="USER">User - Can create and work on tasks</option>
                    <option value="ADMIN">Admin - Full system administration access</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Default permission level for new team members joining this graph</p>
                </div>

                {/* Additional Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Privacy Setting */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Privacy
                    </label>
                    <select
                      value={formData.isShared ? 'shared' : 'private'}
                      onChange={(e) => setFormData(prev => ({ ...prev, isShared: e.target.value === 'shared' }))}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    >
                      <option value="private">Private to team</option>
                      <option value="shared">Shared with others</option>
                    </select>
                  </div>

                  {/* Initial Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Initial Status
                    </label>
                    <select
                      value={formData.status || 'DRAFT'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                    </select>
                  </div>
                </div>

                {/* Configuration Summary */}
                <div className="p-5 bg-gray-700/50 border border-gray-600 rounded-xl">
                  <h4 className="font-semibold text-gray-200 mb-4 flex items-center">
                    <div className="w-5 h-5 bg-green-600 rounded-full mr-2"></div>
                    Review Configuration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Graph Type:</span>
                        <span className="font-medium text-gray-200 capitalize">{formData.type?.toLowerCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Team:</span>
                        <span className="font-medium text-gray-200">{currentTeam?.name || 'Default Team'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Privacy:</span>
                        <span className="font-medium text-gray-200">{formData.isShared ? 'Shared' : 'Private'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className={`font-medium ${formData.status === 'ACTIVE' ? 'text-green-300' : 'text-yellow-300'}`}>
                          {formData.status || 'Draft'}
                        </span>
                      </div>
                      {formData.tags && formData.tags.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Tags:</span>
                          <span className="font-medium text-blue-300">{formData.tags.length} tag{formData.tags.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Default Role:</span>
                        <span className="font-medium text-purple-300">{formData.defaultRole || 'VIEWER'}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {parentGraphId && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Parent Graph:</span>
                          <span className="font-medium text-green-300">Connected</span>
                        </div>
                      )}
                      {formData.templateId && formData.templateId !== 'use-template' && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Template:</span>
                          <span className="font-medium text-blue-300">Applied</span>
                        </div>
                      )}
                      {formData.copyFromGraphId && formData.copyFromGraphId !== 'select' && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Source:</span>
                          <span className="font-medium text-purple-300">Existing Graph</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ready to Create:</span>
                        <span className={`font-medium ${formData.name ? 'text-green-300' : 'text-red-300'}`}>
                          {formData.name ? 'Yes' : 'Name Required'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Button State:</span>
                        <span className={`font-medium ${!formData.name?.trim() || isCreating ? 'text-red-300' : 'text-green-300'}`}>
                          {!formData.name?.trim() ? 'Disabled (No Name)' : isCreating ? 'Disabled (Creating)' : 'Enabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('template')}
                  className="px-6 py-3 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  Back
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={handleClose}
                    className="px-6 py-3 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('=== BUTTON CLICK EVENT ===');
                      console.log('Form data:', formData);
                      console.log('Form data name:', formData.name);
                      console.log('Name exists?', !!formData.name);
                      console.log('Name length:', formData.name?.length);
                      console.log('isCreating:', isCreating);
                      console.log('Button should be disabled?', !formData.name?.trim() || isCreating);
                      if (formData.name?.trim() && !isCreating) {
                        handleSubmit();
                      } else {
                        console.error('Cannot submit: Name is empty or already creating');
                        alert('Please ensure you have entered a graph name');
                      }
                    }}
                    disabled={!formData.name?.trim() || isCreating}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-lg hover:shadow-xl"
                  >
                    {isCreating ? 'Creating...' : 'Create Graph'}
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