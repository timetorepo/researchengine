#!/usr/bin/env node
// Put the desktop build workflow where GitHub looks for it.
//
// Why this exists: the CI definition lives in `desktop/ci/desktop.yml` because
// the automation token that maintains this repository can commit everything
// *except* files under `.github/workflows/` (GitHub App installations need the
// extra "Workflows" permission for that). Copying the file into place is a one
// command step for anyone who has the permission:
//
//   node scripts/install-desktop-ci.mjs            # inspect (dry run)
//   node scripts/install-desktop-ci.mjs --write    # copy + git add
//   node scripts/install-desktop-ci.mjs --write --push
//
// Afterwards, `.github/workflows/desktop.yml` runs on every tag (`v*`) or from
// the Actions tab, and publishes `Research Engine_<version>_x64-setup.exe`.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = join(root, 'desktop/ci/desktop.yml')
const dest = join(root, '.github/workflows/desktop.yml')
const args = process.argv.slice(2)
const write = args.includes('--write')
const push = args.includes('--push')
const branch = args.includes('--branch') ? args[args.indexOf('--branch') + 1] : currentBranch()

if (!existsSync(source)) {
  console.error(`missing ${source}`)
  process.exit(1)
}
const body = readFileSync(source, 'utf8')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

console.log(`source : desktop/ci/desktop.yml (${body.split('\n').length} lines)`)
console.log(`target : .github/workflows/desktop.yml`)
console.log(`jobs   : ${[...body.matchAll(/^\s{2}(\w[\w-]*):$/gm)].map((m) => m[1]).filter((j) => !['on', 'steps'].includes(j)).join(', ')}`)
console.log(`version: ${version} → installer "Research Engine_${version}_x64-setup.exe"`)

if (!write) {
  console.log('\ndry run — re-run with --write to install the workflow')
  process.exit(0)
}

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(source, dest)
console.log(`\nwrote ${dest}`)
execSync(`git add .github/workflows/desktop.yml`, { cwd: root, stdio: 'inherit' })
console.log('staged. Commit it, then either push a tag (`git tag v' + version + ' && git push origin v' + version + '`)\nor run the workflow from the Actions tab.')
if (push) {
  console.log(`\n$ git commit -m "ci: desktop installer workflow" && git push origin ${branch}`)
  execSync('git commit -m "ci: desktop installer workflow"', { cwd: root, stdio: 'inherit' })
  execSync(`git push origin ${branch}`, { cwd: root, stdio: 'inherit' })
  console.log('\npushed — watch it with: gh run watch $(gh run list --workflow desktop.yml -L1 --json databaseId -q \'.[0].databaseId\')')
}

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return 'main'
  }
}
