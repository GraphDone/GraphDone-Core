import { gql } from '@apollo/client';

export const GET_WORK_ITEMS = gql`
  query GetWorkItems($where: WorkItemWhere, $options: WorkItemOptions) {
    workItems(where: $where, options: $options) {
      id
      type
      title
      description
      status
      positionX
      positionY
      positionZ
      radius
      theta
      phi
      priorityExec
      priorityIndiv
      priorityComm
      priorityComp
      dueDate
      tags
      metadata
      owner {
        id
        name
        username
      }
      assignedTo {
        id
        name
        username
      }
      graph {
        id
        name
        team {
          id
          name
        }
      }
      contributors {
        id
        name
        type
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

export const GET_EDGES = gql`
  query GetEdges($where: EdgeWhere, $options: EdgeOptions) {
    edges(where: $where, options: $options) {
      id
      type
      weight
      createdBy {
        id
        name
        username
      }
      source {
        id
        title
        type
      }
      target {
        id
        title
        type
      }
      createdAt
    }
  }
`;

export const GET_WORK_ITEM_BY_ID = gql`
  query GetWorkItemById($id: ID!) {
    workItem(id: $id) {
      id
      type
      title
      description
      status
      positionX
      positionY
      positionZ
      radius
      theta
      phi
      priorityExec
      priorityIndiv
      priorityComm
      priorityComp
      dueDate
      tags
      metadata
      owner {
        id
        name
        username
      }
      assignedTo {
        id
        name
        username
      }
      graph {
        id
        name
        team {
          id
          name
        }
      }
      contributors {
        id
        name
        type
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

export const CREATE_WORK_ITEM = gql`
  mutation CreateWorkItems($input: [WorkItemCreateInput!]!) {
    createWorkItems(input: $input) {
      workItems {
        id
        type
        title
        description
        status
        positionX
        positionY
        positionZ
        radius
        theta
        phi
        priorityExec
        priorityIndiv
        priorityComm
        priorityComp
        dueDate
        tags
        metadata
        owner {
          id
          name
          username
        }
        assignedTo {
          id
          name
          username
        }
        graph {
          id
          name
        }
        createdAt
      }
    }
  }
`;

export const UPDATE_WORK_ITEM = gql`
  mutation UpdateWorkItems($where: WorkItemWhere!, $update: WorkItemUpdateInput!) {
    updateWorkItems(where: $where, update: $update) {
      workItems {
        id
        type
        title
        description
        status
        positionX
        positionY
        positionZ
        radius
        theta
        phi
        priorityExec
        priorityIndiv
        priorityComm
        priorityComp
        dueDate
        tags
        metadata
        owner {
          id
          name
          username
        }
        assignedTo {
          id
          name
          username
        }
        graph {
          id
          name
        }
        updatedAt
      }
    }
  }
`;

export const DELETE_WORK_ITEM = gql`
  mutation DeleteWorkItems($where: WorkItemWhere!) {
    deleteWorkItems(where: $where) {
      nodesDeleted
      relationshipsDeleted
    }
  }
`;

export const CREATE_EDGE = gql`
  mutation CreateEdges($input: [EdgeCreateInput!]!) {
    createEdges(input: $input) {
      edges {
        id
        type
        weight
        source {
          id
          title
          type
        }
        target {
          id
          title
          type
        }
        createdAt
      }
    }
  }
`;

export const SUBSCRIBE_TO_WORK_ITEM_CHANGES = gql`
  subscription WorkItemUpdates {
    workItemUpdated {
      id
      type
      title
      description
      status
      positionX
      positionY
      positionZ
      radius
      theta
      phi
      priorityExec
      priorityIndiv
      priorityComm
      priorityComp
      dueDate
      assignedTo
      tags
      updatedAt
    }
  }
`;

// User Management Queries
export const GET_ALL_USERS = gql`
  query GetAllUsers {
    users {
      id
      email
      username
      name
      role
      isActive
      isEmailVerified
      deactivationDate
      createdAt
      updatedAt
    }
  }
`;

// User Management Mutations
export const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: ID!, $role: String!) {
    updateUsers(where: { id: $userId }, update: { role: $role }) {
      users {
        id
        role
        updatedAt
      }
    }
  }
`;

export const RESET_USER_PASSWORD = gql`
  mutation ResetUserPassword($userId: ID!) {
    resetUserPassword(userId: $userId) {
      success
      tempPassword
      message
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($userId: ID!) {
    deleteUser(userId: $userId) {
      success
      message
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      email
      username
      name
      role
      isActive
      isEmailVerified
    }
  }
`;

export const UPDATE_USER_STATUS = gql`
  mutation UpdateUserStatus($userId: String!, $isActive: Boolean!) {
    updateUserStatus(userId: $userId, isActive: $isActive) {
      id
      isActive
      deactivationDate
      updatedAt
    }
  }
`;

// Backward compatibility exports
export const GET_NODES = GET_WORK_ITEMS;
export const GET_NODE_BY_ID = GET_WORK_ITEM_BY_ID;
export const CREATE_NODE = CREATE_WORK_ITEM;
export const UPDATE_NODE = UPDATE_WORK_ITEM;
export const DELETE_NODE = DELETE_WORK_ITEM;
export const SUBSCRIBE_TO_NODE_CHANGES = SUBSCRIBE_TO_WORK_ITEM_CHANGES;