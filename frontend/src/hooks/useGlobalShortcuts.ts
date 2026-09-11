import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function useGlobalShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      const ui = useUI.getState()
      const store = useStore.getState()

      if (e.key === 'Escape') {
        if (ui.paletteOpen) ui.set({ paletteOpen: false })
        else if (ui.shortcutsOpen) ui.set({ shortcutsOpen: false })
        else if (ui.settingsOpen) { ui.set({ settingsOpen: false }); navigate('/') }
        else if (ui.skillBuilderOpen) ui.set({ skillBuilderOpen: null })
        else if (ui.skillRun) ui.set({ skillRun: null })
        else if (ui.islandExpanded) ui.set({ islandExpanded: false })
        return
      }
      if (!mod) return

      const k = e.key.toLowerCase()
      if (k === 'k') { e.preventDefault(); ui.set({ paletteOpen: !ui.paletteOpen }) }
      else if (k === 'b') { e.preventDefault(); ui.toggleSidebar() }
      else if (k === 'n' && e.shiftKey) {
        e.preventDefault()
        const id = store.newChat()
        navigate(`/chat/${id}?search=1`)
      }
      else if (k === 'n') { e.preventDefault(); const id = store.newChat(); navigate(`/chat/${id}`) }
      else if (k === 'm') { e.preventDefault(); window.dispatchEvent(new CustomEvent('re:toggle-math')) }
      else if (k === 'f' && !e.shiftKey) { e.preventDefault(); useStore.setState((s) => ({ settings: { ...s.settings, flowEnabled: !s.settings.flowEnabled } })); ui.toast(`AIFlowEngine ${useStore.getState().settings.flowEnabled ? 'on' : 'off'}`) }
      else if (k === 'a' && e.shiftKey) { e.preventDefault(); navigate('/flood') }
      else if (k === 's' && e.shiftKey) { e.preventDefault(); ui.set({ settingsOpen: true, settingsTab: 'providers' }); navigate('/settings') }
      else if (e.key === '/') { e.preventDefault(); ui.set({ shortcutsOpen: true }) }
      else if (e.key === ' ' && document.documentElement.dataset.theme === 're-os') {
        e.preventDefault(); ui.set({ paletteOpen: !ui.paletteOpen })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
