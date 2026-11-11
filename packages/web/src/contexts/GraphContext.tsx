import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useAuth } from './AuthContext';
import { Graph, GraphHierarchy, CreateGraphInput, GraphContextType, GraphPermissions, ShareSettings } from '../types/graph';
import {
  GET_GRAPHS,
  GET_GRAPHS_BY_USER,
  CREATE_GRAPH,
  CREATE_STARTER_GRAPHS,
  UPDATE_GRAPH,
  DELETE_GRAPH
} from '../graphql/graph';
import { GET_WORK_ITEMS, GET_EDGES, DELETE_WORK_ITEM, CREATE_WORK_ITEM, CREATE_EDGE } from '../lib/queries';
import { buildStarterWorkspace, createStarterWorkspace, starterGraphCount, type StarterApi } from '../lib/starterWorkspace';
import { offlineEnabled, localGuest } from '../lib/offline/engine';
import { OFFLINE_PROJECT_LIMIT } from '../lib/offline/model';
import { exampleLimitMessage, projectDeleteBlock, seenGraphCount, starterHierarchy, starterStep } from '../lib/workspaceRules';

const GraphContext = createContext<GraphContextType | undefined>(undefined);

// Using only real GraphQL data from Neo4j database

const hierarchyHere = () => starterHierarchy({ offline: offlineEnabled, guest: localGuest() });
// Kept only while a new user's starter is being written, so the next page
// load in this browser can finish it. A server write sent just before a reload
// can still land afterwards, so a resume first waits STARTER_SETTLE_MS from
// the last write sent; browser-local writes need no wait.
const STARTER_SETTLE_MS = 15000;
type StarterPending = { hierarchy: boolean; sentAt: number };
const starterPendingKey = (userId: string) => `graphdone:starter-pending:${userId}`;
const readStarterPending = (userId: string): StarterPending | null => {
  try {
    const value = JSON.parse(localStorage.getItem(starterPendingKey(userId)) || 'null');
    return value && typeof value.hierarchy === 'boolean' && typeof value.sentAt === 'number' ? value : null;
  } catch {
    return null;
  }
};
const markStarterSent = (userId: string, hierarchy: boolean) =>
  localStorage.setItem(starterPendingKey(userId), JSON.stringify({ hierarchy, sentAt: Date.now() }));
const STARTER_PROJECTS = new Set(buildStarterWorkspace({ hierarchy: true }).projects.map(project => project.name));
const isEmptyStarterProject = (graph: Graph) =>
  graph.type === 'PROJECT' && !graph.parentGraphId && STARTER_PROJECTS.has(graph.name);

function parseGraph(g: any): Graph {
  return {
    ...g,
    settings: g.settings ? JSON.parse(g.settings) : {
      theme: 'light',
      layout: 'force',
      showPriorities: true,
      showDependencies: true,
      autoLayout: true,
      zoomLevel: 1.0
    },
    permissions: g.permissions ? JSON.parse(g.permissions) : {
      owner: g.createdBy || 'unknown',
      admins: g.createdBy ? [g.createdBy] : [],
      editors: [],
      viewers: [],
      teamPermission: 'VIEW'
    },
    shareSettings: g.shareSettings ? JSON.parse(g.shareSettings) : {
      isPublic: false,
      allowTeamAccess: true,
      allowCopying: false,
      allowForking: false
    },
  };
}

interface GraphProviderProps {
  children: ReactNode;
}

export function GraphProvider({ children }: GraphProviderProps) {
  const { currentUser, currentTeam } = useAuth();
  const apolloClient = useApolloClient();
  const [currentGraph, setCurrentGraph] = useState<Graph | null>(null);
  const [availableGraphs, setAvailableGraphs] = useState<Graph[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingWelcomeGraphRef = useRef(false);
  const isAddingExampleRef = useRef(false);
  const currentUserIdRef = useRef<string | undefined>(currentUser?.id);
  currentUserIdRef.current = currentUser?.id;
  const currentGraphRef = useRef<Graph | null>(currentGraph);
  currentGraphRef.current = currentGraph;


  // GraphQL operations - Load graphs for current user only
  const { data: graphsData, loading: isLoading, error: graphsError, refetch: refetchGraphs } = useQuery(GET_GRAPHS_BY_USER, {
    variables: { userId: currentUser?.id || '' },
    skip: !currentUser, // Skip if no user logged in
  });
  

  const [createGraphMutation] = useMutation(CREATE_GRAPH);
  const [createStarterGraphsMutation] = useMutation(CREATE_STARTER_GRAPHS);
  const [updateGraphMutation] = useMutation(UPDATE_GRAPH);
  const [deleteGraphMutation] = useMutation(DELETE_GRAPH);
  const [deleteWorkItemMutation] = useMutation(DELETE_WORK_ITEM);
  const [createWorkItemMutation] = useMutation(CREATE_WORK_ITEM);
  const [createEdgeMutation] = useMutation(CREATE_EDGE);

  const starterApi = (userId: string, teamId: string): StarterApi => ({
    createGraphs: async inputs => {
      const { data } = await createStarterGraphsMutation({
        variables: {
          input: inputs.map(input => ({
            ...input,
            status: 'ACTIVE',
            teamId,
            createdBy: userId,
            defaultRole: 'USER',
            isShared: false,
            nodeCount: 0,
            edgeCount: 0,
            contributorCount: 1,
            lastActivity: new Date().toISOString(),
            permissions: JSON.stringify({
              owner: userId,
              admins: [userId],
              editors: [],
              viewers: [],
              teamPermission: 'VIEW'
            }),
            shareSettings: JSON.stringify({
              isPublic: false,
              allowTeamAccess: true,
              allowCopying: false,
              allowForking: false
            }),
            settings: JSON.stringify({
              theme: 'light',
              layout: 'force',
              showPriorities: true,
              showDependencies: true,
              autoLayout: true,
              zoomLevel: 1.0
            })
          }))
        }
      });
      return data?.createGraphs?.graphs || [];
    },
    createItems: async (graphId, items) => {
      const { data } = await createWorkItemMutation({
        variables: {
          input: items.map(item => ({
            title: item.title,
            description: item.description,
            type: item.type,
            status: item.status,
            priority: item.priority,
            positionX: item.x,
            positionY: item.y,
            positionZ: 0,
            radius: 1.0,
            theta: 0,
            phi: 0,
            priorityComp: item.priority,
            tags: item.tags,
            owner: { connect: { where: { node: { id: userId } } } },
            graph: { connect: { where: { node: { id: graphId } } } }
          }))
        }
      });
      return (data?.createWorkItems?.workItems || []).map((workItem: { id: string }) => workItem.id);
    },
    createEdges: async edges => {
      await createEdgeMutation({
        variables: {
          input: edges.map(edge => ({
            type: edge.type,
            source: { connect: { where: { node: { id: edge.sourceId } } } },
            target: { connect: { where: { node: { id: edge.targetId } } } }
          }))
        }
      });
    },
    setCounts: async (graphId, { nodeCount, edgeCount }) => {
      await updateGraphMutation({
        variables: { id: graphId, input: { nodeCount, edgeCount, lastActivity: new Date().toISOString() } }
      });
    },
    ownGraphs: async () => {
      const { data } = await refetchGraphs();
      return data?.userGraphs || [];
    },
    content: async graphId => {
      const [items, edges] = await Promise.all([
        apolloClient.query({ query: GET_WORK_ITEMS, variables: { where: { graph: { id: graphId } } }, fetchPolicy: 'network-only' }),
        apolloClient.query({ query: GET_EDGES, variables: { where: { source: { graph: { id: graphId } } } }, fetchPolicy: 'network-only' })
      ]);
      return {
        items: (items.data?.workItems || []).map((item: { id: string; title: string }) => ({ id: item.id, title: item.title })),
        edges: (edges.data?.edges || []).map((edge: { type: string; source?: { id: string }; target?: { id: string } }) => ({
          sourceId: edge.source?.id || '',
          targetId: edge.target?.id || '',
          type: edge.type
        }))
      };
    }
  });

  const writeStarter = async (userId: string, hierarchy: boolean, resume: boolean) => {
    const api = starterApi(userId, currentTeam?.id || 'team-1');
    const sent = <A extends unknown[], R>(write: (...args: A) => Promise<R>) => (...args: A) => {
      markStarterSent(userId, hierarchy);
      return write(...args);
    };
    markStarterSent(userId, hierarchy);
    const plan = buildStarterWorkspace({ hierarchy });
    await createStarterWorkspace(plan, {
      ...api,
      createGraphs: sent(api.createGraphs),
      createItems: sent(api.createItems),
      createEdges: sent(api.createEdges),
      opened: async graphId => {
        const { data } = await refetchGraphs();
        const current = currentGraphRef.current;
        const found = (data?.userGraphs || []).find((g: { id: string }) => g.id === graphId);
        if (found && (!resume || !current || isEmptyStarterProject(current))) {
          localStorage.setItem('currentGraphId', graphId);
          setCurrentGraph(parseGraph(found));
        }
        await apolloClient.refetchQueries({ include: ['GetWorkItems', 'GetEdges'] });
      }
    }, { resume });
    localStorage.removeItem(starterPendingKey(userId));
    console.log('✅ Starter workspace ready:', plan.projects.length, 'projects,', plan.graphs.length, 'graphs');
    // Refetch every open item/connection list (List view, header counts)
    // that already asked while a graph was still empty (#262).
    await refetchGraphs();
    await apolloClient.refetchQueries({ include: ['GetWorkItems', 'GetEdges'] });
  };

  const startStarter = async (userId: string) => {
    const run = async () => {
      const pending = readStarterPending(userId);
      const wait = pending && !offlineEnabled ? pending.sentAt + STARTER_SETTLE_MS - Date.now() : 0;
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, Math.min(wait, STARTER_SETTLE_MS)));
      if (currentUserIdRef.current !== userId) return;
      const { data } = await refetchGraphs();
      const still = readStarterPending(userId);
      const step = starterStep({ graphsSeen: seenGraphCount(data), pending: !!still });
      if (step === 'finish' && still) await writeStarter(userId, still.hierarchy, true);
      if (step === 'create') await writeStarter(userId, hierarchyHere(), false);
    };
    if (navigator.locks) await navigator.locks.request(`graphdone-starter:${userId}`, run);
    else await run();
  };

  // Subscriptions for real-time updates (commented out until properly implemented)
  // useSubscription(GRAPH_CREATED, {
  //   onData: ({ data }) => {
  //     if (data?.data?.graphCreated) {
  //       setAvailableGraphs(prev => [...prev, data.data.graphCreated]);
  //     }
  //   }
  // });

  // useSubscription(GRAPH_UPDATED, {
  //   onData: ({ data }) => {
  //     if (data?.data?.graphUpdated) {
  //       const updated = data.data.graphUpdated;
  //       setAvailableGraphs(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
  //       if (currentGraph?.id === updated.id) {
  //         setCurrentGraph(prev => prev ? { ...prev, ...updated } : null);
  //       }
  //     }
  //   }
  // });

  // useSubscription(GRAPH_DELETED, {
  //   onData: ({ data }) => {
  //     if (data?.data?.graphDeleted) {
  //       const deletedId = data.data.graphDeleted;
  //       setAvailableGraphs(prev => prev.filter(g => g.id !== deletedId));
  //       if (currentGraph?.id === deletedId) {
  //         setCurrentGraph(null);
  //       }
  //     }
  //   }
  // });

  // Load graphs from GraphQL response only
  useEffect(() => {
    // GUARD: Don't run if we don't have a logged-in user
    if (!currentUser) {
      console.log('⏸️  No current user - skipping graph loading');
      return;
    }

    // GUARD: Don't run while GraphQL query is loading
    if (isLoading) {
      console.log('⏸️  Still loading graphs - waiting...');
      return;
    }

    // A failed read is not an empty account. Keep the visible graph and never
    // auto-create a welcome project while cloud access is unavailable.
    if (graphsError) return;

    // Combine user graphs, shared graphs, and system graphs
    // Remove duplicates by graph ID (some graphs may appear in multiple categories)
    const graphsMap = new Map();

    [...(graphsData?.systemGraphs || []),
     ...(graphsData?.userGraphs || []),
     ...(graphsData?.sharedGraphs || [])
    ].forEach(graph => {
      if (!graphsMap.has(graph.id)) {
        graphsMap.set(graph.id, graph);
      }
    });

    const allGraphs = Array.from(graphsMap.values());
    const userGraphs = graphsData?.userGraphs || [];

    console.log('🔍 GraphContext useEffect triggered:', {
      isLoading,
      hasGraphsError: !!graphsError,
      hasCurrentUser: !!currentUser,
      currentUserId: currentUser?.id,
      allGraphsCount: allGraphs.length,
      userGraphsCount: userGraphs.length,
      systemGraphsCount: graphsData?.systemGraphs?.length || 0,
      sharedGraphsCount: graphsData?.sharedGraphs?.length || 0,
      isCreatingWelcomeGraph: isCreatingWelcomeGraphRef.current
    });

    // CASE 1: User has graphs - display them
    if (allGraphs.length > 0) {
      // Parse JSON strings in settings, permissions, shareSettings
      const parsedGraphs = allGraphs.map(parseGraph);
      setAvailableGraphs(parsedGraphs);
      
      // Try to restore previously selected graph from localStorage
      const storedGraphId = localStorage.getItem('currentGraphId');
      let graphToSelect = null;
      
      if (storedGraphId) {
        graphToSelect = parsedGraphs.find((g: any) => g.id === storedGraphId);
      }
      
      // Auto-select graph: previously selected, else a sensible default.
      // Pick by identity (Welcome tutorial first, then the System Overview),
      // never by array position — merge order isn't stable and shared/system
      // demo graphs must not hijack the fresh-load graph.
      if (parsedGraphs.length > 0) {
        if (!currentGraph || !parsedGraphs.find((g: any) => g.id === currentGraph.id)) {
          const preferredDefault =
            parsedGraphs.find((g: any) => g.name === 'Welcome') ||
            parsedGraphs.find((g: any) => g.id === 'overview-graph-shared') ||
            parsedGraphs[0];
          const selectedGraph = graphToSelect || preferredDefault;
          setCurrentGraph(selectedGraph);
          // Save to localStorage for persistence
          localStorage.setItem('currentGraphId', selectedGraph.id);
        }
      }

      // A reload interrupted the starter: finish it once per page load.
      if (readStarterPending(currentUser.id) && !isCreatingWelcomeGraphRef.current) {
        isCreatingWelcomeGraphRef.current = true;
        startStarter(currentUser.id).catch(error => {
          console.error('❌ Failed to finish the starter workspace:', error);
        });
      }
    } else {
      // CASE 2: User has NO graphs - check if we should create a Welcome graph

      // GUARD: Don't create multiple Welcome graphs (prevent race condition)
      if (isCreatingWelcomeGraphRef.current) {
        console.log('⏸️  Already creating Welcome graph - skipping duplicate creation');
        return;
      }

      // Check if user already has a Welcome graph
      const hasWelcomeGraph = userGraphs.some((g: any) => g.name === 'Welcome');

      console.log('🔍 DEBUG: No graphs found - checking Welcome graph creation', {
        userGraphsCount: userGraphs.length,
        allGraphsCount: allGraphs.length,
        hasWelcomeGraph,
        isCreatingWelcomeGraph: isCreatingWelcomeGraphRef.current,
        currentUserId: currentUser.id
      });

      // CONDITION: Create Welcome graph ONLY if:
      // 1. User has NO graphs at all (allGraphs.length === 0)
      // 2. User doesn't already have a Welcome graph (!hasWelcomeGraph)
      // 3. We're not already creating one (!isCreatingWelcomeGraphRef.current)
      if (!hasWelcomeGraph && allGraphs.length === 0) {
        console.log('🎉 Creating Welcome graph for new user:', currentUser.id);

        // Set flag IMMEDIATELY to prevent duplicate creation
        isCreatingWelcomeGraphRef.current = true;

        setAvailableGraphs([]);
        setCurrentGraph(null);

        startStarter(currentUser.id)
          .catch(error => {
            console.error('❌ Failed to create the starter workspace:', error);
            isCreatingWelcomeGraphRef.current = false; // Allow retry on next attempt
          });
      }
    }
  }, [
    graphsData,
    currentTeam,
    currentUser,
    isLoading,
    graphsError,
    createGraphMutation,
    createWorkItemMutation,
    createEdgeMutation,
    updateGraphMutation,
    refetchGraphs
  ]);

  // Build graph hierarchy
  const graphHierarchy: GraphHierarchy[] = availableGraphs
    .filter(graph => graph.depth === 0)
    .map(graph => buildHierarchy(graph, availableGraphs));

  const selectGraph = async (graphId: string): Promise<void> => {
    // setIsLoading is not available, using local loading state if needed
    try {
      const graph = availableGraphs.find(g => g.id === graphId);
      if (graph) {
        setCurrentGraph(graph);
        localStorage.setItem('currentGraphId', graphId);
      }
    } finally {
      // loading state handled by useQuery
    }
  };

  const createGraph = async (input: CreateGraphInput): Promise<Graph> => {
    setIsCreating(true);
    
    try {
      // Pass exactly what the UI sends - let GraphQL handle it
      // Exclude templateId and copyFromGraphId as they're not supported by the current schema
      const { templateId, copyFromGraphId, ...inputWithoutTemplate } = input;
      const graphInput = {
        ...inputWithoutTemplate,  // This includes: name, description, type, status, teamId, tags, defaultRole, isShared
        parentGraphId: input.parentGraphId || null,
        createdBy: input.createdBy || currentUser?.id || '',
        depth: input.parentGraphId ? getGraphDepth(input.parentGraphId) + 1 : 0,
        path: input.parentGraphId ? [...getGraphPathIds(input.parentGraphId), input.parentGraphId] : [],
        nodeCount: 0,
        edgeCount: 0,
        contributorCount: 1,
        lastActivity: new Date().toISOString(),
        permissions: JSON.stringify({
          owner: input.createdBy || currentUser?.id || '',
          admins: [input.createdBy || currentUser?.id || ''].filter(Boolean),
          editors: [],
          viewers: [],
          teamPermission: input.defaultRole === 'ADMIN' ? 'ADMIN' : 
                         input.defaultRole === 'USER' ? 'EDIT' : 
                         'VIEW'
        }),
        shareSettings: JSON.stringify({
          isPublic: false,
          allowTeamAccess: true,
          allowCopying: false,
          allowForking: false
        }),
        settings: JSON.stringify({
          theme: 'light',
          layout: 'force',
          showPriorities: true,
          showDependencies: true,
          autoLayout: true,
          zoomLevel: 1.0
        })
      };

      const { data } = await createGraphMutation({
        variables: { input: graphInput },
        refetchQueries: [{ query: GET_GRAPHS_BY_USER, variables: { userId: currentUser?.id || '' } }],
        awaitRefetchQueries: true
      });

      if (data?.createGraphs?.graphs?.[0]) {
        const newGraph = {
          ...data.createGraphs.graphs[0],
          settings: JSON.parse(data.createGraphs.graphs[0].settings || '{}'),
          permissions: JSON.parse(data.createGraphs.graphs[0].permissions || '{}'),
          shareSettings: JSON.parse(data.createGraphs.graphs[0].shareSettings || '{}')
        };
        
        // Manually refetch to ensure UI is in sync
        await refetchGraphs();
        setCurrentGraph(newGraph);
        localStorage.setItem('currentGraphId', newGraph.id);
        return newGraph;
      }
      
      throw new Error('Failed to create graph');
    } catch (error) {
      console.error('Error creating graph:', error);
      throw error; // Don't fallback to local creation, let the error bubble up
    } finally {
      setIsCreating(false);
    }
  };

  const updateGraph = async (graphId: string, updates: Partial<Graph>): Promise<Graph> => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph) throw new Error('Graph not found');

    try {
      // Prepare updates for GraphQL
      const graphUpdateInput = {
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.tags !== undefined && { tags: updates.tags }),
        ...(updates.defaultRole && { defaultRole: updates.defaultRole }),
        ...(updates.isShared !== undefined && { isShared: updates.isShared }),
        ...(updates.status && { status: updates.status }),
        ...(updates.settings && { settings: JSON.stringify(updates.settings) }),
        ...(updates.permissions && { permissions: JSON.stringify(updates.permissions) }),
        ...(updates.shareSettings && { shareSettings: JSON.stringify(updates.shareSettings) }),
        ...('parentGraphId' in updates && { parentGraphId: updates.parentGraphId ?? null }),
        ...(updates.depth !== undefined && { depth: updates.depth }),
        ...(updates.path !== undefined && { path: updates.path }),
      };

      const { data } = await updateGraphMutation({
        variables: { id: graphId, input: graphUpdateInput }
      });

      if (data?.updateGraphs?.graphs?.[0]) {
        const updatedGraph = {
          ...data.updateGraphs.graphs[0],
          settings: data.updateGraphs.graphs[0].settings ? JSON.parse(data.updateGraphs.graphs[0].settings) : undefined,
          permissions: data.updateGraphs.graphs[0].permissions ? JSON.parse(data.updateGraphs.graphs[0].permissions) : undefined,
          shareSettings: data.updateGraphs.graphs[0].shareSettings ? JSON.parse(data.updateGraphs.graphs[0].shareSettings) : undefined,
        };
        
        setAvailableGraphs(prev => prev.map(g => g.id === graphId ? updatedGraph : g));
        if (currentGraph?.id === graphId) {
          setCurrentGraph(updatedGraph);
        }
        
        return updatedGraph;
      }
      throw new Error('Failed to update graph');
    } catch (error) {
      console.error('Error updating graph:', error);
      throw error; // Don't fallback to local update, let the error bubble up
    }
  };

  const deleteGraph = async (graphId: string): Promise<void> => {
    try {
      const graph = availableGraphs.find(g => g.id === graphId);
      const blocked = graph && projectDeleteBlock(graph, availableGraphs);
      if (blocked) throw new Error(blocked);

      // First, check if the graph contains any nodes
      const { data: workItemsData } = await apolloClient.query({
        query: GET_WORK_ITEMS,
        variables: {
          where: {
            graph: {
              id: graphId
            }
          }
        }
      });

      const workItems = workItemsData?.workItems || [];
      
      // Reject deletion if graph contains nodes
      if (workItems.length > 0) {
        throw new Error(`Cannot delete graph: it contains ${workItems.length} node${workItems.length !== 1 ? 's' : ''}. Please delete all nodes first.`);
      }

      // Only delete the graph itself if it's empty
      await deleteGraphMutation({
        variables: { id: graphId }
      });
      
      // Update local state
      setAvailableGraphs(prev => prev.filter(g => g.id !== graphId));
      if (currentGraph?.id === graphId) {
        const remaining = availableGraphs.filter(g => g.id !== graphId);
        setCurrentGraph(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (error) {
      console.error('Error deleting graph:', error);
      throw error;
    }
  };

  const duplicateGraph = async (graphId: string, name: string): Promise<Graph> => {
    const originalGraph = availableGraphs.find(g => g.id === graphId);
    if (!originalGraph) throw new Error('Graph not found');

    try {
      // Step 1: Create the new graph structure
      const newGraph = await createGraph({
        name,
        description: `Copy of ${originalGraph.name}`,
        type: originalGraph.type,
        parentGraphId: originalGraph.parentGraphId,
        teamId: originalGraph.teamId,
        createdBy: currentUser?.id || '',
        copyFromGraphId: graphId
      });

      // Step 2: Copy all nodes from the original graph
      const { data: originalNodesData } = await apolloClient.query({
        query: GET_WORK_ITEMS,
        variables: {
          where: {
            graph: {
              id: graphId
            }
          }
        }
      });

      const originalNodes = originalNodesData?.workItems || [];
      
      // TODO: Implement node copying in the GraphQL schema
      // This requires CREATE_WORK_ITEM mutation and copying all node properties
      
      // Step 3: Copy all edges from the original graph  
      // TODO: Implement edge copying after nodes are copied
      
      return newGraph;
    } catch (error) {
      console.error('Error duplicating graph:', error);
      throw error;
    }
  };

  const moveGraph = async (graphId: string, newParentId?: string): Promise<void> => {
    const graph = availableGraphs.find(g => g.id === graphId);
    if (!graph) throw new Error('Graph not found');
    if (newParentId) {
      if (!availableGraphs.some(g => g.id === newParentId)) throw new Error('Parent graph not found');
      if (newParentId === graphId || getGraphPathIds(newParentId).includes(graphId)) {
        throw new Error('A graph cannot be moved inside itself.');
      }
    }

    const newDepth = newParentId ? getGraphDepth(newParentId) + 1 : 0;
    const newPath = newParentId ? [...getGraphPathIds(newParentId), newParentId] : [];

    await updateGraph(graphId, {
      parentGraphId: newParentId,
      depth: newDepth,
      path: newPath
    });
  };

  const addExampleProject = async (): Promise<Graph> => {
    if (!currentUser) throw new Error('Sign in to add the example project.');
    if (isAddingExampleRef.current) throw new Error('The example project is already being added.');
    const plan = buildStarterWorkspace({
      hierarchy: hierarchyHere(),
      takenNames: availableGraphs.map(g => g.name)
    });
    const full = exampleLimitMessage({ offline: offlineEnabled, existing: availableGraphs.length, adds: starterGraphCount(plan), limit: OFFLINE_PROJECT_LIMIT });
    if (full) throw new Error(full);
    isAddingExampleRef.current = true;
    setIsCreating(true);
    try {
      const opened: { graph: Graph | null } = { graph: null };
      await createStarterWorkspace(plan, {
        ...starterApi(currentUser.id, currentTeam?.id || 'team-1'),
        opened: async graphId => {
          const { data } = await refetchGraphs();
          const found = (data?.userGraphs || []).find((g: any) => g.id === graphId);
          if (!found) return;
          opened.graph = parseGraph(found);
          setCurrentGraph(opened.graph);
          localStorage.setItem('currentGraphId', graphId);
        }
      });
      await refetchGraphs();
      await apolloClient.refetchQueries({ include: ['GetWorkItems', 'GetEdges'] });
      if (!opened.graph) throw new Error('The example project was added, but it could not be opened. Choose it in the list.');
      return opened.graph;
    } finally {
      isAddingExampleRef.current = false;
      setIsCreating(false);
    }
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
    // TODO: Implement shared graph joining functionality
    throw new Error('Shared graph joining not yet implemented');
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

  // Altium-style hierarchy navigation: descend into a node's sub-graph, ascend
  // back up via the breadcrumb. Both reduce to selectGraph; the breadcrumb is
  // derived from the target graph's `path` (ancestors) + itself.
  const descendInto = async (subgraphId: string): Promise<void> => {
    await selectGraph(subgraphId);
  };

  const ascendTo = async (graphId: string): Promise<void> => {
    await selectGraph(graphId);
  };

  const getBreadcrumb = (): Graph[] => {
    if (!currentGraph) return [];
    return [...getGraphPath(currentGraph.id), currentGraph];
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
    // Refresh will be handled by GraphQL refetch
    // No manual refresh needed as we're using real data only
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
    addExampleProject,
    getGraphPath,
    getGraphChildren,
    descendInto,
    ascendTo,
    getBreadcrumb,
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
    edgeCount: graph.edgeCount,
    isShared: graph.isShared,
    permissions: getPermissionLevel(graph)
  };
}

function getPermissionLevel(graph: Graph): 'OWNER' | 'ADMIN' | 'EDIT' | 'VIEW' {
  // TODO: Implement real permission checking based on current user
  // For now, return basic permission level
  return graph.permissions?.teamPermission === 'ADMIN' ? 'ADMIN' :
         graph.permissions?.teamPermission === 'EDIT' ? 'EDIT' : 'VIEW';
}

export function useGraph() {
  const context = useContext(GraphContext);
  if (context === undefined) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  return context;
}