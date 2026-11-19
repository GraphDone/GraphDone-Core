import { expect, it, vi } from 'vitest';
import { emptyAccount } from './model';

const fixture = vi.hoisted(() => ({ account: {} as ReturnType<typeof emptyAccount> }));
vi.mock('./store', () => ({
  channel: null,
  readAccount: async () => structuredClone(fixture.account),
  editAccount: async (_owner: string, edit: (a: typeof fixture.account) => unknown) => edit(fixture.account),
}));
vi.mock('../authStorage', () => ({
  getToken: () => 'x.' + btoa(JSON.stringify({ uid: 'owner' })) + '.y',
  getUserRaw: () => JSON.stringify({ id: 'owner' }),
}));

it('reads the active project when its minute expires, then skips idle and high-usage reads', async () => {
  const start = Date.UTC(2026, 0, 1);
  vi.useFakeTimers();
  vi.setSystemTime(start);
  vi.stubEnv('VITE_OFFLINE_SYNC', 'true');
  vi.stubEnv('VITE_HOSTED_USAGE', 'true');
  vi.stubGlobal('navigator', { onLine: true, locks: {
    request: async (_name: string, _options: unknown, run: (lock: object) => Promise<unknown>) => run({}),
  } });
  localStorage.setItem('currentGraphId', 'project');
  fixture.account = emptyAccount();
  const reads: number[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/project?id=project')) {
      reads.push(Date.now() - start);
      return Response.json({ snapshot: { project: { id: 'project', name: 'Shared' }, nodes: [], edges: [], notes: [] } });
    }
    if (url.includes('/usage')) return Response.json({ hosted: true, status: 'AVAILABLE',
      used: { operations: 80, reads: 0, writes: 0 }, limit: { operations: 100, reads: 100, writes: 100 } });
    throw Error('Unexpected request ' + url);
  }));
  try {
    const { getProject } = await import('./engine');
    await vi.advanceTimersByTimeAsync(9000);
    await getProject('project', true);
    await vi.advanceTimersByTimeAsync(50000);
    window.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(9999);
    expect(reads).toEqual([9000]);
    await vi.advanceTimersByTimeAsync(1);
    expect(reads).toEqual([9000, 69000]);

    await vi.advanceTimersByTimeAsync(59000);
    window.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(reads).toEqual([9000, 69000, 129000]);

    // A visible tab alone cannot spend a read after a full minute without interaction.
    await vi.advanceTimersByTimeAsync(60000);
    expect(reads).toEqual([9000, 69000, 129000]);
    const { refreshHostedUsage } = await import('../hostedUsage');
    await refreshHostedUsage(true);
    await vi.advanceTimersByTimeAsync(59000);
    window.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(reads).toEqual([9000, 69000, 129000]);
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.removeItem('currentGraphId');
  }
});
