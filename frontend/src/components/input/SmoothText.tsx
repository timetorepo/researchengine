import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { clsx } from 'clsx'
import { useStore } from '@/stores/useStore'

/**
 * Smooth caret — reimplemented from Skiper UI's "Smooth caret input" (skiper106)
 * against this app's own tokens.
 *
 * What the original does, and what is kept: the native caret is made invisible
 * and replaced by a spring-animated bar. Its position is measured from the
 * text before the cursor using the field's *computed* font (size, family,
 * letter-spacing, padding), so it stays glued to the glyphs the browser drew.
 * It hides while a selection is non-collapsed, re-measures on input, selection
 * changes, resize and scroll, and snaps instead of gliding under
 * prefers-reduced-motion.
 *
 * What is changed for this codebase:
 *  - it reads the app's own `smoothCaret` setting (Appearance → Smooth caret),
 *    so it is a preference rather than a per-field decision;
 *  - `smoothCaretProps()` gives any existing input or textarea the treatment
 *    with one spread — no rewrite of the 40-odd fields in the app;
 *  - the overlay is a `position:absolute` bar inside the field's own wrapper,
 *    so it works in a textarea, in a flex row and inside a shadowed shell.
 */

/** Is the smooth caret turned on? (default: on — "smooth is default") */
export function useSmoothCaretEnabled(): boolean {
  const value = useStore((s) => (s.settings as any)?.smoothCaret)
  return value !== false
}

/**
 * Spread onto an existing `<input>` / `<textarea>`:
 *
 *   <input {...smoothCaretProps()} className="…" />
 *
 * NOT a hook, deliberately. This is spread inside conditionals and inside
 * `.map()` bodies all over the app (a route list that grows as it loads, a key
 * field that only appears when a key is needed), and a hook called from there
 * changes the hook count between renders — which is exactly React error #310,
 * the crash the FreeRoute page shipped with. It reads the store's current value
 * instead of subscribing: fields re-render with the components that own them,
 * and `useSmoothCaret()` exists for the rare case where a component wants to
 * react to the setting itself.
 */
export function smoothCaretProps(enabled?: boolean): {
  style?: React.CSSProperties
  className?: string
  'data-smooth-caret'?: string
} {
  const on = enabled ?? useStore.getState().settings?.smoothCaret !== false
  if (!on) return {}
  return {
    style: { caretColor: 'transparent' },
    className: 're-smooth-caret',
    'data-smooth-caret': 'true',
  }
}

/**
 * Hook-safe spelling, for components that want the props *and* to re-render
 * when the setting changes. Call it once at the top of the component and reuse
 * the result — never inside a conditional or a `.map()`.
 */
export function useSmoothCaret(enabled?: boolean): ReturnType<typeof smoothCaretProps> {
  const setting = useSmoothCaretEnabled()
  return React.useMemo(() => smoothCaretProps(enabled ?? setting), [enabled, setting])
}

/** Measure the pixel width of `text` as the field would render it. */
function measureText(field: HTMLElement, text: string): number {
  const cs = getComputedStyle(field)
  field.dataset.reMeasuring = '1'
  let mirror = field.parentElement?.querySelector<HTMLSpanElement>('span[data-re-caret-mirror]')
  if (!mirror) {
    mirror = document.createElement('span')
    mirror.dataset.reCaretMirror = '1'
    mirror.setAttribute('aria-hidden', 'true')
    mirror.style.position = 'absolute'
    mirror.style.left = '-9999px'
    mirror.style.top = '0'
    mirror.style.whiteSpace = 'pre'
    mirror.style.pointerEvents = 'none'
    mirror.style.visibility = 'hidden'
    field.parentElement?.appendChild(mirror)
  }
  mirror.style.font = cs.font
  mirror.style.fontFamily = cs.fontFamily
  mirror.style.fontSize = cs.fontSize
  mirror.style.fontWeight = cs.fontWeight
  mirror.style.letterSpacing = cs.letterSpacing
  mirror.style.fontVariant = cs.fontVariant
  mirror.style.textTransform = cs.textTransform
  mirror.style.textIndent = cs.textIndent
  mirror.textContent = text.length ? text : ''
  delete field.dataset.reMeasuring
  return mirror.getBoundingClientRect().width
}

export interface SmoothCaretProps {
  /** The field the caret belongs to. */
  fieldRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  /** Current value — changing it re-measures. */
  value: string
  /** Text laid out before the caret on the current line (defaults to the whole value). */
  lineStart?: number
  enabled?: boolean
  className?: string
}

/**
 * The animated caret. Rendered as a sibling of the field, inside a
 * `position:relative` wrapper.
 */
export function SmoothCaret({ fieldRef, value, enabled, className }: SmoothCaretProps) {
  const on = enabled ?? useSmoothCaretEnabled()
  const reduce = useReducedMotion()
  const [x, setX] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [height, setHeight] = useState(18)

  const position = useCallback(() => {
    const field = fieldRef.current
    if (!field) return
    const start = field.selectionStart ?? value.length
    const end = field.selectionEnd ?? start
    if (start !== end) { setHidden(true); return }
    setHidden(false)
    const cs = getComputedStyle(field)
    const padLeft = parseFloat(cs.paddingLeft || '0')
    const padTop = parseFloat(cs.paddingTop || '0')
    const scrollLeft = field.scrollLeft
    // Text before the caret on the *current* line — a textarea wraps, and a
    // caret measured from the string start would drift a whole line away.
    const before = value.slice(0, start)
    const lastBreak = Math.max(before.lastIndexOf('\n'), 0)
    const lineText = before.slice(lastBreak === 0 ? 0 : lastBreak + 1)
    const lineIndex = (before.slice(0, lastBreak === 0 ? 0 : lastBreak + 1).match(/\n/g) ?? []).length
    const lineHeight = parseFloat(cs.lineHeight || '') || parseFloat(cs.fontSize || '14') * 1.5
    const width = measureText(field, lineText)
    setX(Math.max(0, padLeft + width - scrollLeft))
    setHeight(Math.max(12, Math.min(lineHeight, field.clientHeight - padTop)))
    setFocused(document.activeElement === field)
  }, [fieldRef, value, hidden])

  useLayoutEffect(() => { position() }, [position])

  useEffect(() => {
    const field = fieldRef.current
    if (!field || !on) return
    const id = requestAnimationFrame(position)
    const onSel = () => position()
    const onBlur = () => setFocused(false)
    const onFocus = () => { setFocused(true); requestAnimationFrame(position) }
    field.addEventListener('input', onSel)
    field.addEventListener('keyup', onSel)
    field.addEventListener('click', onSel)
    field.addEventListener('select', onSel)
    field.addEventListener('scroll', onSel)
    field.addEventListener('focus', onFocus)
    field.addEventListener('blur', onBlur)
    document.addEventListener('selectionchange', onSel)
    const ro = new ResizeObserver(() => position())
    ro.observe(field)
    return () => {
      cancelAnimationFrame(id)
      field.removeEventListener('input', onSel)
      field.removeEventListener('keyup', onSel)
      field.removeEventListener('click', onSel)
      field.removeEventListener('select', onSel)
      field.removeEventListener('scroll', onSel)
      field.removeEventListener('focus', onFocus)
      field.removeEventListener('blur', onBlur)
      document.removeEventListener('selectionchange', onSel)
      ro.disconnect()
    }
  }, [fieldRef, on, position])

  if (!on) return null

  return (
    <motion.span
      aria-hidden
      className={clsx('re-smooth-caret-bar', className)}
      initial={false}
      animate={{
        x: x ?? 0,
        opacity: focused && !hidden && x !== null ? 1 : 0,
      }}
      transition={reduce
        ? { duration: 0 }
        : { type: 'spring', stiffness: 620, damping: 38, mass: 0.55, opacity: { duration: 0.12 } }}
      style={{ height, top: '50%', translateY: '-50%' }}
    />
  )
}

export interface SmoothInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'ref'> {
  /** Extra classes for the outer wrapper (the caret is positioned against it). */
  wrapperClassName?: string
  /** Force the caret on/off for this field instead of following the setting. */
  smooth?: boolean
}

/**
 * A drop-in `<input>` with the smooth caret. Same props as the native element;
 * the only addition is that the caret animates.
 */
export const SmoothInput = React.forwardRef<HTMLInputElement, SmoothInputProps>(function SmoothInput(
  { wrapperClassName, smooth, className, value, onChange, style, ...rest }, ref,
) {
  const inner = useRef<HTMLInputElement | null>(null)
  const on = smooth ?? useSmoothCaretEnabled()
  const text = useMemo(() => (value == null ? '' : String(value)), [value])
  const [local, setLocal] = useState(text)
  const controlled = value != null
  const shown = controlled ? text : local

  const setRefs = (el: HTMLInputElement | null) => {
    inner.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) {
      // React's Ref union includes a readonly object type; assigning through an
      // unknown-shaped cast is the standard workaround for forwarding both.
      ;(ref as unknown as { current: HTMLInputElement | null }).current = el
    }
  }

  return (
    <span className={clsx('relative inline-flex w-full', wrapperClassName)}>
      <input
        {...rest}
        ref={setRefs}
        value={controlled ? text : local}
        onChange={(e) => {
          if (!controlled) setLocal(e.target.value)
          onChange?.(e)
        }}
        style={{ ...style, ...(on ? { caretColor: 'transparent' as const } : null) }}
        className={clsx(on && 're-smooth-caret', className)}
      />
      <SmoothCaret fieldRef={inner} value={shown} enabled={on} />
    </span>
  )
})
