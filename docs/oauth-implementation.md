# OAuth Implementation & Compliance Guide

## Overview

GraphDone implements OAuth 2.0 authentication for seamless third-party login. This document tracks our implementation against official provider specifications and provides a changelog for maintaining compliance.

---

## Official Provider Documentation

### 🔵 Google OAuth 2.0

**Current Spec Version:** OAuth 2.0 (2024)
**Official Documentation:** https://developers.google.com/identity/protocols/oauth2
**Developer Console:** https://console.cloud.google.com/apis/credentials

**Key Resources:**
- **OpenID Connect:** https://developers.google.com/identity/openid-connect/openid-connect
- **Scopes Reference:** https://developers.google.com/identity/protocols/oauth2/scopes
- **Migration Guides:** https://developers.google.com/identity/gsi/web/guides/migration
- **Security Best Practices:** https://developers.google.com/identity/protocols/oauth2/production-readiness

**Latest Changes (2024):**
- ✅ OAuth 2.0 remains stable
- ⚠️ Google Identity Services (GIS) recommended for new apps
- ✅ `passport-google-oauth20` still supported

**Implementation Library:**
- Package: `passport-google-oauth20` v2.0.0
- NPM: https://www.npmjs.com/package/passport-google-oauth20
- GitHub: https://github.com/jaredhanson/passport-google-oauth2

---

### 🟣 GitHub OAuth

**Current Spec Version:** OAuth 2.0 (2024)
**Official Documentation:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
**Developer Settings:** https://github.com/settings/developers

**Key Resources:**
- **OAuth Apps:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- **Scopes:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- **Best Practices:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app
- **Rate Limits:** https://docs.github.com/en/rest/rate-limit

**Latest Changes (2024):**
- ✅ OAuth 2.0 remains stable
- ⚠️ Fine-grained personal access tokens (beta)
- ⚠️ GitHub Apps recommended over OAuth Apps for new integrations

**Implementation Library:**
- Package: `passport-github2` v0.1.12
- NPM: https://www.npmjs.com/package/passport-github2
- GitHub: https://github.com/cfsghost/passport-github

---

### 🔷 LinkedIn OpenID Connect

**Current Spec Version:** OpenID Connect (OIDC) - Migrated 2023
**Official Documentation:** https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
**Developer Portal:** https://www.linkedin.com/developers/apps

**Key Resources:**
- **Sign In with LinkedIn v2:** https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- **OpenID Connect:** https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2#openid-connect-oidc
- **Migration Guide (OAuth 2.0 → OIDC):** https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/migration-faq
- **Scopes:** https://learn.microsoft.com/en-us/linkedin/shared/references/v2/profile

**CRITICAL: LinkedIn OAuth 2.0 Deprecated in 2023**
- ⚠️ **Old OAuth 2.0 endpoints disabled August 1, 2023**
- ✅ **Must use OpenID Connect (OIDC)**
- ⚠️ `passport-linkedin-oauth2` is DEPRECATED
- ✅ Use `passport-openidconnect` (currently implemented)

**Latest Changes (2023-2024):**
- ⚠️ **August 1, 2023:** OAuth 2.0 deprecated, OIDC required
- ✅ **OpenID Connect mandatory** for all new integrations
- ⚠️ Different scopes: `openid`, `profile`, `email`
- ⚠️ User info endpoint changed to `/v2/userinfo`

**Implementation Library:**
- Package: `passport-openidconnect` v0.1.1
- NPM: https://www.npmjs.com/package/passport-openidconnect
- GitHub: https://github.com/jaredhanson/passport-openidconnect

**⚠️ CLEANUP NEEDED:**
- Remove `passport-linkedin-oauth2` from package.json (deprecated)
- Remove `@types/passport-linkedin-oauth2` from package.json

---

## GraphDone Implementation Status

### ✅ Google OAuth 2.0 - COMPLIANT

**File:** `packages/server/src/auth/oauth-strategies.ts:8-39`

**Configuration:**
```typescript
clientID: process.env.GOOGLE_CLIENT_ID
clientSecret: process.env.GOOGLE_CLIENT_SECRET
callbackURL: https://localhost:4128/auth/google/callback
scope: ['profile', 'email']
```

**Compliance:**
- ✅ Using latest stable OAuth 2.0
- ✅ Correct scopes
- ✅ HTTPS callback URL
- ✅ Profile data extraction matches spec
- ⚠️ No token refresh handling

**Test Coverage:** ❌ None

---

### ✅ GitHub OAuth - COMPLIANT

**File:** `packages/server/src/auth/oauth-strategies.ts:83-115`

**Configuration:**
```typescript
clientID: process.env.GITHUB_CLIENT_ID
clientSecret: process.env.GITHUB_CLIENT_SECRET
callbackURL: https://localhost:4128/auth/github/callback
scope: ['user:email']
```

**Compliance:**
- ✅ Using latest OAuth 2.0
- ✅ Minimal scope (user:email)
- ✅ HTTPS callback URL
- ✅ Profile data extraction matches spec
- ⚠️ No token refresh handling

**Test Coverage:** ❌ None

---

### ⚠️ LinkedIn OpenID Connect - PARTIALLY COMPLIANT

**File:** `packages/server/src/auth/oauth-strategies.ts:41-81`

**Configuration:**
```typescript
issuer: https://www.linkedin.com/oauth
authorizationURL: https://www.linkedin.com/oauth/v2/authorization
tokenURL: https://www.linkedin.com/oauth/v2/accessToken
userInfoURL: https://api.linkedin.com/v2/userinfo
scope: ['openid', 'profile', 'email']
```

**Compliance:**
- ✅ Using OpenID Connect (OIDC)
- ✅ Correct scopes
- ✅ Correct userinfo endpoint
- ⚠️ No token storage (accessToken, refreshToken empty)
- ⚠️ Package cleanup needed in package.json
- ⚠️ HTTP callback URL in dev (should be HTTPS)

**Issues:**
```typescript
// Line 69-70: Tokens not saved!
accessToken: '',
refreshToken: '',
```

**Test Coverage:** ❌ None

---

## Environment Variables Required

### Google OAuth
```bash
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALLBACK_URL=https://localhost:4128/auth/google/callback
```

### GitHub OAuth
```bash
GITHUB_CLIENT_ID=<your-client-id>
GITHUB_CLIENT_SECRET=<your-client-secret>
GITHUB_CALLBACK_URL=https://localhost:4128/auth/github/callback
```

### LinkedIn OIDC
```bash
LINKEDIN_CLIENT_ID=<your-client-id>
LINKEDIN_CLIENT_SECRET=<your-client-secret>
LINKEDIN_CALLBACK_URL=https://localhost:4128/auth/linkedin/callback  # Should be HTTPS
```

---

## Setting Up OAuth Applications

### Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Create Project → "GraphDone"
3. Create OAuth 2.0 Client ID
4. Application type: Web application
5. Authorized redirect URIs:
   - Development: `https://localhost:4128/auth/google/callback`
   - Production: `https://yourdomain.com/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

**Testing Account:**
- Use any Google account
- No special permissions needed

---

### GitHub Developer Settings

1. Go to: https://github.com/settings/developers
2. New OAuth App
3. Application name: "GraphDone (Dev)"
4. Homepage URL: `https://localhost:3128`
5. Authorization callback URL: `https://localhost:4128/auth/github/callback`
6. Copy Client ID and Client Secret to `.env`

**Testing Account:**
- Use your GitHub account
- Email must be verified and public (or set primary email visibility)

---

### LinkedIn Developer Portal

1. Go to: https://www.linkedin.com/developers/apps
2. Create app
3. Product access → Request "Sign In with LinkedIn using OpenID Connect"
4. Auth → Add redirect URLs:
   - Development: `https://localhost:4128/auth/linkedin/callback`
   - Production: `https://yourdomain.com/auth/linkedin/callback`
5. Copy Client ID and Client Secret to `.env`

**CRITICAL for Testing:**
- ⚠️ **LinkedIn verification required** for production use
- ✅ **Self-testing allowed** during development
- ⚠️ **Limited to 100 test users** in development mode
- ⚠️ **Email must be verified** on LinkedIn profile

**LinkedIn → GraphDone Tester Flow:**
1. LinkedIn user visits GraphDone
2. Clicks "Sign in with LinkedIn"
3. Redirected to LinkedIn for authorization
4. Grants permission (openid, profile, email)
5. Redirected back to GraphDone with auth code
6. GraphDone exchanges code for tokens
7. Fetches user profile from `/v2/userinfo`
8. Creates/updates user in SQLite
9. Issues JWT token
10. User logged into GraphDone

---

## Change Tracking & Compliance Monitoring

### Monthly Review Checklist

**Last Review:** Never
**Next Review:** 2025-12-12

- [ ] Check Google OAuth changelog: https://developers.google.com/identity/protocols/oauth2/release-notes
- [ ] Check GitHub OAuth changelog: https://github.blog/changelog/
- [ ] Check LinkedIn OIDC updates: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/migration-faq
- [ ] Update library versions if security patches available
- [ ] Verify all scopes still valid
- [ ] Test OAuth flows in staging
- [ ] Update this document with changes

### Version History

| Date | Provider | Change | Action Required |
|------|----------|--------|-----------------|
| 2023-08-01 | LinkedIn | OAuth 2.0 → OIDC migration | ✅ Implemented `passport-openidconnect` |
| TBD | LinkedIn | Remove deprecated package | ⚠️ Cleanup `passport-linkedin-oauth2` |

---

## Security Best Practices

### Token Storage
- ✅ Tokens stored in SQLite (encrypted at rest recommended)
- ⚠️ No token refresh mechanism
- ⚠️ No token expiry handling
- ⚠️ LinkedIn tokens not stored (bug)

### HTTPS Requirements
- ✅ Google: HTTPS callback URL
- ✅ GitHub: HTTPS callback URL
- ⚠️ LinkedIn: HTTP in dev (should be HTTPS)
- ✅ Production: All HTTPS

### Scope Minimization
- ✅ Google: Only profile + email
- ✅ GitHub: Only user:email
- ✅ LinkedIn: Only openid + profile + email

### CSRF Protection
- ✅ Passport handles state parameter
- ⚠️ No explicit CSRF validation in routes

---

## Known Issues & Technical Debt

### High Priority
1. **LinkedIn token storage** - Tokens not saved (lines 69-70)
2. **No token refresh** - Expired tokens not handled
3. **Package cleanup** - Remove `passport-linkedin-oauth2`

### Medium Priority
4. **No OAuth tests** - Zero test coverage
5. **No error handling** - Failed OAuth attempts not logged
6. **No rate limiting** - No protection against OAuth abuse

### Low Priority
7. **No user profile sync** - Profile changes not detected
8. **No account linking** - Can't link multiple OAuth providers to one account

---

## Testing Strategy (TO BE IMPLEMENTED)

### Mock OAuth Server
- Simulate Google OAuth responses
- Simulate GitHub OAuth responses
- Simulate LinkedIn OIDC responses
- Test success and error scenarios

### E2E Tests
- Full OAuth flow per provider
- Token exchange validation
- Profile data extraction
- Error handling

### Compliance Tests
- Scope validation
- Redirect URI validation
- Token format validation
- Profile schema validation

---

## References

### OAuth 2.0 Specification
- RFC 6749: https://datatracker.ietf.org/doc/html/rfc6749
- RFC 6750 (Bearer Tokens): https://datatracker.ietf.org/doc/html/rfc6750

### OpenID Connect Specification
- Core Spec: https://openid.net/specs/openid-connect-core-1_0.html
- Discovery: https://openid.net/specs/openid-connect-discovery-1_0.html

### Security
- OAuth 2.0 Security Best Practices: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics
- OAuth 2.0 Threat Model: https://datatracker.ietf.org/doc/html/rfc6819

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-12
**Maintained By:** GraphDone Team
**Review Frequency:** Monthly
