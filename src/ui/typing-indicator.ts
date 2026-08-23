export interface TypingIndicatorHandle {
  el: HTMLElement;
  setVisible(visible: boolean, label?: string): void;
}

export function createTypingIndicator(): TypingIndicatorHandle {
  const el = document.createElement('div');
  el.className = 'kw-typing';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('role', 'status');

  const dots = document.createElement('span');
  dots.className = 'kw-typing-dots';
  for (let i = 0; i < 3; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'kw-typing-dot';
    dots.appendChild(dot);
  }

  const label = document.createElement('span');
  label.className = 'kw-typing-label';
  label.hidden = true;

  el.append(dots, label);

  return {
    el,
    setVisible(visible, labelText) {
      el.hidden = !visible;
      el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (visible && labelText) {
        label.textContent = labelText;
        label.hidden = false;
      } else {
        label.textContent = '';
        label.hidden = true;
      }
    },
  };
}
