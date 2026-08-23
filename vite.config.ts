import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DEV_WIDGET_LOADER = `(() => {
  const scripts = Array.from(document.scripts);
  const script = document.currentScript || scripts.reverse().find((candidate) => {
    try {
      return new URL(candidate.src, document.baseURI).pathname.endsWith('/widget.js');
    } catch {
      return false;
    }
  });

  if (!script) {
    console.error('[Kodescape Chat Widget] Could not find the widget script element.');
    return;
  }

  const entryUrl = new URL('/src/mount.ts', script.src).href;
  import(entryUrl)
    .then(({ bootstrap }) => bootstrap(script))
    .catch((error) => console.error('[Kodescape Chat Widget] Failed to load.', error));
})();
`;

function serveWidgetEntry(): Plugin {
  return {
    name: 'serve-widget-entry',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?', 1)[0];
        if (pathname !== '/widget.js') return next();

        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Access-Control-Allow-Origin', '*');
        if (request.method === 'HEAD') return response.end();
        response.end(DEV_WIDGET_LOADER);
      });
    },
  };
}

export default defineConfig({
  plugins: [serveWidgetEntry()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/mount.ts'),
      name: 'KodescapeChatWidget',
      fileName: () => 'widget.js',
      formats: ['iife'],
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
