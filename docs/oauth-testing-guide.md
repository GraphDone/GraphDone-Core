# OAuth Testing Guide

## Quick Start

### Running OAuth Tests

```bash
# Run all LinkedIn OAuth tests
npm run test:e2e -- tests/e2e/oauth-linkedin.spec.ts

# Run specific test
npx playwright test tests/e2e/oauth-linkedin.spec.ts --grep "LinkedIn user → GraphDone tester"

# Run with UI mode for debugging
npx playwright test tests/e2e/oauth-linkedin.spec.ts --ui
```

### Test Results Summary

**13 LinkedIn OAuth Tests:**
- ✅ OIDC scopes validation
- ✅ Correct endpoints validation
- ✅ Profile structure validation
- ✅ Email verification handling
- ✅ Token storage validation
- ⚠️ Identified critical bug: tokens not saved

## What's Included

### 1. Official Documentation (`docs/oauth-implementation.md`)

**Comprehensive guide with:**
- ✅ Official spec links for Google, GitHub, LinkedIn
- ✅ Latest version tracking (2024 specs)
- ✅ Environment setup instructions
- ✅ Change tracking system
- ✅ Monthly review checklist
- ✅ Known issues and technical debt

**Key Sections:**
- Provider documentation with official links
- Implementation status per provider
- Environment variables required
- OAuth app setup guides
- Change tracking & compliance monitoring
- Security best practices
- Known issues prioritization

### 2. Mock OAuth Server (`tests/helpers/mock-oauth-server.ts`)

**Full-featured mock server:**
- ✅ Simulates Google OAuth 2.0
- ✅ Simulates GitHub OAuth
- ✅ Simulates LinkedIn OpenID Connect
- ✅ Handles authorization → token → profile flow
- ✅ Configurable success/error scenarios

**Usage:**
```typescript
import { startMockOAuthServer } from '../helpers/mock-oauth-server';

const mockServer = await startMockOAuthServer({ port: 9876 });
// Use in tests
await mockServer.stop();
```

### 3. Test Fixtures (`tests/fixtures/oauth-profiles.ts`)

**Complete test data:**
- ✅ Google profile (latest API format)
- ✅ GitHub profile (latest API format)
- ✅ LinkedIn OIDC profile (post-migration)
- ✅ Token responses
- ✅ Error scenarios
- ✅ Multiple user types

**Available Fixtures:**
- `GOOGLE_PROFILE_FIXTURE`
- `GITHUB_PROFILE_FIXTURE`
- `LINKEDIN_PROFILE_FIXTURE`
- `OAUTH_TEST_USERS` (standard, minimal, no-email, enterprise)
- `OAUTH_ERROR_FIXTURES`

### 4. LinkedIn E2E Tests (`tests/e2e/oauth-linkedin.spec.ts`)

**Comprehensive test suite:**
- ✅ Full user flow documentation
- ✅ OIDC compliance validation
- ✅ Endpoint validation
- ✅ Scope validation
- ✅ Profile extraction
- ✅ Error handling
- ✅ Friction analysis

## Critical Findings

### 🔴 HIGH PRIORITY: LinkedIn Tokens Not Saved

**File:** `packages/server/src/auth/oauth-strategies.ts`
**Lines:** 69-70

**Current (BROKEN):**
```typescript
accessToken: '',
refreshToken: '',
```

**Should be:**
```typescript
accessToken: _accessToken,
refreshToken: _refreshToken,
```

**Impact:**
- Cannot refresh expired tokens
- Cannot make LinkedIn API calls on behalf of user
- Limited functionality

### ⚠️ MEDIUM PRIORITY: Package Cleanup

**Remove deprecated packages:**
```json
// In package.json, remove:
"passport-linkedin-oauth2": "^2.0.0",
"@types/passport-linkedin-oauth2": "^1.5.6",
```

**Why:**
- LinkedIn deprecated OAuth 2.0 in August 2023
- Now uses OpenID Connect exclusively
- We already use `passport-openidconnect` (correct)

### 💡 LOW PRIORITY: HTTPS in Development

**Current dev callback:**
```
http://localhost:4127/auth/linkedin/callback
```

**Recommended:**
```
https://localhost:4128/auth/linkedin/callback
```

**Note:** LinkedIn allows HTTP for localhost, so this is optional.

## LinkedIn → GraphDone Tester Flow

### Complete User Journey (11 Steps)

1. LinkedIn user visits GraphDone
2. Sees "Sign in with LinkedIn" button
3. Clicks button → redirects to LinkedIn
4. LinkedIn shows authorization screen
5. User approves (openid, profile, email)
6. LinkedIn redirects back with auth code
7. GraphDone exchanges code for tokens
8. GraphDone fetches user profile (/v2/userinfo)
9. GraphDone creates/updates user in SQLite
10. GraphDone issues JWT token
11. User logged into GraphDone ✅

### Requirements for Seamless Flow

**LinkedIn Setup:**
- ✅ LinkedIn app created at https://www.linkedin.com/developers/apps
- ✅ "Sign In with LinkedIn using OpenID Connect" enabled
- ✅ Redirect URL: `https://localhost:4128/auth/linkedin/callback`

**User Requirements:**
- ⚠️ Email must be verified on LinkedIn profile
- ⚠️ User must approve permissions (openid, profile, email)

**GraphDone Config:**
```bash
# .env
LINKEDIN_CLIENT_ID=<from-linkedin-app>
LINKEDIN_CLIENT_SECRET=<from-linkedin-app>
LINKEDIN_CALLBACK_URL=https://localhost:4128/auth/linkedin/callback
```

### Friction Points & Solutions

| Issue | Severity | Solution |
|-------|----------|----------|
| Email not verified | HIGH | Prompt user to verify on LinkedIn first |
| Dev mode limit (100 users) | MEDIUM | Submit app for LinkedIn verification |
| Tokens not saved | HIGH | Fix oauth-strategies.ts lines 69-70 |
| HTTP callback in dev | LOW | Use HTTPS even locally |

## Official Resources

### Google OAuth 2.0
- **Docs:** https://developers.google.com/identity/protocols/oauth2
- **Console:** https://console.cloud.google.com/apis/credentials
- **Migration:** https://developers.google.com/identity/gsi/web/guides/migration

### GitHub OAuth
- **Docs:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- **Settings:** https://github.com/settings/developers
- **Scopes:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps

### LinkedIn OpenID Connect
- **Docs:** https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- **Portal:** https://www.linkedin.com/developers/apps
- **Migration FAQ:** https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/migration-faq

## Change Tracking

### Monthly Review Process

**Checklist (Review every month on 12th):**
- [ ] Check Google OAuth changelog
- [ ] Check GitHub OAuth changelog
- [ ] Check LinkedIn OIDC updates
- [ ] Update library versions if needed
- [ ] Verify scopes still valid
- [ ] Test OAuth flows in staging
- [ ] Update documentation

**Last Review:** Never
**Next Review:** 2025-12-12

### Version History

| Date | Provider | Change | Status |
|------|----------|--------|--------|
| 2023-08-01 | LinkedIn | OAuth 2.0 → OIDC | ✅ Implemented |
| TBD | LinkedIn | Remove deprecated package | ⚠️ Pending |

## Next Steps

### Immediate (Before Testing with Real Users)

1. **Fix token storage bug:**
   ```bash
   vim packages/server/src/auth/oauth-strategies.ts
   # Fix lines 69-70
   ```

2. **Test with real LinkedIn account:**
   ```bash
   # Set up .env with real credentials
   ./start
   # Try LinkedIn login
   ```

3. **Remove deprecated packages:**
   ```bash
   npm uninstall passport-linkedin-oauth2 @types/passport-linkedin-oauth2
   ```

### Future Enhancements

1. **Add Google & GitHub E2E tests**
2. **Implement token refresh mechanism**
3. **Add OAuth rate limiting**
4. **Add account linking (multiple providers → one account)**
5. **Add profile sync (detect LinkedIn profile changes)**
6. **Submit LinkedIn app for verification** (removes 100-user limit)

## Testing Strategy

### Unit Tests (TODO)
- Test profile extraction logic
- Test error handling
- Test token validation

### Integration Tests (TODO)
- Test with mock OAuth server
- Test callback handling
- Test user creation/update

### E2E Tests (✅ LinkedIn, TODO: Google/GitHub)
- Full OAuth flow
- Error scenarios
- UI interaction

### Manual Testing
1. Create test LinkedIn app
2. Configure callback URL
3. Try sign in flow
4. Verify user creation
5. Check token storage
6. Test logout

## Troubleshooting

### "Email not found in LinkedIn profile"
- User hasn't verified email on LinkedIn
- User privacy settings hide email
- Solution: Ask user to verify email and make it visible

### "LinkedIn OAuth not configured"
- Missing environment variables
- Solution: Add LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET to .env

### "Too many test users"
- Development mode limited to 100 users
- Solution: Submit app for LinkedIn verification

### "Redirect URI mismatch"
- Callback URL doesn't match LinkedIn app config
- Solution: Verify exact match including https/http and trailing slash

## Support

**Documentation:**
- Implementation guide: `docs/oauth-implementation.md`
- This testing guide: `docs/oauth-testing-guide.md`

**Code:**
- OAuth strategies: `packages/server/src/auth/oauth-strategies.ts`
- OAuth routes: `packages/server/src/routes/auth.ts`
- Mock server: `tests/helpers/mock-oauth-server.ts`
- Test fixtures: `tests/fixtures/oauth-profiles.ts`
- LinkedIn tests: `tests/e2e/oauth-linkedin.spec.ts`

**External:**
- LinkedIn support: https://www.linkedin.com/help/linkedin/answer/a1348627
- Google support: https://support.google.com/cloud/answer/6158849
- GitHub support: https://docs.github.com/en/support
