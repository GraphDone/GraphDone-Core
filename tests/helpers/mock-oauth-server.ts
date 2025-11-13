import express, { Express } from 'express';
import { Server } from 'http';

/**
 * Mock OAuth Server for Testing
 *
 * Simulates OAuth 2.0 flows for Google, GitHub, and LinkedIn (OIDC)
 * without requiring real OAuth apps or network calls.
 */

export interface MockOAuthConfig {
  port?: number;
  baseUrl?: string;
}

export interface MockUserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'google' | 'github' | 'linkedin';
}

export const MOCK_USERS: Record<string, MockUserProfile> = {
  google_test: {
    id: 'google_123456789',
    email: 'test@graphdone.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    provider: 'google'
  },
  github_test: {
    id: 'github_987654321',
    email: 'developer@graphdone.com',
    name: 'Developer User',
    avatar: 'https://github.com/avatar.jpg',
    provider: 'github'
  },
  linkedin_test: {
    id: 'linkedin_abcd1234',
    email: 'linkedin@graphdone.com',
    name: 'LinkedIn User',
    avatar: 'https://linkedin.com/avatar.jpg',
    provider: 'linkedin'
  }
};

export class MockOAuthServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private baseUrl: string;
  private authCodes: Map<string, { user: MockUserProfile; expiresAt: number }> = new Map();
  private accessTokens: Map<string, { user: MockUserProfile; expiresAt: number }> = new Map();

  constructor(config: MockOAuthConfig = {}) {
    this.port = config.port || 9876;
    this.baseUrl = config.baseUrl || `http://localhost:${this.port}`;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Google OAuth Mock
    this.setupGoogleRoutes();

    // GitHub OAuth Mock
    this.setupGitHubRoutes();

    // LinkedIn OIDC Mock
    this.setupLinkedInRoutes();

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', providers: ['google', 'github', 'linkedin'] });
    });
  }

  private setupGoogleRoutes() {
    // Google authorization endpoint
    this.app.get('/google/oauth2/v2/auth', (req, res) => {
      const { client_id, redirect_uri, scope, state, response_type } = req.query;

      console.log('🔵 Mock Google OAuth: Authorization request', { client_id, redirect_uri, scope });

      if (!client_id || !redirect_uri) {
        return res.status(400).json({ error: 'invalid_request' });
      }

      // Generate auth code
      const code = `google_auth_${Date.now()}`;
      this.authCodes.set(code, {
        user: MOCK_USERS.google_test,
        expiresAt: Date.now() + 60000 // 1 minute
      });

      // Redirect with code
      const callbackUrl = `${redirect_uri}?code=${code}&state=${state || ''}`;
      res.redirect(callbackUrl);
    });

    // Google token endpoint
    this.app.post('/google/oauth2/v4/token', (req, res) => {
      const { code, client_id, client_secret, redirect_uri, grant_type } = req.body;

      console.log('🔵 Mock Google OAuth: Token exchange', { code });

      const authData = this.authCodes.get(code);
      if (!authData || authData.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      // Generate access token
      const accessToken = `google_token_${Date.now()}`;
      this.accessTokens.set(accessToken, {
        user: authData.user,
        expiresAt: Date.now() + 3600000 // 1 hour
      });

      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'profile email',
        id_token: 'mock_id_token'
      });
    });

    // Google user info endpoint
    this.app.get('/google/oauth2/v2/userinfo', (req, res) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      console.log('🔵 Mock Google OAuth: User info request');

      if (!token) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const tokenData = this.accessTokens.get(token);
      if (!tokenData || tokenData.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'invalid_token' });
      }

      const user = tokenData.user;
      res.json({
        id: user.id,
        email: user.email,
        verified_email: true,
        name: user.name,
        given_name: user.name.split(' ')[0],
        family_name: user.name.split(' ')[1] || '',
        picture: user.avatar,
        locale: 'en'
      });
    });
  }

  private setupGitHubRoutes() {
    // GitHub authorization endpoint
    this.app.get('/github/login/oauth/authorize', (req, res) => {
      const { client_id, redirect_uri, scope, state } = req.query;

      console.log('🟣 Mock GitHub OAuth: Authorization request', { client_id, redirect_uri, scope });

      if (!client_id || !redirect_uri) {
        return res.status(400).json({ error: 'invalid_request' });
      }

      // Generate auth code
      const code = `github_auth_${Date.now()}`;
      this.authCodes.set(code, {
        user: MOCK_USERS.github_test,
        expiresAt: Date.now() + 60000
      });

      // Redirect with code
      const callbackUrl = `${redirect_uri}?code=${code}&state=${state || ''}`;
      res.redirect(callbackUrl);
    });

    // GitHub token endpoint
    this.app.post('/github/login/oauth/access_token', (req, res) => {
      const { code, client_id, client_secret } = req.body;

      console.log('🟣 Mock GitHub OAuth: Token exchange', { code });

      const authData = this.authCodes.get(code);
      if (!authData || authData.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'bad_verification_code' });
      }

      // Generate access token
      const accessToken = `github_token_${Date.now()}`;
      this.accessTokens.set(accessToken, {
        user: authData.user,
        expiresAt: Date.now() + 3600000
      });

      res.json({
        access_token: accessToken,
        token_type: 'bearer',
        scope: 'user:email'
      });
    });

    // GitHub user endpoint
    this.app.get('/github/api/user', (req, res) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '').replace('token ', '');

      console.log('🟣 Mock GitHub OAuth: User info request');

      if (!token) {
        return res.status(401).json({ message: 'Requires authentication' });
      }

      const tokenData = this.accessTokens.get(token);
      if (!tokenData || tokenData.expiresAt < Date.now()) {
        return res.status(401).json({ message: 'Bad credentials' });
      }

      const user = tokenData.user;
      res.json({
        id: parseInt(user.id.replace('github_', '')),
        login: user.name.toLowerCase().replace(' ', ''),
        name: user.name,
        avatar_url: user.avatar,
        email: user.email,
        bio: 'GraphDone test user',
        company: 'GraphDone',
        location: 'San Francisco'
      });
    });

    // GitHub emails endpoint
    this.app.get('/github/api/user/emails', (req, res) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '').replace('token ', '');

      const tokenData = this.accessTokens.get(token || '');
      if (!tokenData || tokenData.expiresAt < Date.now()) {
        return res.status(401).json({ message: 'Bad credentials' });
      }

      const user = tokenData.user;
      res.json([
        {
          email: user.email,
          verified: true,
          primary: true,
          visibility: 'public'
        }
      ]);
    });
  }

  private setupLinkedInRoutes() {
    // LinkedIn authorization endpoint
    this.app.get('/linkedin/oauth/v2/authorization', (req, res) => {
      const { client_id, redirect_uri, scope, state, response_type } = req.query;

      console.log('🔷 Mock LinkedIn OIDC: Authorization request', { client_id, redirect_uri, scope });

      if (!client_id || !redirect_uri) {
        return res.status(400).json({ error: 'invalid_request' });
      }

      // Generate auth code
      const code = `linkedin_auth_${Date.now()}`;
      this.authCodes.set(code, {
        user: MOCK_USERS.linkedin_test,
        expiresAt: Date.now() + 60000
      });

      // Redirect with code
      const callbackUrl = `${redirect_uri}?code=${code}&state=${state || ''}`;
      res.redirect(callbackUrl);
    });

    // LinkedIn token endpoint
    this.app.post('/linkedin/oauth/v2/accessToken', (req, res) => {
      const { code, client_id, client_secret, redirect_uri, grant_type } = req.body;

      console.log('🔷 Mock LinkedIn OIDC: Token exchange', { code });

      const authData = this.authCodes.get(code);
      if (!authData || authData.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      // Generate access token
      const accessToken = `linkedin_token_${Date.now()}`;
      this.accessTokens.set(accessToken, {
        user: authData.user,
        expiresAt: Date.now() + 3600000
      });

      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email',
        id_token: 'mock_id_token'
      });
    });

    // LinkedIn userinfo endpoint (OIDC)
    this.app.get('/linkedin/v2/userinfo', (req, res) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      console.log('🔷 Mock LinkedIn OIDC: User info request');

      if (!token) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const tokenData = this.accessTokens.get(token);
      if (!tokenData || tokenData.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'invalid_token' });
      }

      const user = tokenData.user;
      res.json({
        sub: user.id,
        email: user.email,
        email_verified: true,
        name: user.name,
        given_name: user.name.split(' ')[0],
        family_name: user.name.split(' ')[1] || '',
        picture: user.avatar,
        locale: 'en_US'
      });
    });

    // LinkedIn OpenID Configuration (discovery)
    this.app.get('/linkedin/.well-known/openid-configuration', (req, res) => {
      res.json({
        issuer: 'https://www.linkedin.com/oauth',
        authorization_endpoint: `${this.baseUrl}/linkedin/oauth/v2/authorization`,
        token_endpoint: `${this.baseUrl}/linkedin/oauth/v2/accessToken`,
        userinfo_endpoint: `${this.baseUrl}/linkedin/v2/userinfo`,
        jwks_uri: `${this.baseUrl}/linkedin/oauth/v2/keys`,
        scopes_supported: ['openid', 'profile', 'email'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        subject_types_supported: ['public']
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`✅ Mock OAuth Server running on ${this.baseUrl}`);
          console.log(`   🔵 Google: ${this.baseUrl}/google/*`);
          console.log(`   🟣 GitHub: ${this.baseUrl}/github/*`);
          console.log(`   🔷 LinkedIn: ${this.baseUrl}/linkedin/*`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Mock OAuth Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  clearTokens(): void {
    this.authCodes.clear();
    this.accessTokens.clear();
  }
}

export async function startMockOAuthServer(config?: MockOAuthConfig): Promise<MockOAuthServer> {
  const server = new MockOAuthServer(config);
  await server.start();
  return server;
}
