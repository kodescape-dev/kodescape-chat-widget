import { createBrandMark, setBrandMarkImage } from './branding';
import { createField } from './lead-capture';

export interface ContactPromptConfig {
  askName: boolean;
  requireName: boolean;
  askEmail: boolean;
  requireEmail: boolean;
  heading: string;
  description: string;
}

export interface ContactPromptData {
  name: string;
  email: string;
}

export interface ContactPromptHandle {
  el: HTMLElement;
  configure(config: ContactPromptConfig): void;
  setAvatar(avatarUrl: string | null): void;
  show(options?: { focus?: boolean }): void;
  hide(): void;
}

export const DEFAULT_CONTACT_HEADING = 'Please introduce yourself:';

const CHEVRON_DOWN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CLOSE_DURATION_MS = 280;

export function createContactPrompt(handlers: {
  onSubmit: (data: ContactPromptData) => void;
  onDismiss: () => void;
}): ContactPromptHandle {
  const el = document.createElement('div');
  el.className = 'kw-contact-prompt';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Introduce yourself');
  el.hidden = true;

  const sheet = document.createElement('div');
  sheet.className = 'kw-contact-prompt-sheet';

  const top = document.createElement('div');
  top.className = 'kw-contact-prompt-top';

  const avatar = createBrandMark('kw-contact-prompt-avatar');

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'kw-contact-prompt-dismiss';
  dismissButton.setAttribute('aria-label', 'Hide');
  dismissButton.innerHTML = CHEVRON_DOWN_ICON;
  dismissButton.addEventListener('click', () => {
    close();
    handlers.onDismiss();
  });

  top.append(avatar, dismissButton);

  const heading = document.createElement('p');
  heading.className = 'kw-contact-prompt-heading';
  heading.textContent = DEFAULT_CONTACT_HEADING;

  const description = document.createElement('p');
  description.className = 'kw-contact-prompt-description';
  description.hidden = true;

  const form = document.createElement('form');
  form.className = 'kw-contact-prompt-form';

  const nameField = createField({
    id: 'kw-contact-prompt-name',
    label: 'Name',
    type: 'text',
    autocomplete: 'name',
    placeholder: 'Enter your name...',
  });
  const emailField = createField({
    id: 'kw-contact-prompt-email',
    label: 'Email address',
    type: 'email',
    autocomplete: 'email',
    placeholder: 'Enter your email...',
  });

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'kw-contact-prompt-submit';
  submitButton.textContent = 'Send';

  form.append(nameField.wrap, emailField.wrap, submitButton);
  sheet.append(top, heading, description, form);
  el.appendChild(sheet);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    close();
    handlers.onSubmit({
      name: nameField.input.value.trim(),
      email: emailField.input.value.trim(),
    });
  });

  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function finishClose(): void {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = null;
    el.classList.remove('kw-contact-prompt--closing');
  }

  function hide(): void {
    finishClose();
    el.hidden = true;
  }

  function close(): void {
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (el.hidden || reducedMotion) {
      hide();
      return;
    }
    el.classList.add('kw-contact-prompt--closing');
    // Falls back to a timer because animationend never fires if the panel is hidden mid-slide.
    closeTimer = setTimeout(hide, CLOSE_DURATION_MS + 60);
  }

  sheet.addEventListener('animationend', (event) => {
    if (
      event.target === sheet &&
      el.classList.contains('kw-contact-prompt--closing')
    ) {
      hide();
    }
  });

  return {
    el,
    configure(config) {
      heading.textContent = config.heading.trim() || DEFAULT_CONTACT_HEADING;
      description.textContent = config.description.trim();
      description.hidden = !description.textContent;

      nameField.wrap.hidden = !config.askName;
      nameField.input.required = config.askName && config.requireName;
      nameField.input.disabled = !config.askName;

      emailField.wrap.hidden = !config.askEmail;
      emailField.input.required = config.askEmail && config.requireEmail;
      emailField.input.disabled = !config.askEmail;
    },
    setAvatar(avatarUrl) {
      setBrandMarkImage(avatar, avatarUrl);
    },
    show(options) {
      finishClose();
      el.hidden = false;
      if (options?.focus === false) return;
      const first = [nameField, emailField].find((field) => !field.wrap.hidden);
      first?.input.focus({ preventScroll: true });
    },
    hide,
  };
}
