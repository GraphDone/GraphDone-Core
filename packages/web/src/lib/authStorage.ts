/**
 * Auth session storage with an explicit "keep me logged in" choice.
 *
 * - keep = true  → persist the session in localStorage (survives browser restart;
 *   the default, so users don't have to log in over and over).
 * - keep = false → store in sessionStorage (cleared when the tab/window closes).
 *
 * Reads prefer localStorage then fall back to sessionStorage, so a single
 * accessor works regardless of which mode the session was created in. The token
 * and user are always kept in the SAME store; the "keep" flag itself lives in
 * localStorage so the Sign-in form can default the checkbox to the last choice.
 */

const TOKEN_KEY = 'authToken';
const USER_KEY = 'currentUser';
const KEEP_KEY = 'graphdone:keepLoggedIn';

function safeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeRemove(store: Storage, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    /* ignore (storage disabled / private mode) */
  }
}

/** The auth token from whichever store holds the session (localStorage first). */
export function getToken(): string | null {
  return safeGet(localStorage, TOKEN_KEY) ?? safeGet(sessionStorage, TOKEN_KEY);
}

/** The cached user JSON string from whichever store holds the session. */
export function getUserRaw(): string | null {
  return safeGet(localStorage, USER_KEY) ?? safeGet(sessionStorage, USER_KEY);
}

/** Whether the user chose to stay logged in. Defaults to true (keep me in). */
export function isKept(): boolean {
  return safeGet(localStorage, KEEP_KEY) !== 'false';
}

/**
 * Persist a session. `keep` decides the store; the other store is cleared so a
 * stale copy never shadows the current one.
 */
export function setSession(token: string, user: unknown, keep: boolean): void {
  const primary = keep ? localStorage : sessionStorage;
  const secondary = keep ? sessionStorage : localStorage;
  try {
    primary.setItem(TOKEN_KEY, token);
    primary.setItem(USER_KEY, typeof user === 'string' ? user : JSON.stringify(user));
  } catch {
    /* ignore */
  }
  safeRemove(secondary, TOKEN_KEY);
  safeRemove(secondary, USER_KEY);
  try {
    localStorage.setItem(KEEP_KEY, keep ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/**
 * Persist just a token (the user is fetched separately, e.g. after a magic-link
 * redirect). Sets the keep store + flag the same way as setSession.
 */
export function setToken(token: string, keep: boolean): void {
  const primary = keep ? localStorage : sessionStorage;
  const secondary = keep ? sessionStorage : localStorage;
  try {
    primary.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  safeRemove(secondary, TOKEN_KEY);
  safeRemove(secondary, USER_KEY);
  try {
    localStorage.setItem(KEEP_KEY, keep ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/** Update just the cached user (e.g. after a profile refresh), in-place. */
export function setUser(user: unknown): void {
  const raw = typeof user === 'string' ? user : JSON.stringify(user);
  const store = safeGet(localStorage, TOKEN_KEY) != null ? localStorage : sessionStorage;
  try {
    store.setItem(USER_KEY, raw);
  } catch {
    /* ignore */
  }
}

/** Clear the session from BOTH stores (leaves the keep-preference intact). */
export function clearSession(): void {
  for (const store of [localStorage, sessionStorage]) {
    safeRemove(store, TOKEN_KEY);
    safeRemove(store, USER_KEY);
  }
}
