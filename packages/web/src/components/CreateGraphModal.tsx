import { useState } from 'react';
import { X, Folder, FolderOpen, Plus, Copy, FileText } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { CreateGraphInput } from '../types/graph';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentGraphId?: string;
}

export function CreateGraphModal({ isOpen, onClose, parentGraphId }: CreateGraphModalProps) {
  const { currentTeam } = useAuth();
  const { createGraph, availableGraphs, isCreating } = useGraph();
  
  const [step, setStep] = useState<'type' | 'details' | 'template'>('type');
  const [formData, setFormData] = useState<Partial<CreateGraphInput>>({
    type: 'PROJECT',
    parentGraphId,
    teamId: currentTeam?.id || ''
  });

  const graphTypes = [
    {
      type: 'PROJECT' as const,
      title: 'Project',
      description: 'A main project with goals, tasks, and deliverables',
      icon: <Folder className="h-8 w-8 text-blue-600" />,
      color: 'border-blue-200 bg-blue-50'
    },
    {
      type: 'WORKSPACE' as const,
      title: 'Workspace',
      description: 'A collaborative space for brainstorming and experimentation',
      icon: <FolderOpen className="h-8 w-8 text-purple-600" />,
      color: 'border-purple-200 bg-purple-50'
    },
    {
      type: 'SUBGRAPH' as const,
      title: 'Subgraph',
      description: 'A focused subset within a larger project or workspace',
      icon: <Plus className="h-8 w-8 text-green-600" />,
      color: 'border-green-200 bg-green-50'
    },
    {
      type: 'TEMPLATE' as const,
      title: 'Template',
      description: 'A reusable template for creating similar graphs',
      icon: <FileText className="h-8 w-8 text-orange-600" />,
      color: 'border-orange-200 bg-orange-50'
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
    if (!formData.name || !formData.teamId) return;

    try {
      await createGraph(formData as CreateGraphInput);
      onClose();
      resetForm();
    } catch (_error) {
      // Handle error silently for now
    }
  };

  const resetForm = () => {
    setStep('type');
    setFormData({
      type: 'PROJECT',
      parentGraphId,
      teamId: currentTeam?.id || ''
    });
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {step === 'type' && 'Create New Graph'}
              {step === 'details' && 'Graph Details'}
              {step === 'template' && 'Choose Starting Point'}
            </h3>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step 1: Choose Type */}
          {step === 'type' && (
            <div className="space-y-6">
              <p className="text-gray-600">What type of graph would you like to create?</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {graphTypes.map((type) => (
                  <button
                    key={type.type}
                    onClick={() => setFormData(prev => ({ ...prev, type: type.type }))}
                    className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                      formData.type === type.type
                        ? `${type.color} border-current`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      {type.icon}
                      <h4 className="font-semibold text-gray-900">{type.title}</h4>
                    </div>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </button>
                ))}
              </div>

              {parentGraphId && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-blue-800">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Creating subgraph</span>
                  </div>
                  <p className="text-sm text-blue-600 mt-1">
                    This graph will be created as a child of the selected parent graph.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('template')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Choose Template/Starting Point */}
          {step === 'template' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 mb-6">
                <button
                  onClick={() => setFormData(prev => ({ ...prev, templateId: undefined, copyFromGraphId: undefined }))}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    !formData.templateId && !formData.copyFromGraphId
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Start Empty
                </button>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, copyFromGraphId: undefined }))}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    formData.templateId
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Use Template
                </button>
                {copyableGraphs.length > 0 && (
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, templateId: undefined }))}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      formData.copyFromGraphId
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Copy Existing
                  </button>
                )}
              </div>

              {/* Templates */}
              {!formData.copyFromGraphId && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Available Templates</h4>
                  <div className="grid gap-3">
                    {templates
                      .filter(template => template.type === formData.type)
                      .map((template) => (
                        <button
                          key={template.id}
                          onClick={() => setFormData(prev => ({ ...prev, templateId: template.id }))}
                          className={`p-4 border rounded-lg text-left transition-all ${
                            formData.templateId === template.id
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900">{template.name}</h5>
                              <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                            </div>
                            <div className="text-sm text-gray-500">
                              {template.nodeCount} nodes
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Copy from existing */}
              {formData.copyFromGraphId !== undefined && copyableGraphs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Copy from Existing Graph</h4>
                  <div className="grid gap-3">
                    {copyableGraphs.map((graph) => (
                      <button
                        key={graph.id}
                        onClick={() => setFormData(prev => ({ ...prev, copyFromGraphId: graph.id }))}
                        className={`p-4 border rounded-lg text-left transition-all ${
                          formData.copyFromGraphId === graph.id
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Copy className="h-4 w-4 text-gray-400" />
                            <div>
                              <h5 className="font-medium text-gray-900">{graph.name}</h5>
                              <p className="text-sm text-gray-600 mt-1">{graph.description}</p>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {graph.nodeCount} nodes
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
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Graph Details */}
          {step === 'details' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Graph Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter a descriptive name for your graph"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the purpose and scope of this graph"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Summary */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Type: <span className="font-medium">{formData.type}</span></div>
                    <div>Team: <span className="font-medium">{currentTeam?.name}</span></div>
                    {parentGraphId && <div>Parent Graph: <span className="font-medium">Yes</span></div>}
                    {formData.templateId && <div>Template: <span className="font-medium">Yes</span></div>}
                    {formData.copyFromGraphId && <div>Copy from: <span className="font-medium">Existing Graph</span></div>}
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('template')}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!formData.name || isCreating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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