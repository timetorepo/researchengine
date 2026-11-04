/**
 * Mirror the ENTIRE persona archive onto this machine.
 *
 * The repo vendors the flagship prompts and a manifest naming every file;
 * this script completes the picture on any machine with GitHub access by
 * shallow-cloning asgeirtj/system_prompts_leaks into the app's data dir.
 * The persona library then reads full text for every entry, offline.
 *
 * Usage: node scripts/sync-personas.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const base = process.env.RE_DATA_DIR || join(homedir(), '.research-engine')
const dir = join(base, 'personas-upstream')
const tmp = `${dir}.new`

rmSync(tmp, { recursive: true, force: true })
mkdirSync(base, { recursive: true })
console.log(`[personas] cloning into ${tmp}`)
execFileSync('git', ['clone', '--depth=1', 'https://github.com/asgeirtj/system_prompts_leaks.git', tmp], { stdio: 'inherit' })
rmSync(join(tmp, '.git'), { recursive: true, force: true })
rmSync(dir, { recursive: true, force: true })
renameSync(tmp, dir)
console.log(`[personas] done. The library now serves the full archive from ${dir}`)
