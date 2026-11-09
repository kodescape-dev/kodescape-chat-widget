import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fakeSocket = {
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  auth: {},
  emit: vi.fn(
    (event: string, payload?: unknown, ack?: (response: unknown) => void) => {
      if (event !== 'message:send' || !ack) return;
      const data = payload as { clientMessageId: string; content: string };
      ack({
        ok: true,
        message: {
          id: `socket-${data.clientMessageId}`,
          conversationId: 'conversation-1',
          clientMessageId: data.clientMessageId,
          direction: 'inbound',
          senderType: 'visitor',
          senderName: null,
          content: data.content,
          attachments: [],
          replyTo: null,
          reactions: [],
          status: 'sent',
          createdAt: new Date().toISOString(),
        },
      });
    },
  ),
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

const embeddedBooking = {
  mode: 'embedded',
  label: 'Book',
  heading: 'How can we help you?',
  description: '',
  confirmationText: 'See you soon.',
  timeZone: 'America/New_York',
  services: [
    { id: 'leak', name: 'Leak Repair', description: '' },
    {
      id: 'gutters',
      name: 'Gutter Services',
      description: 'Cleaning and repair',
    },
  ],
  requireAddress: true,
  requireEmail: true,
  requirePhone: true,
};

const availability = {
  timeZone: 'America/New_York',
  durationMinutes: 60,
  lastDate: '2026-11-13',
  days: [
    { date: '2026-11-11', slots: [] },
    {
      date: '2026-11-12',
      slots: [
        { startAt: '2026-11-12T14:00:00.000Z', available: true },
        { startAt: '2026-11-12T15:00:00.000Z', available: false },
        { startAt: '2026-11-12T19:00:00.000Z', available: true },
      ],
    },
    {
      date: '2026-11-13',
      slots: [{ startAt: '2026-11-13T14:00:00.000Z', available: true }],
    },
  ],
};

const formChannel = (label: string) => ({
  label,
  heading: `${label} heading`,
  description: '',
  confirmationText: 'Thanks!',
});

function widgetSettings(channels?: unknown) {
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
    ...(channels === undefined ? {} : { channels }),
  };
}

describe('contact channels and embedded booking', () => {
  let container: HTMLDivElement;
  let appointmentResponses: Array<() => unknown>;
  let fetchMock: ReturnType<typeof vi.fn>;

  function stubFetch(channels?: unknown) {
    fetchMock = vi.fn((input: string, init?: RequestInit) => {
      if (input.includes('/widget-settings'))
        return jsonResponse(widgetSettings(channels));
      if (input.includes('/booking/availability'))
        return jsonResponse(availability);
      if (input.includes('/booking/appointments')) {
        const next = appointmentResponses.shift();
        if (next) return next();
        const body = JSON.parse(init?.body as string) as { startAt: string };
        return jsonResponse(
          {
            reference: 'BK-TEST42',
            serviceName: 'Leak Repair',
            durationMinutes: 60,
            startAt: body.startAt,
            timeZone: 'America/New_York',
            address: {
              street: '12 Ridge Rd',
              city: 'Albany',
              state: 'NY',
              postalCode: '12203',
            },
            confirmationText: 'See you soon.',
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
  }

  async function open(channels?: unknown) {
    stubFetch(channels);
    const { mount } = await import('../../src/mount');
    const widget = mount({
      siteId: 'site-1',
      apiBaseUrl: 'http://localhost:5001',
      target: container,
    });
    await flush();
    const shadow = (container.firstElementChild as HTMLElement).shadowRoot!;
    const launcher = shadow.querySelector('.kw-launcher') as HTMLButtonElement;
    launcher.click();
    await flush();
    await flush();
    return { widget, shadow, launcher };
  }

  const query = <T extends HTMLElement>(shadow: ShadowRoot, selector: string) =>
    shadow.querySelector(selector) as T;
  const next = (shadow: ShadowRoot) =>
    query<HTMLButtonElement>(shadow, '.kw-booking-nav .kw-btn-primary');
  const back = (shadow: ShadowRoot) =>
    query<HTMLButtonElement>(shadow, '.kw-booking-nav .kw-btn-secondary');
  const headingText = (shadow: ShadowRoot) =>
    query(shadow, '.kw-booking-heading').textContent;

  function type(shadow: ShadowRoot, id: string, value: string) {
    const input = query<HTMLInputElement>(shadow, `#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function appointmentCalls() {
    return fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/booking/appointments'),
    );
  }

  async function reachReview(shadow: ShadowRoot) {
    query<HTMLElement>(shadow, '.kw-channel').click();
    query<HTMLInputElement>(shadow, '.kw-service-input').click();
    next(shadow).click();
    await flush();
    query<HTMLButtonElement>(shadow, '.kw-slot:not(:disabled)').click();
    next(shadow).click();
    type(shadow, 'kw-book-first', 'Ada');
    type(shadow, 'kw-book-last', 'Lovelace');
    type(shadow, 'kw-book-phone', '(555) 010-2030');
    type(shadow, 'kw-book-email', 'ada@example.com');
    type(shadow, 'kw-book-street', '12 Ridge Rd');
    type(shadow, 'kw-book-city', 'Albany');
    type(shadow, 'kw-book-state', 'NY');
    type(shadow, 'kw-book-postal', '12203');
    next(shadow).click();
  }

  beforeEach(() => {
    appointmentResponses = [];
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

  it('leaves Home and Chat unchanged for a site with no channels configured', async () => {
    const { widget, shadow } = await open();
    expect(query(shadow, '.kw-channels').hidden).toBe(true);
    expect(shadow.querySelectorAll('.kw-channel')).toHaveLength(0);
    expect(query(shadow, '.kw-starter').textContent).toContain('Account help');

    query<HTMLButtonElement>(shadow, '.kw-home .kw-btn-primary').click();
    await flush();
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--chat');
    expect(query(shadow, '.kw-header-home').hidden).toBe(true);
    widget.destroy();
  });

  it('shows only the configured channels with the site phone, email, and booking URL', async () => {
    const { widget, shadow } = await open({
      booking: {
        mode: 'external',
        label: 'Book a call',
        url: 'https://cal.example.com/acme',
      },
      text: formChannel('Text'),
      call: null,
      email: formChannel('Email'),
    });
    const tiles = [
      ...shadow.querySelectorAll<HTMLAnchorElement>('.kw-channel'),
    ];
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      'Book a call',
      'Text',
      'Email',
    ]);
    expect(tiles[0].href).toBe('https://cal.example.com/acme');
    expect(tiles[0].target).toBe('_blank');
    expect(tiles[0].rel).toContain('noopener');
    expect(tiles[1].tagName).toBe('BUTTON');
    expect(tiles[2].tagName).toBe('BUTTON');
    expect(query(shadow, '.kw-home .kw-btn-primary').hidden).toBe(false);
    widget.destroy();
  });

  it('keeps a same-site booking page in the current tab', async () => {
    const { widget, shadow } = await open({
      booking: { mode: 'external', label: 'Book', url: '/book-a-call' },
      text: null,
      call: formChannel('Call'),
      email: null,
    });
    const [book, call] = [
      ...shadow.querySelectorAll<HTMLAnchorElement>('.kw-channel'),
    ];
    expect(book.getAttribute('href')).toBe('/book-a-call');
    expect(book.target).toBe('');
    expect(call.tagName).toBe('BUTTON');
    expect(call.hasAttribute('href')).toBe(false);
    widget.destroy();
  });

  it('walks the full embedded booking journey and confirms only after the API accepts it', async () => {
    const { widget, shadow } = await open({
      booking: embeddedBooking,
      text: null,
      call: null,
      email: null,
    });
    query<HTMLButtonElement>(shadow, 'button.kw-channel').click();
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--booking');
    expect(headingText(shadow)).toBe('How can we help you?');
    expect(shadow.querySelectorAll('.kw-service')).toHaveLength(2);
    expect(query(shadow, '.kw-booking-step').textContent).toBe('Step 1 of 4');
    expect(shadow.querySelector('.kw-booking-progress')).toBeNull();
    expect(shadow.querySelector('.kw-booking-top')).toBeNull();
    expect(query(shadow, '.kw-service-list').textContent).not.toMatch(
      /hour|hr|min/,
    );
    expect(next(shadow).disabled).toBe(true);

    query<HTMLInputElement>(shadow, '.kw-service-input').click();
    expect(query(shadow, '.kw-service').classList).toContain(
      'kw-service--selected',
    );
    expect(next(shadow).disabled).toBe(false);
    next(shadow).click();
    await flush();

    expect(headingText(shadow)).toBe('When would you like to schedule?');
    expect(query(shadow, '.kw-booking-description').textContent).toContain(
      'Eastern',
    );
    const availabilityUrl = String(
      fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/booking/availability'),
      )?.[0],
    );
    expect(availabilityUrl).toContain('siteId=site-1');
    expect(availabilityUrl).toContain('serviceId=leak');
    const dates = [...shadow.querySelectorAll<HTMLButtonElement>('.kw-date')];
    expect(dates.map((date) => date.disabled)).toEqual([true, false, false]);
    expect(dates[1].getAttribute('aria-pressed')).toBe('true');
    const slots = () => [
      ...shadow.querySelectorAll<HTMLButtonElement>('.kw-slot'),
    ];
    expect(slots().map((slot) => slot.textContent)).toEqual([
      expect.stringMatching(/^9:00\sAM$/),
      expect.stringMatching(/^10:00\sAM$/),
      expect.stringMatching(/^2:00\sPM$/),
    ]);
    expect(slots()[1].disabled).toBe(true);
    expect(next(shadow).disabled).toBe(true);

    const filters = [
      ...shadow.querySelectorAll<HTMLButtonElement>('.kw-slot-filter-option'),
    ];
    filters[2].click();
    expect(slots()).toHaveLength(1);
    slots()[0].click();
    expect(slots()[0].getAttribute('aria-pressed')).toBe('true');
    next(shadow).click();

    expect(headingText(shadow)).toBe('How do we contact you?');
    const consent = query<HTMLInputElement>(shadow, '.kw-consent-input');
    expect(consent.checked).toBe(false);
    next(shadow).click();
    expect(headingText(shadow)).toBe('How do we contact you?');
    type(shadow, 'kw-book-first', 'Ada');
    type(shadow, 'kw-book-last', 'Lovelace');
    type(shadow, 'kw-book-phone', '(555) 010-2030');
    type(shadow, 'kw-book-email', 'ada@example.com');
    expect(query(shadow, '.kw-booking-subheading').textContent).toBe(
      'Property address',
    );
    const placeholders = [
      ...shadow.querySelectorAll<HTMLInputElement>('.kw-booking-form input'),
    ]
      .filter((input) => input.type !== 'checkbox')
      .map((input) => input.placeholder);
    expect(placeholders).toHaveLength(8);
    expect(placeholders.every(Boolean)).toBe(true);
    expect(
      query<HTMLTextAreaElement>(shadow, '#kw-book-notes').placeholder,
    ).not.toBe('');
    next(shadow).click();
    expect(headingText(shadow)).toBe('How do we contact you?');
    type(shadow, 'kw-book-street', '12 Ridge Rd');
    type(shadow, 'kw-book-city', 'Albany');
    type(shadow, 'kw-book-state', 'NY');
    type(shadow, 'kw-book-postal', '12203');
    next(shadow).click();

    expect(headingText(shadow)).toBe('Confirm Your Appointment');
    const review = query(shadow, '.kw-appointment').textContent ?? '';
    for (const expected of [
      'Leak Repair',
      '1 hour',
      'Thursday, November 12',
      'Eastern',
      '12 Ridge Rd, Albany, NY 12203',
      'Ada Lovelace',
      'ada@example.com',
    ])
      expect(review).toContain(expected);
    expect(next(shadow).textContent).toBe('Confirm and Submit');
    expect(appointmentCalls()).toHaveLength(0);

    next(shadow).click();
    next(shadow).click();
    await flush();
    expect(appointmentCalls()).toHaveLength(1);
    const [url, init] = appointmentCalls()[0] as [string, RequestInit];
    expect(url).toContain('siteId=site-1');
    expect(JSON.parse(init.body as string)).toMatchObject({
      serviceId: 'leak',
      startAt: '2026-11-12T19:00:00.000Z',
      customer: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '(555) 010-2030',
        email: 'ada@example.com',
        smsConsent: false,
      },
      address: { street: '12 Ridge Rd', postalCode: '12203' },
    });
    expect(headingText(shadow)).toBe("You're booked");
    const confirmation = query(shadow, '.kw-appointment').textContent ?? '';
    for (const expected of ['BK-TEST42', '1 hour', 'Thursday, November 12'])
      expect(confirmation).toContain(expected);
    expect(shadow.querySelector('.kw-booking-step')).toBeNull();
    expect(back(shadow).hidden).toBe(true);
    expect(next(shadow).textContent).toBe('Done');

    next(shadow).click();
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--home');
    widget.destroy();
  });

  it('keeps entered values across Back, Home, and minimize', async () => {
    const { widget, shadow, launcher } = await open({
      booking: embeddedBooking,
      text: null,
      call: null,
      email: null,
    });
    await reachReview(shadow);
    back(shadow).click();
    expect(query<HTMLInputElement>(shadow, '#kw-book-first').value).toBe('Ada');
    expect(query<HTMLInputElement>(shadow, '#kw-book-street').value).toBe(
      '12 Ridge Rd',
    );
    back(shadow).click();
    const pressedSlot = () =>
      query(shadow, '.kw-slot[aria-pressed="true"]').textContent;
    expect(pressedSlot()).toMatch(/9:00\sAM/);
    back(shadow).click();
    expect(query(shadow, '.kw-service').classList).toContain(
      'kw-service--selected',
    );
    shadow.querySelectorAll<HTMLInputElement>('.kw-service-input')[1].click();
    next(shadow).click();
    expect(pressedSlot()).toMatch(/9:00\sAM/);

    launcher.click();
    launcher.click();
    await flush();
    await flush();
    expect(query(shadow, '.kw-panel').hidden).toBe(false);
    expect(headingText(shadow)).toBe('When would you like to schedule?');

    back(shadow).click();
    back(shadow).click();
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--home');
    query<HTMLButtonElement>(shadow, 'button.kw-channel').click();
    next(shadow).click();
    next(shadow).click();
    expect(query<HTMLInputElement>(shadow, '#kw-book-city').value).toBe(
      'Albany',
    );
    widget.destroy();
  });

  it('sends the visitor back to pick a new time when the slot was just taken', async () => {
    const { widget, shadow } = await open({
      booking: embeddedBooking,
      text: null,
      call: null,
      email: null,
    });
    appointmentResponses.push(() =>
      jsonResponse(null, 409, 'That time is no longer available.'),
    );
    await reachReview(shadow);
    next(shadow).click();
    await flush();
    await flush();
    expect(headingText(shadow)).toBe('When would you like to schedule?');
    expect(query(shadow, '.kw-booking-error').textContent).toBe(
      'That time is no longer available.',
    );
    expect(shadow.querySelector('.kw-slot[aria-pressed="true"]')).toBeNull();
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/booking/availability'),
      ),
    ).toHaveLength(2);
    widget.destroy();
  });

  it('stays on review after a network failure and retries the same booking request', async () => {
    const { widget, shadow } = await open({
      booking: embeddedBooking,
      text: null,
      call: null,
      email: null,
    });
    appointmentResponses.push(() => Promise.reject(new Error('offline')));
    await reachReview(shadow);
    next(shadow).click();
    await flush();
    expect(headingText(shadow)).toBe('Confirm Your Appointment');
    expect(query(shadow, '.kw-booking-error').hidden).toBe(false);
    expect(next(shadow).disabled).toBe(false);

    next(shadow).click();
    await flush();
    expect(headingText(shadow)).toBe("You're booked");
    const ids = appointmentCalls().map(
      ([, init]) =>
        (
          JSON.parse((init as RequestInit).body as string) as {
            clientRequestId: string;
          }
        ).clientRequestId,
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    widget.destroy();
  });

  it('lets a visitor move between Chat and Booking without losing the conversation', async () => {
    const { widget, shadow } = await open({
      booking: embeddedBooking,
      text: null,
      call: null,
      email: null,
    });
    query<HTMLButtonElement>(shadow, '.kw-starter').click();
    await flush();
    await flush();
    expect(query(shadow, '.kw-list').textContent).toContain('Account help');
    const home = query<HTMLButtonElement>(shadow, '.kw-header-home');
    expect(home.hidden).toBe(false);

    home.click();
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--home');
    query<HTMLButtonElement>(shadow, 'button.kw-channel').click();
    expect(query(shadow, '.kw-chat-view').hidden).toBe(true);
    back(shadow).click();

    query<HTMLButtonElement>(shadow, '.kw-home .kw-btn-primary').click();
    await flush();
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--chat');
    expect(query(shadow, '.kw-list').textContent).toContain('Account help');
    expect(shadow.querySelectorAll('.kw-bubble-row--inbound')).toHaveLength(1);
    widget.destroy();
  });

  it('previews every booking screen without calling the API', async () => {
    stubFetch();
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
            settings: widgetSettings({
              booking: embeddedBooking,
              text: null,
              call: null,
              email: null,
            }),
            state,
            device: 'desktop',
          },
        }),
      );

    for (const [state, expected] of [
      ['booking-services', 'How can we help you?'],
      ['booking-schedule', 'When would you like to schedule?'],
      ['booking-contact', 'How do we contact you?'],
      ['booking-review', 'Confirm Your Appointment'],
      ['booking-confirmed', "You're booked"],
    ]) {
      configure(state);
      await flush();
      expect(headingText(shadow)).toBe(expected);
    }
    expect(query(shadow, '.kw-appointment').textContent).toContain(
      'BK-PREVIEW',
    );
    expect(shadow.querySelectorAll('.kw-slot').length).toBe(0);
    configure('booking-schedule');
    await flush();
    expect(shadow.querySelectorAll('.kw-slot').length).toBeGreaterThan(0);
    configure('home');
    expect(query(shadow, '.kw-panel').classList).toContain('kw-panel--home');
    expect(fetchMock).not.toHaveBeenCalled();
    widget.destroy();
  });
});
