import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { captureBrowserDiagnostics } from './browser-diagnostics.mjs';

function page() {
  const value = new EventEmitter();
  value.url = () => 'http://localhost:13127/agents?token=fixture-token#private';
  return value;
}

test('browser failure evidence retains bounded events and removes listeners', () => {
  const source = page();
  const diagnostics = captureBrowserDiagnostics(source);
  source.emit('console', { type: () => 'log', text: () => 'ordinary log' });
  assert.equal(diagnostics.snapshot().events.length, 0);
  for (let i = 0; i < 55; i++) source.emit('console', { type: () => 'error', text: () => `${i}:` + 'x'.repeat(5000) });
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.events.length, 50);
  assert.equal(snapshot.dropped, 5);
  assert.ok(snapshot.events.every(event => event.message.length <= 1000));
  assert.match(snapshot.events[0].message, /^5:/);
  diagnostics.stop();
  for (const name of ['console', 'pageerror', 'requestfailed']) assert.equal(source.listenerCount(name), 0);
  source.emit('console', { type: () => 'error', text: () => 'after stop' });
  assert.equal(diagnostics.snapshot().events.length, 50);
});

test('diagnostics omit query credentials, bearer tokens and password assignments', () => {
  const source = page();
  const diagnostics = captureBrowserDiagnostics(source);
  source.emit('pageerror', new Error('fetch http://localhost:13127/assets/chunk.js?token=fixture-token#private Bearer fixture-bearer password="fixture-password" eyJhbGciOiJub25lIn0.eyJzdWIiOiJmaXh0dXJlIn0.fixture'));
  source.emit('requestfailed', { url: () => 'http://localhost:13127/src/main.tsx?token=fixture-token#private', failure: () => ({ errorText: 'net::ERR_CONNECTION_RESET' }) });
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.url, 'http://localhost:13127/agents');
  assert.equal(snapshot.events[1].url, 'http://localhost:13127/src/main.tsx');
  assert.equal(snapshot.events[1].message, 'net::ERR_CONNECTION_RESET');
  const json = JSON.stringify(snapshot);
  for (const sensitive of ['fixture-token', 'fixture-bearer', 'fixture-password', 'eyJhbGci', '#private']) assert.ok(!json.includes(sensitive));
  assert.match(snapshot.events[0].message, /redacted/);
  diagnostics.stop();
});
