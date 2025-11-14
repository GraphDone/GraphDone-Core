import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { sqliteAuthStore } from './sqlite-auth.js';

export function configureOAuthStrategies() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://localhost:4128/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          const user = await sqliteAuthStore.findOrCreateUserFromOAuth({
            provider: 'google',
            providerId: profile.id,
            email: email,
            name: profile.displayName || email.split('@')[0],
            avatar: profile.photos?.[0]?.value,
            accessToken: _accessToken,
            refreshToken: _refreshToken,
            profile: profile._json,
          });

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  passport.use('linkedin',
    new OpenIDConnectStrategy(
      {
        issuer: 'https://www.linkedin.com/oauth',
        authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
        userInfoURL: 'https://api.linkedin.com/v2/userinfo',
        clientID: process.env.LINKEDIN_CLIENT_ID || '',
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
        callbackURL: process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:4127/auth/linkedin/callback',
        scope: ['openid', 'profile', 'email'],
      },
      async (_issuer: string, _profile: any, done: any) => {
        try {
          console.log('🔍 LinkedIn profile received:', JSON.stringify(_profile, null, 2));

          const email = _profile.email || _profile.emails?.[0]?.value || _profile._json?.email;
          if (!email) {
            console.error('❌ No email in profile. Profile keys:', Object.keys(_profile));
            return done(new Error('No email found in LinkedIn profile'));
          }

          const user = await sqliteAuthStore.findOrCreateUserFromOAuth({
            provider: 'linkedin',
            providerId: _profile.sub || _profile.id,
            email: email,
            name: _profile.name || _profile.displayName || email.split('@')[0],
            avatar: _profile.picture || _profile.photos?.[0]?.value,
            accessToken: '',
            refreshToken: '',
            profile: _profile,
          });

          return done(null, user);
        } catch (error) {
          console.error('❌ LinkedIn OAuth error:', error);
          return done(error as Error);
        }
      }
    )
  );

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'https://localhost:4128/auth/github/callback',
        scope: ['user:email'],
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in GitHub profile'));
          }

          const user = await sqliteAuthStore.findOrCreateUserFromOAuth({
            provider: 'github',
            providerId: profile.id,
            email: email,
            name: profile.displayName || profile.username || email.split('@')[0],
            avatar: profile.photos?.[0]?.value,
            accessToken: _accessToken,
            refreshToken: _refreshToken,
            profile: profile._json,
          });

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await sqliteAuthStore.findUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}
