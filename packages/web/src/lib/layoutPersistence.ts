import { editAccount, readAccount } from './offline/store';
import type { Account } from './offline/model';
import type { LayoutReceipt } from './positionSaveQueue';

export const MAX_LAYOUT_GRAPHS = 16;
export const MAX_LAYOUT_POSITIONS = 10000;

const key = (id: string) => {
  if (typeof id !== 'string' || !id || id.length > 256) throw new Error('The layout owner, graph or item identifier is invalid.');
  return JSON.stringify(id);
};

const receipt = (value: LayoutReceipt): LayoutReceipt => {
  key(value?.id);
  if (![value.x, value.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1e9)
    || typeof value.revision !== 'string' || !value.revision || value.revision.length > 128
    || !Number.isFinite(value.updatedAt) || value.updatedAt < 0) throw new Error('A saved layout is invalid. Its data has been retained for recovery.');
  return { id: value.id, x: value.x, y: value.y, revision: value.revision, updatedAt: value.updatedAt };
};

const outbox = (account: Account) => {
  const value = account.layoutOutbox;
  if (!value) return { version: 1 as const, graphs: {} as Record<string, Record<string, LayoutReceipt>> };
  if (value.version !== 1 || !value.graphs || typeof value.graphs !== 'object' || Array.isArray(value.graphs)) throw new Error('This saved layout format is unsupported. Its data has been retained for recovery.');
  let count = 0;
  for (const [graphKey, positions] of Object.entries(value.graphs)) {
    if (key(JSON.parse(graphKey)) !== graphKey || !positions || typeof positions !== 'object' || Array.isArray(positions)) throw new Error('The saved layout scope is invalid. Its data has been retained for recovery.');
    for (const [nodeKey, position] of Object.entries(positions)) {
      if (key(receipt(position).id) !== nodeKey) throw new Error('The saved layout item does not match its scope.');
      count++;
    }
  }
  if (Object.keys(value.graphs).length > MAX_LAYOUT_GRAPHS || count > MAX_LAYOUT_POSITIONS) throw new Error('Saved layouts exceed the supported recovery limit. Their data has been retained.');
  return value;
};

const fences = (account: Account) => {
  const value = account.layoutFences;
  if (!value) return { version: 1 as const, counter: 0, floor: 0, graphs: {} as Record<string, number> };
  if (value.version !== 1 || !Number.isSafeInteger(value.counter) || value.counter < 0 || !Number.isSafeInteger(value.floor) || value.floor < 0 || value.floor > value.counter || !value.graphs || typeof value.graphs !== 'object' || Array.isArray(value.graphs) || Object.keys(value.graphs).length > MAX_LAYOUT_GRAPHS) throw new Error('The saved layout revision is invalid. Its data has been retained for recovery.');
  for (const [graphKey, generation] of Object.entries(value.graphs)) {
    if (key(JSON.parse(graphKey)) !== graphKey || !Number.isSafeInteger(generation) || generation < 1 || generation > value.counter) throw new Error('The saved layout revision is invalid. Its data has been retained for recovery.');
  }
  return value;
};

const generation = (account: Account, graphKey: string) => {
  const value = fences(account);
  return value.graphs[graphKey] ?? value.floor;
};

const advance = (account: Account, graphKey: string) => {
  const value = fences(account);
  if (value.counter >= Number.MAX_SAFE_INTEGER) throw new Error('The saved layout revision limit was reached. Pending data has been retained.');
  const counter = value.counter + 1;
  const entries = Object.entries({ ...value.graphs, [graphKey]: counter }).sort((a, b) => b[1] - a[1]);
  const graphs = Object.fromEntries(entries.slice(0, MAX_LAYOUT_GRAPHS));
  const floor = entries.length > MAX_LAYOUT_GRAPHS ? counter : value.floor;
  account.layoutFences = { version: 1, counter, floor, graphs };
  return counter;
};

export async function readLayoutSnapshot(ownerId: string, graphId: string) {
  key(ownerId);
  const account = await readAccount(ownerId);
  const graphKey = key(graphId);
  return { generation: generation(account, graphKey), positions: Object.values(outbox(account).graphs[graphKey] || {}).map(receipt) };
}

export async function readLayout(ownerId: string, graphId: string): Promise<LayoutReceipt[]> {
  return (await readLayoutSnapshot(ownerId, graphId)).positions;
}

export async function readLayoutScopes(ownerId: string) {
  key(ownerId);
  const account = await readAccount(ownerId);
  fences(account);
  return Object.entries(outbox(account).graphs).map(([graphKey, positions]) => ({ graphId: JSON.parse(graphKey) as string, positions: Object.values(positions).map(receipt) }));
}

export async function persistLayout(ownerId: string, graphId: string, positions: LayoutReceipt[], expectedGeneration: number): Promise<number> {
  key(ownerId);
  const graphKey = key(graphId);
  const values = positions.map(receipt);
  if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0) throw new Error('The expected layout revision is invalid.');
  return editAccount(ownerId, account => {
    if (generation(account, graphKey) !== expectedGeneration) throw new Error('Another tab changed this layout. Your unsent changes remain in this tab. Discard them and reload to use the newer layout.');
    if (!values.length) return expectedGeneration;
    const value = outbox(account);
    const graph = { ...value.graphs[graphKey] };
    for (const position of values) graph[key(position.id)] = position;
    const graphs = { ...value.graphs, [graphKey]: graph };
    const total = Object.values(graphs).reduce((sum, items) => sum + Object.keys(items).length, 0);
    if (Object.keys(graphs).length > MAX_LAYOUT_GRAPHS || total > MAX_LAYOUT_POSITIONS) throw new Error('This account has reached 16 pending graphs or 10,000 pending positions. Reconnect or discard an earlier pending layout before saving more on this device.');
    account.layoutOutbox = { version: 1, graphs };
    return advance(account, graphKey);
  });
}

export async function acknowledgeLayout(ownerId: string, graphId: string, positions: LayoutReceipt[], discard = false): Promise<void> {
  key(ownerId);
  const graphKey = key(graphId);
  const values = positions.map(receipt);
  await editAccount(ownerId, account => {
    const value = outbox(account);
    const graph = value.graphs[graphKey];
    if (!graph) return;
    let removed = false;
    for (const position of values) {
      const nodeKey = key(position.id);
      if (graph[nodeKey]?.revision === position.revision) { delete graph[nodeKey]; removed = true; }
    }
    if (!Object.keys(graph).length) delete value.graphs[graphKey];
    if (!Object.keys(value.graphs).length) delete account.layoutOutbox;
    else account.layoutOutbox = value;
    if (removed && discard) advance(account, graphKey);
  });
}
