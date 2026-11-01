import { Hono } from 'hono'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * Session isolation: a chat can run its work inside a Docker container or a
 * VM instead of on the host. Everything here probes first and reports honestly.
 * A machine without Docker or multipass is told so; no fake sandbox is ever
 * shown as running.
 */
export const sandboxRoutes = new Hono()

const x = promisify(execFile)
const safe = (id: string) => String(id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)
const NAME = (id: string) => `re-session-${safe(id)}`
const VM = (id: string) => `re-vm-${safe(id)}`

async function has(bin: string): Promise<boolean> {
  try { await x(process.platform === 'win32' ? 'where' : 'which', [bin], { timeout: 3000 }); return true } catch { return false }
}

const brief = (e: any) => String(e?.stderr || e?.message || e).split('\n').filter(Boolean).pop()?.slice(0, 200) ?? 'failed'

sandboxRoutes.get('/probe', async (c) => {
  let docker = false
  let dockerDetail = 'docker CLI not found on this machine'
  if (await has('docker')) {
    try { await x('docker', ['info', '--format', 'ok'], { timeout: 5000 }); docker = true; dockerDetail = 'docker daemon answers' }
    catch (e: any) { dockerDetail = `docker is installed but the daemon did not answer: ${brief(e).slice(0, 140)}` }
  }
  const vm = await has('multipass')
  return c.json({
    docker,
    dockerDetail,
    vm,
    vmDetail: vm ? 'multipass found: each session can run in its own VM' : 'multipass is not installed. It runs the session VMs; get it from multipass.io',
  })
})

/** Create the Docker container for a session if it is not already running. */
sandboxRoutes.post('/container', async (c) => {
  const { id } = await c.req.json()
  if (!id) return c.json({ error: 'id is required' }, 400)
  const name = NAME(id)
  try {
    const ps = await x('docker', ['ps', '-a', '--filter', `name=^${name}$`, '--format', '{{.Names}} {{.Status}}'], { timeout: 5000 })
    if (ps.stdout.includes(name)) {
      if (!/Up/.test(ps.stdout)) await x('docker', ['start', name], { timeout: 10000 })
      return c.json({ ok: true, container: name, created: false })
    }
    await x('docker', ['run', '-d', '--name', name, '--memory', '512m', '--cpus', '1', 'alpine:3.20', 'sleep', 'infinity'], { timeout: 120000 })
    return c.json({ ok: true, container: name, created: true })
  } catch (e: any) {
    return c.json({ ok: false, error: brief(e) }, 500)
  }
})

sandboxRoutes.delete('/container', async (c) => {
  const { id } = await c.req.json()
  if (!id) return c.json({ error: 'id is required' }, 400)
  try { await x('docker', ['rm', '-f', NAME(id)], { timeout: 15000 }); return c.json({ ok: true }) }
  catch (e: any) { return c.json({ ok: false, error: brief(e) }, 500) }
})

/** Run one command inside the session's container. */
sandboxRoutes.post('/exec', async (c) => {
  const { id, cmd } = await c.req.json()
  if (!id || typeof cmd !== 'string') return c.json({ error: 'id and cmd are required' }, 400)
  try {
    const r = await x('docker', ['exec', NAME(id), 'sh', '-c', cmd.slice(0, 4000)], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 })
    return c.json({ ok: true, stdout: r.stdout.slice(0, 20000), stderr: r.stderr.slice(0, 4000) })
  } catch (e: any) {
    return c.json({ ok: false, error: brief(e), stderr: String(e?.stderr ?? '').slice(0, 4000) }, 500)
  }
})

/** Launch the session's VM through multipass (created once, then reused). */
sandboxRoutes.post('/vm', async (c) => {
  const { id } = await c.req.json()
  if (!id) return c.json({ error: 'id is required' }, 400)
  if (!(await has('multipass'))) {
    return c.json({ ok: false, error: 'multipass is not installed on this machine. Get it from multipass.io, then try again.' }, 400)
  }
  const name = VM(id)
  try {
    const list = await x('multipass', ['list', '--format', 'csv'], { timeout: 20000 })
    if (list.stdout.split('\n').some((l) => l.startsWith(`${name},`))) {
      await x('multipass', ['start', name], { timeout: 180000 }).catch(() => {})
      return c.json({ ok: true, vm: name, created: false })
    }
    // First launch downloads an image, so it gets a generous timeout.
    await x('multipass', ['launch', '--name', name, '--cpus', '1', '--memory', '1G', '--disk', '4G'], { timeout: 900000 })
    return c.json({ ok: true, vm: name, created: true })
  } catch (e: any) {
    return c.json({ ok: false, error: brief(e) }, 500)
  }
})

sandboxRoutes.delete('/vm', async (c) => {
  const { id } = await c.req.json()
  if (!id) return c.json({ error: 'id is required' }, 400)
  try { await x('multipass', ['delete', '--purge', VM(id)], { timeout: 120000 }); return c.json({ ok: true }) }
  catch (e: any) { return c.json({ ok: false, error: brief(e) }, 500) }
})

sandboxRoutes.post('/vm-exec', async (c) => {
  const { id, cmd } = await c.req.json()
  if (!id || typeof cmd !== 'string') return c.json({ error: 'id and cmd are required' }, 400)
  try {
    const r = await x('multipass', ['exec', VM(id), '--', 'sh', '-c', cmd.slice(0, 4000)], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 })
    return c.json({ ok: true, stdout: r.stdout.slice(0, 20000), stderr: r.stderr.slice(0, 4000) })
  } catch (e: any) {
    return c.json({ ok: false, error: brief(e), stderr: String(e?.stderr ?? '').slice(0, 4000) }, 500)
  }
})
