import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardPaste, Sparkles, Copy, Scissors, Link2, ExternalLink, Search, Plus,
  GraduationCap, Layers, Settings, CheckSquare, Type, MousePointerClick,
} from 'lucide-react'
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuShortcut, ContextMenuLabel,
} from '@/components/ui/context-menu'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { navigateNow } from '@/lib/routes/registry'

/**
 * The app's context menu — shadcn's `context-menu`, wired to what this app can
 * actually do with a right-click.
 *
 * What it looks at, at the moment the menu opens (not while rendering):
 *   · the current text selection,
 *   · whether the pointer is over a text field, and
 *   · whether it is over a link.
 *
 * From that it offers what makes sense: **Paste** into the field (or into the AI
 * composer when the click was not on a field), **Ask AI** about the selection,
 * copy / cut, link actions, and the app's own moves (new research, open the
 * page's surface, tasks, settings).
 *
 * Anything the browser owns — Paste in particular, which needs the clipboard —
 * is done through the clipboard API with a `document.execCommand('insertText')`
 * fallback, so the menu never offers an action that silently does nothing.
 */

type Ctx = {
  selection: string
  editable: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null
  link: string | null
  text: string
}

function readContext(target: EventTarget | null): Ctx {
  const el = target instanceof HTMLElement ? target : null
  const editable = (el?.closest('input, textarea, [contenteditable="true"]') ?? null) as Ctx['editable']
  const link = el?.closest('a[href]')?.getAttribute('href') ?? null
  // A selection made with the mouse is inside the window selection; a selection
  // inside a field is on the field itself.
  let selection = ''
  try { selection = window.getSelection()?.toString() ?? '' } catch { selection = '' }
  if (!selection && editable && 'selectionStart' in editable && 'selectionEnd' in editable) {
    const s = editable.selectionStart ?? 0
    const e = editable.selectionEnd ?? 0
    if (e > s) selection = (editable.value ?? '').slice(s, e)
  }
  return { selection: selection.trim(), editable, link, text: (el?.textContent ?? '').trim().slice(0, 400) }
}

/** Writes text into the focused/nearest field, falling back to the AI composer. */
function insertText(field: Ctx['editable'], text: string): boolean {
  if (!field) return false
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? field.value.length
    field.value = field.value.slice(0, start) + text + field.value.slice(end)
    const caret = start + text.length
    field.setSelectionRange(caret, caret)
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.focus()
    return true
  }
  field.focus()
  try { return document.execCommand('insertText', false, text) } catch { return false }
}

export function AppContextMenu({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [ctx, setCtx] = useState<Ctx>({ selection: '', editable: null, link: null, text: '' })
  const [clipboard, setClipboard] = useState('')

  // Read the clipboard when the menu opens. Reading it ahead of time needs a
  // permission prompt in some browsers; reading it on the gesture is allowed.
  const openMenu = (e: React.MouseEvent) => {
    // Surfaces that own their right-click say so with `data-owns-context-menu`
    // (the scroll indicator does). Radix already skips its own handler when an
    // inner trigger called preventDefault; this is the explicit version, so a
    // future surface cannot end up showing two menus at once.
    const el = e.target instanceof HTMLElement ? e.target : null
    if (el?.closest('[data-scroll-progress], [data-owns-context-menu]')) return
    const next = readContext(e.target)
    setCtx(next)
    setClipboard('')
    void navigator.clipboard?.readText?.().then((t) => setClipboard(t?.trim() ?? '')).catch(() => setClipboard(''))
  }

  const toast = (title: string, body?: string, tone: 'info' | 'success' | 'warning' | 'danger' = 'info') =>
    useUI.getState().toast(title, body, tone)

  /** Ask AI: seed whichever composer is open — the chat box, or the IDE's. */
  const askAI = (prompt?: string) => {
    const text = prompt ?? ctx.selection
    const seed = text ? `About this:\n\n"${text}"\n\n` : ''
    useUI.setState({ composerSeed: seed })
    useUI.getState().toast(
      text ? 'Sent to the AI composer' : 'AI composer focused',
      text ? 'Your selection is quoted in the box — add what you want to know.' : 'Type your question, or select text first.',
      'info',
    )
  }

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied', what, 'success')
    } catch {
      toast('Copy was blocked', 'The browser refused clipboard access for this page.', 'warning')
    }
  }

  return (
    <ContextMenu>
      {/* `display: contents` — the trigger must wrap the whole app without
          becoming a box in its layout. */}
      <ContextMenuTrigger asChild onContextMenu={openMenu}>
        <div className="contents">{children}</div>
      </ContextMenuTrigger>

      <ContextMenuContent className="min-w-[240px]">
        {/* --- the field you pointed at --- */}
        {ctx.editable && (
          <>
            <ContextMenuItem
              disabled={!clipboard}
              onSelect={() => {
                if (!clipboard) return
                if (insertText(ctx.editable, clipboard)) {
                  toast('Pasted', `${clipboard.length} characters.`, 'success')
                  return
                }
                // Some rich fields refuse a scripted paste; the composer can
                // always take it, and saying so beats a click that does nothing.
                askAI(clipboard)
              }}
            >
              <ClipboardPaste size={13} /> Paste
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem disabled={!ctx.selection} onSelect={() => void copy(ctx.selection, 'Selection on the clipboard.')}>
              <Copy size={13} /> Copy
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!ctx.selection}
              onSelect={() => {
                if (insertText(ctx.editable, '')) toast('Cut', 'Selection removed.', 'info')
              }}
            >
              <Scissors size={13} /> Cut
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* --- what you selected --- */}
        {!ctx.editable && ctx.selection && (
          <>
            <ContextMenuLabel className="truncate max-w-[220px]">{ctx.selection.slice(0, 60)}</ContextMenuLabel>
            <ContextMenuItem onSelect={() => void copy(ctx.selection, 'Selection on the clipboard.')}>
              <Copy size={13} /> Copy
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => askAI()}>
              <Sparkles size={13} /> Ask AI about this
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => { useStore.getState().newChat(); navigateNow({ href: '#/chats', push: (h) => navigate(h.replace(/^#/, '')) }) }}>
              <Plus size={13} /> Start a research chat with it
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(ctx.selection.slice(0, 180))}`, '_blank', 'noopener')}>
              <Search size={13} /> Search the web
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* --- the link you pointed at --- */}
        {ctx.link && (
          <>
            <ContextMenuItem onSelect={() => window.open(ctx.link ?? '', '_blank', 'noopener')}>
              <ExternalLink size={13} /> Open link
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void copy(ctx.link ?? '', 'Link on the clipboard.')}>
              <Link2 size={13} /> Copy link
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => askAI(`Summarise what is at ${ctx.link}.`)}>
              <Sparkles size={13} /> Ask AI to read it
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* --- always available --- */}
        <ContextMenuItem disabled={!clipboard} onSelect={() => askAI(clipboard)}>
          <ClipboardPaste size={13} /> Paste into the AI composer
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => askAI()}>
          <Sparkles size={13} /> Ask AI
          <ContextMenuShortcut>⌘K then A</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => { const id = useStore.getState().newChat(); navigateNow({ href: `#/chat/${id}`, push: (h) => navigate(h.replace(/^#/, '')) }) }}>
          <Plus size={13} /> New research
        </ContextMenuItem>

        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => useUI.setState({ tasksOpen: true })}>
          <CheckSquare size={13} /> Tasks
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => useUI.getState().openSettings('appearance')}>
          <Type size={13} /> App theme &amp; motion
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => useUI.getState().openSettings()}>
          <Settings size={13} /> Settings
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => useUI.setState({ paletteOpen: true })}>
          <MousePointerClick size={13} /> Command palette
          <ContextMenuShortcut>⌘K</ContextMenuShortcut>
        </ContextMenuItem>

        {ctx.text && (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel className="truncate max-w-[220px]">
              <Layers size={11} className="inline -mt-px mr-1" />{ctx.text.slice(0, 48)}
            </ContextMenuLabel>
            <ContextMenuItem onSelect={() => askAI(ctx.text)}>
              <GraduationCap size={13} /> Quiz me on this
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
