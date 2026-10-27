import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

function Navigation({ destination }: { destination: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  return <>
    <button onClick={() => {
      try { navigate(destination); } catch (failure) { setError((failure as Error).message); }
    }}>Open destination</button>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => navigate(1)}>Forward</button>
    <output aria-label="Current location">{location.pathname}{location.search}{location.hash}</output>
    {error && <p role="alert">{error}</p>}
    <Routes>
      <Route path="/home" element={<h1>Home</h1>} />
      <Route path="/settings" element={<h1>Settings</h1>} />
    </Routes>
  </>;
}

describe('installed router navigation contract', () => {
  for (const prefix of ['//', '\\\\', '/\\', '\\/']) {
    it(`rejects external-looking separators ${JSON.stringify(prefix)} before navigation`, async () => {
      render(<MemoryRouter initialEntries={['/home']}><Navigation destination={`${prefix}settings`} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: 'Open destination' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('External navigation is not allowed');
      expect(screen.getByRole('heading', { name: 'Home' })).toBeVisible();
      expect(screen.getByLabelText('Current location')).toHaveTextContent(/^\/home$/);
    });
  }

  it('preserves query, fragment and browser-style back/forward history', async () => {
    render(<MemoryRouter initialEntries={['/home']}><Navigation destination="/settings?tab=profile#account" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open destination' }));
    await waitFor(() => expect(screen.getByLabelText('Current location')).toHaveTextContent('/settings?tab=profile#account'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    await waitFor(() => expect(screen.getByLabelText('Current location')).toHaveTextContent('/settings?tab=profile#account'));
  });
});
