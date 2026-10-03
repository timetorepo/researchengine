import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'

// @re/tokens generated output lives outside the app root on purpose: one
// generator, three platforms (docs/mobile/01-tokens.md).
const tokensDist = fileURLToPath(new URL('../packages/tokens/dist', import.meta.url))
const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': src,
      '@re/tokens': tokensDist,
    },
  },
  server: {
    // The preview browser and the Tauri dev url both hit this; 1420 is the
    // Tauri convention, devUrl in src-tauri/tauri.conf.json matches.
    host: '0.0.0.0',
    port: 1420,
    strictPort: false,
    // The Arena preview reaches this dev server through a proxied host;
    // allow any host in dev only (Tauri devUrl is localhost, store builds never
    // run a dev server).
    allowedHosts: true,
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2022', 'chrome105', 'safari16'],
  },
  // allow importing from packages/tokens outside the app root
  fs: { allow: ['..'] },
})
