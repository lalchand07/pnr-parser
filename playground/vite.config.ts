import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Production builds get a strict Content-Security-Policy: no network access
 * at all (`connect-src 'none'`), so pasted PNR text cannot leave the browser.
 * Not applied in dev because Vite's HMR needs a websocket.
 */
function contentSecurityPolicy(): Plugin {
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
  return {
    name: 'pnr-playground-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      ),
  };
}

export default defineConfig({
  root,
  base: './',
  plugins: [contentSecurityPolicy()],
  resolve: {
    alias: {
      'pnr-parser/enrich': fileURLToPath(new URL('../src/enrich/index.ts', import.meta.url)),
      'pnr-parser': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: { fs: { allow: ['..'] } },
});
