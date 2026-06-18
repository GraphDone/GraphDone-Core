/**
 * Deployment-agnostic API access for E2E tests.
 *
 * Many older specs hardcoded http://localhost:4127/graphql and ran
 * unauthenticated — both broken since (a) the production stack publishes only
 * nginx on 3128, which proxies /api/graphql and /health, and (b) data queries
 * now require a JWT. Use these helpers instead: they derive every URL from
 * TEST_URL and log in through the same mutation the UI uses.
 */

const BASE_URL = (process.env.TEST_URL || 'https://localhost:3128').replace(/\/$/, '');

export const HEALTH_URL = `${BASE_URL}/health`;
export const GRAPHQL_URL = `${BASE_URL}/api/graphql`;

// Self-signed dev certificates: Node's fetch (undici) needs this for https.
// Playwright browser contexts handle it via ignoreHTTPSErrors; this covers
// direct fetch() calls from test code.
if (BASE_URL.startsWith('https:')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export interface GqlResponse<T = Record<string, unknown>> {
  data: T | null;
  errors?: Array<{ message: string }>;
}

export async function gqlRequest<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string
): Promise<GqlResponse<T>> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  });
  return response.json() as Promise<GqlResponse<T>>;
}

/** Login via the public mutation; returns a bearer token for gqlRequest. */
export async function apiLogin(
  emailOrUsername = 'admin',
  password = 'graphdone'
): Promise<string> {
  const result = await gqlRequest<{ login: { token: string } }>(
    `mutation Login($input: LoginInput!) { login(input: $input) { token } }`,
    { input: { emailOrUsername, password } }
  );
  if (!result.data?.login?.token) {
    throw new Error(`API login failed: ${JSON.stringify(result.errors ?? result)}`);
  }
  return result.data.login.token;
}
