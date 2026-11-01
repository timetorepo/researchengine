/**
 * Build the changelog dataset from the GitHub releases.
 *
 * The Updates tab shows every version this project has ever published, from the
 * first pre-release to the one running now. That data has to be *in* the app:
 * the repository is private, so a released build cannot ask GitHub anything
 * without a token, and a changelog that only appears when the network is up is
 * not a changelog. So the release bodies are reduced here, at build time, into a
 * structure the tab can render as a page per version instead of a wall of text.
 *
 * Reduction rules (deliberately simple and auditable):
 *   • `#`/`##`/`###` headings become sections; bullets under them become items;
 *   • the first bold paragraph or plain paragraph becomes the version's summary;
 *   • a bullet's leading bold phrase becomes its label, so a row can be scanned;
 *   • markdown emphasis and inline code are kept as text (the renderer styles
 *     them), links are flattened to their text with the URL dropped — a
 *     changelog row is not a link list;
 *   • anything longer than a paragraph is truncated at a sentence boundary.
 *
 * Usage:
 *   gh api 'repos/<owner>/<repo>/releases?per_page=40' \
 *     --jq '[.[] | {tag: .tag_name, name: .name, date: (.published_at[0:10]), url: .html_url, body: .body}]' > /tmp/releases.json
 *   node scripts/build-changelog.mjs --from /tmp/releases.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../src/lib/updates/changelog.ts')

const args = process.argv.slice(2)
const fromIdx = args.indexOf('--from')
const input = fromIdx >= 0 ? args[fromIdx + 1] : '/tmp/releases.json'
// A release with no notes has nothing for the Updates tab to show, so it is left out.
const releases = JSON.parse(readFileSync(input, 'utf8')).filter((r) => String(r.body ?? '').trim())

/** Strip the markdown a page-per-version renderer does not need. */
function clean(text) {
  return String(text ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')          // links keep their words
    .replace(/`([^`]+)`/g, '$1')                      // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')                // bold
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')          // italics
    .replace(/^\s*>\s?/gm, '')                        // quotes
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cut at a sentence end so a truncated row never stops mid-thought. */
function clamp(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…')
}

function splitLabel(bullet) {
  const m = bullet.match(/^\*\*([^*]+)\*\*[:\s—-]+(.+)$/s)
  if (m) return { label: clamp(clean(m[1]), 70), text: clamp(clean(m[2]), 240) }
  return { text: clamp(clean(bullet), 280) }
}

/**
 * "Research Engine 0.37.0-beta.1 — the search fixed, …" carries both the product
 * name and the version; the tab already prints those, so only the tail is kept.
 * Releases whose title is nothing but the version get no name at all, and the UI
 * falls back to the summary rather than inventing a headline for them.
 */
function titleOf(release, version) {
  const raw = clean(release.name || '')
  const tail = raw
    .replace(/^research\s*engine\s*/i, '')
    .replace(new RegExp(`^v?${version.replace(/\./g, '\\.')}(-[a-z0-9.]+)?\\s*[:—–-]?\\s*`, 'i'), '')
    .replace(/^v?\d+(\.\d+)+(-[a-z0-9.]+)?\s*[:—–-]?\s*/i, '')
    .trim()
  if (tail && !/^beta(?:\.\d+)?$/i.test(tail)) return tail
  // No invented headline: a release titled "Research Engine 0.29.0-beta.1" gets
  // its name from the summary in the UI, not from a sentence pulled out of the
  // middle of the body.
  return ''
}

function versionOf(tag) {
  const m = String(tag).match(/(\d+\.\d+(?:\.\d+)?)/)
  return m ? m[1] : String(tag)
}

/** The text after the dash in the first heading that names a version, if it is a real headline. */
function headlineOf(body) {
  const m = String(body ?? '').match(/^#{1,3}\s+[^\n]*?\d+\.\d+[^\n]*?[—–-]\s*([^\n]+)$/m)
  const text = m ? clean(m[1].trim()) : ''
  return text.length > 20 ? text : ''
}

/** Two prereleases of one version (0.47.0-beta.1 and 0.47.0-beta.2) keep their full tag, so each stays distinct. */
const tagCounts = {}
for (const r of releases) tagCounts[versionOf(r.tag)] = (tagCounts[versionOf(r.tag)] || 0) + 1
const versionFor = (tag) => (tagCounts[versionOf(tag)] > 1 ? String(tag).replace(/^v/, '') : versionOf(tag))

function parse(release) {
  /**
   * Bullets wrap in markdown. A continuation line has no marker of its own, so
   * it is joined onto the bullet above it *before* anything else looks at it —
   * otherwise half a sentence becomes its own entry and its bold marker is left
   * unmatched, which is how raw `**` ended up in the notes.
   */
  const rawLines = String(release.body ?? '').replace(/\r/g, '').split('\n')
  const lines = []
  for (const raw of rawLines) {
    const t = raw.trim()
    if (!t) { lines.push(''); continue }
    const prev = lines[lines.length - 1]
    const prevIsBullet = !!prev && /^(?:[-*•–—]|\d+\.)\s+/.test(prev)
    const ownMarker = /^#{1,4}\s/.test(t) || /^(?:[-*•–—]|\d+\.)\s+/.test(t) || /^\*\*[^*]+\*\*/.test(t)
    if (prevIsBullet && !ownMarker && !/^```/.test(t)) { lines[lines.length - 1] = `${prev} ${t}`; continue }
    lines.push(t)
  }
  const sections = []
  let current = null
  let summary = ''
  const push = () => { if (current && current.items.length) sections.push(current) }
  let paragraph = []
  /** A run of prose: the first one is the summary, the rest are entries. */
  const flushParagraph = () => {
    if (!paragraph.length) return
    const joined = paragraph.join(' ')
    const text = clamp(clean(joined), 300)
    paragraph = []
    if (!text) return
    if (!summary) { summary = clamp(text, 260); return }
    if (text.length < 110) return
    if (!current) current = { title: 'What changed', items: [] }
    current.items.push({ text })
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { flushParagraph(); continue }
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const title = clean(heading[2])
      if (heading[1].length >= 2 && !/^research engine/i.test(title)) {   // the h1 is the product name
        push()
        current = { title: clamp(title, 80), items: [] }
      }
      continue
    }
    const bullet = trimmed.match(/^(?:[-*•–—]|\d+\.)\s+(.*)$/)
    if (bullet) {
      const item = splitLabel(bullet[1])
      if (!current) current = { title: 'In this version', items: [] }
      current.items.push(item)
      continue
    }
    // A paragraph that opens with bold text is an entry, not prose: several
    // releases are written that way (0.19.0 is entirely "**Thing.** what it
    // does"), and turning those into a section is the difference between a
    // changelog and a wall of text.
    if (/^\*\*[^*]+\*\*/.test(trimmed)) {
      flushParagraph()
      // The bold line right under the title is the release's own subtitle, not
      // an entry: it belongs above the sections, where the version card prints it.
      if (!summary && !sections.length && !(current && current.items.length)) {
        summary = clamp(clean(trimmed), 260)
        continue
      }
      const item = splitLabel(trimmed)
      if (!current) current = { title: 'What changed', items: [] }
      current.items.push(item)
      continue
    }
    paragraph.push(trimmed)
  }
  flushParagraph()
  push()
  if (paragraph.length && !summary) summary = clamp(clean(paragraph.join(' ')), 260)

  // A bullet list with no heading anywhere is still a list, not a section called
  // "In this version" full of nothing else — keep the label, drop the noise.
  const kept = sections
    .map((s) => ({ title: s.title, items: s.items.slice(0, 14).slice(0, 14) }))
    .filter((s) => s.items.length)

  return {
    version: versionFor(release.tag),
    tag: release.tag,
    name: titleOf(release, versionFor(release.tag)),
    date: release.date,
    url: release.url,
    // The release's own headline ("## 1.2.0 — <headline>") is the one-line summary when
    // it has one; a later paragraph is only a fallback, so it cannot stand in for it.
    summary: headlineOf(release.body) || summary || clean(release.name),
    sections: kept,
    counts: {
      items: kept.reduce((n, s) => n + s.items.length, 0),
      sections: kept.length,
    },
  }
}

const parsed = releases.map(parse).filter((r) => r.sections.length || r.summary)
parsed.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))

/**
 * A release whose notes are gone from GitHub (deleted, or its body emptied) keeps
 * the entry this file already has. The record only grows: the Updates tab never
 * loses a version it has shown. A tag that produced a fresh entry is not kept twice.
 */
const PREFIX = 'export const CHANGELOG: Release[] = '
let previous = []
try {
  const text = readFileSync(out, 'utf8')
  const at = text.indexOf(PREFIX)
  if (at >= 0) {
    const start = at + PREFIX.length
    previous = JSON.parse(text.slice(start, text.indexOf('\n]\n', start) + 2))
  }
} catch { previous = [] }
const freshTags = new Set(parsed.map((r) => r.tag))
const keptEntries = previous.filter((r) => r && r.tag && !freshTags.has(r.tag))
const merged = [...parsed, ...keptEntries]
merged.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
if (keptEntries.length) console.log(`kept ${keptEntries.length} entries whose notes are no longer on GitHub: ${keptEntries.map((r) => r.version).join(', ')}`)

const header = `/**
 * Every version this app has published, newest first.
 *
 * Generated by scripts/build-changelog.mjs from the GitHub release bodies, then
 * committed: a released build has no token and no network guarantee, and the
 * Updates tab has to work offline. Re-run the generator when a release is cut —
 * a version missing from this file is a version the Updates tab cannot show.
 *
 * ${merged.length} versions, ${merged[0]?.version} back to ${merged[merged.length - 1]?.version}.
 */

export type ChangeKind = 'added' | 'fixed' | 'changed' | 'polish' | 'removed'

export interface Change {
  /** The leading bold phrase of the bullet, when it had one. */
  label?: string
  text: string
}

export interface ChangeSection {
  title: string
  items: Change[]
}

export interface Release {
  version: string
  tag: string
  name: string
  date: string
  url: string
  summary: string
  sections: ChangeSection[]
  counts: { items: number; sections: number }
}

/**
 * How a section reads at a glance. This is a judgement about the section's own
 * title, not about the code: it only decides which mark the UI prints beside it.
 */
export function kindOf(title: string): ChangeKind {
  const t = title.toLowerCase()
  if (/\\bfix|bug|repair|correct|resolved|patch\\b/.test(t)) return 'fixed'
  if (/\\bremove|dropped|deprecat|delete\\b/.test(t)) return 'removed'
  if (/\\brefactor|internal|technical|chore|clean\\b/.test(t)) return 'changed'
  if (/\\bpolish|polish|motion|micro|feel|aesthetic|design\\b/.test(t)) return 'polish'
  return 'added'
}

export const CHANGELOG: Release[] = ${JSON.stringify(merged, null, 2)}

/** The version the running build is on, for the "you are here" marker. */
export function findRelease(version: string): Release | undefined {
  const clean = version.replace(/^v/, '')
  return CHANGELOG.find((r) => r.version === clean) ?? CHANGELOG.find((r) => clean.startsWith(r.version))
}

export default CHANGELOG
`

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, header, 'utf8')
const bytes = Buffer.byteLength(header, 'utf8')
console.log(`wrote ${out}`)
console.log(`${merged.length} versions, ${merged[0].version} → ${merged[merged.length - 1].version}, ${(bytes / 1024).toFixed(1)} kB`)
console.log(`first: ${merged[0].version} — ${merged[0].name} (${merged[0].sections.length} sections, ${merged[0].counts.items} items)`)
console.log(`oldest: ${merged[merged.length - 1].version} — ${merged[merged.length - 1].name}`)
