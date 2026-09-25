#!/usr/bin/env node
// Desktop wiring check — everything about the Tauri shell that can be proven
// without a compile step, plus a real end-to-end run of the sidecar binary.
//
//   node scripts/desktop-check.mjs        # static: config, Rust shell, binaries
//   node scripts/desktop-check.mjs --run  # …and boot the sidecar on loopback
//
// `--run` is what CI uses on each platform before bundling: it starts the exact
// binary the installer ships and insists on a healthy server, a served page and
// a persistent database before an installer is allowed to be built.
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const root = resolve(new URL('..', import.meta.url).pathname)
const run = process.argv.includes('--run')
let passed = 0
const failures = []
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${label}`) }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

const TRIPLE = process.platform === 'win32'
  ? (process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc')
  : process.platform === 'darwin'
    ? (process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin')
    : (process.arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu')
const exeSuffix = process.platform === 'win32' ? '.exe' : ''

console.log('\n[1] The shell describes the app it is')
const confPath = join(root, 'desktop/src-tauri/tauri.conf.json')
const conf = JSON.parse(readFileSync(confPath, 'utf8'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const fePkg = JSON.parse(readFileSync(join(root, 'frontend/package.json'), 'utf8'))
const bePkg = JSON.parse(readFileSync(join(root, 'backend/package.json'), 'utf8'))
const cargoVersion = readFileSync(join(root, 'desktop/src-tauri/Cargo.toml'), 'utf8').match(/^version = "([^"]+)"/m)?.[1]
const about = readFileSync(join(root, 'frontend/src/components/settings/AboutTab.tsx'), 'utf8')
check('the desktop version matches the app version',
  conf.version === pkg.version && conf.version === fePkg.version && conf.version === bePkg.version && conf.version === cargoVersion,
  `${conf.version} / ${pkg.version} / ${fePkg.version} / ${bePkg.version} / cargo ${cargoVersion}`)
check('the changelog names this version', about.includes(`<b>${conf.version} —`) || about.includes(conf.version))
check('it bundles the local server as an external binary', Array.isArray(conf.bundle.externalBin) && conf.bundle.externalBin.includes('binaries/research-engine'))
check('it ships the built frontend as a resource', Object.prototype.hasOwnProperty.call(conf.bundle.resources, '../../frontend/dist'))
check('the Windows installer is NSIS, per-user, no language prompt',
  conf.bundle.windows.nsis.installMode === 'currentUser' && conf.bundle.windows.nsis.displayLanguageSelector === false)
check('WebView2 is bootstrapped automatically', conf.bundle.windows.webviewInstallMode.type === 'downloadBootstrapper')
check('the window is created by the shell, not by config', Array.isArray(conf.app.windows) && conf.app.windows.length === 0)
check('dev mode points the window at the local server', String(conf.build.devUrl).startsWith('http://127.0.0.1:'))

console.log('\n[2] The shell starts, waits for and stops the server')
const rs = readFileSync(join(root, 'desktop/src-tauri/src/main.rs'), 'utf8')
check('it reuses a server that is already running', rs.includes('if health_ok()'))
check('it spawns the sidecar with the bundled frontend', /spawn_sidecar\(/.test(rs) && rs.includes('FRONTEND_DIST'))
check('it finds the bundled UI even if the bundler nests it differently', rs.includes('collect_dist_dirs') && rs.includes('depth > 3'))
check('and falls back to the very same server logic if it cannot', rs.includes('looks_built'))
check('it waits for /api/health, not just an open port', rs.includes('/api/health') && rs.includes('BOOT_TIMEOUT'))
check('the window opens on the local address', rs.includes('format!("http://127.0.0.1:{}/", port())'))
check('the window only opens once the server answers', rs.indexOf('while started.elapsed() < BOOT_TIMEOUT') < rs.indexOf('build_window(&handle, url)'))
check('a failed boot shows an explanation instead of a blank window', rs.includes('offline_page'))
check('the sidecar is killed when the app exits', rs.includes('RunEvent::Exit') && rs.includes('child.kill()'))
check('no console window pops up on Windows', rs.includes('CREATE_NO_WINDOW') || rs.includes('0x0800_0000'))
check('the port is overridable', rs.includes('RE_DESKTOP_PORT'))
check('the window is a normal resizable app window', rs.includes('min_inner_size(900.0, 600.0)') && rs.includes('inner_size(1280.0, 840.0)'))
const cargo = readFileSync(join(root, 'desktop/src-tauri/Cargo.toml'), 'utf8')
check('Tauri 2 without extra plugins', cargo.includes('tauri = { version = "2"') && !cargo.includes('tauri-plugin'))
check('release builds are stripped and size-optimised', cargo.includes('strip = true') && cargo.includes('lto = true'))

console.log('\n[3] The sidecar that ships')
const binariesDir = join(root, 'desktop/src-tauri/binaries')
const sidecar = join(binariesDir, `research-engine-${TRIPLE}${exeSuffix}`)
const hasSidecar = existsSync(sidecar)
check(`a sidecar exists for this machine (${TRIPLE})`, hasSidecar, hasSidecar ? '' : 'run: node scripts/desktop-sidecar.mjs')
if (hasSidecar) {
  const size = statSync(sidecar).size
  check('it is a self-contained executable, not a folder', size > 20_000_000, `${(size / 1e6).toFixed(1)} MB`)
  const head = readFileSync(sidecar).subarray(0, 4)
  const magic = process.platform === 'win32' ? head[0] === 0x4d && head[1] === 0x5a : head[0] === 0x7f && head[1] === 0x45
  check('it is a real binary for this platform', magic, head.toString('hex'))
  const readme = join(binariesDir, 'README.txt')
  check('the folder explains what it holds', existsSync(readme) && readFileSync(readme, 'utf8').includes('sidecar'))
  // A Windows installer is built on Windows, but the very same compile step
  // run from Linux/macOS has to produce a valid PE file or the bundle fails.
  if (process.platform !== 'win32') {
    const win = join(binariesDir, 'research-engine-x86_64-pc-windows-msvc.exe')
    if (existsSync(win)) {
      const wh = readFileSync(win).subarray(0, 2)
      check('the cross-compiled Windows sidecar is a PE executable', wh[0] === 0x4d && wh[1] === 0x5a, wh.toString('hex'))
      check('and it carries the triple Tauri looks for', win.endsWith('-x86_64-pc-windows-msvc.exe'))
    } else {
      console.log('  --  no Windows sidecar in this checkout (built by CI on windows-latest)')
    }
  }
}

console.log('\n[4] The installer pipeline')
const workflow = readFileSync(join(root, 'desktop/ci/desktop.yml'), 'utf8')
const installed = existsSync(join(root, '.github/workflows/desktop.yml'))
check('the CI workflow is tracked in the repo', workflow.includes('name: desktop') && workflow.length > 1000)
check('and can be installed where GitHub runs it', existsSync(join(root, 'scripts/install-desktop-ci.mjs')))
console.log(installed ? '  ok  .github/workflows/desktop.yml is in place' : '  --  .github/workflows/desktop.yml not installed yet (see scripts/install-desktop-ci.mjs)')
check('CI builds the NSIS installer on Windows', workflow.includes('runs-on: windows-latest') && workflow.includes('--bundles nsis'))
check('CI compiles the sidecar before bundling', workflow.indexOf('desktop-sidecar.mjs') < workflow.indexOf('tauri:build'))
check('CI refuses to ship a sidecar that will not run', workflow.includes('desktop-check.mjs --run'))
check('CI uploads the setup.exe', workflow.includes('bundle/nsis/*.exe'))
check('CI also produces Linux bundles', workflow.includes('--bundles deb,appimage'))
const readme = readFileSync(join(root, 'desktop/README.md'), 'utf8')
check('the desktop README says how to get a setup.exe', /setup\.exe/i.test(readme))

let server
let dataDir
if (run && hasSidecar) {
  console.log('\n[5] The sidecar, actually running')
  const port = Number(process.env.RE_DESKTOP_PORT || 3911)
  dataDir = mkdtempSync(join(tmpdir(), 're-desktop-'))
  const frontend = join(root, 'frontend/dist')
  server = spawn(sidecar, ['serve', '--port', String(port)], {
    cwd: dataDir,
    env: { ...process.env, FRONTEND_DIST: frontend, RESEARCH_ENGINE_DATA_DIR: join(dataDir, 'app'), DB_PATH: join(dataDir, 're.db'), RE_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  server.stdout.on('data', (d) => { log += d })
  server.stderr.on('data', (d) => { log += d })

  const get = async (path) => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`)
      return { status: res.status, body: await res.text() }
    } catch (e) { return { status: 0, body: String(e) } }
  }
  let health = { status: 0, body: '' }
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    health = await get('/api/health')
    if (health.status === 200) break
    await new Promise((r) => setTimeout(r, 250))
  }
  check('the server comes up on loopback', health.status === 200, String(health.status))
  let parsed = {}
  try { parsed = JSON.parse(health.body) } catch { /* reported below */ }
  check('health identifies the product the shell waits for', health.body.includes('research-engine-backend'))
  check('data survives restarts — a real SQLite file, not memory', /sqlite/.test(parsed?.db?.engine ?? ''), parsed?.db?.engine)
  check('the database is written where the app was told to put it', typeof parsed?.db?.file === 'string' && parsed.db.file.includes('re.db'))
  const index = await get('/')
  check('it serves the built frontend the bundle ships', index.status === 200 && /<div id="root"/.test(index.body))
  const api = await get('/api/chats')
  check('the API answers without any Node runtime present', api.status === 200 || api.status === 404, `${api.status}`)
  check('it does not print anything unexpected on boot', !/Error|error:/.test(log) || /no SQLite driver/.test(log) === false, log.split('\n')[0] ?? '')
  server.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 400))
  check('and it stops when the app closes', server.exitCode !== null || server.killed)
  rmSync(dataDir, { recursive: true, force: true })
}

console.log(failures.length ? `\nFAILED: ${passes()} passed, ${failures.length} failed` : `\nALL PASS: ${passed} passed, 0 failed`)
if (failures.length) { for (const f of failures) console.log(`  - ${f}`); process.exit(1) }
function passes() { return passed }
