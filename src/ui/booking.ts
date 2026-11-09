import { ApiError } from '../core/api';
import type {
  AppointmentRequest,
  AppointmentResult,
  BookingAvailability,
  BookingProvider,
  EmbeddedBookingChannel,
} from '../core/types';
import { createField } from './lead-capture';

export type BookingStep =
  'service' | 'schedule' | 'contact' | 'review' | 'done';

export interface BookingViewHandle {
  el: HTMLElement;
  configure(config: EmbeddedBookingChannel | null): void;
  preview(step: BookingStep): void;
  focus(): void;
}

type SlotFilter = 'all' | 'morning' | 'afternoon';
type AvailabilityDay = BookingAvailability['days'][number];

const BACK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FORWARD_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CALENDAR_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const CLOCK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PIN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.5" stroke="currentColor" stroke-width="1.8"/></svg>';
const USER_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c.7-3.8 3.6-6 7.5-6s6.8 2.2 7.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const SLOT_FILTERS: Array<[SlotFilter, string]> = [
  ['all', 'All'],
  ['morning', 'Morning'],
  ['afternoon', 'Afternoon'],
];
const SUBMIT_FAILED =
  'We could not complete your booking. Check your connection and try again.';

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function emptyState() {
  return {
    serviceId: '',
    address: { street: '', city: '', state: '', postalCode: '', notes: '' },
    date: '',
    startAt: '',
    filter: 'all' as SlotFilter,
    contact: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      smsConsent: false,
    },
  };
}

function durationLabel(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export function createBookingView(handlers: {
  provider: BookingProvider;
  onExit: () => void;
}): BookingViewHandle {
  const el = node('div', 'kw-booking');

  const top = node('div', 'kw-booking-top');
  const homeButton = node('button', 'kw-lead-back');
  homeButton.type = 'button';
  homeButton.innerHTML = `${BACK_ICON}<span>Home</span>`;
  homeButton.addEventListener('click', handlers.onExit);
  const stepLabel = node('span', 'kw-booking-step-label');
  const progress = node('div', 'kw-booking-progress');
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', 'Booking progress');
  progress.setAttribute('aria-valuemin', '1');
  const progressBar = node('span', 'kw-booking-progress-bar');
  progress.append(progressBar);
  top.append(homeButton, stepLabel, progress);

  const content = node('div', 'kw-booking-content');
  const errorEl = node('p', 'kw-booking-error');
  errorEl.setAttribute('role', 'alert');
  errorEl.hidden = true;

  const nav = node('div', 'kw-booking-nav');
  const backButton = node('button', 'kw-btn-secondary', 'Back');
  backButton.type = 'button';
  const nextButton = node('button', 'kw-btn-primary kw-btn-primary--center');
  nextButton.type = 'button';
  nav.append(backButton, nextButton);

  el.append(top, content, errorEl, nav);

  let config: EmbeddedBookingChannel | null = null;
  let step: BookingStep = 'service';
  let state = emptyState();
  let days: AvailabilityDay[] = [];
  let lastDate = '';
  let availabilityStatus: 'idle' | 'loading' | 'error' = 'idle';
  let availabilityRun = 0;
  let previewRun = 0;
  let requestId = crypto.randomUUID();
  let submitting = false;
  let result: AppointmentResult | null = null;
  let activeForm: HTMLFormElement | null = null;
  // Survives the re-render that follows reloading times after a lost slot.
  let scheduleNotice = '';
  let durationMinutes = 60;

  function steps(): BookingStep[] {
    return ['service', 'schedule', 'contact', 'review'];
  }

  function selectedService() {
    return config?.services.find((item) => item.id === state.serviceId);
  }

  function resetAvailability(): void {
    availabilityRun += 1;
    days = [];
    lastDate = '';
    availabilityStatus = 'idle';
    state.date = '';
    state.startAt = '';
    requestId = crypto.randomUUID();
  }

  function reset(): void {
    state = emptyState();
    result = null;
    step = 'service';
    submitting = false;
    resetAvailability();
  }

  function formatTime(startAt: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: config?.timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(startAt));
  }

  function formatDay(startAt: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: config?.timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(startAt));
  }

  function timeZoneLabel(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: config?.timeZone,
      timeZoneName: 'long',
    }).formatToParts(new Date());
    return (
      parts.find((part) => part.type === 'timeZoneName')?.value ??
      config?.timeZone ??
      ''
    );
  }

  function isMorning(startAt: string): boolean {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: config?.timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(startAt));
    return Number(hour) < 12;
  }

  function addressLine(address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  }): string {
    return `${address.street}, ${address.city}, ${address.state} ${address.postalCode}`;
  }

  function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function updateNav(): void {
    const list = steps();
    const index = list.indexOf(step);
    const done = step === 'done';
    top.hidden = done;
    backButton.hidden = done;
    nav.classList.toggle('kw-booking-nav--single', done);
    if (done) {
      nextButton.textContent = 'Done';
      nextButton.disabled = false;
      return;
    }
    stepLabel.textContent = `Step ${index + 1} of ${list.length}`;
    progress.setAttribute('aria-valuemax', String(list.length));
    progress.setAttribute('aria-valuenow', String(index + 1));
    progressBar.style.width = `${((index + 1) / list.length) * 100}%`;
    backButton.disabled = submitting;
    nextButton.textContent =
      step !== 'review'
        ? 'Next'
        : submitting
          ? 'Booking…'
          : 'Confirm and Submit';
    nextButton.disabled =
      submitting ||
      (step === 'service' && !selectedService()) ||
      (step === 'schedule' && !state.startAt);
  }

  function heading(text: string, description?: string): HTMLElement {
    const title = node('h2', 'kw-booking-heading', text);
    title.tabIndex = -1;
    content.append(title);
    if (description)
      content.append(node('p', 'kw-booking-description', description));
    return title;
  }

  function bindField(
    field: { input: HTMLInputElement | HTMLTextAreaElement },
    value: string,
    onChange: (value: string) => void,
  ): void {
    field.input.value = value;
    field.input.addEventListener('input', () => onChange(field.input.value));
  }

  function renderService(): void {
    if (!config) return;
    heading(config.heading || 'How can we help you?', config.description);
    const list = node('div', 'kw-service-list');
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', 'Service');
    for (const service of config.services) {
      const option = node('label', 'kw-service');
      const input = node('input', 'kw-service-input');
      input.type = 'radio';
      input.name = 'kw-booking-service';
      input.value = service.id;
      input.checked = service.id === state.serviceId;
      option.classList.toggle('kw-service--selected', input.checked);
      const text = node('span', 'kw-service-text');
      text.append(node('span', 'kw-service-name', service.name));
      if (service.description)
        text.append(node('span', 'kw-service-meta', service.description));
      const check = node('span', 'kw-service-check');
      check.innerHTML = CHECK_ICON;
      option.append(input, text, check);
      input.addEventListener('change', () => {
        state.serviceId = service.id;
        list
          .querySelectorAll('.kw-service')
          .forEach((item) =>
            item.classList.toggle('kw-service--selected', item === option),
          );
        updateNav();
      });
      list.append(option);
    }
    content.append(list);
  }

  function addressFields(): HTMLElement[] {
    const street = createField({
      id: 'kw-book-street',
      label: 'Street address',
      autocomplete: 'address-line1',
      required: true,
    });
    const city = createField({
      id: 'kw-book-city',
      label: 'City',
      autocomplete: 'address-level2',
      required: true,
    });
    const region = createField({
      id: 'kw-book-state',
      label: 'State',
      autocomplete: 'address-level1',
      required: true,
    });
    const postal = createField({
      id: 'kw-book-postal',
      label: 'ZIP / Postal code',
      autocomplete: 'postal-code',
      required: true,
    });
    const notes = createField({
      id: 'kw-book-notes',
      label: 'Property notes',
      optional: true,
      multiline: true,
      placeholder: 'Gate code, parking, anything we should know',
    });
    bindField(street, state.address.street, (v) => (state.address.street = v));
    bindField(city, state.address.city, (v) => (state.address.city = v));
    bindField(region, state.address.state, (v) => (state.address.state = v));
    bindField(
      postal,
      state.address.postalCode,
      (v) => (state.address.postalCode = v),
    );
    bindField(notes, state.address.notes, (v) => (state.address.notes = v));
    const row = node('div', 'kw-field-row');
    row.append(region.wrap, postal.wrap);
    return [
      node('h3', 'kw-booking-subheading', 'Property address'),
      street.wrap,
      city.wrap,
      row,
      notes.wrap,
    ];
  }

  async function loadAvailability(): Promise<void> {
    const service = selectedService();
    if (!service) return;
    const run = ++availabilityRun;
    availabilityStatus = 'loading';
    if (step === 'schedule') render();
    try {
      const from = days.length
        ? nextDate(days[days.length - 1].date)
        : undefined;
      const page = await handlers.provider.getAvailability(service.id, from);
      if (run !== availabilityRun) return;
      days = [...days, ...page.days];
      lastDate = page.lastDate;
      durationMinutes = page.durationMinutes;
      availabilityStatus = 'idle';
      if (!state.date)
        state.date =
          days.find((day) => day.slots.some((slot) => slot.available))?.date ??
          '';
    } catch {
      if (run !== availabilityRun) return;
      availabilityStatus = 'error';
    }
    if (step === 'schedule') render();
  }

  function nextDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + 1))
      .toISOString()
      .slice(0, 10);
  }

  function renderDateStrip(): HTMLElement {
    const wrap = node('div', 'kw-date-nav');
    const strip = node('div', 'kw-date-strip');
    const scrollBy = (direction: number) =>
      strip.scrollBy?.({ left: direction * 220, behavior: 'smooth' });
    const previous = node('button', 'kw-date-arrow');
    previous.type = 'button';
    previous.setAttribute('aria-label', 'Earlier dates');
    previous.innerHTML = BACK_ICON;
    previous.addEventListener('click', () => scrollBy(-1));
    const next = node('button', 'kw-date-arrow');
    next.type = 'button';
    next.setAttribute('aria-label', 'Later dates');
    next.innerHTML = FORWARD_ICON;
    next.addEventListener('click', () => scrollBy(1));

    for (const day of days) {
      const [year, month, date] = day.date.split('-').map(Number);
      const noon = new Date(Date.UTC(year, month - 1, date, 12));
      const part = (options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          ...options,
        }).format(noon);
      const card = node('button', 'kw-date');
      card.type = 'button';
      card.disabled = !day.slots.some((slot) => slot.available);
      card.setAttribute('aria-pressed', String(day.date === state.date));
      card.setAttribute(
        'aria-label',
        part({ weekday: 'long', month: 'long', day: 'numeric' }),
      );
      card.append(
        node('span', 'kw-date-weekday', part({ weekday: 'short' })),
        node('span', 'kw-date-day', part({ day: 'numeric' })),
        node('span', 'kw-date-month', part({ month: 'short' })),
      );
      card.addEventListener('click', () => {
        state.date = day.date;
        state.startAt = '';
        const offset = strip.scrollLeft;
        render();
        const renewed = content.querySelector('.kw-date-strip');
        if (renewed) renewed.scrollLeft = offset;
      });
      strip.append(card);
    }
    if (days.length > 0 && days[days.length - 1].date < lastDate) {
      const more = node('button', 'kw-date kw-date--more', 'More dates');
      more.type = 'button';
      more.disabled = availabilityStatus === 'loading';
      more.addEventListener('click', () => void loadAvailability());
      strip.append(more);
    }
    wrap.append(previous, strip, next);
    return wrap;
  }

  function renderSchedule(): void {
    heading(
      'When would you like to schedule?',
      `Times shown in ${timeZoneLabel()}.`,
    );
    if (availabilityStatus === 'idle' && days.length === 0) {
      void loadAvailability();
      return;
    }
    if (days.length === 0 && availabilityStatus === 'loading') {
      const skeleton = node('div', 'kw-booking-loading');
      skeleton.setAttribute('role', 'status');
      skeleton.setAttribute('aria-label', 'Loading available times');
      for (let index = 0; index < 6; index += 1)
        skeleton.append(node('span', 'kw-booking-loading-block'));
      content.append(skeleton);
      return;
    }
    if (availabilityStatus === 'error') {
      const failed = node('div', 'kw-booking-empty');
      failed.append(
        node('p', '', 'We could not load available times. Please try again.'),
      );
      const retry = node('button', 'kw-btn-secondary', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', () => void loadAvailability());
      failed.append(retry);
      content.append(failed);
      return;
    }

    content.append(renderDateStrip());

    const filters = node('div', 'kw-slot-filter');
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Time of day');
    for (const [value, label] of SLOT_FILTERS) {
      const button = node('button', 'kw-slot-filter-option', label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(state.filter === value));
      button.addEventListener('click', () => {
        state.filter = value;
        render();
      });
      filters.append(button);
    }
    content.append(filters);

    const slots = (
      days.find((day) => day.date === state.date)?.slots ?? []
    ).filter(
      (slot) =>
        state.filter === 'all' ||
        isMorning(slot.startAt) === (state.filter === 'morning'),
    );
    if (slots.length === 0) {
      content.append(
        node(
          'p',
          'kw-booking-empty',
          state.date
            ? 'No times match on this day. Try another day or filter.'
            : 'No times are available right now. Please check back soon.',
        ),
      );
      return;
    }
    const grid = node('div', 'kw-slots');
    for (const slot of slots) {
      const button = node('button', 'kw-slot', formatTime(slot.startAt));
      button.type = 'button';
      button.disabled = !slot.available;
      button.setAttribute(
        'aria-pressed',
        String(slot.startAt === state.startAt),
      );
      button.addEventListener('click', () => {
        state.startAt = slot.startAt;
        scheduleNotice = '';
        showError('');
        grid
          .querySelectorAll('.kw-slot')
          .forEach((item) =>
            item.setAttribute('aria-pressed', String(item === button)),
          );
        updateNav();
      });
      grid.append(button);
    }
    content.append(grid);
  }

  function renderContact(): void {
    if (!config) return;
    heading('How do we contact you?');
    const form = node('form', 'kw-booking-form');
    const first = createField({
      id: 'kw-book-first',
      label: 'First name',
      autocomplete: 'given-name',
      required: true,
      pattern: '.*\\S.*',
    });
    const last = createField({
      id: 'kw-book-last',
      label: 'Last name',
      autocomplete: 'family-name',
      required: true,
      pattern: '.*\\S.*',
    });
    const phone = createField({
      id: 'kw-book-phone',
      label: 'Mobile phone',
      type: 'tel',
      autocomplete: 'tel',
      required: config.requirePhone,
      optional: !config.requirePhone,
      pattern: '\\+?[0-9\\(\\)\\-.\\s]{6,24}',
    });
    const email = createField({
      id: 'kw-book-email',
      label: 'Email address',
      type: 'email',
      autocomplete: 'email',
      required: config.requireEmail,
      optional: !config.requireEmail,
    });
    bindField(first, state.contact.firstName, (v) => {
      state.contact.firstName = v;
    });
    bindField(last, state.contact.lastName, (v) => {
      state.contact.lastName = v;
    });
    bindField(phone, state.contact.phone, (v) => {
      state.contact.phone = v;
      phone.input.setCustomValidity('');
    });
    bindField(email, state.contact.email, (v) => {
      state.contact.email = v;
      phone.input.setCustomValidity('');
    });

    const consent = node('label', 'kw-consent');
    const checkbox = node('input', 'kw-consent-input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.contact.smsConsent;
    checkbox.addEventListener('change', () => {
      state.contact.smsConsent = checkbox.checked;
    });
    consent.append(
      checkbox,
      node(
        'span',
        'kw-consent-text',
        'Text me updates about this appointment. Optional. Message and data rates may apply. Reply STOP to opt out.',
      ),
    );

    const row = node('div', 'kw-field-row');
    row.append(first.wrap, last.wrap);
    form.append(
      row,
      phone.wrap,
      email.wrap,
      ...(config.requireAddress ? addressFields() : []),
      consent,
      node(
        'p',
        'kw-booking-privacy',
        "We'll only use your details for this appointment.",
      ),
    );
    form.addEventListener('submit', (event) => event.preventDefault());
    activeForm = form;
    content.append(form);
  }

  function appointmentCard(details: {
    serviceName: string;
    durationMinutes: number;
    startAt: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
    } | null;
    contact?: string[];
    reference?: string;
  }): HTMLElement {
    const card = node('div', 'kw-appointment');
    const head = node('div', 'kw-appointment-head');
    head.append(
      node('span', 'kw-appointment-service', details.serviceName),
      node(
        'span',
        'kw-appointment-duration',
        durationLabel(details.durationMinutes),
      ),
    );
    const body = node('dl', 'kw-appointment-body');
    const endAt = new Date(
      new Date(details.startAt).getTime() + details.durationMinutes * 60_000,
    ).toISOString();
    const rows: Array<[string, string, string[]]> = [
      ['Date', CALENDAR_ICON, [formatDay(details.startAt)]],
      [
        'Time',
        CLOCK_ICON,
        [
          `${formatTime(details.startAt)} – ${formatTime(endAt)}`,
          timeZoneLabel(),
        ],
      ],
    ];
    if (details.address)
      rows.push(['Location', PIN_ICON, [addressLine(details.address)]]);
    if (details.contact?.length)
      rows.push(['Contact', USER_ICON, details.contact]);
    for (const [label, icon, lines] of rows) {
      const row = node('div', 'kw-appointment-row');
      const iconEl = node('span', 'kw-appointment-icon');
      iconEl.innerHTML = icon;
      const text = node('div', '');
      text.append(node('dt', '', label));
      for (const line of lines) text.append(node('dd', '', line));
      row.append(iconEl, text);
      body.append(row);
    }
    card.append(head, body);
    if (details.reference) {
      const footer = node('div', 'kw-appointment-ref');
      footer.append(
        node('span', '', 'Reference'),
        node('strong', '', details.reference),
      );
      card.append(footer);
    }
    return card;
  }

  function renderReview(): void {
    const service = selectedService();
    if (!service || !config) return;
    heading('Confirm Your Appointment');
    const { contact, address } = state;
    content.append(
      appointmentCard({
        serviceName: service.name,
        durationMinutes,
        startAt: state.startAt,
        address: config.requireAddress ? address : null,
        contact: [
          `${contact.firstName.trim()} ${contact.lastName.trim()}`,
          contact.phone.trim(),
          contact.email.trim(),
        ].filter(Boolean),
      }),
    );
  }

  function renderDone(): void {
    if (!result) return;
    const badge = node('span', 'kw-booking-done-badge');
    badge.innerHTML = CHECK_ICON;
    content.append(badge);
    heading("You're booked", result.confirmationText);
    content.append(
      appointmentCard({
        serviceName: result.serviceName,
        durationMinutes: result.durationMinutes,
        startAt: result.startAt,
        address: result.address,
        reference: result.reference,
      }),
      node(
        'p',
        'kw-booking-note',
        state.contact.email.trim()
          ? `We sent a confirmation to ${state.contact.email.trim()}. Keep your reference handy if you need to change anything.`
          : 'Keep your reference handy if you need to change anything.',
      ),
    );
  }

  function render(): void {
    content.textContent = '';
    content.classList.toggle('kw-booking-content--done', step === 'done');
    activeForm = null;
    showError(step === 'schedule' ? scheduleNotice : '');
    if (!config) return;
    if (step === 'service') renderService();
    else if (step === 'schedule') renderSchedule();
    else if (step === 'contact') renderContact();
    else if (step === 'review') renderReview();
    else renderDone();
    updateNav();
  }

  function goTo(next: BookingStep): void {
    step = next;
    render();
    content.scrollTop = 0;
    content.classList.remove('kw-booking-content--enter');
    void content.offsetWidth;
    content.classList.add('kw-booking-content--enter');
    content.querySelector<HTMLElement>('.kw-booking-heading')?.focus();
  }

  function buildRequest(): AppointmentRequest {
    const { contact, address } = state;
    return {
      clientRequestId: requestId,
      serviceId: state.serviceId,
      startAt: state.startAt,
      customer: {
        firstName: contact.firstName.trim(),
        lastName: contact.lastName.trim(),
        phone: contact.phone.trim() || undefined,
        email: contact.email.trim() || undefined,
        smsConsent: contact.smsConsent,
      },
      address: config?.requireAddress
        ? {
            street: address.street.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            postalCode: address.postalCode.trim(),
            notes: address.notes.trim() || undefined,
          }
        : undefined,
    };
  }

  async function submit(): Promise<void> {
    if (submitting) return;
    submitting = true;
    showError('');
    updateNav();
    try {
      result = await handlers.provider.createAppointment(buildRequest());
      submitting = false;
      goTo('done');
      return;
    } catch (error) {
      submitting = false;
      if (error instanceof ApiError && error.status === 409) {
        resetAvailability();
        scheduleNotice = error.message;
        goTo('schedule');
        return;
      }
      showError(
        error instanceof ApiError && error.status === 400
          ? error.message
          : SUBMIT_FAILED,
      );
      updateNav();
    }
  }

  backButton.addEventListener('click', () => {
    const list = steps();
    const index = list.indexOf(step);
    if (index <= 0) handlers.onExit();
    else goTo(list[index - 1]);
  });

  nextButton.addEventListener('click', () => {
    if (step === 'done') {
      reset();
      render();
      handlers.onExit();
      return;
    }
    if (step === 'review') {
      void submit();
      return;
    }
    if (step === 'contact' && activeForm) {
      const phone =
        activeForm.querySelector<HTMLInputElement>('#kw-book-phone');
      phone?.setCustomValidity(
        state.contact.phone.trim() || state.contact.email.trim()
          ? ''
          : 'Enter a phone number or email address.',
      );
    }
    if (activeForm && !activeForm.reportValidity()) return;
    const list = steps();
    goTo(list[list.indexOf(step) + 1]);
  });

  return {
    el,
    configure(next) {
      const changed = JSON.stringify(next) !== JSON.stringify(config);
      config = next;
      if (!changed) return;
      if (state.serviceId && !selectedService()) reset();
      if (!steps().includes(step) && step !== 'done') step = 'service';
      render();
    },
    preview(target) {
      const run = ++previewRun;
      reset();
      if (!config) return;
      state.serviceId = config.services[0]?.id ?? '';
      state.address = {
        street: '128 Maple Avenue',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62704',
        notes: '',
      };
      state.contact = {
        firstName: 'Alex',
        lastName: 'Morgan',
        phone: '(555) 010-2030',
        email: 'alex@example.com',
        smsConsent: false,
      };
      void (async () => {
        if (target !== 'service') {
          await loadAvailability();
          if (run !== previewRun) return;
          state.startAt =
            days
              .find((day) => day.date === state.date)
              ?.slots.find((slot) => slot.available)?.startAt ?? '';
        }
        if (target === 'done')
          result = await handlers.provider.createAppointment(buildRequest());
        if (run !== previewRun) return;
        step = target;
        render();
      })();
    },
    focus() {
      content.querySelector<HTMLElement>('.kw-booking-heading')?.focus();
    },
  };
}
