import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-sans/700.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/lora/600.css'
import 'katex/dist/katex.min.css'
import '@/styles/globals.css'
// Animated blobatars (the profile avatar) need their keyframes loaded once.
import 'blobatar/motion.css'
// Sonner ships its own stylesheet; the app's palette is layered over it in
// globals.css (.re-sonner-toast) so toasts belong to every theme.
import 'sonner/dist/styles.css'
import App from './App'
import { startPerformanceSync } from '@/lib/system/performance'

// The active profile is mirrored to <html data-perf> for the eco blur cap.
startPerformanceSync()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA: register the app-shell service worker in production builds only.
// It caches static assets for offline reads and never touches API traffic.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
