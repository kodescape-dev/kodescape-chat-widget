import { describe, expect, it, vi } from 'vitest';
import { createChatWindow } from '../../src/ui/window';

function createWindow() {
  const handle = createChatWindow({
    onClose: vi.fn(),
    onSend: vi.fn(),
    onUpload: vi.fn(),
    onStarter: vi.fn(),
    onContinue: vi.fn(),
    onStart: vi.fn(),
    onLeadSubmit: vi.fn(),
    onComposerInput: vi.fn(),
    onContactPromptSubmit: vi.fn(),
    onContactPromptDismiss: vi.fn(),
    onNotificationsChange: vi.fn(),
    bookingProvider: {
      getAvailability: vi.fn(),
      createAppointment: vi.fn(),
    },
    requestProvider: { submit: vi.fn() },
    draftKey: null,
  });
  document.body.appendChild(handle.el);
  const expand =
    handle.el.querySelector<HTMLButtonElement>('.kw-expand-trigger')!;
  return { handle, expand };
}

describe('chat window expand button', () => {
  it('is only offered while the conversation is open', () => {
    const { handle, expand } = createWindow();
    expect(expand.hidden).toBe(true);

    handle.showChat();
    expect(expand.hidden).toBe(false);

    handle.showHome();
    expect(expand.hidden).toBe(true);
  });

  it('toggles the tall panel and its label', () => {
    const { handle, expand } = createWindow();
    handle.showChat();
    expect(expand.getAttribute('aria-label')).toBe('Expand chat');
    expect(handle.el.classList).not.toContain('kw-panel--expanded');

    expand.click();
    expect(handle.el.classList).toContain('kw-panel--expanded');
    expect(expand.getAttribute('aria-label')).toBe('Collapse chat');

    expand.click();
    expect(handle.el.classList).not.toContain('kw-panel--expanded');
    expect(expand.getAttribute('aria-label')).toBe('Expand chat');
  });

  it('shows the same availability dot on the logo as in the status row', () => {
    const { handle } = createWindow();
    const dot = handle.el.querySelector('.kw-brand-dot')!;
    expect(dot.classList).toContain('kw-status-dot--offline');

    handle.setConnectionStatus(true);
    handle.setAvailability(true);
    expect(dot.classList).not.toContain('kw-status-dot--offline');
  });
});
