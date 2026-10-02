import { motion } from 'motion/react'
import { FileText, FolderOpen, Search, Tag } from 'lucide-react'
import FolderReveal from '@/components/smoothui/folder-reveal'
import { ImagesBadge } from '@/components/aceternity/ImagesBadge'
import { Badge } from '@/components/ui/badge'

const FILE_TYPES = [
  { id: 'pdf', label: 'PDF', hint: 'papers, reports, scanned notes', color: '#fb7185' },
  { id: 'docx', label: 'DOCX', hint: 'Word documents', color: '#5b8cff' },
  { id: 'md', label: 'MD', hint: 'Markdown, Obsidian vaults', color: '#a78bfa' },
  { id: 'txt', label: 'TXT', hint: 'plain text, transcripts', color: '#4ade80' },
]

/**
 * "Bring your own material", with two components doing the two halves of the
 * story: SmoothUI's folder-reveal for the files you drop in, and Aceternity's
 * images-badge for the attachments on a question — the same badge the chat uses.
 */
export function LibrarySection() {
  return (
    <section className="site-section scroll-mt-24" id="library">
      <div className="site-shell grid items-center gap-14 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Badge className="mb-5" tone="brand">
            Your library
          </Badge>
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

          <div className="panel mt-8 flex items-center gap-4 p-4">
            <div className="shrink-0">
              <ImagesBadge
                folderSize={{ width: 40, height: 30 }}
                hoverImageSize={{ width: 74, height: 50 }}
                hoverSpread={26}
                images={['/attachments/quiz.webp', '/attachments/coding.webp', '/attachments/workflow.webp']}
                text="3 attachments"
              />
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-3)]">
              Three screenshots attached to one question, the way the chat shows them. Hover the folder.
            </p>
          </div>
        </motion.div>

        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <FolderReveal
            color="brand"
            items={FILE_TYPES.map((file) => ({
              id: file.id,
              color: file.color,
              content: (
                <div className="flex h-full flex-col justify-between p-3">
                  <FileText className="h-4 w-4" style={{ color: file.color }} />
                  <div>
                    <div className="text-[15px] font-semibold" style={{ color: file.color }}>
                      {file.label}
                    </div>
                    <div className="text-[11px] leading-tight text-[var(--text-3)]">{file.hint}</div>
                  </div>
                </div>
              ),
            }))}
            label="Your documents"
            size={230}
            trigger="click"
          />
          <p className="mt-6 max-w-xs text-center text-[13px] leading-relaxed text-[var(--text-3)]">
            Every one of these becomes a reading view you can highlight, a summary, and a quiz with the questions taken
            from the text itself.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
