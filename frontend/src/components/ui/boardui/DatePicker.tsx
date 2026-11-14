/* BoardUI single-date picker layout adaptation, MIT. Local date-only strings avoid UTC shifts. */
import { useMemo, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
const keyFor = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parse = (value: string) => { const d = new Date(`${value}T12:00:00`); return Number.isNaN(d.getTime()) ? new Date() : d }
export function BoardDatePicker({ value, onChange, label = 'Date', disabled = false }: { value: string; onChange: (value: string) => void; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(value)
  const [month, setMonth] = useState(() => parse(value))
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
    first.setDate(first.getDate() - first.getDay())
    return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, 12))
  }, [month])
  return <Popover.Root open={open} onOpenChange={(next) => { if (next) { setPending(value); setMonth(parse(value)) }; setOpen(next) }}>
    <Popover.Trigger disabled={disabled} className="bui-button" aria-label={`${label}: ${value || 'Choose date'}`}><CalendarDays size={15} />{value || 'Choose date'}</Popover.Trigger>
    <Popover.Portal><Popover.Positioner sideOffset={8} className="z-[220]"><Popover.Popup className="bui-popover w-[300px]" aria-label={label}>
      <header className="flex items-center justify-between mb-3"><button type="button" className="bui-icon-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}><ChevronLeft size={16} /></button><h3 className="font-medium" aria-live="polite">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button type="button" className="bui-icon-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}><ChevronRight size={16} /></button></header>
      <div className="grid grid-cols-7 mb-1 text-center text-[var(--text-3)]" aria-hidden="true">{['Su','Mo','Tu','We','Th','Fr','Sa'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-0.5" role="group" aria-label="Choose day">{days.map((day) => { const id = keyFor(day); return <button type="button" key={id} ref={(el) => { buttons.current[id] = el }} tabIndex={id === pending || (!pending && id === keyFor(new Date())) ? 0 : -1}
        aria-label={day.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} aria-pressed={pending === id}
        className="h-8 rounded-full text-xs" style={{ background: pending === id ? 'var(--primary)' : undefined, color: pending === id ? 'var(--on-primary,#fff)' : day.getMonth() === month.getMonth() ? 'var(--text)' : 'var(--text-3)' }}
        onClick={() => setPending(id)} onKeyDown={(event) => {
          const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -7, ArrowDown: 7, Home: -day.getDay(), End: 6-day.getDay() }
          if (!(event.key in offsets)) return
          event.preventDefault(); const next = new Date(day); next.setDate(next.getDate() + offsets[event.key]); const key = keyFor(next)
          setPending(key); if (!days.some((d) => keyFor(d) === key)) setMonth(next)
          requestAnimationFrame(() => buttons.current[key]?.focus())
        }}>{day.getDate()}</button> })}</div>
      <label className="block mt-3 text-xs">{label}<input className="bui-field w-full mt-1" type="date" aria-label={`Edit ${label.toLowerCase()}`} value={pending} onChange={(e) => { setPending(e.target.value); if (e.target.value) setMonth(parse(e.target.value)) }} /></label>
      <footer className="flex justify-end gap-2 mt-3"><Popover.Close className="bui-button">Cancel</Popover.Close><button type="button" className="bui-button bui-button-primary" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(pending)} onClick={() => { onChange(pending); setOpen(false) }}>Apply date</button></footer>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>
}
