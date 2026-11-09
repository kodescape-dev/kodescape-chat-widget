import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fakeSocket = {
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  auth: {},
  emit: vi.fn(),
  io: { on: vi.fn() },
};

vi.mock('socket.io-client', () => ({ io: vi.fn(() => fakeSocket) }));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function jsonResponse(data: unknown, status = 200, message = '') {
  const ok = status < 400;
  return {
    ok,
    status,
    json: () =>
      Promise.resolve({ success: ok, statusCode: status, message, data }),
  };
}

const channels = {
  booking: null,
  text: {
    label: 'Text',
    heading: 'Send us a text',
    description: 'Tell us what you need.',
    confirmationText: 'Thanks! A team member will text you back.',
  },
  call: {
    label: 'Call',
    heading: 'Request a callback',
    description: 'Leave your details.',
    confirmationText: 'Thanks! A team member will call you soon.',
  },
  email: {
    label: 'Email',
    heading: 'Send us an email',
    description: 'We reply by email.',
    confirmationText: 'Thanks! We will reply by email.',
    requirePhone: true,
  },
  services: [
    { id: 'leak', name: 'Leak Repair' },
    { id: 'gutters', name: 'Gutter Services' },
  ],
};

function widgetSettings(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Widget',
    supportDisplayName: 'Summit Roofing',
    supportSubtitle: 'Online',
    supportAvatarUrl: null,
    incomingMessageSound: true,
    primaryColor: '#123456',
    launcherPosition: 'right',
    welcomeMessage: 'Hi there',
    welcomeHeading: 'Welcome',
    conversationStarters: ['Account help'],
    composerPlaceholder: 'Write here…',
    launcherStyle: 'icon',
    launcherLabel: 'Chat',
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
    channels,
    ...overrides,
  };
}

describe('contact request forms', () => {
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  let requestResponses: Array<() => unknown>;

  async function open(settings = widgetSettings()) {
    fetchMock = vi.fn((input: string) => {
      if (input.includes('/widget-settings')) return jsonResponse(settings);
      if (input.includes('/public/chat/requests')) {
        const next = requestResponses.shift();
        return next
          ? next()
          : jsonResponse(
              {
                reference: 'REQ-12',
                confirmationText: 'Thanks! A team member will call you soon.',
              },
              201,
            );
      }
      if (input.includes('/session'))
        return jsonResponse({
          resumeToken: 'resume-1',
          accessToken: 'access-1',
          visitorId: 'visitor-1',
          expiresAt: new Date(Date.now() + 900_000).toISOString(),
        });
      if (input.includes('/messages'))
        return jsonResponse({ items: [], nextCursor: null });
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();
    const shadow = (container.firstElementChild as HTMLElement).shadowRoot!;
    shadow.querySelector<HTMLButtonElement>('.kw-launcher')!.click();
    await flush();
    await flush();
    return { widget, shadow };
  }

  const query = <T extends HTMLElement>(shadow: ShadowRoot, selector: string) =>
    shadow.querySelector(selector) as T;
  const tile = (shadow: ShadowRoot, label: string) =>
    [...shadow.querySelectorAll<HTMLElement>('.kw-channel')].find(
      (item) => item.textContent === label,
    )!;
  const submit = (shadow: ShadowRoot) =>
    query<HTMLButtonElement>(
      shadow,
      '.kw-contact .kw-booking-nav .kw-btn-primary',
    );
  const back = (shadow: ShadowRoot) =>
    query<HTMLButtonElement>(shadow, '.kw-contact .kw-btn-secondary');
  const heading = (shadow: ShadowRoot) =>
    query(shadow, '.kw-contact .kw-booking-heading').textContent;

  function type(shadow: ShadowRoot, id: string, value: string) {
    const input = query<HTMLInputElement>(shadow, `#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function fillPerson(shadow: ShadowRoot) {
    type(shadow, 'kw-contact-first', 'Ada');
    type(shadow, 'kw-contact-last', 'Lovelace');
    type(shadow, 'kw-contact-phone', '(555) 010-2030');
  }

  const requestCalls = () =>
    fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/public/chat/requests'),
    );

  beforeEach(() => {
    requestResponses = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('opens each channel as its own form inside the widget instead of a phone, SMS, or mail link', async () => {
    const { widget, shadow } = await open();
    for (const label of ['Text', 'Call', 'Email']) {
      const item = tile(shadow, label);
      expect(item.tagName).toBe('BUTTON');
      expect(item.hasAttribute('href')).toBe(false);
    }

    const cases = [
      ['Text', 'Send us a text', 'Send Request', false],
      ['Call', 'Request a callback', 'Request Callback', false],
      ['Email', 'Send us an email', 'Send Message', true],
    ] as const;
    for (const [label, expectedHeading, button, hasEmail] of cases) {
      tile(shadow, label).click();
      expect(query(shadow, '.kw-panel').classList).toContain(
        'kw-panel--contact',
      );
      expect(heading(shadow)).toBe(expectedHeading);
      expect(submit(shadow).textContent).toBe(button);
      expect(shadow.querySelector('#kw-contact-email') !== null).toBe(hasEmail);
      back(shadow).click();
      expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--home');
    }
    widget.destroy();
  });

  it('shows names, phone, Yes/No consent, service, and message with placeholders, and no consent by default', async () => {
    const { widget, shadow } = await open();
    tile(shadow, 'Text').click();
    const fields = [
      ...shadow.querySelectorAll<HTMLInputElement>(
        '.kw-contact input:not([type="radio"])',
      ),
    ];
    expect(fields.map((field) => field.id)).toEqual([
      'kw-contact-first',
      'kw-contact-last',
      'kw-contact-phone',
    ]);
    expect(fields.every((field) => field.placeholder)).toBe(true);
    const radios = [
      ...shadow.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    expect(radios).toHaveLength(2);
    expect(radios.map((radio) => radio.checked)).toEqual([false, false]);
    expect(
      [...query<HTMLSelectElement>(shadow, '#kw-contact-service').options].map(
        (option) => option.text,
      ),
    ).toEqual(['Select a service', 'Leak Repair', 'Gutter Services']);
    expect(
      query(shadow, '#kw-contact-message').getAttribute('placeholder'),
    ).toBeTruthy();
    widget.destroy();
  });

  it('hides the service choice when the site has no services', async () => {
    const { widget, shadow } = await open(
      widgetSettings({ channels: { ...channels, services: [] } }),
    );
    tile(shadow, 'Call').click();
    expect(shadow.querySelector('#kw-contact-service')).toBeNull();
    widget.destroy();
  });

  it('blocks submission until the required fields are valid, then sends a request and confirms accurately', async () => {
    const { widget, shadow } = await open();
    tile(shadow, 'Text').click();
    submit(shadow).click();
    await flush();
    expect(requestCalls()).toHaveLength(0);
    expect(heading(shadow)).toBe('Send us a text');

    fillPerson(shadow);
    submit(shadow).click();
    await flush();
    expect(requestCalls()).toHaveLength(0);

    type(shadow, 'kw-contact-message', 'Please text me a quote.');
    query<HTMLSelectElement>(shadow, '#kw-contact-service').value = 'leak';
    query<HTMLSelectElement>(shadow, '#kw-contact-service').dispatchEvent(
      new Event('change', { bubbles: true }),
    );
    shadow.querySelectorAll<HTMLInputElement>('input[type="radio"]')[0].click();
    submit(shadow).click();
    submit(shadow).click();
    await flush();

    expect(requestCalls()).toHaveLength(1);
    const [url, init] = requestCalls()[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/public/chat/requests?siteId=site-1');
    expect(JSON.parse(init.body as string)).toMatchObject({
      channel: 'text',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '(555) 010-2030',
      smsConsent: true,
      serviceId: 'leak',
      message: 'Please text me a quote.',
    });
    expect(
      (JSON.parse(init.body as string) as { pageUrl: string }).pageUrl,
    ).toMatch(/^http/);
    expect(heading(shadow)).toBe('Request received');
    expect(
      query(shadow, '.kw-contact .kw-booking-description').textContent,
    ).toBe('Thanks! A team member will call you soon.');
    expect(query(shadow, '.kw-contact .kw-appointment').textContent).toContain(
      'REQ-12',
    );
    expect(submit(shadow).textContent).toBe('Done');

    submit(shadow).click();
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--home');
    widget.destroy();
  });

  it('requires an email on the email form, and a phone only when the site asks for one', async () => {
    const { widget, shadow } = await open(
      widgetSettings({
        channels: {
          ...channels,
          email: { ...channels.email, requirePhone: false },
        },
      }),
    );
    tile(shadow, 'Email').click();
    type(shadow, 'kw-contact-first', 'Ada');
    type(shadow, 'kw-contact-last', 'Lovelace');
    type(shadow, 'kw-contact-message', 'Hello');
    submit(shadow).click();
    await flush();
    expect(requestCalls()).toHaveLength(0);

    type(shadow, 'kw-contact-email', 'ada@example.com');
    submit(shadow).click();
    await flush();
    expect(requestCalls()).toHaveLength(1);
    const body = JSON.parse(
      (requestCalls()[0][1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body).toMatchObject({
      channel: 'email',
      email: 'ada@example.com',
      smsConsent: false,
    });
    expect(body).not.toHaveProperty('phone');
    expect(heading(shadow)).toBe('Message sent');
    widget.destroy();
  });

  it('treats a callback message as optional and never marks consent without a Yes', async () => {
    const { widget, shadow } = await open();
    tile(shadow, 'Call').click();
    fillPerson(shadow);
    shadow.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();
    submit(shadow).click();
    await flush();
    const body = JSON.parse(
      (requestCalls()[0][1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body).toMatchObject({ channel: 'call', smsConsent: false });
    expect(body).not.toHaveProperty('message');
    expect(heading(shadow)).toBe('Callback requested');
    widget.destroy();
  });

  it('keeps what was typed when going Back, and between the three forms', async () => {
    const { widget, shadow } = await open();
    tile(shadow, 'Text').click();
    fillPerson(shadow);
    type(shadow, 'kw-contact-message', 'Draft message');
    back(shadow).click();
    tile(shadow, 'Call').click();
    expect(query<HTMLInputElement>(shadow, '#kw-contact-first').value).toBe(
      'Ada',
    );
    expect(query<HTMLInputElement>(shadow, '#kw-contact-phone').value).toBe(
      '(555) 010-2030',
    );
    expect(
      query<HTMLTextAreaElement>(shadow, '#kw-contact-message').value,
    ).toBe('Draft message');
    widget.destroy();
  });

  it('shows the server message for a rejected request and a retry reuses the same request id', async () => {
    const { widget, shadow } = await open();
    requestResponses.push(() =>
      jsonResponse(null, 400, 'Enter a valid phone number'),
    );
    requestResponses.push(() => Promise.reject(new Error('offline')));
    tile(shadow, 'Call').click();
    fillPerson(shadow);
    submit(shadow).click();
    await flush();
    expect(query(shadow, '.kw-contact .kw-booking-error').textContent).toBe(
      'Enter a valid phone number',
    );
    expect(heading(shadow)).toBe('Request a callback');
    expect(submit(shadow).disabled).toBe(false);

    submit(shadow).click();
    await flush();
    expect(
      query(shadow, '.kw-contact .kw-booking-error').textContent,
    ).toContain('could not send');
    submit(shadow).click();
    await flush();
    expect(heading(shadow)).toBe('Callback requested');
    const ids = requestCalls().map(
      ([, init]) =>
        (
          JSON.parse((init as RequestInit).body as string) as {
            clientRequestId: string;
          }
        ).clientRequestId,
    );
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(1);
    widget.destroy();
  });

  it('keeps a half-filled form across a reload and clears it once the request is sent', async () => {
    const draftKey = 'kodescape_chat_draft:site-1:contact';
    const first = await open();
    tile(first.shadow, 'Text').click();
    fillPerson(first.shadow);
    type(first.shadow, 'kw-contact-message', 'Please text me a quote.');
    first.shadow
      .querySelectorAll<HTMLInputElement>('input[type="radio"]')[0]
      .click();
    const service = query<HTMLSelectElement>(
      first.shadow,
      '#kw-contact-service',
    );
    service.value = 'gutters';
    service.dispatchEvent(new Event('change', { bubbles: true }));
    expect(localStorage.getItem(draftKey)).toContain('Lovelace');
    first.widget.destroy();

    const { widget, shadow } = await open();
    tile(shadow, 'Call').click();
    expect(query<HTMLInputElement>(shadow, '#kw-contact-first').value).toBe(
      'Ada',
    );
    expect(query<HTMLInputElement>(shadow, '#kw-contact-phone').value).toBe(
      '(555) 010-2030',
    );
    expect(
      query<HTMLTextAreaElement>(shadow, '#kw-contact-message').value,
    ).toBe('Please text me a quote.');
    expect(query<HTMLSelectElement>(shadow, '#kw-contact-service').value).toBe(
      'gutters',
    );
    expect(
      [...shadow.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map(
        (radio) => radio.checked,
      ),
    ).toEqual([true, false]);

    submit(shadow).click();
    await flush();
    expect(heading(shadow)).toBe('Callback requested');
    expect(localStorage.getItem(draftKey)).toBeNull();
    widget.destroy();

    const fresh = await open();
    tile(fresh.shadow, 'Text').click();
    expect(
      query<HTMLInputElement>(fresh.shadow, '#kw-contact-first').value,
    ).toBe('');
    fresh.widget.destroy();
  });

  it('ignores a draft that is a week old or unreadable', async () => {
    const draftKey = 'kodescape_chat_draft:site-1:contact';
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        value: { firstName: 'Old' },
      }),
    );
    const stale = await open();
    tile(stale.shadow, 'Text').click();
    expect(
      query<HTMLInputElement>(stale.shadow, '#kw-contact-first').value,
    ).toBe('');
    expect(localStorage.getItem(draftKey)).toBeNull();
    stale.widget.destroy();

    localStorage.setItem(draftKey, '{not json');
    const broken = await open();
    tile(broken.shadow, 'Text').click();
    expect(
      query<HTMLInputElement>(broken.shadow, '#kw-contact-first').value,
    ).toBe('');
    broken.widget.destroy();
  });

  it('previews each form and the sent state without calling the API', async () => {
    fetchMock = vi.fn(() => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'preview',
      target: container,
      preview: true,
    });
    const shadow = (container.firstElementChild as HTMLElement).shadowRoot!;
    const configure = (state: string) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window.parent,
          data: {
            type: 'kodescape-widget-preview:configure',
            settings: widgetSettings(),
            state,
            device: 'desktop',
          },
        }),
      );
    for (const [state, expected] of [
      ['text-form', 'Send us a text'],
      ['call-form', 'Request a callback'],
      ['email-form', 'Send us an email'],
      ['request-sent', 'Request received'],
    ]) {
      configure(state);
      await flush();
      expect(heading(shadow)).toBe(expected);
    }
    expect(query(shadow, '.kw-contact .kw-appointment').textContent).toContain(
      'REQ-PREVIEW',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    configure('home');
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--home');
    widget.destroy();
  });
});
