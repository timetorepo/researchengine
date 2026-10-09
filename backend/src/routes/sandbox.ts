import { Hono } from 'hono'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * Session isolation: a chat can ask to run its work inside a Docker container
 * or a VM instead of the host. Everything here probes first and reports
 * honestly — a machine without Docker gets told so, never a fake sandbox.
 */
export const sandboxRoutes = new Hono()

const x = promisify(execFile)
const NAME = (id: string) => `re-session-${String(id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)}`

async function has(bin: string): Promise<boolean> {
  try { await x(process.platform === 'win32' ? 'where' : 'which', [bin], { timeout: 3000 }); return true } catch { return false }
}

sandboxRoutes.get('/probe', async (c) => {
  let docker = false
  let dockerDetail = 'docker CLI not found on this machine'
  if (await has('docker')) {
    try { await x('docker', ['info', '--format', 'ok'], { timeout: 5000 }); docker = true; dockerDetail = 'docker daemon answers' }
    catch (e: any) { dockerDetail = `docker is installed but the daemon did not answer: ${String(e?.message ?? e).split('\n')[0].slice(0, 140)}` }
  }
  let vmBin = ''
  for (const bin of ['qemu-system-x86_64', 'qemu-system-aarch64', 'systemd-nspawn', 'multipass']) {
    if (await has(bin)) { vmBin = bin; break }
  }
  return c.json({
    docker,
    dockerDetail,
    vm: !!vmBin,
    vmDetail: vmBin ? `${vmBin} found` : 'no hypervisor CLI (qemu / systemd-nspawn / multipass) on this machine',
  })
})

/** Create the container for a session if it is not already running. */
sandboxRoutes.post('/container', async (c) => {
  const { id } = await c.req.json()
  if (!id) return c.json({ error: 'id is required' }, 400)
  const name = NAME(id)
  try {
    const ps = await x('docker', ['ps', '-a', '--filter', `name=^${name}$`, '--format', '{{.Names}} {{.Status}}'], { timeout: 5000 })
    if (ps.stdout.includes(name)) {
      if (/Up/.test(ps.stdout)) return c.json({ ok: true, container: name, created: false })
      await x('docker', ['start', name], { timeout: 10000 })
      return c.json({ ok: true, container: name, created: false })
    }
    await x('docker', ['run', '-d', '--name', name, '--memory', '512m', '--cpus', '1', 'alpine:3.20', 'sleep', 'infinity'], { timeout: 120000 })
    return c.json({ ok: true, container: name, created: true })
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message ?? e).split('\n')[0].slice(0, 200) }, 500)
  }
})

sandboxRoutes.delete('/container', async (c) => {
  const { id } = await c.req.json()
  if (!id) return c.json({ error: 'id is required' }, 400)
  try { await x('docker', ['rm', '-f', NAME(id)], { timeout: 15000 }); return c.json({ ok: true }) }
  catch (e: any) { return c.json({ ok: false, error: String(e?.message ?? e).split('\n')[0].slice(0, 200) }, 500) }
})

/** Run one command inside the session's container. */
sandboxRoutes.post('/exec', async (c) => {
  const { id, cmd } = await c.req.json()
  if (!id || typeof cmd !== 'string') return c.json({ error: 'id and cmd are required' }, 400)
  try {
    const r = await x('docker', ['exec', NAME(id), 'sh', '-c', cmd.slice(0, 4000)], { timeout: 30000 })
    return c.json({ ok: true, stdout: r.stdout.slice(0, 20000), stderr: r.stderr.slice(0, 4000) })
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message ?? e).split('\n')[0].slice(0, 200), stderr: String(e?.stderr ?? '').slice(0, 4000) }, 500)
  }
})
