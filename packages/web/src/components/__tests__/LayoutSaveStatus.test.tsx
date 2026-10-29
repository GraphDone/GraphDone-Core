import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayoutSaveStatus } from '../LayoutSaveStatus';
import type { usePositionSaveQueue } from '../../hooks/usePositionSaveQueue';

type Queue = ReturnType<typeof usePositionSaveQueue>;
const state: NonNullable<Queue['state']> = {
  ready: true, recovered: true, pending: 0, unsent: 0, cleanupPending: 0, local: 0,
  storageError: '', cleanupError: '', sendError: '', acknowledged: false, networkBacked: true, positions: new Map(),
};
const queue = (values: Partial<typeof state>): Queue => ({
  state: { ...state, ...values }, queue: vi.fn(), flush: vi.fn(), discard: vi.fn(), error: undefined, saving: false,
});

describe('layout save status', () => {
  it('does not claim server acceptance when recovery storage failed before any save', () => {
    render(<LayoutSaveStatus queue={queue({ storageError: 'Owned read failure', recovered: false })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Layout recovery is unavailable');
    expect(screen.getByRole('status')).not.toHaveTextContent('Layout saved to the server');
    expect(screen.getByRole('button', { name: 'Retry layout save' })).toBeEnabled();
  });

  it('marks normal pending progress without disguising an attention error', () => {
    const {rerender}=render(<LayoutSaveStatus queue={queue({pending:2,local:2,unsent:2})} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-layout-save-progress','true');
    rerender(<LayoutSaveStatus queue={queue({pending:2,local:2,unsent:2,sendError:'Network failed'})} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-layout-save-progress','false');
    expect(screen.getByRole('status')).toHaveTextContent('Network failed');
    expect(screen.getByRole('button',{name:'Retry layout save'})).toBeEnabled();
  });

  it('offers cleanup alone for accepted changes and never describes them as unsent', () => {
    render(<LayoutSaveStatus queue={queue({ pending: 1, local: 1, cleanupPending: 1, acknowledged: true })} />);
    expect(screen.getByRole('status')).toHaveTextContent('The server accepted 1 layout change');
    expect(screen.getByRole('status')).not.toHaveTextContent('Waiting to send');
    expect(screen.getByRole('button', { name: 'Retry receipt cleanup' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Discard unsent layout' })).toBeNull();
  });

  it('distinguishes volatile edits and durable receipts while allowing explicit discard', () => {
    render(<LayoutSaveStatus queue={queue({ pending: 2, unsent: 2, local: 1 })} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 saved on this device; 1 pending only in this tab');
    expect(screen.getByRole('status')).toHaveTextContent('Waiting to send 2 layout changes');
    expect(screen.getByRole('button', { name: 'Discard unsent layout' })).toBeEnabled();
  });
});


it('releases canvas space after a completed acknowledgment but keeps save failures visible', () => {
  vi.useFakeTimers();
  try {
    const {rerender}=render(<LayoutSaveStatus queue={queue({acknowledged:true})}/>);
    expect(screen.getByRole('status')).toHaveTextContent('Layout saved to the server.');
    act(()=>vi.advanceTimersByTime(3500));
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<LayoutSaveStatus queue={queue({acknowledged:true,pending:1,unsent:1,sendError:'Offline during save'})}/>);
    act(()=>vi.advanceTimersByTime(10000));
    expect(screen.getByRole('status')).toHaveTextContent('Offline during save');
    expect(screen.getByRole('button',{name:'Retry layout save'})).toBeEnabled();
  }finally{vi.useRealTimers();}
});
