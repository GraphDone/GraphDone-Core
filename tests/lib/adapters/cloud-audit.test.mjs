import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cloudAuditSequence } from './cloud-audit.mjs';

test('maps pass/warn/fail/info to unified counts + status', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ca-'));
  const p = join(dir, 'findings.json');
  writeFileSync(p, JSON.stringify({ target: 'https://x', findings: [
    { dim: 'A', name: 'ok', status: 'pass' },
    { dim: 'A', name: 'meh', status: 'warn', detail: 'subscription' },
    { dim: 'B', name: 'note', status: 'info' },
  ] }));
  const s = cloudAuditSequence({ findingsPath: p });
  assert.equal(s.counts.passed, 1);
  assert.equal(s.counts.warned, 1);
  assert.equal(s.counts.skipped, 1);
  assert.equal(s.counts.failed, 0);
  assert.equal(s.status, 'warn');           // warn dominates pass
  assert.ok(!('warn' in s.counts) || typeof s.counts.warn !== 'number'); // no stray key
});

test('a failure makes the sequence failed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ca-'));
  const p = join(dir, 'findings.json');
  writeFileSync(p, JSON.stringify({ findings: [{ dim: 'X', name: 'broke', status: 'fail', detail: 'boom' }] }));
  const s = cloudAuditSequence({ findingsPath: p });
  assert.equal(s.status, 'failed');
  assert.equal(s.cases.length, 1);
});

test('missing file → skipped, never throws', () => {
  const s = cloudAuditSequence({ findingsPath: '/no/such/findings.json' });
  assert.equal(s.status, 'skipped');
});
