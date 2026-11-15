import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAccount, type Account, type Snapshot } from './model';

const fixture = vi.hoisted(() => ({ account: null as Account | null, token: 'local-guest' }));
vi.mock('./store', () => ({
  channel: null,
  readAccount: async () => structuredClone(fixture.account),
  editAccount: async (_owner: string, edit: (account: Account) => unknown) => {
    const account = structuredClone(fixture.account!);
    const result = edit(account);
    fixture.account = account;
    return result;
  },
}));
vi.mock('../authStorage', () => ({
  getToken: () => fixture.token,
  getUserRaw: () => JSON.stringify({ id: 'owner', role: 'USER' }),
}));

import { importOffline } from './engine';

const signedIn = `x.${btoa(JSON.stringify({ uid: 'owner' }))}.y`;
const snapshot = (id: string, project: Record<string, unknown> = {}): Snapshot => ({
  project: { id, name: id, owner_id: 'someone', ...project },
  nodes: [{ id: `${id}-task`, title: `${id} task`, type: 'TASK', status: 'PROPOSED', priority: 0, position_x: 0, position_y: 0, tags: '[]', metadata: '{}' }],
  edges: [],
  notes: [],
});
const backup = (...snapshots: Snapshot[]) => {
  const text = JSON.stringify({
    format: 'graphdone-offline-v1',
    account: { projects: Object.fromEntries(snapshots.map(s => [s.project.id, { base: null, local: s }])) },
  });
  return { size: text.length, text: async () => text } as unknown as File;
};
const imported = () => Object.values(fixture.account!.projects).map(p => p.local!.project);

describe('importing a backup with projects and their graphs', () => {
  beforeEach(() => {
    fixture.account = emptyAccount();
    fixture.token = 'local-guest';
  });

  it('gives a guest new ids and keeps each graph inside its imported project', async () => {
    await importOffline(backup(
      snapshot('p', { type: 'PROJECT', parent_id: null }),
      snapshot('g', { type: 'SUBGRAPH', parent_id: 'p' }),
      snapshot('old'),
    ));
    const rows = imported();
    const project = rows.find(r => r.name === 'p (imported)')!;
    const graph = rows.find(r => r.name === 'g')!;
    expect(project.id).not.toBe('p');
    expect(project).not.toHaveProperty('parent_id');
    expect(graph).toMatchObject({ type: 'SUBGRAPH', parent_id: project.id });
    expect(rows.find(r => r.name === 'old (imported)')).not.toHaveProperty('type');
  });

  it('imports nothing when a parent is missing or graphs form a cycle', async () => {
    await expect(importOffline(backup(snapshot('a'), snapshot('g', { type: 'SUBGRAPH', parent_id: 'missing' })))).rejects.toThrow(/Nothing was imported/);
    await expect(importOffline(backup(snapshot('a', { parent_id: 'b' }), snapshot('b', { parent_id: 'a' })))).rejects.toThrow(/Nothing was imported/);
    await expect(importOffline(backup(snapshot('a', { type: 'FOLDER' })))).rejects.toThrow(/Nothing was imported/);
    expect(fixture.account!.projects).toEqual({});
  });

  it('imports flat for a signed-in account, whose sync keeps no parent yet', async () => {
    fixture.token = signedIn;
    await importOffline(backup(snapshot('p', { type: 'PROJECT' }), snapshot('g', { type: 'SUBGRAPH', parent_id: 'p' })));
    const rows = imported();
    expect(rows.map(r => r.name).sort()).toEqual(['g (imported)', 'p (imported)']);
    for (const row of rows) {
      expect(row).not.toHaveProperty('parent_id');
      expect(row).not.toHaveProperty('type');
    }
  });
});
