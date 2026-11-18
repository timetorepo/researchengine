import { useEffect, useRef } from 'react'
import { Timer, Search, Users, Sparkles, Square, CircleDot } from 'lucide-react'
import { Island, IslandProvider, useIsland, useIslandActions } from '@/lib/island'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { stopStream } from '@/lib/chat/runChat'
import { fmt } from '@/lib/utils'

/** Bridge existing real activity events; no preset demo jobs or synthetic timers. */
function ActivityBridge() {
  const activity = useUI((s) => s.island)
  const api = useIslandActions()
  const handle = useRef<ReturnType<typeof api.start> | null>(null)
  const model = useStore((s) => s.settings.defaultModel)
  useEffect(() => () => { handle.current?.end(); handle.current = null }, [api])
  useEffect(() => {
    if (activity.kind === 'idle') { handle.current?.end(); handle.current = null; return }
    const label = activity.kind === 'streaming' ? `${fmt(activity.tokens)} tokens` : activity.kind === 'search' ? `${activity.sources} sources` : activity.kind === 'flood' ? `${activity.active}/${activity.total} agents` : activity.kind === 'focus' ? `${Math.floor(activity.remaining / 60)}:${String(activity.remaining % 60).padStart(2, '0')}` : activity.name
    const title = activity.kind === 'streaming' ? 'Generating a response' : activity.kind === 'search' ? 'Searching sources' : activity.kind === 'flood' ? 'Agents at work' : activity.kind === 'focus' ? 'Focus session' : 'Running skill'
    const Icon = activity.kind === 'focus' ? Timer : activity.kind === 'search' ? Search : activity.kind === 'flood' ? Users : activity.kind === 'skill' ? Sparkles : CircleDot
    const content = {
      label: `${title}: ${label}`,
      onPress: () => api.expand('researchengine-activity'),
      compact: { leading: <Icon size={18} aria-hidden />, trailing: <span className="re-islandcn-value">{label}</span> },
      minimal: <Icon size={18} aria-hidden />,
      expanded: { leading: <Icon size={22} aria-hidden />, trailing: <span className="re-islandcn-value">{label}</span>, bottom: <div className="re-islandcn-detail">
        <h2>{title}</h2><p>{activity.kind === 'streaming' ? model || 'Current conversation' : label}</p>
        <div className="re-islandcn-actions">
          {activity.kind === 'streaming' && <button type="button" onClick={() => { const id = useStore.getState().activeChatId; if (id) stopStream(id) }}><Square size={12} /> Stop response</button>}
          <button type="button" onClick={() => { api.collapse(); useUI.getState().openSettings('providers') }}>Model settings</button>
        </div>
      </div> },
    }
    if (handle.current) handle.current.update(content)
    else handle.current = api.start({ id: 'researchengine-activity', ...content })
  }, [activity, model, api])
  return null
}
function ExpansionBridge() {
  const api = useIsland()
  const expanded = api.presentation === 'expanded'
  useEffect(() => {
    useUI.setState({ islandExpanded: expanded })
  }, [expanded])
  useEffect(() => () => { useUI.setState({ islandExpanded: false }) }, [])
  useEffect(() => useUI.subscribe((state, previous) => {
    if (previous.islandExpanded && !state.islandExpanded && api.presentation === 'expanded') api.collapse()
  }), [api])
  return null
}
export function DynamicIsland() {
  const reduced = useStore((s) => s.settings.reduceMotion)
  return <IslandProvider reducedMotion={reduced ? 'always' : 'user'}>
    <ActivityBridge /><ExpansionBridge />
    <Island placement="viewport" label="Activity island" keyline="on" className="re-islandcn" style={{ top: 48, zIndex: 45 }} />
  </IslandProvider>
}
