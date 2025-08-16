import { gql } from '@apollo/client';

export const GET_NODES = gql`
  query GetNodes($teamId: String, $userId: String, $limit: Int) {
    nodes(teamId: $teamId, userId: $userId, limit: $limit) {
      id
      type
      title
      description
      status
      priority {
        executive
        individual
        community
        computed
      }
      position {
        x
        y
        z
        radius
        theta
        phi
      }
      contributors {
        id
        name
        role
      }
      dependencies {
        id
        title
        type
      }
      dependents {
        id
        title
        type
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_NODE_BY_ID = gql`
  query GetNodeById($id: ID!) {
    node(id: $id) {
      id
      type
      title
      description
      status
      priority {
        executive
        individual
        community
        computed
      }
      position {
        x
        y
        z
        radius
        theta
        phi
      }
      contributors {
        id
        name
        role
      }
      dependencies {
        id
        title
        type
      }
      dependents {
        id
        title
        type
      }
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_NODE = gql`
  mutation CreateNode($input: CreateNodeInput!) {
    createNode(input: $input) {
      id
      type
      title
      description
      status
      priority {
        executive
        individual
        community
        computed
      }
      position {
        x
        y
        z
        radius
        theta
        phi
      }
      createdAt
    }
  }
`;

export const UPDATE_NODE = gql`
  mutation UpdateNode($id: ID!, $input: UpdateNodeInput!) {
    updateNode(id: $id, input: $input) {
      id
      type
      title
      description
      status
      priority {
        executive
        individual
        community
        computed
      }
      position {
        x
        y
        z
        radius
        theta
        phi
      }
      updatedAt
    }
  }
`;

export const DELETE_NODE = gql`
  mutation DeleteNode($id: ID!) {
    deleteNode(id: $id)
  }
`;

export const SUBSCRIBE_TO_NODE_CHANGES = gql`
  subscription NodeUpdates($teamId: String) {
    nodeUpdated(teamId: $teamId) {
      id
      type
      title
      priority {
        computed
      }
      position {
        x
        y
        z
        radius
        theta
        phi
      }
    }
  }
`;