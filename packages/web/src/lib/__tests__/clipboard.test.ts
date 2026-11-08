import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shortId, copyText } from '../clipboard';

describe('shortId', () => {
  it('takes the first 8 chars by default', () => {
    expect(shortId('5134fc28-7ac2-4e33-acbf-e13c2962b8f1')).toBe('5134fc28');
  });
  it('respects a custom length', () => {
    expect(shortId('abcdefghij', 4)).toBe('abcd');
  });
  it('returns short ids unchanged and handles empty/nullish', () => {
    expect(shortId('abc')).toBe('abc');
    expect(shortId('')).toBe('');
    expect(shortId(undefined as any)).toBe('');
  });
});

describe('copyText', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('uses navigator.clipboard.writeText when available and resolves true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const ok = await copyText('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(ok).toBe(true);
  });

  it('returns false when no clipboard mechanism is available', async () => {
    vi.stubGlobal('navigator', {});
    const doc: any = { queryCommandSupported: () => false };
    vi.stubGlobal('document', doc);
    const ok = await copyText('x');
    expect(ok).toBe(false);
  });
});
