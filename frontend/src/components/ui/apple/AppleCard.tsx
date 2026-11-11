/**
 * Apple-style surfaces, shared so every card in the app carries the same grammar.
 *
 * What makes a card read as Apple, in the references this was built from
 * (Apple Pay's payment sheet, Wallet's transaction cards and grouped lists):
 *
 *   • a large, soft corner (22px here) on a flat surface, with a barely visible
 *     top highlight instead of a hard border;
 *   • grouped content: rows inside one card, separated by hairlines that are
 *     inset from the edge, not full-bleed;
 *   • one clear title, one quiet subtitle, and figures set in tabular numerals;
 *   • capsule buttons, with one prominent action.
 *
 * Everything reads its colour from the app's own tokens, so it follows the theme.
 */
import React from 'react'

export const APPLE_RADIUS = 22
/** The depth every Apple card uses: a faint top highlight and a tight contact shadow. */
export const APPLE_SHADOW = 'inset 0 1px 0 rgb(255 255 255 / 0.05), 0 1px 2px rgb(0 0 0 / 0.18)'

/** The card surface. Pass `interactive` for a card that is also a button. */
export function AppleCard({
  children,
  className = '',
  style,
  padded = true,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  padded?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden ${padded ? 'p-4' : ''} ${className}`}
      style={{
        borderRadius: APPLE_RADIUS,
        background: 'var(--surface)',
        boxShadow: APPLE_SHADOW,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** A small section title above a group, in the sentence case Apple uses for list headers. */
export function AppleSectionTitle({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1.5 pt-1">
      <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-3)' }}>{children}</span>
      {trailing}
    </div>
  )
}

/**
 * A row inside a grouped card. The hairline above it is inset to the content
 * edge, the way iOS grouped lists draw it. The first row has no line.
 */
export function AppleRow({
  children,
  first = false,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  first?: boolean
  onClick?: () => void
  className?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 px-4 min-h-[52px] py-2.5 text-left ${onClick ? 'hover:bg-[var(--elevated)] transition-colors' : ''} ${className}`}
    >
      {!first && (
        <span aria-hidden className="absolute left-4 right-0 top-0 h-px" style={{ background: 'var(--surface-border)' }} />
      )}
      {children}
    </Tag>
  )
}

/**
 * A grouped list: one card with a row per child, hairlines inset from the edge.
 * Each child is wrapped in an AppleRow, so the children themselves do not change.
 */
export function AppleGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const items = React.Children.toArray(children)
  return (
    <AppleCard padded={false} className={className}>
      {items.map((c, i) => <AppleRow key={i} first={i === 0}>{c}</AppleRow>)}
    </AppleCard>
  )
}

/** A capsule button. `prominent` is the one filled action; the rest are quiet. */
export function ApplePill({
  children,
  prominent = false,
  onClick,
  disabled,
  type = 'button',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { prominent?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 h-9 text-[13px] font-medium transition-transform active:scale-[0.97] disabled:opacity-50 ${className}`}
      style={prominent
        ? { background: 'var(--primary)', color: '#fff' }
        : { background: 'var(--elevated)', color: 'var(--text)' }}
      {...rest}
    >
      {children}
    </button>
  )
}
