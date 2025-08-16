import { useQuery, useSubscription } from '@apollo/client';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { GET_NODES, SUBSCRIBE_TO_NODE_CHANGES } from '../lib/queries';

export function useTeamNodes() {
  const { currentUser, currentTeam } = useAuth();
  const { currentGraph } = useGraph();
  
  const {
    data,
    loading,
    error,
    refetch
  } = useQuery(GET_NODES, {
    variables: {
      graphId: currentGraph?.id,
      teamId: currentTeam?.id,
      userId: currentUser?.id,
      limit: 100
    },
    skip: !currentUser || !currentTeam || !currentGraph,
    errorPolicy: 'all'
  });

  // Subscribe to real-time updates for the graph
  const { data: subscriptionData } = useSubscription(SUBSCRIBE_TO_NODE_CHANGES, {
    variables: {
      graphId: currentGraph?.id,
      teamId: currentTeam?.id
    },
    skip: !currentGraph || !currentTeam,
    onSubscriptionData: () => {
      // Optionally refetch data when subscription updates occur
      // This ensures we have the latest data
      refetch();
    }
  });

  return {
    nodes: data?.nodes || [],
    loading,
    error,
    refetch,
    subscriptionData
  };
}

export function useFilteredNodes(searchTerm: string = '', filterType: string = 'all') {
  const { nodes, loading, error, refetch } = useTeamNodes();

  const filteredNodes = nodes.filter((node: any) => {
    // Search filter
    const matchesSearch = !searchTerm || 
      node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.description?.toLowerCase().includes(searchTerm.toLowerCase());

    // Type filter
    const matchesType = filterType === 'all' || node.type.toLowerCase() === filterType.toLowerCase();

    return matchesSearch && matchesType;
  });

  // Sort by priority (highest first)
  const sortedNodes = filteredNodes.sort((a: any, b: any) => {
    return (b.priority?.computed || 0) - (a.priority?.computed || 0);
  });

  return {
    nodes: sortedNodes,
    totalNodes: nodes.length,
    filteredCount: filteredNodes.length,
    loading,
    error,
    refetch
  };
}