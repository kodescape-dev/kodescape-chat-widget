import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContactPrompt } from '../../src/ui/contact-prompt';

function setup() {
  const onSubmit = vi.fn();
  const onDismiss = vi.fn();
  const prompt = createContactPrompt({ onSubmit, onDismiss });
  prompt.configure({
    askName: true,
    requireName: true,
    askEmail: true,
    requireEmail: true,
    heading: '',
    description: '',
  });
  document.body.appendChild(prompt.el);
  prompt.show();
  return { prompt, onSubmit, onDismiss };
}

describe('createContactPrompt()', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('asks with placeholders and no visible labels', () => {
    const { prompt } = setup();

    expect(
      prompt.el.querySelector<HTMLInputElement>('#kw-contact-prompt-name')
        ?.placeholder,
    ).toBe('Enter your name...');
    expect(
      prompt.el.querySelector<HTMLInputElement>('#kw-contact-prompt-email')
        ?.placeholder,
    ).toBe('Enter your email...');
  });

  it('shows the default heading and no description until one is set', () => {
    const { prompt } = setup();
    const heading = prompt.el.querySelector('.kw-contact-prompt-heading');
    const description = prompt.el.querySelector<HTMLElement>(
      '.kw-contact-prompt-description',
    )!;

    expect(heading?.textContent).toBe('Please introduce yourself:');
    expect(description.hidden).toBe(true);

    prompt.configure({
      askName: true,
      requireName: true,
      askEmail: true,
      requireEmail: true,
      heading: 'Before we begin',
      description: 'Tell us how we can help.',
    });

    expect(heading?.textContent).toBe('Before we begin');
    expect(description.textContent).toBe('Tell us how we can help.');
    expect(description.hidden).toBe(false);
  });

  it('sends the trimmed details and hides itself', () => {
    vi.useFakeTimers();
    const { prompt, onSubmit } = setup();
    prompt.el.querySelector<HTMLInputElement>(
      '#kw-contact-prompt-name',
    )!.value = '  Alex Visitor ';
    prompt.el.querySelector<HTMLInputElement>(
      '#kw-contact-prompt-email',
    )!.value = 'alex@example.com';

    prompt.el.querySelector('form')!.requestSubmit();

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Alex Visitor',
      email: 'alex@example.com',
    });
    vi.runAllTimers();
    expect(prompt.el.hidden).toBe(true);
  });

  it('slides down, then hides and reports when the visitor says not now', () => {
    vi.useFakeTimers();
    const { prompt, onDismiss } = setup();

    prompt.el
      .querySelector<HTMLButtonElement>('.kw-contact-prompt-dismiss')!
      .click();

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(prompt.el.classList).toContain('kw-contact-prompt--closing');
    expect(prompt.el.hidden).toBe(false);

    prompt.el
      .querySelector('.kw-contact-prompt-sheet')!
      .dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(prompt.el.hidden).toBe(true);
    expect(prompt.el.classList).not.toContain('kw-contact-prompt--closing');
  });

  it('closes at once when the visitor prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { prompt } = setup();

    prompt.el
      .querySelector<HTMLButtonElement>('.kw-contact-prompt-dismiss')!
      .click();

    expect(prompt.el.hidden).toBe(true);
  });

  it('stops closing when it is shown again mid-slide', () => {
    vi.useFakeTimers();
    const { prompt } = setup();

    prompt.el
      .querySelector<HTMLButtonElement>('.kw-contact-prompt-dismiss')!
      .click();
    prompt.show();
    vi.runAllTimers();

    expect(prompt.el.hidden).toBe(false);
    expect(prompt.el.classList).not.toContain('kw-contact-prompt--closing');
  });
});
