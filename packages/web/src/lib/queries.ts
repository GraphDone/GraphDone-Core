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
      assignedTo
      tags
      teamId
      userId
      contributors {
        id
        name
        type
        teamId
      }
      dependencies {
        id
        title
        type
        teamId
        userId
      }
      dependents {
        id
        title
        type
        teamId
        userId
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
      teamId
      userId
      source {
        id
        title
        type
        teamId
        userId
      }
      target {
        id
        title
        type
        teamId
        userId
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
      assignedTo
      tags
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
        assignedTo
        tags
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
        assignedTo
        tags
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
      positionX
      positionY
      positionZ
      radius
      theta
      phi
      priorityComp
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