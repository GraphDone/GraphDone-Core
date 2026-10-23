import { describe, expect, it } from 'vitest';
import { apiUrl } from '../apiUrl';

describe('apiUrl', () => {
  it('keeps development requests on the current origin when no API origin is configured', () => {
    expect(apiUrl('/health', '')).toBe('/health');
    expect(apiUrl('mcp/status', '   ')).toBe('/mcp/status');
  });

  it('uses the configured API origin without producing a double slash', () => {
    expect(apiUrl('/health', 'http://127.0.0.1:8798/')).toBe('http://127.0.0.1:8798/health');
    expect(apiUrl('mcp/status', 'https://api.graphdone.example///')).toBe(
      'https://api.graphdone.example/mcp/status',
    );
  });
});
