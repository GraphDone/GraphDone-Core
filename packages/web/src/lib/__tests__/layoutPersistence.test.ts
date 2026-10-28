import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAccount, type Account } from '../offline/model';
import { acknowledgeLayout, MAX_LAYOUT_POSITIONS, persistLayout as persistWithGeneration, readLayout, readLayoutSnapshot } from '../layoutPersistence';
import type { LayoutReceipt } from '../positionSaveQueue';

const fixture = vi.hoisted(() => ({ accounts: new Map<string, Account>(), fail: false }));
vi.mock('../offline/store', () => ({
  readAccount: async (owner: string) => structuredClone(fixture.accounts.get(owner) || emptyAccount()),
  editAccount: async (owner: string, edit: (account: Account) => unknown) => {
    const account = structuredClone(fixture.accounts.get(owner) || emptyAccount());
    const result = edit(account);
    if (fixture.fail) throw new DOMException('Owned quota failure', 'QuotaExceededError');
    fixture.accounts.set(owner, account);
    return result;
  },
}));

const persistLayout = async (owner: string, graph: string, positions: LayoutReceipt[]) => persistWithGeneration(owner, graph, positions, (await readLayoutSnapshot(owner, graph)).generation);
const position = (id = 'task', revision = 'first', x = 1): LayoutReceipt => ({ id, revision, x, y: 2, updatedAt: 1000 });
beforeEach(() => { fixture.accounts.clear(); fixture.fail = false; });

describe('account-scoped layout receipts', () => {
  it('does not conflict with an unrelated graph before any fence eviction', async () => {
    const unopened = await readLayoutSnapshot('owner', 'first-graph');
    await persistLayout('owner', 'second-graph', [position()]);
    await acknowledgeLayout('owner', 'second-graph', [position()]);
    await expect(persistWithGeneration('owner', 'first-graph', [position()], unopened.generation)).resolves.toBeGreaterThan(0);
  });

  it('retains its generation after acknowledgement and rejects a stale staged commit', async () => {
    const before = await readLayoutSnapshot('owner', 'graph');
    const value = position();
    const committed = await persistWithGeneration('owner', 'graph', [value], before.generation);
    await acknowledgeLayout('owner', 'graph', [value]);
    expect(await readLayoutSnapshot('owner', 'graph')).toEqual({ generation: committed, positions: [] });
    await expect(persistWithGeneration('owner', 'graph', [position('task', 'stale', 99)], before.generation)).rejects.toThrow('Another tab');
    expect(await readLayout('owner', 'graph')).toEqual([]);
  });

  it('keeps a monotonic fallback when bounded graph fences are evicted', async () => {
    await persistLayout('owner', 'old-graph', [position()]);
    const previous = (await readLayoutSnapshot('owner', 'old-graph')).generation;
    await acknowledgeLayout('owner', 'old-graph', [position()]);
    for (let index = 0; index < 20; index++) {
      await persistLayout('owner', `new-${index}`, [position()]);
      await acknowledgeLayout('owner', `new-${index}`, [position()]);
    }
    expect(Object.keys(fixture.accounts.get('owner')!.layoutFences!.graphs)).toHaveLength(16);
    expect((await readLayoutSnapshot('owner', 'old-graph')).generation).toBeGreaterThan(previous);
    await expect(persistWithGeneration('owner', 'old-graph', [position('task', 'stale')], previous)).rejects.toThrow('Another tab');
  });

  it('advances the fence on explicit discard but not on a stale acknowledgement', async () => {
    await persistLayout('owner', 'graph', [position()]);
    const before = (await readLayoutSnapshot('owner', 'graph')).generation;
    await acknowledgeLayout('owner', 'graph', [position('task', 'wrong')], true);
    expect((await readLayoutSnapshot('owner', 'graph')).generation).toBe(before);
    await acknowledgeLayout('owner', 'graph', [position()], true);
    expect((await readLayoutSnapshot('owner', 'graph')).generation).toBeGreaterThan(before);
    await expect(persistWithGeneration('owner', 'graph', [position('task', 'stale')], before)).rejects.toThrow('Another tab');
  });

  it('fails explicitly on corrupt or exhausted generation counters', async () => {
    for (const counter of [-1, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      fixture.accounts.set('owner', { ...emptyAccount(), layoutFences: { version: 1, counter, floor: 0, graphs: {} } });
      await expect(readLayoutSnapshot('owner', 'graph')).rejects.toThrow('revision is invalid');
    }
    const account = { ...emptyAccount(), layoutFences: { version: 1 as const, counter: Number.MAX_SAFE_INTEGER, floor: Number.MAX_SAFE_INTEGER, graphs: {} } };
    fixture.accounts.set('owner', account);
    await expect(persistWithGeneration('owner', 'graph', [position()], Number.MAX_SAFE_INTEGER)).rejects.toThrow('revision limit');
    expect(fixture.accounts.get('owner')).toEqual(account);
  });

  it('does not let a late acknowledgement erase a newer persisted position', async () => {
    const older = position(), newer = position('task', 'second', 9);
    await persistLayout('owner', 'graph', [older]);
    await persistLayout('owner', 'graph', [newer]);
    await acknowledgeLayout('owner', 'graph', [older]);
    expect(await readLayout('owner', 'graph')).toEqual([newer]);
    await acknowledgeLayout('owner', 'graph', [newer]);
    expect(await readLayout('owner', 'graph')).toEqual([]);
    expect(fixture.accounts.get('owner')?.layoutOutbox).toBeUndefined();
  });

  it('isolates identical item IDs by account and graph, including special object keys', async () => {
    await persistLayout('owner-a', '__proto__', [position('__proto__')]);
    await persistLayout('owner-a', 'other', [position('__proto__', 'other', 4)]);
    await persistLayout('owner-b', '__proto__', [position('__proto__', 'account-b', 8)]);
    await acknowledgeLayout('owner-a', '__proto__', [position('__proto__')]);
    expect(await readLayout('owner-a', '__proto__')).toEqual([]);
    expect((await readLayout('owner-a', 'other'))[0].x).toBe(4);
    expect((await readLayout('owner-b', '__proto__'))[0].x).toBe(8);
    expect(({} as Record<string, unknown>).revision).toBeUndefined();
  });

  it('retains existing data after a failed transaction or capacity rejection', async () => {
    await persistLayout('owner', 'graph', [position()]);
    fixture.fail = true;
    await expect(persistLayout('owner', 'graph', [position('task', 'new', 9)])).rejects.toThrow('Owned quota failure');
    expect(await readLayout('owner', 'graph')).toEqual([position()]);
    fixture.fail = false;
    const full = Array.from({ length: MAX_LAYOUT_POSITIONS }, (_, index) => position(`task-${index}`));
    await persistLayout('full-owner', 'graph', full);
    await expect(persistLayout('full-owner', 'other', [position()])).rejects.toThrow('10,000');
    expect(await readLayout('full-owner', 'graph')).toHaveLength(MAX_LAYOUT_POSITIONS);
    expect(await readLayout('full-owner', 'other')).toEqual([]);
  });

  it('rejects invalid coordinates and unsupported saved formats without erasing evidence', async () => {
    await expect(persistLayout('owner', 'graph', [{ ...position(), x: Infinity }])).rejects.toThrow('invalid');
    const unsupported = { ...emptyAccount(), layoutOutbox: { version: 99, graphs: {} } } as unknown as Account;
    fixture.accounts.set('owner', unsupported);
    await expect(readLayout('owner', 'graph')).rejects.toThrow('unsupported');
    await expect(persistLayout('owner', 'graph', [position()])).rejects.toThrow('unsupported');
    expect(fixture.accounts.get('owner')).toEqual(unsupported);
  });

  it('persists only coordinate receipts and preserves existing offline projects', async () => {
    const account = emptyAccount();
    account.list = [{ id: 'existing', name: 'Existing offline project' }];
    fixture.accounts.set('owner', account);
    const extra = { ...position(), authToken: 'must-not-be-stored' };
    await persistLayout('owner', 'graph', [extra]);
    expect(fixture.accounts.get('owner')?.list).toEqual(account.list);
    expect(JSON.stringify(fixture.accounts.get('owner'))).not.toContain('authToken');
  });
});
