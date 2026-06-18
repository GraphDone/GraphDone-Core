# GraphDone Testing Helpers

This directory contains testing utilities and helpers for GraphDone E2E tests.

## 🔑 Authentication System (`auth.ts`)

**THE FOUNDATION FOR ALL E2E TESTS** - This is the robust, cross-browser authentication system that every E2E test should use.

### Quick Start

```typescript
import { login, navigateToWorkspace, TEST_USERS } from './auth';

test('my test', async ({ page }) => {
  await login(page, TEST_USERS.ADMIN);
  await navigateToWorkspace(page);
  // Your test code here - fully authenticated!
});
```

### Why Use This System?

✅ **Cross-browser tested** (Chromium, Firefox, WebKit)
✅ **Handles all edge cases** (connection failures, timeouts, UI changes)  
✅ **Smart retry logic** with exponential backoff
✅ **Skips redundant logins** for better performance
✅ **Comprehensive logging** for easy debugging
✅ **Session cleanup** for test isolation

### Available Functions

- `login(page, credentials?, options?)` - Main authentication function
- `navigateToWorkspace(page)` - Navigate to workspace with readiness verification
- `getAuthState(page)` - Get current authentication status
- `createTestGraph(page, options?)` - Create test graphs
- `logout(page)` - Clean logout with multiple strategies
- `cleanupAuth(page)` - Complete session cleanup for teardown

### Test Credentials

```typescript
TEST_USERS = {
  ADMIN: { username: 'admin', password: 'graphdone', role: 'admin' },
  MEMBER: { username: 'member', password: 'graphdone', role: 'member' },
  VIEWER: { username: 'viewer', password: 'graphdone', role: 'viewer' },
  GUEST: { username: '', password: '', role: 'guest' }
}
```

## 📚 Documentation

For complete documentation and examples, see: **[../README.md](../README.md)**

## 🚨 Important

**DO NOT create custom authentication logic in your tests.** Use this system instead to ensure:
- Consistency across all tests
- Proper error handling
- Cross-browser compatibility
- Easier maintenance

---

*This authentication system was battle-tested across all browsers and handles every edge case we've encountered. Trust it and use it!* 🔑