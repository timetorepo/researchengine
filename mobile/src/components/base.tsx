// Base components. Every one exposes its state via data-c / data-state so the
// design preview and the render tests can enumerate them (docs/mobile/05).
// Tokens only: no literal colours outside var() (05-components.md, Global rules).
import React from 'react'
import { haptic } from '../lib/haptics'

type PressProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'danger' | 'accent2'
  hapticEvent?: 'press' | 'send' | 'error'
}

export function PressButton({ variant = 'quiet', hapticEvent = 'press', onPointerDown, className = '', ...rest }: PressProps) {
  return (
    <button
      data-c="PressButton" data-variant={variant}
      className={`press-tap btn btn-${variant} ${className}`}
      onPointerDown={(e) => { haptic(hapticEvent); onPointerDown?.(e) }}
      {...rest}
    />
  )
}

export function ModeChip({ label, active, tone = 'brand', onToggle, ...rest }:
  { label: string; active?: boolean; tone?: 'brand' | 'warning'; onToggle?: () => void } & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      data-c="ModeChip" data-state={active ? 'on' : 'off'}
      className={`chip press-tap ${active ? 'chip-on' : ''}`}
      style={active ? ({ ['--chip-tone' as any]: tone === 'warning' ? 'var(--warning)' : 'var(--primary)' } as React.CSSProperties) : undefined}
      onClick={() => { haptic('press'); onToggle?.() }}
      {...rest}
    >
      <span className="chip-dot" aria-hidden />{label}
    </button>
  )
}

export function CitationChip({ n, ...rest }: { n: number } & React.HTMLAttributes<HTMLAnchorElement>) {
  return (
    <a data-c="CitationChip" href={`#source-${n}`} role="button"
      className="chip chip-cite press-tap"
      onClick={(e) => { haptic('citation'); rest.onClick?.(e) }}
      aria-label={`Source ${n}`}>{n}</a>
  )
}

export function SwitchRow({ label, hint, checked, onChange }:
  { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label data-c="SwitchRow" data-state={checked ? 'on' : 'off'} className="row row-switch">
      <span className="row-text">
        <span className="row-label">{label}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </span>
      <button role="switch" aria-checked={checked} className="switch press-tap"
        onClick={() => { haptic('detent'); onChange(!checked) }}>
        <span className="switch-knob" />
      </button>
    </label>
  )
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }:
  { options: { id: T; name: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div data-c="SegmentedControl" className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} data-state={o.id === value ? 'on' : 'off'}
          className={`seg-item press-tap ${o.id === value ? 'seg-on' : ''}`}
          onClick={() => { haptic('detent'); onChange(o.id) }}>{o.name}</button>
      ))}
    </div>
  )
}

export function SearchField({ value, onChange, placeholder, onFocus }:
  { value: string; onChange: (v: string) => void; placeholder?: string; onFocus?: () => void }) {
  return (
    <div data-c="SearchField" className="searchfield">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => { haptic('press'); onFocus?.() }}
        placeholder={placeholder ?? 'Search'} aria-label={placeholder ?? 'Search'} enterKeyHint="search" />
      {value !== '' && <button className="searchfield-x" aria-label="Clear" onClick={() => onChange('')}>×</button>}
    </div>
  )
}

export function SkeletonRow({ lines = 2 }: { lines?: number }) {
  return (
    <div data-c="SkeletonRow" className="row row-skeleton" aria-hidden>
      <span className="skeleton sk-avatar" />
      <span className="sk-lines">{Array.from({ length: lines }, (_, i) => <span key={i} className="skeleton" style={{ width: `${[70, 40][i] ?? 60}%` }} />)}</span>
    </div>
  )
}

export function EmptyState({ title, body, action }:
  { title: string; body?: string; action?: { label: string; run: () => void } }) {
  return (
    <div data-c="EmptyState" className="empty">
      <p className="empty-title">{title}</p>
      {body && <p className="empty-body">{body}</p>}
      {action && <PressButton variant="primary" onClick={action.run}>{action.label}</PressButton>}
    </div>
  )
}

export function Snackbar({ snack, onDismiss }:
  { snack: { id: number; title: string; body?: string; tone: 'info' | 'success' | 'warning' | 'error'; action?: { label: string; run: () => void } }; onDismiss: (id: number) => void }) {
  return (
    <div data-c="Snackbar" data-tone={snack.tone} className={`snack snack-${snack.tone}`} role="status" aria-live="polite">
      <div className="snack-text">
        <span className="snack-title">{snack.title}</span>
        {snack.body && <span className="snack-body">{snack.body}</span>}
      </div>
      {snack.action && <button className="snack-action press-tap" onClick={() => { snack.action!.run(); onDismiss(snack.id) }}>{snack.action.label}</button>}
      <button className="snack-x" aria-label="Dismiss" onClick={() => onDismiss(snack.id)}>×</button>
    </div>
  )
}
