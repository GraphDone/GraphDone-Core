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
      {/* Graph selector button (EXACT same pattern as UserSelector) */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center space-x-3 w-full p-3 text-left hover:bg-gray-700/80 rounded-xl transition-all duration-200 hover:scale-[1.02] border border-gray-600/30 hover:border-gray-500/50 shadow-lg hover:shadow-xl backdrop-blur-sm bg-gray-800/50"
      >
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getGraphTypeColor(currentGraph.type)}`}>
            {getGraphTypeIcon(currentGraph.type)}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-green-300 truncate">
            {currentGraph.name}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{actualNodeCount} node{actualNodeCount !== 1 ? 's' : ''}, {actualEdgeCount} connection{actualEdgeCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu with folder structure - Portal based for proper z-index */}
      {isOpen && buttonPosition && createPortal(
        <div
          className="bg-gradient-to-br from-gray-800/98 to-gray-900/98 backdrop-blur-xl border-2 border-gray-600/50 rounded-2xl shadow-2xl max-h-96 overflow-hidden min-w-80"
          style={{
            position: 'fixed',
            top: buttonPosition.top + 8,
            left: buttonPosition.left,
            width: Math.max(buttonPosition.width, 320),
            zIndex: '999999999',
            pointerEvents: 'all'
          }}
        >
          {/* Header with Create Button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-600/60 bg-gradient-to-r from-emerald-500/10 to-green-500/10 backdrop-blur-sm">
            <span className="text-base font-semibold bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">Graph Controller</span>
            <div className="flex items-center gap-2">
              {onCreateGraph && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateGraph();
                    setIsOpen(false);
                  }}
                  className="p-1.5 text-gray-400 hover:text-green-300 hover:bg-gray-700/50 rounded transition-all duration-200"
                  title="Create New Graph"
                >
                  <FolderPlus className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded transition-all duration-200"
                title="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>

          {/* Folder Structure */}
          <div className="max-h-80 overflow-y-auto">
            <div className="p-2.5 space-y-1">
              {Object.entries(folders).map(([folderId, graphs]) => {
                if (graphs.length === 0) return null;

                const isExpanded = expandedFolders.has(folderId);

                return (
                  <div key={folderId} className="mb-1">
                    {/* Folder Header */}
                    <button
                      onClick={() => toggleFolder(folderId)}
                      className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-gray-700/60 transition-all duration-200 text-left group border border-transparent hover:border-gray-600/40"
                    >
                      <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                      {getFolderIcon(folderId)}
                      <span className="text-sm font-medium text-gray-200 group-hover:text-white flex-1">{getFolderName(folderId)}</span>
                      <span className="text-xs font-normal text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full">{graphs.length}</span>
                    </button>

                    {/* Folder Contents */}
                    {isExpanded && (
                      <div className="ml-5 mt-1 space-y-1">
                        {graphs.map((graph) => (
                          <div key={graph.id} className="flex items-center group/item">
                            <button
                              onClick={() => handleGraphSelect(graph.id)}
                              className={`flex-1 flex items-center space-x-2.5 p-2.5 rounded-xl text-left transition-all duration-200 ${
                                graph.id === currentGraph?.id
                                  ? 'bg-gradient-to-r from-emerald-500/25 to-green-500/25 text-emerald-200 border-2 border-emerald-400/40 shadow-lg'
                                  : 'hover:bg-gray-700/50 text-gray-300 border border-transparent hover:border-gray-600/30'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${getGraphTypeColor(graph.type)} shadow-sm`}>
                                  {getGraphTypeIcon(graph.type)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{graph.name}</div>
                                <div className="text-xs text-gray-400 flex items-center space-x-1.5">
                                  <span className="flex items-center">
                                    <span className="font-normal">{graph.id === currentGraph?.id ? actualNodeCount : (graph.nodeCount || 0)}</span>
                                    <span className="ml-0.5">nodes</span>
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center">
                                    <span className="font-normal">{graph.id === currentGraph?.id ? actualEdgeCount : (graph.edgeCount || 0)}</span>
                                    <span className="ml-0.5">edges</span>
                                  </span>
                                </div>
                              </div>
                              {graph.id === currentGraph?.id && (
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                              )}
                            </button>
                            
                            {/* Per-Graph Actions */}
                            <div className="flex items-center space-x-1 opacity-0 group-hover/item:opacity-100 transition-opacity ml-2">
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
                                          message: '🔒 System graph - Cannot editable',
                                          x: rect.right + 8,
                                          y: rect.top + rect.height / 2
                                        });
                                      }
                                    }}
                                    onMouseLeave={() => setHoveredTooltip(null)}
                                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                                      isSystemGraph
                                        ? 'text-gray-600 cursor-not-allowed'
                                        : 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 hover:scale-110'
                                    }`}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
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
                                          message: '🔒 System graph - Cannot deletable',
                                          x: rect.right + 8,
                                          y: rect.top + rect.height / 2
                                        });
                                      }
                                    }}
                                    onMouseLeave={() => setHoveredTooltip(null)}
                                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                                      isSystemGraph
                                        ? 'text-gray-600 cursor-not-allowed'
                                        : 'text-gray-400 hover:text-red-400 hover:bg-red-500/20 hover:scale-110'
                                    }`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
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
            <div className="border-t border-gray-600 p-3 bg-gray-700/50">
              <div className="flex items-center justify-between text-xs font-normal text-gray-400">
                <span>Total: {graphHierarchy.length} Graph{graphHierarchy.length !== 1 ? 's' : ''}</span>
                <span>Organized by: Team, Personal</span>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Tooltip Portal */}
      {hoveredTooltip && createPortal(
        <div
          className="fixed px-2 py-1 bg-red-600 text-white text-[10px] rounded whitespace-nowrap pointer-events-none z-[9999999999] -translate-y-1/2"
          style={{
            left: hoveredTooltip.x,
            top: hoveredTooltip.y
          }}
        >
          {hoveredTooltip.message}
        </div>,
        document.body
      )}
    </div>
  );
}