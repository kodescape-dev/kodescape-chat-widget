const WIDGET_PATH_SUFFIX = '/widget.js';

function isWidgetScript(element: HTMLScriptElement): boolean {
  if (!element.src) return false;

  try {
    return new URL(
      element.src,
      element.ownerDocument.baseURI,
    ).pathname.endsWith(WIDGET_PATH_SUFFIX);
  } catch {
    return false;
  }
}

export function findWidgetScript(
  documentRef: Document = document,
): HTMLScriptElement | null {
  const currentScript = documentRef.currentScript;
  if (
    currentScript instanceof HTMLScriptElement &&
    isWidgetScript(currentScript)
  ) {
    return currentScript;
  }

  const scripts = Array.from(documentRef.scripts);
  for (let index = scripts.length - 1; index >= 0; index -= 1) {
    const script = scripts[index];
    if (isWidgetScript(script) && script.dataset.siteId) return script;
  }

  return null;
}
