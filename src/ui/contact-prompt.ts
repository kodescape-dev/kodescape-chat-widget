import { createField } from './lead-capture';

export interface ContactPromptConfig {
  askName: boolean;
  requireName: boolean;
  askEmail: boolean;
  requireEmail: boolean;
}

export interface ContactPromptData {
  name: string;
  email: string;
}

export interface ContactPromptHandle {
  el: HTMLElement;
  configure(config: ContactPromptConfig): void;
  show(): void;
  hide(): void;
}

export function createContactPrompt(handlers: {
  onSubmit: (data: ContactPromptData) => void;
  onDismiss: () => void;
}): ContactPromptHandle {
  const el = document.createElement('div');
  el.className = 'kw-contact-prompt';
  el.hidden = true;

  const heading = document.createElement('p');
  heading.className = 'kw-contact-prompt-heading';
  heading.textContent = 'Stay in the loop';

  const description = document.createElement('p');
  description.className = 'kw-contact-prompt-description';
  description.textContent =
    'Share your details so our team can follow up if you step away.';

  const form = document.createElement('form');
  form.className = 'kw-contact-prompt-form';

  const nameField = createField({
    id: 'kw-contact-prompt-name',
    label: 'Name',
    type: 'text',
    autocomplete: 'name',
  });
  const emailField = createField({
    id: 'kw-contact-prompt-email',
    label: 'Email address',
    type: 'email',
    autocomplete: 'email',
  });

  const actions = document.createElement('div');
  actions.className = 'kw-contact-prompt-actions';

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'kw-contact-prompt-dismiss';
  dismissButton.textContent = 'Not now';
  dismissButton.addEventListener('click', () => {
    hide();
    handlers.onDismiss();
  });

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'kw-contact-prompt-submit';
  submitButton.textContent = 'Share details';

  actions.append(dismissButton, submitButton);
  form.append(nameField.wrap, emailField.wrap, actions);
  el.append(heading, description, form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    hide();
    handlers.onSubmit({
      name: nameField.input.value.trim(),
      email: emailField.input.value.trim(),
    });
  });

  function hide(): void {
    el.hidden = true;
  }

  return {
    el,
    configure(config) {
      nameField.wrap.hidden = !config.askName;
      nameField.input.required = config.askName && config.requireName;
      nameField.input.disabled = !config.askName;

      emailField.wrap.hidden = !config.askEmail;
      emailField.input.required = config.askEmail && config.requireEmail;
      emailField.input.disabled = !config.askEmail;
    },
    show() {
      el.hidden = false;
    },
    hide,
  };
}
