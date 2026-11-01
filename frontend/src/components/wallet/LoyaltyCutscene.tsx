import { useEffect } from 'react'
import { motion } from 'motion/react'
import { WalletCardView } from './WalletCardView'
import type { WalletCard } from '@/lib/wallet/types'

/**
 * The loyalty cutscene: the screen dims, a card rises out of the dark and turns
 * face-up, and a line says thank you. It closes itself after a few seconds, or
 * at a click. Developer Mode can play it without awarding anything; `preview`
 * makes that explicit so nothing is saved.
 */
export function LoyaltyCutscene({ card, preview, onDone }: { card: WalletCard; preview: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 6500)
    return () => window.clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Loyalty card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      className="fixed inset-0 z-[120] grid cursor-pointer place-items-center px-6"
      style={{ background: 'radial-gradient(ellipse at center, rgba(20,16,40,0.92), rgba(4,4,10,0.97))' }}
    >
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ y: 260, rotateX: 60, opacity: 0, scale: 0.7 }}
          animate={{ y: 0, rotateX: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 22, stiffness: 120, delay: 0.3 }}
          className="w-[min(86vw,380px)]"
          style={{ perspective: 900 }}
        >
          <WalletCardView title={card.title} subtitle={card.subtitle} fields={card.fields} style={card.style} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.6 }} className="mt-10 max-w-[420px]">
          <div className="text-[20px] font-semibold text-white">Three hours together.</div>
          <p className="mt-2 text-[14px] leading-relaxed text-white/70">
            Thank you for keeping Research Engine open and useful. Your loyalty card is in the wallet.
          </p>
          {preview && <p className="mt-3 text-[11.5px] uppercase tracking-[0.14em] text-white/50">Preview · nothing was awarded</p>}
          <p className="mt-4 text-[11.5px] text-white/40">Click anywhere to continue</p>
        </motion.div>
      </div>
    </motion.div>
  )
}
