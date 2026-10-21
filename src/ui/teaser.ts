export interface TeaserHandle {
  el: HTMLElement;
  show(senderName: string | null, text: string): void;
  hide(): void;
}

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/**
 * A small preview bubble above the launcher, shown when the team writes to a
 * visitor who has not opened the chat yet.
 */
export function createTeaser(onOpen: () => void): TeaserHandle {
  const el = document.createElement('div');
  el.className = 'kw-teaser';
  el.hidden = true;
  el.setAttribute('role', 'status');

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'kw-teaser-open';
  const name = document.createElement('span');
  name.className = 'kw-teaser-name';
  const text = document.createElement('span');
  text.className = 'kw-teaser-text';
  open.append(name, text);
  open.addEventListener('click', () => {
    hide();
    onOpen();
  });

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'kw-teaser-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss message preview');
  dismiss.innerHTML = CLOSE_ICON;
  dismiss.addEventListener('click', () => hide());

  el.append(open, dismiss);

  function hide(): void {
    el.hidden = true;
  }

  return {
    el,
    show(senderName, message) {
      const preview = message.trim();
      if (!preview) return;
      name.textContent = senderName?.trim() || 'Support';
      text.textContent = preview;
      el.hidden = false;
    },
    hide,
  };
}
