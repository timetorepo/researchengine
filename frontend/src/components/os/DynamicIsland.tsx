import { useEffect, useRef } from 'react'
import { Timer, Search, Users, Sparkles, Square, CircleDot } from 'lucide-react'
import { Island } from '@/components/ui/bencho/dynamic-island/Island'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { stopStream } from '@/lib/chat/runChat'
import { fmt } from '@/lib/utils'

export function DynamicIsland() {
  const activity = useUI((s) => s.island)
  const open = useUI((s) => s.islandExpanded)
  const reduced = useStore((s) => s.settings.reduceMotion)
  const model = useStore((s) => s.settings.defaultModel)
  const root = useRef<HTMLDivElement>(null)
  const setOpen = (value: boolean) => useUI.setState({ islandExpanded: value })
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLButtonElement>('button')?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const time = activity.kind === 'focus' ? `${Math.floor(activity.remaining / 60)}:${String(activity.remaining % 60).padStart(2, '0')}` : ''
  const label = activity.kind === 'idle' ? 'Ready' : activity.kind === 'streaming' ? `${fmt(activity.tokens)} tokens` : activity.kind === 'search' ? `${activity.sources} sources` : activity.kind === 'flood' ? `${activity.active}/${activity.total} agents` : activity.kind === 'focus' ? time : activity.name
  const Icon = activity.kind === 'focus' ? Timer : activity.kind === 'search' ? Search : activity.kind === 'flood' ? Users : activity.kind === 'skill' ? Sparkles : CircleDot
  return <div ref={root} className="re-bencho re-island-position" role="region" aria-label="Activity island">
    <Island open={open} onOpenChange={setOpen} reduced={reduced} summary={<><Icon size={16} aria-hidden /><span className="truncate min-w-0">{label}</span><span className="re-island-state-dot" data-active={activity.kind !== 'idle'} /></>}>
      <p className="text-sm font-medium mb-1">{activity.kind === 'idle' ? 'Ready for your next question' : activity.kind === 'streaming' ? 'Generating a response' : activity.kind === 'search' ? 'Searching sources' : activity.kind === 'flood' ? 'Agents at work' : activity.kind === 'focus' ? 'Focus session' : 'Running skill'}</p>
      <p className="text-xs mb-4 opacity-70 break-words">{activity.kind === 'idle' ? (model || 'No default model selected') : label}</p>
      <div className="flex gap-2">
        {activity.kind === 'streaming' && <button className="re-island-action" onClick={() => { const id = useStore.getState().activeChatId; if (id) stopStream(id) }}><Square size={12} /> Stop response</button>}
        <button className="re-island-action" onClick={() => { setOpen(false); useUI.getState().openSettings('providers') }}>Model settings</button>
      </div>
    </Island>
  </div>
}
