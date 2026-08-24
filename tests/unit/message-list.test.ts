import { describe, expect, it, vi } from 'vitest';
import type { LocalMessage } from '../../src/core/store';
import { renderMessages } from '../../src/ui/message-list';

const messages: LocalMessage[] = [
  {
    id: 'visitor-message',
    clientMessageId: 'visitor-client-message',
    direction: 'inbound',
    senderName: null,
    content: 'Hello',
    createdAt: '2026-08-24T12:00:00.000Z',
    status: 'sent',
  },
  {
    id: 'support-message',
    clientMessageId: 'support-client-message',
    direction: 'outbound',
    senderName: 'Fazley Rabbi',
    content: 'Hi there',
    createdAt: '2026-08-24T12:01:00.000Z',
    status: 'sent',
  },
];

describe('message details disclosure', () => {
  it('reveals the sender and time below only the selected message', () => {
    const container = document.createElement('div');
    renderMessages(container, messages, vi.fn(), vi.fn(), vi.fn());

    const bubbles = container.querySelectorAll<HTMLElement>('.kw-bubble');
    const details = container.querySelectorAll<HTMLElement>('.kw-bubble-meta');
    const statuses =
      container.querySelectorAll<HTMLElement>('.kw-bubble-status');

    expect(details[0]?.hidden).toBe(true);
    expect(details[1]?.hidden).toBe(true);
    expect(statuses[0]?.parentElement).toBe(details[0]);

    bubbles[0]?.click();

    expect(details[0]?.hidden).toBe(false);
    expect(details[0]?.textContent).toContain('You');
    expect(details[0]?.querySelector('.kw-bubble-status')).toBe(statuses[0]);
    expect(details[1]?.hidden).toBe(true);

    bubbles[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );

    expect(details[1]?.hidden).toBe(false);
    expect(details[1]?.textContent).toContain('Fazley Rabbi');
  });
});
