import { afterEach, describe, expect, it } from 'vitest';
import { findWidgetScript } from '../../src/script-element';

describe('findWidgetScript()', () => {
  afterEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it('finds widget.js by URL when currentScript is unavailable', () => {
    const unrelated = document.createElement('script');
    unrelated.src = 'http://localhost:3000/app.js';
    unrelated.dataset.siteId = 'wrong-site';

    const widget = document.createElement('script');
    widget.src = 'http://localhost:5173/widget.js?cache=1';
    widget.dataset.siteId = 'real-site';
    document.body.append(unrelated, widget);

    expect(findWidgetScript()).toBe(widget);
    expect(findWidgetScript()?.dataset.siteId).toBe('real-site');
  });

  it('ignores scripts that have data-site-id but did not load widget.js', () => {
    const script = document.createElement('script');
    script.src = 'http://localhost:3000/app.js';
    script.dataset.siteId = 'not-the-widget';
    document.body.appendChild(script);

    expect(findWidgetScript()).toBeNull();
  });
});
