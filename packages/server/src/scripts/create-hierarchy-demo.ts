import { driver } from '../db.js';
import { createHierarchyDemo, hierarchyDemoExists, deleteHierarchyDemo } from '../services/hierarchyDemo.js';

async function ensureHierarchyDemo() {
  const force = process.argv.includes('--force');
  console.log(`🏗️  Ensuring hierarchical "graphs of graphs" demo exists${force ? ' (force reseed)' : ''}...\n`);
  try {
    if (force && (await hierarchyDemoExists(driver))) {
      await deleteHierarchyDemo(driver);
    }
    if (!force && (await hierarchyDemoExists(driver))) {
      console.log('⏭️  Hierarchy demo already exists - skipping creation\n');
    } else {
      const r = await createHierarchyDemo(driver);
      console.log('\n========================================');
      console.log('     Hierarchy Demo Created');
      console.log('========================================');
      console.log(`• Graphs: ${r.graphs} (1 overview + sub-graphs)`);
      console.log(`• Work items: ${r.nodes}`);
      console.log(`• Edges: ${r.edges}`);
      console.log('• Shared: Yes (guest + all users, read-only)');
      console.log('• Open "System Overview" and click a node to drill in');
      console.log('========================================\n');
    }
  } catch (error: any) {
    console.error('❌ Failed to create hierarchy demo:', error);
    await driver.close();
    process.exit(1);
  }
  await driver.close();
  process.exit(0);
}

ensureHierarchyDemo();
