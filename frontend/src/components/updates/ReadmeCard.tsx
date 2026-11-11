/**
 * The project README for the release being offered, read inside the update card.
 *
 * The text is read by the server (the repository may be private, and the token
 * must not reach the page). The update card asks for it as soon as a release is
 * found, so by the time someone presses "Read more" it is already here.
 */
import React, { Suspense, useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Loader2, RotateCw, TriangleAlert } from 'lucide-react'

const Markdown = React.lazy(() => import('@/components/chat/Markdown').then((m) => ({ default: m.Markdown })))

export interface ReadmeText {
  version: string
  tag: string
  markdown: string
  url: string
  fetchedAt: number
}

/** One request per version for the life of the page; a failure is forgotten so it can be retried. */
const memo = new Map<string, Promise<ReadmeText>>()

export function loadReadme(version: string): Promise<ReadmeText> {
  const hit = memo.get(version)
  if (hit) return hit
  const p = fetch(`/api/update/readme?version=${encodeURIComponent(version)}`)
    .then(async (r) => {
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`)
      return body as ReadmeText
    })
  memo.set(version, p)
  p.catch(() => memo.delete(version))
  return p
}

/** Start reading in the background. Never throws. */
export function prefetchReadme(version: string): void {
  void loadReadme(version).catch(() => {})
}

/**
 * The expanded reading view. It keeps to a comfortable measure (about 62
 * characters a line) and a calm size, so it reads like a page rather than a
 * log. Scrolls inside itself; the card around it stays a fixed height.
 */
export function ReadmeCard({ version, onBack }: { version: string; onBack: () => void }) {
  const [data, setData] = useState<ReadmeText | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setError(null)
    loadReadme(version)
      .then((d) => { if (live) setData(d) })
      .catch((e) => { if (live) setError(String(e?.message ?? e)) })
    return () => { live = false }
  }, [version, attempt])

  return (
    <div className="flex flex-col min-h-0" data-readme-card>
      <div className="flex items-center gap-2 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12.5px] font-medium hover:bg-[var(--elevated)]"
          style={{ color: 'var(--primary)' }}
        >
          <ArrowLeft size={14} strokeWidth={2.2} /> Back
        </button>
        <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>
          README{data?.tag ? ` · ${data.tag}` : ''}
        </span>
        <span className="flex-1" />
        {data?.url && (
          <a href={data.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            <ExternalLink size={11} /> GitHub
          </a>
        )}
      </div>

      <div className="px-5 py-4 overflow-y-auto pane-scroll" style={{ maxHeight: '46vh' }}>
        {!data && !error && <ReadmeSkeleton />}

        {error && (
          <div className="flex items-start gap-3 text-[13px]" style={{ color: 'var(--text-2)' }}>
            <TriangleAlert size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
            <div className="flex-1">
              <div className="font-medium" style={{ color: 'var(--text)' }}>The README could not be read.</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{error}</div>
              <button onClick={() => setAttempt((n) => n + 1)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
                style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                <RotateCw size={12} /> Try again
              </button>
            </div>
          </div>
        )}

        {data && (
          <article
            className="readme-read"
            style={{ maxWidth: '62ch', fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}
          >
            <Suspense fallback={<pre className="whitespace-pre-wrap font-sans">{data.markdown}</pre>}>
              <Markdown content={data.markdown} />
            </Suspense>
          </article>
        )}
      </div>
    </div>
  )
}

function ReadmeSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading the README">
      <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
        <Loader2 size={13} className="animate-spin" /> Reading the README from the release…
      </div>
      {[92, 84, 96, 70, 88].map((w, i) => (
        <div key={i} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, background: 'var(--elevated)' }} />
      ))}
    </div>
  )
}
