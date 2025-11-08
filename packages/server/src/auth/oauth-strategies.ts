import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { sqliteAuthStore } from './sqlite-auth';

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

  passport.use(
    new LinkedInStrategy(
      {
        clientID: process.env.LINKEDIN_CLIENT_ID || '',
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
        callbackURL: process.env.LINKEDIN_CALLBACK_URL || 'https://localhost:4128/auth/linkedin/callback',
        scope: ['r_emailaddress', 'r_liteprofile'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in LinkedIn profile'));
          }

          const user = await sqliteAuthStore.findOrCreateUserFromOAuth({
            provider: 'linkedin',
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

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'https://localhost:4128/auth/github/callback',
        scope: ['user:email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
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
