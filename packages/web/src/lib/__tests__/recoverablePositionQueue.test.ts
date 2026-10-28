import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { emptyAccount, type Account } from '../offline/model';
import { createRecoverablePositionQueue } from '../recoverablePositionQueue';
import type { PositionSave } from '../positionSaveQueue';
import { readLayout } from '../layoutPersistence';

const fixture = vi.hoisted(() => ({ accounts: new Map<string, Account>(), fail: false, transaction: Promise.resolve(), beforeCommit: undefined as (() => Promise<void>) | undefined }));
vi.mock('../offline/store', () => ({
  readAccount: async (owner: string) => {
    await fixture.transaction;
    return structuredClone(fixture.accounts.get(owner) || emptyAccount());
  },
  editAccount: (owner: string, edit: (account: Account) => unknown) => {
    const operation = fixture.transaction.then(async () => {
      const account = structuredClone(fixture.accounts.get(owner) || emptyAccount());
      const result = edit(account);
      await fixture.beforeCommit?.();
      if (fixture.fail) throw new DOMException('Owned device write failure', 'QuotaExceededError');
      fixture.accounts.set(owner, account);
      return result;
    });
    fixture.transaction = operation.then(() => undefined, () => undefined);
    return operation;
  },
}));

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
const make = async (save = vi.fn().mockResolvedValue(undefined)) => {
  const queue = createRecoverablePositionQueue({ ownerId: 'owner', graphId: 'graph', networkBacked: true, save, onChange() {} });
  await waitFor(() => expect(queue.state.recovered).toBe(true));
  return queue;
};
beforeEach(() => {
  fixture.accounts.clear();
  fixture.fail = false;
  fixture.transaction = Promise.resolve();
  fixture.beforeCommit = undefined;
  const locks = new Map<string, Promise<unknown>>();
  vi.stubGlobal('navigator', { locks: {
    request: (name: string, _options: unknown, action: () => Promise<unknown>) => {
      const operation = (locks.get(name) || Promise.resolve()).catch(() => undefined).then(action);
      locks.set(name, operation.catch(() => undefined));
      return operation;
    },
  } });
});
afterEach(() => vi.unstubAllGlobals());

describe('recoverable layout ordering', () => {
  it('does not let a volatile quota-failed edit establish fresh eligibility after another tab saved', async () => {
    let server = 0;
    const oldSave = vi.fn(async ({ x }: PositionSave) => { server = x; });
    const old = await make(oldSave);
    fixture.fail = true;
    old.queue('task', 10, 2);
    await expect(old.flush()).rejects.toThrow('Owned device write failure');
    fixture.fail = false;
    const fresh = await make(vi.fn(async ({ x }: PositionSave) => { server = x; }));
    fresh.queue('task', 20, 2);
    await fresh.flush();
    expect(server).toBe(20);
    await expect(old.flush()).rejects.toThrow(/another tab|conflict/i);
    expect(server).toBe(20);
    expect(oldSave).not.toHaveBeenCalled();
    expect(old.state).toMatchObject({ pending: 1, local: 0 });
    expect(old.state.positions.get('task')?.x).toBe(10);
  });

  it('does not replay an older tab receipt after another tab saves a newer position', async () => {
    let offline = true;
    let server = 0;
    const oldSave = vi.fn(async ({ x }: PositionSave) => { if (offline) throw Error('owned outage'); server = x; });
    const old = await make(oldSave);
    old.queue('task', 10, 2);
    await expect(old.flush()).rejects.toThrow('owned outage');
    const fresh = await make(vi.fn(async ({ x }: PositionSave) => { server = x; }));
    fresh.queue('task', 20, 2);
    await fresh.flush();
    expect(await readLayout('owner', 'graph')).toEqual([]);
    offline = false;
    await old.flush();
    expect(server).toBe(20);
    expect(oldSave).toHaveBeenCalledTimes(1);
    expect(old.state.pending).toBe(0);
  });

  it('retries receipt cleanup without sending an already accepted position again', async () => {
    let server = 0;
    const save = vi.fn(async ({ x }: PositionSave) => { server = x; fixture.fail = true; });
    const queue = await make(save);
    queue.queue('task', 30, 2);
    await expect(queue.flush()).rejects.toThrow('Owned device write failure');
    expect(queue.state).toMatchObject({ acknowledged: true, cleanupPending: 1 });
    server = 99;
    fixture.fail = false;
    await queue.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(server).toBe(99);
    expect(queue.state).toMatchObject({ pending: 0, cleanupPending: 0 });
  });

  it('can discard a memory-only position when device writes cannot succeed', async () => {
    fixture.fail = true;
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = await make(save);
    queue.queue('task', 1, 2);
    await expect(queue.flush()).rejects.toThrow('Owned device write failure');
    expect(queue.state).toMatchObject({ pending: 1, local: 0 });
    await queue.discard();
    expect(queue.state.pending).toBe(0);
    expect(save).not.toHaveBeenCalled();
    expect(await readLayout('owner', 'graph')).toEqual([]);
  });

  it('does not let reconnect flush send a position while its discard transaction is pending', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = await make(save);
    queue.queue('task', 1, 2);
    await waitFor(() => expect(queue.saving).toBe(false));
    const entered = deferred(), release = deferred();
    fixture.beforeCommit = async () => { fixture.beforeCommit = undefined; entered.resolve(); await release.promise; };
    const discarding = queue.discard();
    await entered.promise;
    const flushing = queue.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    const sentDuringDiscard = save.mock.calls.length;
    release.resolve();
    await Promise.all([discarding, flushing]);
    expect(sentDuringDiscard).toBe(0);
    expect(save).not.toHaveBeenCalled();
    expect(queue.state.pending).toBe(0);
  });

  it('serializes sends for the same item across queues while allowing the newest receipt to finish last', async () => {
    const entered = deferred(), release = deferred();
    const sends: number[] = [];
    const first = await make(vi.fn(async ({ x }: PositionSave) => { sends.push(x); entered.resolve(); await release.promise; }));
    first.queue('task', 1, 2);
    const sending = first.flush();
    await entered.promise;
    const second = await make(vi.fn(async ({ x }: PositionSave) => { sends.push(x); }));
    second.queue('task', 9, 10);
    const following = second.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    const beforeRelease = [...sends];
    release.resolve();
    await Promise.all([sending, following]);
    expect(beforeRelease).toEqual([1]);
    expect(sends).toEqual([1, 9]);
  });

  it('reports unsupported coordination without sending a durable receipt', async () => {
    vi.stubGlobal('navigator', {});
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = await make(save);
    queue.queue('task', 1, 2);
    await expect(queue.flush()).rejects.toThrow(/coordinate|lock|browser/i);
    expect(save).not.toHaveBeenCalled();
    expect(queue.state).toMatchObject({ pending: 1, local: 1 });
  });

  it('keeps pending position identity stable when only persistence status changes', async () => {
    const queue = await make();
    queue.queue('task', 1, 2);
    const positions = queue.state.positions;
    await waitFor(() => expect(queue.saving).toBe(false));
    expect(queue.state.positions).toBe(positions);
  });
});
