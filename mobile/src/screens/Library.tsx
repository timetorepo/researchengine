// Screen: Library. Job: find anything you already have. Spec:
// docs/mobile/screens/library.md. The lanes below match the four store
// collections that exist on desktop (documents, citations, knowledge, spaces);
// local querying arrives with re-core in R2, so today every lane shows an
// honest empty state rather than a fake list.
import React, { useMemo, useState } from 'react'
import { SearchField, EmptyState, SkeletonRow } from '../components/base'
import { JobRow } from '../components/cards'

const LANES = ['Documents', 'Citations', 'Knowledge', 'Notebooks'] as const

export function Library() {
  const [q, setQ] = useState('')
  const [indexing] = useState<{ progress: number } | null>(null)
  const hits = useMemo(() => ({ Documents: 0, Citations: 0, Knowledge: 0, Notebooks: 0 }), [])
  return (
    <div className="screen">
      <SearchField value={q} onChange={setQ} placeholder="Search your library (local)" />
      <div data-c="LaneRow" className="lanes" role="status">
        {LANES.map((l) => (
          <span key={l} className={`lane ${q ? '' : 'lane-dim'}`}>{l} {q ? `· ${hits[l as keyof typeof hits]}` : ''}</span>
        ))}
      </div>
      {indexing && <JobRow name="Indexing your documents" state="running" progress={indexing.progress} />}
      {q === '' && (
        <EmptyState
          title="Your library is where everything you read lands."
          body="Add a file, or start a chat and save sources into it."
        />
      )}
      {q !== '' && (
        <div className="list" aria-label="Search results">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}
      {q !== '' && (
        <p className="callout muted">Local results paint here within one frame once the index ships (R2). Until then this screen shows its empty states.</p>
      )}
    </div>
  )
}
