// Import a skill from a GitHub folder. The server reads the folder with the GitHub
// contents API (api.github.com), so file bodies come back inline and nothing is cloned
// or executed. The files then go through the same scan as an upload (routes/skills.ts).
//
// Accepted links:
//   https://github.com/<owner>/<repo>
//   https://github.com/<owner>/<repo>/tree/<ref>/<path>
//   https://github.com/<owner>/<repo>/blob/<ref>/<path>/SKILL.md
const API = 'https://api.github.com'
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const REPO = /^[A-Za-z0-9._-]{1,100}$/
const TEXT = /\.(md|markdown|txt|json|ya?ml|js|ts|py|sh)$/i
export const MAX_FILES = 40
export const MAX_FILE_BYTES = 200_000
export const MAX_TOTAL_BYTES = 800_000
const MAX_DEPTH = 3

export interface GithubSkillRef { owner: string; repo: string; ref: string | null; path: string }

/** Reads a GitHub link into its parts. Returns null for anything that is not a plain github.com folder or file link. */
export function parseGithubSkillUrl(raw: string): GithubSkillRef | null {
  if (typeof raw !== 'string' || raw.length > 500) return null
  // Check the text as typed: `new URL` would quietly resolve `..` before we could see it.
  if (/(^|[\/])(\.|%2e|\.\.|%2e%2e)(?=[\/?#]|$)/i.test(raw)) return null
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.username || u.password) return null
  const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts.length < 2) return null
  const [owner, repoRaw, kind, ref, ...rest] = parts
  const repo = repoRaw.replace(/\.git$/, '')
  if (!OWNER.test(owner) || !REPO.test(repo)) return null
  if (!kind) return { owner, repo, ref: null, path: '' }
  if (kind !== 'tree' && kind !== 'blob') return null
  if (!ref || !/^[A-Za-z0-9._\/-]{1,200}$/.test(ref)) return null
  let path = rest.join('/')
  if (path.split('/').some((seg) => seg === '..' || seg === '.')) return null
  // A blob link points at one file; the skill is the folder that holds it.
  if (kind === 'blob') path = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  return { owner, repo, ref, path }
}

export interface ImportedFile { path: string; text: string }
export type GithubImport = { ok: true; files: ImportedFile[]; source: string } | { ok: false; status: number; error: string }

type Fetcher = (url: string) => Promise<{ status: number; body: any }>

async function defaultFetch(url: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'ResearchEngine' }, signal: AbortSignal.timeout(15_000) })
  return { status: res.status, body: await res.json().catch(() => null) }
}

/** Fetch the text files of one skill folder. Bounded in count, size and depth. */
export async function importGithubSkill(raw: string, fetcher: Fetcher = defaultFetch): Promise<GithubImport> {
  const parsed = parseGithubSkillUrl(raw)
  if (!parsed) return { ok: false, status: 400, error: 'That is not a GitHub folder or file link (github.com/owner/repo/tree/branch/path).' }
  const ref: GithubSkillRef = parsed
  const q = ref.ref ? `?ref=${encodeURIComponent(ref.ref)}` : ''
  const base = `${API}/repos/${ref.owner}/${ref.repo}/contents`
  const files: ImportedFile[] = []
  let total = 0
  let overflow = ''

  async function walk(path: string, depth: number): Promise<string | null> {
    const url = `${base}/${path.split('/').map(encodeURIComponent).join('/')}${q}`
    const res = await fetcher(url)
    if (res.status === 404) return 'That folder was not found on GitHub. Check the link, the branch and the path.'
    if (res.status === 403 || res.status === 429) return 'GitHub is rate-limiting this server. Wait a few minutes and try again.'
    if (res.status !== 200) return `GitHub answered ${res.status}.`
    const items = Array.isArray(res.body) ? res.body : [res.body]
    for (const it of items) {
      if (!it || typeof it.path !== 'string' || typeof it.type !== 'string') continue
      if (it.type === 'dir') {
        if (depth >= MAX_DEPTH) continue
        const err = await walk(it.path, depth + 1)
        if (err) return err
      } else if (it.type === 'file' && TEXT.test(it.name ?? it.path)) {
        if (files.length >= MAX_FILES) { overflow = `Only the first ${MAX_FILES} files were read.`; continue }
        const size = typeof it.size === 'number' ? it.size : 0
        if (size > MAX_FILE_BYTES) continue
        if (typeof it.content !== 'string' || it.encoding !== 'base64') continue
        const text = Buffer.from(it.content, 'base64').toString('utf8')
        total += text.length
        if (total > MAX_TOTAL_BYTES) { overflow = 'The folder is larger than the import limit, so some files were left out.'; break }
        const rel = ref.path ? it.path.slice(ref.path.length).replace(/^\//, '') : it.path
        files.push({ path: rel || it.name, text })
      }
    }
    return null
  }

  const err = await walk(ref.path, 0)
  if (err) return { ok: false, status: 502, error: err }
  if (files.length === 0) return { ok: false, status: 422, error: 'No readable text files were found in that folder.' }
  const source = `https://github.com/${ref.owner}/${ref.repo}${ref.ref ? `/tree/${ref.ref}` : ''}${ref.path ? `/${ref.path}` : ''}`
  return { ok: true, files, source: overflow ? `${source} (${overflow})` : source }
}
