import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useUI } from '@/stores/useUI'

export function NotFound404() {
  const ui = useUI()

  return (
    <motion.div
      className="h-full w-full flex flex-col items-center justify-center gap-6 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="aurora" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="text-center relative z-10"
      >
        <div className="glitch font-bold select-none" data-text="404"
          style={{ fontSize: 'clamp(96px, 22vw, 220px)', letterSpacing: '-0.04em', lineHeight: 1 }}>
          404
        </div>
        <p className="text-[15px] mt-2" style={{ color: 'var(--text-2)' }}>
          This route was not found. Try another.
        </p>
        <p className="text-[11.5px] mt-1 font-mono" style={{ color: 'var(--text-3)' }}>
          research-engine · route registry · 0 matches
        </p>
        <button
          onClick={() => ui.set({ notFound: false })}
          className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium transition-transform hover:scale-105"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          <ArrowLeft size={14} /> Return
        </button>
      </motion.div>
    </motion.div>
  )
}
