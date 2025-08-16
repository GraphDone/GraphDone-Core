import { useState } from 'react';
import { Plus, Search, Edit3, Trash2, Eye, Copy, Brain, Settings } from 'lucide-react';
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

  // Mock node types
  const mockNodeTypes: NodeType[] = [
    {
      id: 'outcome',
      name: 'Outcome',
      description: 'A high-level result or deliverable',
      color: 'blue',
      icon: '🎯',
      isBuiltIn: true,
      usageCount: 45,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: false },
        { id: 'dueDate', name: 'Due Date', type: 'date', required: false },
        { id: 'priority', name: 'Priority', type: 'select', required: true, options: ['High', 'Medium', 'Low'] }
      ]
    },
    {
      id: 'task',
      name: 'Task',
      description: 'A specific actionable item',
      color: 'green',
      icon: '✅',
      isBuiltIn: true,
      usageCount: 128,
      createdBy: 'system',
      createdAt: '2024-01-01',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'text', required: false },
        { id: 'estimatedHours', name: 'Estimated Hours', type: 'number', required: false },
        { id: 'assignee', name: 'Assignee', type: 'reference', required: false, referenceType: 'user' }
      ]
    },
    {
      id: 'milestone',
      name: 'Milestone',
      description: 'A significant checkpoint or achievement',
      color: 'purple',
      icon: '🏁',
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
      id: 'research',
      name: 'Research',
      description: 'Investigation or analysis work',
      color: 'orange',
      icon: '🔬',
      isBuiltIn: false,
      usageCount: 12,
      createdBy: 'user-1',
      createdAt: '2024-02-15',
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
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colorMap[color] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ontology</h1>
            <p className="text-sm text-gray-500 mt-1">
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
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('types')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'types'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Brain className="h-4 w-4 inline mr-2" />
              Node Types
            </button>
            <button
              onClick={() => setActiveTab('relationships')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'relationships'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Relationships
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="text-sm text-gray-500">
                {filteredTypes.length} types
              </div>
            </div>

            {/* Node Types Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTypes.map((nodeType) => (
                <div key={nodeType.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border ${getColorClasses(nodeType.color)}`}>
                        {nodeType.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{nodeType.name}</h3>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          {nodeType.isBuiltIn ? (
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">Built-in</span>
                          ) : (
                            <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded">Custom</span>
                          )}
                          <span>{nodeType.usageCount} used</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      {!nodeType.isBuiltIn && (
                        <>
                          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4">{nodeType.description}</p>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">Fields ({nodeType.fields.length})</h4>
                    <div className="space-y-1">
                      {nodeType.fields.slice(0, 3).map((field) => (
                        <div key={field.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">
                            {field.name}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </span>
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {field.type}
                          </span>
                        </div>
                      ))}
                      {nodeType.fields.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{nodeType.fields.length - 3} more fields
                        </div>
                      )}
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Relationship Types</h3>
              <p className="text-gray-500 mb-4">
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Node Templates</h3>
              <p className="text-gray-500 mb-4">
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
    </div>
  );
}