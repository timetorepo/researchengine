import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { ACHIEVEMENTS, LOYALTY_MS, addUsage, awardCard } from '@/lib/wallet/cards'
import type { WalletCard } from '@/lib/wallet/types'
import { LoyaltyCutscene } from './LoyaltyCutscene'

const TICK_MS = 15_000
/** Dispatched by Developer Mode to play the cutscene without awarding anything. */
export const PREVIEW_EVENT = 'researchengine:loyalty-cutscene-preview'

/**
 * Counts the time the app is open and in front of you, and when the loyalty
 * threshold is reached, awards the card and plays the cutscene once. It is
 * mounted once, at the root, and renders nothing otherwise.
 */
export function WalletWatcher() {
  const usage = useStore((s) => s.wallet.usageMs)
  const earned = useStore((s) => s.wallet.earned.includes('loyalty'))
  const loyaltyCard = useStore((s) => s.wallet.cards.find((c) => c.achievementId === 'loyalty')) ?? null
  const [playing, setPlaying] = useState<{ card: WalletCard; preview: boolean } | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') addUsage(TICK_MS)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (earned || usage < LOYALTY_MS) return
    awardCard('loyalty')
  }, [usage, earned])

  useEffect(() => {
    const onPreview = () => {
      const a = ACHIEVEMENTS.loyalty
      setPlaying({
        preview: true,
        card: loyaltyCard ?? { id: 'preview', kind: 'loyalty', title: a.title, subtitle: a.subtitle, fields: [], style: a.style },
      })
    }
    window.addEventListener(PREVIEW_EVENT, onPreview)
    return () => window.removeEventListener(PREVIEW_EVENT, onPreview)
  }, [loyaltyCard])

  // The real cutscene plays only when the card is earned during this session.
  // A card earned on an earlier day is already in the wallet, so no replay.
  const earnedAtMount = useRef(earned)
  const shownReal = useRef(false)
  useEffect(() => {
    if (earned && loyaltyCard && !earnedAtMount.current && !shownReal.current) {
      shownReal.current = true
      setPlaying({ card: loyaltyCard, preview: false })
    }
  }, [earned, loyaltyCard])

  const done = useCallback(() => setPlaying(null), [])
  if (!playing) return null
  return <LoyaltyCutscene card={playing.card} preview={playing.preview} onDone={done} />
}
