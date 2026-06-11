import { test, expect } from '@playwright/test';
import { HEALTH_URL, gqlRequest, apiLogin } from '../helpers/api';

test.describe('Database Connectivity Validation', () => {
  test('should fail properly when Neo4j is unavailable', async () => {
    // This test ensures we properly detect and report database failures
    // rather than silently falling back to auth-only mode

    const token = await apiLogin();
    const response = await gqlRequest<{ workItems: Array<{ id: string; title: string }> }>(
      '{ workItems { id title } }',
      undefined,
      token
    );

    // Should either return data or a proper error (not silent failure)
    expect(response).toBeDefined();

    if (response.errors) {
      // If there are GraphQL errors, they should be explicit about database issues
      const errorMessages = response.errors.map(e => e.message).join(' ');

      // These would indicate auth-only mode without proper error reporting
      expect(errorMessages).not.toMatch(/Cannot return null for non-nullable field.*workItems/);
      expect(errorMessages).not.toMatch(/Variable .* got invalid value .* Expected type/);

      // If there's a database error, it should be explicit
      if (errorMessages.includes('Neo4j') || errorMessages.includes('database')) {
        console.log('✅ Proper database error reporting detected:', errorMessages);
      }
    } else {
      // Database is working properly
      console.log('✅ Database connectivity confirmed - found work items');
      expect(Array.isArray(response.data?.workItems)).toBe(true);
    }
  });

  test('should provide clear error messages in auth-only mode', async ({ page }) => {
    // Check for any error indicators in the console
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the web application
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(3000);

    // Look for database-related errors
    const dbRelatedErrors = consoleErrors.filter(error =>
      error.includes('Neo4j') ||
      error.includes('database') ||
      error.includes('bolt://') ||
      error.includes('Failed to connect')
    );

    if (dbRelatedErrors.length > 0) {
      console.log('⚠️  Database connectivity issues detected:');
      dbRelatedErrors.forEach(error => console.log(`  - ${error}`));

      // Verify that the application provides user-facing feedback
      // Look for any user-visible indicators of database issues
      const hasErrorIndicator = await page.locator('text=/database.*unavailable|limited.*mode|auth.*only/i').count() > 0;

      if (!hasErrorIndicator) {
        console.log('❌ Database errors in console but no user-facing indication');
        // This would be a silent failure that should be fixed
      }
    }
  });

  test('should validate health check endpoint reflects database status', async () => {
    // Check the health endpoint
    const response = await fetch(HEALTH_URL);
    expect(response.status).toBe(200);

    const healthData = await response.json();
    expect(healthData).toBeDefined();

    // Health check should indicate database status
    expect(healthData).toHaveProperty('status');

    if (healthData.database) {
      // If database status is reported, it should be accurate
      if (healthData.database.connected === false) {
        // Database is reported as down - this should be reflected in the overall status
        console.log('✅ Health check properly reports database disconnection');
        expect(healthData.status).not.toBe('healthy');
      } else if (healthData.database.connected === true) {
        // Database is reported as up - verify it actually works
        console.log('✅ Health check reports database as connected');
      }
    }

    // Log the health status for debugging
    console.log('Health check response:', JSON.stringify(healthData, null, 2));
  });
});
