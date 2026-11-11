// dqnamo-style receipt printer: a receipt slides out of the slot line by line.
// "Print" opens a clean print view of the same receipt.
import { motion } from 'motion/react'

export type ReceiptLine = { label: string; value: string }

export function printReceipt(title: string, lines: ReceiptLine[], footer: string) {
  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) return
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const rows = lines.map((l) => `<tr><td>${esc(l.label)}</td><td style="text-align:right">${esc(l.value)}</td></tr>`).join('')
  w.document.write(`<!doctype html><title>${esc(title)}</title><style>body{font:12px ui-monospace,monospace;padding:16px;width:300px}table{width:100%;border-collapse:collapse}td{padding:3px 0}hr{border:0;border-top:1px dashed #000}h1{font-size:14px;text-align:center}</style><h1>${esc(title)}</h1><hr><table>${rows}</table><hr><p style="text-align:center">${esc(footer)}</p>`)
  w.document.close()
  w.focus()
  w.print()
}

export function ReceiptPrinter({ title, lines, footer = 'Thank you for researching.' }: {
  title: string; lines: ReceiptLine[]; footer?: string
}) {
  return (
    <div className="relative rounded-[14px] overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="h-2" style={{ background: 'var(--elevated)', borderBottom: '1px solid var(--surface-border)' }} aria-hidden />
      <motion.div initial={{ y: -220 }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
        className="mx-auto mt-[-4px] w-[88%] p-4 font-mono text-[11.5px]"
        style={{ background: '#fbfaf6', color: '#111', boxShadow: '0 6px 14px -8px rgba(0,0,0,0.45)' }}>
        <div className="text-center font-semibold mb-2">{title}</div>
        <div className="border-t border-dashed border-black/60 pt-2 space-y-1">
          {lines.map((l) => (
            <motion.div key={l.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex justify-between gap-3">
              <span>{l.label}</span><span className="tabular-nums">{l.value}</span>
            </motion.div>
          ))}
        </div>
        <div className="border-t border-dashed border-black/60 mt-2 pt-2 text-center">{footer}</div>
      </motion.div>
      <div className="flex justify-end p-2">
        <button type="button" onClick={() => printReceipt(title, lines, footer)}
          className="text-[11.5px] px-2.5 py-1 rounded-[8px]" style={{ border: '1px solid var(--surface-border)', color: 'var(--text)' }}>Print receipt</button>
      </div>
    </div>
  )
}
