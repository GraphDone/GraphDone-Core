import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { sqliteAuthStore } from './sqlite-auth.js';
import { googleIdentity, type OAuthIdentity } from './oauth-identity.js';
import { fetchGitHubIdentity, fetchLinkedInIdentity } from './oauth-profile-fetch.js';

type Complete = (error: Error | null, user?: any) => void;

async function authenticateIdentity(readIdentity: () => OAuthIdentity | Promise<OAuthIdentity>, done: Complete) {
  try {
    done(null, await sqliteAuthStore.findOrCreateUserFromOAuth(await readIdentity()));
  } catch (error) {
    done(error as Error);
  }
}

export function configureOAuthStrategies(authenticator: Pick<typeof passport, 'use' | 'serializeUser' | 'deserializeUser'> = passport) {
  if (process.env.GOOGLE_CLIENT_ID) {
    if (!process.env.GOOGLE_CLIENT_SECRET) throw new Error('Google OAuth client secret required');
    authenticator.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://localhost:4128/auth/google/callback',
      state: true,
    }, (_accessToken, _refreshToken, profile, done) => {
      void authenticateIdentity(() => googleIdentity(profile), done);
    }));
  }

  if (process.env.LINKEDIN_CLIENT_ID) {
    if (!process.env.LINKEDIN_CLIENT_SECRET) throw new Error('LinkedIn OAuth client secret required');
    authenticator.use('linkedin', new OpenIDConnectStrategy({
      issuer: 'https://www.linkedin.com',
      authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
      userInfoURL: 'https://api.linkedin.com/v2/userinfo',
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:4127/auth/linkedin/callback',
      scope: ['openid', 'profile', 'email'],
      skipUserProfile: true,
    }, (issuer: string, _userInfo: any, idProfile: any, _context: unknown, _idToken: string,
      accessToken: string, _refreshToken: string, _params: unknown, done: Complete) => {
      void authenticateIdentity(() => fetchLinkedInIdentity(issuer, idProfile, accessToken), done);
    }));
  }

  if (process.env.GITHUB_CLIENT_ID) {
    if (!process.env.GITHUB_CLIENT_SECRET) throw new Error('GitHub OAuth client secret required');
    authenticator.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'https://localhost:4128/auth/github/callback',
      scope: ['user:email'],
      skipUserProfile: true,
      state: true as any,
    }, (accessToken: string, _refreshToken: string, _profile: any, done: Complete) => {
      void authenticateIdentity(() => fetchGitHubIdentity(accessToken), done);
    }));
  }

  authenticator.serializeUser((user: any, done) => done(null, user.id));
  authenticator.deserializeUser(async (id: string, done) => {
    try { done(null, await sqliteAuthStore.findUserById(id)); }
    catch (error) { done(error); }
  });
}
