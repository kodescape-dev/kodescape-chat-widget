export interface LeadCaptureData {
  name: string;
  email: string;
  message: string;
}

export interface LeadCaptureConfig {
  askName: boolean;
  requireName: boolean;
  askEmail: boolean;
  requireEmail: boolean;
  heading: string;
  description: string;
}

export interface LeadCaptureHandle {
  el: HTMLElement;
  focusFirstField(): void;
  reset(): void;
  configure(config: LeadCaptureConfig): void;
}

const BACK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h16v11H8l-4 3v-14Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const LOCK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function createLeadCaptureForm(handlers: {
  onBack: () => void;
  onSubmit: (data: LeadCaptureData) => void;
}): LeadCaptureHandle {
  const el = document.createElement('div');
  el.className = 'kw-lead-capture';

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'kw-lead-back';
  backButton.setAttribute('aria-label', 'Back');
  backButton.innerHTML = `${BACK_ICON}<span>Back</span>`;
  backButton.addEventListener('click', handlers.onBack);

  const heading = document.createElement('p');
  heading.className = 'kw-lead-heading';
  heading.hidden = true;

  const description = document.createElement('p');
  description.className = 'kw-lead-description';
  description.hidden = true;

  const form = document.createElement('form');
  form.className = 'kw-lead-form';
  form.noValidate = false;

  const nameField = createField({
    id: 'kw-lead-name',
    label: 'Name',
    type: 'text',
    autocomplete: 'name',
    required: true,
    pattern: '.*\\S.*',
    placeholder: 'Enter your full name',
  });
  const emailField = createField({
    id: 'kw-lead-email',
    label: 'Email address',
    type: 'email',
    autocomplete: 'email',
    required: true,
    placeholder: 'Enter your email address',
  });
  const messageField = createField({
    id: 'kw-lead-message',
    label: 'How can we help?',
    optional: true,
    multiline: true,
    placeholder: 'Tell us what you need help with…',
  });

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'kw-btn-primary kw-btn-primary--center';
  submitButton.innerHTML = `${CHAT_ICON}<span>Start chat</span>`;

  const privacy = document.createElement('p');
  privacy.className = 'kw-lead-privacy';
  privacy.innerHTML = `${LOCK_ICON}<span>We'll only use your details for this conversation.</span>`;

  const footer = createPoweredBy();

  form.append(
    nameField.wrap,
    emailField.wrap,
    messageField.wrap,
    submitButton,
    privacy,
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    handlers.onSubmit({
      name: nameField.input.value.trim(),
      email: emailField.input.value.trim(),
      message: messageField.input.value.trim(),
    });
  });

  el.append(backButton, heading, description, form, footer);

  return {
    el,
    focusFirstField() {
      const target = nameField.wrap.hidden ? emailField.input : nameField.input;
      if (target === emailField.input && emailField.wrap.hidden) {
        messageField.input.focus();
        return;
      }
      target.focus();
    },
    reset() {
      form.reset();
    },
    configure(config) {
      nameField.wrap.hidden = !config.askName;
      nameField.input.required = config.askName && config.requireName;
      nameField.input.disabled = !config.askName;

      emailField.wrap.hidden = !config.askEmail;
      emailField.input.required = config.askEmail && config.requireEmail;
      emailField.input.disabled = !config.askEmail;

      heading.textContent = config.heading;
      heading.hidden = !config.heading;

      description.textContent = config.description;
      description.hidden = !config.description;
    },
  };
}

export function createField(options: {
  id: string;
  label: string;
  type?: string;
  autocomplete?: string;
  required?: boolean;
  optional?: boolean;
  multiline?: boolean;
  placeholder?: string;
  pattern?: string;
}): { wrap: HTMLElement; input: HTMLInputElement | HTMLTextAreaElement } {
  const wrap = document.createElement('div');
  wrap.className = 'kw-field';

  const label = document.createElement('label');
  label.htmlFor = options.id;
  label.textContent = options.label;
  if (options.optional) {
    const opt = document.createElement('span');
    opt.className = 'kw-field-opt';
    opt.textContent = ' (optional)';
    label.appendChild(opt);
  }

  const input = options.multiline
    ? document.createElement('textarea')
    : document.createElement('input');
  input.id = options.id;
  input.className = 'kw-field-input';
  if (input instanceof HTMLInputElement) {
    input.type = options.type ?? 'text';
    if (options.autocomplete)
      input.setAttribute('autocomplete', options.autocomplete);
    if (options.pattern) input.pattern = options.pattern;
  } else {
    input.rows = 3;
  }
  if (options.required) input.required = true;
  if (options.placeholder) input.placeholder = options.placeholder;

  wrap.append(label, input);
  return { wrap, input };
}
import { createPoweredBy } from './branding';
