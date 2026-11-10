import { ApiError } from '../core/api';
import type {
  ContactFormChannel,
  ContactRequestKind,
  ContactRequestProvider,
  ContactRequestResult,
  WidgetChannels,
} from '../core/types';
import { createDraftStore, str } from '../core/draft';
import { createField } from './lead-capture';

export interface ContactFormViewHandle {
  el: HTMLElement;
  configure(channels: WidgetChannels | null | undefined): void;
  open(kind: ContactRequestKind): void;
  preview(kind: ContactRequestKind, sent: boolean): void;
  focus(): void;
}

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SUBMIT_LABELS: Record<ContactRequestKind, string> = {
  text: 'Send Request',
  call: 'Request Callback',
  email: 'Send Message',
};
const SENT_HEADINGS: Record<ContactRequestKind, string> = {
  text: 'Request received',
  call: 'Callback requested',
  email: 'Message sent',
};
// The small print under the form. Text and email forms share one wording.
const SMS_TERMS =
  'If you choose to receive text messages, message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help. Consent to receive text messages is not required to submit this form or receive services.';
const LEGAL_TEXT: Record<ContactRequestKind, string> = {
  text: `By submitting this form, you agree that our team may contact you about your inquiry. ${SMS_TERMS}`,
  call: `By submitting this form, you agree that our team may call you about your inquiry. ${SMS_TERMS}`,
  email: `By submitting this form, you agree that our team may contact you about your inquiry. ${SMS_TERMS}`,
};
const SUBMIT_FAILED =
  'We could not send your request. Check your connection and try again.';

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
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    smsConsent: null as boolean | null,
    serviceId: '',
    message: '',
  };
}

function restoreState(saved: Record<string, unknown> | null) {
  const state = emptyState();
  if (!saved) return state;
  state.firstName = str(saved.firstName);
  state.lastName = str(saved.lastName);
  state.phone = str(saved.phone);
  state.email = str(saved.email);
  state.serviceId = str(saved.serviceId);
  state.message = str(saved.message);
  state.smsConsent =
    typeof saved.smsConsent === 'boolean' ? saved.smsConsent : null;
  return state;
}

export function createContactFormView(handlers: {
  provider: ContactRequestProvider;
  onExit: () => void;
  draftKey?: string | null;
}): ContactFormViewHandle {
  const draft = createDraftStore(
    handlers.draftKey ? `${handlers.draftKey}:contact` : null,
  );
  const el = node('div', 'kw-booking kw-contact');
  const content = node('div', 'kw-booking-content');
  const errorEl = node('p', 'kw-booking-error');
  errorEl.setAttribute('role', 'alert');
  errorEl.hidden = true;
  const nav = node('div', 'kw-booking-nav');
  const backButton = node('button', 'kw-btn-secondary', 'Back');
  backButton.type = 'button';
  const submitButton = node('button', 'kw-btn-primary kw-btn-primary--center');
  submitButton.type = 'submit';
  nav.append(backButton, submitButton);
  el.append(content, errorEl, nav);

  let channels: WidgetChannels | null = null;
  let kind: ContactRequestKind = 'text';
  let state = restoreState(draft.load());
  let requestId = crypto.randomUUID();
  let submitting = false;
  let result: ContactRequestResult | null = null;
  let form: HTMLFormElement | null = null;
  let previewRun = 0;

  function channel(): ContactFormChannel | null {
    return channels?.[kind] ?? null;
  }

  function persist(): void {
    draft.save(state);
  }

  function reset(): void {
    draft.clear();
    state = emptyState();
    requestId = crypto.randomUUID();
    result = null;
    submitting = false;
  }

  function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function updateNav(): void {
    const done = Boolean(result);
    backButton.hidden = done;
    nav.classList.toggle('kw-booking-nav--single', done);
    nav.hidden = !channel();
    submitButton.disabled = submitting;
    submitButton.textContent = done
      ? 'Done'
      : submitting
        ? 'Sending…'
        : SUBMIT_LABELS[kind];
    backButton.disabled = submitting;
  }

  function bind(
    field: { input: HTMLInputElement | HTMLTextAreaElement },
    key: 'firstName' | 'lastName' | 'phone' | 'email' | 'message',
  ): void {
    field.input.value = state[key];
    field.input.addEventListener('input', () => {
      state[key] = field.input.value;
      persist();
    });
  }

  function consentField(): HTMLElement {
    // Text requests need an answer; for calls and email it is a bonus.
    const required = kind === 'text';
    const wrap = node('div', 'kw-field');
    const label = node('label', '', 'Can we text you?');
    label.htmlFor = 'kw-contact-sms';
    if (!required) label.append(node('span', 'kw-field-opt', ' (optional)'));
    const select = node('select', 'kw-field-input kw-select');
    select.id = 'kw-contact-sms';
    select.required = required;
    select.append(
      new Option('Select an option', ''),
      new Option('Yes, you can text me at this number', 'yes'),
      new Option('No, do not text me at this number', 'no'),
    );
    select.value =
      state.smsConsent === null ? '' : state.smsConsent ? 'yes' : 'no';
    select.addEventListener('change', () => {
      state.smsConsent = select.value === '' ? null : select.value === 'yes';
      persist();
    });
    wrap.append(label, select);
    return wrap;
  }

  function serviceField(): HTMLElement | null {
    const services = channels?.services ?? [];
    if (services.length === 0) return null;
    const wrap = node('div', 'kw-field');
    const label = node('label', '', 'Service');
    label.htmlFor = 'kw-contact-service';
    const select = node('select', 'kw-field-input kw-select');
    select.id = 'kw-contact-service';
    select.append(new Option('Select an option', ''));
    for (const service of services)
      select.append(new Option(service.name, service.id));
    select.value = state.serviceId;
    select.addEventListener('change', () => {
      state.serviceId = select.value;
      persist();
    });
    wrap.append(label, select);
    return wrap;
  }

  function renderForm(config: ContactFormChannel): void {
    const title = node('h2', 'kw-booking-heading', config.heading);
    title.tabIndex = -1;
    content.append(title);
    if (config.description)
      content.append(node('p', 'kw-booking-description', config.description));

    form = node('form', 'kw-booking-form');
    const phoneRequired = kind !== 'email' || config.requirePhone === true;
    const first = createField({
      id: 'kw-contact-first',
      label: 'First name',
      autocomplete: 'given-name',
      required: true,
      pattern: '.*\\S.*',
      placeholder: 'First name',
    });
    const last = createField({
      id: 'kw-contact-last',
      label: 'Last name',
      autocomplete: 'family-name',
      required: true,
      pattern: '.*\\S.*',
      placeholder: 'Last name',
    });
    const phone = createField({
      id: 'kw-contact-phone',
      label: 'Phone number',
      type: 'tel',
      autocomplete: 'tel',
      required: phoneRequired,
      optional: !phoneRequired,
      pattern: '\\+?[0-9\\(\\)\\-.\\s]{6,24}',
      placeholder: 'Enter your phone number',
    });
    const email = createField({
      id: 'kw-contact-email',
      label: 'Email address',
      type: 'email',
      autocomplete: 'email',
      required: true,
      placeholder: 'Enter your email address',
    });
    const message = createField({
      id: 'kw-contact-message',
      label: 'Message',
      optional: kind === 'call',
      required: kind !== 'call',
      multiline: true,
      placeholder:
        kind === 'call'
          ? 'Anything we should know before we call?'
          : 'How can we help?',
    });
    bind(first, 'firstName');
    bind(last, 'lastName');
    bind(phone, 'phone');
    bind(email, 'email');
    bind(message, 'message');

    const row = node('div', 'kw-field-row');
    row.append(first.wrap, last.wrap);
    form.append(row, phone.wrap);
    if (kind === 'email') form.append(email.wrap);
    form.append(consentField());
    const service = serviceField();
    if (service) form.append(service);
    form.append(
      message.wrap,
      node('p', 'kw-booking-privacy', LEGAL_TEXT[kind]),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void submit();
    });
    content.append(form);
  }

  function renderDone(done: ContactRequestResult): void {
    const badge = node('span', 'kw-booking-done-badge');
    badge.innerHTML = CHECK_ICON;
    const title = node('h2', 'kw-booking-heading', SENT_HEADINGS[kind]);
    title.tabIndex = -1;
    content.append(
      badge,
      title,
      node('p', 'kw-booking-description', done.confirmationText),
    );
    if (done.reference) {
      const card = node('div', 'kw-appointment');
      const footer = node('div', 'kw-appointment-ref');
      footer.append(
        node('span', '', 'Reference'),
        node('strong', '', done.reference),
      );
      card.append(footer);
      content.append(card);
    }
  }

  function render(): void {
    content.textContent = '';
    content.classList.toggle('kw-booking-content--done', Boolean(result));
    form = null;
    showError('');
    const config = channel();
    if (config) {
      if (result) renderDone(result);
      else renderForm(config);
    }
    updateNav();
  }

  function buildPayload() {
    const phone = state.phone.trim();
    const email = state.email.trim();
    const message = state.message.trim();
    return {
      clientRequestId: requestId,
      channel: kind,
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      phone: phone || undefined,
      email: kind === 'email' && email ? email : undefined,
      smsConsent: Boolean(phone) && state.smsConsent === true,
      serviceId: state.serviceId || undefined,
      message: message || undefined,
      pageUrl: location.href,
    };
  }

  async function submit(): Promise<void> {
    if (submitting || !form || !form.reportValidity()) return;
    submitting = true;
    showError('');
    updateNav();
    try {
      result = await handlers.provider.submit(buildPayload());
      submitting = false;
      draft.clear();
      render();
      content.querySelector<HTMLElement>('.kw-booking-heading')?.focus();
    } catch (error) {
      submitting = false;
      showError(
        error instanceof ApiError && error.status === 400
          ? error.message
          : SUBMIT_FAILED,
      );
      updateNav();
    }
  }

  backButton.addEventListener('click', handlers.onExit);
  submitButton.addEventListener('click', (event) => {
    if (result) {
      event.preventDefault();
      reset();
      render();
      handlers.onExit();
      return;
    }
    event.preventDefault();
    form?.requestSubmit();
  });

  return {
    el,
    configure(next) {
      channels = next ?? null;
      render();
    },
    open(next) {
      if (next !== kind) result = null;
      kind = next;
      render();
    },
    preview(next, sent) {
      const run = ++previewRun;
      reset();
      kind = next;
      state = {
        firstName: 'Alex',
        lastName: 'Morgan',
        phone: '(555) 010-2030',
        email: 'alex@example.com',
        smsConsent: null,
        serviceId: '',
        message:
          next === 'call' ? '' : 'I would like a quote for a roof repair.',
      };
      if (!sent) {
        render();
        return;
      }
      void handlers.provider.submit(buildPayload()).then((done) => {
        if (run !== previewRun) return;
        result = done;
        render();
      });
    },
    focus() {
      content.querySelector<HTMLElement>('.kw-booking-heading')?.focus();
    },
  };
}
