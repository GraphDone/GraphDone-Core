import {COMPACT_WORKSPACE_QUERY} from '../hooks/useCompactWorkspace';
import { offlineEnabled } from '../lib/offline/engine';
import { skipBackgroundPoll, useHostedUsage } from '../lib/hostedUsage';
import { AgentConnection } from '../components/AgentConnection';
import type { WorkItem } from '../types/graph';
import { useState, useEffect, useCallback } from 'react';
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
import { isGraphServiceAvailable, useHealthStatus } from '../hooks/useHealthStatus';
import { useViewMode } from '../contexts/ViewModeContext';
import { parseLayoutMode, LAYOUT_MODE_STORAGE_KEY, type LayoutMode } from '../lib/layoutAlgorithms';
import { UndoStack } from '../lib/undoStack';
import { useNotifications } from '../contexts/NotificationContext';

export function Workspace() {
  const { usage: cloudUsage } = useHostedUsage();
  const cloudPaused = !offlineEnabled && !!cloudUsage && cloudUsage.status !== 'AVAILABLE';
  const [showAgentConnection, setShowAgentConnection] = useState(false);
  useEffect(()=>{const open=()=>setShowAgentConnection(true);const create=()=>setShowCreateModal(true);window.addEventListener('graphdone-create-task',create);window.addEventListener('graphdone-connect-agent',open);return()=>{window.removeEventListener('graphdone-connect-agent',open);window.removeEventListener('graphdone-create-task',create);};},[]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateGraphModal, setShowCreateGraphModal] = useState(false);
  const [showUpdateGraphModal, setShowUpdateGraphModal] = useState(false);
  const [showDeleteGraphModal, setShowDeleteGraphModal] = useState(false);
  const [showGraphSelectionModal, setShowGraphSelectionModal] = useState(false);
  const [graphToEdit, setGraphToEdit] = useState<any>(null);
  const { viewMode, setViewMode } = useViewMode();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(COMPACT_WORKSPACE_QUERY).matches
  );
  // Graph touch-interaction lock — on a phone, default to locked so panning the
  // canvas never accidentally drags a node or an edge label; unlock to edit.
  const [graphLocked, setGraphLocked] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(COMPACT_WORKSPACE_QUERY).matches
  );
  const [showMiniMap, setShowMiniMap] = useState(() => window.innerWidth >= 1024 && window.innerHeight >= 600);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    parseLayoutMode(typeof window !== 'undefined' ? window.localStorage.getItem(LAYOUT_MODE_STORAGE_KEY) : null)
  );
  const toggleLayoutMode = () => {
    const next: LayoutMode = layoutMode === 'hierarchical' ? 'force' : 'hierarchical';
    setLayoutMode(next);
    try { window.localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, next); } catch { /* storage unavailable */ }
    (window as any).triggerLayoutMode?.(next);
  };
  const { currentGraph, availableGraphs, getBreadcrumb, ascendTo, canEditGraph } = useGraph();
  const [undoStack] = useState(() => new UndoStack(36));
  const { showSuccess, showError } = useNotifications();
  useEffect(() => { undoStack.clear(); }, [currentGraph?.id, undoStack]);
  const runUndo = useCallback(async () => {
    try {
      const action = await undoStack.undo();
      if (action) showSuccess(`Undid: ${action.label}`);
    } catch {
      showError('Could not undo that — the server refused');
    }
  }, [showError, showSuccess, undoStack]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      event.preventDefault();
      void runUndo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runUndo]);
  const breadcrumb = getBreadcrumb();
  const [inspectorNode, setInspectorNode] = useState<any>(null);
  const [quickEditRequest, setQuickEditRequest] = useState<WorkItem | null>(null);
  const { currentTeam, currentUser } = useAuth();
  const { health, loading: healthLoading, error: healthError } = useHealthStatus();

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_WORKSPACE_QUERY);
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
    pollInterval: 60000,
    skipPollAttempt: skipBackgroundPoll,
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
    pollInterval: 60000,
    skipPollAttempt: skipBackgroundPoll,
    fetchPolicy: currentGraph ? 'cache-and-network' : 'cache-only'
  });

  const actualNodeCount = workItemsData?.workItems?.length || 0;
  const actualEdgeCount = edgesData?.edges?.length || 0;

  return (
    <div className="h-full min-h-0 flex flex-col">
      {showAgentConnection && currentGraph && <AgentConnection graphId={currentGraph.id} graphName={currentGraph.name} onClose={() => setShowAgentConnection(false)} />}

      {/* Header with Graph Context — tablet/desktop only; phones use the Layout
          top bar (project selector) + the bottom nav, so this band is hidden there. */}
      <div data-workspace-header className="workspace-toolbar hidden md:block border-b px-3 py-2 sm:px-4 sm:py-2">
        {/* Responsive Layout Container */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-4">

          {/* Left Section: Graph Selector */}
          <div className="min-w-0 md:order-1 w-full md:w-auto md:max-w-xs md:w-72 md:shrink-0">
            <div className="flex items-center space-x-4 h-full">
              {/* Title & Version - Compact */}
              <div className="sr-only">
                <h1 className="text-sm font-medium text-gray-200 leading-tight">
                  GraphDone
                </h1>
                <div className="flex items-center space-x-2 text-xs text-gray-400 leading-tight">
                  <span>Workspace</span>
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
          <div className="hidden xl:flex flex-1 min-w-0 justify-start xl:justify-center md:order-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="workspace-view-switcher" role="group" aria-label="Workspace views">
              <button
                onClick={() => setViewMode('graph')}
                aria-pressed={viewMode === 'graph'}
                className="workspace-view-tab"
                title="Graph View"
              >
                <Network className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Graph
                </div>
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                aria-pressed={viewMode === 'dashboard'}
                className="workspace-view-tab"
                title="Dashboard View"
              >
                <LayoutDashboard className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Dashboard
                </div>
              </button>
              <button
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
                className="workspace-view-tab"
                title="Table View"
              >
                <Table className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Table
                </div>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                aria-pressed={viewMode === 'cards'}
                className="workspace-view-tab"
                title="Card View"
              >
                <CreditCard className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Card
                </div>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                aria-pressed={viewMode === 'kanban'}
                className="workspace-view-tab"
                title="Kanban View"
              >
                <Columns className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Kanban
                </div>
              </button>
              <button
                onClick={() => setViewMode('gantt')}
                aria-pressed={viewMode === 'gantt'}
                className="workspace-view-tab"
                title="Gantt Chart"
              >
                <GanttChartSquare className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Gantt
                </div>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                aria-pressed={viewMode === 'calendar'}
                className="workspace-view-tab"
                title="Calendar View"
              >
                <CalendarDays className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Calendar
                </div>
              </button>
              <button
                onClick={() => setViewMode('activity')}
                aria-pressed={viewMode === 'activity'}
                className="workspace-view-tab"
                title="Activity Feed"
              >
                <Activity className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8" strokeWidth={1.5} />
                <div className="text-[10px] sm:text-xs text-center font-medium leading-tight">
                  Activity
                </div>
              </button>
            </div>
          </div>

          <select aria-label="Workspace view" value={viewMode} onChange={event => setViewMode(event.target.value as typeof viewMode)} className="xl:hidden min-h-[44px] flex-1 min-w-0 rounded-lg border border-gray-600 bg-gray-800 px-3 text-base text-white">
            {['graph', 'cards', 'dashboard', 'table', 'kanban', 'gantt', 'calendar', 'activity'].map(mode => <option key={mode} value={mode}>{({ graph: 'Graph', cards: 'Work list', dashboard: 'Overview', table: 'Table', kanban: 'Board', gantt: 'Timeline', calendar: 'Calendar', activity: 'Activity' } as Record<string, string>)[mode]}</option>)}
          </select>

          {currentGraph && currentGraph.createdBy === currentUser?.id && <button onClick={() => setShowAgentConnection(true)} className="min-h-[44px] shrink-0 rounded-lg bg-violet-700 px-3 text-white">Your agent</button>}
          {currentGraph && canEditGraph(currentGraph.id) && (
            <button onClick={() => setShowCreateModal(true)} aria-label="New work item" title="New work item" className="workspace-create shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg">
              <Plus className="h-5 w-5" />
            </button>
          )}

          {/* Right Section: Status and Actions — hidden on mobile (the hamburger
              handles nav there); these chips otherwise eat the small-screen width. */}
          <div className="hidden xl:flex flex-col items-stretch gap-1.5 md:order-3 md:shrink-0">
            {/* Data-store status (provider-agnostic — keyed off the GraphQL API, which is
                the actual data layer; the backing store may be D1, Neo4j, etc.) */}
            <div className={`workspace-connection flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-xs cursor-help ${
              isGraphServiceAvailable(health)
                ? 'text-emerald-200'
                : 'bg-red-600/20 text-red-300 border border-red-500/30'
            }`} title={
              isGraphServiceAvailable(health)
                ? health?.services?.graphql?.status === 'available'
                  ? 'GraphDone is online. Storage is checked when work loads.'
                  : 'Connected to the graph service'
                : 'Server unreachable — limited functionality'
            }>
              <Database className="w-4 h-4" />
              <span className="font-medium">
                {isGraphServiceAvailable(health) ? (health?.services?.graphql?.status === 'available' ? 'Online' : 'Connected') : 'Offline'}
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
      <div data-testid="workspace-content" className="flex-1 relative min-h-0">
        {!currentGraph ? (
          <div className="h-full overflow-y-auto flex flex-col items-center bg-gray-900 relative">
            <div className="lagoon-caustics"></div>

            <div className="text-center shrink-0 max-w-xl mx-auto my-auto px-6 py-6 relative z-20">
              {/* Compact Icon */}
              <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm border border-green-400/20">
                <Plus className="h-8 w-8 text-white" />
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                Welcome to GraphDone
              </h1>
              
              <h2 className="text-lg font-medium text-green-300 mb-4">
                {cloudPaused ? 'Projects could not be loaded' : availableGraphs.length > 0 ? 'No Graph Selected' : 'No Graphs Available'}
              </h2>
              
              <p className="text-gray-300 mb-8 leading-relaxed">
                {cloudPaused ? 'Cloud access is paused. Check your allowance in Settings.' : availableGraphs.length > 0
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
                  disabled={cloudPaused}
                  className="disabled:opacity-40 disabled:cursor-not-allowed w-full px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 backdrop-blur-sm border border-green-400/30"
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
            {!offlineEnabled && !healthLoading && !isGraphServiceAvailable(health) && (
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
            <SafeGraphVisualization onNodeSelected={setInspectorNode} interactionLocked={isMobile && graphLocked} quickEditRequest={quickEditRequest} onQuickEditRequestHandled={() => setQuickEditRequest(null)} undoStack={undoStack} />
           </div>
           {/* Lock toggle (compact layouts): when locked, touch pans the canvas and never
               drags a node or edge label; unlock to rearrange/edit. */}
           {isMobile && (
             <button
               data-testid="graph-lock-toggle"
               onClick={() => setGraphLocked((v) => !v)}
               className={`absolute top-3 right-3 z-40 flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-full shadow-lg backdrop-blur-sm border text-xs font-medium transition-colors ${
                 graphLocked
                   ? 'bg-gray-900/90 border-gray-600 text-gray-200'
                   : 'bg-green-600/90 border-green-400 text-white'
               }`}
               title={graphLocked ? 'Locked — tap to edit' : 'Editing — tap to lock'}
             >
               {graphLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
               {graphLocked ? 'Locked' : 'Editing'}
             </button>
           )}
           {/* Zoom-extents: frame every node, independent of the camera-restore
               state. Sits under the lock toggle in compact layouts; top-left on desktop,
               where the right corner is taken by the docked inspector. */}
           <button
             data-testid="graph-zoom-extents"
             onClick={() => (window as any).triggerZoomToFit?.()}
             className="absolute top-16 right-3 md:top-3 md:left-3 md:right-auto z-40 flex items-center justify-center w-11 h-11 rounded-full shadow-lg backdrop-blur-sm border border-gray-600 bg-gray-900/90 text-gray-200 hover:text-white hover:border-green-400 transition-colors"
             title="Zoom to fit — frame all nodes"
             aria-label="Zoom to fit — frame all nodes"
           >
             <Maximize2 className="h-4 w-4" />
           </button>
           {/* Layout mode (desktop): force (organic) vs hierarchical (dependency
               layers). Lives in the graph control cluster under zoom-extents, so
               it never overlaps the left sidebar's console toggle. */}
           <button
             data-testid="graph-layout-toggle"
             onClick={toggleLayoutMode}
             className={`hidden md:flex absolute top-16 left-3 z-40 items-center justify-center w-10 h-10 rounded-full shadow-lg backdrop-blur-sm border transition-colors ${
               layoutMode === 'hierarchical'
                 ? 'bg-blue-600/90 border-blue-400 text-white hover:bg-blue-500/90'
                 : 'bg-gray-900/90 border-gray-600 text-gray-300 hover:text-white hover:border-blue-400'
             }`}
             title={layoutMode === 'hierarchical' ? 'Hierarchical layout (click for force)' : 'Force layout (click for hierarchical)'}
             aria-label="Toggle hierarchical layout"
           >
             <Network className="h-4 w-4" />
           </button>
           {inspectorNode && (
             <div className="absolute z-40 inset-x-3 bottom-3 md:inset-x-auto md:bottom-auto md:top-3 md:right-3">
               <NodeInspector node={inspectorNode} onClose={() => setInspectorNode(null)} onEdit={() => { setQuickEditRequest(inspectorNode); setInspectorNode(null); }} />
             </div>
           )}
          </div>
        ) : (
          <ViewManager viewMode={viewMode as 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity'} undoStack={undoStack} />
        )}
      </div>

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
              <MiniMap key={currentGraph.id} expectedNodeCount={actualNodeCount} />
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
          undoStack={undoStack}
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
