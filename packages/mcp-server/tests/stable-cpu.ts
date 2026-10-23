import { vi } from 'vitest';

vi.mock('os', async importOriginal => {
  const actual = await importOriginal<typeof import('os')>();
  let idle = 0;
  return {
    ...actual,
    cpus: () => [{
      model: 'GraphService unit-test CPU',
      speed: 1000,
      times: { user: 0, nice: 0, sys: 0, idle: idle += 100, irq: 0 },
    }],
  };
});
