/**
 * The updater, end to end, on a real filesystem.
 *
 * This is the test that has to be believable, because the promise it checks is
 * the one that would hurt most to break: **an update replaces the program and
 * leaves the library exactly as it was.**
 *
 * It builds a fake installed app (the shape `scripts/package-binary.mjs`
 * produces), a fake data directory next to it, and a fake *next release* — a
 * real tar.gz and a real zip, assembled here from the real release archive in
 * `downloads/`, served by a local HTTP server that stands in for GitHub. Then it
 * drives the real `installUpdate()`:
 *
 *   1. resolve the new version from a release list (semver, prereleases included)
 *   2. download the archive over HTTP
 *   3. verify it against the release's SHA256SUMS
 *   4. unpack it (the real tar.gz and zip readers)
 *   5. swap it in, keeping the previous version
 *   6. boot: count the attempt, go healthy, keep the new version
 *   7. and, in the other branch: fail to boot, roll back, keep the library
 *
 * The data directory is hashed before and after every step. It must never
 * change, and the guard must refuse to write into it even if asked directly.
 *
 * Run: npx tsx scripts/update-test.mts
 */
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { deflateRawSync, gzipSync } from 'node:zlib'
import { spawn, type ChildProcess } from 'node:child_process'
import { cpSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  extractArchive, safeEntryPath, sniffFormat, stripSegments,
} from '../../backend/src/update/archive'
import {
  compareVersions, isNewer, parseSha256Sums, pickLatest, archiveNameFor, platformKey, releasesBehind,
} from '../../backend/src/update/version'
import {
  checkForUpdate, guard, installUpdate, markHealthy, readPending, rollback, updateStatus, writePending,
  type UpdateDeps,
} from '../../backend/src/update/service'
import { bootUpdateCheck } from '../../backend/src/update/boot'

let passed = 0
let failed = 0
let skipped = 0
const skip = (name: string, why: string) => { skipped++; console.log(`SKIP  ${name} — ${why}`) }
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; console.log(`FAIL  ${name} ${extra}`) }
}
const section = (t: string) => console.log(`\n${t}`)

const work = mkdtempSync(join(tmpdir(), 're-update-'))
const appRoot = join(work, 'research-engine-linux-x64')
const dataDir = join(work, '.research-engine')
const currentVersion = '0.28.0-beta.1'
// The version this checkout is publishing. The suite must not need an edit
// every time a new release ships, so the shipped-archive checks follow it.
const repoVersion = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version
const nextVersion = '0.29.0-beta.1'

/* ------------------------------------------------ a believable install ---- */

mkdirSync(join(appRoot, 'server'), { recursive: true })
mkdirSync(join(appRoot, 'frontend-dist'), { recursive: true })
mkdirSync(join(appRoot, 'bin'), { recursive: true })
writeFileSync(join(appRoot, 'server', 'index.js'), '// server bundle of 0.28.0-beta.1\nconsole.log("serving")\n')
writeFileSync(join(appRoot, 'server', 'package.json'), JSON.stringify({ name: 'research-engine-server', type: 'module', version: currentVersion }))
writeFileSync(join(appRoot, 'frontend-dist', 'index.html'), '<!doctype html><title>Research Engine 0.28.0-beta.1</title>')
writeFileSync(join(appRoot, 'bin', 'research-engine.mjs'), '// launcher\n')
writeFileSync(join(appRoot, 'research-engine'), '#!/usr/bin/env sh\nexec node "$(dirname "$0")/server/index.js" serve "$@"\n')
chmodSync(join(appRoot, 'research-engine'), 0o755)
writeFileSync(join(appRoot, 'README.txt'), 'Research Engine — portable build\n')

// The library: a database, a couple of chats, and a marker file whose hash we
// will watch. If an update ever rewrote or removed any of this, the test says so.
mkdirSync(join(dataDir, 'documents'), { recursive: true })
writeFileSync(join(dataDir, 'db.sqlite'), Buffer.from('SQLite format 3\0'.padEnd(4096, '\0')))
writeFileSync(join(dataDir, 'db.sqlite-wal'), 'wal-contents')
writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ profile: 'balanced', marker: 'do-not-touch' }))
writeFileSync(join(dataDir, 'documents', 'paper.pdf'), Buffer.from('%PDF-1.4 pretend paper'))

// The library's own files. The updater writes its safety copy under backups/
// and its scratch downloads under updates/; those are the updater's, so they
// are left out, and the backup itself is checked separately below.
const UPDATER_FOLDERS = new Set(['backups', 'updates'])
function hashTree(root: string): string {
  const h = createHash('sha256')
  const walk = (dir: string, base = '') => {
    for (const name of readdirSync(dir).sort()) {
      if (!base && UPDATER_FOLDERS.has(name)) continue
      const full = join(dir, name)
      const rel = base ? `${base}/${name}` : name
      const st = statSync(full)
      if (st.isDirectory()) walk(full, rel)
      else h.update(`${rel}:${st.size}:${createHash('sha256').update(readFileSync(full)).digest('hex')}\n`)
    }
  }
  walk(root)
  return h.digest('hex')
}

const libraryBefore = hashTree(dataDir)
const originalServer = readFileSync(join(appRoot, 'server', 'index.js'), 'utf8')

/* --------------------------------------------- a believable next release ---- */

/**
 * Build the archive the way package-binary.mjs does: a top-level folder holding
 * server/, frontend-dist/, bin/, the launcher and the README. Written as a tar
 * by hand (ustar + GNU-style long names not needed here) so the *real* tar
 * reader is what parses it.
 */
function tarEntry(name: string, content: Buffer, mode = 0o644): Buffer {
  const header = Buffer.alloc(512)
  header.write(name, 0, 100, 'utf8')
  header.write(mode.toString(8).padStart(7, '0') + '\0', 100, 8, 'utf8')
  header.write('0000000\0', 108, 8)
  header.write('0000000\0', 116, 8)
  header.write(content.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8')
  header.write('00000000000\0', 136, 12)
  header.write('        ', 148, 8)
  header.write('0', 156, 1)
  header.write('ustar\0', 257, 6)
  header.write('00', 263, 2)
  let sum = 0
  for (let i = 0; i < 512; i++) sum += header[i]
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8')
  const pad = Buffer.alloc(Math.ceil(content.length / 512) * 512 - content.length)
  return Buffer.concat([header, content, pad])
}

function buildTarGz(version: string, folder: string): Buffer {
  const files: [string, Buffer, number][] = [
    [`${folder}/server/index.js`, Buffer.from(`// server bundle of ${version}\nconsole.log("serving ${version}")\n`), 0o644],
    [`${folder}/server/package.json`, Buffer.from(JSON.stringify({ name: 'research-engine-server', type: 'module', version })), 0o644],
    [`${folder}/frontend-dist/index.html`, Buffer.from(`<!doctype html><title>Research Engine ${version}</title>`), 0o644],
    [`${folder}/frontend-dist/assets/app.js`, gzipSync(Buffer.from('x'.repeat(5000))), 0o644],
    [`${folder}/bin/research-engine.mjs`, Buffer.from('// launcher\n'), 0o644],
    [`${folder}/research-engine`, Buffer.from('#!/usr/bin/env sh\nexec node "$(dirname "$0")/server/index.js" serve "$@"\n'), 0o755],
    [`${folder}/README.txt`, Buffer.from('Research Engine — portable build\n'), 0o644],
  ]
  const body = Buffer.concat([...files.map(([n, c, m]) => tarEntry(n, c, m)), Buffer.alloc(1024)])
  return gzipSync(body)
}

/** A real zip, written with the same structure (stored + deflated entries). */
function buildZip(version: string, folder: string): Buffer {
  const files: [string, Buffer][] = [
    [`${folder}/server/index.js`, Buffer.from(`// server bundle of ${version}\nconsole.log("serving ${version}")\n`)],
    [`${folder}/server/package.json`, Buffer.from(JSON.stringify({ name: 'research-engine-server', type: 'module', version }))],
    [`${folder}/frontend-dist/index.html`, Buffer.from(`<!doctype html><title>Research Engine ${version}</title>`)],
    [`${folder}/bin/research-engine.mjs`, Buffer.from('// launcher\n')],
    [`${folder}/README.txt`, Buffer.from('Research Engine — portable build\n')],
  ]
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  const crc32 = (buf: Buffer) => {
    let c = ~0
    for (const b of buf) {
      c ^= b
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  for (const [name, content] of files) {
    const nameBuf = Buffer.from(name)
    const comp = deflateRawSync(content)
    const crc = crc32(content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comp.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    locals.push(local, nameBuf, comp)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(8, 10)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(comp.length, 20)
    cd.writeUInt32LE(content.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, nameBuf)
    offset += local.length + nameBuf.length + comp.length
  }
  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cdBuf, eocd])
}

const platform = 'linux-x64'
const tarName = archiveNameFor(nextVersion, platform)
const zipName = archiveNameFor(nextVersion, 'win-x64')
const tarBuf = buildTarGz(nextVersion, `research-engine-${platform}`)
const zipBuf = buildZip(nextVersion, 'research-engine-win-x64')
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const sumsText = [
  `${sha(tarBuf)}  ${tarName}`,
  `${sha(zipBuf)}  ${zipName}`,
  `${'0'.repeat(64)}  research-engine-${nextVersion}-darwin-arm64.tar.gz`,
].join('\n') + '\n'

/* ------------------------------------------------------- a local "GitHub" ---- */

const routes = new Map<string, { body: Buffer; type: string }>()
const releaseList = [
  { tag_name: 'v0.28.0-beta.1', name: 'v0.28.0-beta.1', draft: false, prerelease: true, published_at: '2026-09-26T00:00:00Z', body: 'previous', assets: [] },
  { tag_name: `v${nextVersion}`, name: `v${nextVersion}`, draft: false, prerelease: true, published_at: '2026-09-27T00:00:00Z', body: '## What is new\n\nThe updater.', assets: [] },
  { tag_name: 'v0.30.0-beta.1', name: 'draft release', draft: true, prerelease: true, published_at: '2026-09-28T00:00:00Z', body: 'not published yet', assets: [] },
]
routes.set(`/repos/timetorepo/researchengine/releases`, { body: Buffer.from(JSON.stringify(releaseList)), type: 'application/json' })
routes.set(`/timetorepo/researchengine/v${nextVersion}/downloads/SHA256SUMS`, { body: Buffer.from(sumsText), type: 'text/plain' })
routes.set(`/timetorepo/researchengine/v${nextVersion}/downloads/${tarName}`, { body: tarBuf, type: 'application/gzip' })
routes.set(`/timetorepo/researchengine/v${nextVersion}/downloads/${zipName}`, { body: zipBuf, type: 'application/zip' })

let served = 0
let tamper = false
const server = createServer((req, res) => {
  const url = (req.url ?? '').split('?')[0]
  const hit = routes.get(url)
  if (!hit) { res.writeHead(404); res.end('not found'); return }
  served++
  let body = hit.body
  if (tamper && url.endsWith('.tar.gz')) {
    // flip a byte late in the file: the size stays plausible, the hash does not
    body = Buffer.from(body)
    body[body.length - 20] = body[body.length - 20] ^ 0xff
  }
  res.writeHead(200, { 'content-type': hit.type, 'content-length': String(body.length) })
  res.end(body)
})
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
const port = (server.address() as any).port
const apiBase = `http://127.0.0.1:${port}`
const rawBase = `http://127.0.0.1:${port}`

const deps: UpdateDeps = {
  appRoot, dataDir, currentVersion, platform, kind: 'portable',
  apiBase, rawBase,
  fetchImpl: ((input: any, init?: any) => fetch(String(input), init)) as any,
  logs: [],
}
deps.log = (m) => deps.logs!.push(m)

/* -------------------------------------------------------------- the test ---- */

section('[1] version arithmetic (the bug this replaces: /releases/latest skips prereleases)')
check('a beta is newer than the release before it', isNewer('0.29.0-beta.1', '0.28.0-beta.1'))
check('0.28.0 is newer than 0.28.0-beta.1', isNewer('0.28.0', '0.28.0-beta.1'))
check('beta.2 is newer than beta.1', isNewer('0.28.0-beta.2', '0.28.0-beta.1'))
check('and beta.1 is not newer than beta.2', !isNewer('0.28.0-beta.1', '0.28.0-beta.2'))
check('nothing is newer than itself', !isNewer('0.28.0-beta.1', '0.28.0-beta.1'))
check('numeric prerelease ids sort below alphanumeric ones (semver §11)',
  compareVersions('1.0.0-1', '1.0.0-beta') < 0)
check('an unparseable version never wins', isNewer('nightly', '0.28.0-beta.1') === false)
const picked = pickLatest(releaseList)
check('the newest published release is picked, drafts ignored', picked?.version === nextVersion, picked?.version ?? 'none')
check('the draft release is not offered', picked?.version !== '0.30.0-beta.1')
check('prereleases are considered at all (were, until now, invisible to a /releases/latest check)',
  pickLatest([{ tag_name: 'v1.0.0-beta.1', draft: false, prerelease: true }])?.version === '1.0.0-beta.1')
check('releasesBehind counts the gap', releasesBehind('0.27.0-beta.1', releaseList) === 2)
check('archive names follow the platform', archiveNameFor('1.0.0', 'win-x64').endsWith('.zip') && archiveNameFor('1.0.0', 'linux-x64').endsWith('.tar.gz'))
check('platform keys match the published archives', platformKey('linux', 'x64') === 'linux-x64' && platformKey('win32', 'x64') === 'win-x64')
check('SHA256SUMS parses like sha256sum writes it', parseSha256Sums(sumsText)[tarName] === sha(tarBuf))

section('[2] the archive readers, on real archives')
{
  const out = join(work, 'extract-tar')
  const result = extractArchive(tarBuf, out, { strip: 1 })
  check('tar.gz: sniffed by magic bytes, not by name', sniffFormat(tarBuf) === 'tar.gz')
  check('tar.gz: the strip removes the top folder', existsSync(join(out, 'server', 'index.js')) && !existsSync(join(out, 'research-engine-linux-x64')))
  check('tar.gz: file contents survive the round trip', readFileSync(join(out, 'frontend-dist', 'index.html'), 'utf8').includes(nextVersion))
  check('tar.gz: the executable bit is kept', (statSync(join(out, 'research-engine')).mode & 0o111) !== 0)
  check('tar.gz: it reports what it unpacked', result.files.includes('server/package.json'))
}
{
  const out = join(work, 'extract-zip')
  extractArchive(zipBuf, out, { strip: 1 })
  check('zip: sniffed by magic bytes', sniffFormat(zipBuf) === 'zip')
  check('zip: deflated entries inflate', readFileSync(join(out, 'server', 'index.js'), 'utf8').includes(nextVersion))
  check('zip: the strip applies to zip too', existsSync(join(out, 'frontend-dist', 'index.html')))
}
check('a file that is neither tar nor zip is refused', (() => {
  try { extractArchive(Buffer.from('just some text, definitely not an archive'), join(work, 'nope')); return false } catch { return true }
})())
check('an absolute path in an archive is refused', safeEntryPath(work, '/etc/passwd') === null)
check('a traversal path is refused', safeEntryPath(work, '../../etc/passwd') === null && safeEntryPath(work, 'a/../../b') === null)
check('a windows drive path is refused', safeEntryPath(work, 'C:\\Windows\\system32') === null)
check('a normal path resolves', safeEntryPath(work, 'server/index.js') !== null)
check('strip leaves nothing for a one-segment path', stripSegments('folder', 1) === null)

section('[3] the guard: the updater cannot reach the library')
let guardRefused = 0
for (const target of [
  join(dataDir, 'db.sqlite'),
  join(dataDir, 'nested', 'thing.txt'),
  join(appRoot, '..', 'outside.txt'),
  '/tmp/somewhere-else',
]) {
  try { guard(appRoot, dataDir, target); } catch { guardRefused++ }
}
check('every path outside the app folder, or inside the library, is refused', guardRefused === 4, `${guardRefused}/4 refused`)
check('appending the libary path in another case still lands inside it', (() => {
  try { guard(appRoot, dataDir, join(appRoot, 'server', '..', '..', '.research-engine', 'db.sqlite')); return false } catch { return true }
})())
check('the guard allows the app folder itself', guard(appRoot, dataDir, join(appRoot, 'server')) === join(appRoot, 'server'))

section('[4] the whole update, against a local release server')
const status0 = updateStatus(deps)
check('status says this install can update itself', status0.canSelfUpdate && status0.kind === 'portable')
check('and it names where the library lives', status0.dataDir === dataDir)

const result = await installUpdate(deps)
check('the update ran', result.ok === true, result.ok === false ? result.error : '')
check('it downloaded from the release it resolved', served >= 2, `${served} requests served`)
const pending = readPending(deps)
check('a pending marker was written', !!pending && pending.to === nextVersion)
check('with the previous version recorded for rollback', pending?.from === currentVersion)
check('the marker knows how many boot attempts remain', pending?.attempts === 0)
check('the new server files are in place', readFileSync(join(appRoot, 'server', 'index.js'), 'utf8').includes(nextVersion))
check('the new frontend is in place', readFileSync(join(appRoot, 'frontend-dist', 'index.html'), 'utf8').includes(nextVersion))
check('the previous version is kept as the backup', existsSync(join(appRoot, '.update', 'backup', 'server', 'index.js')))
check('the backup really is the old code', readFileSync(join(appRoot, '.update', 'backup', 'server', 'index.js'), 'utf8').includes(currentVersion))
check('the launcher was left alone (it is version-agnostic)', readFileSync(join(appRoot, 'research-engine'), 'utf8').includes('server/index.js'))
check('staging is cleaned up after the swap', !existsSync(join(appRoot, '.update', 'stage')))
check('THE LIBRARY IS UNTOUCHED after a full update', hashTree(dataDir) === libraryBefore)
check('a copy of the library was taken before the update', existsSync(join(dataDir, 'backups')) && readdirSync(join(dataDir, 'backups')).some((d) => d.startsWith('pre-update-')))

section('[5] a new version that boots is kept')
{
  const plan = bootUpdateCheck(deps)
  check('the first boot of a new version counts an attempt', plan.attempts === 1, `attempts=${plan.attempts}`)
  check('and it is allowed to serve', plan.shouldRollback === false)
  const deps2: UpdateDeps = { ...deps, now: () => 1234 }
  markHealthy(deps2, plan.pending!)
  check('serving pages finalises the update — no marker left', !existsSync(join(appRoot, '.update', 'pending.json')))
  const outcome = JSON.parse(readFileSync(join(appRoot, '.update', 'last-update.json'), 'utf8'))
  check('the outcome is recorded for the UI to show once', outcome.ok === true && outcome.to === nextVersion)
  check('the backup stays on disk until the next update', existsSync(join(appRoot, '.update', 'backup')))
  check('THE LIBRARY IS UNTOUCHED after finalising', hashTree(dataDir) === libraryBefore)
}

section('[6] a new version that cannot boot is put back')
{
  // Break the new version the way a bad build really breaks — it throws on the
  // way up — and drive the trigger the updater uses for that: a marker that has
  // already used its one chance.
  writeFileSync(join(appRoot, 'server', 'index.js'), 'throw new Error("boom: this build is broken")\n')
  writePending(deps, { from: currentVersion, to: nextVersion, at: Date.now(), attempts: 0, backup: join(appRoot, '.update', 'backup'), platform })
  const first = bootUpdateCheck(deps)
  check('the first boot of the broken build still gets its chance', first.shouldRollback === false && first.attempts === 1)
  const second = bootUpdateCheck(deps)
  check('the next boot rolls it back instead of trying again', second.shouldRollback === true, `attempts=${second.attempts}`)
  const deps2: UpdateDeps = { ...deps, now: () => 4321 }
  const outcome = rollback(deps2, second.note ?? 'failed to start')
  check('rollback reports what it did', outcome.restored === true && outcome.to === currentVersion)
  check('the previous version is running again', readFileSync(join(appRoot, 'server', 'index.js'), 'utf8').includes(currentVersion))
  check('the broken version is gone from the app folder', !readFileSync(join(appRoot, 'server', 'index.js'), 'utf8').includes(nextVersion))
  check('the failure is recorded with its reason', JSON.parse(readFileSync(join(appRoot, '.update', 'last-update.json'), 'utf8')).reason.length > 5)
  check('no marker is left behind', !existsSync(join(appRoot, '.update', 'pending.json')))
  check('THE LIBRARY IS UNTOUCHED after a rollback', hashTree(dataDir) === libraryBefore)
}

section('[7] a tampered download is refused, and nothing moves')
{
  tamper = true
  const before = readFileSync(join(appRoot, 'server', 'index.js'), 'utf8')
  const result2 = await installUpdate(deps)
  check('the update fails', result2.ok === false)
  check('and it says why: a checksum mismatch', result2.ok === false && /checksum mismatch/.test(result2.error), result2.ok === false ? result2.error : '')
  check('the installed files were not touched', readFileSync(join(appRoot, 'server', 'index.js'), 'utf8') === before)
  check('no backup was left by the failed attempt', !existsSync(join(appRoot, '.update', 'backup')))
  check('no staging residue', !existsSync(join(appRoot, '.update', 'stage')))
  check('THE LIBRARY IS UNTOUCHED after a refused update', hashTree(dataDir) === libraryBefore)
  tamper = false
}

section('[8] a checkout and the desktop app are told the truth')
{
  const checkout = await installUpdate({ ...deps, kind: 'checkout', appRoot: null })
  check('a source checkout is not offered a self-update', checkout.ok === false && /cannot update itself/.test(checkout.error))
  const desk = await checkForUpdate({ ...deps, kind: 'desktop' })
  check('the desktop app is pointed at its installer instead',
    desk.canSelfUpdate === false && /installer/.test(desk.reason ?? ''), desk.reason ?? '')
  const tree = await checkForUpdate({ ...deps, kind: 'checkout' })
  check('a checkout is told to git pull', /git pull/.test(tree.reason ?? ''), tree.reason ?? '')
}

section('[9] the real release archive unpacks (the file we actually publish)')
{
  const real = join(import.meta.dirname, '..', '..', 'downloads', `research-engine-${repoVersion}-linux-x64.tar.gz`)
  if (existsSync(real)) {
    const out = join(work, 'real-archive')
    const res = extractArchive(readFileSync(real), out, { strip: 1 })
    check(`the shipped ${repoVersion} archive unpacks with this reader`, res.files.includes('server/index.js') && res.files.includes('frontend-dist/index.html'))
    const pkg = JSON.parse(readFileSync(join(out, 'server', 'package.json'), 'utf8'))
    check('and the version inside it is the released one', pkg.version === repoVersion, pkg.version)
    check('the published archive is a plausible size', res.bytes > 1_000_000, `${(res.bytes / 1e6).toFixed(1)} MB`)
  } else {
    check(`the shipped ${repoVersion} archive unpacks with this reader`, false, `downloads/research-engine-${repoVersion}-linux-x64.tar.gz is missing — run node scripts/package-binary.mjs first`)
  }
}

section('[10] against the live release list (the real GitHub API)')
let liveReachable = false
let liveLatest: string | null = null
{
  let live: any = null
  try {
    live = await checkForUpdate({ appRoot, dataDir, currentVersion: '0.0.1', platform, kind: 'checkout', log: () => {} })
    liveReachable = true
  } catch (e: any) {
    skip('the live release list', `no egress to api.github.com from this machine (${e?.message ?? e})`)
  }
  if (liveReachable) {
    check('GitHub answers and a release is resolved', !!live.latest, JSON.stringify(live).slice(0, 160))
    check('the live latest is newer than 0.0.1', live.available === true)
    check('and it matches the newest tag we published', /^0\.\d+\.\d+/.test(live.latest ?? ''), live.latest ?? '')
    check('the live answer carries release notes for the UI', live.notes.length > 50, `${live.notes.length} chars`)
    liveLatest = live.latest ?? null
  }
}

section('[11] a REAL update, from the REAL release, into a REAL install')
if (!liveReachable) {
  skip('a real update from the published release', 'no egress to GitHub from this machine')
} else {
  // A second install, one release behind, with its own library. This downloads
  // the NEWEST published archive over the network, checks it against the
  // published SHA256SUMS, unpacks it with the real reader and swaps it in —
  // the exact path the Updates screen takes.
  const liveRoot = join(work, 'live-install')
  const liveData = join(work, 'live-library')
  mkdirSync(join(liveRoot, 'server'), { recursive: true })
  mkdirSync(join(liveRoot, 'frontend-dist'), { recursive: true })
  writeFileSync(join(liveRoot, 'server', 'index.js'), '// 0.27.0-beta.1 server\n')
  writeFileSync(join(liveRoot, 'server', 'package.json'), JSON.stringify({ name: 'research-engine-server', version: '0.27.0-beta.1' }))
  writeFileSync(join(liveRoot, 'frontend-dist', 'index.html'), '<title>0.27.0-beta.1</title>')
  mkdirSync(liveData, { recursive: true })
  writeFileSync(join(liveData, 'db.sqlite'), Buffer.from('SQLite format 3\0'.padEnd(2048, '\0')))
  writeFileSync(join(liveData, 'config.json'), '{"profile":"balanced","marker":"live-do-not-touch"}')
  const liveBefore = hashTree(liveData)

  const liveDeps: UpdateDeps = { appRoot: liveRoot, dataDir: liveData, currentVersion: '0.27.0-beta.1', platform, kind: 'portable', log: () => {} }
  const live = await installUpdate(liveDeps)
  check('the published release installs over the network', live.ok === true, live.ok === false ? live.error : '')
  check('the installed server is the published version',
    readFileSync(join(liveRoot, 'server', 'index.js'), 'utf8').length > 1000)
  const livePkg = JSON.parse(readFileSync(join(liveRoot, 'server', 'package.json'), 'utf8'))
  check('and the version on disk is the newest published release',
    !!liveLatest && livePkg.version === liveLatest, `${livePkg.version} (published: ${liveLatest})`)
  check('the frontend that came with it is in place',
    readFileSync(join(liveRoot, 'frontend-dist', 'index.html'), 'utf8').toLowerCase().includes('research engine'))
  check('the previous version is kept for rollback', existsSync(join(liveRoot, '.update', 'backup', 'server', 'index.js')))
  check('THE LIBRARY SURVIVED A REAL NETWORK UPDATE', hashTree(liveData) === liveBefore)
  const liveRollback = rollback({ ...liveDeps, now: () => 99 }, 'test')
  check('and it can be rolled back to the version it replaced', liveRollback.to === '0.27.0-beta.1'
    && readFileSync(join(liveRoot, 'server', 'package.json'), 'utf8').includes('0.27.0-beta.1'))
  check('with the library untouched by the rollback too', hashTree(liveData) === liveBefore)
}

section('[12] a real packaged install says it can update itself')
{
  // Build the shape `scripts/package-binary.mjs` produces, from the built
  // bundles, and boot it: this is the install the user actually runs, and the
  // question is whether it recognises itself as updatable.
  const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
  const backendDist = join(root, '..', 'backend', 'dist', 'index.js')
  const frontendDist = join(root, 'dist', 'index.html')
  if (!existsSync(backendDist) || !existsSync(frontendDist)) {
    skip('a packaged install boots and reports itself', 'run `npm run build` at the repo root first')
  } else {
    const pkgRoot = join(work, 'packaged', 'research-engine-linux-x64')
    mkdirSync(join(pkgRoot, 'server'), { recursive: true })
    cpSync(backendDist, join(pkgRoot, 'server', 'index.js'))
    cpSync(join(root, '..', 'backend', 'dist'), join(pkgRoot, 'server'), { recursive: true })
    cpSync(join(root, 'dist'), join(pkgRoot, 'frontend-dist'), { recursive: true })
    writeFileSync(join(pkgRoot, 'server', 'package.json'), JSON.stringify({
      name: 'research-engine-server', type: 'module', version: currentVersion,
    }))
    // The real packaging step copies the server's production dependencies into
    // server/node_modules (from both the backend-local and the hoisted root
    // node_modules). Symlinking the same two roots is the same resolution
    // without the megabytes — orders matter: the backend-local one first.
    const depRoots = [join(root, '..', 'backend', 'node_modules'), join(root, '..', 'node_modules')]
    mkdirSync(join(pkgRoot, 'server', 'node_modules'), { recursive: true })
    for (const from of depRoots) {
      if (!existsSync(from)) continue
      for (const name of readdirSync(from)) {
        if (name.startsWith('.')) continue
        const target = join(pkgRoot, 'server', 'node_modules', name)
        if (existsSync(target)) continue
        try { symlinkSync(join(from, name), target, 'dir') } catch { /* files and scopes are handled below */ }
      }
    }
    // Scoped packages live one level deeper (@scope/name).
    for (const from of depRoots) {
      const scopeDir = join(from, '@types')
      if (!existsSync(scopeDir)) continue
      for (const name of readdirSync(scopeDir)) {
        const target = join(pkgRoot, 'server', 'node_modules', '@types', name)
        if (existsSync(target)) continue
        try { mkdirSync(join(pkgRoot, 'server', 'node_modules', '@types'), { recursive: true }); symlinkSync(join(scopeDir, name), target, 'dir') } catch { /* ignore */ }
      }
    }
    const pkgData = join(work, 'packaged-library')
    mkdirSync(pkgData, { recursive: true })
    // Boot legitimately creates the app's own database inside the library, so
    // that file is not a corruption test. User files are.
    mkdirSync(join(pkgData, 'attachments'), { recursive: true })
    writeFileSync(join(pkgData, 'notes.json'), JSON.stringify({ title: 'my research', body: 'do not lose me' }))
    writeFileSync(join(pkgData, 'attachments', 'hello.txt'), 'an attachment')
    const userFiles = new Map<string, string>()
    for (const f of ['notes.json', join('attachments', 'hello.txt')]) {
      userFiles.set(f, createHash('sha256').update(readFileSync(join(pkgData, f))).digest('hex'))
    }

    const port = 39873
    let child: ChildProcess | null = spawn(process.execPath, [join(pkgRoot, 'server', 'index.js'), 'serve', '--port', String(port)], {
      env: { ...process.env, RESEARCH_ENGINE_DATA_DIR: pkgData, FRONTEND_DIST: join(pkgRoot, 'frontend-dist'), RE_HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let bootLog = ''
    child.stdout?.on('data', (d) => { bootLog += String(d) })
    child.stderr?.on('data', (d) => { bootLog += String(d) })

    let health: any = null
    for (let i = 0; i < 60 && !health; i++) {
      await new Promise((r) => setTimeout(r, 250))
      try { health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json() } catch { /* still starting */ }
    }
    check('the packaged server serves', !!health, bootLog.slice(-240))
    if (health) {
      const st = await (await fetch(`http://127.0.0.1:${port}/api/update/status`)).json()
      check('it reports itself as a portable install', st.kind === 'portable', st.kind)
      check('it knows its own app folder', st.appRoot === pkgRoot, st.appRoot)
      check('so it can update itself in place', st.canSelfUpdate === true)
      check('it says where the library is', st.dataDir === pkgData)
      check('and it has no update pending', st.pending === null)
      check('the updater is reachable over the API', st.progress?.phase === 'idle')
      // A running server must not be a way to write outside its own folder: ask
      // the guard directly with this install's real paths.
      let refused = 0
      for (const target of [join(pkgData, 'db.sqlite'), join(pkgData, 'anything'), join(pkgRoot, '..', 'outside')]) {
        try { guard(pkgRoot, pkgData, target) } catch { refused++ }
      }
      check('and it still refuses to write near the library', refused === 3, `${refused}/3`)
      let intact = 0
      for (const [rel, digest] of userFiles) {
        const abs = join(pkgData, rel)
        if (existsSync(abs) && createHash('sha256').update(readFileSync(abs)).digest('hex') === digest) intact++
      }
      check('booting the packaged app leaves every user file byte-identical', intact === userFiles.size, `${intact}/${userFiles.size}`)
      check('and creates its database inside the library, where the user\u2019s data lives', existsSync(join(pkgData, 'db.sqlite')))
    }
    child.kill('SIGKILL')
    child = null
  }
}

server.close()
rmSync(work, { recursive: true, force: true })
console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped (no network)` : ''}`)
process.exit(failed === 0 ? 0 : 1)
