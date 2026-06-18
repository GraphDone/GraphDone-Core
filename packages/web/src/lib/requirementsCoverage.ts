export const SATISFIES_EDGE_TYPE = 'SATISFIES';
export const REQUIREMENT_WORK_ITEM_TYPE = 'REQUIREMENT';

export interface CoverageWorkItem {
  id: string;
  title?: string | null;
  type?: string | null;
  status?: string | null;
}

type EdgeEndpoint = string | { id: string; title?: string | null; type?: string | null };

export interface CoverageEdge {
  id: string;
  type: string;
  source: EdgeEndpoint;
  target: EdgeEndpoint;
}

export interface RequirementCoverage {
  requirement: CoverageWorkItem;
  satisfyingTasks: CoverageWorkItem[];
  count: number;
}

const idOf = (endpoint: EdgeEndpoint): string =>
  typeof endpoint === 'string' ? endpoint : endpoint.id;

const toWorkItem = (endpoint: EdgeEndpoint): CoverageWorkItem =>
  typeof endpoint === 'string'
    ? { id: endpoint, title: endpoint }
    : { id: endpoint.id, title: endpoint.title, type: endpoint.type };

export function groupSatisfyingTasks(
  requirements: CoverageWorkItem[],
  tasks: CoverageWorkItem[],
  edges: CoverageEdge[]
): RequirementCoverage[] {
  const tasksById = new Map<string, CoverageWorkItem>();
  for (const t of tasks) {
    tasksById.set(t.id, t);
  }

  const satisfiesEdges = edges.filter((e) => e.type === SATISFIES_EDGE_TYPE);

  return requirements.map((requirement) => {
    const satisfyingTasks: CoverageWorkItem[] = [];
    const seen = new Set<string>();

    for (const edge of satisfiesEdges) {
      if (idOf(edge.target) !== requirement.id) continue;
      const sourceId = idOf(edge.source);
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      satisfyingTasks.push(tasksById.get(sourceId) ?? toWorkItem(edge.source));
    }

    return { requirement, satisfyingTasks, count: satisfyingTasks.length };
  });
}
