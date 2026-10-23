import { describe, it, expect } from 'vitest';
import { canAccessAdmin, canAccessBackend } from './roleAccess';

describe('roleAccess', () => {
  it('canAccessAdmin: only ADMIN', () => {
    expect(canAccessAdmin('ADMIN')).toBe(true);
    for (const r of ['USER', 'MEMBER', 'VIEWER', 'GUEST', undefined, null, '']) {
      expect(canAccessAdmin(r as string)).toBe(false);
    }
  });

  it('canAccessBackend: everyone except GUEST and VIEWER', () => {
    expect(canAccessBackend('ADMIN')).toBe(true);
    expect(canAccessBackend('USER')).toBe(true);
    expect(canAccessBackend('MEMBER')).toBe(true);
    expect(canAccessBackend('GUEST')).toBe(false);
    expect(canAccessBackend('VIEWER')).toBe(false);
  });
});
