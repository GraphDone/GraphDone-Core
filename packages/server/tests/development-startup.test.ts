import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const fixture = vi.hoisted(() => ({ envPath: '', start: vi.fn() }));
vi.mock('dotenv', async importOriginal => {
  const original = await importOriginal<typeof import('dotenv')>();
  return { default: { config: () => original.config({ path: fixture.envPath }) } };
});

let directory: string;
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.doUnmock('../src/index.js');
  vi.doMock('../src/index.js', () => { fixture.start(process.env.NODE_ENV); return {}; });
  directory = mkdtempSync(join(tmpdir(), 'graphdone-dev-entry-'));
  fixture.envPath = join(directory, '.env');
  writeFileSync(fixture.envPath, '');
  vi.stubEnv('NODE_ENV', 'test');
  delete process.env.NODE_ENV;
  vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
  vi.stubEnv('SESSION_SECRET', randomBytes(32).toString('hex'));
});
afterEach(() => {
  vi.unstubAllEnvs(); vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

describe('explicit development entry point', () => {
  it('defaults only an unset mode to development before loading the API', async () => {
    await import('../src/dev.js');
    expect(fixture.start).toHaveBeenCalledWith('development');
    const { captchaRequired } = await import('../src/utils/captcha');
    expect(captchaRequired('login')).toBe(false);
    expect(captchaRequired('reset-password')).toBe(true);
  });

  it.each(['production', 'staging', ''])('preserves explicitly configured %j and required login proof', async mode => {
    vi.stubEnv('NODE_ENV', mode);
    await import('../src/dev.js');
    expect(fixture.start).toHaveBeenCalledWith(mode);
    const { captchaRequired } = await import('../src/utils/captcha');
    expect(captchaRequired('login')).toBe(true);
  });

  it('loads a production .env before deciding whether to default the mode', async () => {
    writeFileSync(fixture.envPath, 'NODE_ENV=production\n');
    await import('../src/dev.js');
    expect(fixture.start).toHaveBeenCalledWith('production');
    const { captchaRequired } = await import('../src/utils/captcha');
    expect(captchaRequired('login')).toBe(true);
  });

  it('keeps production startup secret validation before API loading', async () => {
    writeFileSync(fixture.envPath, 'NODE_ENV=production\n');
    vi.stubEnv('JWT_SECRET', '');
    delete process.env.JWT_SECRET;
    await expect(import('../src/dev.js')).rejects.toThrow('JWT_SECRET');
    expect(fixture.start).not.toHaveBeenCalled();
  });
});
