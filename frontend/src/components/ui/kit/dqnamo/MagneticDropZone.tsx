// dqnamo-style magnetic drop zone: the border and icon pull toward the cursor.
// Drop or pick files; accepted files are passed to onFiles.
import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { UploadCloud } from 'lucide-react'

export function MagneticDropZone({ accept, onFiles, label = 'Drop files here', hint, multiple = false }: {
  accept: string; onFiles: (files: File[]) => void; label?: string; hint?: string; multiple?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0), my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 220, damping: 16 })
  const y = useSpring(my, { stiffness: 220, damping: 16 })
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    mx.set((e.clientX - (r.left + r.width / 2)) * 0.08)
    my.set((e.clientY - (r.top + r.height / 2)) * 0.12)
  }
  const reset = () => { mx.set(0); my.set(0); setOver(false) }
  const take = (list: FileList | null) => {
    if (!list) return
    const wanted = accept.split(',').map((s) => s.trim().toLowerCase())
    const files = Array.from(list).filter((f) => wanted.some((w) => w.startsWith('.') ? f.name.toLowerCase().endsWith(w) : f.type === w || (w.endsWith('/*') && f.type.startsWith(w.slice(0, -1)))))
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <motion.div ref={ref} onPointerMove={onMove} onPointerLeave={reset}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files); setOver(false) }}
      onClick={() => input.current?.click()} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click() } }}
      className="rounded-[18px] p-6 text-center cursor-pointer select-none"
      data-over={over || undefined}
      style={{ x, y, border: `1.5px dashed ${over ? 'var(--primary)' : 'var(--surface-border)'}`, background: over ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'var(--surface)' }}>
      <UploadCloud size={26} aria-hidden className="mx-auto mb-2" style={{ color: 'var(--primary)' }} />
      <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      {hint && <div className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>{hint}</div>}
      <input ref={input} type="file" accept={accept} multiple={multiple} className="hidden" aria-label={label}
        onChange={(e) => { take(e.target.files); e.currentTarget.value = '' }} />
    </motion.div>
  )
}
