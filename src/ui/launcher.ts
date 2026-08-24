export interface LauncherHandle {
  el: HTMLButtonElement;
  setOpen(open: boolean): void;
  setUnread(unread: number | boolean): void;
  configure(config: {
    style: 'icon' | 'label_icon';
    label: string;
    icon: 'chat' | 'message';
  }): void;
  focus(): void;
}

const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="11.5" r="1" fill="currentColor"/><circle cx="12.5" cy="11.5" r="1" fill="currentColor"/><circle cx="16" cy="11.5" r="1" fill="currentColor"/></svg>';
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const MESSAGE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h16v11H8l-4 3v-14z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function createLauncher(onClick: () => void): LauncherHandle {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kw-launcher';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Open chat');
  let isOpen = false;
  let unreadCount = 0;
  let config: Parameters<LauncherHandle['configure']>[0] = {
    style: 'icon',
    label: 'Chat with us',
    icon: 'chat',
  };

  const badge = document.createElement('span');
  badge.className = 'kw-launcher-badge';
  badge.hidden = true;
  badge.setAttribute('aria-hidden', 'true');
  button.appendChild(badge);

  button.addEventListener('click', onClick);

  function render(): void {
    button.classList.toggle(
      'kw-launcher--label',
      !isOpen && config.style === 'label_icon',
    );
    button.innerHTML = isOpen
      ? CLOSE_ICON
      : `${config.style === 'label_icon' ? `<span class="kw-launcher-label">${escapeHtml(config.label)}</span><span class="kw-launcher-divider" aria-hidden="true"></span>` : ''}${config.icon === 'message' ? MESSAGE_ICON : CHAT_ICON}`;
    button.appendChild(badge);
  }

  function updateAriaLabel(): void {
    button.setAttribute(
      'aria-label',
      isOpen
        ? 'Close chat'
        : unreadCount > 0
          ? `Open chat, ${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`
          : 'Open chat',
    );
  }
  render();

  return {
    el: button,
    setOpen(open) {
      isOpen = open;
      button.setAttribute('aria-expanded', String(open));
      updateAriaLabel();
      render();
    },
    setUnread(unread) {
      unreadCount =
        typeof unread === 'number'
          ? Math.max(0, Math.floor(unread))
          : unread
            ? 1
            : 0;
      badge.hidden = unreadCount === 0;
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      updateAriaLabel();
    },
    configure(next) {
      config = next;
      render();
    },
    focus() {
      button.focus();
    },
  };
}

function escapeHtml(value: string): string {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}
