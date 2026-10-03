// Cards and rows (docs/mobile/05-components.md inventory). Static-capable:
// each renders faithfully from props alone so the design preview can drive
// every state without the data layers (which land R2-R7).
import React from 'react'
import { PressButton } from './base'
import { haptic } from '../lib/haptics'
import type { ThemeMetaLite } from '../lib/theme'

export function ThemeCard({ theme, selected, favourite, onPick, onFav }:
  { theme: ThemeMetaLite; selected?: boolean; favourite?: boolean; onPick: () => void; onFav: () => void }) {
  return (
    <div data-c="ThemeCard" data-state={selected ? 'selected' : 'default'} className={`card themecard press-tap ${selected ? 'card-selected' : ''}`}
      role="button" tabIndex={0} onClick={() => { haptic('press'); onPick() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() } }}>
      <span className="themecard-swatches" aria-hidden>
        {theme.swatches.map((c, i) => <span key={i} className="swatch" style={{ background: c }} />)}
      </span>
      <span className="row-text">
        <span className="row-label">{theme.name}</span>
        {theme.caption && <span className="row-hint">{theme.caption}</span>}
      </span>
      <button aria-label={favourite ? 'Remove favourite' : 'Add favourite'} aria-pressed={!!favourite}
        className={`fav press-tap ${favourite ? 'fav-on' : ''}`}
        onClick={(e) => { e.stopPropagation(); haptic('detent'); onFav() }}>★</button>
    </div>
  )
}

export function ModelCard({ provider, model, state = 'ready', meta }:
  { provider: string; model: string; state?: 'ready' | 'loading' | 'error' | 'disabled'; meta?: string }) {
  return (
    <div data-c="ModelCard" data-state={state} className="card modelcard">
      <span className={`logo ${state === 'loading' ? 'pulse-dot' : ''}`} aria-hidden>{provider.slice(0, 1)}</span>
      <span className="row-text">
        <span className="row-label">{model}</span>
        <span className="row-hint">{meta ?? (state === 'loading' ? 'Fetching models' : state === 'error' ? 'Could not reach the provider' : state === 'disabled' ? 'Disabled' : provider)}</span>
      </span>
      {state === 'error' && <PressButton variant="quiet" onClick={() => haptic('press')}>Retry</PressButton>}
    </div>
  )
}

export function ScopeRow({ scope, granted, onChange }:
  { scope: string; granted: boolean; onChange: (v: boolean) => void }) {
  const exec = scope === 'coding.exec'
  return (
    <label data-c="ScopeRow" data-state={granted ? 'granted' : 'denied'} className={`row ${exec ? 'row-exec' : ''}`}>
      <span className="row-text">
        <span className="row-label">{scope}</span>
        <span className="row-hint">{exec ? 'Every execution asks again within 60 seconds' : granted ? 'Granted on this pairing' : 'Not granted'}</span>
      </span>
      <input type="checkbox" checked={granted} onChange={(e) => { haptic('detent'); onChange(e.target.checked) }} aria-label={`Scope ${scope}`} />
    </label>
  )
}

export function JobRow({ name, progress, state, onCancel }:
  { name: string; progress?: number; state: 'queued' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled'; onCancel?: () => void }) {
  const showCancel = (state === 'running' || state === 'paused') && onCancel
  return (
    <div data-c="JobRow" data-state={state} className="row jobrow">
      <span className="row-text">
        <span className="row-label">{name}</span>
        <span className="row-hint">
          {state === 'queued' && 'Queued'}
          {state === 'running' && (progress != null ? `${Math.round(progress * 100)}%` : 'Working')}
          {state === 'paused' && 'Paused (will resume)'}
          {state === 'done' && 'Done'}
          {state === 'failed' && 'Failed: open for the reason'}
          {state === 'cancelled' && 'Cancelled'}
        </span>
      </span>
      {(state === 'running' && progress != null) && (
        <span className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span className="progress-fill" style={{ transform: `scaleX(${progress})` }} />
        </span>
      )}
      {showCancel && <button className="btn btn-quiet jobcancel press-tap" onClick={() => { haptic('error'); onCancel!() }}>Cancel</button>}
    </div>
  )
}

export function AgentRow({ name, role, state, note, color }:
  { name: string; role: string; state: 'thinking' | 'writing' | 'done' | 'error'; note?: string; color?: string }) {
  return (
    <div data-c="AgentRow" data-state={state} className="row agentrow">
      <span className={`dot ${state === 'thinking' || state === 'writing' ? 'pulse-dot' : ''}`} style={color ? { background: color } : undefined} aria-hidden />
      <span className="row-text">
        <span className="row-label">{name} <span className="muted">the {role}</span></span>
        <span className="row-hint">{note ?? (state === 'done' ? 'Filed findings' : state === 'error' ? 'Stopped: provider error' : 'Reading sources')}</span>
      </span>
    </div>
  )
}

export function ToolCallCard({ tool, label, status, onApprove, onReject }:
  { tool: string; label: string; status: 'ok' | 'error' | 'blocked' | 'confirm'; onApprove?: () => void; onReject?: () => void }) {
  return (
    <div data-c="ToolCallCard" data-state={status} className={`card toolcard tool-${status}`}>
      <span className="row-text">
        <span className="row-label">{label}</span>
        <span className="row-hint">
          {status === 'ok' && `Used ${tool}`}
          {status === 'error' && `${tool} failed: check why() and retry`}
          {status === 'blocked' && `${tool} is blocked by a safety rule`}
          {status === 'confirm' && `${tool} wants to run something. Approve within 60 s or it lapses.`}
        </span>
      </span>
      {status === 'confirm' && (
        <span className="tool-actions">
          <PressButton variant="danger" onClick={() => { haptic('error'); onReject?.() }}>Reject</PressButton>
          <PressButton variant="primary" onClick={() => { haptic('send'); onApprove?.() }}>Approve</PressButton>
        </span>
      )}
    </div>
  )
}

export function QuizChoiceButton({ label, state = 'default', onPick }:
  { label: string; state?: 'default' | 'pressed' | 'correct' | 'wrong' | 'disabled'; onPick?: () => void }) {
  return (
    <button data-c="QuizChoiceButton" data-state={state} disabled={state === 'disabled'}
      className={`quizchoice press-tap ${state === 'correct' ? 'fill-correct' : ''} ${state === 'wrong' ? 'shake-x' : ''}`}
      onClick={() => { haptic(state === 'correct' ? 'quiz-correct' : 'press'); onPick?.() }}>
      {label}
    </button>
  )
}
