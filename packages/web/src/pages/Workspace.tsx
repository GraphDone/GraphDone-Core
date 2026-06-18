import { useState, useEffect } from 'react';
import { Plus, Share2, Users, Table, Activity, Network, CreditCard, Columns, CalendarDays, GanttChartSquare, LayoutDashboard, Database, AlertTriangle, Map, X, Minimize2, Maximize2, Edit3, Trash2, FolderPlus, ChevronLeft, ChevronRight, Lock, Unlock } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useQuery } from '@apollo/client';
import { SafeGraphVisualization } from '../components/SafeGraphVisualization';
import { NodeInspector } from '../components/NodeInspector';
import { GraphSelector } from '../components/GraphSelector';
import { MiniMap } from '../components/MiniMap';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
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
import { useViewMode } from '../contexts/ViewModeContext';

export function Workspace() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateGraphModal, setShowCreateGraphModal] = useState(false);
  const [showUpdateGraphModal, setShowUpdateGraphModal] = useState(false);
  const [showDeleteGraphModal, setShowDeleteGraphModal] = useState(false);
  const [showGraphSelectionModal, setShowGraphSelectionModal] = useState(false);
  const [graphToEdit, setGraphToEdit] = useState<any>(null);
  const { viewMode, setViewMode } = useViewMode();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  // Graph touch-interaction lock — on a phone, default to locked so panning the
  // canvas never accidentally drags a node or an edge label; unlock to edit.
  const [graphLocked, setGraphLocked] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const [showMiniMap, setShowMiniMap] = useState(true);
  const { currentGraph, availableGraphs, getBreadcrumb, ascendTo } = useGraph();
  const breadcrumb = getBreadcrumb();
  const [inspectorNode, setInspectorNode] = useState<any>(null);
  const { currentTeam, currentUser } = useAuth();
  const { health, loading: healthLoading, error: healthError } = useHealthStatus();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
    <div className="h-full flex flex-col">
      {/* Header with Graph Context — tablet/desktop only; phones use the Layout
          top bar (project selector) + the bottom nav, so this band is hidden there. */}
      <div className="hidden md:block bg-gray-900/30 backdrop-blur-md border-b border-gray-700/30 px-3 py-2 sm:px-6 sm:py-4">
        {/* Responsive Layout Container */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-4">

          {/* Left Section: Graph Selector */}
          <div className="min-w-0 md:order-1 w-full md:w-auto md:max-w-xs md:shrink">
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
                  onEditGraph={(graph) => {
                    setGraphToEdit(graph);
                    setShowUpdateGraphModal(true);
                  }}
                  onDeleteGraph={(graph) => setShowDeleteGraphModal(true)}
                />
              </div>
            </div>
          </div>

          {/* Center Section: View Mode Buttons — desktop/tablet only. Phones use the
              bottom tab bar (List / Graph / More) instead of this strip. */}
          <div className="flex flex-1 min-w-0 justify-start xl:justify-center md:order-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex flex-nowrap bg-gray-700/50 backdrop-blur-sm rounded-lg p-1.5 sm:p-2 gap-1 border border-gray-600/50">
              <button
                onClick={() => setViewMode('graph')}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center gap-0.5 sm:gap-2 min-w-[3rem] flex-shrink-0 ${
                  viewMode === 'graph' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Graph View"
              >
                <Network className="h-5 w-5 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Graph
                </div>
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center gap-0.5 sm:gap-2 min-w-[3rem] flex-shrink-0 ${
                  viewMode === 'dashboard' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Dashboard View"
              >
                <LayoutDashboard className="h-5 w-5 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Dashboard
                </div>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center gap-0.5 sm:gap-2 min-w-[3rem] flex-shrink-0 ${
                  viewMode === 'table' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Table View"
              >
                <Table className="h-5 w-5 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Table
                </div>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center gap-0.5 sm:gap-2 min-w-[3rem] flex-shrink-0 ${
                  viewMode === 'cards' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Card View"
              >
                <CreditCard className="h-5 w-5 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Card
                </div>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center gap-0.5 sm:gap-2 min-w-[3rem] flex-shrink-0 ${
                  viewMode === 'kanban' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Kanban View"
              >
                <Columns className="h-5 w-5 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Kanban
                </div>
              </button>
              <button
                onClick={() => setViewMode('gantt')}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center gap-0.5 sm:gap-2 min-w-[3rem] flex-shrink-0 ${
                  viewMode === 'gantt' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Gantt Chart"
              >
                <GanttChartSquare className="h-5 w-5 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Gantt
                </div>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center gap-0.5 sm:gap-2 min-w-[3rem] flex-shrink-0 ${
                  viewMode === 'calendar' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Calendar View"
              >
                <CalendarDays className="h-5 w-5 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Calendar
                </div>
              </button>
              <button
                onClick={() => setViewMode('activity')}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm rounded transition-colors whitespace-nowrap flex flex-col items-center gap-0.5 sm:gap-2 min-w-[3rem] flex-shrink-0 ${
                  viewMode === 'activity' 
                    ? 'bg-green-600 text-white shadow' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Activity Feed"
              >
                <Activity className="h-5 w-5 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Activity
                </div>
              </button>
            </div>
          </div>

          {/* Right Section: Status and Actions — hidden on mobile (the hamburger
              handles nav there); these chips otherwise eat the small-screen width. */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 md:order-3 md:shrink-0">
            {/* Data-store status (provider-agnostic — keyed off the GraphQL API, which is
                the actual data layer; the backing store may be D1, Neo4j, etc.) */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all cursor-help ${
              health?.services?.graphql?.status === 'healthy'
                ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                : 'bg-red-600/20 text-red-300 border border-red-500/30'
            }`} title={
              health?.services?.graphql?.status === 'healthy'
                ? 'Connected — all operations available'
                : 'Server unreachable — limited functionality'
            }>
              <Database className="w-4 h-4" />
              <span className="font-medium">
                {health?.services?.graphql?.status === 'healthy' ? 'Connected' : 'Offline'}
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

      {/* Hierarchy breadcrumb — shown when we've descended into a sub-graph */}
      {breadcrumb.length > 1 && (
        <div
          data-testid="graph-breadcrumb"
          className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700/20 px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-1 text-sm overflow-x-auto"
        >
          <button
            onClick={() => ascendTo(breadcrumb[breadcrumb.length - 2].id)}
            className="flex items-center gap-1 text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-700/40 transition-colors flex-shrink-0"
            title="Up one level"
          >
            <ChevronLeft className="h-4 w-4" />
            Up
          </button>
          <span className="text-gray-600 mx-1">|</span>
          {breadcrumb.map((g, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <span key={g.id} className="flex items-center gap-1 flex-shrink-0">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-600" />}
                {isLast ? (
                  <span className="text-green-300 font-medium px-1">{g.name}</span>
                ) : (
                  <button
                    onClick={() => ascendTo(g.id)}
                    className="text-gray-400 hover:text-white px-1 rounded hover:bg-gray-700/40 transition-colors"
                  >
                    {g.name}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 relative min-h-0">
        {!currentGraph ? (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative">
            <div className="lagoon-caustics"></div>

            <div className="text-center max-w-xl mx-auto px-6 relative z-20">
              {/* Compact Icon */}
              <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm border border-green-400/20">
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
                      className="w-full px-6 py-3 bg-gray-700/80 hover:bg-gray-600/80 backdrop-blur-sm text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border border-gray-600/30"
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
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 backdrop-blur-sm border border-green-400/30"
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
           <div className="relative w-full h-full">
            {/* Connection warning — fires only when the GraphQL data layer itself is
                unreachable, not when an optional store (Neo4j) is simply unused. */}
            {!healthLoading && health?.services?.graphql?.status !== 'healthy' && (
              <div className="absolute top-4 left-4 right-4 z-50">
                <div className="bg-red-600/90 backdrop-blur-sm border border-red-500 rounded-lg p-4 shadow-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-200 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-100 mb-1">Connection Lost</h3>
                      <p className="text-red-200 text-sm mb-2">
                        The server is unreachable. Some features are limited until it reconnects.
                      </p>
                      {healthError && (
                        <p className="text-red-300 text-xs font-mono bg-red-800/30 px-2 py-1 rounded">
                          {healthError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <SafeGraphVisualization onNodeSelected={setInspectorNode} interactionLocked={isMobile && graphLocked} />
           </div>
           {/* Lock toggle (phones): when locked, touch pans the canvas and never
               drags a node or edge label; unlock to rearrange/edit. */}
           <button
             data-testid="graph-lock-toggle"
             onClick={() => setGraphLocked((v) => !v)}
             className={`md:hidden absolute top-3 right-3 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg backdrop-blur-sm border text-xs font-medium transition-colors ${
               graphLocked
                 ? 'bg-gray-900/90 border-gray-600 text-gray-200'
                 : 'bg-green-600/90 border-green-400 text-white'
             }`}
             title={graphLocked ? 'Locked — tap to edit' : 'Editing — tap to lock'}
           >
             {graphLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
             {graphLocked ? 'Locked' : 'Editing'}
           </button>
           {/* Zoom-extents: frame every node, independent of the camera-restore
               state. Sits under the lock toggle on phones; top-left on desktop,
               where the right corner is taken by the docked inspector. */}
           <button
             data-testid="graph-zoom-extents"
             onClick={() => (window as any).triggerZoomToFit?.()}
             className="absolute top-16 right-3 md:top-3 md:left-3 md:right-auto z-40 flex items-center justify-center w-10 h-10 rounded-full shadow-lg backdrop-blur-sm border border-gray-600 bg-gray-900/90 text-gray-200 hover:text-white hover:border-green-400 transition-colors"
             title="Zoom to fit — frame all nodes"
             aria-label="Zoom to fit — frame all nodes"
           >
             <Maximize2 className="h-4 w-4" />
           </button>
           {inspectorNode && (
             <div className="absolute z-40 inset-x-3 bottom-3 md:inset-x-auto md:bottom-auto md:top-3 md:right-3">
               <NodeInspector node={inspectorNode} onClose={() => setInspectorNode(null)} />
             </div>
           )}
          </div>
        ) : (
          <ViewManager viewMode={viewMode as 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity'} />
        )}
      </div>

      {/* Create FAB (phones) — primary action; hidden for read-only guests and in
          graph view (where the on-canvas "+" grow flow creates nodes). */}
      {currentGraph && currentUser?.role !== 'GUEST' && viewMode !== 'graph' && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="md:hidden fixed right-4 bottom-[4.75rem] z-40 w-14 h-14 rounded-full bg-gradient-to-br from-green-600 to-blue-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="New work item"
          title="New work item"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      {/* Mini-Map Navigation - Bottom Right Corner (hidden on mobile: it covers too
          much of a phone screen, and panning the graph by touch is the primary nav there) */}
      {viewMode === 'graph' && currentGraph && showMiniMap && !isMobile && createPortal(
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
            <div className="w-full h-full bg-gray-900/50 rounded border border-gray-600 overflow-hidden">
              <MiniMap />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Mini-Map Toggle Button - Shows when mini-map is hidden (desktop only) */}
      {viewMode === 'graph' && currentGraph && !showMiniMap && !isMobile && createPortal(
        <button
          onClick={() => setShowMiniMap(true)}
          className="fixed bottom-4 right-4 bg-gray-800/90 backdrop-blur-sm border border-gray-600 rounded-lg p-3 shadow-xl hover:bg-gray-700/90 transition-all duration-200 z-50"
          title="Show Mini-Map"
        >
          <Map className="h-5 w-5 text-gray-400" />
        </button>,
        document.body
      )}

      {/* Create Work Item Modal */}
      {showCreateModal && (
        <CreateWorkItemModal
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
      {showUpdateGraphModal && graphToEdit && (
        <UpdateGraphModal
          isOpen={showUpdateGraphModal}
          graphToEdit={graphToEdit}
          onClose={() => {
            setShowUpdateGraphModal(false);
            setGraphToEdit(null);
          }}
        />
      )}

      {/* Delete Graph Modal */}
      {showDeleteGraphModal && currentGraph && (
        <DeleteGraphModal
          isOpen={showDeleteGraphModal}
          onClose={() => setShowDeleteGraphModal(false)}
        />
      )}
    </div>
  );
}