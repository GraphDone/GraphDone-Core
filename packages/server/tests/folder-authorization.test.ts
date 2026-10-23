import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sqlite3 from 'sqlite3';
import { createRequire } from 'node:module';
import type { GraphQLSchema } from 'graphql';
import { sqliteAuthStore } from '../src/auth/sqlite-auth.js';
import { sqliteAuthResolvers } from '../src/resolvers/sqlite-auth.js';
import { authOnlyTypeDefs } from '../src/schema/auth-only-schema.js';
import { authTypeDefs } from '../src/schema/auth-schema.js';
import { typeDefs } from '../src/schema/neo4j-schema.js';

const require = createRequire(import.meta.url);
const { graphql } = require('graphql') as typeof import('graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema') as typeof import('@graphql-tools/schema');
const { mergeTypeDefs } = require('@graphql-tools/merge') as typeof import('@graphql-tools/merge');
const { Neo4jGraphQL } = require('@neo4j/graphql') as typeof import('@neo4j/graphql');

let db: sqlite3.Database;
let schemas: Record<string, GraphQLSchema>;
const accounts: Record<string, { id: string; email: string; role: string }> = {};
const graphs = new Map<string, { createdBy: string; isShared: boolean }>();
const store = sqliteAuthStore as unknown as { db: sqlite3.Database | null; initialized: boolean };
const execute = (sql: string, values: unknown[] = []) => new Promise<void>((resolve, reject) => {
  db.run(sql, values, error => error ? reject(error) : resolve());
});
const rows = (sql: string, values: unknown[] = []) => new Promise<Record<string, unknown>[]>((resolve, reject) => {
  db.all(sql, values, (error, result: Record<string, unknown>[]) => error ? reject(error) : resolve(result));
});
const driver = {
  session: () => ({
    run: vi.fn(async (_query: string, { ids }: { ids: string[] }) => ({
      records: ids.filter(id => graphs.has(id)).map(id => ({
        get: (key: string) => ({ id, ...graphs.get(id) }[key]),
      })),
    })),
    close: vi.fn(async () => {}),
  }),
};
const executionContext = {
  run: async (query: string) => {
    if (!query.includes('dbms.components')) throw new Error('Unexpected generated graph operation');
    return { records: [['5.26.0', 'community']] };
  },
};

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('ADMIN_EMAIL', 'admin@folders.invalid');
  vi.stubEnv('ADMIN_PASSWORD', 'folder-fixture-password-only');
  db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const connection = new sqlite3.Database(':memory:', error => error ? reject(error) : resolve(connection));
  });
  store.db = db;
  store.initialized = false;
  await sqliteAuthStore.initialize();
  accounts.admin = (await sqliteAuthStore.findUserByEmailOrUsername('admin'))!;
  accounts.viewer = (await sqliteAuthStore.findUserByEmailOrUsername('viewer'))!;
  for (const name of ['owner', 'outsider', 'member']) {
    accounts[name] = await sqliteAuthStore.createUser({
      email: `${name}@folders.invalid`, username: name, name,
      password: 'folder-fixture-password-only', role: name === 'viewer' ? 'VIEWER' : 'USER',
    });
  }
  schemas = {
    sqlite: makeExecutableSchema({ typeDefs: authOnlyTypeDefs, resolvers: sqliteAuthResolvers }),
    neo4j: await new Neo4jGraphQL({
      typeDefs: mergeTypeDefs([typeDefs, authTypeDefs]),
      resolvers: { Query: sqliteAuthResolvers.Query, Mutation: sqliteAuthResolvers.Mutation },
    }).getSchema(),
  };
}, 30000);

afterAll(async () => {
  await new Promise<void>((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  store.db = null;
  store.initialized = false;
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  await execute('DELETE FROM graph_folders');
  await execute('DELETE FROM folders');
  await execute('DELETE FROM user_teams');
  await execute("UPDATE users SET isActive=1, role=CASE WHEN username='admin' THEN 'ADMIN' WHEN username='viewer' THEN 'VIEWER' ELSE 'USER' END");
  const now = new Date().toISOString();
  for (const [id, type, ownerId] of [
    ['owner-folder', 'user', accounts.owner.id],
    ['other-folder', 'user', accounts.outsider.id],
    ['viewer-folder', 'user', accounts.viewer.id],
    ['team-folder', 'team', 'team-a'],
    ['other-team-folder', 'team', 'team-b'],
    ['system-folder', 'system', null],
  ]) {
    await execute('INSERT INTO folders(id,name,type,ownerId,createdAt,updatedAt) VALUES(?,?,?,?,?,?)', [id, id, type, ownerId, now, now]);
  }
  for (const name of ['owner', 'member', 'viewer']) {
    await execute('INSERT INTO user_teams(userId,teamId,role,createdAt) VALUES(?,?,?,?)', [accounts[name].id, 'team-a', 'MEMBER', now]);
  }
  graphs.clear();
  graphs.set('owner-graph', { createdBy: accounts.owner.id, isShared: false });
  graphs.set('other-graph', { createdBy: accounts.outsider.id, isShared: false });
  graphs.set('shared-graph', { createdBy: accounts.outsider.id, isShared: true });
  await sqliteAuthStore.addGraphToFolder('owner-graph', 'owner-folder');
  await sqliteAuthStore.addGraphToFolder('other-graph', 'other-folder');
  await sqliteAuthStore.addGraphToFolder('shared-graph', 'system-folder');
});

describe.each(['sqlite', 'neo4j'])('%s folder authorization', mode => {
  const call = (source: string, name = 'owner', variables: Record<string, unknown> = {}, extra = {}) => {
    const account = accounts[name];
    const user = name === 'guest'
      ? { userId: 'guest-12345678-1234-4234-8234-123456789abc', role: 'GUEST' }
      : account ? { userId: account.id, role: account.role } : undefined;
    return graphql({ schema: schemas[mode], source, variableValues: variables, contextValue: { user, driver, executionContext, ...extra } });
  };
  const denied = (result: Awaited<ReturnType<typeof call>>) => {
    expect(result.errors?.[0]?.extensions.code, result.errors?.map(error => error.message).join('; ')).toBe('FORBIDDEN');
  };
  const snapshot = async () => ({ folders: await rows('SELECT * FROM folders ORDER BY id'), mappings: await rows('SELECT * FROM graph_folders ORDER BY graphId,folderId') });

  it('exposes only the authorized custom folder mutations', () => {
    const mutations = schemas[mode].getMutationType()!.getFields();
    for (const name of ['createFolders', 'updateFolders', 'deleteFolders', 'createGraphFolderMappings', 'updateGraphFolderMappings', 'deleteGraphFolderMappings']) {
      expect(mutations[name]).toBeUndefined();
    }
    expect(mutations.createFolder).toBeDefined();
    expect(mutations.addGraphToFolder).toBeDefined();
  });

  it('requires authentication for folder reads and writes', async () => {
    for (const source of ['{folderGraphs(folderId:"system-folder"){graphId}}', 'mutation {deleteFolder(id:"system-folder"){success}}']) {
      const result = await call(source, 'anonymous');
      expect(result.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    }
  });

  it('denies foreign folder mapping reads without disclosing graph IDs', async () => {
    denied(await call('{folderGraphs(folderId:"other-folder"){graphId}}'));
    denied(await call('{folder(id:"other-folder"){id name graphs{graphId}}}'));
    denied(await call('{folder(id:"other-folder"){id}}', 'admin'));
  });

  it.each(['guest', 'viewer'])('keeps %s mutations read-only before changing storage', async name => {
    const before = await snapshot();
    const folderId = name === 'viewer' ? 'viewer-folder' : 'system-folder';
    for (const source of [
      'mutation {createFolder(input:{name:"intrusion",type:USER}){id}}',
      `mutation {updateFolder(id:"${folderId}",input:{name:"intrusion"}){id}}`,
      `mutation {deleteFolder(id:"${folderId}"){success}}`,
      `mutation {addGraphToFolder(graphId:"shared-graph",folderId:"${folderId}"){success}}`,
      `mutation {removeGraphFromFolder(graphId:"shared-graph",folderId:"${folderId}"){success}}`,
      `mutation {moveGraphBetweenFolders(graphId:"shared-graph",fromFolderId:"${folderId}",toFolderId:"team-folder"){success}}`,
      `mutation {reorderGraphsInFolder(folderId:"${folderId}",graphOrders:[{graphId:"shared-graph",position:3}]){success}}`,
    ]) denied(await call(source, name));
    expect(await snapshot()).toEqual(before);
  });

  it('denies cross-owner mutations and checks every source and destination before writing', async () => {
    const before = await snapshot();
    for (const source of [
      'mutation {updateFolder(id:"other-folder",input:{name:"intrusion"}){id}}',
      'mutation {deleteFolder(id:"other-folder"){success}}',
      'mutation {deleteFolder(id:"owner-folder",moveGraphsTo:"other-folder"){success}}',
      'mutation {addGraphToFolder(graphId:"shared-graph",folderId:"other-folder"){success}}',
      'mutation {removeGraphFromFolder(graphId:"other-graph",folderId:"other-folder"){success}}',
      'mutation {moveGraphBetweenFolders(graphId:"owner-graph",fromFolderId:"owner-folder",toFolderId:"other-folder"){success}}',
      'mutation {moveGraphBetweenFolders(graphId:"other-graph",fromFolderId:"other-folder",toFolderId:"owner-folder"){success}}',
      'mutation {reorderGraphsInFolder(folderId:"other-folder",graphOrders:[{graphId:"shared-graph",position:3}]){success}}',
    ]) denied(await call(source));
    expect(await snapshot()).toEqual(before);
  });

  it.each([0, 1])('preserves legacy foreign descendants when deleting with foreign_keys=%s', async foreignKeys => {
    const child = await sqliteAuthStore.createFolder({ name: 'owned child', type: 'user', ownerId: accounts.owner.id, parentId: 'owner-folder' });
    await execute('UPDATE folders SET parentId=? WHERE id=?', [child.id, 'other-folder']);
    await execute(`PRAGMA foreign_keys=${foreignKeys}`);
    try {
      expect((await rows('PRAGMA foreign_keys'))[0].foreign_keys).toBe(foreignKeys);
      const before = await snapshot();
      const result = await call('mutation {deleteFolder(id:"owner-folder",moveGraphsTo:"team-folder"){success}}');
      expect(await rows('SELECT id FROM folders WHERE id=?', ['other-folder'])).toEqual([{ id: 'other-folder' }]);
      denied(result);
      expect(await snapshot()).toEqual(before);
    } finally {
      await execute('PRAGMA foreign_keys=OFF');
    }
  });

  it('keeps authorized same-domain deletion available with enforced cascades', async () => {
    const child = await sqliteAuthStore.createFolder({ name: 'owned child', type: 'user', ownerId: accounts.owner.id, parentId: 'owner-folder' });
    await execute('PRAGMA foreign_keys=ON');
    try {
      const result = await call('mutation {deleteFolder(id:"owner-folder",moveGraphsTo:"team-folder"){success}}');
      expect(result.errors).toBeUndefined();
      expect(await rows('SELECT id FROM folders WHERE id IN (?,?)', ['owner-folder', child.id])).toEqual([]);
      expect(await rows('SELECT graphId FROM graph_folders WHERE folderId=?', ['team-folder'])).toEqual([{ graphId: 'owner-graph' }]);
      expect(await rows('SELECT id FROM folders WHERE id=?', ['other-folder'])).toEqual([{ id: 'other-folder' }]);
    } finally {
      await execute('PRAGMA foreign_keys=OFF');
    }
  });

  it('rejects legacy descendants in a different writable ownership domain', async () => {
    await execute('UPDATE folders SET parentId=? WHERE id=?', ['owner-folder', 'team-folder']);
    const before = await snapshot();
    denied(await call('mutation {deleteFolder(id:"owner-folder"){success}}'));
    expect(await snapshot()).toEqual(before);
  });

  it.each(['self', 'descendant'])('rejects the %s as graph destination before deleting the subtree', async target => {
    const child = await sqliteAuthStore.createFolder({ name: 'owned child', type: 'user', ownerId: accounts.owner.id, parentId: 'owner-folder' });
    const destination = target === 'self' ? 'owner-folder' : child.id;
    const before = await snapshot();
    const result = await call('mutation($destination:String!){deleteFolder(id:"owner-folder",moveGraphsTo:$destination){success}}', 'owner', { destination });
    expect(result.errors?.[0]?.extensions.code).toBe('BAD_USER_INPUT');
    expect(await snapshot()).toEqual(before);
  });

  it('rejects forged owners, foreign parents and hierarchy changes across ownership domains', async () => {
    const before = await snapshot();
    denied(await call('mutation($owner:String!){createFolder(input:{name:"intrusion",type:USER,ownerId:$owner}){id}}', 'owner', { owner: accounts.outsider.id }));
    for (const source of [
      'mutation {createFolder(input:{name:"intrusion",type:SYSTEM}){id}}',
      'mutation {createFolder(input:{name:"intrusion",type:TEAM,ownerId:"team-b"}){id}}',
      'mutation {createFolder(input:{name:"intrusion",type:USER,parentId:"other-folder"}){id}}',
      'mutation {createFolder(input:{name:"intrusion",type:USER,parentId:"team-folder"}){id}}',
      'mutation {updateFolder(id:"owner-folder",input:{parentId:"other-folder"}){id}}',
      'mutation {updateFolder(id:"owner-folder",input:{parentId:"team-folder"}){id}}',
    ]) denied(await call(source));
    expect(await snapshot()).toEqual(before);
  });

  it('checks current role and activation rather than trusting a stale context role', async () => {
    await execute('UPDATE users SET role=? WHERE id=?', ['VIEWER', accounts.owner.id]);
    denied(await call('mutation {updateFolder(id:"owner-folder",input:{name:"intrusion"}){id}}'));
    await execute('UPDATE users SET isActive=0 WHERE id=?', [accounts.owner.id]);
    const inactive = await call('{folderGraphs(folderId:"owner-folder"){graphId}}');
    expect(inactive.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    await execute('UPDATE users SET role=? WHERE id=?', ['VIEWER', accounts.admin.id]);
    denied(await call('mutation {updateFolder(id:"system-folder",input:{name:"intrusion"}){id}}', 'admin'));
    await execute('DELETE FROM users WHERE id=?', [accounts.member.id]);
    const deleted = await call('{folderGraphs(folderId:"team-folder"){graphId}}', 'member');
    expect(deleted.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    await execute('INSERT INTO users(id,email,username,name,role,passwordHash,createdAt,updatedAt,isActive) VALUES(?,?,?,?,?,?,?,?,1)', [accounts.member.id, accounts.member.email, 'member', 'member', 'USER', 'unused', new Date().toISOString(), new Date().toISOString()]);
  });

  it('preserves team member access and rejects it immediately after membership removal', async () => {
    const created = await call('mutation {createFolder(input:{name:"team child",type:TEAM,ownerId:"team-a",parentId:"team-folder"}){id type ownerId}}', 'member');
    expect(created.errors, created.errors?.map(error => error.message).join('; ')).toBeUndefined();
    expect(created.data?.createFolder).toMatchObject({ type: 'TEAM', ownerId: 'team-a' });
    expect((await call('mutation {updateFolder(id:"team-folder",input:{name:"Updated team"}){name}}', 'member')).errors).toBeUndefined();
    await execute('DELETE FROM user_teams WHERE userId=? AND teamId=?', [accounts.member.id, 'team-a']);
    denied(await call('{folderGraphs(folderId:"team-folder"){graphId}}', 'member'));
    denied(await call('mutation {updateFolder(id:"team-folder",input:{name:"intrusion"}){id}}', 'member'));
  });

  it('allows guest system reads without creating persistent guest folders', async () => {
    const before = await snapshot();
    const result = await call('{folders{id type graphs{graphId}}}', 'guest');
    expect(result.errors, result.errors?.map(error => error.message).join('; ')).toBeUndefined();
    expect(result.data?.folders).toEqual([{ id: 'system-folder', type: 'SYSTEM', graphs: [{ graphId: 'shared-graph' }] }]);
    expect(await snapshot()).toEqual(before);
  });

  it('restricts system modifications to admins while preserving personal folder creation', async () => {
    denied(await call('mutation {updateFolder(id:"system-folder",input:{name:"intrusion"}){id}}'));
    expect((await call('mutation {updateFolder(id:"system-folder",input:{name:"Updated system"}){name type}}', 'admin')).errors).toBeUndefined();
    const result = await call('mutation {createFolder(input:{name:"Personal child",type:USER,parentId:"owner-folder"}){id type ownerId}}');
    expect(result.errors, result.errors?.map(error => error.message).join('; ')).toBeUndefined();
    expect(result.data?.createFolder).toMatchObject({ type: 'USER', ownerId: accounts.owner.id });
    const system = await call('mutation {createFolder(input:{name:"System child",type:SYSTEM,parentId:"system-folder"}){type ownerId}}', 'admin');
    expect(system.errors).toBeUndefined();
    expect(system.data?.createFolder).toMatchObject({ type: 'SYSTEM', ownerId: null });
  });

  it('rejects parent cycles without hiding the existing folder tree', async () => {
    const before = await snapshot();
    const result = await call('mutation {updateFolder(id:"owner-folder",input:{parentId:"owner-folder"}){id}}');
    expect(result.errors?.[0]?.extensions.code).toBe('BAD_USER_INPUT');
    expect(await snapshot()).toEqual(before);
  });

  it('preserves ownership checks for legacy uppercase folder records', async () => {
    await execute('UPDATE folders SET type=UPPER(type)');
    const before = await snapshot();
    const result = await call('{folders{id type}}');
    expect(result.errors).toBeUndefined();
    expect(result.data?.folders).toContainEqual({ id: 'owner-folder', type: 'USER' });
    denied(await call('{folderGraphs(folderId:"other-folder"){graphId}}'));
    expect(await snapshot()).toEqual(before);
  });

  it('filters private graph references and rejects them before changing any mapping', async () => {
    await sqliteAuthStore.addGraphToFolder('other-graph', 'team-folder');
    await sqliteAuthStore.addGraphToFolder('shared-graph', 'team-folder');
    const listed = await call('{folderGraphs(folderId:"team-folder"){graphId}}');
    expect(listed.errors, listed.errors?.map(error => error.message).join('; ')).toBeUndefined();
    expect(listed.data?.folderGraphs).toEqual([{ graphId: 'shared-graph' }]);
    const before = await snapshot();
    denied(await call('mutation {addGraphToFolder(graphId:"other-graph",folderId:"owner-folder"){success}}'));
    denied(await call('mutation {reorderGraphsInFolder(folderId:"owner-folder",graphOrders:[{graphId:"shared-graph",position:1},{graphId:"other-graph",position:2}]){success}}'));
    graphs.set('shared-graph', { createdBy: accounts.outsider.id, isShared: false });
    denied(await call('mutation {addGraphToFolder(graphId:"shared-graph",folderId:"owner-folder"){success}}'));
    expect(await snapshot()).toEqual(before);
  });

  it('preserves authorized mapping operations and checks graph service availability', async () => {
    expect((await call('mutation {addGraphToFolder(graphId:"shared-graph",folderId:"owner-folder"){success}}')).errors).toBeUndefined();
    expect((await call('mutation {moveGraphBetweenFolders(graphId:"shared-graph",fromFolderId:"owner-folder",toFolderId:"team-folder"){success}}')).errors).toBeUndefined();
    const before = await snapshot();
    const unavailable = await call('mutation {addGraphToFolder(graphId:"owner-graph",folderId:"team-folder"){success}}', 'owner', {}, { driver: null });
    expect(unavailable.errors?.[0]?.extensions.code).toBe('SERVICE_UNAVAILABLE');
    expect(await snapshot()).toEqual(before);
    const offlineRead = await call('{folderGraphs(folderId:"owner-folder"){graphId}}', 'owner', {}, { driver: null });
    expect(offlineRead.errors).toBeUndefined();
    expect(offlineRead.data?.folderGraphs).toEqual([]);
    expect((await call('mutation {reorderGraphsInFolder(folderId:"team-folder",graphOrders:[{graphId:"shared-graph",position:3}]){success}}')).errors).toBeUndefined();
    expect((await call('mutation {removeGraphFromFolder(graphId:"shared-graph",folderId:"team-folder"){success}}')).errors).toBeUndefined();
    expect((await call('mutation {deleteFolder(id:"owner-folder",moveGraphsTo:"team-folder"){success}}')).errors).toBeUndefined();
    expect(await rows('SELECT graphId FROM graph_folders WHERE folderId=?', ['team-folder'])).toEqual([{ graphId: 'owner-graph' }]);
  });
});
