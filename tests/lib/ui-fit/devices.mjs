import { devices } from '@playwright/test';

// The devices every UI fit check runs on. Apple devices use WebKit (Safari's
// engine) with the real screen size, pixel density and touch input; desktop
// covers Chrome and Safari. Add a device here and it gets every screen.
export const UI_FIT_DEVICES = [
  { id: 'desktop-chrome', label: 'Desktop Chrome, 1440×900', touch: false,
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  { id: 'desktop-safari', label: 'Desktop Safari, 1440×900 Retina', touch: false,
    use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  { id: 'ipad', label: 'iPad Pro 11", portrait', touch: true, use: { ...devices['iPad Pro 11'] } },
  { id: 'ipad-landscape', label: 'iPad Pro 11", landscape', touch: true, use: { ...devices['iPad Pro 11 landscape'] } },
  { id: 'iphone', label: 'iPhone 15, portrait', touch: true, use: { ...devices['iPhone 15'] } },
  { id: 'iphone-landscape', label: 'iPhone 15, landscape', touch: true, use: { ...devices['iPhone 15 landscape'] } },
];

export const UI_FIT_AUTH = 'test-artifacts/ui-fit-auth.json';
/** The small connected graph the setup creates (and the teardown deletes). */
export const UI_FIT_FIXTURE = 'test-artifacts/ui-fit-fixture.json';

/** Playwright projects: one login and fixture, one project per device, then cleanup. */
export function uiFitProjects() {
  return [
    { name: 'ui-fit-setup', testDir: './tests/devices', testMatch: /ui-fit\.setup\.ts/, teardown: 'ui-fit-teardown', use: { ...devices['Desktop Chrome'] } },
    { name: 'ui-fit-teardown', testDir: './tests/devices', testMatch: /ui-fit\.teardown\.ts/, use: { ...devices['Desktop Chrome'], storageState: UI_FIT_AUTH } },
    ...UI_FIT_DEVICES.map(device => ({
      name: `ui-fit:${device.id}`,
      testDir: './tests/devices',
      testMatch: /ui-fit\.spec\.ts/,
      dependencies: ['ui-fit-setup'],
      metadata: { device: { id: device.id, label: device.label, touch: device.touch } },
      use: { ...device.use, storageState: UI_FIT_AUTH },
    })),
  ];
}
