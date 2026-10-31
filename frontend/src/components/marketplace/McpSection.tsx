import React from 'react'
import { McpPanel } from '@/components/ide/McpPanel'

/** The MCP panel was built for the coding view's tokens; map them onto the app's. */
const MCP_TOKENS = {
  '--ide-accent': 'var(--primary)',
  '--ide-accent-ink': '#fff',
  '--ide-text': 'var(--text)',
  '--ide-dim': 'var(--text-2)',
  '--ide-faint': 'var(--text-3)',
  '--ide-hover': 'var(--elevated)',
  '--ide-border': 'var(--surface-border)',
  '--ide-warn': 'var(--warning)',
} as React.CSSProperties

/**
 * MCP servers, now a Marketplace section (they used to sit in Settings). Tool
 * servers for the agent, in coding sessions and in chats: install from the
 * catalog with one click, test the connection, and the model gets the tools on
 * its next turn.
 */
export function McpSection() {
  return (
    <div className="flex flex-col min-h-[420px]" style={MCP_TOKENS}>
      <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-2)' }}>
        Tool servers for the agent, in coding sessions and in chats. Install from the catalog with one click, test the connection, and the model gets the tools on its next turn.
      </p>
      <div className="flex-1 min-h-0 surface overflow-hidden"><McpPanel /></div>
    </div>
  )
}
