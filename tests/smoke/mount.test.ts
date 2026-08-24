import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

function jsonResponse(data: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () =>
      Promise.resolve({
        success: ok,
        statusCode: ok ? 200 : 500,
        message: '',
        data,
      }),
  };
}

function widgetSettings(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Widget',
    supportDisplayName: 'Test Support',
    supportSubtitle: 'Replies in a few minutes',
    supportAvatarUrl: null,
    incomingMessageSound: true,
    primaryColor: '#123456',
    backgroundColor: '#654321',
    textColor: '#fefefe',
    launcherPosition: 'left',
    welcomeMessage: 'Hi there',
    welcomeHeading: 'Welcome',
    conversationStarters: ['Account help'],
    composerPlaceholder: 'Write here…',
    launcherStyle: 'label_icon',
    launcherLabel: 'Chat now',
    launcherIcon: 'chat',
    askName: true,
    requireName: true,
    askEmail: true,
    requireEmail: true,
    formHeading: '',
    formDescription: '',
    contactCollectionMode: 'before_chat',
    showOnDesktop: true,
    showOnMobile: true,
    visibilityRules: [],
    ...overrides,
  };
}

describe('mount()', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(max-width: 480px)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        const url = input;
        if (url.includes('/widget-settings')) {
          return jsonResponse(widgetSettings());
        }
        if (url.includes('/session')) {
          return jsonResponse({
            resumeToken: 'resume-1',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        if (url.includes('/messages') && !url.includes('POST')) {
          return jsonResponse({ items: [], nextCursor: null });
        }
        return jsonResponse({});
      }),
    );
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('mounts a shadow-DOM host with the launcher closed by default', async () => {
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });

    const host = container.firstElementChild as HTMLElement;
    expect(host.shadowRoot).not.toBeNull();

    const panel = host.shadowRoot!.querySelector('.kw-panel') as HTMLElement;
    expect(panel.hidden).toBe(true);

    widget.destroy();
  });

  it('connects visitor presence as soon as the site loads', async () => {
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });

    await flush();
    await flush();

    const connectHandler = fakeSocket.on.mock.calls.find(
      ([event]) => event === 'connect',
    )?.[1] as (() => void) | undefined;
    expect(connectHandler).toBeTypeOf('function');

    widget.destroy();
  });

  it('shows and clears a numeric unread-message counter on the launcher', async () => {
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();
    await flush();

    const messageNewHandler = fakeSocket.on.mock.calls.find(
      ([event]) => event === 'message:new',
    )?.[1] as ((event: unknown) => void) | undefined;
    expect(messageNewHandler).toBeTypeOf('function');

    const createEvent = (id: string) => ({
      conversationId: 'conv-1',
      message: {
        id,
        clientMessageId: `admin-${id}`,
        direction: 'outbound',
        senderType: 'human',
        senderName: 'Agent',
        content: 'Hello',
        createdAt: new Date().toISOString(),
        status: 'sent',
      },
    });
    messageNewHandler?.(createEvent('message-1'));
    messageNewHandler?.(createEvent('message-2'));

    const shadow = container.firstElementChild!.shadowRoot!;
    const launcher = shadow.querySelector('.kw-launcher') as HTMLButtonElement;
    const badge = shadow.querySelector('.kw-launcher-badge') as HTMLElement;
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('2');
    expect(launcher.getAttribute('aria-label')).toContain('2 unread messages');

    launcher.click();
    await flush();
    expect(badge.hidden).toBe(true);

    widget.destroy();
  });

  it('applies the active device profile to the launcher', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(max-width: 480px)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(
            widgetSettings({
              deviceSettings: {
                desktop: {
                  display: true,
                  position: 'right',
                  launcherStyle: 'label_icon',
                  bottomOffset: 32,
                  sideOffset: 28,
                  launcherSize: 'large',
                },
                mobile: {
                  display: false,
                  position: 'left',
                  launcherStyle: 'icon',
                  bottomOffset: 12,
                  sideOffset: 12,
                  launcherSize: 'small',
                },
              },
              visibilityRules: [],
            }),
          );
        }
        return jsonResponse({});
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    const root = host.shadowRoot!.querySelector('.kw-root') as HTMLElement;
    const launcher = host.shadowRoot!.querySelector(
      '.kw-launcher',
    ) as HTMLButtonElement;
    expect(root.classList.contains('kw-root--right')).toBe(true);
    expect(host.style.getPropertyValue('--kw-bottom-offset')).toBe('32px');
    expect(host.style.getPropertyValue('--kw-side-offset')).toBe('28px');
    expect(host.style.getPropertyValue('--kw-launcher-size')).toBe('62px');
    expect(launcher.classList.contains('kw-launcher--label')).toBe(true);
    expect(launcher.textContent).toContain('Chat now');
    expect(host.style.display).toBe('');

    widget.destroy();
  });

  it('hides the widget when an exclusion rule matches the current page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(
            widgetSettings({
              visibilityRules: [
                { action: 'exclude', match: 'prefix', value: '/' },
              ],
            }),
          );
        }
        return jsonResponse({});
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    expect((container.firstElementChild as HTMLElement).style.display).toBe(
      'none',
    );
    widget.destroy();
  });

  it('runs isolated preview states with the real renderer and no network or socket connection', async () => {
    const { mount } = await import('../../src/mount');
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockClear();
    const widget = mount({
      siteId: 'preview',
      apiBaseUrl: 'http://should-not-be-called.test',
      target: container,
      preview: true,
    });

    const host = container.firstElementChild as HTMLElement;
    const shadow = host.shadowRoot!;
    const panel = shadow.querySelector('.kw-panel') as HTMLElement;
    expect(panel.hidden).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fakeSocket.on).not.toHaveBeenCalled();
    expect(shadow.querySelector('.kw-welcome')?.textContent).toBe(
      'How can we help you today?',
    );
    expect(panel.classList).toContain('kw-panel--home');

    const previewAvatarUrl = 'https://cdn.example.com/preview-support.png';
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window.parent,
        data: {
          type: 'kodescape-widget-preview:configure',
          settings: widgetSettings({
            welcomeHeading: 'Unsaved preview heading',
            conversationStarters: ['Billing question'],
            supportAvatarUrl: previewAvatarUrl,
          }),
          state: 'home',
          device: 'mobile',
        },
      }),
    );

    expect(shadow.querySelector('.kw-home-greeting')?.textContent).toBe(
      'Unsaved preview heading',
    );
    expect(shadow.querySelector('.kw-starter')?.textContent).toContain(
      'Billing question',
    );
    expect(
      (shadow.querySelector('.kw-home .kw-btn-primary') as HTMLButtonElement)
        .hidden,
    ).toBe(false);
    expect(
      shadow
        .querySelector('.kw-powered')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Powered by Kodescape');
    expect(shadow.querySelector('.kw-powered-mark img')).not.toBeNull();
    expect(
      shadow.querySelector('.kw-header-brand img')?.getAttribute('src'),
    ).toBe(previewAvatarUrl);
    expect(shadow.querySelector('.kw-root')?.classList).toContain(
      'kw-preview--mobile',
    );

    const menuButton = shadow.querySelector(
      'button[aria-label="Chat options"]',
    ) as HTMLButtonElement;
    const headerMenu = shadow.querySelector('.kw-header-menu') as HTMLElement;
    const notificationsButton = shadow.querySelector(
      '.kw-header-menu-item',
    ) as HTMLButtonElement;
    menuButton.click();
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(headerMenu.hidden).toBe(false);
    expect(notificationsButton.textContent).toContain('Turn off notifications');
    notificationsButton.click();
    expect(headerMenu.hidden).toBe(true);
    menuButton.click();
    expect(notificationsButton.textContent).toContain('Turn on notifications');
    menuButton.click();

    (shadow.querySelector('.kw-starter') as HTMLButtonElement).click();
    await flush();
    expect((shadow.querySelector('.kw-chat-view') as HTMLElement).hidden).toBe(
      false,
    );
    expect(shadow.querySelector('.kw-list')?.textContent).toContain(
      'Billing question',
    );
    expect(shadow.querySelectorAll('.kw-message-avatar')).toHaveLength(2);
    expect(shadow.querySelector('.kw-status-text')?.textContent).toBe(
      'Replies in a few minutes',
    );
    expect(shadow.querySelector('.kw-header-title')?.textContent).toBe(
      'Test Support',
    );

    const composerControls = Array.from(
      shadow.querySelector('.kw-composer-row')?.children ?? [],
    );
    expect(composerControls.map((control) => control.className)).toEqual([
      'kw-composer-input-row',
      'kw-composer-toolbar',
    ]);

    const emojiButton = shadow.querySelector(
      'button[aria-label="Insert emoji"]',
    ) as HTMLButtonElement;
    emojiButton.click();
    expect(emojiButton.getAttribute('aria-expanded')).toBe('true');
    expect(shadow.querySelector('.kw-emoji-search')).not.toBeNull();
    expect(
      shadow.querySelectorAll('.kw-emoji-grid button').length,
    ).toBeGreaterThan(1000);
    const firstEmoji = shadow.querySelector(
      '.kw-emoji-grid button',
    ) as HTMLButtonElement;
    firstEmoji.click();
    const composerInput = shadow.querySelector(
      '.kw-composer-input',
    ) as HTMLTextAreaElement;
    expect(composerInput.value).toBe('😀');

    const fileInput = shadow.querySelector(
      '.kw-composer input[type="file"]',
    ) as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['details'], 'brief.txt', { type: 'text/plain' })],
    });
    fileInput.dispatchEvent(new Event('change'));
    await flush();
    expect(shadow.querySelector('.kw-file-chip')?.textContent).toContain(
      'brief.txt',
    );
    expect(fetchMock).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window.parent,
        data: {
          type: 'kodescape-widget-preview:configure',
          settings: widgetSettings(),
          state: 'minimized',
          device: 'desktop',
        },
      }),
    );
    expect(panel.hidden).toBe(true);
    widget.destroy();
  });

  it('updates pre-chat copy in preview without moving focus into the form', async () => {
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'preview',
      apiBaseUrl: 'http://should-not-be-called.test',
      target: container,
      preview: true,
    });
    const host = container.firstElementChild as HTMLElement;
    const shadow = host.shadowRoot!;
    const editorInput = document.createElement('input');
    document.body.appendChild(editorInput);
    editorInput.focus();

    const updatePreview = (formHeading: string, formDescription: string) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window.parent,
          data: {
            type: 'kodescape-widget-preview:configure',
            settings: widgetSettings({ formHeading, formDescription }),
            state: 'pre-chat',
            device: 'desktop',
          },
        }),
      );
    };

    updatePreview('Before we begin', 'Tell us a little about yourself.');

    expect(shadow.querySelector('.kw-lead-heading')?.textContent).toBe(
      'Before we begin',
    );
    expect(shadow.querySelector('.kw-lead-description')?.textContent).toBe(
      'Tell us a little about yourself.',
    );
    expect(document.activeElement).toBe(editorInput);

    updatePreview('How can we help?', 'This copy updates while you type.');

    expect(shadow.querySelector('.kw-lead-heading')?.textContent).toBe(
      'How can we help?',
    );
    expect(shadow.querySelector('.kw-lead-description')?.textContent).toBe(
      'This copy updates while you type.',
    );
    expect(
      (shadow.querySelector('#kw-lead-name') as HTMLInputElement).value,
    ).toBe('');
    expect(document.activeElement).toBe(editorInput);

    editorInput.remove();
    widget.destroy();
  });

  it('opens the panel on launcher click and closes it again on a second click', async () => {
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });

    const host = container.firstElementChild as HTMLElement;
    const launcher = host.shadowRoot!.querySelector(
      '.kw-launcher',
    ) as HTMLButtonElement;
    const panel = host.shadowRoot!.querySelector('.kw-panel') as HTMLElement;

    launcher.click();
    await flush();

    expect(panel.hidden).toBe(false);
    expect(launcher.getAttribute('aria-expanded')).toBe('true');

    launcher.click();
    expect(panel.hidden).toBe(true);
    expect(launcher.getAttribute('aria-expanded')).toBe('false');

    widget.destroy();
  });

  it('closes the panel on Escape', async () => {
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });

    const host = container.firstElementChild as HTMLElement;
    const launcher = host.shadowRoot!.querySelector(
      '.kw-launcher',
    ) as HTMLButtonElement;
    const panel = host.shadowRoot!.querySelector('.kw-panel') as HTMLElement;

    launcher.click();
    await flush();
    expect(panel.hidden).toBe(false);

    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(panel.hidden).toBe(true);

    widget.destroy();
  });

  it('applies fetched branding including the support avatar in the header', async () => {
    const avatarUrl = 'https://cdn.example.com/support-avatar.png';
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(widgetSettings({ supportAvatarUrl: avatarUrl }));
        }
        return jsonResponse({});
      }),
    );
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });

    await flush();

    const host = container.firstElementChild as HTMLElement;
    expect(host.style.getPropertyValue('--kw-primary-color')).toBe('#123456');
    expect(host.style.getPropertyValue('--kw-background-color')).toBe(
      '#654321',
    );
    expect(host.style.getPropertyValue('--kw-text-color')).toBe('#fefefe');

    const root = host.shadowRoot!.querySelector('.kw-root') as HTMLElement;
    expect(root.classList.contains('kw-root--left')).toBe(true);

    const welcome = host.shadowRoot!.querySelector(
      '.kw-welcome',
    ) as HTMLElement;
    expect(welcome.textContent).toBe('Hi there');
    expect(welcome.hidden).toBe(false);

    const headerBrand = host.shadowRoot!.querySelector(
      '.kw-header-brand',
    ) as HTMLElement;
    expect(headerBrand.classList.contains('kw-brand-mark--custom')).toBe(true);
    expect(headerBrand.querySelector('img')?.getAttribute('src')).toBe(
      avatarUrl,
    );

    widget.destroy();
  });

  it('degrades to offline instead of an unhandled rejection when the widget/session is unavailable (e.g. wrong or disabled siteId)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/widget-settings') || input.includes('/session')) {
          return jsonResponse({ message: 'Chat widget not available' }, false);
        }
        return jsonResponse({});
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'unknown-or-disabled-site',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });

    const host = container.firstElementChild as HTMLElement;
    const launcher = host.shadowRoot!.querySelector(
      '.kw-launcher',
    ) as HTMLButtonElement;
    const panel = host.shadowRoot!.querySelector('.kw-panel') as HTMLElement;

    launcher.click();
    await flush();
    await flush();

    expect(panel.hidden).toBe(false);

    widget.destroy();
  });

  it('shows only the enabled identity fields with the configured heading/description', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(
            widgetSettings({
              askEmail: false,
              formHeading: 'Say hi',
              formDescription: 'We reply fast.',
            }),
          );
        }
        if (input.includes('/session')) {
          return jsonResponse({
            resumeToken: 'resume-1',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        return jsonResponse({ items: [], nextCursor: null });
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    (
      host.shadowRoot!.querySelector('.kw-launcher') as HTMLButtonElement
    ).click();
    await flush();
    (
      host.shadowRoot!.querySelector(
        '.kw-home .kw-btn-primary',
      ) as HTMLButtonElement
    ).click();
    await flush();

    const heading = host.shadowRoot!.querySelector(
      '.kw-lead-heading',
    ) as HTMLElement;
    const description = host.shadowRoot!.querySelector(
      '.kw-lead-description',
    ) as HTMLElement;
    const nameWrap = (
      host.shadowRoot!.querySelector('#kw-lead-name') as HTMLInputElement
    ).closest('.kw-field') as HTMLElement;
    const emailWrap = (
      host.shadowRoot!.querySelector('#kw-lead-email') as HTMLInputElement
    ).closest('.kw-field') as HTMLElement;

    expect(heading.hidden).toBe(false);
    expect(heading.textContent).toBe('Say hi');
    expect(description.textContent).toBe('We reply fast.');
    expect(nameWrap.hidden).toBe(false);
    expect(emailWrap.hidden).toBe(true);
    expect(host.shadowRoot!.activeElement).toBe(
      host.shadowRoot!.querySelector('#kw-lead-name'),
    );

    widget.destroy();
  });

  it('skips the pre-chat form and enters chat directly when identity capture is disabled (anonymous mode)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(
            widgetSettings({ askName: false, askEmail: false }),
          );
        }
        if (input.includes('/session')) {
          return jsonResponse({
            resumeToken: 'resume-1',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        return jsonResponse({ items: [], nextCursor: null });
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    (
      host.shadowRoot!.querySelector('.kw-launcher') as HTMLButtonElement
    ).click();
    await flush();
    (
      host.shadowRoot!.querySelector(
        '.kw-home .kw-btn-primary',
      ) as HTMLButtonElement
    ).click();
    await flush();

    const chatView = host.shadowRoot!.querySelector(
      '.kw-chat-view',
    ) as HTMLElement;
    const leadCapture = host.shadowRoot!.querySelector(
      '.kw-lead-capture',
    ) as HTMLElement;
    expect(chatView.hidden).toBe(false);
    expect(leadCapture.hidden).toBe(true);

    widget.destroy();
  });

  it('submits identity and the first message on pre-chat form submission', async () => {
    const calls: { url: string; body?: string; method?: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        calls.push({
          url: input,
          body: init?.body as string | undefined,
          method: init?.method,
        });
        if (input.includes('/widget-settings')) {
          return jsonResponse(widgetSettings());
        }
        if (input.includes('/session')) {
          return jsonResponse({
            resumeToken: 'resume-1',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        if (input.includes('/identify')) {
          return jsonResponse({
            name: 'Jane Doe',
            email: 'jane@example.com',
            contactId: 'contact-1',
          });
        }
        if (input.includes('/messages') && init?.method === 'POST') {
          const parsed = JSON.parse(init.body as string) as {
            clientMessageId: string;
            content: string;
          };
          return jsonResponse({
            id: 'message-1',
            clientMessageId: parsed.clientMessageId,
            direction: 'inbound',
            senderType: 'visitor',
            senderName: null,
            content: parsed.content,
            createdAt: new Date().toISOString(),
            status: 'sent',
          });
        }
        return jsonResponse({ items: [], nextCursor: null });
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    (
      host.shadowRoot!.querySelector('.kw-launcher') as HTMLButtonElement
    ).click();
    await flush();
    (
      host.shadowRoot!.querySelector(
        '.kw-home .kw-btn-primary',
      ) as HTMLButtonElement
    ).click();
    await flush();

    const nameField = host.shadowRoot!.querySelector(
      '#kw-lead-name',
    ) as HTMLInputElement;
    const emailField = host.shadowRoot!.querySelector(
      '#kw-lead-email',
    ) as HTMLInputElement;
    const messageField = host.shadowRoot!.querySelector(
      '#kw-lead-message',
    ) as HTMLTextAreaElement;
    nameField.value = 'Jane Doe';
    emailField.value = 'jane@example.com';
    messageField.value = 'I need help';

    (
      host.shadowRoot!.querySelector(
        '.kw-lead-form .kw-btn-primary--center',
      ) as HTMLButtonElement
    ).click();
    await flush();
    await flush();
    await flush();

    const identifyCall = calls.find((call) => call.url.includes('/identify'));
    expect(identifyCall).toBeDefined();
    expect(JSON.parse(identifyCall!.body!)).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
    });

    const messageCall = calls.find(
      (call) => call.url.includes('/messages') && call.method === 'POST',
    );
    expect(messageCall).toBeDefined();
    expect(JSON.parse(messageCall!.body!)).toMatchObject({
      content: 'I need help',
    });

    widget.destroy();
  });

  it('removes the host element on destroy', async () => {
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });

    expect(container.childElementCount).toBe(1);
    widget.destroy();
    expect(container.childElementCount).toBe(0);
  });

  it('does not skip the pre-chat form for a resumed session with no associated Contact', async () => {
    localStorage.setItem(
      'kodescape_chat_resume_token:site-1',
      'stale-resume-token',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(widgetSettings());
        }
        if (input.includes('/session')) {
          return jsonResponse({
            resumeToken: 'stale-resume-token',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            contactId: null,
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        return jsonResponse({ items: [], nextCursor: null });
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    (
      host.shadowRoot!.querySelector('.kw-launcher') as HTMLButtonElement
    ).click();
    await flush();
    await flush();

    const chatViewAfterOpen = host.shadowRoot!.querySelector(
      '.kw-chat-view',
    ) as HTMLElement;
    expect(chatViewAfterOpen.hidden).toBe(true);

    (
      host.shadowRoot!.querySelector(
        '.kw-home .kw-btn-primary',
      ) as HTMLButtonElement
    ).click();
    await flush();
    await flush();

    const leadCapture = host.shadowRoot!.querySelector(
      '.kw-lead-capture',
    ) as HTMLElement;
    const chatView = host.shadowRoot!.querySelector(
      '.kw-chat-view',
    ) as HTMLElement;
    expect(leadCapture.hidden).toBe(false);
    expect(chatView.hidden).toBe(true);

    widget.destroy();
  });

  it('skips the pre-chat form and auto-resumes when the resumed session IS associated with a Contact', async () => {
    localStorage.setItem(
      'kodescape_chat_resume_token:site-1',
      'identified-resume-token',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(widgetSettings());
        }
        if (input.includes('/session')) {
          return jsonResponse({
            resumeToken: 'identified-resume-token',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            contactId: 'contact-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        return jsonResponse({ items: [], nextCursor: null });
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    (
      host.shadowRoot!.querySelector('.kw-launcher') as HTMLButtonElement
    ).click();
    await flush();
    await flush();

    const chatView = host.shadowRoot!.querySelector(
      '.kw-chat-view',
    ) as HTMLElement;
    const leadCapture = host.shadowRoot!.querySelector(
      '.kw-lead-capture',
    ) as HTMLElement;
    expect(chatView.hidden).toBe(false);
    expect(leadCapture.hidden).toBe(true);

    widget.destroy();
  });

  it('after_first_message: skips the pre-chat form on Start, then shows the inline contact prompt once, only after the first message send succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(
            widgetSettings({ contactCollectionMode: 'after_first_message' }),
          );
        }
        if (input.includes('/session')) {
          return jsonResponse({
            resumeToken: 'resume-1',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        if (input.includes('/messages') && init?.method === 'POST') {
          const parsed = JSON.parse(init.body as string) as {
            clientMessageId: string;
            content: string;
          };
          return jsonResponse({
            id: 'message-1',
            clientMessageId: parsed.clientMessageId,
            direction: 'inbound',
            senderType: 'visitor',
            senderName: null,
            content: parsed.content,
            createdAt: new Date().toISOString(),
            status: 'sent',
          });
        }
        return jsonResponse({ items: [], nextCursor: null });
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    (
      host.shadowRoot!.querySelector('.kw-launcher') as HTMLButtonElement
    ).click();
    await flush();
    (
      host.shadowRoot!.querySelector(
        '.kw-home .kw-btn-primary',
      ) as HTMLButtonElement
    ).click();
    await flush();

    const chatView = host.shadowRoot!.querySelector(
      '.kw-chat-view',
    ) as HTMLElement;
    const leadCapture = host.shadowRoot!.querySelector(
      '.kw-lead-capture',
    ) as HTMLElement;
    expect(chatView.hidden).toBe(false);
    expect(leadCapture.hidden).toBe(true);

    const contactPrompt = host.shadowRoot!.querySelector(
      '.kw-contact-prompt',
    ) as HTMLElement;
    expect(contactPrompt.hidden).toBe(true);

    const textarea = host.shadowRoot!.querySelector(
      '.kw-composer-input',
    ) as HTMLTextAreaElement;
    textarea.value = 'hello there';
    (
      host.shadowRoot!.querySelector('.kw-composer-send') as HTMLButtonElement
    ).click();
    await flush();
    await flush();
    await flush();

    expect(contactPrompt.hidden).toBe(false);

    (
      host.shadowRoot!.querySelector(
        '.kw-contact-prompt-dismiss',
      ) as HTMLButtonElement
    ).click();
    expect(contactPrompt.hidden).toBe(true);

    textarea.value = 'a second message';
    (
      host.shadowRoot!.querySelector('.kw-composer-send') as HTMLButtonElement
    ).click();
    await flush();
    await flush();
    await flush();

    expect(contactPrompt.hidden).toBe(true);

    widget.destroy();
  });

  it('disabled: never shows the pre-chat form or the inline contact prompt, even with stale askName/askEmail settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(
            widgetSettings({ contactCollectionMode: 'disabled' }),
          );
        }
        if (input.includes('/session')) {
          return jsonResponse({
            resumeToken: 'resume-1',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        if (input.includes('/messages') && init?.method === 'POST') {
          const parsed = JSON.parse(init.body as string) as {
            clientMessageId: string;
            content: string;
          };
          return jsonResponse({
            id: 'message-1',
            clientMessageId: parsed.clientMessageId,
            direction: 'inbound',
            senderType: 'visitor',
            senderName: null,
            content: parsed.content,
            createdAt: new Date().toISOString(),
            status: 'sent',
          });
        }
        return jsonResponse({ items: [], nextCursor: null });
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    (
      host.shadowRoot!.querySelector('.kw-launcher') as HTMLButtonElement
    ).click();
    await flush();
    (
      host.shadowRoot!.querySelector(
        '.kw-home .kw-btn-primary',
      ) as HTMLButtonElement
    ).click();
    await flush();

    const chatView = host.shadowRoot!.querySelector(
      '.kw-chat-view',
    ) as HTMLElement;
    expect(chatView.hidden).toBe(false);

    const textarea = host.shadowRoot!.querySelector(
      '.kw-composer-input',
    ) as HTMLTextAreaElement;
    textarea.value = 'hello there';
    (
      host.shadowRoot!.querySelector('.kw-composer-send') as HTMLButtonElement
    ).click();
    await flush();
    await flush();
    await flush();

    const contactPrompt = host.shadowRoot!.querySelector(
      '.kw-contact-prompt',
    ) as HTMLElement;
    expect(contactPrompt.hidden).toBe(true);

    widget.destroy();
  });

  it('debounces composer typing so rapid keystrokes emit only one socket typing:start, and stops typing immediately on send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input.includes('/widget-settings')) {
          return jsonResponse(
            widgetSettings({ askName: false, askEmail: false }),
          );
        }
        if (input.includes('/session')) {
          return jsonResponse({
            resumeToken: 'resume-1',
            accessToken: 'access-1',
            visitorId: 'visitor-1',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          });
        }
        if (input.includes('/messages') && init?.method === 'POST') {
          const parsed = JSON.parse(init.body as string) as {
            clientMessageId: string;
            content: string;
          };
          return jsonResponse({
            id: 'message-1',
            clientMessageId: parsed.clientMessageId,
            direction: 'inbound',
            senderType: 'visitor',
            senderName: null,
            content: parsed.content,
            createdAt: new Date().toISOString(),
            status: 'sent',
          });
        }
        return jsonResponse({ items: [], nextCursor: null });
      }),
    );

    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();

    const host = container.firstElementChild as HTMLElement;
    (
      host.shadowRoot!.querySelector('.kw-launcher') as HTMLButtonElement
    ).click();
    await flush();
    (
      host.shadowRoot!.querySelector(
        '.kw-home .kw-btn-primary',
      ) as HTMLButtonElement
    ).click();
    await flush();
    await flush();

    const onCalls = fakeSocket.on.mock.calls as [
      string,
      (event: unknown) => void,
    ][];
    const messageNewHandler = onCalls.find(
      ([event]) => event === 'message:new',
    )?.[1];
    expect(messageNewHandler).toBeDefined();
    messageNewHandler!({
      conversationId: 'conv-1',
      message: {
        id: 'seed-1',
        clientMessageId: 'admin-seed',
        direction: 'outbound',
        senderType: 'human',
        senderName: 'Agent',
        content: 'hi there',
        createdAt: new Date().toISOString(),
        status: 'sent',
      },
      conversationSummary: {
        lastMessagePreview: 'hi there',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 1,
        status: 'open',
      },
    });

    const textarea = host.shadowRoot!.querySelector(
      '.kw-composer-input',
    ) as HTMLTextAreaElement;
    for (const value of ['h', 'he', 'hel', 'hell', 'hello']) {
      textarea.value = value;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const typingStartCalls = fakeSocket.emit.mock.calls.filter(
      ([event]) => event === 'typing:start',
    );
    expect(typingStartCalls).toHaveLength(1);
    expect(typingStartCalls[0][1]).toEqual({ conversationId: 'conv-1' });

    (
      host.shadowRoot!.querySelector('.kw-composer-send') as HTMLButtonElement
    ).click();
    await flush();

    const typingStopCalls = fakeSocket.emit.mock.calls.filter(
      ([event]) => event === 'typing:stop',
    );
    expect(typingStopCalls.length).toBeGreaterThanOrEqual(1);
    expect(typingStopCalls[0][1]).toEqual({ conversationId: 'conv-1' });

    widget.destroy();
  });
});
