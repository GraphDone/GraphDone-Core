import { describe, it, expect, beforeAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';

// AI-6 (docs/USER_STORIES.md): get_graph_context returns a compact,
// token-efficient orientation summary so an agent can orient in one call.
describe('getGraphContext (AI-6)', () => {
  let graphService: GraphService;

  beforeAll(() => {
    graphService = new GraphService(createMockDriver());
  });

  it('returns counts by type and status, top blockers and recent activity', async () => {
    const result = await graphService.getGraphContext({ graphId: 'test-graph-id' });
    const content = JSON.parse(result.content[0].text);

    expect(content.context).toBeDefined();
    const ctx = content.context;

    expect(ctx.graph.id).toBe('test-graph-id');
    expect(ctx.graph.name).toBeDefined();

    expect(ctx.counts.byType).toBeTypeOf('object');
    expect(ctx.counts.byStatus).toBeTypeOf('object');
    expect(ctx.counts.nodes).toBeTypeOf('number');
    expect(ctx.counts.edges).toBeTypeOf('number');

    expect(Array.isArray(ctx.topBlockers)).toBe(true);
    expect(Array.isArray(ctx.recentActivity)).toBe(true);
  });

  it('keeps blockers and recent activity compact (id, title, small fields only)', async () => {
    const result = await graphService.getGraphContext({ graphId: 'test-graph-id' });
    const ctx = JSON.parse(result.content[0].text).context;

    for (const blocker of ctx.topBlockers) {
      expect(blocker.id).toBeDefined();
      expect(blocker.title).toBeDefined();
      expect(blocker.blocksCount).toBeTypeOf('number');
      expect(blocker.description).toBeUndefined();
    }
    for (const item of ctx.recentActivity) {
      expect(item.id).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.status).toBeDefined();
      expect(item.description).toBeUndefined();
    }
  });

  it('stays under 2kB for any graph (the token-efficiency contract)', async () => {
    const result = await graphService.getGraphContext({ graphId: 'test-graph-id' });
    expect(result.content[0].text.length).toBeLessThan(2048);
  });

  it('throws a not-found error for a missing graph', async () => {
    await expect(graphService.getGraphContext({ graphId: 'missing-graph-id' })).rejects.toThrow(/not found/i);
  });
});
