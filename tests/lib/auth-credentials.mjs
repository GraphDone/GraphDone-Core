export function testAdminCredentials(env = process.env) {
  const username = env.TEST_ADMIN_USERNAME;
  const password = env.TEST_ADMIN_PASSWORD;
  if ((username !== undefined || password !== undefined) && (!username || !password)) {
    throw new Error('TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD must both be nonempty when overridden.');
  }
  return { username: username || 'admin', password: password || 'graphdone', role: 'admin' };
}
