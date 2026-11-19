import type { CDPSession, Page } from '@playwright/test';

export type TouchPoint = { x: number; y: number };

const contact = ({ x, y }: TouchPoint, index: number) => ({
  x: Math.round(x), y: Math.round(y), id: index + 1, radiusX: 2, radiusY: 2, force: 1,
});

async function withTouchContacts(page: Page, start: TouchPoint[], move: (cdp: CDPSession) => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: start.map(contact) });
    await move(cdp);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } catch (error) {
    // A failed assertion or a torn-down target must not leave active contacts
    // or replace the error identifying the failed gesture.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(() => {});
    await cdp.detach().catch(() => {});
    throw error;
  }
  await cdp.detach();
  await page.waitForTimeout(400);
}

export async function touchGesture(page: Page, frames: [TouchPoint, TouchPoint][], afterFirstMove?: () => Promise<void>) {
  await withTouchContacts(page, frames[0], async cdp => {
    for (const [index, frame] of frames.slice(1).entries()) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: frame.map(contact) });
      await page.waitForTimeout(30);
      if (index === 0) await afterFirstMove?.();
    }
  });
}

export async function cancelledThreeFingerPinch(page: Page, center: TouchPoint) {
  const two = [{ x: center.x - 20, y: center.y }, { x: center.x + 20, y: center.y }];
  const third = { x: center.x, y: center.y + 30 };
  await withTouchContacts(page, two, async cdp => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...two, third].map(contact) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
      { x: center.x - 65, y: center.y }, { x: center.x + 65, y: center.y }, third,
    ].map(contact) });
  });
}
