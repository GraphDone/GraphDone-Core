// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireRole } from './RequireRole';
import { canAccessAdmin, canAccessBackend } from '../lib/roleAccess';

let mockRole: string | undefined | null;
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mockRole === undefined ? null : { role: mockRole } }),
}));

// Tear down the DOM after every test (and between in-loop renders below) so a
// prior render's "PROTECTED PAGE" can never bleed into the next assertion — the
// redirect is exactly what we're verifying.
afterEach(() => cleanup());

function renderGuarded(role: string | undefined | null, can: (r: any) => boolean) {
  mockRole = role;
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/admin" element={<RequireRole can={can}><div>PROTECTED PAGE</div></RequireRole>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole (router guard)', () => {
  it('renders the protected page for an allowed role', async () => {
    renderGuarded('ADMIN', canAccessAdmin);
    expect(await screen.findByText('PROTECTED PAGE')).toBeTruthy();
  });

  it('redirects disallowed roles (GUEST/VIEWER/USER) away from /admin', async () => {
    for (const r of ['GUEST', 'VIEWER', 'USER']) {
      renderGuarded(r, canAccessAdmin);
      // <Navigate> resolves to HOME; PROTECTED PAGE must never render.
      expect(await screen.findByText('HOME')).toBeTruthy();
      expect(screen.queryByText('PROTECTED PAGE')).toBeNull();
      cleanup();
    }
  });

  it('redirects when unauthenticated (no user)', async () => {
    renderGuarded(undefined, canAccessAdmin);
    expect(await screen.findByText('HOME')).toBeTruthy();
    expect(screen.queryByText('PROTECTED PAGE')).toBeNull();
  });

  it('backend guard: blocks GUEST/VIEWER, allows USER/ADMIN', async () => {
    renderGuarded('GUEST', canAccessBackend);
    expect(await screen.findByText('HOME')).toBeTruthy();
    expect(screen.queryByText('PROTECTED PAGE')).toBeNull();
    cleanup();
    renderGuarded('USER', canAccessBackend);
    expect(await screen.findByText('PROTECTED PAGE')).toBeTruthy();
  });
});
