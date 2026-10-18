/**
 * The popup player for a YouTube video. Clicking a video anywhere in the app
 * opens this, and it plays inside Research Engine from YouTube's privacy
 * embed (youtube-nocookie.com), so no cookies are set until the video is
 * started. The link out to YouTube stays in the footer.
 */
import type { ReactNode } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal'
import { ExternalLink } from 'lucide-react'

export function VideoPlayerModal({ ytId, title, channel, startAt = 0, onClose, children, footer }: {
  ytId: string | null
  title: string
  channel?: string
  startAt?: number
  onClose: () => void
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <Modal
      isOpen={!!ytId}
      onOpenChange={(v) => { if (!v) onClose() }}
      size="3xl"
      backdrop="blur"
      scrollBehavior="inside"
      placement="center"
      isDismissable
      classNames={{
        wrapper: 'z-[80]',
        backdrop: 'z-[79] bg-[var(--scrim)]',
        base: 'glass overflow-hidden border border-[var(--surface-border)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)]',
        header: 'px-5 pt-5 pb-3 border-b border-[var(--surface-border)]',
        body: 'px-5 py-4 space-y-4',
        footer: 'px-5 py-3 border-t border-[var(--surface-border)] justify-between',
        closeButton: 'top-4 right-4 text-[var(--text-3)] hover:bg-[var(--elevated)]',
      }}
      aria-label={title}
      data-video-player
    >
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-0.5 pr-10">
          <span className="text-[15px] font-semibold leading-snug" style={{ letterSpacing: '-0.01em' }}>{title}</span>
          {channel && <span className="text-[11.5px] font-normal" style={{ color: 'var(--text-3)' }}>{channel}</span>}
        </ModalHeader>
        <ModalBody>
          {ytId && (
            <div className="relative w-full aspect-video rounded-[14px] overflow-hidden bg-black" style={{ border: '1px solid var(--surface-border)' }}>
              <iframe
                key={`${ytId}-${startAt}`}
                src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&autoplay=1${startAt ? `&start=${startAt}` : ''}`}
                title={title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}
          {children}
        </ModalBody>
        <ModalFooter>
          {ytId ? (
            <a href={`https://www.youtube.com/watch?v=${ytId}`} target="_blank" rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[11.5px] hover:underline" style={{ color: 'var(--text-3)' }}>
              Open on YouTube <ExternalLink size={10} />
            </a>
          ) : <span />}
          <div className="flex items-center gap-2">{footer}</div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
