import type { ContactRequestKind, WidgetChannels } from '../core/types';
import { createPoweredBy } from './branding';

export interface HomeViewHandle {
  el: HTMLElement;
  setWelcomeMessage(text: string): void;
  setHeading(text: string): void;
  setStarters(items: string[]): void;
  setStatus(text: string): void;
  setChannels(channels: WidgetChannels | null | undefined): void;
  setResumeAvailable(available: boolean): void;
  focusPrimary(): void;
}

const ARROW_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 17.5 2.5 20v-4.7A8.4 8.4 0 0 1 2 12.5C2 7.8 6.3 4 11.5 4S21 7.8 21 12.5 16.7 21 11.5 21a10.4 10.4 0 0 1-6.5-2.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 11.5h.01m4-.01h.01m4-.01h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const CHANNEL_ICONS = {
  book: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 15a2 2 0 0 1-2 2H8l-4.5 4V5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  call: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="m3 7 9 6.5L21 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
} as const;

const DEFAULT_LABELS = { text: 'Text', call: 'Call', email: 'Email' } as const;

const STARTER_ICONS = {
  rocket:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m12 15-3-3M22 2l-7 20-4-9-9-4 20-7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  package:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16.5 9.4 7.55 4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m3.27 6.96 8.73 5.04 8.73-5.04M12 22.08V12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  creditCard:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M1 10h22" stroke="currentColor" stroke-width="1.8"/></svg>',
  lifeBuoy:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  messages:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
} as const;

export function createHomeView(handlers: {
  onStart: () => void;
  onContinue: () => void;
  onStarter: (text: string) => void;
  onBook: () => void;
  onRequest: (kind: ContactRequestKind) => void;
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
  const startTitle = document.createElement('span');
  startTitle.className = 'kw-btn-primary-title';
  startTitle.textContent = 'Start a conversation';
  const startStatus = document.createElement('span');
  startStatus.className = 'kw-btn-primary-status';
  startStatus.hidden = true;
  startStatus.setAttribute('role', 'status');
  startLabel.append(startTitle, startStatus);
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

  const channelList = document.createElement('div');
  channelList.className = 'kw-channels';
  channelList.hidden = true;

  function addChannel(
    kind: keyof typeof CHANNEL_ICONS,
    label: string,
    href?: string,
  ): HTMLElement {
    const tile = document.createElement(href ? 'a' : 'button');
    tile.className = 'kw-channel';
    if (tile instanceof HTMLAnchorElement) tile.href = href ?? '';
    else tile.type = 'button';
    const icon = document.createElement('span');
    icon.className = `kw-channel-icon kw-channel-icon--${kind}`;
    icon.innerHTML = CHANNEL_ICONS[kind];
    const text = document.createElement('span');
    text.className = 'kw-channel-label';
    text.textContent = label;
    tile.append(icon, text);
    channelList.appendChild(tile);
    return tile;
  }

  const starterList = document.createElement('div');
  starterList.className = 'kw-starters';
  starterList.hidden = true;

  const footer = createPoweredBy();

  el.append(
    greeting,
    welcome,
    startButton,
    channelList,
    starterList,
    resumeLink,
    footer,
  );

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
    setStatus(text) {
      startStatus.textContent = text;
      startStatus.hidden = !text;
      startButton.classList.toggle('kw-btn-primary--has-status', Boolean(text));
    },
    setChannels(channels) {
      channelList.textContent = '';
      const { booking, text, call, email } = channels ?? {};
      if (booking?.mode === 'embedded') {
        addChannel('book', booking.label || 'Book').addEventListener(
          'click',
          handlers.onBook,
        );
      } else if (booking) {
        const link = addChannel('book', booking.label || 'Book', booking.url);
        if (
          link instanceof HTMLAnchorElement &&
          link.origin !== location.origin
        ) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      }
      for (const [kind, form] of [
        ['text', text],
        ['call', call],
        ['email', email],
      ] as const) {
        if (!form) continue;
        addChannel(kind, form.label || DEFAULT_LABELS[kind]).addEventListener(
          'click',
          () => handlers.onRequest(kind),
        );
      }
      channelList.hidden = channelList.childElementCount === 0;
      channelList.style.setProperty(
        '--kw-channel-count',
        String(channelList.childElementCount),
      );
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
  if (/getting.?started|welcome|new|start|begin|intro/i.test(text))
    return 'rocket';
  if (/product|service|feature|solution/i.test(text)) return 'package';
  if (/pric|plan|cost|bill|subscription/i.test(text)) return 'creditCard';
  if (/support|help|issue|problem|bug|error|technical/i.test(text))
    return 'lifeBuoy';
  if (/team|contact|talk|chat|human|agent|sales/i.test(text)) return 'messages';
  return (['rocket', 'package', 'creditCard', 'lifeBuoy', 'messages'][index] ??
    'messages') as keyof typeof STARTER_ICONS;
}

function starterIcon(text: string, index: number): string {
  return STARTER_ICONS[starterIconType(text, index)];
}
