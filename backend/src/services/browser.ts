// Open a link in the person's default browser, the one that already holds their logins.
// No shell is involved: the link is passed as one argument to the OS opener.
import { spawn } from 'node:child_process'

/** The command that opens a link with the OS default browser on this platform. */
export function browserCommand(url: string, platform: NodeJS.Platform = process.platform): [string, string[]] {
  if (platform === 'win32') return ['rundll32', ['url.dll,FileProtocolHandler', url]]
  if (platform === 'darwin') return ['open', [url]]
  return ['xdg-open', [url]]
}

/** Resolves once the opener has started. Fails when no opener exists on this machine. */
export function openInDefaultBrowser(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [cmd, args] = browserCommand(url)
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true })
    } catch (e: any) {
      resolve({ ok: false, error: `No browser could be started (${String(e?.message ?? e)}).` })
      return
    }
    child.once('error', (e) => resolve({ ok: false, error: `No browser could be started (${e.message}).` }))
    child.once('spawn', () => { child.unref(); resolve({ ok: true }) })
  })
}
