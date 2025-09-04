import { gql } from '@apollo/client';

// Queries - Simplified to debug 400 error
export const GET_GRAPHS = gql`
  query GetGraphs {
    graphs {
      id
      name
      description
      type
      status
      parentGraphId
      teamId
      createdBy
      depth
      path
      isShared
      nodeCount
      edgeCount
      contributorCount
      lastActivity
      settings
      permissions
      shareSettings
      createdAt
      updatedAt
    }
  }
`;

export const GET_GRAPHS_BY_TEAM = gql`
  query GetGraphsByTeam($teamId: String!) {
    graphs(where: { teamId: $teamId }) {
      id
      name
      description
      type
      status
      parentGraphId
      teamId
      createdBy
      depth
      path
      isShared
      nodeCount
      edgeCount
      contributorCount
      lastActivity
      settings
      permissions
      shareSettings
      createdAt
      updatedAt
    }
  }
`;

export const GET_GRAPH = gql`
  query GetGraph($id: ID!) {
    graphs(where: { id: $id }) {
      id
      name
      description
      type
      status
      parentGraphId
      teamId
      createdBy
      depth
      path
      isShared
      nodeCount
      edgeCount
      contributorCount
      lastActivity
      settings
      permissions
      shareSettings
      createdAt
      updatedAt
      workItems {
        id
        title
        type
        status
        positionX
        positionY
        positionZ
        priority
      }
      subgraphs {
        id
        name
        type
        nodeCount
      }
      parentGraph {
        id
        name
      }
    }
  }
`;

// Mutations
export const CREATE_GRAPH = gql`
  mutation CreateGraph($input: GraphCreateInput!) {
    createGraphs(input: [$input]) {
      graphs {
        id
        name
        description
        type
        status
        parentGraphId
        teamId
        createdBy
        depth
        path
        isShared
        nodeCount
        edgeCount
        contributorCount
        lastActivity
        settings
        permissions
        shareSettings
        createdAt
        updatedAt
      }
    }
  }
`;

export const UPDATE_GRAPH = gql`
  mutation UpdateGraph($id: ID!, $input: GraphUpdateInput!) {
    updateGraphs(where: { id: $id }, update: $input) {
      graphs {
        id
        name
        description
        type
        status
        parentGraphId
        teamId
        createdBy
        depth
        path
        isShared
        nodeCount
        edgeCount
        contributorCount
        lastActivity
        settings
        permissions
        shareSettings
        createdAt
        updatedAt
      }
    }
  }
`;

export const DELETE_GRAPH = gql`
  mutation DeleteGraph($id: ID!) {
    deleteGraphs(where: { id: $id }) {
      nodesDeleted
    }
  }
`;

// Subscriptions
export const GRAPH_CREATED = gql`
  subscription OnGraphCreated {
    graphCreated {
      id
      name
      type
      teamId
      createdBy
    }
  }
`;

export const GRAPH_UPDATED = gql`
  subscription OnGraphUpdated {
    graphUpdated {
      id
      name
      type
      status
      updatedAt
    }
  }
`;

export const GRAPH_DELETED = gql`
  subscription OnGraphDeleted {
    graphDeleted
  }
`;