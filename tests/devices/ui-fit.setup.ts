import { writeFileSync } from 'node:fs';
import { test as setup } from '@playwright/test';
import { login, TEST_USERS } from '../lib/auth';
import { seedLargeGraph } from '../lib/seedGraph';
import { UI_FIT_AUTH, UI_FIT_FIXTURE } from '../lib/ui-fit/devices.mjs';

// One real login shared by every device project (cookies and storage are
// browser-independent, so WebKit devices reuse the Chromium session).
//
// The signed-in user's own starter graph has no connections, so the setup
// also creates a small connected graph through the real API for the
// connection screens. It is an "[E2E]" graph: the teardown project deletes
// it, and the test-data sweep removes it if a run is interrupted.
setup('sign in once and create the connected fixture graph', async ({ page }) => {
  await login(page, TEST_USERS.ADMIN);
  const graph = await seedLargeGraph(page, { size: 6, edgeFactor: 1.2, spacing: 260, namePrefix: 'UI fit connections' });
  writeFileSync(UI_FIT_FIXTURE, JSON.stringify({ graphId: graph.graphId }));
  await page.context().storageState({ path: UI_FIT_AUTH });
});
