import { useState } from 'react';
import { Plus, Share2, Users, Table, Activity, Network, CreditCard, Columns, CalendarDays, GanttChartSquare, LayoutDashboard } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { SafeGraphVisualization } from '../components/SafeGraphVisualization';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { CreateGraphModal } from '../components/CreateGraphModal';
import { GraphSelectionModal } from '../components/GraphSelectionModal';
import ViewManager from '../components/ViewManager';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';

export function Workspace() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateGraphModal, setShowCreateGraphModal] = useState(false);
  const [showGraphSelectionModal, setShowGraphSelectionModal] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity'>('graph');
  const { currentGraph, availableGraphs } = useGraph();
  const { currentTeam, currentUser } = useAuth();

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
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left Section: Graph Info and Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 lg:gap-8 flex-1">
              {/* Graph Information */}
              <div className="flex-shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-green-300 to-blue-400 bg-clip-text text-transparent">
                  {currentGraph?.name || 'Select a Graph'}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-400 mt-1">
                  {currentTeam && (
                    <>
                      <span>{currentTeam.name}</span>
                      <span>•</span>
                    </>
                  )}
                  {currentGraph && (
                    <>
                      <span className="whitespace-nowrap">{actualNodeCount} node{actualNodeCount !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span className="whitespace-nowrap">{actualEdgeCount} connection{actualEdgeCount !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shadow-sm ${
                        currentGraph.type === 'PROJECT' ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' :
                        currentGraph.type === 'WORKSPACE' ? 'bg-purple-500/20 text-purple-300 border-purple-400/30' :
                        currentGraph.type === 'SUBGRAPH' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' :
                        currentGraph.type === 'TEMPLATE' ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' :
                        'bg-slate-500/20 text-slate-300 border-slate-400/30'
                      }`}>
                        {currentGraph.type}
                      </span>
                      {currentGraph.isShared && (
                        <>
                          <span>•</span>
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 shadow-sm">
                            <Share2 className="h-3 w-3" />
                            <span className="text-xs font-medium">Shared</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* All Views Selector - Responsive */}
              <div className="flex items-center flex-1 ml-8">
                <div className="flex bg-gray-700/50 backdrop-blur-sm rounded-lg p-2 gap-4 overflow-x-auto w-full justify-between">
              <button
                onClick={() => setViewMode('graph')}
                className={`px-3 py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center space-y-2 ${
                  viewMode === 'graph' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Graph View"
              >
                <Network className="h-5 w-5" />
                <div className="text-xs text-center font-medium">
                  <div>Graph</div>
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
                <LayoutDashboard className="h-5 w-5" />
                <div className="text-xs text-center font-medium">
                  <div>Dashboard</div>
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
                <Table className="h-5 w-5" />
                <div className="text-xs text-center font-medium">
                  <div>Table</div>
                  <div>View</div>
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
                <CreditCard className="h-5 w-5" />
                <div className="text-xs text-center font-medium">
                  <div>Card</div>
                  <div>View</div>
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
                <Columns className="h-5 w-5" />
                <div className="text-xs text-center font-medium">
                  <div>Kanban</div>
                  <div>View</div>
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
                <GanttChartSquare className="h-5 w-5" />
                <div className="text-xs text-center font-medium">
                  <div>Gantt</div>
                  <div>Chart</div>
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
                <CalendarDays className="h-5 w-5" />
                <div className="text-xs text-center font-medium">
                  <div>Calendar</div>
                  <div>View</div>
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
                <Activity className="h-5 w-5" />
                <div className="text-xs text-center font-medium">
                  <div>Activity</div>
                  <div>Feed</div>
                </div>
              </button>
                </div>
              </div>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
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
          <SafeGraphVisualization />
        ) : (
          <ViewManager viewMode={viewMode as 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity'} />
        )}
      </div>

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
    </div>
  );
}