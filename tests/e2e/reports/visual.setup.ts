import { writeFileSync } from 'node:fs';
import { test as setup, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { seedLargeGraph } from '../../lib/seedGraph';

setup('authenticate and seed visual captures', async ({ page }, info) => {
  setup.setTimeout(120_000);
  const { storageState, fixturePath } = info.project.metadata;
  await login(page, TEST_USERS.ADMIN, { retries: 1 });
  await expect(page.getByTestId('workspace-content')).toBeVisible();
  await page.context().storageState({ path: storageState });

  const { graphId } = await seedLargeGraph(page, {
    size: 6,
    edgeFactor: 1.2,
    spacing: 260,
    namePrefix: 'Visual snapshots',
    titleForIndex: index => `Visual item ${index + 1}`,
    onGraphCreated: id => writeFileSync(fixturePath, id),
  });
  await page.evaluate(id => localStorage.setItem('currentGraphId', id), graphId);
  await page.context().storageState({ path: storageState });
});
