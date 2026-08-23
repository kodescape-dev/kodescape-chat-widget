import { createPoweredBy } from './branding';

export interface HomeViewHandle {
  el: HTMLElement;
  setWelcomeMessage(text: string): void;
  setHeading(text: string): void;
  setStarters(items: string[]): void;
  setResumeAvailable(available: boolean): void;
  focusPrimary(): void;
}

const ARROW_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 17.5 2.5 20v-4.7A8.4 8.4 0 0 1 2 12.5C2 7.8 6.3 4 11.5 4S21 7.8 21 12.5 16.7 21 11.5 21a10.4 10.4 0 0 1-6.5-2.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 11.5h.01m4-.01h.01m4-.01h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const STARTER_ICONS = {
  account:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 20c.5-4.1 2.6-6 6.5-6s6 1.9 6.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  billing:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h18M7 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  issue:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 9.5a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0v-5Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 5V2.5M7.5 7 5.7 5.2M16.5 7l1.8-1.8M7 11H3.5M20.5 11H17M7 15H4M20 15h-3M9 20l1-2.3M15 20l-1-2.3M9 11h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  conversation:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h16v11H8l-4 3v-14Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
} as const;

export function createHomeView(handlers: {
  onStart: () => void;
  onContinue: () => void;
  onStarter: (text: string) => void;
}): HomeViewHandle {
  const el = document.createElement('div');
  el.className = 'kw-home';

  const greeting = document.createElement('p');
  greeting.className = 'kw-home-greeting';
  greeting.textContent = 'Hi there 👋';

  const welcome = document.createElement('p');
  welcome.className = 'kw-welcome';
  welcome.hidden = true;

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'kw-btn-primary';
  const startIcon = document.createElement('span');
  startIcon.className = 'kw-btn-primary-icon';
  startIcon.innerHTML = CHAT_ICON;
  const startLabel = document.createElement('span');
  startLabel.className = 'kw-btn-primary-label';
  startLabel.textContent = 'Start a conversation';
  startButton.append(startIcon, startLabel);
  startButton.insertAdjacentHTML('beforeend', ARROW_ICON);
  startButton.addEventListener('click', handlers.onStart);

  const resumeLink = document.createElement('button');
  resumeLink.type = 'button';
  resumeLink.className = 'kw-resume-link';
  resumeLink.hidden = true;
  resumeLink.innerHTML = `
    <span class="kw-resume-link-text">
      <span>Continue previous conversation</span>
    </span>
  `;
  resumeLink.insertAdjacentHTML('beforeend', CHEVRON_ICON);
  resumeLink.addEventListener('click', handlers.onContinue);

  const starterList = document.createElement('div');
  starterList.className = 'kw-starters';
  starterList.hidden = true;

  const footer = createPoweredBy();

  el.append(greeting, welcome, startButton, starterList, resumeLink, footer);

  return {
    el,
    setWelcomeMessage(text) {
      welcome.textContent = text;
      welcome.hidden = !text;
    },
    setHeading(text) {
      greeting.textContent = text || 'Hi there 👋';
    },
    setStarters(items) {
      starterList.textContent = '';
      starterList.hidden = items.length === 0;
      for (const [index, text] of items.slice(0, 5).entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kw-starter';
        const icon = document.createElement('span');
        icon.className = `kw-starter-icon kw-starter-icon--${starterIconType(text, index)}`;
        icon.innerHTML = starterIcon(text, index);
        const label = document.createElement('span');
        label.className = 'kw-starter-label';
        label.textContent = text;
        button.append(icon, label);
        button.insertAdjacentHTML('beforeend', CHEVRON_ICON);
        button.addEventListener('click', () => handlers.onStarter(text));
        starterList.appendChild(button);
      }
    },
    setResumeAvailable(available) {
      resumeLink.hidden = !available;
    },
    focusPrimary() {
      startButton.focus();
    },
  };
}

function starterIconType(
  text: string,
  index: number,
): keyof typeof STARTER_ICONS {
  if (/account|profile|user|login/i.test(text)) return 'account';
  if (/bill|payment|subscription|invoice|card/i.test(text)) return 'billing';
  if (/bug|issue|error|problem|broken/i.test(text)) return 'issue';
  return (['account', 'billing', 'issue'][index] ??
    'conversation') as keyof typeof STARTER_ICONS;
}

function starterIcon(text: string, index: number): string {
  return STARTER_ICONS[starterIconType(text, index)];
}
