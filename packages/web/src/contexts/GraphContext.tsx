import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Graph, GraphHierarchy, CreateGraphInput, GraphContextType, GraphPermissions, ShareSettings } from '../types/graph';

const GraphContext = createContext<GraphContextType | undefined>(undefined);

// Mock graphs for demonstration
const createMockGraphs = (teamId: string): Graph[] => [
  {
    id: 'graph-1',
    name: 'Product Roadmap 2024',
    description: 'Main product development roadmap and feature planning',
    type: 'PROJECT',
    status: 'ACTIVE',
    teamId,
    createdBy: 'user-1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-03-20T15:30:00Z',
    depth: 0,
    path: [],
    permissions: {
      owner: 'user-1',
      admins: ['user-1'],
      editors: ['user-2', 'user-3'],
      viewers: ['user-4'],
      teamPermission: 'VIEW'
    },
    isShared: true,
    shareSettings: {
      isPublic: false,
      allowTeamAccess: true,
      allowCopying: true,
      allowForking: false
    },
    nodeCount: 45,
    edgeCount: 67,
    contributorCount: 8,
    lastActivity: '2024-03-20T15:30:00Z',
    settings: {
      theme: 'light',
      layout: 'force',
      showPriorities: true,
      showDependencies: true,
      autoLayout: true,
      zoomLevel: 1.0
    }
  },
  {
    id: 'graph-2',
    name: 'Authentication System',
    description: 'User authentication and authorization subsystem',
    type: 'SUBGRAPH',
    status: 'ACTIVE',
    parentGraphId: 'graph-1',
    teamId,
    createdBy: 'user-2',
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-03-18T11:20:00Z',
    depth: 1,
    path: ['graph-1'],
    permissions: {
      owner: 'user-2',
      admins: ['user-2'],
      editors: ['user-1', 'user-3'],
      viewers: [],
      teamPermission: 'EDIT'
    },
    isShared: false,
    shareSettings: {
      isPublic: false,
      allowTeamAccess: true,
      allowCopying: false,
      allowForking: false
    },
    nodeCount: 12,
    edgeCount: 18,
    contributorCount: 3,
    lastActivity: '2024-03-18T11:20:00Z',
    settings: {
      theme: 'light',
      layout: 'hierarchical',
      showPriorities: true,
      showDependencies: true,
      autoLayout: false,
      zoomLevel: 1.2
    }
  },
  {
    id: 'graph-3',
    name: 'UI Components Library',
    description: 'Reusable UI components and design system',
    type: 'SUBGRAPH',
    status: 'ACTIVE',
    parentGraphId: 'graph-1',
    teamId,
    createdBy: 'user-3',
    createdAt: '2024-02-10T14:00:00Z',
    updatedAt: '2024-03-19T16:45:00Z',
    depth: 1,
    path: ['graph-1'],
    permissions: {
      owner: 'user-3',
      admins: ['user-3'],
      editors: ['user-1', 'user-2'],
      viewers: ['user-4'],
      teamPermission: 'VIEW'
    },
    isShared: true,
    shareSettings: {
      isPublic: true,
      allowTeamAccess: true,
      allowCopying: true,
      allowForking: true,
      shareLink: 'https://graphdone.com/share/ui-components-abc123'
    },
    nodeCount: 28,
    edgeCount: 34,
    contributorCount: 5,
    lastActivity: '2024-03-19T16:45:00Z',
    settings: {
      theme: 'light',
      layout: 'grid',
      showPriorities: false,
      showDependencies: true,
      autoLayout: true,
      zoomLevel: 0.8
    }
  },
  {
    id: 'graph-4',
    name: 'Research Ideas',
    description: 'Experimental features and research initiatives',
    type: 'WORKSPACE',
    status: 'ACTIVE',
    teamId,
    createdBy: 'user-1',
    createdAt: '2024-01-20T11:00:00Z',
    updatedAt: '2024-03-15T13:10:00Z',
    depth: 0,
    path: [],
    permissions: {
      owner: 'user-1',
      admins: ['user-1', 'user-5'],
      editors: ['user-2'],
      viewers: [],
      teamPermission: 'NONE'
    },
    isShared: false,
    shareSettings: {
      isPublic: false,
      allowTeamAccess: false,
      allowCopying: false,
      allowForking: false
    },
    nodeCount: 23,
    edgeCount: 15,
    contributorCount: 3,
    lastActivity: '2024-03-15T13:10:00Z',
    settings: {
      theme: 'dark',
      layout: 'force',
      showPriorities: true,
      showDependencies: false,
      autoLayout: true,
      zoomLevel: 1.1
    }
  },
  {
    id: 'graph-5',
    name: 'Login Components',
    description: 'Login, signup, and password reset components',
    type: 'SUBGRAPH',
    status: 'ACTIVE',
    parentGraphId: 'graph-2',
    teamId,
    createdBy: 'user-2',
    createdAt: '2024-02-15T10:30:00Z',
    updatedAt: '2024-03-17T09:15:00Z',
    depth: 2,
    path: ['graph-1', 'graph-2'],
    permissions: {
      owner: 'user-2',
      admins: ['user-2'],
      editors: ['user-1'],
      viewers: ['user-3'],
      teamPermission: 'VIEW'
    },
    isShared: false,
    shareSettings: {
      isPublic: false,
      allowTeamAccess: true,
      allowCopying: false,
      allowForking: false
    },
    nodeCount: 8,
    edgeCount: 12,
    contributorCount: 2,
    lastActivity: '2024-03-17T09:15:00Z',
    settings: {
      theme: 'light',
      layout: 'hierarchical',
      showPriorities: true,
      showDependencies: true,
      autoLayout: true,
      zoomLevel: 1.0
    }
  }
];

interface GraphProviderProps {
  children: ReactNode;
}

export function GraphProvider({ children }: GraphProviderProps) {
  const { currentUser, currentTeam } = useAuth();
  const [currentGraph, setCurrentGraph] = useState<Graph | null>(null);
  const [availableGraphs, setAvailableGraphs] = useState<Graph[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Load graphs when user or team changes
  useEffect(() => {
    if (currentTeam) {
      const teamGraphs = createMockGraphs(currentTeam.id);
      setAvailableGraphs(teamGraphs);
      
      // Auto-select first graph if none selected
      if (!currentGraph && teamGraphs.length > 0) {
        setCurrentGraph(teamGraphs[0]);
      }
    } else {
      setAvailableGraphs([]);
      setCurrentGraph(null);
    }
  }, [currentTeam]);

  // Build graph hierarchy
  const graphHierarchy: GraphHierarchy[] = availableGraphs
    .filter(graph => graph.depth === 0)
    .map(graph => buildHierarchy(graph, availableGraphs));

  const selectGraph = async (graphId: string): Promise<void> => {
    setIsLoading(true);
    try {
      const graph = availableGraphs.find(g => g.id === graphId);
      if (graph) {
        setCurrentGraph(graph);
        localStorage.setItem('currentGraphId', graphId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createGraph = async (input: CreateGraphInput): Promise<Graph> => {
    setIsCreating(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newGraph: Graph = {
        id: `graph-${Date.now()}`,
        name: input.name,
        description: input.description,
        type: input.type,
        status: 'DRAFT',
        parentGraphId: input.parentGraphId,
        teamId: input.teamId,
        createdBy: currentUser!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        depth: input.parentGraphId ? getGraphDepth(input.parentGraphId) + 1 : 0,
        path: input.parentGraphId ? [...getGraphPathIds(input.parentGraphId), input.parentGraphId] : [],
        permissions: {
          owner: currentUser!.id,
          admins: [currentUser!.id],
          editors: [],
          viewers: [],
          teamPermission: 'VIEW'
        },
        isShared: false,
        shareSettings: {
          isPublic: false,
          allowTeamAccess: true,
          allowCopying: false,
          allowForking: false
        },
        nodeCount: 0,
        edgeCount: 0,
        contributorCount: 1,
        lastActivity: new Date().toISOString(),
        settings: {
          theme: 'light',
          layout: 'force',
          showPriorities: true,
          showDependencies: true,
          autoLayout: true,
          zoomLevel: 1.0
        }
      };

      setAvailableGraphs(prev => [...prev, newGraph]);
      setCurrentGraph(newGraph);
      return newGraph;
    } finally {
      setIsCreating(false);
    }
  };

  const updateGraph = async (graphId: string, updates: Partial<Graph>): Promise<Graph> => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph) throw new Error('Graph not found');

    const updatedGraph = {
      ...graph,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    setAvailableGraphs(prev => prev.map(g => g.id === graphId ? updatedGraph : g));
    if (currentGraph?.id === graphId) {
      setCurrentGraph(updatedGraph);
    }

    return updatedGraph;
  };

  const deleteGraph = async (graphId: string): Promise<void> => {
    setAvailableGraphs(prev => prev.filter(g => g.id !== graphId));
    if (currentGraph?.id === graphId) {
      const remaining = availableGraphs.filter(g => g.id !== graphId);
      setCurrentGraph(remaining.length > 0 ? remaining[0] : null);
    }
  };

  const duplicateGraph = async (graphId: string, name: string): Promise<Graph> => {
    const originalGraph = availableGraphs.find(g => g.id === graphId);
    if (!originalGraph) throw new Error('Graph not found');

    return createGraph({
      name,
      description: `Copy of ${originalGraph.name}`,
      type: originalGraph.type,
      parentGraphId: originalGraph.parentGraphId,
      teamId: originalGraph.teamId,
      copyFromGraphId: graphId
    });
  };

  const moveGraph = async (graphId: string, newParentId?: string): Promise<void> => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph) throw new Error('Graph not found');

    const newDepth = newParentId ? getGraphDepth(newParentId) + 1 : 0;
    const newPath = newParentId ? [...getGraphPathIds(newParentId), newParentId] : [];

    await updateGraph(graphId, {
      parentGraphId: newParentId,
      depth: newDepth,
      path: newPath
    });
  };

  const shareGraph = async (graphId: string, settings: Partial<ShareSettings>): Promise<void> => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph) throw new Error('Graph not found');

    await updateGraph(graphId, {
      isShared: true,
      shareSettings: { ...graph.shareSettings, ...settings }
    });
  };

  const updatePermissions = async (graphId: string, permissions: Partial<GraphPermissions>): Promise<void> => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph) throw new Error('Graph not found');

    await updateGraph(graphId, {
      permissions: { ...graph.permissions, ...permissions }
    });
  };

  const joinSharedGraph = async (_shareLink: string): Promise<Graph> => {
    // Simulate API call to join shared graph
    throw new Error('Not implemented in demo');
  };

  const getGraphPathIds = (graphId: string): string[] => {
    const graph = availableGraphs.find(g => g.id === graphId);
    return graph?.path || [];
  };

  const getGraphPath = (graphId: string): Graph[] => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph?.path) return [];
    
    return graph.path.map(pathId => availableGraphs.find(g => g.id === pathId)).filter(Boolean) as Graph[];
  };

  const getGraphDepth = (graphId: string): number => {
    const graph = availableGraphs.find(g => g.id === graphId);
    return graph?.depth || 0;
  };

  const getGraphChildren = (graphId: string): Graph[] => {
    return availableGraphs.filter(g => g.parentGraphId === graphId);
  };

  const canEditGraph = (graphId: string): boolean => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph || !currentUser) return false;

    return (
      graph.permissions.owner === currentUser.id ||
      graph.permissions.admins.includes(currentUser.id) ||
      graph.permissions.editors.includes(currentUser.id) ||
      (graph.permissions.teamPermission === 'EDIT' && graph.teamId === currentTeam?.id)
    );
  };

  const canDeleteGraph = (graphId: string): boolean => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph || !currentUser) return false;

    return (
      graph.permissions.owner === currentUser.id ||
      graph.permissions.admins.includes(currentUser.id)
    );
  };

  const canShareGraph = (graphId: string): boolean => {
    return canEditGraph(graphId);
  };

  const refreshGraphs = async (): Promise<void> => {
    if (currentTeam) {
      const teamGraphs = createMockGraphs(currentTeam.id);
      setAvailableGraphs(teamGraphs);
    }
  };

  const value: GraphContextType = {
    currentGraph,
    availableGraphs,
    graphHierarchy,
    isLoading,
    isCreating,
    selectGraph,
    createGraph,
    updateGraph,
    deleteGraph,
    duplicateGraph,
    moveGraph,
    getGraphPath,
    getGraphChildren,
    shareGraph,
    updatePermissions,
    joinSharedGraph,
    canEditGraph,
    canDeleteGraph,
    canShareGraph,
    refreshGraphs
  };

  return (
    <GraphContext.Provider value={value}>
      {children}
    </GraphContext.Provider>
  );
}

function buildHierarchy(graph: Graph, allGraphs: Graph[]): GraphHierarchy {
  const children = allGraphs
    .filter(g => g.parentGraphId === graph.id)
    .map(child => buildHierarchy(child, allGraphs));

  return {
    id: graph.id,
    name: graph.name,
    type: graph.type,
    children,
    nodeCount: graph.nodeCount,
    isShared: graph.isShared,
    permissions: getPermissionLevel(graph)
  };
}

function getPermissionLevel(_graph: Graph): 'OWNER' | 'ADMIN' | 'EDIT' | 'VIEW' {
  // This would normally check against current user
  // For demo purposes, returning mock values
  return 'EDIT';
}

export function useGraph() {
  const context = useContext(GraphContext);
  if (context === undefined) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  return context;
}