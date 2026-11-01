import React from 'react'
import { TriangleAlert, RotateCcw } from 'lucide-react'

/** Catches render crashes so the app never degrades to a silent blank page. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ResearchEngine] render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="h-full w-full flex items-center justify-center p-6" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 rounded-[14px] flex items-center justify-center mb-4"
            style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' }}>
            <TriangleAlert size={22} strokeWidth={1.5} />
          </div>
          <h2 className="text-[17px] font-semibold mb-1.5" style={{ letterSpacing: '-0.01em' }}>Something went sideways</h2>
          <p className="text-[13px] leading-relaxed mb-5" style={{ color: 'var(--text-2)' }}>
            This screen hit an error while rendering. Your data is safe — everything lives in this browser.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <RotateCcw size={13} /> Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full text-[13px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }}
            >
              Reload app
            </button>
          </div>
          <p className="text-[10.5px] font-mono mt-5 break-all" style={{ color: 'var(--text-3)' }}>{String(this.state.error)}</p>
        </div>
      </div>
    )
  }
}
