import { createComposer } from './composer';
import type { ComposerSubmission } from './composer';
import type { MessageAttachment, MessageReply } from '../core/types';
import { createTypingIndicator } from './typing-indicator';
import { createHomeView } from './home';
import { createLeadCaptureForm } from './lead-capture';
import type { LeadCaptureConfig, LeadCaptureData } from './lead-capture';
import { createContactPrompt } from './contact-prompt';
import type { ContactPromptConfig, ContactPromptData } from './contact-prompt';
import { renderLoadingSkeleton, clearLoadingSkeleton } from './message-list';
import {
  createBrandMark,
  createPoweredBy,
  setBrandMarkImage,
} from './branding';

export interface ChatWindowHandle {
  el: HTMLElement;
  listEl: HTMLElement;
  setVisible(visible: boolean): void;
  setLoading(loading: boolean): void;
  setConnectionStatus(connected: boolean): void;
  setName(name: string): void;
  setWelcomeMessage(text: string): void;
  setHomeHeading(text: string): void;
  setStarters(items: string[]): void;
  setSupportIdentity(
    name: string,
    subtitle: string,
    avatarUrl: string | null,
  ): void;
  setComposerPlaceholder(text: string): void;
  setReply(reply: MessageReply | null): void;
  setResumeAvailable(available: boolean): void;
  setNotificationsEnabled(enabled: boolean): void;
  showHome(): void;
  showLeadCapture(options?: { focus?: boolean }): void;
  configureLeadCapture(config: LeadCaptureConfig): void;
  showChat(): void;
  focusComposer(): void;
  setTypingParticipants(
    participants: Array<{
      id: string;
      name: string;
      avatarUrl?: string | null;
    }>,
  ): void;
  configureContactPrompt(config: ContactPromptConfig): void;
  showContactPrompt(): void;
  hideContactPrompt(): void;
  destroy(): void;
}

type View = 'home' | 'lead-capture' | 'chat';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const MORE_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
const NOTIFICATIONS_OFF_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13.73 21a2 2 0 0 1-3.46 0M18 8a6 6 0 0 0-9.33-5M6.26 6.26A6 6 0 0 0 6 8c0 7-3 7-3 9h14M3 3l18 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TEAM_MEMBER_ICON =
  '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="12" r="5" fill="currentColor"/><path d="M7.5 27c.6-5.2 3.5-8 8.5-8s7.9 2.8 8.5 8" fill="currentColor"/></svg>';

export function createChatWindow(handlers: {
  onClose: () => void;
  onSend: (submission: ComposerSubmission) => void;
  onUpload: (file: File) => Promise<MessageAttachment>;
  onStarter: (text: string) => void;
  onContinue: () => void;
  onStart: () => void;
  onLeadSubmit: (data: LeadCaptureData) => void;
  onComposerInput: (value: string) => void;
  onContactPromptSubmit: (data: ContactPromptData) => void;
  onContactPromptDismiss: () => void;
  onNotificationsChange: (enabled: boolean) => void;
}): ChatWindowHandle {
  const panel = document.createElement('div');
  panel.className = 'kw-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat');

  const header = document.createElement('div');
  header.className = 'kw-header';

  const headerMain = document.createElement('div');
  headerMain.className = 'kw-header-main';

  const headerBrand = createBrandMark('kw-header-brand');

  const headerText = document.createElement('div');
  headerText.className = 'kw-header-text';

  const title = document.createElement('div');
  title.className = 'kw-header-title';
  title.textContent = 'Chat';

  const statusRow = document.createElement('div');
  statusRow.className = 'kw-status-row';

  const statusDot = document.createElement('span');
  statusDot.className = 'kw-status-dot';
  statusDot.setAttribute('aria-hidden', 'true');

  const statusText = document.createElement('span');
  statusText.className = 'kw-status-text';
  statusText.textContent = 'Connecting…';
  statusDot.classList.add('kw-status-dot--offline');

  statusRow.append(statusDot, statusText);
  headerText.append(title, statusRow);

  const headerActions = document.createElement('div');
  headerActions.className = 'kw-header-actions';

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'kw-header-action kw-menu-trigger';
  menuButton.setAttribute('aria-label', 'Chat options');
  menuButton.setAttribute('aria-haspopup', 'menu');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.innerHTML = MORE_ICON;

  const headerMenu = document.createElement('div');
  headerMenu.className = 'kw-header-menu';
  headerMenu.setAttribute('role', 'menu');
  headerMenu.hidden = true;

  const notificationsButton = document.createElement('button');
  notificationsButton.type = 'button';
  notificationsButton.className = 'kw-header-menu-item';
  notificationsButton.setAttribute('role', 'menuitem');
  notificationsButton.innerHTML = `${NOTIFICATIONS_OFF_ICON}<span>Turn off notifications</span>`;
  headerMenu.append(notificationsButton);

  let notificationsEnabled = true;
  let menuOpen = false;

  function setMenuOpen(open: boolean): void {
    menuOpen = open;
    headerMenu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
  }

  function updateNotificationsLabel(): void {
    const label = notificationsEnabled
      ? 'Turn off notifications'
      : 'Turn on notifications';
    const text = notificationsButton.querySelector('span');
    if (text) text.textContent = label;
  }

  menuButton.addEventListener('click', () => setMenuOpen(!menuOpen));
  notificationsButton.addEventListener('click', () => {
    notificationsEnabled = !notificationsEnabled;
    updateNotificationsLabel();
    handlers.onNotificationsChange(notificationsEnabled);
    setMenuOpen(false);
    menuButton.focus();
  });

  const handleOutsidePointer = (event: PointerEvent) => {
    if (!menuOpen || event.composedPath().includes(headerMenu)) return;
    if (event.composedPath().includes(menuButton)) return;
    setMenuOpen(false);
  };
  document.addEventListener('pointerdown', handleOutsidePointer);

  const presenceAvatar = document.createElement('div');
  presenceAvatar.className = 'kw-presence-avatar';
  presenceAvatar.textContent = 'K';

  const supportPresence = document.createElement('div');
  supportPresence.className = 'kw-support-presence';
  supportPresence.setAttribute('aria-label', 'Our support team');

  const companionAvatars = Array.from({ length: 3 }, (_, index) => {
    const avatar = document.createElement('span');
    avatar.className = `kw-team-avatar kw-team-avatar--${index + 1}`;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = TEAM_MEMBER_ICON;
    return avatar;
  });

  const presenceCount = document.createElement('span');
  presenceCount.className = 'kw-presence-count';
  presenceCount.textContent = '+2';
  presenceCount.setAttribute('aria-hidden', 'true');
  supportPresence.append(presenceAvatar, ...companionAvatars, presenceCount);

  headerActions.append(menuButton);
  headerMain.append(headerBrand, headerText, headerActions);
  header.append(headerMain, supportPresence);

  const home = createHomeView({
    onStart: handlers.onStart,
    onContinue: () => {
      setView('chat');
      handlers.onContinue();
    },
    onStarter: handlers.onStarter,
  });

  const leadCapture = createLeadCaptureForm({
    onBack: () => setView('home'),
    onSubmit: (data) => {
      setView('chat');
      handlers.onLeadSubmit(data);
    },
  });

  const chatView = document.createElement('div');
  chatView.className = 'kw-chat-view';

  const list = document.createElement('div');
  list.className = 'kw-list';
  list.setAttribute('role', 'log');
  list.setAttribute('aria-live', 'polite');

  const typingIndicator = createTypingIndicator();
  const composer = createComposer({
    onSend: handlers.onSend,
    onInput: handlers.onComposerInput,
    onUpload: handlers.onUpload,
  });
  const contactPrompt = createContactPrompt({
    onSubmit: handlers.onContactPromptSubmit,
    onDismiss: handlers.onContactPromptDismiss,
  });

  const chatFooter = createPoweredBy();

  chatView.append(
    list,
    contactPrompt.el,
    typingIndicator.el,
    composer.el,
    chatFooter,
  );

  const body = document.createElement('div');
  body.className = 'kw-body';
  body.append(home.el, leadCapture.el, chatView);

  panel.append(header, headerMenu, body);

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (menuOpen) {
        setMenuOpen(false);
        menuButton.focus();
        return;
      }
      handlers.onClose();
      return;
    }
    if (event.key === 'Tab') trapFocus(event, panel);
  });

  function setView(
    view: View,
    options: { focusLeadCapture?: boolean } = {},
  ): void {
    panel.classList.toggle('kw-panel--home', view === 'home');
    panel.classList.toggle('kw-panel--lead-capture', view === 'lead-capture');
    panel.classList.toggle('kw-panel--chat', view === 'chat');
    home.el.hidden = view !== 'home';
    leadCapture.el.hidden = view !== 'lead-capture';
    chatView.hidden = view !== 'chat';
    if (view === 'lead-capture' && options.focusLeadCapture !== false) {
      leadCapture.focusFirstField();
    }
  }

  return {
    el: panel,
    listEl: list,
    setVisible(visible) {
      panel.hidden = !visible;
      if (!visible) setMenuOpen(false);
    },
    setLoading(loading) {
      if (loading) {
        renderLoadingSkeleton(list);
      } else {
        clearLoadingSkeleton(list);
      }
    },
    setConnectionStatus(connected) {
      statusDot.classList.toggle('kw-status-dot--offline', !connected);
      statusRow.title = connected ? 'Connected' : 'Reconnecting';
    },
    setName(name) {
      title.textContent = name;
    },
    setWelcomeMessage(text) {
      home.setWelcomeMessage(text);
    },
    setHomeHeading(text) {
      home.setHeading(text);
    },
    setStarters(items) {
      home.setStarters(items);
    },
    setSupportIdentity(name, subtitle, avatarUrl) {
      title.textContent = name || 'Chat with us';
      statusText.textContent = subtitle || 'Connecting…';
      setBrandMarkImage(headerBrand, avatarUrl);
      presenceAvatar.childNodes[0]?.remove();
      presenceAvatar.prepend(
        document.createTextNode(
          avatarUrl ? '' : name.trim().charAt(0).toUpperCase() || 'K',
        ),
      );
      presenceAvatar.style.backgroundImage = avatarUrl
        ? `url("${avatarUrl.replaceAll('"', '%22')}")`
        : '';
      presenceAvatar.classList.toggle(
        'kw-presence-avatar--image',
        Boolean(avatarUrl),
      );
    },
    setComposerPlaceholder(text) {
      composer.setPlaceholder(text);
    },
    setReply(reply) {
      composer.setReply(reply);
      if (reply) composer.focus();
    },
    setResumeAvailable(available) {
      home.setResumeAvailable(available);
    },
    setNotificationsEnabled(enabled) {
      notificationsEnabled = enabled;
      updateNotificationsLabel();
    },
    showHome() {
      setView('home');
    },
    showLeadCapture(options) {
      setView('lead-capture', { focusLeadCapture: options?.focus });
    },
    configureLeadCapture(config) {
      leadCapture.configure(config);
    },
    showChat() {
      setView('chat');
    },
    focusComposer() {
      composer.focus();
    },
    setTypingParticipants(participants) {
      typingIndicator.setParticipants(participants);
    },
    configureContactPrompt(config) {
      contactPrompt.configure(config);
    },
    showContactPrompt() {
      contactPrompt.show();
    },
    hideContactPrompt() {
      contactPrompt.hide();
    },
    destroy() {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      composer.destroy();
    },
  };
}

function trapFocus(event: KeyboardEvent, container: HTMLElement): void {
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((node) => node.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
