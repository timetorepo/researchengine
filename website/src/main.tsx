import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/styles/globals.css'

const host = document.getElementById('root')
if (!host) throw new Error('the site needs a #root element')

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
