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
    // A missing opener fails with 'error'. An opener that starts but finds no
    // browser (xdg-open does this) exits non-zero, so wait briefly for its exit
    // code instead of reporting success for a link nobody opened.
    let settled = false
    const finish = (r: { ok: true } | { ok: false; error: string }) => { if (!settled) { settled = true; resolve(r) } }
    child.once('error', (e) => finish({ ok: false, error: `No browser could be started (${e.message}).` }))
    child.once('exit', (code) => {
      finish(code === 0 || code === null
        ? { ok: true }
        : { ok: false, error: `The system could not open a browser (exit code ${code}).` })
    })
    child.once('spawn', () => {
      const t = setTimeout(() => { child.unref(); finish({ ok: true }) }, 2500)
      child.once('exit', () => clearTimeout(t))
    })
  })
}
