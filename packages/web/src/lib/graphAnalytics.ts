export interface AnalyticsItem {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: number;
  updatedAt: string;
  contributors?: { id: string; name: string; type: string }[];
}

export const boundedPriority = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** A snapshot of actual work, not historical votes or inferred completion dates. */
export function summarizeGraph(items: AnalyticsItem[]) {
  const statuses: Record<string, number> = {};
  const people = new Map<
    string,
    { id: string; name: string; type: string; items: number }
  >();
  for (const item of items) {
    statuses[item.status] = (statuses[item.status] || 0) + 1;
    for (const person of new Map(
      (item.contributors || []).map(p => [p.id, p])
    ).values()) {
      const existing = people.get(person.id);
      people.set(person.id, { ...person, items: (existing?.items || 0) + 1 });
    }
  }
  const completed = statuses.COMPLETED || 0;
  return {
    total: items.length,
    completed,
    blocked: statuses.BLOCKED || 0,
    completion: items.length ? completed / items.length : 0,
    averagePriority: items.length
      ? items.reduce((sum, i) => sum + boundedPriority(i.priority), 0) /
        items.length
      : 0,
    statuses,
    priorities: items
      .filter(i => !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(i.status))
      .sort(
        (a, b) =>
          boundedPriority(b.priority) - boundedPriority(a.priority) ||
          a.title.localeCompare(b.title)
      ),
    contributors: [...people.values()].sort(
      (a, b) => b.items - a.items || a.name.localeCompare(b.name)
    ),
  };
}
