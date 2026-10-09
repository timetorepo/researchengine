import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { createRequire } from 'node:module'

// The version on every download button comes from the repository's own
// package.json, so the site can never offer a tag that was never built.
const pkg = createRequire(import.meta.url)('../package.json') as { version: string }

/**
 * The website is a static single page. Everything it needs at runtime (the
 * release it points at, the portable archives, the screenshots) is produced by
 * `scripts/prepare-assets.mjs` before Vite runs, so `dist/` is self-contained
 * and Netlify only has to serve files — no function, no runtime, no API key.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __SITE_VERSION__: JSON.stringify(pkg.version),
    __SITE_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  // Bound to 0.0.0.0 and open to any Host header: the sandbox serves this dev
  // server through a proxy host, and Vite's own host check would reject it.
  server: {
    host: '0.0.0.0',
    port: 5188,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
