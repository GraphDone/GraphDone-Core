import { existsSync, readFileSync, rmSync } from 'node:fs';
import { test as teardown } from '@playwright/test';
import { deleteGraphDeep } from '../lib/seedGraph';
import { UI_FIT_FIXTURE } from '../lib/ui-fit/devices.mjs';

teardown('delete the connected fixture graph', async ({ page }) => {
  if (!existsSync(UI_FIT_FIXTURE)) return;
  const { graphId } = JSON.parse(readFileSync(UI_FIT_FIXTURE, 'utf8'));
  await page.goto('/');
  await deleteGraphDeep(page, graphId, { strict: true });
  rmSync(UI_FIT_FIXTURE);
});
