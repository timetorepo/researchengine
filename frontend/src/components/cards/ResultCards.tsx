/**
 * Renders tool results as cards in the chat.
 *
 * One card per tool call, drawn from its catalog entry: the app's accent and
 * icon, the headline, the status, and a body that suits the family of thing it
 * is (tracks with cover art, mail as a message list, an event with its date,
 * a receipt for a create, metrics as tiles, and so on). Raw output is never
 * drawn: the body only shows what the payload kept.
 */
import { motion } from 'motion/react'
import {
  Activity, BookOpen, Calendar, Cloud, CreditCard, Database, Eye, File, FileText, Folder, GitBranch,
  Globe, Headphones, Image as ImageIcon, Inbox, List, Mail, Megaphone, Mic, MessageSquare, MapPin,
  Music, Package, PenLine, Plug, Search, Send, Share2, ShieldCheck, ShoppingCart, Sheet, SquareCheck,
  Terminal, User, Video, Wrench, CheckCircle2, XCircle, Pencil, ExternalLink, Shield, Plus, Check,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import type { CardItem, CardPayload } from '@/lib/cards/types'

const ICONS: Record<string, LucideIcon> = {
  music: Music, video: Video, mail: Mail, message: MessageSquare, user: User, calendar: Calendar,
  folder: Folder, git: GitBranch, check: SquareCheck, page: FileText, cart: ShoppingCart, map: MapPin,
  chart: BarChart3, globe: Globe, search: Search, book: BookOpen, terminal: Terminal, image: ImageIcon,
  mic: Mic, share: Share2, database: Database, cloud: Cloud, megaphone: Megaphone, sheet: Sheet,
  card: CreditCard, pen: PenLine, send: Send, list: List, file: File, inbox: Inbox, plug: Plug,
  wrench: Wrench, shield: ShieldCheck, package: Package, edit: Pencil, eye: Eye, headphones: Headphones,
  plus: Plus,
}

export const iconFor = (name: string): LucideIcon => ICONS[name] ?? Activity

/** The brand tile at the top of every card. */
function Mark({ accent, icon }: { accent: string; icon: string }) {
  const Icon = iconFor(icon)
  return (
    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
      style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}>
      <Icon size={15} strokeWidth={1.8} aria-hidden />
    </span>
  )
}

/** A cover image that falls back to the app's icon when missing or broken. */
function Cover({ src, accent, icon, round = false }: { src?: string; accent: string; icon: string; round?: boolean }) {
  const Icon = iconFor(icon)
  const box = `w-10 h-10 shrink-0 overflow-hidden flex items-center justify-center ${round ? 'rounded-full' : 'rounded-[8px]'}`
  if (src) {
    return (
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" width={40} height={40}
        className={`${box} object-cover`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
    )
  }
  return (
    <span className={box} style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }} aria-hidden>
      <Icon size={16} strokeWidth={1.7} />
    </span>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0] ?? '').join('').toUpperCase() || '•'
}

/** One row of a card, drawn for its family. */
function Row({ card, item, i }: { card: CardPayload; item: CardItem; i: number }) {
  const external = item.href
  const body = (
    <>
      {card.family === 'person' ? (
        item.image
          ? <Cover src={item.image} accent={card.accent} icon={card.icon} round />
          : <span className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[12px] font-semibold"
              style={{ background: `color-mix(in srgb, ${card.accent} 16%, transparent)`, color: card.accent }}>{initials(item.title)}</span>
      ) : card.family === 'track' || card.family === 'media' ? (
        <Cover src={item.image} accent={card.accent} icon={card.icon} />
      ) : card.family === 'event' ? (
        <span className="w-10 h-10 rounded-[8px] shrink-0 flex items-center justify-center" style={{ background: `color-mix(in srgb, ${card.accent} 14%, transparent)`, color: card.accent }}>
          <Calendar size={15} strokeWidth={1.7} aria-hidden />
        </span>
      ) : card.family === 'task' ? (
        <span className="w-5 h-5 mt-0.5 rounded-[6px] border shrink-0" style={{ borderColor: card.accent }} aria-hidden />
      ) : (
        <Cover accent={card.accent} icon={card.icon} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium truncate" title={item.title}>{item.title}</span>
        {item.subtitle && <span className="block text-[11px] truncate" style={{ color: 'var(--text-2)' }}>{item.subtitle}</span>}
        {item.meta && card.family !== 'track' && card.family !== 'media' && (
          <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{item.meta}</span>
        )}
      </span>
      {(card.family === 'track' || card.family === 'media') && item.meta && (
        <span className="text-[10.5px] tabular-nums shrink-0" style={{ color: 'var(--text-3)' }}>{item.meta}</span>
      )}
      {external && <ExternalLink size={12} aria-hidden className="shrink-0 opacity-50" />}
    </>
  )
  const cls = 'flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] min-w-0 transition-colors hover:bg-[var(--surface)]'
  return (
    <motion.li initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(i, 6) * 0.03 }}>
      {external ? (
        <a href={external} target="_blank" rel="noopener noreferrer" className={cls} aria-label={`${item.title} — open in ${card.appName}`}>{body}</a>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.li>
  )
}

/** Metric tiles for sheets, reports and receipts. */
function Fields({ card }: { card: CardPayload }) {
  if (!card.fields.length) return null
  const metric = card.family === 'metric'
  return (
    <dl className={metric ? 'grid grid-cols-2 gap-1.5 mt-2' : 'grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 mt-2'}>
      {card.fields.map((f) => metric ? (
        <div key={f.label} className="rounded-[10px] px-2.5 py-2 min-w-0" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <dt className="text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{f.label}</dt>
          <dd className="text-[15px] font-semibold tabular-nums truncate" title={f.value}>{f.value}</dd>
        </div>
      ) : (
        <div key={f.label} className="contents">
          <dt className="text-[11px]" style={{ color: 'var(--text-3)' }}>{f.label}</dt>
          <dd className="text-[12px] min-w-0 truncate" title={f.value}>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The card itself. Empty, failed and receipt cards get their own look. */
export function ResultCard({ card }: { card: CardPayload }) {
  const Icon = iconFor(card.icon)
  const failed = card.status === 'error'
  const receipt = card.kind === 'create' || card.kind === 'send' || card.kind === 'update' || card.kind === 'delete'
  const count = card.items.length
  const first = card.items[0]
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`${card.headline} — ${card.appName}`}
      className="rounded-[16px] p-3 min-w-0 max-w-[560px]"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${card.accent} 12%, transparent), transparent 55%), var(--elevated)`,
        border: `1px solid color-mix(in srgb, ${card.accent} ${failed ? '45%' : '22%'}, var(--surface-border))`,
      }}
    >
      <header className="flex items-center gap-2.5 mb-2">
        <Mark accent={card.accent} icon={card.icon} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider truncate" style={{ color: card.accent }}>{card.appName}</div>
          <div className="text-[13px] font-semibold truncate">{card.headline}</div>
        </div>
        <StatusPill status={card.status} total={card.total} count={count} />
      </header>

      {failed ? (
        <div className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--danger)' }}>
          <XCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0 break-words">{card.summary}</span>
        </div>
      ) : receipt ? (
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${card.accent} 18%, transparent)`, color: card.accent }}>
            {card.kind === 'delete' ? <Check size={15} /> : <CheckCircle2 size={15} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>{card.summary}</p>
            {first && (
              <div className="mt-1 text-[12.5px] font-medium truncate">{first.title}</div>
            )}
            <Fields card={card} />
          </div>
        </div>
      ) : (
        <>
          {count > 0 && (
            <ul className="flex flex-col gap-0.5" aria-label={`${card.headline} results`}>
              {card.items.map((it, i) => <Row key={`${i}-${it.title}`} card={card} item={it} i={i} />)}
            </ul>
          )}
          {count === 0 && card.fields.length === 0 && (
            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>{card.summary}</p>
          )}
          {count === 0 && card.fields.length > 0 && <p className="text-[12px] mb-1" style={{ color: 'var(--text-2)' }}>{card.summary}</p>}
          <Fields card={card} />
        </>
      )}

      {!failed && first?.href && card.family !== 'track' && card.family !== 'media' && (
        <footer className="mt-2 pt-2 border-t flex items-center gap-1.5 text-[11px]" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-3)' }}>
          <Icon size={11} aria-hidden /> Open in {card.appName}
        </footer>
      )}
    </motion.article>
  )
}

function StatusPill({ status, total, count }: { status: CardPayload['status']; total?: number; count: number }) {
  const label = status === 'error' ? 'Failed' : status === 'empty' ? 'No match' : total != null && total > count ? `${count} of ${total}` : count > 0 ? `${count}` : 'Done'
  const tone = status === 'error' ? 'var(--danger)' : status === 'empty' ? 'var(--text-3)' : 'var(--text-2)'
  return (
    <span className="px-2 py-0.5 rounded-full text-[10.5px] tabular-nums shrink-0 inline-flex items-center gap-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: tone }}>
      {status === 'error' && <XCircle size={10} aria-hidden />}
      {label}
    </span>
  )
}

/** The cards for one message, under its answer. */
export function ResultCards({ cards }: { cards?: CardPayload[] }) {
  if (!cards?.length) return null
  return (
    <div className="flex flex-col gap-2 my-2.5" aria-label="Tool results">
      {cards.map((c, i) => <ResultCard key={`${c.specId}-${c.createdAt}-${i}`} card={c} />)}
    </div>
  )
}
