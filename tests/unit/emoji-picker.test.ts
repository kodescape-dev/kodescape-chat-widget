import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmojiPicker } from '../../src/ui/emoji-picker';

describe('createEmojiPicker()', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('opens on Frequently used and switches between category tabs', () => {
    const picker = createEmojiPicker(vi.fn());
    document.body.appendChild(picker.el);

    picker.open();

    expect(
      picker.el.querySelector('.kw-emoji-category-heading')?.textContent,
    ).toBe('Frequently used');

    const animalsTab = findTab(picker.el, 'Animals');
    animalsTab.click();

    expect(animalsTab.getAttribute('aria-selected')).toBe('true');
    expect(
      picker.el.querySelector('.kw-emoji-category-heading')?.textContent,
    ).toBe('Animals & nature');
    expect(
      picker.el.querySelectorAll('.kw-emoji-grid button').length,
    ).toBeGreaterThan(0);

    picker.el.remove();
  });

  it('promotes selected emoji into Frequently used', () => {
    const onSelect = vi.fn();
    const picker = createEmojiPicker(onSelect);
    document.body.appendChild(picker.el);
    picker.open();

    findTab(picker.el, 'Animals').click();
    const selected = picker.el.querySelector(
      '.kw-emoji-grid button',
    ) as HTMLButtonElement;
    const selectedEmoji = selected.textContent;
    selected.click();
    findTab(picker.el, 'Frequently').click();

    expect(onSelect).toHaveBeenCalledWith(selectedEmoji);
    expect(picker.el.querySelector('.kw-emoji-grid button')?.textContent).toBe(
      selectedEmoji,
    );

    picker.el.remove();
  });
});

function findTab(picker: HTMLElement, labelStart: string): HTMLButtonElement {
  const tab = Array.from(
    picker.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ).find((button) => button.getAttribute('aria-label')?.startsWith(labelStart));
  if (!tab) throw new Error(`Missing emoji tab: ${labelStart}`);
  return tab;
}
