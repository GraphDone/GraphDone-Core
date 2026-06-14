import { Driver } from 'neo4j-driver';

export async function sharedWelcomeGraphExists(driver: Driver): Promise<boolean> {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (g:Graph {name: 'Welcome', isShared: true})
      RETURN count(g) > 0 AS hasWelcome
      `
    );

    const records = result.records;
    if (records.length === 0) {
      return false;
    }

    return records[0].get('hasWelcome');
  } catch (error: any) {
    console.error('❌ Error checking for shared Welcome graph:', error);
    return false;
  } finally {
    await session.close();
  }
}

export interface OnboardingNode {
  title: string;
  description: string;
  type: string;
  status: string;
  positionX: number;
  positionY: number;
  positionZ: number;
}

export interface OnboardingEdge {
  sourceIndex: number;
  targetIndex: number;
  type: string;
}

export const WELCOME_NODES: OnboardingNode[] = [
  {
    title: 'Welcome to GraphDone!',
    description: `# Welcome to GraphDone! 🎉

GraphDone is a graph-native project management system that reimagines how work flows through dependencies rather than hierarchies.

## Key Concepts:
- **Nodes** represent work items, ideas, tasks, or outcomes
- **Edges** represent relationships between nodes (dependencies, blocks, enables)
- **Priority** emerges from the graph structure - work naturally flows from periphery to center

## Getting Started:
1. Explore this Welcome graph to understand the basics
2. Try creating your first work item
3. Connect nodes with dependency relationships
4. Watch as priorities automatically adjust

This is your workspace - feel free to edit, delete, or reorganize these tutorial nodes as you learn!`,
    type: 'DOCUMENTATION',
    status: 'COMPLETED',
    positionX: -180,
    positionY: -240,
    positionZ: 0
  },
  {
    title: 'Create Your First Work Item',
    description: `Click the '+' button or use the keyboard shortcut to create a new node.

Each work item has:
- **Title**: A clear, concise name
- **Description**: Details, context, and notes
- **Type**: Category (TASK, FEATURE, BUG, etc.)
- **Status**: Current state (NOT_STARTED, IN_PROGRESS, COMPLETED, etc.)
- **Priority**: Automatically calculated from dependencies

Try creating a work item right now!`,
    type: 'TASK',
    status: 'NOT_STARTED',
    positionX: -180,
    positionY: 0,
    positionZ: 0
  },
  {
    title: 'Connect Nodes with Dependencies',
    description: `Dependencies define how work flows through your graph.

## Relationship Types:
- **DEPENDS_ON**: This work requires another to complete first
- **BLOCKS**: This work prevents another from proceeding
- **ENABLES**: This work unlocks new possibilities
- **RELATES_TO**: General connection between work items

To create a dependency:
1. Click and drag from one node to another
2. Select the relationship type
3. Watch the graph reorganize automatically

Dependencies determine priority - the more dependents a node has, the higher its priority becomes.`,
    type: 'TASK',
    status: 'NOT_STARTED',
    positionX: 180,
    positionY: 0,
    positionZ: 0
  },
  {
    title: 'Understand Graph Visualization',
    description: `The force-directed graph layout helps you see work structure at a glance.

## Visual Cues:
- **Node Size**: Reflects priority and importance
- **Node Color**: Indicates work item type
- **Edge Thickness**: Shows dependency strength
- **Node Position**: Naturally clusters related work

## Navigation:
- **Scroll**: Zoom in/out
- **Click+Drag**: Pan around the graph
- **Click Node**: View details and edit
- **Hover**: See quick information

The graph is alive - it reorganizes as you add dependencies and complete work!`,
    type: 'DOCUMENTATION',
    status: 'COMPLETED',
    positionX: 180,
    positionY: 240,
    positionZ: 0
  },
  {
    title: 'Explore Different Views',
    description: `GraphDone offers multiple ways to view your work:

- **Graph View**: Force-directed visualization showing dependencies
- **Table View**: Spreadsheet-like list of all work items
- **Kanban View**: Traditional board with status columns
- **Calendar View**: Timeline view for scheduled work
- **Gantt View**: Project timeline with dependencies

Switch between views using the mode buttons at the top center of the screen.

Each view presents the same underlying graph data in different ways - choose what works best for your current task!`,
    type: 'DOCUMENTATION',
    status: 'COMPLETED',
    positionX: -180,
    positionY: 240,
    positionZ: 0
  },
  {
    title: 'Ready to Start Your First Project?',
    description: `You've learned the basics! Now it's time to create your own workspace.

## Next Steps:
1. Click the graph selector (top left)
2. Create a new graph for your project
3. Start adding your work items
4. Build your dependency network
5. Let GraphDone help you prioritize naturally

**Tips:**
- Start small - add a few key tasks first
- Build dependencies as you understand relationships
- Let the graph guide your priorities
- Iterate and refine as your project evolves

Remember: In GraphDone, work flows through natural dependencies, not artificial hierarchies. Trust the graph!

You can always come back to this Welcome graph for reference, or delete it when you're ready.`,
    type: 'MILESTONE',
    status: 'NOT_STARTED',
    positionX: 180,
    positionY: 480,
    positionZ: 0
  }
];

export const WELCOME_EDGES: OnboardingEdge[] = [
  { sourceIndex: 1, targetIndex: 0, type: 'RELATES_TO' },
  { sourceIndex: 2, targetIndex: 1, type: 'DEPENDS_ON' },
  { sourceIndex: 3, targetIndex: 2, type: 'DEPENDS_ON' },
  { sourceIndex: 4, targetIndex: 1, type: 'RELATES_TO' },
  { sourceIndex: 4, targetIndex: 3, type: 'RELATES_TO' },
  { sourceIndex: 5, targetIndex: 3, type: 'DEPENDS_ON' }
];

export async function createSharedWelcomeGraph(driver: Driver): Promise<string> {
  const session = driver.session();

  try {
    console.log(`🎉 Creating shared Welcome graph for all users`);

    const graphId = `welcome-graph-shared`;

    const result = await session.run(
      `
      // Create the shared Welcome graph
      CREATE (g:Graph {
        id: $graphId,
        name: 'Welcome',
        description: 'Tutorial graph - explore GraphDone basics here! This graph is shared with all users.',
        type: 'PROJECT',
        status: 'ACTIVE',
        teamId: null,
        createdBy: 'system',
        tags: ['tutorial', 'onboarding', 'welcome'],
        defaultRole: 'VIEWER',
        depth: 0,
        path: [],
        isShared: true,
        nodeCount: $nodeCount,
        edgeCount: $edgeCount,
        contributorCount: 0,
        lastActivity: datetime(),
        settings: '{}',
        permissions: '{"public": "read", "authenticated": "read"}',
        shareSettings: '{"public": true, "readOnly": true}',
        createdAt: datetime(),
        updatedAt: datetime()
      })

      // Create work items
      WITH g
      UNWIND $nodes AS node
      CREATE (w:WorkItem {
        id: 'node-' + randomUUID(),
        type: node.type,
        title: node.title,
        description: node.description,
        status: node.status,
        positionX: toFloat(node.positionX),
        positionY: toFloat(node.positionY),
        positionZ: toFloat(node.positionZ),
        radius: toFloat(1.0),
        theta: toFloat(0.0),
        phi: toFloat(0.0),
        priority: toFloat(0.0),
        priorityComp: toFloat(0.0),
        tags: [],
        metadata: '{}',
        createdAt: datetime(),
        updatedAt: datetime()
      })
      CREATE (w)-[:BELONGS_TO]->(g)
      WITH collect(w) AS workItems, g

      // Create edges between work items
      UNWIND $edges AS edge
      WITH workItems[toInteger(edge.sourceIndex)] AS source,
           workItems[toInteger(edge.targetIndex)] AS target,
           edge.type AS edgeType,
           g
      CREATE (e:Edge {
        id: 'edge-' + randomUUID(),
        type: edgeType,
        weight: toFloat(1.0),
        metadata: '{}',
        createdAt: datetime()
      })
      CREATE (e)-[:EDGE_SOURCE]->(source)
      CREATE (e)-[:EDGE_TARGET]->(target)

      RETURN g.id AS graphId
      `,
      {
        graphId,
        nodeCount: WELCOME_NODES.length,
        edgeCount: WELCOME_EDGES.length,
        nodes: WELCOME_NODES,
        edges: WELCOME_EDGES
      }
    );

    const records = result.records;
    if (records.length === 0) {
      throw new Error('Failed to create Welcome graph');
    }

    const createdGraphId = records[0].get('graphId');
    console.log(`✅ Welcome graph created successfully: ${createdGraphId}`);

    return createdGraphId;

  } catch (error: any) {
    console.error('❌ Error creating Welcome graph:', error);
    throw error;
  } finally {
    await session.close();
  }
}
