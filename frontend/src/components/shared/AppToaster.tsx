import React, { useEffect } from 'react'
import { Toaster as SonnerToaster, toast as sonner } from 'sonner'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { setToastSink, type ToastTone } from '@/lib/notify'

/**
 * Toasts, by Sonner (emilkowalski).
 *
 * The hand-rolled stack that used to live here did the basics and nothing else.
 * Sonner brings the parts that make a notification feel alive: hover to pause
 * the timer, toasts that collapse into a stacked pile as more arrive, swipe to
 * dismiss, gap-aware layout, and springs instead of linear fades.
 *
 * This file is only the host. `useUI.toast()` is still the single call the rest
 * of the app makes — it records the notice (Settings → About → Notices) and
 * hands it here through `lib/notify`, so nothing that already raised a toast had
 * to change. Sonner owns the *lifetime* of the on-screen toast, which is what
 * makes hover-to-pause real; its dismiss/auto-close callbacks land back in the
 * store so the queue never disagrees with what is on screen.
 */

const TONE: Record<ToastTone, typeof sonner.info> = {
  info: sonner.info,
  success: sonner.success,
  warning: sonner.warning,
  danger: sonner.error,
}

export function AppToaster() {
  const theme = useStore((s) => s.settings.theme)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const light = /^(light|solarized-light|catppuccin-latte|github-light|one-light)/.test(theme)

  useEffect(() => {
    // One host per app: the sink is the bridge from the store to Sonner.
    setToastSink(({ id, title, body, tone }) => {
      const fire = TONE[tone] ?? sonner.info
      const done = () => useUI.getState().dismissToast(id)
      fire(title, {
        id,
        description: body,
        className: `re-toast re-toast-${tone}`,
        onDismiss: done,
        onAutoClose: done,
      })
    })
    return () => setToastSink(null)
  }, [])

  return (
    <SonnerToaster
      // Top-right matches the old position, offset below the 48px top bar so a
      // toast never covers the model picker.
      position="top-right"
      offset={{ top: 56, right: 16, bottom: 20, left: 16 }}
      mobileOffset={{ top: 56, right: 12, bottom: 16, left: 12 }}
      gap={10}
      visibleToasts={4}
      duration={4200}
      closeButton
      expand
      // The app has 20+ palettes; Sonner's own dark/light is only a hint. The
      // real colours come from CSS variables in globals.css (.re-toast).
      theme={light ? 'light' : 'dark'}
      className={reduceMotion ? 're-toast-static' : undefined}
      toastOptions={{
        classNames: {
          toast: 're-sonner-toast',
          title: 're-sonner-title',
          description: 're-sonner-desc',
          closeButton: 're-sonner-close',
          icon: 're-sonner-icon',
          actionButton: 're-sonner-action',
        },
      }}
      style={{
        ['--normal-bg' as string]: 'var(--glass)',
        ['--normal-border' as string]: 'var(--surface-border)',
        ['--normal-text' as string]: 'var(--text)',
        ['--border-radius' as string]: '14px',
        ['--width' as string]: '330px',
      }}
    />
  )
}
