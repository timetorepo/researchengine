import { Popover } from '@base-ui/react/popover'
import type { ReactNode } from 'react'
/** Accessible original adapter for the public BoardUI popover anatomy. */
export function BoardPopover({ label, trigger, children }: { label: string; trigger: ReactNode; children: ReactNode }) {
  return <Popover.Root><Popover.Trigger className="bui-button" aria-label={label}>{trigger}</Popover.Trigger>
    <Popover.Portal><Popover.Positioner sideOffset={8} className="z-[210]"><Popover.Popup className="bui-popover" aria-label={label}>
      {children}
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>
}
