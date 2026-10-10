import { motion, useReducedMotion } from 'motion/react'
import { FileText, FolderOpen, Maximize2, Search, Tag } from 'lucide-react'
import FolderReveal from '@/components/smoothui/folder-reveal'
import { ImagesBadge } from '@/components/aceternity/ImagesBadge'
import { Eyebrow } from '@/components/site/Section'
import { useGallery } from '@/components/site/ScreenshotGallery'
import { SCREENS } from '@/data/screens'

const FILE_TYPES = [
  { id: 'pdf', label: 'PDF', hint: 'papers, reports', color: '#fb7185' },
  { id: 'docx', label: 'DOCX', hint: 'Word documents', color: '#5b8cff' },
  { id: 'md', label: 'MD', hint: 'Markdown, vaults', color: '#a78bfa' },
  { id: 'txt', label: 'TXT', hint: 'text, transcripts', color: '#4ade80' },
]

/**
 * "Bring your own material", with two components doing the two halves of the
 * story: SmoothUI's folder-reveal for the files you drop in, and Aceternity's
 * images-badge for the attachments on a question — the same badge the chat uses.
 */
export function LibrarySection() {
  const { open } = useGallery()
  const reduced = useReducedMotion()
  return (
    <section className="site-section scroll-mt-24" id="library">
      <div className="site-shell grid items-center gap-14 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, margin: '-60px' }}
          whileInView={{ opacity: 1 }}
        >
          <Eyebrow>Your library</Eyebrow>
          <h2 className="text-[clamp(1.75rem,4vw,2.6rem)] leading-[1.1] font-semibold">
            Bring your own material. It stays yours.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)]">
            Drop in the documents you are actually working from and they join the library: searchable, taggable, and
            quotable in an answer. Search a query once and it looks in your files, in Wikipedia and through the app's own
            search ladder, labelling each source instead of blending them.
          </p>

          <ul className="mt-8 space-y-4">
            <li className="flex gap-3">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-[#c4b5fd]" />
              <p className="text-[14px] leading-relaxed text-[var(--text-2)]">
                <b className="font-medium text-foreground">One query, every shelf.</b> Your documents and saved pages
                come back first, while the web sources keep working in the background and report what they found.
              </p>
            </li>
            <li className="flex gap-3">
              <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#c4b5fd]" />
              <p className="text-[14px] leading-relaxed text-[var(--text-2)]">
                <b className="font-medium text-foreground">Folders and tags.</b> Keep a reading list per project, and let
                a tag or an RSS feed drive what the app recommends to you next.
              </p>
            </li>
            <li className="flex gap-3">
              <Tag className="mt-0.5 h-4 w-4 shrink-0 text-[#c4b5fd]" />
              <p className="text-[14px] leading-relaxed text-[var(--text-2)]">
                <b className="font-medium text-foreground">Attach anything to a question.</b> Images for models that can
                see, documents to read, or files from your computer as context.
              </p>
            </li>
          </ul>

          {/* The folder of attachments. Clicking it opens every screenshot of the
              app, full size, in the carousel — which is what a folder of pictures
              should do when someone clicks it. */}
          <button
            aria-label={`Open the ${SCREENS.length} screenshots of Research Engine`}
            className="panel mt-8 flex w-full cursor-pointer items-center gap-4 p-4 text-left transition-colors hover:border-[rgba(124,92,255,0.4)]"
            onClick={() => open(0)}
            type="button"
          >
            <div className="shrink-0">
              <ImagesBadge
                folderSize={{ width: 44, height: 33 }}
                hoverImageSize={{ width: 82, height: 56 }}
                hoverSpread={28}
                /* The badge fans three pictures by design (it caps at three);
                   the label names the folder rather than a number it cannot
                   show, and the line beside it says how many there are. */
                images={SCREENS.map((screen) => screen.src)}
                text="Screenshots"
              />
            </div>
            <span className="text-[13px] leading-relaxed text-[var(--text-3)]">
              Every screen of the app, in one folder: {SCREENS.length} of them. Hover to peek, click to open
              them all full size.
              <span className="mt-1 flex items-center gap-1.5 text-[var(--text-2)]">
                <Maximize2 className="h-3 w-3" /> Open the gallery
              </span>
            </span>
          </button>
        </motion.div>

        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: reduced ? 0 : 0.08 }}
          viewport={{ once: true, margin: '-60px' }}
          whileInView={{ opacity: 1 }}
        >
          {/* Four cards have to be readable at once when the folder opens, so the
              fan is sized to fit them rather than to look impressive: the cards
              are 0.6 of the folder's width by design, and the spread times the
              outer offsets (1.5 each side) plus one card is the width of the fan.
              With these numbers the fan is about 300px, which fits the column on
              a phone as well as on a desktop. */}
          <FolderReveal
            color="brand"
            items={FILE_TYPES.map((file) => ({
              id: file.id,
              color: `color-mix(in srgb, ${file.color} 22%, #0b0913)`,
              content: (
                <div className="flex h-full flex-col justify-between p-2.5">
                  <FileText className="h-4 w-4" style={{ color: file.color }} />
                  <div>
                    <div className="text-[14px] font-semibold" style={{ color: file.color }}>
                      {file.label}
                    </div>
                    <div className="text-[10.5px] leading-tight text-[var(--text-2)]">{file.hint}</div>
                  </div>
                </div>
              ),
            }))}
            label="Your documents"
            rotation={4}
            size={260}
            spread={48}
            trigger="click"
          />
          <p className="mt-6 max-w-sm text-center text-[13px] leading-relaxed text-[var(--text-3)]">
            Open the folder and all four are there at once. Every one of them becomes a reading view you can highlight, a
            summary, and a quiz with the questions taken from the text itself.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
