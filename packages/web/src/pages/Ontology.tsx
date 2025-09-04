import { useState } from 'react';
import { Plus, Search, Edit3, Trash2, Eye, Copy, Brain, Settings, X, Calendar, User, Hash } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  WORK_ITEM_TYPES, 
  getTypeIconElement, 
  getTypeColorScheme,
  WorkItemType,
  RELATIONSHIP_TYPES,
  getRelationshipIconElement,
  getRelationshipColorScheme,
  RelationshipType
} from '../constants/workItemConstants';

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
  const [selectedRelationshipType, setSelectedRelationshipType] = useState<any>(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [relationshipSearchTerm, setRelationshipSearchTerm] = useState('');

  // Generate node types from centralized constants
  const mockNodeTypes: NodeType[] = Object.entries(WORK_ITEM_TYPES).map(([key, config]) => ({
    id: key.toLowerCase(),
    name: config.label,
    description: config.description || 'No description available',
    color: key.toLowerCase(),
    icon: key as WorkItemType,
    isBuiltIn: true,
    usageCount: Math.floor(Math.random() * 100) + 5, // Mock usage data
    createdBy: 'system',
    createdAt: '2024-01-01',
    fields: [
      { id: 'title', name: 'title', type: 'text' as const, required: true },
      { id: 'description', name: 'description', type: 'text' as const, required: false },
      { id: 'type', name: 'type', type: 'text' as const, required: true },
      { id: 'status', name: 'status', type: 'text' as const, required: true },
      { id: 'priority', name: 'priority', type: 'number' as const, required: false },
      { id: 'assignedTo', name: 'assignedTo', type: 'text' as const, required: false },
      { id: 'dueDate', name: 'dueDate', type: 'text' as const, required: false },
      { id: 'tags', name: 'tags', type: 'text' as const, required: false }
    ]
  }));

  const filteredTypes = mockNodeTypes.filter(type =>
    type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    type.description.toLowerCase().includes(searchTerm.toLowerCase())
  );


  // Generate relationship types from centralized constants
  const relationshipTypes = Object.values(RELATIONSHIP_TYPES).map(config => ({
    id: config.type.toLowerCase(),
    type: config.type,
    label: config.label,
    description: config.description,
    color: config.color,
    hexColor: config.hexColor,
    isBuiltIn: true,
    usageCount: Math.floor(Math.random() * 50) + 10, // Mock usage data
    createdBy: 'system',
    createdAt: '2024-01-01'
  }));

  const filteredRelationships = relationshipTypes.filter(rel =>
    rel.label.toLowerCase().includes(relationshipSearchTerm.toLowerCase()) ||
    rel.description.toLowerCase().includes(relationshipSearchTerm.toLowerCase())
  );


  const getColorClasses = (nodeType: string) => {
    const type = nodeType.toUpperCase() as WorkItemType;
    const config = WORK_ITEM_TYPES[type];
    if (config) {
      // Use the centralized background and border colors directly
      return `${config.bgColor} ${config.color} ${config.borderColor}`;
    }
    return 'bg-gray-700 text-gray-300 border-gray-600';
  };

  const getRelationshipClasses = (relationshipType: string) => {
    const type = relationshipType as RelationshipType;
    const colorScheme = getRelationshipColorScheme(type);
    // Use centralized color scheme
    return `${colorScheme.background} ${colorScheme.text} ${colorScheme.border}`;
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
                  placeholder="Search node types"
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
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border ${getColorClasses(nodeType.icon)}`}>
                        {getTypeIconElement(nodeType.icon as WorkItemType, "h-5 w-5")}
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
            {/* Search and filters */}
            <div className="mb-6 flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search relationship types"
                  value={relationshipSearchTerm}
                  onChange={(e) => setRelationshipSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div className="text-sm text-gray-400">
                {filteredRelationships.length} relationship types
              </div>
            </div>

            {/* Relationship Types Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRelationships.map((relType) => (
                <div key={relType.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border ${getRelationshipClasses(relType.type)}`}>
                        {getRelationshipIconElement(relType.type as RelationshipType, "h-5 w-5")}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-100">{relType.label}</h3>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">Built-in</span>
                          <span>{relType.usageCount} used</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => {
                          setSelectedRelationshipType(relType);
                          setShowRelationshipModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-4 flex-grow">{relType.description}</p>

                  <div className="space-y-2 mt-auto">
                    <h4 className="text-sm font-medium text-gray-100">Properties</h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">Direction</span>
                        <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">Directional</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">Type</span>
                        <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">{relType.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${getColorClasses(selectedNodeType.icon)}`}>
                  {getTypeIconElement(selectedNodeType.icon as WorkItemType, "h-6 w-6")}
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

      {/* Relationship Type Detail Modal */}
      {showRelationshipModal && selectedRelationshipType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${getRelationshipClasses(selectedRelationshipType.type)}`}>
                  {getRelationshipIconElement(selectedRelationshipType.type as RelationshipType, "h-6 w-6")}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedRelationshipType.label}</h2>
                  <p className="text-gray-400">{selectedRelationshipType.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowRelationshipModal(false)}
                className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Basic Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Type:</span>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-600 text-gray-300">
                          Built-in
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Usage Count:</span>
                        <span className="text-white font-medium">{selectedRelationshipType.usageCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Created By:</span>
                        <span className="text-white">{selectedRelationshipType.createdBy}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Created:</span>
                        <span className="text-white">{selectedRelationshipType.createdAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Relationship Properties</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Direction:</span>
                        <span className="text-white font-medium">Directional</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Symmetric:</span>
                        <span className="text-white font-medium">No</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Transitive:</span>
                        <span className="text-white font-medium">
                          {selectedRelationshipType.type === 'DEPENDS_ON' ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Usage Examples */}
                <div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Usage Examples</h3>
                    <div className="space-y-3">
                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                        <div className="text-sm text-gray-400 mb-2">Typical Usage:</div>
                        <div className="text-gray-300">
                          {selectedRelationshipType.type === 'DEPENDS_ON' && 'Task A depends on Task B to be completed first'}
                          {selectedRelationshipType.type === 'BLOCKS' && 'Bug A blocks Feature B from being implemented'}
                          {selectedRelationshipType.type === 'ENABLES' && 'Research A enables Feature B development'}
                          {selectedRelationshipType.type === 'RELATES_TO' && 'Epic A relates to Milestone B in scope'}
                          {selectedRelationshipType.type === 'IS_PART_OF' && 'Task A is part of Epic B'}
                          {selectedRelationshipType.type === 'FOLLOWS' && 'Phase A follows Phase B in sequence'}
                          {selectedRelationshipType.type === 'PARALLEL_WITH' && 'Task A runs parallel with Task B'}
                          {selectedRelationshipType.type === 'DUPLICATES' && 'Issue A duplicates Issue B'}
                          {selectedRelationshipType.type === 'CONFLICTS_WITH' && 'Feature A conflicts with Feature B'}
                          {selectedRelationshipType.type === 'VALIDATES' && 'Test A validates Feature B'}
                          {selectedRelationshipType.type === 'REFERENCES' && 'Doc A references Implementation B'}
                          {selectedRelationshipType.type === 'CONTAINS' && 'Epic A contains multiple Tasks'}
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                        <div className="text-sm text-gray-400 mb-2">Inverse Relationship:</div>
                        <div className="text-gray-300">
                          {selectedRelationshipType.type === 'DEPENDS_ON' && 'Required By'}
                          {selectedRelationshipType.type === 'BLOCKS' && 'Blocked By'}
                          {selectedRelationshipType.type === 'ENABLES' && 'Enabled By'}
                          {selectedRelationshipType.type === 'RELATES_TO' && 'Related To (bidirectional)'}
                          {selectedRelationshipType.type === 'IS_PART_OF' && 'Contains'}
                          {selectedRelationshipType.type === 'FOLLOWS' && 'Precedes'}
                          {selectedRelationshipType.type === 'PARALLEL_WITH' && 'Parallel With (bidirectional)'}
                          {selectedRelationshipType.type === 'DUPLICATES' && 'Duplicated By'}
                          {selectedRelationshipType.type === 'CONFLICTS_WITH' && 'Conflicts With (bidirectional)'}
                          {selectedRelationshipType.type === 'VALIDATES' && 'Validated By'}
                          {selectedRelationshipType.type === 'REFERENCES' && 'Referenced By'}
                          {selectedRelationshipType.type === 'CONTAINS' && 'Part Of'}
                        </div>
                      </div>
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