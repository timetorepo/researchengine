// dqnamo-style card table: you play blackjack against the AI. Opened from a
// ```blackjack fence in any AI message. The AI plays its hand by a fixed
// strategy (hit on 16 or less) once you stand.
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { freshDeck, handTotal, aiShouldHit, outcome, type Card } from './blackjack'

function CardFace({ card, hidden = false, index = 0 }: { card: Card; hidden?: boolean; index?: number }) {
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <motion.div
      initial={{ opacity: 0, y: -18, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, rotateY: hidden ? 180 : 0 }}
      transition={{ delay: index * 0.12, duration: 0.35 }}
      style={{ transformStyle: 'preserve-3d', width: 56, height: 80 }}
      className="relative rounded-[8px]"
    >
      <div className="absolute inset-0 rounded-[8px] grid place-items-center text-[18px] font-semibold"
        style={{ background: '#fff', color: red ? '#c2410c' : '#111', border: '1px solid #d4d4d8', backfaceVisibility: 'hidden' }}>
        <span className="leading-none">{card.rank}<span className="block text-[14px]">{card.suit}</span></span>
      </div>
      <div className="absolute inset-0 rounded-[8px]"
        style={{ background: 'repeating-linear-gradient(45deg, var(--primary) 0 6px, color-mix(in srgb, var(--primary) 60%, #000) 6px 12px)', transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }} />
    </motion.div>
  )
}

export function Blackjack() {
  const [deck, setDeck] = useState<Card[]>(() => freshDeck())
  const [player, setPlayer] = useState<Card[]>([])
  const [ai, setAi] = useState<Card[]>([])
  const [stood, setStood] = useState(false)
  const [result, setResult] = useState<'player' | 'ai' | 'push' | null>(null)
  const [round, setRound] = useState(0)
  const [wins, setWins] = useState({ player: 0, ai: 0 })

  const deal = () => {
    const d = [...deck]
    const p = [d.pop()!, d.pop()!]
    const a = [d.pop()!, d.pop()!]
    setDeck(d.length < 12 ? freshDeck() : d)
    setPlayer(p); setAi(a); setStood(false); setResult(null); setRound((r) => r + 1)
  }

  const playerTotal = handTotal(player)
  const busted = player.length > 0 && playerTotal > 21

  const settle = (p: Card[], a: Card[]) => {
    const r = outcome(p, a)
    setResult(r)
    if (r !== 'push') setWins((w) => ({ ...w, [r]: w[r] + 1 }))
  }

  const hit = () => {
    if (!player.length || stood || result) return
    const d = [...deck]
    const next = [...player, d.pop()!]
    setDeck(d)
    setPlayer(next)
    if (handTotal(next) > 21) settle(next, ai)
  }

  const stand = () => {
    if (!player.length || stood || result) return
    setStood(true)
    const d = [...deck]
    const a = [...ai]
    while (aiShouldHit(a)) a.push(d.pop()!)
    setDeck(d)
    setAi(a)
    settle(player, a)
  }

  const status = useMemo(() => {
    if (!player.length) return 'Deal to start a round.'
    if (result === 'player') return 'You win this round.'
    if (result === 'ai') return busted ? 'Bust. The AI takes it.' : 'The AI wins this round.'
    if (result === 'push') return 'Push. Nobody wins.'
    return 'Hit or stand?'
  }, [player.length, result, busted])

  return (
    <div className="rounded-[18px] p-4 my-2 max-w-lg" style={{ background: 'color-mix(in srgb, var(--surface) 92%, #0b5d3b 8%)', border: '1px solid var(--surface-border)' }}>
      <div className="flex items-center justify-between text-[11.5px] mb-3" style={{ color: 'var(--text-2)' }}>
        <span>Blackjack · round {round || '–'}</span>
        <span>You {wins.player} · AI {wins.ai}</span>
      </div>
      <div className="mb-1 text-[11px]" style={{ color: 'var(--text-3)' }}>AI {ai.length ? `· ${stood || result ? handTotal(ai) : '?'}` : ''}</div>
      <div className="flex gap-2 min-h-[80px]" aria-label="AI hand">
        <AnimatePresence>
          {ai.map((c, i) => <CardFace key={`a${round}-${i}`} card={c} hidden={!stood && !result && i === 1} index={i} />)}
        </AnimatePresence>
      </div>
      <div className="mt-4 mb-1 text-[11px]" style={{ color: 'var(--text-3)' }}>You {player.length ? `· ${playerTotal}` : ''}</div>
      <div className="flex gap-2 min-h-[80px]" aria-label="Your hand">
        <AnimatePresence>
          {player.map((c, i) => <CardFace key={`p${round}-${i}`} card={c} index={i} />)}
        </AnimatePresence>
      </div>
      <p className="mt-3 text-[12.5px]" role="status" style={{ color: 'var(--text)' }}>{status}</p>
      <div className="mt-3 flex gap-2">
        {!player.length || result ? (
          <button type="button" onClick={deal} className="px-3 py-1.5 rounded-[10px] text-[12.5px] font-medium"
            style={{ background: 'var(--primary)', color: 'var(--on-primary, #fff)' }}>{round ? 'Deal again' : 'Deal'}</button>
        ) : (
          <>
            <button type="button" onClick={hit} className="px-3 py-1.5 rounded-[10px] text-[12.5px] font-medium"
              style={{ background: 'var(--primary)', color: 'var(--on-primary, #fff)' }}>Hit</button>
            <button type="button" onClick={stand} className="px-3 py-1.5 rounded-[10px] text-[12.5px]"
              style={{ border: '1px solid var(--surface-border)', color: 'var(--text)' }}>Stand</button>
          </>
        )}
      </div>
    </div>
  )
}
