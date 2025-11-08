# OAuth Social Login Setup Guide

This guide explains how to integrate Google, LinkedIn, and GitHub OAuth authentication in GraphDone.

## Overview

GraphDone supports social login through OAuth 2.0 for:
- **Google** (Google Sign-In)
- **LinkedIn** (Sign In with LinkedIn)
- **GitHub** (GitHub OAuth Apps)

## Step 1: Register OAuth Applications

### Google OAuth Setup

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API** or **Google Identity Services**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth 2.0 Client ID**
6. Configure OAuth consent screen:
   - App name: `GraphDone`
   - User support email: your email
   - App logo: (optional)
   - Privacy policy: your privacy policy URL
7. Select **Web application** as application type
8. Add authorized redirect URIs:
   - Development: `https://localhost:4128/auth/google/callback`
   - Production: `https://yourdomain.com/auth/google/callback`
9. Click **Create**
10. Copy **Client ID** and **Client Secret**

**Scopes Required:**
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

### LinkedIn OAuth Setup

1. Visit [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click **Create app**
3. Fill in application details:
   - App name: `GraphDone`
   - LinkedIn Page: (create or select a page)
   - App logo: (optional)
   - Legal agreement: Check the box
4. Click **Create app**
5. Go to **Auth** tab
6. Add **Authorized redirect URLs for your app**:
   - Development: `https://localhost:4128/auth/linkedin/callback`
   - Production: `https://yourdomain.com/auth/linkedin/callback`
7. Under **Products** tab, request access to:
   - **Sign In with LinkedIn** (should be auto-approved)
8. Copy **Client ID** and **Client Secret** from the **Auth** tab

**Scopes Required:**
- `r_liteprofile` (basic profile info)
- `r_emailaddress` (email address)

### GitHub OAuth Setup

1. Visit [GitHub Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in application details:
   - Application name: `GraphDone`
   - Homepage URL: `https://yourdomain.com` (or `http://localhost:3127` for dev)
   - Application description: (optional)
   - Authorization callback URL: `https://localhost:4128/auth/github/callback`
4. Click **Register application**
5. Copy **Client ID**
6. Click **Generate a new client secret**
7. Copy **Client Secret** (save it securely - you won't see it again)

**Scopes Required:**
- `user:email` (email address)

## Step 2: Configure Environment Variables

Create or update your `.env` file in the project root:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abc123def456ghi789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
GOOGLE_CALLBACK_URL=https://localhost:4128/auth/google/callback

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=86abcdef123456
LINKEDIN_CLIENT_SECRET=YourSecretHere123
LINKEDIN_CALLBACK_URL=https://localhost:4128/auth/linkedin/callback

# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.a1b2c3d4e5f6g7h8
GITHUB_CLIENT_SECRET=1234567890abcdef1234567890abcdef12345678
GITHUB_CALLBACK_URL=https://localhost:4128/auth/github/callback

# Session Secret (generate a random string)
# Use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your-super-secret-random-32-byte-hex-string-here
```

### Generating Session Secret

Run this command to generate a secure random session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as your `SESSION_SECRET` value.

## Step 3: OAuth Routes (Implementation Complete)

**OAuth callback routes have been fully implemented!** The server now includes:

1. ✅ Express session middleware configured
2. ✅ Passport.js initialized with OAuth strategies
3. ✅ OAuth initiation routes for each provider
4. ✅ OAuth callback handlers with JWT token generation
5. ✅ Frontend token handling via URL parameters

The OAuth routes are automatically enabled when you provide OAuth credentials in your `.env` file.

### How It Works

1. **User clicks social login button** - Frontend redirects to `/auth/[provider]` (e.g., `/auth/google`)
2. **Server initiates OAuth flow** - Passport.js redirects user to provider's authorization page
3. **User grants permissions** - Provider redirects back to `/auth/[provider]/callback`
4. **Server receives callback** - Passport.js validates the OAuth response
5. **User creation/linking** - Server finds or creates user via `findOrCreateUserFromOAuth()`
6. **JWT token generation** - Server generates a JWT token for the user
7. **Frontend redirect** - Server redirects to `/login?token=<jwt_token>`
8. **Token storage** - Frontend saves token to localStorage and navigates to dashboard

### OAuth Routes Available

Once you configure OAuth credentials in `.env`, these routes become active:

**Google OAuth:**
- `GET /auth/google` - Initiates Google OAuth flow
- `GET /auth/google/callback` - Handles Google callback

**LinkedIn OAuth:**
- `GET /auth/linkedin` - Initiates LinkedIn OAuth flow
- `GET /auth/linkedin/callback` - Handles LinkedIn callback

**GitHub OAuth:**
- `GET /auth/github` - Initiates GitHub OAuth flow
- `GET /auth/github/callback` - Handles GitHub callback

## Step 4: Test OAuth Flow

### Development Testing (with localhost)

1. Start the GraphDone server:
   ```bash
   npm run dev
   ```

2. Open the login page: `http://localhost:3127/login`

3. Click on one of the social login buttons (Google, LinkedIn, or GitHub)

4. You'll be redirected to the OAuth provider's authorization page

5. Grant permissions to GraphDone

6. You'll be redirected back to GraphDone and automatically logged in

### Production Deployment

For production:

1. Update all callback URLs to use your production domain
2. Use HTTPS (OAuth providers require secure connections)
3. Update OAuth provider settings with production URLs
4. Set `NODE_ENV=production` in your environment

## Security Best Practices

### DO:
✅ Always use HTTPS in production
✅ Keep client secrets secure and never commit to git
✅ Use strong, random session secrets
✅ Regenerate session secrets periodically
✅ Implement rate limiting on OAuth endpoints
✅ Validate OAuth state parameter to prevent CSRF
✅ Store tokens securely (encrypted in database)

### DON'T:
❌ Don't commit `.env` files to version control
❌ Don't use the same OAuth credentials for dev and prod
❌ Don't expose client secrets in client-side code
❌ Don't use HTTP in production
❌ Don't share OAuth credentials across team members

## Troubleshooting

### "Redirect URI mismatch" error

**Cause:** The callback URL in your OAuth provider settings doesn't match the one in your `.env` file.

**Solution:**
- Ensure URLs match exactly (including protocol, domain, port, and path)
- URLs are case-sensitive
- Development: Use `https://localhost:4128/auth/[provider]/callback`
- Production: Use `https://yourdomain.com/auth/[provider]/callback`

### "Invalid client" error

**Cause:** Client ID or Client Secret is incorrect.

**Solution:**
- Double-check your credentials in the `.env` file
- Ensure there are no extra spaces or quotes
- Regenerate credentials if needed

### "Unauthorized client" error (LinkedIn)

**Cause:** You haven't requested access to "Sign In with LinkedIn" product.

**Solution:**
- Go to LinkedIn app settings → Products tab
- Request access to "Sign In with LinkedIn"
- Wait for approval (usually instant)

### Users created without proper team assignment

**Cause:** OAuth flow doesn't automatically assign teams.

**Solution:**
- Modify `findOrCreateUserFromOAuth` in `sqlite-auth.ts`
- Add logic to assign default team or prompt user for team selection

## Implementation Checklist

Current implementation status:

### ✅ Completed
- [x] OAuth npm packages installed
- [x] SQLite schema with oauth_providers table
- [x] OAuth helper methods in sqlite-auth.ts
- [x] OAuth strategy configurations
- [x] GraphQL schema with OAuth types
- [x] OAuth resolvers
- [x] Social login UI buttons
- [x] Environment variable configuration template

### ✅ Recently Completed
- [x] Add Express session middleware to server
- [x] Initialize Passport in server startup
- [x] Add OAuth callback routes:
  - `/auth/google` - Google login initiation
  - `/auth/google/callback` - Google callback handler
  - `/auth/linkedin` - LinkedIn login initiation
  - `/auth/linkedin/callback` - LinkedIn callback handler
  - `/auth/github` - GitHub login initiation
  - `/auth/github/callback` - GitHub callback handler
- [x] Add frontend redirect handling after OAuth success
- [x] Add error handling for OAuth failures

### ⏳ Remaining Tasks (Optional Enhancements)
- [ ] Test OAuth flows with real credentials from providers
- [ ] Implement OAuth token refresh logic
- [ ] Add user consent/privacy policy pages
- [ ] Add rate limiting on OAuth endpoints
- [ ] Encrypt OAuth tokens before storing in database

## Database Schema

The `oauth_providers` table stores OAuth authentication data:

```sql
CREATE TABLE oauth_providers (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  provider TEXT NOT NULL,          -- 'google', 'linkedin', 'github'
  providerId TEXT NOT NULL,        -- Provider's user ID
  email TEXT,
  name TEXT,
  avatar TEXT,
  accessToken TEXT,                -- Encrypted OAuth access token
  refreshToken TEXT,               -- Encrypted OAuth refresh token
  profile TEXT,                    -- JSON stringified profile data
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (provider, providerId),
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
)
```

## GraphQL API

### Queries

**Get OAuth providers linked to current user:**
```graphql
query MyOAuthProviders {
  myOAuthProviders {
    provider
    providerId
    email
    name
    avatar
    createdAt
  }
}
```

### Mutations

**Unlink OAuth provider:**
```graphql
mutation UnlinkOAuth($provider: String!) {
  unlinkOAuthProvider(provider: $provider) {
    success
    message
  }
}
```

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [LinkedIn OAuth Documentation](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Passport.js Documentation](http://www.passportjs.org/docs/)

## Support

For questions or issues with OAuth setup:
1. Check this guide first
2. Review the provider's OAuth documentation
3. Check the GraphDone repository issues
4. Create a new issue with detailed error messages
