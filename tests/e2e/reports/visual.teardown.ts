import { existsSync, readFileSync, rmSync } from 'node:fs';
import { test as teardown } from '@playwright/test';
import { deleteGraphDeep } from '../../lib/seedGraph';

teardown('delete the visual fixture graph', async ({ page }, info) => {
  const { fixturePath } = info.project.metadata;
  if (!existsSync(fixturePath)) return;

  const graphId = readFileSync(fixturePath, 'utf8');
  await page.goto('/');
  await deleteGraphDeep(page, graphId, { strict: true });
  rmSync(fixturePath);
});
