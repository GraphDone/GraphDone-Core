import passport from 'passport';
// import { v4 as uuidv4 } from 'uuid'; // For OAuth - commented out with strategies
// OAuth strategies disabled - uncomment when needed
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
// import { Strategy as GitHubStrategy } from 'passport-github2';
// import { User } from '../types/auth';
import { driver } from '../db';

export function configurePassport() {
  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const session = driver.session();
      const result = await session.run(
        'MATCH (u:User {id: $id}) RETURN u',
        { id }
      );
      
      if (result.records.length === 0) {
        return done(null, false);
      }
      
      const user = result.records[0].get('u').properties;
      await session.close();
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // OAuth strategies disabled - removed from frontend
  /*
  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const session = driver.session();
      
      // Check if user exists with Google ID
      let result = await session.run(
        'MATCH (u:User {googleId: $googleId}) RETURN u',
        { googleId: profile.id }
      );
      
      if (result.records.length > 0) {
        // User exists, update last login
        const user = result.records[0].get('u').properties;
        await session.run(
          'MATCH (u:User {googleId: $googleId}) SET u.lastLogin = datetime() RETURN u',
          { googleId: profile.id }
        );
        await session.close();
        return done(null, user);
      }
      
      // Check if user exists with same email
      result = await session.run(
        'MATCH (u:User {email: $email}) RETURN u',
        { email: profile.emails?.[0]?.value }
      );
      
      if (result.records.length > 0) {
        // Link Google account to existing user
        const user = result.records[0].get('u').properties;
        await session.run(
          'MATCH (u:User {email: $email}) SET u.googleId = $googleId, u.oauthProvider = "google", u.oauthVerified = true, u.lastLogin = datetime() RETURN u',
          { email: profile.emails?.[0]?.value, googleId: profile.id }
        );
        await session.close();
        return done(null, user);
      }
      
      // Create new user
      const newUser = {
        id: require('uuid').v4(),
        email: profile.emails?.[0]?.value || '',
        username: profile.username || profile.emails?.[0]?.value?.split('@')[0] || 'user_' + Date.now(),
        name: profile.displayName || 'Unknown User',
        avatar: profile.photos?.[0]?.value,
        googleId: profile.id,
        oauthProvider: 'google',
        oauthVerified: true,
        isEmailVerified: true,
        role: 'NODE_WATCHER',
        isActive: true
      };
      
      await session.run(
        `CREATE (u:User $props) SET u.createdAt = datetime(), u.updatedAt = datetime(), u.lastLogin = datetime() RETURN u`,
        { props: newUser }
      );
      
      await session.close();
      done(null, newUser);
    } catch (error) {
      console.error('Google OAuth error:', error);
      done(error, null);
    }
  }));

  // LinkedIn OAuth Strategy
  passport.use(new LinkedInStrategy({
    clientID: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    callbackURL: '/auth/linkedin/callback',
    scope: ['r_emailaddress', 'r_liteprofile']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const session = driver.session();
      
      // Check if user exists with LinkedIn ID
      let result = await session.run(
        'MATCH (u:User {linkedinId: $linkedinId}) RETURN u',
        { linkedinId: profile.id }
      );
      
      if (result.records.length > 0) {
        // User exists, update last login
        const user = result.records[0].get('u').properties;
        await session.run(
          'MATCH (u:User {linkedinId: $linkedinId}) SET u.lastLogin = datetime() RETURN u',
          { linkedinId: profile.id }
        );
        await session.close();
        return done(null, user);
      }
      
      // Check if user exists with same email
      result = await session.run(
        'MATCH (u:User {email: $email}) RETURN u',
        { email: profile.emails?.[0]?.value }
      );
      
      if (result.records.length > 0) {
        // Link LinkedIn account to existing user
        const user = result.records[0].get('u').properties;
        await session.run(
          'MATCH (u:User {email: $email}) SET u.linkedinId = $linkedinId, u.oauthProvider = "linkedin", u.oauthVerified = true, u.lastLogin = datetime() RETURN u',
          { email: profile.emails?.[0]?.value, linkedinId: profile.id }
        );
        await session.close();
        return done(null, user);
      }
      
      // Create new user
      const newUser = {
        id: require('uuid').v4(),
        email: profile.emails?.[0]?.value || '',
        username: profile.username || profile.emails?.[0]?.value?.split('@')[0] || 'user_' + Date.now(),
        name: profile.displayName || 'Unknown User',
        avatar: profile.photos?.[0]?.value,
        linkedinId: profile.id,
        oauthProvider: 'linkedin',
        oauthVerified: true,
        isEmailVerified: true,
        role: 'NODE_WATCHER',
        isActive: true
      };
      
      await session.run(
        `CREATE (u:User $props) SET u.createdAt = datetime(), u.updatedAt = datetime(), u.lastLogin = datetime() RETURN u`,
        { props: newUser }
      );
      
      await session.close();
      done(null, newUser);
    } catch (error) {
      console.error('LinkedIn OAuth error:', error);
      done(error, null);
    }
  }));

  // GitHub OAuth Strategy
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackURL: '/auth/github/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const session = driver.session();
      
      // Check if user exists with GitHub ID
      let result = await session.run(
        'MATCH (u:User {githubId: $githubId}) RETURN u',
        { githubId: profile.id }
      );
      
      if (result.records.length > 0) {
        // User exists, update last login
        const user = result.records[0].get('u').properties;
        await session.run(
          'MATCH (u:User {githubId: $githubId}) SET u.lastLogin = datetime() RETURN u',
          { githubId: profile.id }
        );
        await session.close();
        return done(null, user);
      }
      
      // Check if user exists with same email
      result = await session.run(
        'MATCH (u:User {email: $email}) RETURN u',
        { email: profile.emails?.[0]?.value }
      );
      
      if (result.records.length > 0) {
        // Link GitHub account to existing user
        const user = result.records[0].get('u').properties;
        await session.run(
          'MATCH (u:User {email: $email}) SET u.githubId = $githubId, u.oauthProvider = "github", u.oauthVerified = true, u.lastLogin = datetime() RETURN u',
          { email: profile.emails?.[0]?.value, githubId: profile.id }
        );
        await session.close();
        return done(null, user);
      }
      
      // Create new user
      const newUser = {
        id: require('uuid').v4(),
        email: profile.emails?.[0]?.value || '',
        username: profile.username || 'user_' + Date.now(),
        name: profile.displayName || profile.username || 'Unknown User',
        avatar: profile.photos?.[0]?.value,
        githubId: profile.id,
        oauthProvider: 'github',
        oauthVerified: true,
        isEmailVerified: true,
        role: 'NODE_WATCHER',
        isActive: true
      };
      
      await session.run(
        `CREATE (u:User $props) SET u.createdAt = datetime(), u.updatedAt = datetime(), u.lastLogin = datetime() RETURN u`,
        { props: newUser }
      );
      
      await session.close();
      done(null, newUser);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      done(error, null);
    }
  }));
  */
}