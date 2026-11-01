/**
 * An interactive card inside an answer (see lib/uicards/spec.ts).
 *
 * Built from HeroUI parts: `Card` for the frame, `Tabs` for alternatives,
 * `Slider` for numbers the user can tune, and buttons that either choose an
 * option or send a follow-up question back to the chat. Every control is local
 * state; nothing is sent until the user presses a button that says so.
 */
import React, { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Tabs, Slider } from '@heroui/react'
import { ArrowUpRight, Check, MessageSquareText } from 'lucide-react'
import type { UiBlock, UiCardSpec } from '@/lib/uicards/spec'

/** Ask the chat to send a message, the same way a suggestion chip does. */
function askChat(prompt: string) {
  window.dispatchEvent(new CustomEvent('re:send-prompt', { detail: prompt }))
}

function Stats({ items }: { items: Extract<UiBlock, { type: 'stats' }>['items'] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((s) => (
        <div key={s.label} className="rounded-[12px] px-3 py-2.5 min-w-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <dt className="text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{s.label}</dt>
          <dd className="text-[18px] font-semibold tabular-nums truncate" style={{ letterSpacing: '-0.01em' }}>{s.value}</dd>
          {s.hint && <dd className="text-[11px] truncate" style={{ color: 'var(--text-2)' }}>{s.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

function Bars({ block }: { block: Extract<UiBlock, { type: 'bars' }> }) {
  const reduce = useReducedMotion()
  const max = Math.max(...block.items.map((i) => i.value), 1)
  return (
    <div className="flex flex-col gap-2">
      {block.title && <div className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{block.title}</div>}
      {block.items.map((i, idx) => (
        <div key={i.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-[12px] gap-2">
            <span className="truncate">{i.label}</span>
            <span className="tabular-nums shrink-0" style={{ color: 'var(--text-2)' }}>{i.value}{block.unit ? ` ${block.unit}` : ''}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--primary)' }}
              initial={{ width: reduce ? `${(i.value / max) * 100}%` : 0 }}
              animate={{ width: `${(i.value / max) * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Tabbed({ block }: { block: Extract<UiBlock, { type: 'tabs' }> }) {
  const [sel, setSel] = useState(block.tabs[0].label)
  return (
    <Tabs selectedKey={sel} onSelectionChange={(k) => setSel(String(k))} aria-label="Options">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Options">
          {block.tabs.map((t) => (
            <Tabs.Tab key={t.label} id={t.label} className="text-[12.5px]">
              {t.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {block.tabs.map((t) => (
        <Tabs.Panel key={t.label} id={t.label} className="pt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {t.text}
        </Tabs.Panel>
      ))}
    </Tabs>
  )
}

function Choice({ block }: { block: Extract<UiBlock, { type: 'choice' }> }) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="flex flex-col gap-2">
      {block.prompt && <div className="text-[13px]">{block.prompt}</div>}
      <div className="flex flex-wrap gap-2">
        {block.options.map((o, i) => {
          const on = picked === i
          return (
            <button
              key={o.label + i}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPicked(i)
                if (o.reply) askChat(o.reply)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12.5px] transition-[background,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: on ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--surface)',
                border: `1px solid ${on ? 'var(--primary)' : 'var(--surface-border)'}`,
                color: on ? 'var(--text)' : 'var(--text-2)',
              }}
            >
              {on && <Check size={12} aria-hidden />}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Tune({ block }: { block: Extract<UiBlock, { type: 'slider' }> }) {
  const [value, setValue] = useState(block.value)
  const unit = block.unit ? ` ${block.unit}` : ''
  return (
    <Slider
      aria-label={block.label}
      value={value}
      onChange={(v) => setValue(Array.isArray(v) ? v[0] : v)}
      minValue={block.min}
      maxValue={block.max}
      step={block.step}
      className="w-full"
    >
      <div className="flex items-baseline justify-between text-[12.5px] mb-2">
        <span>{block.label}</span>
        <span className="tabular-nums font-semibold">{Number(value.toFixed(2))}{unit}</span>
      </div>
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
      {block.note && <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>{block.note}</div>}
    </Slider>
  )
}

function Block({ block }: { block: UiBlock }) {
  switch (block.type) {
    case 'heading':
      return <h4 className="text-[14px] font-semibold" style={{ letterSpacing: '-0.01em' }}>{block.text}</h4>
    case 'text':
      return <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{block.text}</p>
    case 'stats':
      return <Stats items={block.items} />
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag className={`${block.ordered ? 'list-decimal' : 'list-disc'} pl-5 text-[13px] leading-relaxed space-y-1`} style={{ color: 'var(--text-2)' }}>
          {block.items.map((i, idx) => <li key={idx}>{i}</li>)}
        </Tag>
      )
    }
    case 'bars':
      return <Bars block={block} />
    case 'tabs':
      return <Tabbed block={block} />
    case 'choice':
      return <Choice block={block} />
    case 'slider':
      return <Tune block={block} />
    case 'timeline':
      return (
        <ol className="flex flex-col">
          {block.items.map((i, idx) => (
            <li key={idx} className="relative pl-5 pb-3 last:pb-0">
              <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} aria-hidden />
              {idx < block.items.length - 1 && (
                <span className="absolute left-[3px] top-3.5 bottom-0 w-px" style={{ background: 'var(--surface-border)' }} aria-hidden />
              )}
              <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>{i.when}</div>
              <div className="text-[13px] font-medium">{i.title}</div>
              {i.text && <div className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>{i.text}</div>}
            </li>
          ))}
        </ol>
      )
    case 'link':
      return (
        <a href={block.href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: 'var(--primary)' }}>
          {block.label} <ArrowUpRight size={12} aria-hidden />
        </a>
      )
    case 'ask':
      return (
        <button type="button" onClick={() => askChat(block.prompt)}
          className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12.5px] transition-transform duration-150 active:scale-[0.98]"
          style={{ background: 'var(--primary)', color: 'var(--on-primary, #fff)' }}>
          <MessageSquareText size={12} aria-hidden /> {block.label}
        </button>
      )
  }
}

export function UiCard({ card }: { card: UiCardSpec }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="my-2"
      data-ui-card
    >
      <Card variant="secondary" className="gap-3 p-4">
        {(card.title || card.summary) && (
          <CardHeader className="flex-col items-start gap-0.5 p-0">
            {card.title && <CardTitle className="text-[14.5px] font-semibold" style={{ letterSpacing: '-0.01em' }}>{card.title}</CardTitle>}
            {card.summary && <CardDescription className="text-[12px]" style={{ color: 'var(--text-3)' }}>{card.summary}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="flex flex-col gap-3 p-0">
          {card.blocks.map((b, i) => <Block key={i} block={b} />)}
        </CardContent>
      </Card>
    </motion.div>
  )
}
