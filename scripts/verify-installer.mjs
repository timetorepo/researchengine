#!/usr/bin/env node
// Prove the installer CI just built really is an installer.
//
// Runs on the runner, before the artifact is uploaded, so a bundle that is not
// what it claims to be fails the build instead of reaching a user. The findings
// are also emitted as GitHub annotations (and a job summary), which makes them
// readable from the checks API even when job logs cannot be downloaded:
//
//   gh api /repos/<owner>/<repo>/commits/<sha>/check-runs \
//     --jq '.check_runs[] | .. | select(.annotation_level=="notice") | .message'
//
// Usage: node scripts/verify-installer.mjs <windows|linux>
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, appendFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const flavour = (process.argv[2] ?? (process.platform === 'win32' ? 'windows' : 'linux')).toLowerCase()

const bundled = (rel) => {
  const dir = join(root, 'desktop/src-tauri/target/release/bundle', rel)
  if (!existsSync(dir)) return []
  return readdirSync(dir).map((f) => join(dir, f)).filter((f) => statSync(f).isFile())
}

const checks = []
const check = (label, ok, detail = '') => {
  checks.push({ label, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const files = flavour === 'windows'
  ? bundled('nsis').filter((f) => f.endsWith('.exe'))
  : [...bundled('deb').filter((f) => f.endsWith('.deb')), ...bundled('appimage').filter((f) => f.endsWith('.AppImage'))]

check(`the ${flavour} bundler produced something`, files.length > 0, files.map((f) => basename(f)).join(', '))

const report = []
for (const file of files) {
  const buf = readFileSync(file)
  const name = basename(file)
  const mb = (buf.length / 1e6).toFixed(1)
  const sha256 = createHash('sha256').update(buf).digest('hex')
  const head = buf.subarray(0, 4)
  const latin = buf.subarray(0, 2_000_000).toString('latin1')
  const utf16 = buf.subarray(0, 4_000_000).toString('utf16le')

  if (name.endsWith('.exe')) {
    check(`${name} is a Windows executable`, head[0] === 0x4d && head[1] === 0x5a, `magic ${head.toString('hex')}`)
    check(`${name} is an NSIS installer`, /Nullsoft|NSIS/i.test(latin), /Nullsoft/i.test(latin) ? 'Nullsoft NSIS signature' : 'NSIS string')
    check(`${name} carries the product name`, /Research Engine/i.test(utf16) || /Research Engine/i.test(latin))
    check(`${name} is the full app, not a stub`, buf.length > 15_000_000, `${mb} MB`)
  } else if (name.endsWith('.deb')) {
    check(`${name} is a Debian package`, buf.subarray(0, 7).toString() === '!<arch>', `magic ${buf.subarray(0, 7).toString()}`)
    check(`${name} is packed`, buf.length > 10_000_000, `${mb} MB`)
  } else if (name.endsWith('.AppImage')) {
    check(`${name} is an ELF executable`, head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46, `magic ${head.toString('hex')}`)
    check(`${name} bundles the app`, /research-engine|Research Engine/.test(latin) || buf.length > 50_000_000, `${mb} MB`)
  }
  report.push(`${name}  ${mb} MB  sha256 ${sha256}`)
}

const failed = checks.filter((c) => !c.ok)
const summary = report.join('\n')
console.log(`\n${summary}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Installer verification\n\n\`\`\`\n${summary}\n\`\`\`\n`)
}
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\n/g, '%0A')
console.log(`::notice title=${esc(failed.length ? 'installer problems' : 'installer verified')}::${esc(failed.length ? failed.map((f) => `${f.label} ${f.detail}`).join('; ') : summary)}`)
if (failed.length) process.exit(1)
