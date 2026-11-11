import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable } from '@apollo/client';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RelationshipEditorWindow } from './RelationshipEditorWindow';
import type { WorkItemEdge } from '../types/graph';

type Row = { id: string; type: string; weight: number; source: string; target: string };
const items = [{ id: 'a', title: 'Plan' }, { id: 'b', title: 'Do' }];

/** An edge store behind an Apollo link: what the server or the offline link would answer. */
function backend(options: { failDelete?: string; holdUpdates?: boolean } = {}) {
  const rows = new Map<string, Row>([['e1', { id: 'e1', type: 'BLOCKS', weight: 0.8, source: 'a', target: 'b' }]]);
  const log: string[] = [];
  const held: Array<() => void> = [];
  let next = 1;
  const item = (id: string) => ({ __typename: 'WorkItem', id, title: items.find(i => i.id === id)!.title, type: 'TASK' });
  const edge = (row: Row) => ({ __typename: 'Edge', id: row.id, type: row.type, weight: row.weight, metadata: null, createdAt: '2026-11-10T00:00:00Z', createdBy: null, source: item(row.source), target: item(row.target) });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(operation => new Observable(observer => {
      const v = operation.variables as any;
      const finish = (data: Record<string, unknown>) => { observer.next({ data }); observer.complete(); };
      switch (operation.operationName) {
        case 'GetRelationship': finish({ edges: rows.has(v.where.id) ? [edge(rows.get(v.where.id)!)] : [] }); break;
        case 'GetEdges': finish({ edges: [...rows.values()].map(edge) }); break;
        case 'GetWorkItems': finish({ workItems: [] }); break;
        case 'UpdateEdges': {
          const run = () => {
            log.push(`update ${v.where.id} ${v.update.type}`);
            const row = rows.get(v.where.id);
            if (row) Object.assign(row, v.update);
            finish({ updateEdges: { __typename: 'UpdateEdgesMutationResponse', edges: row ? [edge(row)] : [] } });
          };
          if (options.holdUpdates) held.push(run); else run();
          break;
        }
        case 'CreateEdges': {
          const input = v.input[0];
          const row = { id: `n${next++}`, type: input.type, weight: input.weight, source: input.source.connect.where.node.id, target: input.target.connect.where.node.id };
          log.push(`create ${row.source}>${row.target} ${row.type} ${row.weight}`);
          rows.set(row.id, row);
          finish({ createEdges: { __typename: 'CreateEdgesMutationResponse', edges: [edge(row)] } });
          break;
        }
        case 'DeleteEdges': {
          log.push(`delete ${v.where.id}`);
          if (options.failDelete === v.where.id) { observer.error(new Error('Delete refused')); break; }
          rows.delete(v.where.id);
          finish({ deleteEdges: { __typename: 'DeleteInfo', nodesDeleted: 1 } });
          break;
        }
        default: observer.error(new Error(`unexpected ${operation.operationName}`));
      }
    })),
  });
  return { client, rows, log, held };
}

/** The editor as the graph hosts it: open while an edge is edited, following saved changes. */
function Host({ initial, onClosed }: { initial: WorkItemEdge; onClosed: () => void }) {
  const [editing, setEditing] = useState<{ edge: WorkItemEdge; position: { x: number; y: number } } | null>({ edge: initial, position: { x: 100, y: 100 } });
  return (
    <RelationshipEditorWindow
      editingEdge={editing}
      workItems={items}
      onClose={() => { setEditing(null); onClosed(); }}
      onEdgeChange={(edge, previousId) => setEditing(prev => (prev && prev.edge.id === previousId ? { edge, position: prev.position } : prev))}
      onDeleteEdge={() => setEditing(null)}
      showSuccess={() => undefined}
      showError={(title, message) => { document.body.dataset.lastError = `${title}: ${message}`; }}
    />
  );
}

function open(b: ReturnType<typeof backend>, onClosed = vi.fn()) {
  delete document.body.dataset.lastError;
  render(<ApolloProvider client={b.client}><Host initial={{ id: 'e1', source: 'a', target: 'b', type: 'BLOCKS' }} onClosed={onClosed} /></ApolloProvider>);
  return screen.getByRole('dialog', { name: 'Edit relationship' });
}

const pressed = () => screen.getAllByRole('button', { pressed: true }).map(b => b.textContent);

describe('RelationshipEditorWindow', () => {
  it('a type change presses the saved type and keeps editing the same relationship', async () => {
    const b = backend();
    open(b);
    fireEvent.click(screen.getByRole('button', { name: 'Enables' }));
    await waitFor(() => expect(pressed()).toEqual(['Enables']));
    expect(screen.getByText('Editing relationship: Plan → Do')).toBeInTheDocument();
    expect([...b.rows.values()]).toEqual([{ id: 'e1', type: 'ENABLES', weight: 0.8, source: 'a', target: 'b' }]);
  });

  it('a flip stays in the edit editor on the reversed relationship, with the current type and weight', async () => {
    const b = backend();
    open(b);
    fireEvent.click(screen.getByRole('button', { name: 'Enables' }));
    await waitFor(() => expect(pressed()).toEqual(['Enables']));
    fireEvent.click(screen.getByRole('button', { name: 'Flip Direction' }));
    await waitFor(() => expect(screen.getByText('Editing relationship: Do → Plan')).toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Edit relationship' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Create relationship' })).toBeNull();
    expect(pressed()).toEqual(['Enables']);
    expect(b.log).toEqual(['update e1 ENABLES', 'create b>a ENABLES 0.8', 'delete e1']);
    expect([...b.rows.values()]).toEqual([{ id: 'n1', type: 'ENABLES', weight: 0.8, source: 'b', target: 'a' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Flip Direction' }));
    await waitFor(() => expect(screen.getByText('Editing relationship: Plan → Do')).toBeInTheDocument());
    expect([...b.rows.values()]).toEqual([{ id: 'n2', type: 'ENABLES', weight: 0.8, source: 'a', target: 'b' }]);
  });

  it('a flip whose delete fails keeps the original and says so', async () => {
    const b = backend({ failDelete: 'e1' });
    open(b);
    fireEvent.click(screen.getByRole('button', { name: 'Flip Direction' }));
    await waitFor(() => expect(document.body.dataset.lastError).toBe('Flip Failed: Delete refused. The relationship was not changed.'));
    expect([...b.rows.values()]).toEqual([{ id: 'e1', type: 'BLOCKS', weight: 0.8, source: 'a', target: 'b' }]);
    expect(screen.getByText('Editing relationship: Plan → Do')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flip Direction' })).toBeEnabled();
  });

  it('ignores further changes while one is saving', async () => {
    const b = backend({ holdUpdates: true });
    open(b);
    fireEvent.click(screen.getByRole('button', { name: 'Enables' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Flip Direction' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Flip Direction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Depends On' }));
    await waitFor(() => expect(b.held).toHaveLength(1));
    b.held[0]();
    await waitFor(() => expect(pressed()).toEqual(['Enables']));
    expect(b.log).toEqual(['update e1 ENABLES']);
  });

  it('delete removes the relationship and closes the editor', async () => {
    const b = backend();
    const onClosed = vi.fn();
    open(b, onClosed);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Relationship' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(b.rows.size).toBe(0);
  });
});
