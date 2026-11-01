/**
 * Release notes, rendered where you are.
 *
 * The notes are the release body from GitHub — markdown — and until now the app
 * offered exactly one way to read them: a link to `html_url`. On a repository
 * that is still private that link is a 404 for anyone without a session, so
 * "Release notes" looked broken even though the text was sitting right there in
 * the check result the whole time.
 *
 * So the body is rendered inline. The chat's markdown renderer does the work
 * (headings, lists, code, links, tables), loaded on demand: release notes are not
 * worth a kilobyte of the first paint, and the fallback until it arrives is the
 * text itself.
 */
import React, { Suspense } from 'react'

const Markdown = React.lazy(() => import('@/components/chat/Markdown').then((m) => ({ default: m.Markdown })))

/** Release bodies are markdown, but some are written as plain text with * and -. */
export function ReleaseNotes({ notes, className }: { notes: string; className?: string }) {
  const text = (notes ?? '').trim()
  if (!text) {
    return (
      <p className={className} style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
        This release came without notes. The version number is the news.
      </p>
    )
  }
  return (
    <div className={className} data-release-notes>
      <Suspense
        fallback={
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {text}
          </pre>
        }
      >
        <Markdown content={text} />
      </Suspense>
    </div>
  )
}
