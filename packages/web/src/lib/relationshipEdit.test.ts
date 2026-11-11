import { describe, expect, it } from 'vitest';
import { editorEdge, endpointId, flipRelationship, relationshipLine, reversedEdgeInput, savedRelationship, type SavedRelationship } from './relationshipEdit';

const original: SavedRelationship = { id: 'e1', type: 'BLOCKS', weight: 0.8, sourceId: 'a', targetId: 'b', metadata: null };

/** A store of saved relationships the flip works against, with optional failures. */
function store(options: { failCreate?: boolean; failRemove?: string[]; createWrong?: boolean; createNothing?: boolean } = {}) {
  const rows = new Map<string, SavedRelationship>([[original.id, { ...original }]]);
  const calls: string[] = [];
  let next = 1;
  return {
    rows, calls,
    ops: {
      async create(input: ReturnType<typeof reversedEdgeInput>) {
        calls.push(`create ${input.source.connect.where.node.id}>${input.target.connect.where.node.id} ${input.type} ${input.weight}`);
        if (options.failCreate) throw new Error('Network down');
        if (options.createNothing) return null;
        const row = {
          id: `n${next++}`, type: input.type, weight: input.weight,
          sourceId: options.createWrong ? input.target.connect.where.node.id : input.source.connect.where.node.id,
          targetId: options.createWrong ? input.source.connect.where.node.id : input.target.connect.where.node.id,
        };
        rows.set(row.id, row);
        return row;
      },
      async remove(id: string) {
        calls.push(`remove ${id}`);
        if (options.failRemove?.includes(id)) throw new Error(`Cannot delete ${id}`);
        rows.delete(id);
      },
    },
  };
}

describe('flipRelationship', () => {
  it('creates the reversed relationship first, then removes the original, keeping type and weight', async () => {
    const s = store();
    const outcome = await flipRelationship(original, s.ops);
    expect(s.calls).toEqual(['create b>a BLOCKS 0.8', 'remove e1']);
    expect(outcome).toEqual({ ok: true, edge: { id: 'n1', type: 'BLOCKS', weight: 0.8, sourceId: 'b', targetId: 'a' } });
    expect([...s.rows.values()]).toEqual([{ id: 'n1', type: 'BLOCKS', weight: 0.8, sourceId: 'b', targetId: 'a' }]);
  });

  it('flipping twice restores the original direction, type and weight', async () => {
    const s = store();
    const first = await flipRelationship(original, s.ops);
    if (!first.ok) throw new Error(first.message);
    const second = await flipRelationship(first.edge, s.ops);
    expect(second.ok && [second.edge.sourceId, second.edge.targetId, second.edge.type, second.edge.weight]).toEqual(['a', 'b', 'BLOCKS', 0.8]);
    expect(s.rows.size).toBe(1);
  });

  it('a failed create leaves the original untouched and says so', async () => {
    const s = store({ failCreate: true });
    const outcome = await flipRelationship(original, s.ops);
    expect(outcome).toEqual({ ok: false, message: 'Network down. The relationship was not changed.' });
    expect(s.calls).toEqual(['create b>a BLOCKS 0.8']);
    expect([...s.rows.keys()]).toEqual(['e1']);
  });

  it('a create that saves nothing leaves the original untouched', async () => {
    const s = store({ createNothing: true });
    const outcome = await flipRelationship(original, s.ops);
    expect(outcome.ok).toBe(false);
    expect([...s.rows.keys()]).toEqual(['e1']);
  });

  it('a create that saved the wrong direction is removed again and the original kept', async () => {
    const s = store({ createWrong: true });
    const outcome = await flipRelationship(original, s.ops);
    expect(outcome).toEqual({ ok: false, message: 'The reversed relationship was not saved. The relationship was not changed.' });
    expect(s.calls).toEqual(['create b>a BLOCKS 0.8', 'remove n1']);
    expect([...s.rows.keys()]).toEqual(['e1']);
  });

  it('when the original cannot be removed, the reversed copy is removed and the original kept', async () => {
    const s = store({ failRemove: ['e1'] });
    const outcome = await flipRelationship(original, s.ops);
    expect(outcome).toEqual({ ok: false, message: 'Cannot delete e1. The relationship was not changed.' });
    expect(s.calls).toEqual(['create b>a BLOCKS 0.8', 'remove e1', 'remove n1']);
    expect([...s.rows.keys()]).toEqual(['e1']);
  });

  it('when neither can be removed, it reports both directions', async () => {
    const s = store({ failRemove: ['e1', 'n1'] });
    const outcome = await flipRelationship(original, s.ops);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.message).toBe('Cannot delete e1. Both directions are now saved; delete the one you do not want.');
    expect(!outcome.ok && outcome.bothDirections?.id).toBe('n1');
    expect(s.rows.size).toBe(2);
  });

  it('refuses a relationship from an item to itself without writing', async () => {
    const s = store();
    const outcome = await flipRelationship({ ...original, targetId: 'a' }, s.ops);
    expect(outcome.ok).toBe(false);
    expect(s.calls).toEqual([]);
  });
});

describe('reversedEdgeInput', () => {
  it('swaps the ends and keeps type, weight and metadata', () => {
    expect(reversedEdgeInput({ ...original, metadata: '{"note":1}' })).toEqual({
      type: 'BLOCKS', weight: 0.8, metadata: '{"note":1}',
      source: { connect: { where: { node: { id: 'b' } } } },
      target: { connect: { where: { node: { id: 'a' } } } },
    });
    expect(reversedEdgeInput(original)).not.toHaveProperty('metadata');
  });
});

describe('savedRelationship and endpointId', () => {
  it('reads GraphQL edges whose ends are objects, and canvas edges whose ends are ids', () => {
    expect(savedRelationship({ id: 'e1', type: 'BLOCKS', weight: 0.8, source: { id: 'a', title: 'A' }, target: { id: 'b' } }))
      .toEqual({ id: 'e1', type: 'BLOCKS', weight: 0.8, sourceId: 'a', targetId: 'b', metadata: null });
    expect(savedRelationship({ id: 'e1', type: 'BLOCKS', source: 'a', target: 'b' })?.weight).toBe(1);
    expect(endpointId({ id: 'x', x: 3 })).toBe('x');
    expect(endpointId('y')).toBe('y');
  });

  it('rejects missing or incomplete edges', () => {
    for (const edge of [null, undefined, {}, { id: 'e1', type: 'BLOCKS', source: null, target: { id: 'b' } }, { id: '', type: 'BLOCKS', source: 'a', target: 'b' }, { id: 'e1', source: 'a', target: 'b' }]) {
      expect(savedRelationship(edge)).toBeNull();
    }
  });
});

describe('editorEdge and relationshipLine', () => {
  it('gives the editor the saved type and direction', () => {
    const edge = editorEdge({ ...original, sourceId: 'b', targetId: 'a' });
    expect(edge).toEqual({ id: 'e1', source: 'b', target: 'a', type: 'BLOCKS', strength: 0.8 });
    expect(relationshipLine(edge, [{ id: 'a', title: 'Plan' }, { id: 'b', title: 'Do' }])).toBe('Do → Plan');
    expect(relationshipLine({ source: { id: 'a' } as any, target: 'zzz' }, [{ id: 'a', title: 'Plan' }])).toBe('Plan → Unknown');
  });
});
