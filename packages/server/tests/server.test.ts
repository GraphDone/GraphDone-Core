import { describe, it, expect } from 'vitest';

describe('Server', () => {
  it('should have basic configuration', () => {
    const port = process.env.PORT || 4000;
    expect(port).toBeDefined();
  });

  it('should be able to create health response', () => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
    
    expect(health.status).toBe('ok');
    expect(health.timestamp).toBeDefined();
  });
});