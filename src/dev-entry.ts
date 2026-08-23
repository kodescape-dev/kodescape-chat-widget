import { mount } from './mount';

declare global {
  interface Window {
    __KW_SITE_ID_A__?: string;
    __KW_SITE_ID_B__?: string;
  }
}

const params = new URLSearchParams(window.location.search);

if (params.has('kodescapePreview')) {
  document.body.classList.add('preview');
  mount({ siteId: 'preview', preview: true });
} else {
  const siteIdA =
    window.__KW_SITE_ID_A__ ?? params.get('siteIdA') ?? 'dev-site-a';
  const siteIdB = window.__KW_SITE_ID_B__ ?? params.get('siteIdB') ?? '';

  mount({ siteId: siteIdA });
  if (siteIdB) console.info('siteIdB set but not auto-mounted.');
}
