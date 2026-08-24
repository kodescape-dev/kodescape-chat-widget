import type { LocalMessage, LocalMessageStatus } from '../core/store';
import { createBrandMark } from './branding';
import { createEmojiPicker } from './emoji-picker';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮'] as const;

const SCROLL_BOTTOM_THRESHOLD_PX = 16;

const SINGLE_CHECK_ICON =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DOUBLE_CHECK_ICON =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 8.5l3 3 7-7M6 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DOWNLOAD_ICON =
  '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v9m0 0 3.25-3.25M10 12 6.75 8.75M4 15.5h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const STATUS_LABELS: Partial<Record<LocalMessageStatus, string>> = {
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

const SKELETON_ROWS: ReadonlyArray<{
  direction: 'inbound' | 'outbound';
  bubbleWidthPx: number;
  showAvatar?: boolean;
}> = [
  { direction: 'outbound', bubbleWidthPx: 184, showAvatar: true },
  { direction: 'outbound', bubbleWidthPx: 126 },
  { direction: 'inbound', bubbleWidthPx: 156 },
  { direction: 'outbound', bubbleWidthPx: 210, showAvatar: true },
];

export function renderLoadingSkeleton(container: HTMLElement): void {
  container.textContent = '';
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', 'Loading conversation');

  const date = document.createElement('div');
  date.className = 'kw-skeleton-date';
  date.setAttribute('aria-hidden', 'true');
  container.appendChild(date);

  for (const [index, row] of SKELETON_ROWS.entries()) {
    const wrap = document.createElement('div');
    wrap.className = `kw-skeleton-row kw-skeleton-row--${row.direction}`;
    if (row.direction === 'outbound' && !row.showAvatar) {
      wrap.classList.add('kw-skeleton-row--grouped');
    }
    wrap.style.setProperty('--kw-skeleton-index', String(index));
    wrap.setAttribute('aria-hidden', 'true');

    const meta = document.createElement('div');
    meta.className = 'kw-skeleton-meta';
    const name = document.createElement('span');
    name.className = 'kw-skeleton-name';
    const time = document.createElement('span');
    time.className = 'kw-skeleton-time';
    meta.append(name, time);

    const line = document.createElement('div');
    line.className = 'kw-skeleton-line';
    if (row.showAvatar) {
      const avatar = document.createElement('span');
      avatar.className = 'kw-skeleton-avatar';
      line.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'kw-skeleton-bubble';
    bubble.style.width = `${row.bubbleWidthPx}px`;
    line.appendChild(bubble);
    wrap.append(meta, line);

    container.appendChild(wrap);
  }
}

export function clearLoadingSkeleton(container: HTMLElement): void {
  if (container.getAttribute('aria-busy') !== 'true') return;
  container.textContent = '';
  container.removeAttribute('aria-busy');
  container.removeAttribute('aria-label');
}

export function renderMessages(
  container: HTMLElement,
  messages: readonly LocalMessage[],
  onRetry: (clientMessageId: string) => void,
  onReact: (messageId: string, emoji: string) => void,
  onReply: (message: LocalMessage) => void,
  support?: { name: string; avatarUrl: string | null },
): void {
  const wasScrolledToBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight <
    SCROLL_BOTTOM_THRESHOLD_PX;

  container.removeAttribute('aria-busy');
  container.textContent = '';
  let previous: LocalMessage | null = null;
  for (const message of messages) {
    if (!previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)) {
      container.appendChild(renderDate(message.createdAt));
    }
    const grouped =
      previous?.direction === message.direction &&
      minuteKey(previous.createdAt) === minuteKey(message.createdAt);
    container.appendChild(
      renderBubble(message, onRetry, onReact, onReply, grouped, support),
    );
    previous = message;
  }

  if (wasScrolledToBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

function renderBubble(
  message: LocalMessage,
  onRetry: (clientMessageId: string) => void,
  onReact: (messageId: string, emoji: string) => void,
  onReply: (message: LocalMessage) => void,
  grouped: boolean,
  support?: { name: string; avatarUrl: string | null },
): HTMLElement {
  const row = document.createElement('div');
  row.className = `kw-bubble-row kw-bubble-row--${message.direction}`;
  row.classList.toggle('kw-bubble-row--grouped', grouped);

  const meta = document.createElement('div');
  meta.className = 'kw-bubble-meta';
  const sender = document.createElement('strong');
  sender.className = 'kw-bubble-sender';
  sender.textContent =
    message.direction === 'inbound'
      ? 'You'
      : message.senderName || support?.name || 'Support';
  const time = document.createElement('time');
  time.className = 'kw-bubble-time';
  time.dateTime = message.createdAt;
  time.textContent = formatTime(message.createdAt);
  meta.append(sender, time);
  meta.hidden = true;
  meta.id = `kw-message-details-${message.clientMessageId}`;

  const bubble = document.createElement('div');
  bubble.className = 'kw-bubble';
  if (message.replyTo) {
    const reply = document.createElement('div');
    reply.className = 'kw-message-reply-preview';
    const author = document.createElement('strong');
    author.textContent =
      message.replyTo.senderName ||
      (message.replyTo.senderType === 'visitor' ? 'Visitor' : 'Support');
    const body = document.createElement('span');
    body.textContent = message.replyTo.content || 'Message';
    reply.append(author, body);
    bubble.appendChild(reply);
  }
  for (const attachment of message.attachments ?? []) {
    if (attachment.kind === 'image') {
      const wrap = document.createElement('span');
      wrap.className = 'kw-message-image-wrap';
      const link = document.createElement('a');
      link.href = attachment.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.className = 'kw-message-image';
      link.setAttribute('aria-label', `Open ${attachment.name}`);
      const image = document.createElement('img');
      image.src = attachment.url;
      image.alt = attachment.name;
      link.appendChild(image);
      const download = document.createElement('a');
      download.href = attachment.url;
      download.download = attachment.name;
      download.className = 'kw-message-image-download';
      download.setAttribute('aria-label', `Download ${attachment.name}`);
      download.title = 'Download';
      download.innerHTML = DOWNLOAD_ICON;
      wrap.append(link, download);
      bubble.appendChild(wrap);
    } else {
      const link = document.createElement('a');
      link.href = attachment.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.className = 'kw-message-file';
      const name = document.createElement('strong');
      name.textContent = attachment.name;
      const size = document.createElement('small');
      size.textContent = formatSize(attachment.size);
      link.append(name, size);
      bubble.appendChild(link);
    }
  }
  if (message.content) {
    const content = document.createElement('span');
    content.textContent = message.content;
    bubble.appendChild(content);
  }
  const line = document.createElement('div');
  line.className = 'kw-bubble-line';
  if (message.direction === 'outbound' && !grouped) {
    const avatar = support?.avatarUrl
      ? document.createElement('span')
      : createBrandMark('kw-message-avatar');
    if (support?.avatarUrl) avatar.className = 'kw-message-avatar';
    if (support?.avatarUrl) {
      avatar.style.backgroundImage = `url("${support.avatarUrl.replaceAll('"', '%22')}")`;
      avatar.classList.add('kw-message-avatar--image');
    }
    line.appendChild(avatar);
  }
  line.appendChild(bubble);
  row.append(line, meta);

  const toggleDetails = () => {
    meta.hidden = !meta.hidden;
    bubble.setAttribute('aria-expanded', String(!meta.hidden));
    bubble.setAttribute(
      'aria-label',
      `Message. ${meta.hidden ? 'Show' : 'Hide'} sender and time`,
    );
  };
  bubble.tabIndex = 0;
  bubble.setAttribute('aria-expanded', 'false');
  bubble.setAttribute('aria-controls', meta.id);
  bubble.setAttribute('aria-label', 'Message. Show sender and time');
  bubble.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('a, button')) return;
    toggleDetails();
  });
  bubble.addEventListener('keydown', (event) => {
    if (event.target !== bubble || (event.key !== 'Enter' && event.key !== ' '))
      return;
    event.preventDefault();
    toggleDetails();
  });

  if (message.id) {
    const actions = document.createElement('div');
    actions.className = 'kw-message-actions';
    for (const emoji of QUICK_REACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = emoji;
      button.setAttribute('aria-label', `React with ${emoji}`);
      button.addEventListener('click', () => onReact(message.id!, emoji));
      actions.appendChild(button);
    }
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'kw-message-action-icon';
    more.textContent = '☺';
    more.setAttribute('aria-label', 'More reactions');
    const picker = createEmojiPicker((emoji) => {
      onReact(message.id!, emoji);
      picker.close();
      more.setAttribute('aria-expanded', 'false');
    });
    picker.el.classList.add('kw-reaction-picker');
    more.addEventListener('click', () => {
      const open = !picker.isOpen();
      if (open) picker.open();
      else picker.close();
      more.setAttribute('aria-expanded', String(open));
    });
    const reply = document.createElement('button');
    reply.type = 'button';
    reply.className = 'kw-message-action-icon';
    reply.textContent = '↩';
    reply.setAttribute('aria-label', 'Reply to message');
    reply.addEventListener('click', () => onReply(message));
    actions.append(more, reply, picker.el);
    bubble.appendChild(actions);
  }

  const groupedReactions = new Map<string, number>();
  for (const reaction of message.reactions ?? []) {
    groupedReactions.set(
      reaction.emoji,
      (groupedReactions.get(reaction.emoji) ?? 0) + 1,
    );
  }
  if (groupedReactions.size > 0 && message.id) {
    const reactions = document.createElement('div');
    reactions.className = 'kw-message-reactions';
    for (const [emoji, count] of groupedReactions) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = `${emoji} ${count}`;
      chip.setAttribute('aria-label', `${emoji} ${count} reactions`);
      chip.addEventListener('click', () => onReact(message.id!, emoji));
      reactions.appendChild(chip);
    }
    row.appendChild(reactions);
  }

  if (message.status === 'sending') {
    const status = document.createElement('span');
    status.className = 'kw-bubble-status';
    status.textContent = 'Sending…';
    row.appendChild(status);
  } else if (message.status === 'failed') {
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'kw-bubble-status kw-bubble-status--failed';
    retryButton.textContent = 'Failed — retry';
    retryButton.addEventListener('click', () =>
      onRetry(message.clientMessageId),
    );
    row.appendChild(retryButton);
  } else if (
    message.direction === 'inbound' &&
    (message.status === 'sent' ||
      message.status === 'delivered' ||
      message.status === 'read')
  ) {
    const status = document.createElement('span');
    status.className = `kw-bubble-status kw-bubble-status--${message.status}`;
    status.setAttribute('aria-label', STATUS_LABELS[message.status] ?? '');
    status.innerHTML =
      message.status === 'sent' ? SINGLE_CHECK_ICON : DOUBLE_CHECK_ICON;
    meta.appendChild(status);
  }

  return row;
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function minuteKey(iso: string): string {
  const date = new Date(iso);
  return `${dayKey(iso)}-${date.getHours()}-${date.getMinutes()}`;
}

function renderDate(iso: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'kw-date-separator';
  const date = new Date(iso);
  const now = new Date();
  const today = dayKey(now.toISOString());
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const key = dayKey(iso);
  el.textContent =
    key === today
      ? 'Today'
      : key === dayKey(yesterdayDate.toISOString())
        ? 'Yesterday'
        : date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            ...(date.getFullYear() !== now.getFullYear()
              ? { year: 'numeric' }
              : {}),
          });
  return el;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
