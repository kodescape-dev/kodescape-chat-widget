const INLINE =
  /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>)\]]+)|\*\*([^*]+)\*\*/g;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

// Builds DOM nodes directly, never innerHTML, so text from the server cannot inject markup.
export function renderRichText(
  text: string,
  onLinkClick?: (url: string) => void,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let list: HTMLElement | null = null;
  let paragraph: HTMLElement | null = null;

  const closeBlocks = () => {
    list = null;
    paragraph = null;
  };

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) {
      closeBlocks();
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol';
      if (!list || list.tagName.toLowerCase() !== tag) {
        list = document.createElement(tag);
        list.className = 'kw-rich-list';
        fragment.appendChild(list);
      }
      paragraph = null;
      const item = document.createElement('li');
      appendInline(item, (bullet ?? numbered)![1], onLinkClick);
      list.appendChild(item);
      continue;
    }
    list = null;
    if (!paragraph) {
      paragraph = document.createElement('p');
      paragraph.className = 'kw-rich-p';
      fragment.appendChild(paragraph);
    } else {
      paragraph.appendChild(document.createElement('br'));
    }
    appendInline(paragraph, line, onLinkClick);
  }
  return fragment;
}

function appendInline(
  parent: HTMLElement,
  text: string,
  onLinkClick?: (url: string) => void,
): void {
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parent.appendChild(document.createTextNode(text.slice(cursor, index)));
    }
    const [whole, label, labelledUrl, bareUrl, bold] = match;
    if (bold !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = bold;
      parent.appendChild(strong);
    } else {
      const trailing = bareUrl ? (/[.,;:!?]+$/.exec(bareUrl)?.[0] ?? '') : '';
      const url =
        labelledUrl ?? bareUrl.slice(0, bareUrl.length - trailing.length);
      parent.appendChild(createLink(label ?? url, url, onLinkClick));
      if (trailing) parent.appendChild(document.createTextNode(trailing));
    }
    cursor = index + whole.length;
  }
  if (cursor < text.length) {
    parent.appendChild(document.createTextNode(text.slice(cursor)));
  }
}

export function createLink(
  label: string,
  url: string,
  onLinkClick?: (url: string) => void,
): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'kw-rich-link';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  if (onLinkClick) link.addEventListener('click', () => onLinkClick(url));
  return link;
}
