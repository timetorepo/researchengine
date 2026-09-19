import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

// The version shown in Settings → About is read from the package, so it can
// never drift from the release that actually shipped.
const pkg = createRequire(import.meta.url)('../package.json') as { version: string }

/**
 * Stamps every build with a fingerprint and writes `build-info.json` into the
 * dist folder. The server reads that file and reports it on /api/health, so a
 * self-hosted copy can tell you when the bundle in your browser is older than
 * the code on disk — the usual reason a fix "did not work" after an update.
 */
const buildId = `${pkg.version}+${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`

function buildFingerprint() {
  return {
    name: 're-build-fingerprint',
    apply: 'build' as const,
    closeBundle() {
      try {
        const out = path.resolve(__dirname, 'dist')
        if (!fs.existsSync(out)) return
        fs.writeFileSync(
          path.join(out, 'build-info.json'),
          JSON.stringify({ version: pkg.version, buildId, builtAt: new Date().toISOString() }, null, 2) + '\n',
        )
      } catch { /* a missing fingerprint must never break a build */ }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), buildFingerprint()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      // Local backend (Hono) — same-origin /api in dev; nginx does this in Docker.
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
})
