import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useAuth } from './AuthContext';
import { Graph, GraphHierarchy, CreateGraphInput, GraphContextType, GraphPermissions, ShareSettings } from '../types/graph';
import {
  GET_GRAPHS,
  GET_GRAPHS_BY_USER,
  CREATE_GRAPH,
  UPDATE_GRAPH,
  DELETE_GRAPH
} from '../graphql/graph';
import { GET_WORK_ITEMS, DELETE_WORK_ITEM, CREATE_WORK_ITEM, CREATE_EDGE } from '../lib/queries';

const GraphContext = createContext<GraphContextType | undefined>(undefined);

// Using only real GraphQL data from Neo4j database

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


  // GraphQL operations - Load graphs for current user only
  const { data: graphsData, loading: isLoading, error: graphsError, refetch: refetchGraphs } = useQuery(GET_GRAPHS_BY_USER, {
    variables: { userId: currentUser?.id || '' },
    skip: !currentUser, // Skip if no user logged in
  });
  

  const [createGraphMutation] = useMutation(CREATE_GRAPH);
  const [updateGraphMutation] = useMutation(UPDATE_GRAPH);
  const [deleteGraphMutation] = useMutation(DELETE_GRAPH);
  const [deleteWorkItemMutation] = useMutation(DELETE_WORK_ITEM);
  const [createWorkItemMutation] = useMutation(CREATE_WORK_ITEM);
  const [createEdgeMutation] = useMutation(CREATE_EDGE);

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
      const parsedGraphs = allGraphs.map((g: any) => ({
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
          owner: currentUser?.id || 'unknown',
          admins: [currentUser?.id || 'unknown'],
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
      }));
      setAvailableGraphs(parsedGraphs);
      
      // Try to restore previously selected graph from localStorage
      const storedGraphId = localStorage.getItem('currentGraphId');
      let graphToSelect = null;
      
      if (storedGraphId) {
        graphToSelect = parsedGraphs.find((g: any) => g.id === storedGraphId);
      }
      
      // Auto-select graph: either previously selected or first available
      if (parsedGraphs.length > 0) {
        if (!currentGraph || !parsedGraphs.find((g: any) => g.id === currentGraph.id)) {
          const selectedGraph = graphToSelect || parsedGraphs[0];
          setCurrentGraph(selectedGraph);
          // Save to localStorage for persistence
          localStorage.setItem('currentGraphId', selectedGraph.id);
        }
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

        // Create Welcome graph automatically with tutorial content
        const createWelcomeGraphWithTutorial = async () => {
        console.log('📝 Starting Welcome graph creation process...');
        try {
          // Step 1: Create the Welcome graph
          const welcomeGraphInput = {
            name: 'Welcome',
            description: 'A tutorial graph to help you understand GraphDone. Feel free to explore and experiment!',
            type: 'PROJECT',
            status: 'ACTIVE',
            teamId: currentTeam?.id || 'team-1',
            createdBy: currentUser.id,
            tags: ['tutorial', 'welcome', 'getting-started'],
            defaultRole: 'USER',
            isShared: false
          };

          const graphInput = {
            ...welcomeGraphInput,
            parentGraphId: null,
            depth: 0,
            path: [],
            nodeCount: 0,
            edgeCount: 0,
            contributorCount: 1,
            lastActivity: new Date().toISOString(),
            permissions: JSON.stringify({
              owner: currentUser.id,
              admins: [currentUser.id],
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
          };

          const { data: graphData } = await createGraphMutation({
            variables: { input: graphInput },
            refetchQueries: [{ query: GET_GRAPHS_BY_USER, variables: { userId: currentUser.id } }],
            awaitRefetchQueries: true
          });

          if (!graphData?.createGraphs?.graphs?.[0]) {
            throw new Error('Failed to create Welcome graph');
          }

          const welcomeGraph = graphData.createGraphs.graphs[0];

          // Step 2: Create tutorial work items
          const tutorialWorkItems = [
            {
              title: 'Welcome to GraphDone',
              description: 'GraphDone helps you organize work through natural dependencies instead of rigid hierarchies. Start by exploring this tutorial graph.',
              type: 'MILESTONE',
              status: 'IN_PROGRESS',
              priority: 0.9,
              positionX: 0,
              positionY: -100,
              positionZ: 0,
              radius: 1.0,
              theta: 0,
              phi: 0,
              priorityComp: 0.9,
              tags: ['tutorial', 'introduction'],
              owner: { connect: { where: { node: { id: currentUser.id } } } },
              graph: { connect: { where: { node: { id: welcomeGraph.id } } } }
            },
            {
              title: 'Create your first work item',
              description: 'Click the "+" button or right-click on empty space to create a new work item. Try it now!',
              type: 'TASK',
              status: 'COMPLETED',
              priority: 0.7,
              positionX: -150,
              positionY: 50,
              positionZ: 0,
              radius: 1.0,
              theta: 0,
              phi: 0,
              priorityComp: 0.7,
              tags: ['tutorial', 'basics'],
              owner: { connect: { where: { node: { id: currentUser.id } } } },
              graph: { connect: { where: { node: { id: welcomeGraph.id } } } }
            },
            {
              title: 'Connect work items together',
              description: 'Drag from one work item to another to create connections. This shows dependencies and relationships.',
              type: 'TASK',
              status: 'PLANNED',
              priority: 0.6,
              positionX: 150,
              positionY: 50,
              positionZ: 0,
              radius: 1.0,
              theta: 0,
              phi: 0,
              priorityComp: 0.6,
              tags: ['tutorial', 'connections'],
              owner: { connect: { where: { node: { id: currentUser.id } } } },
              graph: { connect: { where: { node: { id: welcomeGraph.id } } } }
            },
            {
              title: 'Explore different views',
              description: 'Switch between Graph, Table, Kanban, Gantt, Calendar, and Card views using the buttons at the top.',
              type: 'TASK',
              status: 'PLANNED',
              priority: 0.5,
              positionX: 0,
              positionY: 200,
              positionZ: 0,
              radius: 1.0,
              theta: 0,
              phi: 0,
              priorityComp: 0.5,
              tags: ['tutorial', 'views'],
              owner: { connect: { where: { node: { id: currentUser.id } } } },
              graph: { connect: { where: { node: { id: welcomeGraph.id } } } }
            }
          ];

          console.log('📝 Creating tutorial work items...', tutorialWorkItems.length, 'items');
          const { data: workItemsData } = await createWorkItemMutation({
            variables: { input: tutorialWorkItems }
          });
          console.log('✅ Work items created:', workItemsData?.createWorkItems?.workItems?.length || 0);

          // Step 3: Create connections between tutorial items
          if (workItemsData?.createWorkItems?.workItems) {
            const items = workItemsData.createWorkItems.workItems;
            const edges = [
              {
                type: 'DEPENDS_ON',
                source: { connect: { where: { node: { id: items[0].id } } } },
                target: { connect: { where: { node: { id: items[1].id } } } }
              },
              {
                type: 'DEPENDS_ON',
                source: { connect: { where: { node: { id: items[1].id } } } },
                target: { connect: { where: { node: { id: items[2].id } } } }
              },
              {
                type: 'DEPENDS_ON',
                source: { connect: { where: { node: { id: items[2].id } } } },
                target: { connect: { where: { node: { id: items[3].id } } } }
              }
            ];

            await createEdgeMutation({ variables: { input: edges } });
            console.log('✅ Created 3 edges connecting tutorial items');
          }

          // Step 4: Update graph counts
          await updateGraphMutation({
            variables: {
              id: welcomeGraph.id,
              input: {
                nodeCount: 4,
                edgeCount: 3,
                lastActivity: new Date().toISOString()
              }
            }
          });
          console.log('✅ Updated graph counts: 4 nodes, 3 edges');

          console.log('✅ Welcome graph created with tutorial content:', welcomeGraph.name);

          // Refetch graphs to show the new graph with updated counts
          await refetchGraphs();
        } catch (error) {
          console.error('❌ Failed to create Welcome graph:', error);
          isCreatingWelcomeGraphRef.current = false; // Allow retry on next attempt
        }
      };

        createWelcomeGraphWithTutorial();
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