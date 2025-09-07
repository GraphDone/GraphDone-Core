import { useState } from 'react';
import { Plus, Share2, Users, Table, Activity, Network, CreditCard, Columns, CalendarDays, GanttChartSquare, LayoutDashboard, Database, AlertTriangle, Map, X, Minimize2, Edit3, Trash2, FolderPlus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useQuery } from '@apollo/client';
import { SafeGraphVisualization } from '../components/SafeGraphVisualization';
import { GraphSelector } from '../components/GraphSelector';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { CreateGraphModal } from '../components/CreateGraphModal';
import { GraphSelectionModal } from '../components/GraphSelectionModal';
import { UpdateGraphModal } from '../components/UpdateGraphModal';
import { DeleteGraphModal } from '../components/DeleteGraphModal';
import ViewManager from '../components/ViewManager';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';
import { APP_VERSION } from '../utils/version';
import { useHealthStatus } from '../hooks/useHealthStatus';

export function Workspace() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateGraphModal, setShowCreateGraphModal] = useState(false);
  const [showUpdateGraphModal, setShowUpdateGraphModal] = useState(false);
  const [showDeleteGraphModal, setShowDeleteGraphModal] = useState(false);
  const [showGraphSelectionModal, setShowGraphSelectionModal] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity'>('graph');
  const [showMiniMap, setShowMiniMap] = useState(true);
  const { currentGraph, availableGraphs } = useGraph();
  const { currentTeam, currentUser } = useAuth();
  const { health, loading: healthLoading, error: healthError } = useHealthStatus();

  // Get real-time counts for header display
  const { data: workItemsData } = useQuery(GET_WORK_ITEMS, {
    variables: currentGraph ? {
      where: {
        graph: {
          id: currentGraph.id
        }
      }
    } : { where: {} },
    pollInterval: currentGraph ? 5000 : 0,
    fetchPolicy: currentGraph ? 'cache-and-network' : 'cache-only'
  });

  const { data: edgesData } = useQuery(GET_EDGES, {
    variables: currentGraph ? {
      where: {
        source: {
          graph: {
            id: currentGraph.id
          }
        }
      }
    } : { where: {} },
    pollInterval: currentGraph ? 5000 : 0,
    fetchPolicy: currentGraph ? 'cache-and-network' : 'cache-only'
  });

  const actualNodeCount = workItemsData?.workItems?.length || 0;
  const actualEdgeCount = edgesData?.edges?.length || 0;


  return (
    <div className="h-screen flex flex-col">
      {/* Header with Graph Context */}
      <div className="bg-gray-900/30 backdrop-blur-md border-b border-gray-700/30 px-6 py-4">
        {/* Responsive Layout Container */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Left Section: Graph Selector */}
          <div className="flex-1 min-w-0 lg:order-1 max-w-lg">
            <div className="flex items-center space-x-4 h-full">
              {/* Title & Version - Compact */}
              <div className="flex flex-col justify-center">
                <h1 className="text-sm font-medium text-gray-200 leading-tight">
                  Graph Viewer
                </h1>
                <div className="flex items-center space-x-2 text-xs text-gray-400 leading-tight">
                  <span>v{APP_VERSION}</span>
                  {currentTeam && (
                    <>
                      <span>•</span>
                      <span>{currentTeam.name}</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Graph Selector - Full Featured */}
              <div className="flex-1 min-w-0">
                <GraphSelector 
                  onCreateGraph={() => setShowCreateGraphModal(true)}
                  onEditGraph={(graph) => setShowUpdateGraphModal(true)}
                  onDeleteGraph={(graph) => setShowDeleteGraphModal(true)}
                />
              </div>
            </div>
          </div>

          {/* Center Section: View Mode Buttons (Always Centered) */}
          <div className="flex justify-center lg:order-2">
            <div className="flex bg-gray-700/50 backdrop-blur-sm rounded-lg p-2 gap-1 border border-gray-600/50">
              <button
                onClick={() => setViewMode('graph')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'graph' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Graph View"
              >
                <Network className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-xs text-center font-medium">
                  Graph
                </div>
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'dashboard' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Dashboard View"
              >
                <LayoutDashboard className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-xs text-center font-medium">
                  Dashboard
                </div>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'table' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Table View"
              >
                <Table className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-xs text-center font-medium">
                  Table
                </div>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'cards' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Card View"
              >
                <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-xs text-center font-medium">
                  Card
                </div>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'kanban' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Kanban View"
              >
                <Columns className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-xs text-center font-medium">
                  Kanban
                </div>
              </button>
              <button
                onClick={() => setViewMode('gantt')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'gantt' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Gantt Chart"
              >
                <GanttChartSquare className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-xs text-center font-medium">
                  Gantt
                </div>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'calendar' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Calendar View"
              >
                <CalendarDays className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-xs text-center font-medium">
                  Calendar
                </div>
              </button>
              <button
                onClick={() => setViewMode('activity')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'activity' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Activity Feed"
              >
                <Activity className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-xs text-center font-medium">
                  Activity
                </div>
              </button>
            </div>
          </div>

          {/* Right Section: Status and Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:order-3">
            {/* Neo4j Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all cursor-help ${
              health?.services?.neo4j?.status === 'healthy' 
                ? 'bg-green-600/20 text-green-300 border border-green-500/30' 
                : 'bg-red-600/20 text-red-300 border border-red-500/30'
            }`} title={
              health?.services?.neo4j?.status === 'healthy' 
                ? 'Neo4j Graph Database Connected - All graph operations available' 
                : `Neo4j Graph Database Offline - Limited functionality${health?.services?.neo4j?.error ? `\nError: ${health.services.neo4j.error}` : ''}`
            }>
              <Database className="w-4 h-4" />
              <span className="font-medium">
                {health?.services?.neo4j?.status === 'healthy' ? 'Neo4j GraphDB' : 'Neo4j GraphDB Offline'}
              </span>
            </div>

            {currentGraph?.isShared && (
              <button
                type="button"
                className="btn btn-secondary"
              >
                <Users className="h-4 w-4 mr-2" />
                Collaborators
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {!currentGraph ? (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <div className="text-center max-w-xl mx-auto px-6">
              {/* Compact Icon */}
              <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Plus className="h-8 w-8 text-white" />
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                Welcome to GraphDone
              </h1>
              
              <h2 className="text-lg font-medium text-green-300 mb-4">
                {availableGraphs.length > 0 ? 'No Graph Selected' : 'No Graphs Available'}
              </h2>
              
              <p className="text-gray-300 mb-8 leading-relaxed">
                {availableGraphs.length > 0 
                  ? 'Ready to organize your work? Choose an existing graph or create a new one to get started.'
                  : 'Get started by creating your first graph to organize your work.'
                }
              </p>

              {/* Action Buttons */}
              <div className="space-y-3 mb-8">
                {availableGraphs.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowGraphSelectionModal(true)}
                      className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z"/>
                      </svg>
                      Select Graph
                    </button>

                    <div className="flex items-center">
                      <div className="flex-1 border-t border-gray-600"></div>
                      <span className="px-4 text-gray-400 text-xs font-medium bg-gray-900">OR</span>
                      <div className="flex-1 border-t border-gray-600"></div>
                    </div>
                  </>
                )}

                <button
                  onClick={() => setShowCreateGraphModal(true)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Graph
                </button>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-600/50 hover:border-green-500/50 transition-all duration-300 hover:bg-gray-700/50">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-medium text-white mb-1">Quick Start</h3>
                  <p className="text-xs text-gray-300">Create and organize efficiently</p>
                </div>

                <div className="text-center p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-600/50 hover:border-blue-500/50 transition-all duration-300 hover:bg-gray-700/50">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-medium text-white mb-1">Team Collaboration</h3>
                  <p className="text-xs text-gray-300">Work together seamlessly</p>
                </div>

                <div className="text-center p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-600/50 hover:border-purple-500/50 transition-all duration-300 hover:bg-gray-700/50">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Share2 className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-medium text-white mb-1">Visual Organization</h3>
                  <p className="text-xs text-gray-300">See project structure clearly</p>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'graph' ? (
          <div className="relative h-full">
            {/* Neo4j Connection Warning */}
            {health?.services?.neo4j?.status !== 'healthy' && (
              <div className="absolute top-4 left-4 right-4 z-50">
                <div className="bg-red-600/90 backdrop-blur-sm border border-red-500 rounded-lg p-4 shadow-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-200 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-100 mb-1">Database Connection Lost</h3>
                      <p className="text-red-200 text-sm mb-2">
                        Neo4j database is not available. Graph features are limited.
                      </p>
                      {health?.services?.neo4j?.error && (
                        <p className="text-red-300 text-xs font-mono bg-red-800/30 px-2 py-1 rounded">
                          {health.services.neo4j.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <SafeGraphVisualization />
          </div>
        ) : (
          <ViewManager viewMode={viewMode as 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity'} />
        )}
      </div>

      {/* Mini-Map Navigation - Bottom Right Corner */}
      {viewMode === 'graph' && currentGraph && showMiniMap && createPortal(
        <div className="fixed bottom-4 right-4 w-64 h-48 bg-gray-800/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-xl z-50">
          {/* Mini-Map Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Map className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Mini-Map</span>
            </div>
            <button
              onClick={() => setShowMiniMap(false)}
              className="p-1 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
              title="Hide Mini-Map"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Mini-Map Content */}
          <div className="p-3 h-32">
            <div className="w-full h-full bg-gray-900/50 rounded border border-gray-600 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Map className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Graph Overview</p>
                <p className="text-xs opacity-75">Coming Soon</p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Mini-Map Toggle Button - Shows when mini-map is hidden */}
      {viewMode === 'graph' && currentGraph && !showMiniMap && createPortal(
        <button
          onClick={() => setShowMiniMap(true)}
          className="fixed bottom-4 right-4 bg-gray-800/90 backdrop-blur-sm border border-gray-600 rounded-lg p-3 shadow-xl hover:bg-gray-700/90 transition-all duration-200 z-50"
          title="Show Mini-Map"
        >
          <Map className="h-5 w-5 text-gray-400" />
        </button>,
        document.body
      )}

      {/* Create Node Modal */}
      {showCreateModal && (
        <CreateNodeModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Create Graph Modal */}
      {showCreateGraphModal && (
        <CreateGraphModal
          isOpen={showCreateGraphModal}
          onClose={() => setShowCreateGraphModal(false)}
        />
      )}

      {/* Graph Selection Modal */}
      {showGraphSelectionModal && (
        <GraphSelectionModal
          isOpen={showGraphSelectionModal}
          onClose={() => setShowGraphSelectionModal(false)}
        />
      )}

      {/* Update Graph Modal */}
      {showUpdateGraphModal && currentGraph && (
        <UpdateGraphModal
          isOpen={showUpdateGraphModal}
          onClose={() => setShowUpdateGraphModal(false)}
          graph={currentGraph}
        />
      )}

      {/* Delete Graph Modal */}
      {showDeleteGraphModal && currentGraph && (
        <DeleteGraphModal
          isOpen={showDeleteGraphModal}
          onClose={() => setShowDeleteGraphModal(false)}
          graph={currentGraph}
        />
      )}
    </div>
  );
}