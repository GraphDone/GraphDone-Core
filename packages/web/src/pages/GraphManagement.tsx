import { useState } from 'react';
import { Plus, Search, Filter, Folder, FolderOpen, Share2, Lock, Users, Edit3, Trash2, Copy, Move, Crown, Eye, Calendar, Activity } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { Graph, GraphHierarchy } from '../types/graph';

export function GraphManagement() {
  const { currentTeam } = useAuth();
  const { 
    availableGraphs, 
    graphHierarchy, 
    selectGraph, 
    canEditGraph, 
    canDeleteGraph,
    canShareGraph 
  } = useGraph();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'PROJECT' | 'WORKSPACE' | 'SUBGRAPH' | 'TEMPLATE'>('all');
  const [viewMode, setViewMode] = useState<'hierarchy' | 'list'>('hierarchy');
  const [expandedGraphs, setExpandedGraphs] = useState<Set<string>>(new Set());
  const [selectedGraphs, setSelectedGraphs] = useState<Set<string>>(new Set());

  const filteredGraphs = availableGraphs.filter(graph => {
    const matchesSearch = !searchTerm || 
      graph.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      graph.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || graph.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const getGraphTypeColor = (type: Graph['type']) => {
    switch (type) {
      case 'PROJECT': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'WORKSPACE': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'SUBGRAPH': return 'text-green-600 bg-green-50 border-green-200';
      case 'TEMPLATE': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPermissionIcon = (graph: Graph) => {
    if (canDeleteGraph(graph.id)) return <Crown className="h-4 w-4 text-yellow-600" />;
    if (canEditGraph(graph.id)) return <Edit3 className="h-4 w-4 text-blue-600" />;
    return <Eye className="h-4 w-4 text-gray-600" />;
  };

  const toggleExpanded = (graphId: string) => {
    setExpandedGraphs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(graphId)) {
        newSet.delete(graphId);
      } else {
        newSet.add(graphId);
      }
      return newSet;
    });
  };

  const toggleSelected = (graphId: string) => {
    setSelectedGraphs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(graphId)) {
        newSet.delete(graphId);
      } else {
        newSet.add(graphId);
      }
      return newSet;
    });
  };

  const renderHierarchyView = (hierarchy: GraphHierarchy[], depth = 0) => {
    return hierarchy.map((graph) => {
      const fullGraph = availableGraphs.find(g => g.id === graph.id);
      if (!fullGraph) return null;

      const isExpanded = expandedGraphs.has(graph.id);
      const hasChildren = graph.children.length > 0;
      const isSelected = selectedGraphs.has(graph.id);
      
      return (
        <div key={graph.id} className="space-y-2">
          <div 
            className={`p-4 border rounded-lg transition-all ${
              isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            style={{ marginLeft: `${depth * 24}px` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelected(graph.id)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                
                {hasChildren && (
                  <button
                    onClick={() => toggleExpanded(graph.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {isExpanded ? (
                      <FolderOpen className="h-4 w-4 text-gray-600" />
                    ) : (
                      <Folder className="h-4 w-4 text-gray-600" />
                    )}
                  </button>
                )}
                
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${getGraphTypeColor(fullGraph.type)}`}>
                  {fullGraph.name.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900">{fullGraph.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getGraphTypeColor(fullGraph.type)}`}>
                      {fullGraph.type}
                    </span>
                    {fullGraph.isShared ? (
                      <Share2 className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-400" />
                    )}
                    {getPermissionIcon(fullGraph)}
                  </div>
                  
                  {fullGraph.description && (
                    <p className="text-gray-600 mt-1">{fullGraph.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Activity className="h-4 w-4" />
                      <span>{fullGraph.nodeCount} nodes</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>{fullGraph.contributorCount} contributors</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(fullGraph.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => selectGraph(graph.id)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Open
                </button>
                
                <div className="flex items-center space-x-1">
                  {canEditGraph(graph.id) && (
                    <>
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Move className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  
                  {canShareGraph(graph.id) && (
                    <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                      <Share2 className="h-4 w-4" />
                    </button>
                  )}
                  
                  {canDeleteGraph(graph.id) && (
                    <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div className="space-y-2">
              {renderHierarchyView(graph.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderListView = () => {
    return filteredGraphs.map((graph) => {
      const isSelected = selectedGraphs.has(graph.id);
      
      return (
        <div 
          key={graph.id}
          className={`p-4 border rounded-lg transition-all ${
            isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelected(graph.id)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${getGraphTypeColor(graph.type)}`}>
                {graph.name.charAt(0).toUpperCase()}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900">{graph.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getGraphTypeColor(graph.type)}`}>
                    {graph.type}
                  </span>
                  {graph.parentGraphId && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Subgraph
                    </span>
                  )}
                  {graph.isShared ? (
                    <Share2 className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}
                  {getPermissionIcon(graph)}
                </div>
                
                {graph.description && (
                  <p className="text-gray-600 mt-1">{graph.description}</p>
                )}
                
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Activity className="h-4 w-4" />
                    <span>{graph.nodeCount} nodes</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{graph.contributorCount} contributors</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(graph.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {graph.path.length > 0 && (
                    <div className="text-blue-600">
                      Depth: {graph.depth}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => selectGraph(graph.id)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Open
              </button>
              
              <div className="flex items-center space-x-1">
                {canEditGraph(graph.id) && (
                  <>
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      <Copy className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      <Move className="h-4 w-4" />
                    </button>
                  </>
                )}
                
                {canShareGraph(graph.id) && (
                  <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                    <Share2 className="h-4 w-4" />
                  </button>
                )}
                
                {canDeleteGraph(graph.id) && (
                  <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Graph Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentTeam ? `${currentTeam.name} • ${availableGraphs.length} graphs` : 'Manage your graphs and hierarchies'}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {selectedGraphs.size > 0 && (
              <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-800">{selectedGraphs.size} selected</span>
                <button className="text-blue-600 hover:text-blue-800">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <button
              type="button"
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Graph
            </button>
          </div>
        </div>
      </div>

      {/* Filters and controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search graphs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="PROJECT">Projects</option>
                <option value="WORKSPACE">Workspaces</option>
                <option value="SUBGRAPH">Subgraphs</option>
                <option value="TEMPLATE">Templates</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">View:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('hierarchy')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'hierarchy' 
                    ? 'bg-white text-gray-900 shadow' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Hierarchy
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-gray-900 shadow' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          {availableGraphs.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No graphs yet</h3>
              <p className="text-gray-500 mb-4">Create your first graph to get started with GraphDone</p>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create First Graph
              </button>
            </div>
          ) : filteredGraphs.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching graphs</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {viewMode === 'hierarchy' ? renderHierarchyView(graphHierarchy) : renderListView()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}