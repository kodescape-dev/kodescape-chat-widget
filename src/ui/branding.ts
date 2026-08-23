import kodescapeIconUrl from '../assets/kodescape-icon.svg';

export function createBrandMark(className: string): HTMLElement {
  const mark = document.createElement('span');
  mark.className = className;
  const image = document.createElement('img');
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  mark.appendChild(image);
  setBrandMarkImage(mark, null);
  return mark;
}

export function setBrandMarkImage(
  mark: HTMLElement,
  imageUrl: string | null,
): void {
  const image = mark.querySelector('img');
  if (!image) return;
  mark.classList.toggle('kw-brand-mark--custom', Boolean(imageUrl));
  image.onerror = imageUrl
    ? () => {
        image.onerror = null;
        image.src = kodescapeIconUrl;
        mark.classList.remove('kw-brand-mark--custom');
      }
    : null;
  image.src = imageUrl || kodescapeIconUrl;
}

export function createPoweredBy(): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'kw-powered';
  footer.append('Powered by ', createBrandMark('kw-powered-mark'), ' ');

  const name = document.createElement('span');
  name.textContent = 'Kodescape';
  footer.appendChild(name);
  return footer;
}
