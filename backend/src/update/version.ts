/**
 * Version arithmetic for the updater — no network, no filesystem, so it can be
 * tested directly.
 *
 * Everything here is deliberately boring and explicit, because the failure mode
 * of getting it wrong is the one thing an updater must never do: install
 * something older than what is running, or refuse to install something newer.
 *
 * The ordering follows semver §11, with one addition that matters for this
 * project: every release so far is a prerelease (`0.28.0-beta.1`), and GitHub's
 * `/releases/latest` deliberately skips prereleases — so the updater reads the
 * release *list* and picks the maximum itself. That endpoint returning 404 for a
 * prerelease-only repository is exactly the bug this module exists to avoid.
 */

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  /** Identifiers after the hyphen: `beta.1` → ['beta', 1]. Empty for a release. */
  prerelease: (string | number)[]
  raw: string
}

export function parseVersion(input: string): ParsedVersion | null {
  const raw = String(input ?? '').trim().replace(/^v/i, '')
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(raw)
  if (!m) return null
  const prerelease = (m[4] ?? '')
    .split('.')
    .filter((s) => s.length > 0)
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s))
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease, raw }
}

/**
 * Standard semver precedence: -1 / 0 / 1. Unparseable input sorts *below* any
 * parseable version, and two unparseable versions compare equal — an unknown
 * string must never win an update decision.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa && !pb) return 0
  if (!pa) return -1
  if (!pb) return 1
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1
  }
  // A release outranks any of its prereleases (1.0.0 > 1.0.0-beta.5).
  if (!pa.prerelease.length && !pb.prerelease.length) return 0
  if (!pa.prerelease.length) return 1
  if (!pb.prerelease.length) return -1
  const n = Math.max(pa.prerelease.length, pb.prerelease.length)
  for (let i = 0; i < n; i++) {
    const x = pa.prerelease[i]
    const y = pb.prerelease[i]
    if (x === undefined) return -1 // shorter prerelease list sorts first
    if (y === undefined) return 1
    if (x === y) continue
    const xn = typeof x === 'number'
    const yn = typeof y === 'number'
    if (xn && yn) return (x as number) < (y as number) ? -1 : 1
    if (xn) return -1 // numeric identifiers sort below alphanumeric ones
    if (yn) return 1
    return String(x) < String(y) ? -1 : 1
  }
  return 0
}

/** Is `candidate` strictly newer than `current`? */
export function isNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0
}

/** The slice of the GitHub releases API this updater uses. */
export interface ReleaseLike {
  tag_name?: string
  name?: string
  body?: string
  draft?: boolean
  prerelease?: boolean
  published_at?: string
  html_url?: string
  assets?: { name?: string; browser_download_url?: string; size?: number }[]
}

export interface ReleaseInfo {
  version: string
  tag: string
  name: string
  notes: string
  publishedAt: string
  url: string
  prerelease: boolean
  assets: { name: string; url: string; size: number }[]
}

function toReleaseInfo(r: ReleaseLike): ReleaseInfo | null {
  const tag = String(r.tag_name ?? '')
  const version = tag.replace(/^v/i, '')
  if (!parseVersion(version)) return null
  return {
    version,
    tag,
    name: String(r.name ?? tag),
    notes: String(r.body ?? ''),
    publishedAt: String(r.published_at ?? ''),
    url: String(r.html_url ?? ''),
    prerelease: !!r.prerelease,
    assets: (r.assets ?? []).map((a) => ({
      name: String(a.name ?? ''),
      url: String(a.browser_download_url ?? ''),
      size: Number(a.size ?? 0),
    })),
  }
}

/**
 * The newest release in a list, drafts excluded. Accepts prereleases on purpose
 * (see the module comment); `channel` narrows it when the user asks for stable
 * only.
 */
export function pickLatest(releases: ReleaseLike[], channel: 'stable' | 'beta' = 'beta'): ReleaseInfo | null {
  const parsed = releases
    .filter((r) => !r.draft)
    .map(toReleaseInfo)
    .filter((r): r is ReleaseInfo => !!r)
    .filter((r) => (channel === 'stable' ? !r.prerelease : true))
  if (!parsed.length) return null
  return parsed.reduce((best, cur) => (compareVersions(cur.version, best.version) > 0 ? cur : best))
}

/** `research-engine-0.29.0-beta.1-linux-x64.tar.gz` — what we publish per platform. */
export function archiveNameFor(version: string, platform: string): string {
  const ext = platform.startsWith('win') ? 'zip' : 'tar.gz'
  return `research-engine-${version}-${platform}.${ext}`
}

/** This machine, in the shape the archives are named with. */
export function platformKey(platform = process.platform, arch = process.arch): string {
  const os = platform === 'win32' ? 'win' : platform === 'darwin' ? 'darwin' : 'linux'
  const cpu = arch === 'arm64' ? 'arm64' : 'x64'
  return `${os}-${cpu}`
}

/** Parse a `SHA256SUMS` file (the format `sha256sum` writes) into name → hash. */
export function parseSha256Sums(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line)
    if (m) out[m[2]] = m[1].toLowerCase()
  }
  return out
}

/**
 * How far along a version string is, for messages like "you are 3 releases
 * behind". Returns the number of newer releases in the list.
 */
export function releasesBehind(current: string, releases: ReleaseLike[]): number {
  return releases
    .filter((r) => !r.draft)
    .map((r) => String(r.tag_name ?? '').replace(/^v/i, ''))
    .filter((v) => parseVersion(v))
    .filter((v) => isNewer(v, current))
    .length
}
