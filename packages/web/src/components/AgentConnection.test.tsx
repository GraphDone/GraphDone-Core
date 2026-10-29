import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentConnection } from './AgentConnection';

const mode = vi.hoisted(() => ({ offline: false }));
vi.mock('../lib/offline/engine', () => ({
  get offlineEnabled() { return mode.offline; },
  ownerId: () => 'owned-fixture', localGuest: () => mode.offline,
  useOffline: () => ({ online: !mode.offline }),
  getProject: async () => ({ project: { name: 'Owned project' }, nodes: [], notes: [] }),
}));
vi.mock('../lib/offline/store', () => ({ editAccount: vi.fn() }));
vi.mock('../lib/hostedUsage', () => ({
  hostedUsageEnabled: false, useHostedUsage: () => ({}),
  cloudFailure: vi.fn(), preserveCloudDraft: vi.fn(),
  skipBackgroundPoll: () => true, refreshHostedUsage: vi.fn(),
}));
vi.mock('../lib/authStorage', () => ({ getToken: () => 'owned-fixture-token' }));
vi.mock('../hooks/useDialogManager', () => ({ useDialog: vi.fn() }));
vi.mock('../hooks/useModalA11y', () => ({ useModalA11y: vi.fn() }));

afterEach(() => { cleanup(); mode.offline = false; vi.unstubAllGlobals(); });
const open = () => render(<AgentConnection graphId="owned-project" graphName="Owned project" onClose={() => {}} embedded />);

describe('agent connection availability', () => {
  it('explains loading, recovers a failed read, and never creates access while opening', async () => {
    let fail!: (error: Error) => void;
    const pending = new Promise<Response>((_, reject) => { fail = reject; });
    const fetch = vi.fn().mockReturnValue(pending);
    vi.stubGlobal('fetch', fetch);
    open();
    expect(screen.getByRole('status').textContent).toContain('Loading');
    fail(Error('Owned server is unavailable'));
    expect((await screen.findByRole('alert')).textContent).toContain('Owned server is unavailable');
    fetch.mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes('/tokens') ? { tokens: [] } : { items: [], notes: [] }), { headers: { 'content-type': 'application/json' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Try loading again' }));
    await screen.findByRole('heading', { name: 'Connect an agent' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('No agent tokens for this project yet.')).toBeTruthy();
    expect(fetch.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
  });

  it('keeps local notes usable without claiming an unavailable token list is empty', async () => {
    mode.offline = true;
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    open();
    await screen.findByRole('heading', { name: 'Shared notes' });
    await waitFor(() => expect(screen.getByText('Reconnect to review project access.')).toBeTruthy());
    expect(screen.queryByText('No agent tokens for this project yet.')).toBeNull();
    expect((screen.getByRole('button', { name: 'Create agent token' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Note for your agent'), { target: { value: 'Keep this local handoff' } });
    expect((screen.getByRole('button', { name: 'Leave note' }) as HTMLButtonElement).disabled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
