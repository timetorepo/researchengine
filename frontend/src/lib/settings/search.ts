import index from './search-index.json'
export const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]))
    row = next
  }
  return row[b.length]
}
export function searchSettings(query: string, tabs: { id: string; label: string }[]) {
  const entries = [...tabs.map(t => ({ label: t.label, tab: t.id })), ...index.filter(e => tabs.some(t => t.id === e.tab))]
  const q = normalize(query).slice(0, 100)
  const words = q.split(' ')
  const matches = q ? entries.filter(e => words.every(w => normalize(e.label).includes(w))) : []
  const unique = matches.filter((e, i) => matches.findIndex(x => x.tab === e.tab && x.label === e.label) === i)
  let suggestion: string | null = null
  if (q.length >= 3 && !unique.length) {
    let best = Infinity
    for (const entry of entries) {
      const label = normalize(entry.label)
      const score = Math.min(distance(q, label), ...label.split(' ').map(w => distance(q, w)))
      if (score < best && score <= Math.min(3, Math.max(1, Math.floor(q.length / 4)))) { best = score; suggestion = entry.label }
    }
  }
  return { results: unique.slice(0, 40), suggestion }
}
