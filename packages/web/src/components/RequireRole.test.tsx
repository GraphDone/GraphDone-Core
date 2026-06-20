// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireRole } from './RequireRole';
import { canAccessAdmin, canAccessBackend } from '../lib/roleAccess';

let mockRole: string | undefined | null;
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mockRole === undefined ? null : { role: mockRole } }),
}));

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
  it('renders the protected page for an allowed role', () => {
    renderGuarded('ADMIN', canAccessAdmin);
    expect(screen.getByText('PROTECTED PAGE')).toBeTruthy();
  });

  it('redirects disallowed roles (GUEST/VIEWER/USER) away from /admin', () => {
    for (const r of ['GUEST', 'VIEWER', 'USER']) {
      const { unmount } = renderGuarded(r, canAccessAdmin);
      expect(screen.queryByText('PROTECTED PAGE')).toBeNull();
      expect(screen.getByText('HOME')).toBeTruthy();
      unmount();
    }
  });

  it('redirects when unauthenticated (no user)', () => {
    renderGuarded(undefined, canAccessAdmin);
    expect(screen.queryByText('PROTECTED PAGE')).toBeNull();
    expect(screen.getByText('HOME')).toBeTruthy();
  });

  it('backend guard: blocks GUEST/VIEWER, allows USER/ADMIN', () => {
    const { unmount } = renderGuarded('GUEST', canAccessBackend);
    expect(screen.queryByText('PROTECTED PAGE')).toBeNull();
    unmount();
    renderGuarded('USER', canAccessBackend);
    expect(screen.getByText('PROTECTED PAGE')).toBeTruthy();
  });
});
