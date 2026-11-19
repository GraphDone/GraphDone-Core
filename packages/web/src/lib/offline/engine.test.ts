import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAccount, type Account, type Snapshot } from './model';

const fixture = vi.hoisted(() => ({ account: null as Account | null, token: 'local-guest', readBarrier: undefined as Promise<void> | undefined }));
vi.mock('./store', () => ({
  channel: null,
  readAccount: async () => {
    await fixture.readBarrier;
    return structuredClone(fixture.account);
  },
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

import { getProject, importOffline } from './engine';

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

  it('remaps only declared portable metadata node references and preserves semantic paths', async () => {
    const source = snapshot('system');
    source.nodes.push({ ...source.nodes[0], id: 'service', title: '支払 / Paiements', metadata: JSON.stringify({ lod: { groupPath: ['システム / System', '支払 / Paiements'] } }) });
    source.nodes[0].metadata = JSON.stringify({
      lod: { groupPath: ['システム / System'] },
      graphdone: { portable: { version: 1, nodeRefs: { sourceItem: 'service' } } },
      unrelated: { value: 'service' },
    });

    await importOffline(backup(source));
    const copy = Object.values(fixture.account!.projects)[0].local!;
    const importedSystem = copy.nodes.find(node => node.title === 'system task')!;
    const importedService = copy.nodes.find(node => node.title === '支払 / Paiements')!;
    const metadata = JSON.parse(importedSystem.metadata);
    expect(metadata.lod.groupPath).toEqual(['システム / System']);
    expect(metadata.graphdone.portable).toEqual({ version: 1, nodeRefs: { sourceItem: importedService.id } });
    expect(metadata.unrelated.value).toBe('service');
  });

  it.each([
    { version: 2, nodeRefs: { sourceItem: 'service' } },
    { version: 1, nodeRefs: { sourceItem: 'missing' } },
    { version: 1, nodeRefs: { sourceItem: 42 } },
  ])('rejects malformed or unresolved declared metadata references atomically: %j', async portable => {
    const source = snapshot('system');
    source.nodes[0].metadata = JSON.stringify({ graphdone: { portable } });
    await expect(importOffline(backup(source))).rejects.toThrow(/portable metadata reference/i);
    expect(fixture.account!.projects).toEqual({});
  });
});

it('fetches a fresh project when manual refresh overlaps a cache read', async () => {
  fixture.token = signedIn;
  fixture.account = emptyAccount();
  const cached = snapshot('project');
  fixture.account.projects.project = { base: cached, local: cached, checkedAt: Date.now() };
  const remote = snapshot('project', { name: 'Reviewed by owner' });
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ snapshot: remote })));
  vi.stubGlobal('fetch', fetch);
  let release!: () => void;
  fixture.readBarrier = new Promise(resolve => { release = resolve; });
  try {
    const reading = getProject('project');
    const refreshing = getProject('project', true);
    const alsoRefreshing = getProject('project', true);
    release();
    await reading;
    for (const project of await Promise.all([refreshing, alsoRefreshing])) {
      expect(project.project.name).toBe('Reviewed by owner');
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    release();
    fixture.readBarrier = undefined;
    vi.unstubAllGlobals();
  }
});

it('retains the cached project and retry deadline when an explicit download is rate limited', async () => {
  fixture.token = signedIn;
  fixture.account = emptyAccount();
  const cached = snapshot('paused');
  fixture.account.projects.paused = { base: cached, local: cached, checkedAt: Date.now() };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Please wait' }), {
    status: 429, headers: { 'Retry-After': '180' },
  }));
  vi.stubGlobal('fetch', fetch);
  try {
    await expect(getProject('paused', true)).rejects.toThrow('Please wait');
    expect(fixture.account.retryAt).toBeGreaterThan(Date.now() + 120000);
    expect(await getProject('paused', true)).toEqual(cached);
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
