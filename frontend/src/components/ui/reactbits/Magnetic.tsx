import React, { useRef, useState } from 'react'
import { motion } from 'motion/react'

/** ReactBits-style magnetic element — leans toward the cursor. */
export function Magnetic({
  children, strength = 0.35, className = '',
}: {
  children: React.ReactNode
  strength?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', damping: 18, stiffness: 240, mass: 0.4 }}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        setOffset({
          x: (e.clientX - (r.left + r.width / 2)) * strength,
          y: (e.clientY - (r.top + r.height / 2)) * strength,
        })
      }}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
    >
      {children}
    </motion.div>
  )
}
