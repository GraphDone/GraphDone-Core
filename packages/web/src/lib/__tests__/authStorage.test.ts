import { describe, it, expect, beforeEach } from 'vitest';
import {
  getToken,
  getUserRaw,
  isKept,
  setSession,
  setToken,
  setUser,
  clearSession,
} from '../authStorage';

const TOKEN = 'authToken';
const USER = 'currentUser';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keep=true persists the session in localStorage (survives restart)', () => {
    setSession('tok-1', { id: 'u1' }, true);
    expect(localStorage.getItem(TOKEN)).toBe('tok-1');
    expect(sessionStorage.getItem(TOKEN)).toBeNull();
    expect(getToken()).toBe('tok-1');
    expect(JSON.parse(getUserRaw()!)).toEqual({ id: 'u1' });
    expect(isKept()).toBe(true);
  });

  it('keep=false stores the session only in sessionStorage', () => {
    setSession('tok-2', { id: 'u2' }, false);
    expect(sessionStorage.getItem(TOKEN)).toBe('tok-2');
    expect(localStorage.getItem(TOKEN)).toBeNull();
    expect(getToken()).toBe('tok-2');
    expect(isKept()).toBe(false);
  });

  it('switching keep clears the stale copy in the other store', () => {
    setSession('tok-keep', { id: 'a' }, true);
    setSession('tok-session', { id: 'a' }, false);
    expect(localStorage.getItem(TOKEN)).toBeNull(); // old persistent copy gone
    expect(sessionStorage.getItem(TOKEN)).toBe('tok-session');
    expect(getToken()).toBe('tok-session');
  });

  it('defaults to "kept" when no preference was ever recorded', () => {
    expect(isKept()).toBe(true);
  });

  it('getToken prefers localStorage over sessionStorage', () => {
    sessionStorage.setItem(TOKEN, 'session-tok');
    localStorage.setItem(TOKEN, 'local-tok');
    expect(getToken()).toBe('local-tok');
  });

  it('setToken stores just the token (user populated later) with the keep flag', () => {
    setToken('magic-tok', true);
    expect(localStorage.getItem(TOKEN)).toBe('magic-tok');
    expect(getUserRaw()).toBeNull();
    expect(isKept()).toBe(true);
  });

  it('setUser updates the cached user in whichever store holds the token', () => {
    setSession('tok', { id: 'old' }, false);
    setUser({ id: 'new' });
    expect(JSON.parse(sessionStorage.getItem(USER)!)).toEqual({ id: 'new' });
    expect(localStorage.getItem(USER)).toBeNull();
  });

  it('clearSession removes token + user from BOTH stores but keeps the preference', () => {
    setSession('tok', { id: 'a' }, false);
    clearSession();
    expect(getToken()).toBeNull();
    expect(getUserRaw()).toBeNull();
    expect(localStorage.getItem(TOKEN)).toBeNull();
    expect(sessionStorage.getItem(TOKEN)).toBeNull();
    // The keep preference is intentionally retained for the next login.
    expect(isKept()).toBe(false);
  });
});
