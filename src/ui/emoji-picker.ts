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

type EmojiTab = {
  id: 'frequent' | number;
  label: string;
  icon: string;
};

const FREQUENT_STORAGE_KEY = 'kodescape_chat_frequent_emojis';
const DEFAULT_FREQUENT = ['👍', '😊', '😂', '❤️', '😍', '😭', '🙏', '🎉'];
const GROUP_ICONS: Record<string, string> = {
  'smileys-emotion': '😀',
  'people-body': '👋',
  'animals-nature': '🐻',
  'food-drink': '🍔',
  'travel-places': '🚗',
  activities: '⚽',
  objects: '💡',
  symbols: '♥',
  flags: '🚩',
};

const EMOJIS: EmojiRecord[] = (emojiData as unknown as CompactEmojiRecord[])
  .filter((emoji) => typeof emoji.group === 'number' && emoji.group !== 2)
  .map(({ unicode, ...emoji }) => ({ ...emoji, emoji: unicode }))
  .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

const GROUPS = (emojiMessages.groups as EmojiGroup[]).filter(
  (group) => group.key !== 'component',
);

const TABS: EmojiTab[] = [
  { id: 'frequent', label: 'Frequently used', icon: '🕘' },
  ...GROUPS.map((group) => ({
    id: group.order,
    label: capitalize(group.message),
    icon: GROUP_ICONS[group.key] ?? '•',
  })),
];

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

  const tabs = document.createElement('div');
  tabs.className = 'kw-emoji-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Emoji categories');

  const viewport = document.createElement('div');
  viewport.className = 'kw-emoji-viewport';
  let activeTab: EmojiTab['id'] = 'frequent';
  let renderedQuery: string | null = null;

  const selectEmoji = (emoji: string) => {
    recordFrequentEmoji(emoji);
    onEmojiSelect(emoji);
  };

  const tabButtons = TABS.map((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kw-emoji-tab';
    button.textContent = tab.icon;
    button.title = tab.label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-label', tab.label);
    button.addEventListener('click', () => {
      activeTab = tab.id;
      renderedQuery = null;
      render(search.value);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const currentIndex = TABS.findIndex((item) => item.id === activeTab);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + TABS.length) % TABS.length;
      tabButtons[nextIndex]?.button.click();
      tabButtons[nextIndex]?.button.focus();
    });
    tabs.appendChild(button);
    return { tab, button };
  });

  const render = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    const renderKey = `${activeTab}:${normalizedQuery}:${readFrequentEmojis().join(',')}`;
    if (renderedQuery === renderKey) return;
    renderedQuery = renderKey;
    viewport.replaceChildren();

    for (const item of tabButtons) {
      const selected = item.tab.id === activeTab;
      item.button.classList.toggle('kw-emoji-tab--active', selected);
      item.button.setAttribute('aria-selected', String(selected));
      item.button.tabIndex = selected ? 0 : -1;
    }

    const matches = searchEmojis(normalizedQuery);
    if (matches.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'kw-emoji-empty';
      empty.textContent = 'No emoji found.';
      viewport.appendChild(empty);
      return;
    }

    if (normalizedQuery) {
      viewport.append(
        createCategoryHeading('Search results'),
        createEmojiGrid(matches, selectEmoji),
      );
      return;
    }

    const activeTabConfig = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];
    const items =
      activeTab === 'frequent'
        ? frequentEmojiRecords()
        : matches.filter((emoji) => emoji.group === activeTab);
    viewport.append(
      createCategoryHeading(activeTabConfig.label),
      createEmojiGrid(items, selectEmoji),
    );
  };

  search.addEventListener('input', () => render(search.value));
  picker.append(tabs, search, viewport);

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

function frequentEmojiRecords(): EmojiRecord[] {
  const byUnicode = new Map(EMOJIS.map((emoji) => [emoji.emoji, emoji]));
  return readFrequentEmojis()
    .map((emoji) => byUnicode.get(emoji))
    .filter((emoji): emoji is EmojiRecord => Boolean(emoji));
}

function readFrequentEmojis(): string[] {
  try {
    const value = localStorage.getItem(FREQUENT_STORAGE_KEY);
    if (!value) return DEFAULT_FREQUENT;
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_FREQUENT;
    return parsed.filter((emoji): emoji is string => typeof emoji === 'string');
  } catch {
    return DEFAULT_FREQUENT;
  }
}

function recordFrequentEmoji(emoji: string): void {
  try {
    const next = [
      emoji,
      ...readFrequentEmojis().filter((item) => item !== emoji),
    ].slice(0, 16);
    localStorage.setItem(FREQUENT_STORAGE_KEY, JSON.stringify(next));
  } catch {}
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

function createCategoryHeading(label: string): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'kw-emoji-category-heading';
  heading.textContent = label;
  return heading;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
