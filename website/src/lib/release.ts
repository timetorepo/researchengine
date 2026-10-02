/**
 * The release the site offers, and the GitHub stars, both without a backend.
 *
 * The version is baked at build time from the repository's own package.json, so
 * a download button exists on the first paint and can never point at a tag that
 * was not built. `release.json` (written by scripts/prepare-assets.mjs, served
 * from the site's own origin) adds what only the repository knows: digests, the
 * portable archives, and which installers the tag actually published.
 *
 * Stars are read from GitHub's public API in the visitor's browser. No token, no
 * proxy, no server. When the repository is not public yet, the API answers 404
 * and the section says so rather than inventing a number.
 */
import { useEffect, useState } from 'react'

export interface ReleaseInstaller {
  name: string
  href: string
  kind: 'windows' | 'deb' | 'appimage' | 'other'
  platform: string
  sha256: string
  size?: string
}

export interface ReleasePortable {
  name: string
  href: string
  platform: string
  format: string
  bytes: number
  sha256: string
  selfHosted: boolean
}

export interface ReleaseInfo {
  version: string
  tag: string
  repo: string
  releaseUrl: string
  sourceUrl: string
  licenseUrl: string
  notesUrl: string
  docsUrl: string
  generated: string
  license: string
  installers: ReleaseInstaller[]
  portables: ReleasePortable[]
  requirements: { installers: string; portables: string }
}

export const VERSION = typeof __SITE_VERSION__ === 'string' ? __SITE_VERSION__ : '0.36.0-beta.1'
export const TAG = `v${VERSION}`
export const REPO = 'timetorepo/researchengine'
export const SOURCE_URL = `https://github.com/${REPO}`
export const RELEASES_URL = `${SOURCE_URL}/releases`
export const RELEASE_URL = `${RELEASES_URL}/tag/${TAG}`
export const RELEASE_ASSET = (name: string) => `${RELEASES_URL}/download/${TAG}/${name}`

/** The installer names this round publishes, in the order they are offered. */
export const INSTALLER_NAMES = {
  windows: `Research.Engine_${VERSION}_x64-setup.exe`,
  deb: `Research.Engine_${VERSION}_amd64.deb`,
  appimage: `Research.Engine_${VERSION}_amd64.AppImage`,
}

export function useRelease(): { release: ReleaseInfo | null; failed: boolean } {
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/release.json', { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`release.json answered ${res.status}`))))
      .then((data: ReleaseInfo) => {
        if (alive) setRelease(data)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  return { release, failed }
}

export interface StarState {
  count: number
  stargazers: { login: string; avatar_url: string; html_url: string }[]
  /** true when GitHub itself answered; false means the repository is not public (yet). */
  live: boolean
  loading: boolean
}

export function useStars(repo = REPO): StarState {
  const [state, setState] = useState<StarState>({ count: 0, stargazers: [], live: false, loading: true })

  useEffect(() => {
    let alive = true
    const headers = { accept: 'application/vnd.github+json' }
    Promise.all([
      fetch(`https://api.github.com/repos/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${repo}/stargazers?per_page=8`, { headers }),
    ])
      .then(async ([info, people]) => {
        if (!info.ok) throw new Error(`GitHub answered ${info.status}`)
        const data = (await info.json()) as { stargazers_count?: number }
        const list = people.ok ? ((await people.json()) as StarState['stargazers']) : []
        if (!alive) return
        setState({
          count: typeof data.stargazers_count === 'number' ? data.stargazers_count : 0,
          stargazers: Array.isArray(list) ? list.slice(0, 8) : [],
          live: true,
          loading: false,
        })
      })
      .catch(() => {
        if (alive) setState({ count: 0, stargazers: [], live: false, loading: false })
      })
    return () => {
      alive = false
    }
  }, [repo])

  return state
}

/** 12.4 MB, or 532 KB — a number a person can read at a glance. */
export function humanSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
