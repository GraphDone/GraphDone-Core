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

        {/* Enhanced Modal with better styling */}
        <div className="inline-block w-full max-w-2xl p-0 my-8 overflow-hidden text-left align-middle transition-all transform bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 shadow-2xl rounded-2xl border border-gray-600/50 animate-in slide-in-from-bottom-4 duration-300 relative">
          {/* Gradient accent line at top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"></div>
          
          {/* Enhanced Header with gradient background */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-600/50 bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-white via-green-100 to-blue-100 bg-clip-text text-transparent">
                {step === 'type' && 'Create New Graph'}
                {step === 'details' && 'Graph Details'}
                {step === 'template' && 'Starting Point'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step 1: Choose Type with enhanced styling */}
          {step === 'type' && (
            <div className="px-8 pt-1 pb-8 space-y-4 relative">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="w-full h-full" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                  backgroundSize: '20px 20px'
                }}></div>
              </div>
              
              <div className="relative z-10 mb-8">
                <p className="text-lg font-medium text-gray-200 mb-2">What type of graph would you like to create?</p>
                <p className="text-sm text-gray-400">Choose the type that best fits your needs</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {graphTypes.map((type) => (
                  <button
                    key={type.type}
                    onClick={() => type.disabled ? null : setFormData(prev => ({ ...prev, type: type.type }))}
                    disabled={type.disabled}
                    title={type.comingSoon ? "Template functionality coming soon!" : undefined}
                    className={`group p-6 border-2 rounded-2xl text-left transition-all duration-300 relative overflow-hidden ${
                      formData.type === type.type
                        ? `${type.color} border-current shadow-xl scale-[1.02] ${type.hoverShadow}`
                        : type.disabled
                        ? type.color
                        : 'border-gray-600/50 bg-gradient-to-br from-gray-700/40 to-gray-800/40 hover:from-gray-700/60 hover:to-gray-800/60 hover:border-gray-500/70 hover:scale-[1.02] hover:shadow-lg backdrop-blur-sm'
                    }`}
                  >
                    {/* Background gradient effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${type.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}></div>
                    
                    {type.comingSoon && (
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-gray-700 to-gray-600 text-xs text-gray-300 px-3 py-1.5 rounded-full shadow-md font-medium">
                        Coming Soon
                      </div>
                    )}
                    
                    <div className="relative z-10">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className={`p-3 rounded-2xl ${type.iconBg} border border-white/5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                          {type.icon}
                        </div>
                        <h4 className={`font-bold text-lg ${type.disabled ? 'text-gray-500' : 'text-white group-hover:text-white'}`}>
                          {type.title}
                        </h4>
                      </div>
                      <p className={`text-sm leading-relaxed ${type.disabled ? 'text-gray-500' : 'text-gray-300 group-hover:text-gray-200'}`}>
                        {type.description}
                      </p>
                    </div>
                    
                    {/* Selection indicator */}
                    {formData.type === type.type && !type.disabled && (
                      <div className="absolute bottom-3 right-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
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

              <div className="flex justify-end space-x-4 pt-6 border-t border-gradient-to-r from-gray-600/30 via-gray-500/50 to-gray-600/30 relative z-10">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/80 to-gray-600/80 rounded-xl hover:from-gray-600/80 hover:to-gray-500/80 transition-all duration-300 hover:scale-105 shadow-lg backdrop-blur-sm border border-gray-500/30 hover:border-gray-400/50 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('template')}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white rounded-xl hover:from-green-500 hover:via-emerald-500 hover:to-teal-500 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform border border-green-400/30 font-semibold flex items-center space-x-2"
                >
                  <span>Continue</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Choose Template/Starting Point - Enhanced */}
          {step === 'template' && (
            <div className="px-8 pt-0 pb-8 space-y-4 relative">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="w-full h-full" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                  backgroundSize: '20px 20px'
                }}></div>
              </div>
              
              <div className="relative z-10 mb-12">
                <h4 className="text-lg font-bold text-gray-200 mb-2">Choose Starting Point</h4>
                <p className="text-sm text-gray-400">Select how you want to create your graph</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <button
                  onClick={() => {
                    setShowTemplates(false);
                    setFormData(prev => ({ ...prev, templateId: undefined, copyFromGraphId: undefined }));
                  }}
                  className={`group p-6 border-2 rounded-2xl text-center transition-all duration-300 relative overflow-hidden ${
                    !showTemplates && !formData.copyFromGraphId
                      ? 'border-green-500/70 bg-gradient-to-br from-green-900/40 to-emerald-900/30 shadow-xl scale-[1.02] hover:shadow-green-500/20'
                      : 'border-gray-600/50 bg-gradient-to-br from-gray-700/40 to-gray-800/40 hover:from-gray-700/60 hover:to-gray-800/60 hover:border-gray-500/70 hover:scale-[1.02] hover:shadow-lg backdrop-blur-sm'
                  }`}
                >
                  {/* Background gradient effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  
                  <div className="relative z-10">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-2xl flex items-center justify-center shadow-lg border border-white/5 group-hover:scale-110 transition-transform duration-300">
                      <Plus className="h-8 w-8 text-green-400" />
                    </div>
                    <h5 className="font-bold text-white mb-2 text-lg">Start Empty</h5>
                    <p className="text-sm text-gray-300">Create a blank graph from scratch</p>
                  </div>
                  
                  {/* Selection indicator */}
                  {!showTemplates && !formData.copyFromGraphId && (
                    <div className="absolute top-4 right-4">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
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
                  className="group p-6 border-2 rounded-2xl text-center transition-all duration-300 relative overflow-hidden border-gray-600/50 bg-gradient-to-br from-gray-800/30 to-gray-900/30 cursor-not-allowed opacity-60"
                >
                  <div className="absolute top-3 right-3 bg-gradient-to-r from-gray-700 to-gray-600 text-xs text-gray-300 px-3 py-1.5 rounded-full shadow-md font-medium">
                    Coming Soon
                  </div>
                  
                  <div className="relative z-10">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-700/30 rounded-2xl flex items-center justify-center border border-gray-600/30">
                      <FileText className="h-8 w-8 text-gray-500" />
                    </div>
                    <h5 className="font-bold text-gray-400 mb-2 text-lg">Use Template</h5>
                    <p className="text-sm text-gray-500">Start with a pre-built template</p>
                  </div>
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


              <div className="flex justify-between pt-6 border-t border-gradient-to-r from-gray-600/30 via-gray-500/50 to-gray-600/30 relative z-10">
                <button
                  onClick={() => setStep('type')}
                  className="px-6 py-3 text-gray-300 bg-gradient-to-r from-gray-700/80 to-gray-600/80 rounded-xl hover:from-gray-600/80 hover:to-gray-500/80 transition-all duration-300 hover:scale-105 shadow-lg backdrop-blur-sm border border-gray-500/30 hover:border-gray-400/50 hover:text-white font-medium flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white rounded-xl hover:from-green-500 hover:via-emerald-500 hover:to-teal-500 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform border border-green-400/30 font-semibold flex items-center space-x-2"
                >
                  <span>Continue</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Graph Details - Enhanced */}
          {step === 'details' && (
            <div className="px-8 pt-0 pb-8 space-y-4 relative">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="w-full h-full" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                  backgroundSize: '20px 20px'
                }}></div>
              </div>
              
              <div className="mb-12 relative z-10">
                <p className="text-sm text-gray-400">Provide essential information to set up your graph</p>
              </div>

              <div className="space-y-6 relative z-10">
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
                      className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-300 hover:border-gray-500 shadow-lg"
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
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the purpose and scope of this graph"
                      rows={4}
                      className="w-full px-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400 transition-all duration-300 hover:border-gray-500 shadow-lg resize-none"
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-green-500/5 to-teal-500/5 pointer-events-none group-hover:from-green-500/10 group-hover:to-teal-500/10 transition-all duration-300"></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    <span>Help team members understand the purpose and context</span>
                  </p>
                </div>

                {/* Tags */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                    <span>Tags</span>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                  </label>
                  
                  {/* Enhanced Tag Display Area */}
                  <div className="relative">
                    <div className="w-full min-h-[3.5rem] px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-400 transition-all duration-300 hover:border-gray-500 shadow-lg">
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
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r ${colorScheme.bg} ${colorScheme.text} border-2 ${colorScheme.border} transition-all duration-200 hover:scale-105 shadow-md animate-in slide-in-from-left-2`}
                            style={{
                              animationDelay: `${index * 100}ms`
                            }}
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => {
                                const newTags = formData.tags?.filter((_, i) => i !== index) || [];
                                setFormData(prev => ({ ...prev, tags: newTags }));
                              }}
                              className="ml-2 hover:bg-white/20 rounded-full p-0.5 transition-all duration-200 hover:scale-125"
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
                        placeholder={(!formData.tags || formData.tags.length === 0) ? "project, frontend, urgent, team-alpha" : formData.tags.length >= 5 ? "Maximum 5 tags reached" : "Add more tags"}
                        className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-gray-200 placeholder-gray-400"
                        disabled={formData.tags && formData.tags.length >= 5}
                      />
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

                {/* Interactive Configuration Summary */}
                <div className="group p-6 bg-gradient-to-br from-gray-700/40 to-gray-800/40 border border-gray-500/50 rounded-2xl shadow-xl backdrop-blur-sm hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300">
                  <h4 className="font-bold text-white mb-6 flex items-center group-hover:scale-105 transition-transform duration-300">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 shadow-lg group-hover:shadow-green-500/20">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    Review Configuration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-4">
                      <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <span>Graph Type:</span>
                          </span>
                          <span className="font-semibold text-blue-300 capitalize group-hover/item:text-blue-200">{formData.type?.toLowerCase()}</span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center space-x-2">
                            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                            <span>Team:</span>
                          </span>
                          <span className="font-semibold text-purple-300 group-hover/item:text-purple-200">{currentTeam?.name || 'Default Team'}</span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center space-x-2">
                            <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                            <span>Privacy:</span>
                          </span>
                          <span className="font-semibold text-cyan-300 group-hover/item:text-cyan-200">{formData.isShared ? 'Shared' : 'Private'}</span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${formData.status === 'ACTIVE' ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                            <span>Status:</span>
                          </span>
                          <span className={`font-semibold ${formData.status === 'ACTIVE' ? 'text-green-300 group-hover/item:text-green-200' : 'text-yellow-300 group-hover/item:text-yellow-200'}`}>
                            {formData.status || 'Draft'}
                          </span>
                        </div>
                      </div>
                      
                      {formData.tags && formData.tags.length > 0 && (
                        <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center space-x-2">
                              <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                              <span>Tags:</span>
                            </span>
                            <span className="font-semibold text-indigo-300 group-hover/item:text-indigo-200">{formData.tags.length} tag{formData.tags.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center space-x-2">
                            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                            <span>Default Role:</span>
                          </span>
                          <span className="font-semibold text-amber-300 group-hover/item:text-amber-200">{formData.defaultRole || 'VIEWER'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {parentGraphId && (
                        <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                              <span>Parent Graph:</span>
                            </span>
                            <span className="font-semibold text-green-300 group-hover/item:text-green-200">Connected</span>
                          </div>
                        </div>
                      )}
                      
                      {formData.templateId && formData.templateId !== 'use-template' && (
                        <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                              <span>Template:</span>
                            </span>
                            <span className="font-semibold text-blue-300 group-hover/item:text-blue-200">Applied</span>
                          </div>
                        </div>
                      )}
                      
                      {formData.copyFromGraphId && formData.copyFromGraphId !== 'select' && (
                        <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center space-x-2">
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                              <span>Source:</span>
                            </span>
                            <span className="font-semibold text-purple-300 group-hover/item:text-purple-200">Existing Graph</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${formData.name ? 'bg-green-400 animate-pulse' : 'bg-red-400 animate-pulse'}`}></div>
                            <span>Ready to Create:</span>
                          </span>
                          <span className={`font-semibold ${formData.name ? 'text-green-300 group-hover/item:text-green-200' : 'text-red-300 group-hover/item:text-red-200'}`}>
                            {formData.name ? 'Yes' : 'Name Required'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-600/30 hover:bg-gray-800/70 transition-all duration-200 group/item">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${!formData.name?.trim() || isCreating ? 'bg-red-400 animate-pulse' : 'bg-green-400 animate-pulse'}`}></div>
                            <span>Button State:</span>
                          </span>
                          <span className={`font-semibold ${!formData.name?.trim() || isCreating ? 'text-red-300 group-hover/item:text-red-200' : 'text-green-300 group-hover/item:text-green-200'}`}>
                            {!formData.name?.trim() ? 'Disabled (No Name)' : isCreating ? 'Disabled (Creating)' : 'Enabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
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