/**
 * Refresh the language logos from the simple-icons CDN (CC0).
 *
 * The repo ships a drawn, offline-safe set in public/lang-logos/. On any
 * machine with a network, this script replaces them with the real brand
 * marks, fetched once and saved to the repo — exactly the "get it from an
 * API once, keep it locally" arrangement. Run it from frontend/:
 *
 *   node scripts/vendor-lang-logos.mjs
 *
 * Failures per icon are skipped, so a partial network still improves the set.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/lang-logos')

// local id -> simple-icons slug
const SLUGS = {
  javascript: 'javascript', typescript: 'typescript', json: 'json', yaml: 'yaml',
  markdown: 'markdown', go: 'go', rust: 'rust', java: 'openjdk', kotlin: 'kotlin',
  swift: 'swift', php: 'php', c: 'c', cplusplus: 'cplusplus', csharp: 'csharp',
  python: 'python', react: 'react', html: 'html5', css: 'css3', ruby: 'ruby',
  vue: 'vuedotjs', svelte: 'svelte', sql: 'mysql', shell: 'gnubash', svg: 'svg',
}

let done = 0
for (const [id, slug] of Object.entries(SLUGS)) {
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/${slug}.svg`, {
      headers: { 'user-agent': 'ResearchEngine logo vendor' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) { console.log(`skip ${id}: HTTP ${res.status}`); continue }
    const svg = await res.text()
    if (!svg.startsWith('<svg')) { console.log(`skip ${id}: not svg`); continue }
    writeFileSync(path.join(OUT, `${id}.svg`), svg)
    done++
  } catch (e) {
    console.log(`skip ${id}: ${e?.message ?? e}`)
  }
}
console.log(`vendored ${done}/${Object.keys(SLUGS).length} logos into public/lang-logos/`)
