import { describe, expect, it } from 'vitest';
import { graphProtectionResolvers } from '../src/resolvers/graph-protection';

type Rows = Array<Record<string, unknown>>;

/** A Neo4j driver that answers the "graphs inside" check with `inside` and records every query. */
function fakeDriver(inside: Rows) {
  const queries: Array<{ query: string; params: Record<string, unknown> }> = [];
  const records = (rows: Rows) => rows.map(row => ({ get: (key: string) => row[key] }));
  const driver = {
    session: () => ({
      run: async (query: string, params: Record<string, unknown>) => {
        queries.push({ query, params });
        if (query.includes('$protectedIds')) return { records: records([{ isProtected: false }]) };
        if (query.includes('PARENT_OF')) return { records: records(inside) };
        return { records: records([{ nodesDeleted: { toNumber: () => 1 } }]) };
      },
      close: async () => {},
    }),
  };
  return { driver, queries, deleted: () => queries.some(({ query }) => query.includes('DETACH DELETE')) };
}

const deleteGraphs = (where: { id?: string; id_IN?: string[] }, driver: unknown) =>
  graphProtectionResolvers.Mutation.deleteGraphs(null, { where }, { driver: driver as never, user: { userId: 'owner', role: 'USER' } });

describe('deleting a graph that still holds graphs', () => {
  it('is refused on the server, so a tab with a stale list cannot leave graphs without their project', async () => {
    const db = fakeDriver([{ name: 'Home', inside: { toNumber: () => 2 } }]);
    await expect(deleteGraphs({ id: 'home' }, db.driver)).rejects.toMatchObject({
      message: 'Home holds 2 graphs. Delete or move them first.',
      extensions: { code: 'FAILED_PRECONDITION', graphsInside: 2 },
    });
    expect(db.deleted(), 'nothing is deleted').toBe(false);
  });

  it('checks the graphs inside against the whole list being deleted, for the owner only', async () => {
    const db = fakeDriver([]);
    await expect(deleteGraphs({ id_IN: ['home', 'move-house'] }, db.driver)).resolves.toEqual({ nodesDeleted: 1 });
    const check = db.queries.find(({ query }) => query.includes('PARENT_OF'))!;
    expect(check.query).toContain('NOT c.id IN $ids');
    expect(check.query).toContain('c.parentGraphId = g.id');
    expect(check.params).toEqual({ ids: ['home', 'move-house'], userId: 'owner' });
    expect(db.deleted()).toBe(true);
  });

  it('deletes an empty graph as before', async () => {
    const db = fakeDriver([]);
    await expect(deleteGraphs({ id: 'ideas' }, db.driver)).resolves.toEqual({ nodesDeleted: 1 });
    expect(db.deleted()).toBe(true);
  });
});
