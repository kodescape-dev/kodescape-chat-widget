import kiroFaceUrl from '../assets/kiro-face.webp';
import type { LocalMessage, LocalMessageStatus } from '../core/store';
import { createBrandMark } from './branding';
import { createEmojiPicker } from './emoji-picker';
import { createLink, renderRichText } from './rich-text';

export interface AiRenderOptions {
  name: string;
  avatarUrl: string | null;
  streamText: string;
  // The finished AI message is held back while its text is still being typed out.
  hiddenMessageId?: string | null;
  onQuickReply: (text: string) => void;
  onLinkClick: (url: string) => void;
  footer: HTMLElement | null;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮'] as const;
const FORMATTED_TEXT = /\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*\n]+\*\*/;

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

// Swaps only the text of the answer being typed out, so the rest of the list is not rebuilt on every step.
export function updateStreamingText(
  container: HTMLElement,
  text: string,
): boolean {
  const content = container.querySelector('.kw-bubble-row--streaming .kw-rich');
  if (!content) return false;
  const wasScrolledToBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight <
    SCROLL_BOTTOM_THRESHOLD_PX;
  content.textContent = '';
  content.appendChild(renderRichText(text));
  if (wasScrolledToBottom) container.scrollTop = container.scrollHeight;
  return true;
}

export function renderMessages(
  container: HTMLElement,
  allMessages: readonly LocalMessage[],
  onRetry: (clientMessageId: string) => void,
  onReact: (messageId: string, emoji: string) => void,
  onReply: (message: LocalMessage) => void,
  support?: { name: string; avatarUrl: string | null },
  ai?: AiRenderOptions,
): void {
  const wasScrolledToBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight <
    SCROLL_BOTTOM_THRESHOLD_PX;

  const messages = ai?.hiddenMessageId
    ? allMessages.filter((message) => message.id !== ai.hiddenMessageId)
    : allMessages;
  container.removeAttribute('aria-busy');
  container.textContent = '';
  let previous: LocalMessage | null = null;
  messages.forEach((message, index) => {
    if (!previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)) {
      container.appendChild(renderDate(message.createdAt));
    }
    if (previous?.senderType === 'ai' && message.senderType === 'human') {
      container.appendChild(
        renderNotice(
          `${message.senderName || support?.name || 'A team member'} joined the chat`,
        ),
      );
    }
    const grouped =
      previous?.direction === message.direction &&
      previous?.senderType === message.senderType &&
      minuteKey(previous.createdAt) === minuteKey(message.createdAt);
    const next = messages[index + 1];
    const closesGroup =
      !next ||
      next.senderType !== message.senderType ||
      minuteKey(next.createdAt) !== minuteKey(message.createdAt);
    container.appendChild(
      renderBubble(message, onRetry, onReact, onReply, grouped, support, {
        ai,
        closesGroup,
        isLast: index === messages.length - 1,
      }),
    );
    previous = message;
  });

  const last = messages[messages.length - 1];
  if (last?.senderType === 'ai' && last.ai?.kind === 'handoff' && !ai?.footer) {
    container.appendChild(renderNotice('Waiting for a team member'));
  }
  if (ai?.streamText) container.appendChild(renderStreaming(ai));
  if (ai?.footer) container.appendChild(ai.footer);

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
  extras?: { ai?: AiRenderOptions; closesGroup: boolean; isLast: boolean },
): HTMLElement {
  const isAi = message.senderType === 'ai';
  const ai = extras?.ai;
  const row = document.createElement('div');
  row.className = `kw-bubble-row kw-bubble-row--${message.direction}`;
  row.classList.toggle('kw-bubble-row--grouped', grouped);
  row.classList.toggle('kw-bubble-row--ai', isAi);

  const meta = document.createElement('div');
  meta.className = 'kw-bubble-meta';
  const sender = document.createElement('strong');
  sender.className = 'kw-bubble-sender';
  sender.textContent =
    message.direction === 'inbound'
      ? 'You'
      : message.senderName || (isAi ? ai?.name : support?.name) || 'Support';
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
    // A team reply that carries links or bold (for example a Copilot suggestion) is shown formatted too.
    const formatted =
      message.senderType === 'human' && FORMATTED_TEXT.test(message.content);
    if (isAi || formatted) {
      const content = document.createElement('div');
      content.className = 'kw-rich';
      content.appendChild(renderRichText(message.content, ai?.onLinkClick));
      bubble.appendChild(content);
    } else {
      const content = document.createElement('span');
      content.textContent = message.content;
      bubble.appendChild(content);
    }
  }
  const readMore = isAi ? (message.ai?.links ?? []) : [];
  if (readMore.length > 0) {
    const links = document.createElement('div');
    links.className = 'kw-ai-links';
    const label = document.createElement('span');
    label.textContent = 'Read more:';
    links.appendChild(label);
    for (const item of readMore) {
      links.appendChild(createLink(item.title, item.url, ai?.onLinkClick));
    }
    bubble.appendChild(links);
  }
  const line = document.createElement('div');
  line.className = 'kw-bubble-line';
  if (message.direction === 'outbound' && !grouped) {
    line.appendChild(
      isAi
        ? createAiAvatar(ai?.avatarUrl ?? null)
        : createSupportAvatar(support?.avatarUrl ?? null),
    );
  }
  line.appendChild(bubble);
  row.append(line, meta);
  if (isAi && extras?.closesGroup) {
    const caption = document.createElement('div');
    caption.className = 'kw-ai-caption';
    caption.textContent = `${message.senderName || ai?.name || 'Assistant'} · AI assistant`;
    row.appendChild(caption);
  }
  const quickReplies =
    isAi && extras?.isLast ? (message.ai?.quickReplies ?? []) : [];
  if (quickReplies.length > 0 && ai) {
    const chips = document.createElement('div');
    chips.className = 'kw-quick-replies';
    for (const text of quickReplies) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'kw-quick-reply';
      chip.textContent = text;
      chip.addEventListener('click', () => ai.onQuickReply(text));
      chips.appendChild(chip);
    }
    row.appendChild(chips);
  }

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

function createSupportAvatar(avatarUrl: string | null): HTMLElement {
  if (!avatarUrl) return createBrandMark('kw-message-avatar');
  const avatar = document.createElement('span');
  avatar.className = 'kw-message-avatar kw-message-avatar--image';
  avatar.style.backgroundImage = `url("${avatarUrl.replaceAll('"', '%22')}")`;
  return avatar;
}

function createAiAvatar(avatarUrl: string | null): HTMLElement {
  const avatar = document.createElement('span');
  avatar.className = 'kw-message-avatar kw-message-avatar--ai';
  if (avatarUrl) {
    avatar.classList.add('kw-message-avatar--image');
    avatar.style.backgroundImage = `url("${avatarUrl.replaceAll('"', '%22')}")`;
  } else {
    avatar.classList.add('kw-message-avatar--kiro');
    avatar.style.backgroundImage = `url("${kiroFaceUrl}")`;
  }
  return avatar;
}

function renderNotice(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'kw-system-note';
  el.setAttribute('role', 'status');
  el.textContent = text;
  return el;
}

function renderStreaming(ai: AiRenderOptions): HTMLElement {
  const row = document.createElement('div');
  row.className =
    'kw-bubble-row kw-bubble-row--outbound kw-bubble-row--ai kw-bubble-row--streaming';
  row.setAttribute('aria-live', 'polite');
  const line = document.createElement('div');
  line.className = 'kw-bubble-line';
  const bubble = document.createElement('div');
  bubble.className = 'kw-bubble';
  const content = document.createElement('div');
  content.className = 'kw-rich';
  content.appendChild(renderRichText(ai.streamText));
  bubble.appendChild(content);
  line.append(createAiAvatar(ai.avatarUrl), bubble);
  row.appendChild(line);
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
