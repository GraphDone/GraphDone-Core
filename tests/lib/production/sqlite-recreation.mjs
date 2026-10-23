import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

export async function verifySqliteRecreation({ composeArgs, env, target, request, command }) {
  assert.ok(env.ADMIN_PASSWORD?.length >= 20, 'Recreation requires private production admin credentials');
  const body = {
    query: 'mutation PersistenceLogin($input: LoginInput!) { login(input: $input) { user { id username } } }',
    variables: { input: { emailOrUsername: env.TEST_ADMIN_USERNAME || 'admin', password: env.ADMIN_PASSWORD } },
  };
  async function login() {
    const response = await request(`${target}/api/graphql`, { method: 'POST', body });
    assert.equal(response.status, 200, 'Persistence login requires HTTP 200');
    assert.ok(!response.body?.errors?.length, 'Persistence login returned GraphQL errors');
    const user = response.body?.data?.login?.user;
    assert.ok(typeof user?.id === 'string' && user.id.length > 0, 'Persistence login did not acknowledge a user');
    assert.equal(user.username, env.TEST_ADMIN_USERNAME || 'admin', 'Persistence login returned another account');
    return user.id;
  }
  const before = await login();
  await command('recreate-api', 'docker', [...composeArgs, 'up', '--detach', '--no-deps', '--force-recreate', 'graphdone-api'], { env, timeoutMs: 120_000 });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    let after;
    try { after = await login(); } catch { await delay(1_000); continue; }
    assert.equal(after, before, 'Admin identity changed after API container recreation');
    return { status: 'passed', stableAdminId: true, loginAfterRecreation: true };
  }
  throw new Error('Admin login did not recover within 120 seconds after API container recreation');
}
