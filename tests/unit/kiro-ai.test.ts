import { describe, expect, it, vi } from 'vitest';
import type { LocalMessage } from '../../src/core/store';
import {
  renderMessages,
  updateStreamingText,
  type AiRenderOptions,
} from '../../src/ui/message-list';
import { renderRichText } from '../../src/ui/rich-text';
import {
  AI_TYPER_ID,
  createTypingIndicator,
} from '../../src/ui/typing-indicator';

function message(overrides: Partial<LocalMessage>): LocalMessage {
  return {
    id: 'message-1',
    clientMessageId: 'client-1',
    direction: 'outbound',
    senderName: 'Kiro',
    senderType: 'ai',
    content: 'Hello',
    createdAt: '2026-08-24T12:00:00.000Z',
    status: 'sent',
    ...overrides,
  };
}

function aiOptions(overrides: Partial<AiRenderOptions> = {}): AiRenderOptions {
  return {
    name: 'Kiro',
    avatarUrl: null,
    streamText: '',
    onQuickReply: vi.fn(),
    onLinkClick: vi.fn(),
    footer: null,
    ...overrides,
  };
}

function render(messages: LocalMessage[], ai = aiOptions()): HTMLElement {
  const container = document.createElement('div');
  renderMessages(
    container,
    messages,
    vi.fn(),
    vi.fn(),
    vi.fn(),
    { name: 'Support', avatarUrl: null },
    ai,
  );
  return container;
}

function rich(text: string, onLinkClick?: (url: string) => void): HTMLElement {
  const holder = document.createElement('div');
  holder.appendChild(renderRichText(text, onLinkClick));
  return holder;
}

describe('rich text in chat messages', () => {
  it('turns Markdown links and bare addresses into links', () => {
    const holder = rich(
      'Book on [our booking page](https://example.com/book) or see https://example.com/help.',
    );
    const links = holder.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe('our booking page');
    expect(links[0].getAttribute('href')).toBe('https://example.com/book');
    // The full stop ends the sentence. It is not part of the address.
    expect(links[1].getAttribute('href')).toBe('https://example.com/help');
    expect(holder.textContent).toBe(
      'Book on our booking page or see https://example.com/help.',
    );
  });

  it('renders bold text and lists', () => {
    const holder = rich(
      '**Opening hours**\n- Monday\n- Tuesday\n\n1. Call\n2. Visit',
    );
    expect(holder.querySelector('strong')?.textContent).toBe('Opening hours');
    expect(holder.querySelectorAll('ul > li')).toHaveLength(2);
    expect(holder.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('shows markup typed into a message as plain text', () => {
    const holder = rich(
      '<img src=x onerror=alert(1)> [x](javascript:alert(1))',
    );
    expect(holder.querySelector('img')).toBeNull();
    expect(holder.querySelector('a')).toBeNull();
    expect(holder.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('reports a link click', () => {
    const onLinkClick = vi.fn();
    const holder = rich('[Pricing](https://example.com/pricing)', onLinkClick);
    holder.querySelector('a')!.click();
    expect(onLinkClick).toHaveBeenCalledWith('https://example.com/pricing');
  });
});

describe('typing indicator', () => {
  it('says "Kiro is typing" with the Kiro face instead of dots', () => {
    const typing = createTypingIndicator();
    typing.setParticipants([{ id: AI_TYPER_ID, name: 'Kiro' }]);

    const label = typing.el.querySelector<HTMLElement>('.kw-typing-label')!;
    const dots = typing.el.querySelector<HTMLElement>('.kw-typing-dots')!;
    const face = typing.el.querySelector<HTMLElement>('.kw-typing-avatar--ai')!;
    expect(typing.el.hidden).toBe(false);
    expect(label.hidden).toBe(false);
    expect(label.textContent).toBe('Kiro is typing…');
    expect(dots.hidden).toBe(true);
    expect(face.hidden).toBe(false);
    expect(face.style.backgroundImage).toContain('kiro-face');
    expect(face.classList.contains('kw-typing-avatar--photo')).toBe(false);
  });

  it('uses the name and picture the team chose for the agent', () => {
    const typing = createTypingIndicator();
    typing.setParticipants([
      {
        id: AI_TYPER_ID,
        name: 'Nova',
        avatarUrl: 'https://cdn.example.com/n.png',
      },
    ]);
    const face = typing.el.querySelector<HTMLElement>('.kw-typing-avatar--ai')!;
    expect(typing.el.querySelector('.kw-typing-label')!.textContent).toBe(
      'Nova is typing…',
    );
    expect(face.style.backgroundImage).toContain('cdn.example.com/n.png');
    expect(face.classList.contains('kw-typing-avatar--photo')).toBe(true);
  });

  it('keeps the dots for a team member, and hides when nobody is typing', () => {
    const typing = createTypingIndicator();
    typing.setParticipants([{ id: 'user-1', name: 'Ann' }]);
    expect(
      typing.el.querySelector<HTMLElement>('.kw-typing-dots')!.hidden,
    ).toBe(false);
    expect(
      typing.el.querySelector<HTMLElement>('.kw-typing-label')!.hidden,
    ).toBe(true);
    expect(typing.el.getAttribute('aria-label')).toBe('Ann typing');

    typing.setParticipants([]);
    expect(typing.el.hidden).toBe(true);
    expect(typing.el.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Kiro messages in the chat', () => {
  it('shows the Kiro face next to an AI answer, and formats the answer', () => {
    const container = render([
      message({ content: 'See [opening hours](https://example.com/hours).' }),
    ]);
    expect(container.querySelector('.kw-message-avatar--kiro')).not.toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.com/hours',
    );
  });

  it('formats a team reply that carries a link, and leaves plain replies alone', () => {
    const container = render([
      message({
        id: 'team-1',
        senderType: 'human',
        senderName: 'Ann',
        content: 'Book on [our booking page](https://example.com/book).',
      }),
      message({
        id: 'team-2',
        clientMessageId: 'client-2',
        senderType: 'human',
        senderName: 'Ann',
        content: 'Use code [SAVE10] at checkout',
      }),
    ]);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('our booking page');
    expect(container.textContent).toContain('Use code [SAVE10] at checkout');
    expect(container.textContent).not.toContain('](https');
  });

  it('shows the answer being typed, and holds back the finished message until it is all typed', () => {
    const finished = message({
      id: 'ai-1',
      content: 'We open at 9 every day.',
    });
    const container = render(
      [
        message({
          id: 'q',
          senderType: 'visitor',
          direction: 'inbound',
          content: 'Hours?',
        }),
        finished,
      ],
      aiOptions({ streamText: 'We open', hiddenMessageId: 'ai-1' }),
    );
    const streaming = container.querySelector('.kw-bubble-row--streaming')!;
    expect(streaming.textContent).toBe('We open');
    expect(container.textContent).not.toContain('every day');

    expect(updateStreamingText(container, 'We open at 9')).toBe(true);
    expect(streaming.textContent).toBe('We open at 9');
    expect(
      container.querySelectorAll('.kw-bubble-row--streaming'),
    ).toHaveLength(1);

    const done = render([finished]);
    expect(done.querySelector('.kw-bubble-row--streaming')).toBeNull();
    expect(done.textContent).toContain('We open at 9 every day.');
    expect(updateStreamingText(done, 'ignored')).toBe(false);
  });

  it('says when the chat is waiting for a person, and when one joins', () => {
    const handoff = message({
      id: 'ai-handoff',
      content: 'Let me get someone for you.',
      ai: { kind: 'handoff', links: [], quickReplies: [] },
    });
    const waiting = render([handoff]);
    expect(waiting.querySelector('.kw-system-note')?.textContent).toBe(
      'Waiting for a team member',
    );

    const joined = render([
      handoff,
      message({
        id: 'team-1',
        clientMessageId: 'client-2',
        senderType: 'human',
        senderName: 'Ann',
        content: 'Hi, Ann here.',
        createdAt: '2026-08-24T12:02:00.000Z',
      }),
    ]);
    const notes = [...joined.querySelectorAll('.kw-system-note')].map(
      (note) => note.textContent,
    );
    expect(notes).toEqual(['Ann joined the chat']);
  });
});
