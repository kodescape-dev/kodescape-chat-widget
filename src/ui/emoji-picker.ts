import emojiData from 'emojibase-data/en/compact.json';
import emojiMessages from 'emojibase-data/en/messages.json';

type EmojiRecord = {
  emoji: string;
  label: string;
  tags?: string[];
  group?: number;
  order?: number;
};

type CompactEmojiRecord = Omit<EmojiRecord, 'emoji'> & {
  unicode: string;
};

type EmojiGroup = {
  key: string;
  message: string;
  order: number;
};

const EMOJIS = (emojiData as unknown as CompactEmojiRecord[])
  .filter((emoji) => typeof emoji.group === 'number' && emoji.group !== 2)
  .map((emoji) => ({ ...emoji, emoji: emoji.unicode }))
  .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

const GROUPS = (emojiMessages.groups as EmojiGroup[]).filter(
  (group) => group.key !== 'component',
);

export interface EmojiPickerHandle {
  el: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export function createEmojiPicker(
  onEmojiSelect: (emoji: string) => void,
): EmojiPickerHandle {
  const picker = document.createElement('div');
  picker.className = 'kw-emoji-picker';
  picker.hidden = true;
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', 'Choose an emoji');

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'kw-emoji-search';
  search.placeholder = 'Search emoji…';
  search.setAttribute('aria-label', 'Search emoji');

  const viewport = document.createElement('div');
  viewport.className = 'kw-emoji-viewport';
  let renderedQuery: string | null = null;

  const render = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (renderedQuery === normalizedQuery) return;
    renderedQuery = normalizedQuery;
    viewport.replaceChildren();

    const matches = searchEmojis(normalizedQuery);
    if (matches.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'kw-emoji-empty';
      empty.textContent = 'No emoji found.';
      viewport.appendChild(empty);
      return;
    }

    if (normalizedQuery) {
      viewport.appendChild(createEmojiGrid(matches, onEmojiSelect));
      return;
    }

    const byGroup = new Map<number, EmojiRecord[]>();
    for (const emoji of matches) {
      const group = emoji.group as number;
      const items = byGroup.get(group) ?? [];
      items.push(emoji);
      byGroup.set(group, items);
    }

    for (const group of GROUPS) {
      const items = byGroup.get(group.order);
      if (!items?.length) continue;
      const section = document.createElement('section');
      section.className = 'kw-emoji-category';
      const heading = document.createElement('div');
      heading.className = 'kw-emoji-category-heading';
      heading.textContent = capitalize(group.message);
      section.append(heading, createEmojiGrid(items, onEmojiSelect));
      viewport.appendChild(section);
    }
  };

  search.addEventListener('input', () => render(search.value));
  picker.append(search, viewport);

  return {
    el: picker,
    open() {
      picker.hidden = false;
      if (search.value) {
        search.value = '';
        renderedQuery = null;
      }
      render('');
      search.focus();
    },
    close() {
      picker.hidden = true;
    },
    isOpen() {
      return !picker.hidden;
    },
  };
}

function searchEmojis(query: string): EmojiRecord[] {
  if (!query) return EMOJIS;
  return EMOJIS.map((emoji) => {
    const labelMatch = emoji.label.toLowerCase().includes(query) ? 10 : 0;
    const tagMatches = (emoji.tags ?? []).filter((tag) =>
      tag.toLowerCase().includes(query),
    ).length;
    return { emoji, score: labelMatch + tagMatches };
  })
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.emoji.order ?? 0) - (right.emoji.order ?? 0),
    )
    .map((result) => result.emoji);
}

function createEmojiGrid(
  emojis: EmojiRecord[],
  onEmojiSelect: (emoji: string) => void,
): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'kw-emoji-grid';
  const fragment = document.createDocumentFragment();
  for (const emoji of emojis) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = emoji.emoji;
    button.title = emoji.label;
    button.setAttribute('aria-label', `Insert ${emoji.label}`);
    button.addEventListener('click', () => onEmojiSelect(emoji.emoji));
    fragment.appendChild(button);
  }
  grid.appendChild(fragment);
  return grid;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
