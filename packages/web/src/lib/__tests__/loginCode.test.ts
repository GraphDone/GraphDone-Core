import { describe, it, expect } from 'vitest';
import {
  LOGIN_CODE_ALPHABET, LOGIN_CODE_LENGTH,
  normalizeLoginCode, formatLoginCode, formatLoginCodeInput, isCompleteLoginCode,
} from '../loginCode';

describe('login code alphabet', () => {
  it('excludes the confusable glyphs O and 0', () => {
    expect(LOGIN_CODE_ALPHABET).not.toContain('O');
    expect(LOGIN_CODE_ALPHABET).not.toContain('0');
  });
  it('is uppercase letters and digits only', () => {
    expect(LOGIN_CODE_ALPHABET).toMatch(/^[A-Z1-9]+$/);
  });
});

describe('normalizeLoginCode', () => {
  it('uppercases, strips dashes/spaces, and caps at 12', () => {
    expect(normalizeLoginCode('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN');
    expect(normalizeLoginCode('AB CD ef')).toBe('ABCDEF');
    expect(normalizeLoginCode('ABCDEFGHJKMNPQRS')).toBe('ABCDEFGHJKMN'); // capped at 12
  });
  it('is empty for null/undefined/garbage', () => {
    expect(normalizeLoginCode(null)).toBe('');
    expect(normalizeLoginCode(undefined)).toBe('');
    expect(normalizeLoginCode('--  --')).toBe('');
  });
  it('accepts a user typing lowercase without dashes', () => {
    expect(normalizeLoginCode('a1b2c3d4e5f6')).toBe('A1B2C3D4E5F6');
  });
});

describe('formatLoginCode / formatLoginCodeInput', () => {
  it('groups a full canonical code as XXXX-XXXX-XXXX', () => {
    expect(formatLoginCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN');
  });
  it('groups partial input progressively while typing', () => {
    expect(formatLoginCodeInput('abcde')).toBe('ABCD-E');
    expect(formatLoginCodeInput('abcdefgh')).toBe('ABCD-EFGH');
    expect(formatLoginCodeInput('abcd-efgh-jkmn')).toBe('ABCD-EFGH-JKMN');
  });
});

describe('isCompleteLoginCode', () => {
  it('is true only at exactly 12 normalized characters', () => {
    expect(isCompleteLoginCode('abcd-efgh-jkmn')).toBe(true);
    expect(isCompleteLoginCode('abcd-efgh-jkm')).toBe(false);
    expect(isCompleteLoginCode('')).toBe(false);
  });
  it('agrees with the declared code length', () => {
    expect('ABCDEFGHJKMN'.length).toBe(LOGIN_CODE_LENGTH);
  });
});
