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
  const { createGraph, duplicateGraph, availableGraphs, isCreating } = useGraph();
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
  const [showReviewConfig, setShowReviewConfig] = useState(true);

  const colors = [
    { bg: 'from-blue-600/40 to-indigo-600/40', text: 'text-blue-100', border: 'border-blue-400/60 hover:border-blue-400/80' },
    { bg: 'from-green-600/40 to-emerald-600/40', text: 'text-green-100', border: 'border-green-400/60 hover:border-green-400/80' },
    { bg: 'from-purple-600/40 to-violet-600/40', text: 'text-purple-100', border: 'border-purple-400/60 hover:border-purple-400/80' },
    { bg: 'from-orange-600/40 to-red-600/40', text: 'text-orange-100', border: 'border-orange-400/60 hover:border-orange-400/80' },
    { bg: 'from-pink-600/40 to-rose-600/40', text: 'text-pink-100', border: 'border-pink-400/60 hover:border-pink-400/80' },
  ];

  const graphTypes = [
    {
      type: 'PROJECT' as const,
      title: 'Project',
      description: 'A main project with goals, tasks, and deliverables',
      icon: <Folder className="h-10 w-10 text-blue-400" />,
      color: 'border-blue-500/50 bg-gradient-to-br from-blue-900/30 to-blue-800/20 hover:from-blue-900/40 hover:to-blue-800/30',
      bgGradient: 'from-blue-500/10 to-indigo-500/10',
      iconBg: 'bg-gradient-to-br from-blue-500/20 to-indigo-600/20',
      hoverShadow: 'hover:shadow-blue-500/20'
    },
    {
      type: 'WORKSPACE' as const,
      title: 'Workspace',
      description: 'A collaborative space for brainstorming and experimentation',
      icon: <FolderOpen className="h-10 w-10 text-purple-400" />,
      color: 'border-purple-500/50 bg-gradient-to-br from-purple-900/30 to-purple-800/20 hover:from-purple-900/40 hover:to-purple-800/30',
      bgGradient: 'from-purple-500/10 to-pink-500/10',
      iconBg: 'bg-gradient-to-br from-purple-500/20 to-pink-600/20',
      hoverShadow: 'hover:shadow-purple-500/20'
    },
    {
      type: 'SUBGRAPH' as const,
      title: 'Subgraph',
      description: 'A focused subset within a larger project or workspace',
      icon: <Plus className="h-10 w-10 text-green-400" />,
      color: 'border-green-500/50 bg-gradient-to-br from-green-900/30 to-green-800/20 hover:from-green-900/40 hover:to-green-800/30',
      bgGradient: 'from-green-500/10 to-emerald-500/10',
      iconBg: 'bg-gradient-to-br from-green-500/20 to-emerald-600/20',
      hoverShadow: 'hover:shadow-green-500/20'
    },
    {
      type: 'TEMPLATE' as const,
      title: 'Template',
      description: 'A reusable template for creating similar graphs',
      icon: <FileText className="h-10 w-10 text-gray-500" />,
      color: 'border-gray-600/50 bg-gray-800/20 cursor-not-allowed opacity-60',
      bgGradient: 'from-gray-700/10 to-gray-600/10',
      iconBg: 'bg-gray-700/20',
      hoverShadow: '',
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
    graph.teamId === currentTeam?.id || graph.teamId === 'team-1' || true
  );

  const handleSubmit = async () => {
    console.log('=== CREATE GRAPH SUBMISSION START ===');
    console.log('Current user:', currentUser);
    console.log('Current team:', currentTeam);
    console.log('Form data before validation:', formData);
    
    if (!formData.name) {
      console.error('Graph name is required');
      showError('Validation Error', 'Please enter a graph name');
      return;
    }
    
    // Check for duplicate graph names
    const existingGraph = availableGraphs.find(g => 
      g.name.toLowerCase().trim() === formData.name!.toLowerCase().trim()
    );
    if (existingGraph) {
      showError('Duplicate Name', `A graph with the name "${formData.name}" already exists. Please choose a different name.`);
      return;
    }
    
    // For development: provide fallback team and user if authentication is not set up
    const fallbackTeamId = currentTeam?.id || formData.teamId || 'default-team';
    const fallbackUserId = currentUser?.id || 'default-user';
    
    console.log('Using team ID:', fallbackTeamId);
    console.log('Using user ID:', fallbackUserId);

    try {
      // Handle copying existing graph
      if (formData.copyFromGraphId && formData.copyFromGraphId !== 'select') {
        console.log('Duplicating graph:', formData.copyFromGraphId);
        await duplicateGraph(formData.copyFromGraphId, formData.name!);
      } else {
        // Create new graph from scratch
        const graphInput = {
          ...formData,
          teamId: fallbackTeamId,
          // Ensure we have a user ID for createdBy field
          createdBy: fallbackUserId
        };
        
        console.log('Creating graph with data:', graphInput);
        console.log('Tags in form data:', formData.tags);
        await createGraph(graphInput as CreateGraphInput);
      }
      
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
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Enhanced Backdrop with gradient */}
        <div 
          className="fixed inset-0 transition-opacity bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-800/90 animate-in fade-in duration-300"
          onClick={handleClose}
        />

        {/* Modern eye-catching modal */}
        <div className="inline-block w-full max-w-2xl p-0 my-8 overflow-hidden text-left align-middle transition-all transform bg-gradient-to-br from-gray-800/98 via-gray-850/98 to-gray-900/98 backdrop-blur-2xl shadow-2xl rounded-2xl border border-gray-600/30 animate-in slide-in-from-bottom-4 duration-300 relative">
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-green-500/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-green-500"></div>

          {/* Modern header with glow */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/30 bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm relative">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl blur opacity-50 animate-pulse"></div>
                <Plus className="h-5 w-5 text-white relative z-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-white via-green-100 to-emerald-100 bg-clip-text text-transparent">
                  {step === 'type' && 'Create New Graph'}
                  {step === 'details' && 'Graph Details'}
                  {step === 'template' && 'Starting Point'}
                </h3>
                <p className="text-xs text-gray-400">
                  {step === 'type' && 'Step 1 of 3'}
                  {step === 'template' && 'Step 2 of 3'}
                  {step === 'details' && 'Step 3 of 3'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110 hover:rotate-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step 1: Choose Type - Eye-catching */}
          {step === 'type' && (
            <div className="px-6 py-5 space-y-4 relative">
              <div className="mb-4">
                <p className="text-base font-semibold text-white">What type of graph would you like to create?</p>
                <p className="text-sm text-gray-400 mt-1">Choose the type that best fits your needs</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {graphTypes.map((type, index) => (
                  <button
                    key={type.type}
                    onClick={() => type.disabled ? null : setFormData(prev => ({ ...prev, type: type.type }))}
                    disabled={type.disabled}
                    title={type.comingSoon ? "Template functionality coming soon!" : undefined}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className={`group p-5 border-2 rounded-2xl text-left transition-all duration-300 relative overflow-hidden animate-in slide-in-from-bottom-2 ${
                      formData.type === type.type
                        ? 'border-green-500/70 bg-gradient-to-br from-green-900/40 to-emerald-900/30 shadow-xl shadow-green-500/20 scale-105'
                        : type.disabled
                        ? 'border-gray-700/50 bg-gray-800/30 cursor-not-allowed opacity-50'
                        : 'border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 hover:bg-gray-700/50 hover:border-gray-600/70 hover:scale-105 hover:shadow-xl'
                    }`}
                  >
                    {/* Animated gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${type.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

                    {type.comingSoon && (
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-gray-700 to-gray-600 text-[10px] text-gray-300 px-2.5 py-1 rounded-full font-medium shadow-md">
                        Soon
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className="flex items-start space-x-3 mb-3">
                        <div className={`p-3 rounded-xl ${type.iconBg} flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                          {type.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-base mb-1.5 ${type.disabled ? 'text-gray-500' : 'text-white group-hover:text-white'}`}>
                            {type.title}
                          </h4>
                          <p className={`text-sm leading-snug ${type.disabled ? 'text-gray-600' : 'text-gray-400 group-hover:text-gray-300'}`}>
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {formData.type === type.type && !type.disabled && (
                      <div className="absolute top-3 right-3 animate-in zoom-in duration-200">
                        <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {parentGraphId && (
                <div className="relative p-4 bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-2 border-blue-500/40 rounded-xl shadow-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10"></div>
                  <div className="relative flex items-center space-x-3 text-blue-200">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Plus className="h-4 w-4 text-blue-300" />
                    </div>
                    <span className="text-sm font-semibold">Creating subgraph within parent</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-5 border-t border-gray-700/30">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm text-gray-300 bg-gray-700/50 rounded-xl hover:bg-gray-600/60 transition-all duration-200 font-medium hover:scale-105 border border-gray-600/30 hover:border-gray-500/50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('template')}
                  className="px-6 py-2.5 text-sm bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white rounded-xl hover:from-green-500 hover:via-emerald-500 hover:to-teal-500 transition-all duration-200 font-semibold flex items-center space-x-2 hover:scale-105 shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/40"
                >
                  <span>Continue</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Choose Starting Point - Modern */}
          {step === 'template' && (
            <div className="px-6 py-5 space-y-4">
              <div className="mb-4">
                <p className="text-base font-semibold text-white">Choose Starting Point</p>
                <p className="text-sm text-gray-400 mt-1">Select how you want to create your graph</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setShowTemplates(false);
                    setFormData(prev => ({ ...prev, templateId: undefined, copyFromGraphId: undefined }));
                  }}
                  className={`group p-6 border-2 rounded-2xl text-center transition-all duration-300 relative overflow-hidden ${
                    !showTemplates && !formData.copyFromGraphId
                      ? 'border-green-500/70 bg-gradient-to-br from-green-900/40 to-emerald-900/30 shadow-xl shadow-green-500/20 scale-105'
                      : 'border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 hover:bg-gray-700/50 hover:border-gray-600/70 hover:scale-105 hover:shadow-xl'
                  }`}
                >
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  <div className="relative z-10">
                    <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Plus className="h-8 w-8 text-green-400" />
                    </div>
                    <h5 className="font-bold text-white mb-2 text-base">Start Empty</h5>
                    <p className="text-sm text-gray-400">Create a blank graph from scratch</p>
                  </div>

                  {!showTemplates && !formData.copyFromGraphId && (
                    <div className="absolute top-3 right-3 animate-in zoom-in duration-200">
                      <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>

                <button
                  disabled
                  title="Template functionality coming soon!"
                  className="group p-6 border-2 rounded-2xl text-center transition-all duration-300 relative overflow-hidden border-gray-700/50 bg-gradient-to-br from-gray-800/30 to-gray-900/30 cursor-not-allowed opacity-50"
                >
                  <div className="absolute top-3 right-3 bg-gradient-to-r from-gray-700 to-gray-600 text-[10px] text-gray-300 px-2.5 py-1 rounded-full font-medium shadow-md">
                    Soon
                  </div>

                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-700/30 rounded-2xl flex items-center justify-center">
                    <FileText className="h-8 w-8 text-gray-500" />
                  </div>
                  <h5 className="font-bold text-gray-400 mb-2 text-base">Use Template</h5>
                  <p className="text-sm text-gray-600">Start with a pre-built template</p>
                </button>

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


              <div className="flex justify-between pt-4 border-t border-gray-700/50">
                <button
                  onClick={() => setStep('type')}
                  className="px-4 py-2 text-sm text-gray-300 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-all duration-200 flex items-center space-x-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="px-5 py-2 text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 transition-all duration-200 font-medium flex items-center space-x-1.5"
                >
                  <span>Continue</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Graph Details - Compact */}
          {step === 'details' && (
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-3">
                {/* Graph Name */}
                <div className="group/input">
                  <label className="block text-sm font-semibold text-gray-200 mb-2 flex items-center space-x-1.5">
                    <span>Graph Name</span>
                    <span className="text-red-400 text-lg">*</span>
                  </label>
                  <div className="relative">
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
                      className="w-full px-4 py-3 text-sm bg-gray-800/80 border-2 border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/70 transition-all duration-200 hover:border-gray-500/70 shadow-inner"
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
                      value={formData.description || ''}
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
                                onClick={() => {
                                  const newTags = formData.tags?.filter((_, i) => i !== index) || [];
                                  setFormData(prev => ({ ...prev, tags: newTags }));
                                }}
                                className="ml-2 hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:rotate-90"
                              >
                                ×
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

                            if (value.includes(',') || value.includes(' ')) {
                              const separator = value.includes(',') ? ',' : ' ';
                              const newTags = value.split(separator).map(tag => tag.trim()).filter(tag => tag.length > 0);
                              const existingTags = formData.tags || [];
                              const allTags = [...existingTags, ...newTags.slice(0, -1)]
                                .filter((tag, index, arr) => arr.indexOf(tag) === index)
                                .slice(0, 5);

                              setFormData(prev => ({ ...prev, tags: allTags }));
                              setTagInput(newTags[newTags.length - 1] || '');
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              if (tagInput.trim()) {
                                const existingTags = formData.tags || [];
                                const newTag = tagInput.trim();
                                if (!existingTags.includes(newTag) && existingTags.length < 5) {
                                  setFormData(prev => ({ ...prev, tags: [...existingTags, newTag] }));
                                }
                                setTagInput('');
                              }
                            } else if (e.key === 'Backspace' && tagInput === '' && formData.tags && formData.tags.length > 0) {
                              const newTags = formData.tags.slice(0, -1);
                              setFormData(prev => ({ ...prev, tags: newTags }));
                            }
                          }}
                          placeholder={(!formData.tags || formData.tags.length === 0) ? "Add tags (comma-separated)" : formData.tags.length >= 5 ? "Max 5 tags" : "Add more"}
                          className="flex-1 min-w-[200px] bg-transparent border-none outline-none text-gray-200 placeholder-gray-500"
                          disabled={formData.tags && formData.tags.length >= 5}
                        />
                      </div>
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none group-hover:from-purple-500/10 group-hover:to-pink-500/10 transition-all duration-300"></div>
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
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
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

              <div className="flex justify-between pt-6 border-t border-gradient-to-r from-gray-600/30 via-gray-500/50 to-gray-600/30 relative z-10">
                <button
                  onClick={() => setStep('template')}
                  className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/80 to-gray-600/80 rounded-xl hover:from-gray-600/80 hover:to-gray-500/80 transition-all duration-300 hover:scale-105 shadow-lg backdrop-blur-sm border border-gray-500/30 hover:border-gray-400/50 hover:text-white font-medium flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                  <span>Back</span>
                </button>
                <div className="flex space-x-4">
                  <button
                    onClick={handleClose}
                    className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/80 to-gray-600/80 rounded-xl hover:from-gray-600/80 hover:to-gray-500/80 transition-all duration-300 hover:scale-105 shadow-lg backdrop-blur-sm border border-gray-500/30 hover:border-gray-400/50 hover:text-white font-medium"
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
                    className={`px-8 py-3 font-semibold rounded-xl transition-all duration-300 shadow-xl transform flex items-center space-x-2 ${
                      !formData.name?.trim() || isCreating
                        ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-60'
                        : 'bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white hover:from-green-500 hover:via-emerald-500 hover:to-teal-500 hover:shadow-2xl hover:scale-105 border border-green-400/30'
                    }`}
                  >
                    {isCreating ? (
                      <>
                        <span>Creating...</span>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      </>
                    ) : (
                      <>
                        <span>Create Graph</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                      </>
                    )}
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