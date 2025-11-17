import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, Folder, FolderOpen, FileText, Share2, Eye, Edit3, Crown, Trash2, FolderPlus, ChevronRight, Users, Bot, Settings, Zap, User, Lock } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';

interface GraphSelectorProps {
  onCreateGraph?: () => void;
  onEditGraph?: (graph: any) => void;
  onDeleteGraph?: (graph: any) => void;
}

export function GraphSelector({ onCreateGraph, onEditGraph, onDeleteGraph }: GraphSelectorProps) {
  const { currentGraph, graphHierarchy, selectGraph } = useGraph();
  const { currentTeam, currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['team', 'personal']));
  const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ message: string; x: number; y: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get real-time counts for current graph
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

  // Function to get icon based on graph type - matches CreateGraphModal exactly
  const getGraphTypeIcon = (type?: string) => {
    switch (type) {
      case 'PROJECT':
        return <Folder className="h-4 w-4" />;
      case 'WORKSPACE':
        return <FolderOpen className="h-4 w-4" />;
      case 'SUBGRAPH':
        return <Plus className="h-4 w-4" />;
      case 'TEMPLATE':
        return <FileText className="h-4 w-4" />;
      default:
        return <Plus className="h-4 w-4" />;
    }
  };

  // Close dropdown when clicking outside - Updated for portal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      // Check if click is outside both the button and the portal dropdown
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        // For portal, we need to check if the click is inside any dropdown element
        const dropdownElement = document.querySelector('[style*="z-index: 999999999"]');
        if (!dropdownElement || !dropdownElement.contains(target)) {
          setIsOpen(false);
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Graph selection handler - DON'T close dropdown automatically
  const handleGraphSelect = (graphId: string) => {
    selectGraph(graphId);
    // setIsOpen(false); // Commented out - let it stay open
  };

  // Calculate button position for portal
  const updateButtonPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  // Toggle dropdown and calculate position
  const toggleDropdown = () => {
    if (!isOpen) {
      updateButtonPosition();
    }
    setIsOpen(!isOpen);
  };

  const getGraphTypeColor = (type: string) => {
    switch (type) {
      case 'PROJECT': return 'text-blue-400 bg-gradient-to-br from-blue-500/20 to-blue-600/30 border border-blue-400/20';
      case 'WORKSPACE': return 'text-purple-400 bg-gradient-to-br from-purple-500/20 to-purple-600/30 border border-purple-400/20';
      case 'SUBGRAPH': return 'text-emerald-400 bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-400/20';
      case 'TEMPLATE': return 'text-amber-400 bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-400/20';
      default: return 'text-slate-400 bg-gradient-to-br from-slate-500/20 to-slate-600/30 border border-slate-400/20';
    }
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'OWNER': return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'ADMIN': return <Edit3 className="h-3 w-3 text-purple-500" />;
      case 'EDIT': return <Edit3 className="h-3 w-3 text-blue-500" />;
      case 'VIEW': return <Eye className="h-3 w-3 text-gray-500" />;
      default: return null;
    }
  };

  // Organize graphs into folder structure
  const organizeGraphsIntoFolders = () => {
    const folders = {
      team: [] as any[],
      personal: [] as any[],
      system: [] as any[],
      ai: [] as any[],
      templates: [] as any[]
    };

    graphHierarchy.forEach(graph => {
      // Determine folder based on graph properties
      // Priority: System > Template > Personal > Team
      if (graph.type === 'TEMPLATE') {
        folders.templates.push(graph);
      } else if (graph.name.toLowerCase().includes('system') || graph.name.toLowerCase().includes('welcome') || graph.name.toLowerCase().includes('auto')) {
        folders.system.push(graph);
      } else if (graph.permissions === 'OWNER' && !graph.isShared) {
        folders.personal.push(graph);
      } else if (graph.isShared) {
        folders.team.push(graph);
      } else if (graph.name.toLowerCase().includes('ai') || graph.name.toLowerCase().includes('bot')) {
        folders.ai.push(graph);
      } else {
        folders.personal.push(graph);
      }
    });

    return folders;
  };

  const folders = organizeGraphsIntoFolders();

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getFolderIcon = (folderId: string) => {
    const isExpanded = expandedFolders.has(folderId);
    switch (folderId) {
      case 'team': return <Users className={`h-4 w-4 ${isExpanded ? 'text-blue-400' : 'text-gray-400'}`} />;
      case 'personal': return <User className={`h-4 w-4 ${isExpanded ? 'text-green-400' : 'text-gray-400'}`} />;
      case 'system': return <Settings className={`h-4 w-4 ${isExpanded ? 'text-orange-400' : 'text-gray-400'}`} />;
      case 'ai': return <Bot className={`h-4 w-4 ${isExpanded ? 'text-purple-400' : 'text-gray-400'}`} />;
      case 'templates': return <FileText className={`h-4 w-4 ${isExpanded ? 'text-amber-400' : 'text-gray-400'}`} />;
      default: return <Folder className={`h-4 w-4 ${isExpanded ? 'text-gray-300' : 'text-gray-400'}`} />;
    }
  };

  const getFolderName = (folderId: string) => {
    switch (folderId) {
      case 'team': return `Team (${currentTeam?.name || 'Shared'})`;
      case 'personal': return 'Personal';
      case 'system': return 'System';
      case 'ai': return 'AI Generated';
      case 'templates': return 'Templates';
      default: return folderId;
    }
  };

  // Show no graphs available if we have no available graphs at all
  if (graphHierarchy.length === 0 || !currentGraph) {
    return (
      <div className="p-3">
        <div className="text-center text-gray-400">
          <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No graphs available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Graph selector button - Premium enhanced */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="relative flex items-center space-x-3 w-full p-3.5 text-left hover:bg-gray-700/60 rounded-2xl transition-all duration-300 hover:scale-[1.02] border border-gray-600/30 hover:border-teal-500/40 shadow-xl hover:shadow-2xl hover:shadow-teal-500/10 backdrop-blur-sm bg-gradient-to-br from-gray-800/80 to-gray-900/70 group overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/0 via-teal-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getGraphTypeColor(currentGraph.type)} shadow-lg group-hover:scale-110 transition-transform duration-200`}>
            {getGraphTypeIcon(currentGraph.type)}
          </div>
        </div>

        <div className="relative flex-1 min-w-0">
          <div className="text-sm font-bold text-teal-300 group-hover:text-teal-200 truncate transition-colors">
            {currentGraph.name}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            <div className="flex items-center space-x-1 px-2 py-0.5 bg-gray-700/50 rounded-md border border-gray-600/30">
              <span className="font-semibold text-teal-400">{actualNodeCount}</span>
              <span>node{actualNodeCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center space-x-1 px-2 py-0.5 bg-gray-700/50 rounded-md border border-gray-600/30">
              <span className="font-semibold text-cyan-400">{actualEdgeCount}</span>
              <span>edge{actualEdgeCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <ChevronDown className={`relative h-5 w-5 text-gray-400 group-hover:text-teal-400 transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu with folder structure - Portal based for proper z-index */}
      {isOpen && buttonPosition && createPortal(
        <div
          className="bg-gradient-to-br from-gray-800/98 via-gray-850/98 to-gray-900/98 backdrop-blur-2xl border border-gray-600/30 rounded-3xl shadow-2xl overflow-hidden min-w-80 animate-in slide-in-from-top-2 fade-in duration-200"
          style={{
            position: 'fixed',
            top: buttonPosition.top + 8,
            left: buttonPosition.left,
            width: Math.max(buttonPosition.width, 320),
            zIndex: '999999999',
            pointerEvents: 'all',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
          }}
        >
          {/* Premium gradient top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500"></div>

          {/* Header with Create Button */}
          <div className="relative flex items-center justify-between p-5 border-b border-gray-600/30 bg-gradient-to-br from-teal-500/10 via-cyan-500/10 to-teal-500/5 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-cyan-500/5"></div>
            <div className="relative flex items-center space-x-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-teal-400/20 shadow-lg">
                <Settings className="h-4 w-4 text-teal-400" />
              </div>
              <span className="text-base font-bold bg-gradient-to-r from-teal-300 via-cyan-300 to-teal-300 bg-clip-text text-transparent tracking-wide">Graph Controller</span>
            </div>
            <div className="relative flex items-center gap-1.5">
              {onCreateGraph && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateGraph();
                    setIsOpen(false);
                  }}
                  className="p-2 text-teal-400 hover:text-teal-300 hover:bg-teal-500/20 rounded-xl transition-all duration-200 hover:scale-110 border border-transparent hover:border-teal-500/30 shadow-lg hover:shadow-teal-500/20"
                  title="Create New Graph"
                >
                  <FolderPlus className="h-4.5 w-4.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-xl transition-all duration-200 hover:scale-110 border border-transparent hover:border-red-500/30"
                title="Close"
              >
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>

          {/* Folder Structure */}
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
            <div className="p-3 space-y-2">
              {Object.entries(folders).map(([folderId, graphs]) => {
                if (graphs.length === 0) return null;

                const isExpanded = expandedFolders.has(folderId);

                return (
                  <div key={folderId} className="mb-1.5">
                    {/* Folder Header */}
                    <button
                      onClick={() => toggleFolder(folderId)}
                      className="w-full flex items-center space-x-3 px-3 py-3 rounded-xl hover:bg-gray-700/50 transition-all duration-200 text-left group border border-gray-700/30 hover:border-gray-600/50 backdrop-blur-sm shadow-sm hover:shadow-lg hover:scale-[1.02]"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        isExpanded
                          ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-400/30'
                          : 'bg-gray-700/40 border border-gray-600/30'
                      }`}>
                        {getFolderIcon(folderId)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-semibold transition-colors ${
                            isExpanded ? 'text-white' : 'text-gray-300 group-hover:text-white'
                          }`}>{getFolderName(folderId)}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full transition-all ${
                            isExpanded
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30'
                              : 'bg-gray-700/60 text-gray-400 border border-gray-600/30'
                          }`}>{graphs.length}</span>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-all duration-200 ${
                        isExpanded ? 'rotate-90 text-teal-400' : 'text-gray-500 group-hover:text-gray-400'
                      }`} />
                    </button>

                    {/* Folder Contents */}
                    {isExpanded && (
                      <div className="ml-5 mt-2 space-y-1.5 animate-in slide-in-from-left-2 fade-in duration-200">
                        {graphs.map((graph, index) => (
                          <div
                            key={graph.id}
                            className="flex items-center group/item"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <button
                              onClick={() => handleGraphSelect(graph.id)}
                              className={`flex-1 flex items-center space-x-3 p-3 rounded-xl text-left transition-all duration-200 ${
                                graph.id === currentGraph?.id
                                  ? 'bg-gradient-to-r from-teal-500/20 via-cyan-500/15 to-teal-500/20 border-2 border-teal-400/50 shadow-xl shadow-teal-500/10'
                                  : 'hover:bg-gray-700/40 text-gray-300 border border-gray-700/30 hover:border-gray-600/50 hover:shadow-lg hover:scale-[1.02]'
                              }`}
                            >
                              <div className="flex-shrink-0 relative">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${getGraphTypeColor(graph.type)} shadow-lg transition-transform group-hover/item:scale-110 duration-200`}>
                                  {getGraphTypeIcon(graph.type)}
                                </div>
                                {graph.id === currentGraph?.id && (
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full animate-pulse shadow-lg shadow-teal-400/50 border-2 border-gray-800"></div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-semibold truncate mb-0.5 ${
                                  graph.id === currentGraph?.id ? 'text-teal-200' : 'text-gray-200 group-hover/item:text-white'
                                }`}>{graph.name}</div>
                                <div className="flex items-center space-x-2 text-[11px]">
                                  <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md ${
                                    graph.id === currentGraph?.id
                                      ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30'
                                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                                  }`}>
                                    <span className="font-semibold">{graph.id === currentGraph?.id ? actualNodeCount : (graph.nodeCount || 0)}</span>
                                    <span className="font-normal">nodes</span>
                                  </div>
                                  <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md ${
                                    graph.id === currentGraph?.id
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                                  }`}>
                                    <span className="font-semibold">{graph.id === currentGraph?.id ? actualEdgeCount : (graph.edgeCount || 0)}</span>
                                    <span className="font-normal">edges</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                            
                            {/* Per-Graph Actions */}
                            <div className="flex items-center space-x-1 opacity-0 group-hover/item:opacity-100 transition-all duration-300 ml-2 animate-in fade-in slide-in-from-right-2">
                              {onEditGraph && (() => {
                                const isSystemGraph = graph.createdBy === 'system' ||
                                                    graph.id === 'welcome-graph-shared' ||
                                                    graph.name?.toLowerCase() === 'welcome';
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isSystemGraph) {
                                        onEditGraph(graph);
                                        setIsOpen(false);
                                      }
                                    }}
                                    onMouseEnter={(e) => {
                                      if (isSystemGraph) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredTooltip({
                                          message: '🔒 System graph - Cannot edit',
                                          x: rect.right + 8,
                                          y: rect.top + rect.height / 2
                                        });
                                      }
                                    }}
                                    onMouseLeave={() => setHoveredTooltip(null)}
                                    disabled={isSystemGraph}
                                    className={`group/btn relative p-1.5 rounded-lg transition-all duration-300 text-teal-400 bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/30 shadow-lg ${
                                      isSystemGraph
                                        ? 'cursor-not-allowed opacity-50'
                                        : 'hover:text-white hover:from-teal-500/30 hover:to-cyan-500/30 hover:border-teal-400/60 hover:shadow-xl hover:shadow-teal-500/30 hover:scale-110 active:scale-95'
                                    }`}
                                    title={isSystemGraph ? 'System graph cannot be edited' : 'Edit graph'}
                                  >
                                    <div className={`absolute inset-0 rounded-lg bg-gradient-to-br from-teal-400/0 to-cyan-400/0 ${!isSystemGraph && 'group-hover/btn:from-teal-400/20 group-hover/btn:to-cyan-400/20'} transition-all duration-300`}></div>
                                    <Edit3 className={`h-3 w-3 relative z-10 ${!isSystemGraph && 'group-hover/btn:rotate-12'} transition-transform duration-300`} />
                                  </button>
                                );
                              })()}
                              {onDeleteGraph && (() => {
                                const isSystemGraph = graph.createdBy === 'system' ||
                                                    graph.id === 'welcome-graph-shared' ||
                                                    graph.name?.toLowerCase() === 'welcome';
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isSystemGraph) {
                                        onDeleteGraph(graph);
                                        setIsOpen(false);
                                      }
                                    }}
                                    onMouseEnter={(e) => {
                                      if (isSystemGraph) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredTooltip({
                                          message: '🔒 System graph - Cannot delete',
                                          x: rect.right + 8,
                                          y: rect.top + rect.height / 2
                                        });
                                      }
                                    }}
                                    onMouseLeave={() => setHoveredTooltip(null)}
                                    disabled={isSystemGraph}
                                    className={`group/btn relative p-1.5 rounded-lg transition-all duration-300 text-red-400 bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/30 shadow-lg ${
                                      isSystemGraph
                                        ? 'cursor-not-allowed opacity-50'
                                        : 'hover:text-white hover:from-red-500/30 hover:to-rose-500/30 hover:border-red-400/60 hover:shadow-xl hover:shadow-red-500/30 hover:scale-110 active:scale-95'
                                    }`}
                                    title={isSystemGraph ? 'System graph cannot be deleted' : 'Delete graph'}
                                  >
                                    <div className={`absolute inset-0 rounded-lg bg-gradient-to-br from-red-400/0 to-rose-400/0 ${!isSystemGraph && 'group-hover/btn:from-red-400/20 group-hover/btn:to-rose-400/20'} transition-all duration-300`}></div>
                                    <Trash2 className={`h-3 w-3 relative z-10 ${!isSystemGraph && 'group-hover/btn:scale-110 group-hover/btn:rotate-6'} transition-all duration-300`} />
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {graphHierarchy.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <FolderPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-3">No graphs found</p>
                  {onCreateGraph && (
                    <button
                      onClick={() => {
                        onCreateGraph();
                        setIsOpen(false);
                      }}
                      className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg text-sm transition-colors"
                    >
                      Create First Graph
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          {graphHierarchy.length > 0 && (
            <div className="relative border-t border-gray-600/40 p-4 bg-gradient-to-br from-gray-800/60 via-gray-850/50 to-gray-900/60 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-cyan-500/5"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse shadow-lg shadow-teal-400/50"></div>
                  <span className="text-xs font-semibold text-gray-300">
                    <span className="text-teal-400">{graphHierarchy.length}</span> Graph{graphHierarchy.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="px-2 py-1 bg-gray-700/50 rounded-lg border border-gray-600/30">
                    <span className="text-[10px] font-medium text-gray-400">Team</span>
                  </div>
                  <div className="px-2 py-1 bg-gray-700/50 rounded-lg border border-gray-600/30">
                    <span className="text-[10px] font-medium text-gray-400">Personal</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Tooltip Portal */}
      {hoveredTooltip && createPortal(
        <div
          className="fixed px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white text-[10px] font-semibold rounded-lg whitespace-nowrap pointer-events-none z-[9999999999] -translate-y-1/2 shadow-2xl shadow-red-500/30 border border-red-500/30 backdrop-blur-sm animate-in fade-in slide-in-from-left-1 duration-150"
          style={{
            left: hoveredTooltip.x,
            top: hoveredTooltip.y
          }}
        >
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rotate-45 border-l border-b border-red-500/30"></div>
          {hoveredTooltip.message}
        </div>,
        document.body
      )}
    </div>
  );
}