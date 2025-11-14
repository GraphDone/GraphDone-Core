import { driver } from '../db.js';
import { createSharedWelcomeGraph, sharedWelcomeGraphExists } from '../services/onboarding.js';

async function ensureSharedWelcomeGraph() {
  console.log('🎉 Ensuring shared Welcome graph exists...\n');

  try {
    const exists = await sharedWelcomeGraphExists(driver);

    if (exists) {
      console.log('⏭️  Shared Welcome graph already exists - skipping creation\n');
      console.log('========================================');
      console.log('     Welcome Graph Already Exists     ');
      console.log('========================================\n');
    } else {
      await createSharedWelcomeGraph(driver);
      console.log('✅ Shared Welcome graph created successfully!\n');
      console.log('========================================');
      console.log('     Welcome Graph Created            ');
      console.log('========================================');
      console.log('• Graph Name: Welcome');
      console.log('• Type: PROJECT');
      console.log('• Shared: Yes (all users can access)');
      console.log('• Permissions: Read-only for all users');
      console.log('• Contains: 6 tutorial nodes');
      console.log('========================================\n');
    }

  } catch (error: any) {
    console.error('❌ Failed to create shared Welcome graph:', error);
    process.exit(1);
  } finally {
    await driver.close();
    process.exit(0);
  }
}

ensureSharedWelcomeGraph();
