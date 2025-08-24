import { useState } from 'react';
import { Plus, Search, Edit3, Trash2, Eye, Copy, Brain, Settings, Layers, Trophy, Target, Sparkles, ListTodo, AlertTriangle, Lightbulb, Microscope, X, Calendar, User, Hash } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';

interface NodeType {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  fields: NodeField[];
  isBuiltIn: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: string;
}

interface NodeField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'reference';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  referenceType?: string;
}

export function Ontology() {
  const { currentGraph } = useGraph();
  const { } = useAuth();
  const [activeTab, setActiveTab] = useState<'types' | 'relationships' | 'templates'>('types');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Mock node types - synced with NodeCategorySelector
  const mockNodeTypes: NodeType[] = [
    // Strategic Level
    {
      id: 'epic',
      name: 'Epic',
      description: 'Large initiative spanning multiple deliverables',
      color: 'fuchsia',
      icon: 'Layers',
      isBuiltIn: true,
      usageCount: 8,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: false },
        { id: 'dueDate', name: 'Due Date', type: 'date', required: false },
        { id: 'priority', name: 'Priority', type: 'select', required: true, options: ['Critical', 'High', 'Medium', 'Low', 'Minimal'] }
      ]
    },
    {
      id: 'milestone',
      name: 'Milestone',
      description: 'Key project checkpoint',
      color: 'orange',
      icon: 'Trophy',
      isBuiltIn: true,
      usageCount: 23,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: false },
        { id: 'targetDate', name: 'Target Date', type: 'date', required: true },
        { id: 'isPublic', name: 'Public Milestone', type: 'boolean', required: false }
      ]
    },
    {
      id: 'outcome',
      name: 'Outcome',
      description: 'Expected result or deliverable',
      color: 'indigo',
      icon: 'Target',
      isBuiltIn: true,
      usageCount: 45,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: false },
        { id: 'dueDate', name: 'Due Date', type: 'date', required: false },
        { id: 'priority', name: 'Priority', type: 'select', required: true, options: ['Critical', 'High', 'Medium', 'Low', 'Minimal'] }
      ]
    },
    
    // Development Work
    {
      id: 'feature',
      name: 'Feature',
      description: 'New functionality or capability',
      color: 'sky',
      icon: 'Sparkles',
      isBuiltIn: true,
      usageCount: 67,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: false },
        { id: 'estimatedHours', name: 'Estimated Hours', type: 'number', required: false },
        { id: 'contributor', name: 'Contributor', type: 'reference', required: false, referenceType: 'user' }
      ]
    },
    {
      id: 'task',
      name: 'Task',
      description: 'Specific work item to be completed',
      color: 'emerald',
      icon: 'ListTodo',
      isBuiltIn: true,
      usageCount: 128,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: false },
        { id: 'estimatedHours', name: 'Estimated Hours', type: 'number', required: false },
        { id: 'contributor', name: 'Contributor', type: 'reference', required: false, referenceType: 'user' }
      ]
    },
    {
      id: 'bug',
      name: 'Bug',
      description: 'Software defect requiring resolution',
      color: 'red',
      icon: 'AlertTriangle',
      isBuiltIn: true,
      usageCount: 34,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: true },
        { id: 'severity', name: 'Severity', type: 'select', required: true, options: ['Critical', 'High', 'Medium', 'Low'] },
        { id: 'contributor', name: 'Contributor', type: 'reference', required: false, referenceType: 'user' }
      ]
    },
    
    // Planning & Discovery
    {
      id: 'idea',
      name: 'Idea',
      description: 'Concept or proposal for future development',
      color: 'yellow',
      icon: 'Lightbulb',
      isBuiltIn: true,
      usageCount: 19,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: false },
        { id: 'feasibility', name: 'Feasibility', type: 'select', required: false, options: ['High', 'Medium', 'Low', 'Unknown'] },
        { id: 'impact', name: 'Expected Impact', type: 'select', required: false, options: ['High', 'Medium', 'Low'] }
      ]
    },
    {
      id: 'research',
      name: 'Research',
      description: 'Investigation or analysis work',
      color: 'teal',
      icon: 'Microscope',
      isBuiltIn: true,
      usageCount: 12,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'hypothesis', name: 'Hypothesis', type: 'text', required: false },
        { id: 'methodology', name: 'Methodology', type: 'text', required: false },
        { id: 'status', name: 'Status', type: 'select', required: true, options: ['Planning', 'In Progress', 'Analysis', 'Complete'] }
      ]
    }
  ];

  const filteredTypes = mockNodeTypes.filter(type =>
    type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    type.description.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      fuchsia: 'bg-fuchsia-900 text-fuchsia-300 border-fuchsia-700',
      orange: 'bg-orange-900 text-orange-300 border-orange-700',
      indigo: 'bg-indigo-900 text-indigo-300 border-indigo-700',
      sky: 'bg-sky-900 text-sky-300 border-sky-700',
      emerald: 'bg-emerald-900 text-emerald-300 border-emerald-700',
      red: 'bg-red-900 text-red-300 border-red-700',
      yellow: 'bg-yellow-900 text-yellow-300 border-yellow-700',
      teal: 'bg-teal-900 text-teal-300 border-teal-700',
    };
    return colorMap[color] || 'bg-gray-700 text-gray-300 border-gray-600';
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Ontology</h1>
            <p className="text-sm text-gray-400 mt-1">
              Define node types, relationships, and schemas for {currentGraph?.name || 'your graphs'}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              type="button"
              className="btn btn-secondary"
            >
              <Settings className="h-4 w-4 mr-2" />
              Schema Settings
            </button>
            
            <button
              type="button"
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Type
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-700">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('types')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'types'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <Brain className="h-4 w-4 inline mr-2" />
              Node Types
            </button>
            <button
              onClick={() => setActiveTab('relationships')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'relationships'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Relationships
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'templates'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Templates
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'types' && (
          <div className="p-6">
            {/* Search and filters */}
            <div className="mb-6 flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search node types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div className="text-sm text-gray-400">
                {filteredTypes.length} types
              </div>
            </div>

            {/* Node Types Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTypes.map((nodeType) => (
                <div key={nodeType.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border ${getColorClasses(nodeType.color)}`}>
                        {nodeType.icon === 'Layers' && <Layers className="h-5 w-5" style={{ color: '#c084fc' }} />}
                        {nodeType.icon === 'Trophy' && <Trophy className="h-5 w-5" style={{ color: '#fb923c' }} />}
                        {nodeType.icon === 'Target' && <Target className="h-5 w-5" style={{ color: '#818cf8' }} />}
                        {nodeType.icon === 'Sparkles' && <Sparkles className="h-5 w-5" style={{ color: '#38bdf8' }} />}
                        {nodeType.icon === 'ListTodo' && <ListTodo className="h-5 w-5" style={{ color: '#4ade80' }} />}
                        {nodeType.icon === 'AlertTriangle' && <AlertTriangle className="h-5 w-5" style={{ color: '#ef4444' }} />}
                        {nodeType.icon === 'Lightbulb' && <Lightbulb className="h-5 w-5" style={{ color: '#fde047' }} />}
                        {nodeType.icon === 'Microscope' && <Microscope className="h-5 w-5" style={{ color: '#2dd4bf' }} />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-100">{nodeType.name}</h3>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          {nodeType.isBuiltIn ? (
                            <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">Built-in</span>
                          ) : (
                            <span className="bg-green-900 text-green-300 px-2 py-1 rounded">Custom</span>
                          )}
                          <span>{nodeType.usageCount} used</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => {
                          setSelectedNodeType(nodeType);
                          setShowDetailModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {!nodeType.isBuiltIn && (
                        <>
                          <button className="p-2 text-gray-400 hover:text-gray-300 transition-colors">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-300 transition-colors">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-400 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-4 flex-grow">{nodeType.description}</p>

                  <div className="space-y-2 mt-auto">
                    <h4 className="text-sm font-medium text-gray-100">Fields ({nodeType.fields.length})</h4>
                    <div className="space-y-1">
                      {nodeType.fields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">
                            {field.name}
                            {field.required && <span className="text-red-400 ml-1">*</span>}
                          </span>
                          <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">
                            {field.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'relationships' && (
          <div className="p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-100 mb-2">Relationship Types</h3>
              <p className="text-gray-400 mb-4">
                Define how different node types can connect to each other
              </p>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create Relationship Type
              </button>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-100 mb-2">Node Templates</h3>
              <p className="text-gray-400 mb-4">
                Pre-configured node templates for common patterns
              </p>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Node Type Detail Modal */}
      {showDetailModal && selectedNodeType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${getColorClasses(selectedNodeType.color)}`}>
                  {selectedNodeType.icon === 'Layers' && <Layers className="h-6 w-6" style={{ color: '#c084fc' }} />}
                  {selectedNodeType.icon === 'Trophy' && <Trophy className="h-6 w-6" style={{ color: '#fb923c' }} />}
                  {selectedNodeType.icon === 'Target' && <Target className="h-6 w-6" style={{ color: '#818cf8' }} />}
                  {selectedNodeType.icon === 'Sparkles' && <Sparkles className="h-6 w-6" style={{ color: '#38bdf8' }} />}
                  {selectedNodeType.icon === 'ListTodo' && <ListTodo className="h-6 w-6" style={{ color: '#4ade80' }} />}
                  {selectedNodeType.icon === 'AlertTriangle' && <AlertTriangle className="h-6 w-6" style={{ color: '#ef4444' }} />}
                  {selectedNodeType.icon === 'Lightbulb' && <Lightbulb className="h-6 w-6" style={{ color: '#fde047' }} />}
                  {selectedNodeType.icon === 'Microscope' && <Microscope className="h-6 w-6" style={{ color: '#2dd4bf' }} />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedNodeType.name}</h2>
                  <p className="text-gray-400">{selectedNodeType.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Basic Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Type:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${selectedNodeType.isBuiltIn ? 'bg-gray-600 text-gray-300' : 'bg-green-900 text-green-300'}`}>
                          {selectedNodeType.isBuiltIn ? 'Built-in' : 'Custom'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Usage Count:</span>
                        <span className="text-white font-medium">{selectedNodeType.usageCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Created By:</span>
                        <span className="text-white">{selectedNodeType.createdBy}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Created:</span>
                        <span className="text-white">{selectedNodeType.createdAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Schema Summary</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Total Fields:</span>
                        <span className="text-white font-medium">{selectedNodeType.fields.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Required Fields:</span>
                        <span className="text-white font-medium">{selectedNodeType.fields.filter(f => f.required).length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Optional Fields:</span>
                        <span className="text-white font-medium">{selectedNodeType.fields.filter(f => !f.required).length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Field Details */}
                <div className="lg:col-span-2">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Field Definitions</h3>
                    <div className="space-y-3">
                      {selectedNodeType.fields.map((field) => (
                        <div key={field.id} className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-white">{field.name}</h4>
                              {field.required && (
                                <span className="text-red-400 text-sm">*required</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs font-medium">
                                {field.type}
                              </span>
                              {field.type === 'date' && <Calendar className="h-4 w-4 text-gray-400" />}
                              {field.type === 'number' && <Hash className="h-4 w-4 text-gray-400" />}
                              {field.type === 'reference' && <User className="h-4 w-4 text-gray-400" />}
                            </div>
                          </div>
                          
                          {field.defaultValue && (
                            <div className="text-sm text-gray-400 mb-2">
                              Default: <span className="text-gray-300">{field.defaultValue}</span>
                            </div>
                          )}
                          
                          {field.options && (
                            <div className="text-sm text-gray-400 mb-2">
                              Options: <span className="text-gray-300">{field.options.join(', ')}</span>
                            </div>
                          )}
                          
                          {field.referenceType && (
                            <div className="text-sm text-gray-400">
                              References: <span className="text-gray-300">{field.referenceType}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}