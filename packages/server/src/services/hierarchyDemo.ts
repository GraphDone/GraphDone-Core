import { Driver } from 'neo4j-driver';

/**
 * Guest-visible demo of an Altium-style HIERARCHY of graphs ("graphs of
 * graphs"). A top OVERVIEW graph holds sheet-symbol nodes; each drills into a
 * sub-graph (via the WorkItem.subgraph / DRILLS_INTO relationship). The
 * hierarchy is the level-of-detail strategy — any single view renders one graph
 * (a few dozen sheets at the overview, up to ~1000 in the perf showcase
 * sub-graph), never all ~2600 nodes at once.
 *
 * Everything is createdBy:'system' + isShared:true so the GUEST account sees it.
 * Idempotent and NON-destructive: it only creates if the overview graph is
 * absent (unlike scripts/seed.ts which wipes the DB). Edges are canonical Edge
 * nodes with both EDGE_SOURCE and EDGE_TARGET (no orphan edges).
 */

export const OVERVIEW_GRAPH_ID = 'overview-graph-shared';

const NODE_TYPES = ['TASK', 'FEATURE', 'BUG', 'MILESTONE', 'OUTCOME', 'IDEA'];
const STATUSES = ['NOT_STARTED', 'PROPOSED', 'PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];
const EDGE_TYPES = ['DEPENDS_ON', 'BLOCKS', 'ENABLES', 'RELATES_TO'];

// Subsystems = sub-graphs. One large "Compute Core" (~1000 nodes) is the
// high-performance / LOD showcase; the rest are varied mid-size graphs.
interface Subsystem { key: string; name: string; size: number; }
const SUBSYSTEMS: Subsystem[] = [
  { key: 'compute', name: 'Compute Core', size: 1000 },
  { key: 'power', name: 'Power Management', size: 90 },
  { key: 'clocking', name: 'Clocking & PLL', size: 110 },
  { key: 'memctl', name: 'Memory Controller', size: 150 },
  { key: 'ddrphy', name: 'DDR PHY', size: 130 },
  { key: 'pcie', name: 'PCIe Root Complex', size: 160 },
  { key: 'usb', name: 'USB Subsystem', size: 120 },
  { key: 'ethernet', name: 'Ethernet MAC', size: 140 },
  { key: 'display', name: 'Display Pipeline', size: 170 },
  { key: 'audio', name: 'Audio Codec', size: 90 },
  { key: 'security', name: 'Security Enclave', size: 100 },
  { key: 'thermal', name: 'Thermal & Sensors', size: 110 },
  { key: 'ioexp', name: 'I/O Expander', size: 95 },
  { key: 'firmware', name: 'Firmware & Boot', size: 130 },
  { key: 'telemetry', name: 'Telemetry & Logging', size: 120 },
  { key: 'fabric', name: 'Interconnect Fabric', size: 180 },
];

interface NodeRow { id: string; type: string; title: string; description: string; status: string; priority: number; x: number; y: number; }
interface EdgeRow { id: string; s: string; t: string; type: string; weight: number; }

/** Grid positions centered on the origin so nodes load pinned in a real layout. */
function gridPositions(n: number, spacing: number): Array<{ x: number; y: number }> {
  const cols = Math.ceil(Math.sqrt(n));
  const half = (cols * spacing) / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: (i % cols) * spacing - half,
    y: Math.floor(i / cols) * spacing - half,
  }));
}

/** A connected sub-graph: backbone chain + deterministic forward links (~1.4x). */
function buildSubgraph(graphId: string, size: number): { nodes: NodeRow[]; edges: EdgeRow[] } {
  // Spacing must exceed the node-card collision diameter (~224px) so the seeded
  // layout is non-overlapping on load — a clean starting state with no physics
  // needed. (140 produced "garbage piles".)
  const pos = gridPositions(size, 260);
  const nodes: NodeRow[] = Array.from({ length: size }, (_, i) => {
    const type = NODE_TYPES[(i * 7) % NODE_TYPES.length];
    return {
      id: `${graphId}-n${i}`,
      type,
      title: `${type} ${i}`,
      description: '',
      status: STATUSES[i % STATUSES.length],
      priority: ((i * 37) % 100) / 100,
      x: pos[i].x,
      y: pos[i].y,
    };
  });

  const edges: EdgeRow[] = [];
  const link = (a: string, b: string, t: string) =>
    edges.push({ id: `${graphId}-e${edges.length}`, s: a, t: b, type: t, weight: 0.5 + (edges.length % 5) / 10 });
  for (let i = 0; i + 1 < size; i++) link(nodes[i].id, nodes[i + 1].id, 'DEPENDS_ON');
  let extra = Math.round(size * 1.4) - edges.length;
  for (let i = 0; i < size && extra > 0; i++) {
    const jump = 2 + ((i * 5) % Math.max(2, Math.floor(size / 4)));
    const j = i + jump;
    if (j < size) { link(nodes[i].id, nodes[j].id, EDGE_TYPES[i % EDGE_TYPES.length]); extra--; }
  }
  return { nodes, edges };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Demo graph ids (overview + every sub-graph) — for a clean force-reseed. */
function demoGraphIds(): string[] {
  return [OVERVIEW_GRAPH_ID, ...SUBSYSTEMS.map((s) => `subgraph-${s.key}-shared`)];
}

/** Tear down the demo (edges → work items → graphs, in that order so we never
 *  leave orphan edges). Used by the --force reseed path. */
export async function deleteHierarchyDemo(driver: Driver): Promise<void> {
  const session = driver.session();
  const ids = demoGraphIds();
  try {
    await session.run(
      `UNWIND $ids AS gid
       MATCH (g:Graph {id: gid})<-[:BELONGS_TO]-(w:WorkItem)
       OPTIONAL MATCH (w)<-[:EDGE_SOURCE|EDGE_TARGET]-(e:Edge)
       DETACH DELETE e`,
      { ids }
    );
    await session.run(
      `UNWIND $ids AS gid
       MATCH (g:Graph {id: gid})<-[:BELONGS_TO]-(w:WorkItem)
       DETACH DELETE w`,
      { ids }
    );
    await session.run(`UNWIND $ids AS gid MATCH (g:Graph {id: gid}) DETACH DELETE g`, { ids });
    console.log(`🗑️  Removed previous hierarchy demo (${ids.length} graphs)`);
  } finally {
    await session.close();
  }
}

export async function hierarchyDemoExists(driver: Driver): Promise<boolean> {
  const session = driver.session();
  try {
    const r = await session.run(`MATCH (g:Graph {id: $id}) RETURN count(g) > 0 AS exists`, { id: OVERVIEW_GRAPH_ID });
    return r.records[0]?.get('exists') ?? false;
  } finally {
    await session.close();
  }
}

async function createGraphNode(session: any, params: {
  id: string; name: string; description: string; type: string; depth: number; path: string[]; parentGraphId: string | null; nodeCount: number; edgeCount: number; tags: string[];
}) {
  await session.run(
    `CREATE (g:Graph {
       id: $id, name: $name, description: $description, type: $type, status: 'ACTIVE',
       teamId: null, createdBy: 'system', tags: $tags, defaultRole: 'VIEWER',
       parentGraphId: $parentGraphId, depth: $depth, path: $path, isShared: true,
       nodeCount: $nodeCount, edgeCount: $edgeCount, contributorCount: 0,
       lastActivity: datetime(), settings: '{}',
       permissions: '{"public":"read","authenticated":"read"}',
       shareSettings: '{"public":true,"readOnly":true}',
       createdAt: datetime(), updatedAt: datetime()
     })`,
    params
  );
}

async function insertNodesAndEdges(session: any, graphId: string, nodes: NodeRow[], edges: EdgeRow[]) {
  for (const batch of chunk(nodes, 500)) {
    await session.run(
      `MATCH (g:Graph {id: $graphId})
       UNWIND $nodes AS n
       CREATE (w:WorkItem {
         id: n.id, type: n.type, title: n.title, description: n.description, status: n.status,
         positionX: toFloat(n.x), positionY: toFloat(n.y), positionZ: 0.0,
         radius: 1.0, theta: 0.0, phi: 0.0, priority: toFloat(n.priority), priorityComp: 0.0,
         tags: [], metadata: '{}', createdAt: datetime(), updatedAt: datetime()
       })
       CREATE (w)-[:BELONGS_TO]->(g)`,
      { graphId, nodes: batch }
    );
  }
  for (const batch of chunk(edges, 700)) {
    await session.run(
      `UNWIND $edges AS ed
       MATCH (s:WorkItem {id: ed.s}), (t:WorkItem {id: ed.t})
       CREATE (e:Edge { id: ed.id, type: ed.type, weight: toFloat(ed.weight), metadata: '{}', createdAt: datetime() })
       CREATE (e)-[:EDGE_SOURCE]->(s)
       CREATE (e)-[:EDGE_TARGET]->(t)`,
      { edges: batch }
    );
  }
}

export async function createHierarchyDemo(driver: Driver): Promise<{ graphs: number; nodes: number; edges: number }> {
  const session = driver.session();
  let totalNodes = 0;
  let totalEdges = 0;
  try {
    console.log('🏗️  Building hierarchical "graphs of graphs" demo...');

    // 1) Build + populate each sub-graph.
    for (const sub of SUBSYSTEMS) {
      const subId = `subgraph-${sub.key}-shared`;
      const { nodes, edges } = buildSubgraph(subId, sub.size);
      await createGraphNode(session, {
        id: subId,
        name: sub.name,
        description: `${sub.name} — a sub-sheet of the System Overview (${sub.size} work items).`,
        type: 'SUBGRAPH',
        depth: 1,
        path: [OVERVIEW_GRAPH_ID],
        parentGraphId: OVERVIEW_GRAPH_ID,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        tags: ['demo', 'subgraph', sub.key],
      });
      await insertNodesAndEdges(session, subId, nodes, edges);
      totalNodes += nodes.length;
      totalEdges += edges.length;
      console.log(`   • ${sub.name}: ${nodes.length} nodes / ${edges.length} edges`);
    }

    // 2) Overview graph: one sheet symbol per subsystem.
    const sheetPos = gridPositions(SUBSYSTEMS.length, 320);
    const sheets = SUBSYSTEMS.map((sub, i) => ({
      id: `${OVERVIEW_GRAPH_ID}-sheet-${sub.key}`,
      subgraphId: `subgraph-${sub.key}-shared`,
      title: sub.name,
      description: `Drill in to open the ${sub.name} sub-graph (${sub.size} work items).`,
      x: sheetPos[i].x,
      y: sheetPos[i].y,
    }));
    // Inter-sheet "wires": backbone chain + a few cross links (both endpoints in overview).
    const sheetEdges: EdgeRow[] = [];
    const wire = (a: string, b: string, t: string) =>
      sheetEdges.push({ id: `${OVERVIEW_GRAPH_ID}-w${sheetEdges.length}`, s: a, t: b, type: t, weight: 0.8 });
    for (let i = 0; i + 1 < sheets.length; i++) wire(sheets[i].id, sheets[i + 1].id, 'DEPENDS_ON');
    for (let i = 0; i + 3 < sheets.length; i += 3) wire(sheets[i].id, sheets[i + 3].id, 'RELATES_TO');

    await createGraphNode(session, {
      id: OVERVIEW_GRAPH_ID,
      name: 'System Overview',
      description: 'Top-level overview — each node is a sub-sheet. Click a node to drill into its sub-graph (Altium-style hierarchy).',
      type: 'PROJECT',
      depth: 0,
      path: [],
      parentGraphId: null,
      nodeCount: sheets.length,
      edgeCount: sheetEdges.length,
      tags: ['demo', 'overview', 'hierarchy'],
    });

    // Sheet WorkItems with subgraphId + DRILLS_INTO to their sub-graph.
    await session.run(
      `MATCH (g:Graph {id: $overviewId})
       UNWIND $sheets AS sh
       MATCH (sub:Graph {id: sh.subgraphId})
       CREATE (w:WorkItem {
         id: sh.id, type: 'OUTCOME', title: sh.title, description: sh.description, status: 'IN_PROGRESS',
         positionX: toFloat(sh.x), positionY: toFloat(sh.y), positionZ: 0.0,
         radius: 1.0, theta: 0.0, phi: 0.0, priority: 0.8, priorityComp: 0.0,
         tags: ['sheet'], metadata: '{}', subgraphId: sh.subgraphId,
         createdAt: datetime(), updatedAt: datetime()
       })
       CREATE (w)-[:BELONGS_TO]->(g)
       CREATE (w)-[:DRILLS_INTO]->(sub)
       CREATE (g)-[:PARENT_OF]->(sub)`,
      { overviewId: OVERVIEW_GRAPH_ID, sheets }
    );
    // Inter-sheet wires.
    await session.run(
      `UNWIND $edges AS ed
       MATCH (s:WorkItem {id: ed.s}), (t:WorkItem {id: ed.t})
       CREATE (e:Edge { id: ed.id, type: ed.type, weight: toFloat(ed.weight), metadata: '{}', createdAt: datetime() })
       CREATE (e)-[:EDGE_SOURCE]->(s)
       CREATE (e)-[:EDGE_TARGET]->(t)`,
      { edges: sheetEdges }
    );
    totalNodes += sheets.length;
    totalEdges += sheetEdges.length;

    console.log(`✅ Hierarchy demo: ${SUBSYSTEMS.length + 1} graphs, ${totalNodes} work items, ${totalEdges} edges`);
    return { graphs: SUBSYSTEMS.length + 1, nodes: totalNodes, edges: totalEdges };
  } finally {
    await session.close();
  }
}
