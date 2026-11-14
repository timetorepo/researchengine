import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

/** BoardUI layout adaptation with Base UI owning modality, focus and dismissal. */
export function BoardOverlay({ open, onClose, title, children, drawer = false, header }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean; header?: ReactNode
}) {
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value) onClose() }}>
    <Dialog.Portal><Dialog.Backdrop className="bui-backdrop" />
      <Dialog.Popup className={`bui-dialog${drawer ? ' bui-drawer' : ''}`}>
        <header className="bui-dialog-header"><Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>{header}
          <Dialog.Close className="bui-icon-button" aria-label={`Close ${title.toLowerCase()}`}><X size={18} /></Dialog.Close>
        </header>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
