/**
 * The agent harness, checked offline (no network, no real model):
 *  Kernel:   services wait for their injections; unloading a provider sends
 *            dependents back to waiting; effects revert in reverse; a plugin
 *            that throws is removed without taking the kernel down.
 *  Tools:    bash is refused without approval and runs only after it; the
 *            editor and file tools refuse paths that escape the workspace,
 *            including through a symlink.
 *  LLM:      the client sends the key as a bearer header and never echoes it
 *            in an error.
 *  Sessions: the log is append-only; fork copies to a point; search finds text;
 *            a secret-looking field is refused, so no key reaches the log.
 *  Context:  a long session is fitted under budget, keeps the system prompt and
 *            the newest turn, and never splits a tool call from its result.
 *  Loop:     a scripted model calls a tool, then answers; the log holds both;
 *            the key is not in any file; a profile refuses tools it does not offer;
 *            the step limit and an abort both end the turn cleanly.
 *
 * Run: npm run harness-test --workspace backend
 */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, realpath, symlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Kernel, definePlugin } from '../src/harness/kernel'
import { createLlm, type ChatMessage } from '../src/harness/llm'
import { createSessionStore } from '../src/harness/sessions'
import { fitContext, messagesFromLog, DEFAULT_CONTEXT_CHARS } from '../src/harness/agent'
import { bootHarness } from '../src/harness'
import { clipOutput, insideWorkspace, TOOL_OUTPUT_MAX, type ToolEnv, type ToolRegistry } from '../src/harness/tools'
import { PROFILES } from '../src/harness/profiles'
import type { SessionEvent } from '../src/harness/sessions'

let passed = 0
const check = async (name: string, fn: () => void | Promise<void>) => {
  await fn()
  passed++
  console.log(`  ok  ${name}`)
}

const root = await mkdtemp(join(tmpdir(), 'harness-test-'))

// ---------- kernel ----------
await check('a plugin waits for the service it injects, whatever the load order', () => {
  const k = new Kernel()
  k.load(definePlugin({ name: 'consumer', inject: ['db'], apply(ctx) { ctx.effect(() => { ctx.provide('seen', ctx.get('db')) }) } }))
  assert.deepEqual(k.waiting().map((w) => w.name), ['consumer'])
  k.load(definePlugin({ name: 'provider', apply(ctx) { ctx.provide('db', 42) } }))
  assert.equal(k.get('seen'), 42)
  assert.ok(k.mounted().includes('consumer'))
})

await check('unloading a provider sends its dependents back to waiting, and they remount when it returns', () => {
  const k = new Kernel()
  const provider = k.load(definePlugin({ name: 'provider', apply(ctx) { ctx.provide('svc', 'v1') } }))
  k.load(definePlugin({ name: 'dependent', inject: ['svc'], apply() {} }))
  assert.ok(k.mounted().includes('dependent'))
  k.unload(provider)
  assert.equal(k.get('svc'), undefined)
  assert.ok(k.waiting().some((w) => w.name === 'dependent' && w.missing.includes('svc')))
  k.load(definePlugin({ name: 'provider', apply(ctx) { ctx.provide('svc', 'v2') } }))
  assert.ok(k.mounted().includes('dependent'))
})

await check('effects revert in reverse order when a plugin unmounts, and its listeners are removed', () => {
  const k = new Kernel()
  const order: string[] = []
  let hits = 0
  const p = k.load(definePlugin({
    name: 'effects',
    apply(ctx) {
      ctx.effect(() => { order.push('first'); return () => order.push('undo first') })
      ctx.effect(() => { order.push('second'); return () => order.push('undo second') })
      ctx.on('ping', () => { hits++ })
    },
  }))
  k.load(definePlugin({ name: 'pinger', apply(ctx) { ctx.emit('ping') } }))
  assert.equal(hits, 1, 'the listener is live while its plugin is mounted')
  k.unload(p)
  assert.deepEqual(order, ['first', 'second', 'undo second', 'undo first'])
  k.load(definePlugin({ name: 'pinger-2', apply(ctx) { ctx.emit('ping') } }))
  assert.equal(hits, 1, 'the listener is gone after its plugin unmounts')
})

await check('a plugin that throws on mount is removed, is recorded, and does not stop the others', () => {
  const k = new Kernel()
  k.load(definePlugin({ name: 'broken', apply() { throw new Error('boom') } }))
  k.load(definePlugin({ name: 'fine', apply(ctx) { ctx.provide('ok', true) } }))
  assert.equal(k.get('ok'), true)
  assert.deepEqual(k.errors.map((e) => [e.plugin, e.error]), [['broken', 'boom']])
  assert.ok(!k.mounted().includes('broken'))
  assert.ok(!k.waiting().some((w) => w.name === 'broken'), 'a failed plugin must not sit in the waiting list')
})

await check('two plugins cannot claim the same service key at once', () => {
  const k = new Kernel()
  k.load(definePlugin({ name: 'a', apply(ctx) { ctx.provide('tools', 1) } }))
  k.load(definePlugin({ name: 'b', apply(ctx) {
    assert.throws(() => ctx.provide('tools', 2), /already provided by a/)
  } }))
  assert.equal(k.get('tools'), 1)
})

// ---------- tools ----------
await check('clipOutput keeps the start and the end of long output', () => {
  const long = 'A'.repeat(20_000) + 'Z'.repeat(20_000)
  const out = clipOutput(long)
  assert.ok(out.length <= TOOL_OUTPUT_MAX + 80)
  assert.ok(out.startsWith('AAAA') && out.endsWith('ZZZZ'))
})

const workspace = join(root, 'project')
await mkdir(workspace, { recursive: true })
await writeFile(join(workspace, 'notes.txt'), 'alpha\nbeta\ngamma\n')
const outside = join(root, 'outside.txt')
await writeFile(outside, 'secret\n')
await symlink(outside, join(workspace, 'link-out.txt'))

await check('paths that escape the workspace are refused, including through a symlink', async () => {
  assert.equal(await insideWorkspace(workspace, '../outside.txt'), null)
  assert.equal(await insideWorkspace(workspace, '/etc/passwd'), null)
  assert.equal(await insideWorkspace(workspace, 'link-out.txt'), null)
  assert.ok(await insideWorkspace(workspace, 'notes.txt'))
  assert.equal(await insideWorkspace(workspace, 'new/file.txt', true), null)
  // A new file in a new folder is allowed when it lands inside the workspace...
  assert.equal(await insideWorkspace(workspace, 'new/deeper/file.txt', false), join(await realpath(workspace), 'new/deeper/file.txt'))
  // ...and refused when the folder it names is a link out of the workspace.
  await symlink(join(root), join(workspace, 'escape-dir'))
  assert.equal(await insideWorkspace(workspace, 'escape-dir/new.txt', false), null)
})

const harnessEnv = (over: Partial<ToolEnv> = {}): ToolEnv => ({ workspace, approve: false, access: { mode: 'project', roots: [] }, ...over })

const dataDir = join(root, 'data')
const scripted: Array<any> = []
const calls: Array<{ url: string; body: any; auth: string | null }> = []
const fakeFetch = async (url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body))
  calls.push({ url, body, auth: (init.headers as Record<string, string>).authorization ?? null })
  const next = scripted.shift()
  if (!next) return new Response('{"error":"no script"}', { status: 500 })
  if (next.status && next.status !== 200) return new Response(next.text ?? 'bad', { status: next.status })
  return new Response(JSON.stringify({ choices: [{ finish_reason: next.finish ?? 'stop', message: next.message }] }), { status: 200, headers: { 'content-type': 'application/json' } })
}
const harness = bootHarness(dataDir, fakeFetch)
const tools = harness.kernel.get<ToolRegistry>('tools')!

await check('bash is refused until shell is approved, then runs inside the workspace', async () => {
  const refused = await tools.call('bash', { command: 'echo hi' }, harnessEnv())
  assert.match(refused, /Shell is off/)
  const ran = await tools.call('bash', { command: 'cat notes.txt | head -n 1' }, harnessEnv({ approve: true }))
  assert.match(ran, /exit 0/)
  assert.match(ran, /alpha/)
})

await check('bash refuses a command that reaches outside the project under the default access policy', async () => {
  const out = await tools.call('bash', { command: 'cat /etc/hostname' }, harnessEnv({ approve: true }))
  assert.match(out, /^Refused:/)
})

await check('the editor creates, views and replaces; a non-unique match is refused', async () => {
  const created = await tools.call('str_replace_editor', { command: 'create', path: 'src/a.txt', text: 'one two one' }, harnessEnv())
  assert.match(created, /Created/)
  const dup = await tools.call('str_replace_editor', { command: 'str_replace', path: 'src/a.txt', old: 'one', new: '1' }, harnessEnv())
  assert.match(dup, /matched 2 times/)
  const ok = await tools.call('str_replace_editor', { command: 'str_replace', path: 'src/a.txt', old: 'two', new: '2' }, harnessEnv())
  assert.match(ok, /Edited/)
  assert.equal(await readFile(join(workspace, 'src/a.txt'), 'utf8'), 'one 2 one')
  const viewed = await tools.call('str_replace_editor', { command: 'view', path: 'src/a.txt' }, harnessEnv())
  assert.match(viewed, /1: one 2 one/)
})

await check('the editor refuses to create a file outside the workspace', async () => {
  const out = await tools.call('str_replace_editor', { command: 'create', path: '../escaped.txt', text: 'x' }, harnessEnv())
  assert.match(out, /^Refused/)
  await assert.rejects(readFile(join(root, 'escaped.txt')))
})

await check('list_files and read_file stay in the workspace and hide .git and node_modules', async () => {
  await mkdir(join(workspace, '.git'), { recursive: true })
  const listed = await tools.call('list_files', { path: '.' }, harnessEnv())
  assert.match(listed, /notes\.txt/)
  assert.doesNotMatch(listed, /\.git/)
  const read = await tools.call('read_file', { path: 'notes.txt' }, harnessEnv())
  assert.match(read, /2: beta/)
  assert.match(await tools.call('read_file', { path: '../outside.txt' }, harnessEnv()), /^Refused/)
})

// ---------- llm ----------
await check('the model client sends the key as a bearer header and never echoes it in an error', async () => {
  const seen: Array<{ url: string; auth: string | null }> = []
  const llm = createLlm(async (url, init) => {
    seen.push({ url, auth: (init.headers as Record<string, string>).authorization ?? null })
    return new Response('upstream said: bad key sk-test-123', { status: 401 })
  })
  await assert.rejects(
    llm.complete({ base: 'https://api.example.com/v1/', key: 'sk-test-123', model: 'm' }, [{ role: 'user', content: 'hi' }], []),
    (err: Error) => {
      assert.match(err.message, /returned 401/)
      assert.ok(!err.message.includes('sk-test-123'), 'the key must not appear in the error')
      return true
    },
  )
  assert.equal(seen[0].url, 'https://api.example.com/v1/chat/completions')
  assert.equal(seen[0].auth, 'Bearer sk-test-123')
})

// ---------- sessions ----------
await check('the log is append-only, forks copy up to a point, and search finds text', async () => {
  const store = createSessionStore(join(root, 'sessions-data'))
  const s = await store.create({ profile: 'minimal', workspace: null, title: 'Demo' })
  await store.append(s.id, { type: 'user', content: 'find the kettle bug' })
  await store.append(s.id, { type: 'assistant', content: 'The kettle bug is a missing await.' })
  await store.append(s.id, { type: 'user', content: 'thanks' })
  const events = await store.read(s.id)
  assert.deepEqual(events.map((e) => e.i), [0, 1, 2, 3])
  // A fork at event N keeps events 0..N, so forking at 2 keeps header, user and assistant.
  const fork = await store.fork(s.id, 2)
  const forked = await store.read(fork.id)
  assert.equal(forked.length, 3, 'fork at event 2 keeps header, user and assistant')
  assert.equal(forked[0].forkedFrom?.id, s.id)
  await store.append(fork.id, { type: 'user', content: 'next' })
  assert.equal((await store.read(fork.id)).at(-1)?.i, 3, 'indexes continue after a fork')
  const hits = await store.search('kettle')
  assert.ok(hits.some((h) => h.id === s.id && h.i === 1 && h.snippet.includes('kettle')), 'search points at the event and a snippet')
  assert.equal((await store.search('zzz-not-there')).length, 0)
  assert.equal((await store.list()).length, 2)
})

await check('the session list gives the project, the event count and the last update, from the log without reading it whole', async () => {
  const store = createSessionStore(join(root, 'list-data'))
  const a = await store.create({ profile: 'standard', workspace: 'my-app', title: 'Fix the build' })
  await store.append(a.id, { type: 'user', content: 'first' })
  await store.append(a.id, { type: 'assistant', content: 'second with a \n newline inside' })
  await store.append(a.id, { type: 'user', content: 'third' })
  const b = await store.create({ profile: 'minimal', workspace: null, title: 'Chat only' })
  const list = await store.list()
  const rowA = list.find((x) => x.id === a.id)
  const rowB = list.find((x) => x.id === b.id)
  assert.ok(rowA && rowB)
  assert.equal(rowA.workspace, 'my-app')
  assert.equal(rowA.title, 'Fix the build')
  assert.equal(rowA.profile, 'standard')
  assert.equal(rowA.events, 4, 'header plus three events; a newline inside text does not count as an event')
  assert.equal(rowB.workspace, null)
  assert.equal(rowB.events, 1)
  assert.ok(rowA.updatedAt >= rowA.createdAt)
  for (let k = 1; k < list.length; k++) assert.ok(list[k - 1].updatedAt >= list[k].updatedAt, 'newest first')
})

await check('a secret-looking field is refused, so a key cannot reach the log', async () => {
  const store = createSessionStore(join(root, 'secret-data'))
  const s = await store.create({ profile: 'minimal', workspace: null })
  await assert.rejects(store.append(s.id, { type: 'user', content: 'x', apiKey: 'sk-leak' } as any), /secret-looking/)
})

// ---------- context ----------
await check('a long session is fitted under budget, keeps the system prompt and the newest turn', () => {
  const system: ChatMessage = { role: 'system', content: 'SYSTEM' }
  const msgs: ChatMessage[] = [system]
  for (let t = 0; t < 40; t++) {
    msgs.push({ role: 'user', content: `question ${t} ` + 'q'.repeat(2000) })
    msgs.push({ role: 'assistant', content: '', tool_calls: [{ id: `c${t}`, type: 'function', function: { name: 'read_file', arguments: '{}' } }] })
    msgs.push({ role: 'tool', tool_call_id: `c${t}`, name: 'read_file', content: 'x'.repeat(8000) })
    msgs.push({ role: 'assistant', content: `answer ${t}` })
  }
  const budget = 30_000
  const fitted = fitContext(msgs, budget)
  const size = fitted.reduce((n, m) => n + m.content.length + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0), 0)
  assert.ok(size <= budget, `size ${size} over budget ${budget}`)
  assert.equal(fitted[0].content, 'SYSTEM')
  assert.match(fitted.at(-1)!.content, /answer 39/)
  assert.ok(fitted.some((m) => m.content.includes('left out to fit')))
  // Every tool call still has its result, and no result is orphaned.
  const callIds = new Set(fitted.flatMap((m) => (m.tool_calls ?? []).map((c) => c.id)))
  const resultIds = new Set(fitted.filter((m) => m.role === 'tool').map((m) => m.tool_call_id))
  for (const id of callIds) assert.ok(resultIds.has(id), `call ${id} lost its result`)
  for (const id of resultIds) assert.ok(callIds.has(id), `result ${id} is orphaned`)
  assert.ok(DEFAULT_CONTEXT_CHARS >= 100_000)
})

await check('an interrupted tool call is answered with a note, so the next model call is valid', () => {
  const events: SessionEvent[] = [
    { i: 0, t: 0, type: 'user', content: 'go' },
    { i: 1, t: 0, type: 'assistant', content: '', toolCalls: [{ id: 'x1', name: 'bash', arguments: '{}' }] },
    { i: 2, t: 0, type: 'stopped' },
  ]
  const msgs = messagesFromLog(events)
  const result = msgs.find((m) => m.role === 'tool' && m.tool_call_id === 'x1')
  assert.ok(result, 'the unanswered call must get a result')
  assert.match(result!.content, /stopped/)
})

// ---------- loop ----------
const turnKey = 'sk-live-TOPSECRET-987'
await check('a turn calls a tool, gets its result, answers, and the log holds everything but the key', async () => {
  const s = await harness.sessions.create({ profile: 'standard', workspace: null, title: 'Loop' })
  scripted.length = 0
  scripted.push({ message: { role: 'assistant', content: '', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'list_files', arguments: '{}' } }] }, finish: 'tool_calls' })
  scripted.push({ message: { role: 'assistant', content: 'The project has notes.txt.' } })
  const events: string[] = []
  const r = await harness.agent.run({
    sessionId: s.id, text: 'what is here?', profile: 'standard',
    target: { base: 'https://models.example/v1', key: turnKey, model: 'demo' },
    workspace, approve: false, access: { mode: 'project', roots: [] },
    onEvent: (e) => events.push(e.type),
  })
  assert.equal(r.outcome, 'done')
  assert.deepEqual(events, ['tool_call', 'tool_result', 'assistant', 'done'])
  const log = await harness.sessions.read(s.id)
  assert.deepEqual(log.map((e) => e.type), ['header', 'user', 'assistant', 'tool', 'assistant'])
  // The second model call saw the tool result.
  const second = calls[calls.length - 1].body.messages as ChatMessage[]
  assert.ok(second.some((m) => m.role === 'tool' && m.content.includes('notes.txt')))
  // The key was sent as the bearer token, and is nowhere on disk.
  assert.equal(calls[calls.length - 1].auth, `Bearer ${turnKey}`)
  const files = await readdir(join(dataDir, 'harness', 'sessions'))
  for (const f of files) {
    assert.ok(!(await readFile(join(dataDir, 'harness', 'sessions', f), 'utf8')).includes(turnKey), 'the key must not be written to the log')
  }
})

await check('a profile refuses a tool it does not offer', async () => {
  const s = await harness.sessions.create({ profile: 'minimal', workspace: null })
  scripted.length = 0
  scripted.push({ message: { role: 'assistant', content: '', tool_calls: [{ id: 'c9', type: 'function', function: { name: 'list_files', arguments: '{}' } }] } })
  scripted.push({ message: { role: 'assistant', content: 'ok' } })
  await harness.agent.run({
    sessionId: s.id, text: 'list', profile: 'minimal', target: { base: 'https://m.example/v1', key: '', model: 'demo' },
    workspace, approve: false, access: { mode: 'project', roots: [] },
  })
  const tool = (await harness.sessions.read(s.id)).find((e) => e.type === 'tool')
  assert.match(tool?.content ?? '', /does not offer the tool "list_files"/)
  assert.ok(PROFILES.minimal.tools.every((t) => PROFILES.standard.tools.includes(t)))
})

await check('the step limit ends a turn that never answers', async () => {
  const s = await harness.sessions.create({ profile: 'minimal', workspace: null })
  scripted.length = 0
  for (let i = 0; i < PROFILES.minimal.maxSteps + 2; i++) {
    scripted.push({ message: { role: 'assistant', content: '', tool_calls: [{ id: `loop-${i}`, type: 'function', function: { name: 'bash', arguments: '{"command":"true"}' } }] } })
  }
  const r = await harness.agent.run({
    sessionId: s.id, text: 'loop', profile: 'minimal', target: { base: 'https://m.example/v1', key: '', model: 'demo' },
    workspace: null, approve: false, access: { mode: 'project', roots: [] },
  })
  assert.equal(r.outcome, 'step-limit')
  assert.equal(r.steps, PROFILES.minimal.maxSteps)
})

await check('aborting a turn stops it and records that it stopped', async () => {
  const controller = new AbortController()
  // The client goes away during the model call: the call fails and the turn ends as stopped.
  const slow = async () => { controller.abort(); return new Response('{}', { status: 500 }) }
  const abortingHarness = bootHarness(join(root, 'abort-data'), slow as any)
  const s2 = await abortingHarness.sessions.create({ profile: 'minimal', workspace: null })
  const r = await abortingHarness.agent.run({
    sessionId: s2.id, text: 'hi', profile: 'minimal', target: { base: 'https://m.example/v1', key: '', model: 'demo' },
    workspace: null, approve: false, access: { mode: 'project', roots: [] }, signal: controller.signal,
  })
  assert.equal(r.outcome, 'stopped')
  assert.equal((await abortingHarness.sessions.read(s2.id)).at(-1)?.type, 'stopped')
})

// ---------- routes ----------
const { Hono } = await import('hono')
const { harnessRoutes } = await import('../src/routes/harness')
const app = new Hono().route('/api', harnessRoutes({ dataDir: join(root, 'route-data') } as any))
const api = (path: string, init?: RequestInit) => app.request(`/api${path}`, init)
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

await check('the routes list profiles, create a session, and read it back', async () => {
  const profiles = await (await api('/harness/profiles')).json() as any
  assert.deepEqual(profiles.profiles.map((p: any) => p.id), ['minimal', 'standard'])
  const created = await api('/harness/sessions', json({ profile: 'minimal', title: 'From the route' }))
  assert.equal(created.status, 201)
  const { session } = await created.json() as any
  const list = await (await api('/harness/sessions')).json() as any
  assert.ok(list.sessions.some((s: any) => s.id === session.id))
  const got = await (await api(`/harness/sessions/${session.id}`)).json() as any
  assert.equal(got.events[0].title, 'From the route')
})

await check('bad input is refused with a message, not a crash', async () => {
  assert.equal((await api('/harness/sessions', json({ profile: 'nope' }))).status, 400)
  assert.equal((await api('/harness/sessions', json({ profile: 'minimal', project: 'no-such-project' }))).status, 400)
  assert.equal((await api('/harness/sessions/not-a-uuid')).status, 400)
  assert.equal((await api('/harness/sessions/00000000-0000-4000-8000-000000000000')).status, 404)
  const created = await (await api('/harness/sessions', json({ profile: 'minimal' }))).json() as any
  assert.equal((await api(`/harness/sessions/${created.session.id}/turn`, json({ text: '' }))).status, 400)
  assert.equal((await api(`/harness/sessions/${created.session.id}/turn`, json({ text: 'hi' }))).status, 400, 'a model is required')
})

await check('the routes fork a session and search it', async () => {
  const created = await (await api('/harness/sessions', json({ profile: 'minimal' }))).json() as any
  const id = created.session.id
  const store = (await import('../src/harness')).harnessFor(join(root, 'route-data'))
  await store.sessions.append(id, { type: 'user', content: 'routed kettle question' })
  const forked = await api(`/harness/sessions/${id}/fork`, json({ at: 1 }))
  assert.equal(forked.status, 201)
  const hits = await (await api('/harness/search?q=kettle')).json() as any
  assert.ok(hits.results.some((h: any) => h.id === id))
})

await rm(root, { recursive: true, force: true })
console.log(`\n${passed} passed, 0 failed`)
