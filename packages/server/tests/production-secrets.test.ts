import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { validateProductionSecrets } from '../src/config/secrets.js';

const configured = () => ({
  NODE_ENV: 'production',
  JWT_SECRET: randomBytes(32).toString('hex'),
  SESSION_SECRET: randomBytes(32).toString('hex'),
});

describe('production signing secrets', () => {
  it.each(['JWT_SECRET', 'SESSION_SECRET'])('rejects missing, empty, and whitespace %s', name => {
    for (const value of [undefined, '', ' \n\t']) {
      expect(() => validateProductionSecrets({ ...configured(), [name]: value })).toThrow(`Invalid production secrets: ${name}`);
    }
  });

  it.each([
    'your-dev-secret-key',
    'your-secret-key',
    'your-secret',
    'your-secret-key-change-in-production',
    'graphdone-default-secret-change-in-production',
    'your-secret-key-change-this-in-production',
    'your-session-secret-change-this-in-production',
    'your-jwt-secret-here',
    'your-super-secret-jwt-key-change-in-production',
    'your-secure-jwt-secret-here',
    'your-super-secure-random-jwt-secret-256-bits-long',
    'your-super-secret-random-32-byte-hex-string-here',
    'your-256-bit-secret-key',
    'your-secure-secret',
  ])('rejects published placeholder %s for either signing purpose', placeholder => {
    for (const name of ['JWT_SECRET', 'SESSION_SECRET']) {
      expect(() => validateProductionSecrets({ ...configured(), [name]: ` ${placeholder.toUpperCase()} ` })).toThrow(`Invalid production secrets: ${name}`);
    }
  });

  it('reports both invalid variable names without exposing a configured secret', () => {
    expect(() => validateProductionSecrets({ NODE_ENV: 'production' })).toThrow('Invalid production secrets: JWT_SECRET, SESSION_SECRET.');
    const environment = configured();
    try {
      validateProductionSecrets({ ...environment, SESSION_SECRET: '' });
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(String(error)).toContain('SESSION_SECRET');
      expect(String(error)).not.toContain(environment.JWT_SECRET);
    }
  });

  it('accepts independent configured production secrets', () => {
    expect(() => validateProductionSecrets(configured())).not.toThrow();
  });

  it.each(['development', 'test', undefined])('preserves %s workflows without explicit secrets', NODE_ENV => {
    expect(() => validateProductionSecrets({ NODE_ENV })).not.toThrow();
  });
});
