# GraphDone Testing Documentation

This directory contains the comprehensive testing suite for GraphDone, including E2E tests, unit tests, and testing utilities.

## 🧪 Test Structure

```
tests/
├── helpers/
│   └── auth.ts              # 🔑 Authentication system for E2E tests
├── e2e/
│   ├── auth-basic-test.spec.ts       # Authentication system validation
│   ├── relationship-flip.spec.ts     # Relationship flip functionality tests  
│   └── user-workflow-robust.spec.ts  # Complete user workflow tests
└── README.md                # This file
```

## 🔑 Authentication System for E2E Tests

**Location**: `tests/helpers/auth.ts`

This is the **foundational authentication system** that ALL E2E tests should use. It provides robust, cross-browser authentication with intelligent state management.

### Quick Start

```typescript
import { login, navigateToWorkspace, TEST_USERS } from '../helpers/auth';

test('my feature test', async ({ page }) => {
  // Login as admin (handles all edge cases automatically)
  await login(page, TEST_USERS.ADMIN);
  
  // Navigate to workspace (ensures full readiness)
  await navigateToWorkspace(page);
  
  // Your test code here - you're now authenticated and ready!
});
```

### Core Functions

#### `login(page, credentials?, options?)`
**The primary authentication function**. Use this for all E2E tests.

```typescript
// Basic usage
await login(page, TEST_USERS.ADMIN);

// With options
await login(page, TEST_USERS.MEMBER, {
  retries: 3,        // Number of retry attempts (default: 3)
  timeout: 30000,    // Timeout in milliseconds (default: 30000)
  skipIfLoggedIn: true,  // Skip if already logged in (default: true)
  forceReauth: false     // Force re-authentication (default: false)
});
```

**Features:**
- ✅ **Cross-browser compatibility** (Chromium, Firefox, WebKit)
- ✅ **Automatic retry logic** with exponential backoff
- ✅ **Multiple login strategies** (form login, quick login, guest access)
- ✅ **Smart state detection** - skips login if already authenticated
- ✅ **Comprehensive error handling** with detailed logging
- ✅ **Session persistence** across page reloads

#### `navigateToWorkspace(page)`
**Navigate to workspace with full readiness verification**.

```typescript
await navigateToWorkspace(page);
```

**Features:**
- ✅ **Automatic login check** - ensures user is logged in first
- ✅ **Workspace readiness verification** - waits for all elements to load
- ✅ **Graph selection handling** - automatically selects available graphs
- ✅ **React hydration waiting** - allows time for client-side rendering

#### `getAuthState(page)`
**Get detailed authentication state information**.

```typescript
const authState = await getAuthState(page);
console.log(authState);
// {
//   isLoggedIn: true,
//   currentUrl: "http://localhost:3127/",
//   userIndicators: ["[data-testid=\"graph-selector\"]"],
//   errors: []
// }
```

### Test User Credentials

```typescript
export const TEST_USERS = {
  ADMIN: {
    username: 'admin',
    password: 'graphdone',
    role: 'admin'
  },
  MEMBER: {
    username: 'member', 
    password: 'graphdone',
    role: 'member'
  },
  VIEWER: {
    username: 'viewer',
    password: 'graphdone', 
    role: 'viewer'
  },
  GUEST: {
    username: '',
    password: '',
    role: 'guest'
  }
};
```

### Utility Functions

#### `createTestGraph(page, options?)`
**Create a test graph for tests that need specific graph contexts**.

```typescript
const graphName = await createTestGraph(page, {
  name: 'My Test Graph',
  description: 'Graph for testing node creation',
  type: 'PROJECT'
});
```

#### `cleanupAuth(page)`
**Clean up authentication state after tests**.

```typescript
test.afterEach(async ({ page }) => {
  await cleanupAuth(page);
});
```

#### `logout(page)`, `isLoggedIn(page)`, `ensureLoggedIn(page)`
**Additional authentication utilities for specific use cases**.

### Advanced Usage

#### Custom Authentication Flow

```typescript
import { 
  login, 
  getAuthState, 
  waitForAuthentication,
  TEST_USERS 
} from '../helpers/auth';

test('complex auth flow', async ({ page }) => {
  // Check current state
  let authState = await getAuthState(page);
  console.log('Initial state:', authState);
  
  // Login with custom retry logic
  await login(page, TEST_USERS.ADMIN, { retries: 1 });
  
  // Wait for specific authentication completion
  await waitForAuthentication(page, {
    timeout: 15000,
    expectedUrl: '/workspace'
  });
  
  // Verify final state
  authState = await getAuthState(page);
  expect(authState.isLoggedIn).toBe(true);
});
```

#### Error Handling

```typescript
test('authentication error handling', async ({ page }) => {
  try {
    await login(page, {
      username: 'invalid_user',
      password: 'wrong_password'  
    }, { retries: 1 });
  } catch (error) {
    console.log('Expected authentication failure:', error.message);
    // Test error recovery
    await login(page, TEST_USERS.ADMIN);
  }
});
```

## 🚀 Running Tests

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- tests/e2e/auth-basic-test.spec.ts

# Run with specific browser
npm run test:e2e -- --project=chromium

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Run with single worker for debugging
npm run test:e2e -- --workers=1
```

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Scripts

```bash
# Run all tests (E2E + unit + linting)
npm run test

# Advanced testing with coverage
./tools/test.sh --coverage

# Test specific package
./tools/test.sh --package core
```

## 📏 Testing Standards

### Authentication Requirements

**✅ DO:**
```typescript
// Use the centralized auth system
import { login, TEST_USERS } from '../helpers/auth';
await login(page, TEST_USERS.ADMIN);
```

**❌ DON'T:**
```typescript
// Don't implement custom login logic
await page.goto('/login');
await page.fill('[name="username"]', 'admin');
// ... custom implementation
```

### Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, cleanupAuth, TEST_USERS } from '../helpers/auth';

test.describe('Feature Name', () => {
  test.afterEach(async ({ page }) => {
    await cleanupAuth(page); // Always clean up
  });

  test('should do something specific', async ({ page }) => {
    // 1. Authentication
    await login(page, TEST_USERS.ADMIN);
    
    // 2. Navigation
    await navigateToWorkspace(page);
    
    // 3. Test logic
    // ... your test code
    
    // 4. Assertions
    expect(result).toBe(expected);
  });
});
```

### Error Handling

- **Always use `cleanupAuth()`** in `afterEach` hooks
- **Handle authentication failures gracefully** with try/catch
- **Log detailed state information** for debugging
- **Use meaningful assertion messages**

### Performance

- **Use `--workers=1`** for debugging flaky tests
- **Leverage smart login detection** to skip redundant authentication
- **Clean up properly** to avoid state pollution between tests

## 🔍 Debugging Tests

### Common Issues

1. **Authentication Failures**
   - Check if development server is running
   - Verify credentials in `TEST_USERS`
   - Use `getAuthState()` to debug state issues

2. **Element Not Found**
   - Ensure `navigateToWorkspace()` completed
   - Add appropriate `waitForTimeout()` calls
   - Use Playwright's `--headed` mode to see what's happening

3. **GraphQL Connection Errors**
   - Verify GraphQL server is running on correct port
   - Check browser console for CORS issues
   - Ensure database is properly seeded

### Debug Tools

```bash
# Run with browser visible
npm run test:e2e -- tests/e2e/my-test.spec.ts --headed

# Generate trace for analysis
npm run test:e2e -- --trace on

# Show Playwright report
npx playwright show-report
```

## 🎯 Examples

### Basic Feature Test
```typescript
test('should create new work item', async ({ page }) => {
  await login(page, TEST_USERS.ADMIN);
  await navigateToWorkspace(page);
  
  // Your feature testing code here
  const createButton = page.locator('[data-testid="create-work-item"]');
  await createButton.click();
  
  expect(await page.locator('.work-item-form').isVisible()).toBe(true);
});
```

### Complex Workflow Test
```typescript
test('should handle complete user workflow', async ({ page }) => {
  await login(page, TEST_USERS.ADMIN);
  
  const graphName = await createTestGraph(page, {
    name: 'Workflow Test Graph'
  });
  
  // Multi-step workflow
  // ... complex test logic
  
  expect(result).toMatchObject(expectedOutcome);
});
```

---

## 📞 Support

- **Authentication issues**: Check this README first
- **Test failures**: Use `--headed` mode for visual debugging  
- **Questions**: Review existing test files for patterns
- **Contributions**: Follow the testing standards above

**The authentication system is battle-tested across all browsers and handles edge cases gracefully. Use it as the foundation for all E2E tests!** 🔑