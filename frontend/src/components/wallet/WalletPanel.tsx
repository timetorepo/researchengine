import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { removeCard, newCustomCard } from '@/lib/wallet/cards'
import type { WalletCard } from '@/lib/wallet/types'
import { WalletCardView } from './WalletCardView'
import { CardEditor } from './CardEditor'

/**
 * The wallet: cards stacked the way Apple Wallet stacks them. Tap one to bring
 * it forward; the rest keep their edges showing behind it. Editing opens the
 * same editor for every card, earned or your own.
 */
export function WalletPanel() {
  const cards = useStore((s) => s.wallet.cards)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<WalletCard | null>(null)
  const active = cards.find((c) => c.id === selected) ?? cards[0] ?? null

  return (
    <div>
      {cards.length === 0 ? (
        <div className="surface p-6 text-[13px]" style={{ color: 'var(--text-2)' }}>
          Your wallet is empty. Cards arrive as you use the app: finish your first quiz, or keep Research Engine open for three
          hours. You can also add your own.
          <div className="mt-4">
            <button type="button" onClick={() => setEditing(newCustomCard())}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-medium active:scale-[0.97]"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              <Plus size={12} /> Add a card
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto max-w-[360px] pb-4" style={{ height: 150 + (cards.length - 1) * 56 + 220 }}>
          <AnimatePresence initial={false}>
            {cards.map((c, i) => {
              const isActive = active?.id === c.id
              const top = i * 56
              return (
                <motion.button
                  key={c.id}
                  layout
                  type="button"
                  aria-label={`${c.title}${isActive ? ', selected' : ''}`}
                  onClick={() => setSelected(c.id)}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: isActive ? top - 10 : top, scale: isActive ? 1.02 : 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                  className="absolute inset-x-0 top-0 text-left"
                  style={{ zIndex: isActive ? 100 : i + 1 }}
                >
                  <WalletCardView title={c.title} subtitle={c.subtitle} fields={c.fields} style={c.style} />
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {active && (
        <div className="mx-auto mt-2 flex max-w-[360px] flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditing(active)} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] active:scale-[0.97]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Pencil size={12} /> Customise
          </button>
          {active.kind === 'custom' && (
            <button type="button" onClick={() => { removeCard(active.id); setSelected(null) }}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] active:scale-[0.97]" style={{ color: 'var(--text-3)' }}>
              <Trash2 size={12} /> Remove
            </button>
          )}
          <button type="button" onClick={() => { const c = newCustomCard(); setEditing(c) }}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-medium active:scale-[0.97]"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <Plus size={12} /> Add a card
          </button>
        </div>
      )}

      {editing && <CardEditor card={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
