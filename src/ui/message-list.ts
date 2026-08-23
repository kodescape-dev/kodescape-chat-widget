import type { LocalMessage, LocalMessageStatus } from '../core/store';
import { createBrandMark } from './branding';

const SCROLL_BOTTOM_THRESHOLD_PX = 16;

const SINGLE_CHECK_ICON =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DOUBLE_CHECK_ICON =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 8.5l3 3 7-7M6 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const STATUS_LABELS: Partial<Record<LocalMessageStatus, string>> = {
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

const SKELETON_ROWS: ReadonlyArray<{
  direction: 'inbound' | 'outbound';
  widthPx: number;
}> = [
  { direction: 'outbound', widthPx: 190 },
  { direction: 'outbound', widthPx: 120 },
  { direction: 'inbound', widthPx: 140 },
  { direction: 'outbound', widthPx: 210 },
];

export function renderLoadingSkeleton(container: HTMLElement): void {
  container.textContent = '';
  container.setAttribute('aria-busy', 'true');
  for (const row of SKELETON_ROWS) {
    const wrap = document.createElement('div');
    wrap.className = `kw-bubble-row kw-bubble-row--${row.direction}`;
    wrap.setAttribute('aria-hidden', 'true');

    const bubble = document.createElement('div');
    bubble.className = 'kw-skeleton-bubble';
    bubble.style.width = `${row.widthPx}px`;
    wrap.appendChild(bubble);

    container.appendChild(wrap);
  }
}

export function clearLoadingSkeleton(container: HTMLElement): void {
  if (container.getAttribute('aria-busy') !== 'true') return;
  container.textContent = '';
  container.removeAttribute('aria-busy');
}

export function renderMessages(
  container: HTMLElement,
  messages: readonly LocalMessage[],
  onRetry: (clientMessageId: string) => void,
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
    const grouped = previous?.direction === message.direction;
    container.appendChild(renderBubble(message, onRetry, grouped, support));
    previous = message;
  }

  if (wasScrolledToBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

function renderBubble(
  message: LocalMessage,
  onRetry: (clientMessageId: string) => void,
  grouped: boolean,
  support?: { name: string; avatarUrl: string | null },
): HTMLElement {
  const row = document.createElement('div');
  row.className = `kw-bubble-row kw-bubble-row--${message.direction}`;
  row.classList.toggle('kw-bubble-row--grouped', grouped);

  const bubble = document.createElement('div');
  bubble.className = 'kw-bubble';
  if (message.content) {
    const content = document.createElement('span');
    content.textContent = message.content;
    bubble.appendChild(content);
  }
  for (const attachment of message.attachments ?? []) {
    if (attachment.kind === 'image') {
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
      bubble.appendChild(link);
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
  row.appendChild(line);

  const time = document.createElement('time');
  time.className = 'kw-bubble-time';
  time.dateTime = message.createdAt;
  time.textContent = formatTime(message.createdAt);
  row.appendChild(time);

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
    row.appendChild(status);
  }

  return row;
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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
