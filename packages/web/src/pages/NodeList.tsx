import { useState } from 'react';
import { Search, Filter, Plus, Clock, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { useFilteredNodes } from '../hooks/useTeamData';
import { useAuth } from '../contexts/AuthContext';

export function NodeList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const { currentTeam } = useAuth();
  const { nodes, totalNodes, filteredCount, loading, error, refetch } = useFilteredNodes(searchTerm, filterType);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Node List</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentTeam ? `${currentTeam.name} • ${totalNodes} nodes` : 'Browse and manage all nodes in your graph'}
            </p>
          </div>
          
          <button
            type="button"
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Node
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="outcome">Outcomes</option>
              <option value="task">Tasks</option>
              <option value="milestone">Milestones</option>
              <option value="idea">Ideas</option>
            </select>
            
            {filteredCount !== totalNodes && (
              <span className="text-sm text-gray-500">
                {filteredCount} of {totalNodes}
              </span>
            )}
            
            <button
              onClick={() => refetch()}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-red-800">Failed to load nodes. Please try again.</span>
                <button
                  onClick={() => refetch()}
                  className="ml-auto text-red-600 hover:text-red-800 underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {loading && nodes.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
              <p className="text-gray-500">Loading nodes...</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-8 text-center">
                <div className="mx-auto h-24 w-24 text-gray-300">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  {searchTerm || filterType !== 'all' ? 'No matching nodes' : 'No nodes yet'}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {searchTerm || filterType !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Get started by creating your first node to begin building your graph.'
                  }
                </p>
                {(!searchTerm && filterType === 'all') && (
                  <button
                    type="button"
                    className="mt-4 btn btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Node
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {nodes.map((node: any) => (
                <div key={node.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{node.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          node.type === 'OUTCOME' ? 'bg-blue-100 text-blue-800' :
                          node.type === 'TASK' ? 'bg-green-100 text-green-800' :
                          node.type === 'MILESTONE' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {node.type}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          node.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          node.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                          node.status === 'BLOCKED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {node.status}
                        </span>
                      </div>
                      
                      {node.description && (
                        <p className="text-gray-600 mb-3">{node.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {new Date(node.createdAt).toLocaleDateString()}
                        </div>
                        
                        {node.contributors && node.contributors.length > 0 && (
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {node.contributors.length} contributor{node.contributors.length > 1 ? 's' : ''}
                          </div>
                        )}
                        
                        {node.dependencies && node.dependencies.length > 0 && (
                          <div className="text-blue-600">
                            {node.dependencies.length} dependencies
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-2">
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          Priority: {((node.priority?.computed || 0) * 100).toFixed(1)}%
                        </div>
                        <div className="w-20 h-2 bg-gray-200 rounded-full mt-1">
                          <div 
                            className="h-2 bg-blue-600 rounded-full"
                            style={{ width: `${(node.priority?.computed || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button className="text-gray-400 hover:text-gray-600 transition-colors">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button className="text-gray-400 hover:text-red-600 transition-colors">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}