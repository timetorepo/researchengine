import React, { useEffect } from 'react'
import { Toaster as SonnerToaster, toast as sonner } from 'sonner'
import { Toast } from '@heroui/react'
import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react'
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
 *
 * The *look* is the toast this app already had: the same blurred glass surface
 * as the chatbox and the Dynamic Island (including Settings → Appearance →
 * Glass mode: off, blur or liquid), one tone-coloured icon on the left, the
 * title and body in the app's own type, and a quiet little X in the corner.
 * Sonner's default skin is a flat card with its own palette — none of it is
 * used.
 */

const TONE: Record<ToastTone, typeof sonner.info> = {
  info: sonner.info,
  success: sonner.success,
  warning: sonner.warning,
  danger: sonner.error,
}

/** The same four glyphs the hand-rolled stack used, at the same size. Colour is
 *  applied per tone in CSS so a theme can tint them. */
const ICONS = {
  success: <CheckCircle2 size={16} strokeWidth={1.8} />,
  info: <Info size={16} strokeWidth={1.8} />,
  warning: <AlertTriangle size={16} strokeWidth={1.8} />,
  error: <XCircle size={16} strokeWidth={1.8} />,
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
        // The glass surface (chatbox / island look) is mirrored in globals.css
        // rather than borrowed from `.glass-chat`, because that class sets
        // `position: relative` in liquid mode and Sonner stacks its toasts
        // absolutely.
        className: `re-toast re-toast-${tone}`,
        onDismiss: done,
        onAutoClose: done,
      })
    })
    return () => setToastSink(null)
  }, [])

  return (
    <>
    {/* HeroUI toasts (connector sign-in results). They share the host so they
        are on screen wherever the person is, including the lock and onboarding. */}
    <Toast.Provider placement="top end" />
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
      icons={ICONS}
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
        ['--width' as string]: '320px',
      }}
    />
    </>
  )
}
