import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakeSocket = {
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  auth: {},
  emit: vi.fn(),
  io: { on: vi.fn() },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({ success: true, statusCode: 200, message: '', data }),
  };
}

const SETTINGS = {
  name: 'Test Widget',
  supportDisplayName: 'Test Support',
  supportSubtitle: '',
  supportAvatarUrl: null,
  incomingMessageSound: false,
  primaryColor: '#123456',
  backgroundColor: '#654321',
  textColor: '#fefefe',
  launcherPosition: 'left',
  welcomeMessage: 'Hi there',
  welcomeHeading: 'Welcome',
  conversationStarters: [],
  composerPlaceholder: 'Write here…',
  launcherStyle: 'label_icon',
  launcherLabel: 'Chat now',
  launcherIcon: 'chat',
  askName: false,
  requireName: false,
  askEmail: false,
  requireEmail: false,
  formHeading: '',
  formDescription: '',
  contactCollectionMode: 'disabled',
  showOnDesktop: true,
  showOnMobile: true,
  visibilityRules: [],
};

function socketHandler(event: string) {
  return fakeSocket.on.mock.calls.find(([name]) => name === event)?.[1] as
    ((payload: unknown) => void) | undefined;
}

describe('Kiro in the mounted widget', () => {
  let container: HTMLDivElement;
  let reducedMotion = false;

  beforeEach(() => {
    reducedMotion = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: reducedMotion && query.includes('prefers-reduced-motion'),
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/widget-settings')) return jsonResponse(SETTINGS);
        if (url.includes('/session')) {
          return jsonResponse({
            resumeToken: 'resume-1',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        if (url.includes('/messages')) {
          return jsonResponse({ items: [], nextCursor: null });
        }
        return jsonResponse({});
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    container.remove();
    document.body.style.fontFamily = '';
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  async function mountWidget() {
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();
    await flush();
    const host = container.firstElementChild as HTMLElement;
    return { widget, host, shadow: host.shadowRoot! };
  }

  it("uses the website's own font when the site sets one", async () => {
    document.body.style.fontFamily = '"Roofing Sans", sans-serif';
    const { widget, host } = await mountWidget();
    expect(host.style.getPropertyValue('--kw-font-family')).toContain(
      'Roofing Sans',
    );
    widget.destroy();
  });

  it('keeps its own font when the site does not set one', async () => {
    const { widget, host } = await mountWidget();
    expect(host.style.getPropertyValue('--kw-font-family')).toBe('');
    widget.destroy();
  });

  it('shows "Kiro is typing", then types the answer out before showing the message', async () => {
    const { widget, shadow } = await mountWidget();
    (shadow.querySelector('.kw-launcher') as HTMLButtonElement).click();
    await flush();
    vi.useFakeTimers();

    socketHandler('ai:typing')?.({
      conversationId: 'conv-1',
      active: true,
      name: 'Kiro',
    });
    const label = shadow.querySelector('.kw-typing-label') as HTMLElement;
    expect(label.hidden).toBe(false);
    expect(label.textContent).toBe('Kiro is typing…');

    const answer =
      'We open at 9 in the morning from Monday to Friday, and at 10 on Saturdays.';
    socketHandler('message:new')?.({
      conversationId: 'conv-1',
      message: {
        id: 'ai-1',
        clientMessageId: 'ai-client-1',
        direction: 'outbound',
        senderType: 'ai',
        senderName: 'Kiro',
        content: answer,
        ai: { kind: 'reply', links: [], quickReplies: [] },
        createdAt: new Date().toISOString(),
        status: 'sent',
      },
    });

    expect(label.hidden).toBe(true);
    const streaming = () => shadow.querySelector('.kw-bubble-row--streaming');
    const firstStep = streaming()?.textContent ?? '';
    expect(firstStep.length).toBeGreaterThan(0);
    expect(firstStep.length).toBeLessThan(answer.length);
    expect(answer.startsWith(firstStep)).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(streaming()).toBeNull();

    expect(shadow.textContent).toContain(answer);

    widget.destroy();
  });

  it('shows the whole answer at once for people who turned motion off', async () => {
    reducedMotion = true;
    const { widget, shadow } = await mountWidget();
    (shadow.querySelector('.kw-launcher') as HTMLButtonElement).click();
    await flush();

    socketHandler('message:new')?.({
      conversationId: 'conv-1',
      message: {
        id: 'ai-1',
        clientMessageId: 'ai-client-1',
        direction: 'outbound',
        senderType: 'ai',
        senderName: 'Kiro',
        content: 'We open at 9.',
        ai: { kind: 'reply', links: [], quickReplies: [] },
        createdAt: new Date().toISOString(),
        status: 'sent',
      },
    });

    expect(shadow.querySelector('.kw-bubble-row--streaming')).toBeNull();
    expect(shadow.textContent).toContain('We open at 9.');
    widget.destroy();
  });
});
