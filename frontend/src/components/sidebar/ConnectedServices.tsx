/**
 * The Connected tab: every service this Composio user has connected, with a way
 * to disconnect it, and the recent connects and disconnects, whether they were
 * made here or on Composio's website.
 */
import React from 'react'
import { Check, Loader2, RefreshCw, Unplug } from 'lucide-react'
import type { ComposioAccount } from '@/lib/composio/client'
import type { ActivityEvent } from '@/lib/composio/activity'
import { timeAgo } from '@/lib/utils'

const muted = { color: 'var(--text-3)' } as const
const field = { background: 'var(--elevated)', border: '1px solid var(--surface-border)' } as const
const danger = { color: 'var(--danger, #e5484d)' } as const

export function ConnectedServices({
  accounts, events, appName, busy, armed, onDisconnect, onRefresh, refreshedAt, refreshing, onBrowseApps,
}: {
  /** Active accounts only. */
  accounts: ComposioAccount[]
  /** Events for the current Composio user, newest first. */
  events: ActivityEvent[]
  appName: (slug: string) => string
  busy: string | null
  armed: string | null
  onDisconnect: (acc: ComposioAccount, name: string) => void
  onRefresh: () => void
  refreshedAt: number | null
  refreshing: boolean
  onBrowseApps: () => void
}) {
  return (
    <div className="space-y-5" data-ui="connected-services">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium">Connected services</div>
          <div className="text-[11px]" style={muted}>
            {refreshedAt ? `Updated ${timeAgo(refreshedAt)}. Changes on Composio's website appear here by themselves.` : 'Reading your connections…'}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh connected services"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] disabled:opacity-50"
          style={{ ...field, color: 'var(--text-2)' }}>
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : undefined} /> Refresh
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-[14px] p-5 text-center space-y-2" style={field}>
          <p className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>No services are connected yet.</p>
          <button type="button" onClick={onBrowseApps}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>Browse apps</button>
        </div>
      ) : (
        <ul className="space-y-1.5" aria-label="Connected services">
          {accounts.map((a) => {
            const name = appName(a.toolkit)
            const isArmed = armed === a.id
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5" style={field}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--success, #30a46c) 16%, transparent)', color: 'var(--success, #30a46c)' }}>
                  <Check size={13} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium truncate">{name}</div>
                  <div className="text-[10.5px] truncate" style={muted}>
                    {a.alias ? `${a.alias} · ` : ''}{a.createdAt ? `connected ${timeAgo(Date.parse(a.createdAt) || Date.now())}` : 'connected'}
                  </div>
                </div>
                <button type="button" onClick={() => onDisconnect(a, name)} disabled={busy === a.id}
                  aria-label={isArmed ? `Confirm disconnect ${name}` : `Disconnect ${name}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] disabled:opacity-50"
                  style={{ ...field, ...(isArmed ? danger : { color: 'var(--text-2)' }) }}>
                  {busy === a.id ? <Loader2 size={11} className="animate-spin" /> : <Unplug size={11} />}
                  {isArmed ? 'Confirm' : 'Disconnect'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <section aria-label="Recent changes" className="space-y-2">
        <div className="text-[10.5px] uppercase tracking-wider" style={muted}>Recent changes</div>
        {events.length === 0 ? (
          <p className="text-[12px]" style={muted}>
            Nothing yet. Connecting or disconnecting an app, here or on Composio's website, shows up here.
          </p>
        ) : (
          <ul className="space-y-1" aria-label="Recent connection changes">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: e.kind === 'connected' ? 'var(--success, #30a46c)' : 'var(--text-3)' }} />
                <span className="flex-1 min-w-0 truncate">
                  {e.kind === 'connected' ? 'Connected' : 'Disconnected'} <b className="font-medium">{appName(e.toolkit)}</b>
                </span>
                <span className="text-[10.5px] shrink-0" style={muted}>{timeAgo(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
