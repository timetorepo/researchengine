import { readFile, readdir, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { isWithinDir } from '../../preview/paths'

export type ProjectEcosystem = 'node' | 'python' | 'rust' | 'go' | 'unknown'
export type ProjectPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'uv' | 'poetry' | 'pipenv' | 'cargo' | 'go' | 'unknown'

export interface ProjectDependency {
  name: string
  version: string
  kind: 'runtime' | 'development' | 'peer' | 'optional' | 'installed'
  installed: boolean
  installedVersion?: string
}

export interface ProjectDependencyReport {
  ecosystem: ProjectEcosystem
  manager: ProjectPackageManager
  dependencies: ProjectDependency[]
  manifest: string | null
  error?: string
}

async function readText(path: string): Promise<string | null> {
  try { return await readFile(path, 'utf8') } catch { return null }
}

async function exists(path: string): Promise<boolean> {
  try { await realpath(path); return true } catch { return false }
}

function parseRequirements(text: string): Map<string, { version: string; kind: ProjectDependency['kind'] }> {
  const out = new Map<string, { version: string; kind: ProjectDependency['kind'] }>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('-')) continue
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*(.*)$/)
    if (!m) continue
    const version = m[2].trim() || '*'
    out.set(m[1], { version, kind: 'runtime' })
  }
  return out
}

function parsePythonToml(text: string): Map<string, { version: string; kind: ProjectDependency['kind'] }> {
  const out = new Map<string, { version: string; kind: ProjectDependency['kind'] }>()
  const section = text.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)^\s*\]/m)?.[1] ?? ''
  for (const raw of section.matchAll(/["']([^"']+)["']/g)) {
    const m = raw[1].match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*(.*)$/)
    if (m) out.set(m[1], { version: m[2].trim() || '*', kind: 'runtime' })
  }
  const devSection = text.match(/^\s*(?:dev-dependencies|dependency-groups)\s*=\s*\[([\s\S]*?)^\s*\]/m)?.[1] ?? ''
  for (const raw of devSection.matchAll(/["']([^"']+)["']/g)) {
    const m = raw[1].match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*(.*)$/)
    if (m && !out.has(m[1])) out.set(m[1], { version: m[2].trim() || '*', kind: 'development' })
  }
  return out
}

function parseCargo(text: string): Map<string, { version: string; kind: ProjectDependency['kind'] }> {
  const out = new Map<string, { version: string; kind: ProjectDependency['kind'] }>()
  let kind: ProjectDependency['kind'] = 'runtime'
  let section = ''
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const header = line.match(/^\[([^\]]+)\]$/)
    if (header) {
      section = header[1]
      kind = section.includes('dev-dependencies') ? 'development' : section.endsWith('dependencies') ? 'runtime' : 'installed'
      continue
    }
    if (kind === 'installed' || !line || line.startsWith('#')) continue
    const m = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/)
    if (m) out.set(m[1], { version: m[2].trim().replace(/^['"]|['"]$/g, ''), kind })
  }
  return out
}

function parseGo(text: string): Map<string, { version: string; kind: ProjectDependency['kind'] }> {
  const out = new Map<string, { version: string; kind: ProjectDependency['kind'] }>()
  let inBlock = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('require (')) { inBlock = true; continue }
    if (inBlock && line === ')') { inBlock = false; continue }
    const m = line.match(inBlock ? /^([^\s]+)\s+(v[^\s]+)$/ : /^require\s+([^\s]+)\s+(v[^\s]+)$/)
    if (m) out.set(m[1], { version: m[2], kind: 'runtime' })
  }
  return out
}

function managerFor(files: Set<string>, ecosystem: ProjectEcosystem): ProjectPackageManager {
  if (ecosystem === 'node') {
    if (files.has('pnpm-lock.yaml')) return 'pnpm'
    if (files.has('yarn.lock')) return 'yarn'
    if (files.has('bun.lock') || files.has('bun.lockb')) return 'bun'
    return 'npm'
  }
  if (ecosystem === 'python') {
    if (files.has('uv.lock')) return 'uv'
    if (files.has('poetry.lock')) return 'poetry'
    if (files.has('Pipfile.lock')) return 'pipenv'
    return 'pip'
  }
  if (ecosystem === 'rust') return 'cargo'
  if (ecosystem === 'go') return 'go'
  return 'unknown'
}

function safePackageName(name: string): boolean {
  return /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/.test(name)
}

async function installedNodeVersion(projectDir: string, name: string): Promise<string | undefined> {
  if (!safePackageName(name)) return undefined
  const modulesDir = resolve(projectDir, 'node_modules')
  const packageFile = resolve(modulesDir, ...name.split('/'), 'package.json')
  if (!isWithinDir(modulesDir, packageFile)) return undefined
  try {
    const realFile = await realpath(packageFile)
    if (!isWithinDir(projectDir, realFile)) return undefined
    const raw = JSON.parse(await readFile(realFile, 'utf8'))
    return typeof raw.version === 'string' ? raw.version : undefined
  } catch { return undefined }
}

async function pythonSitePackages(projectDir: string): Promise<string[]> {
  const found: string[] = []
  for (const envName of ['.venv', 'venv']) {
    const envDir = resolve(projectDir, envName)
    if (!isWithinDir(projectDir, envDir) || !(await exists(envDir))) continue
    const roots = [join(envDir, 'Lib', 'site-packages'), join(envDir, 'lib', 'site-packages')]
    for (const libName of await readdir(join(envDir, 'lib')).catch(() => [] as string[])) {
      if (/^python\d/.test(libName)) roots.push(join(envDir, 'lib', libName, 'site-packages'))
    }
    for (const root of roots) {
      try {
        const actual = await realpath(root)
        if (!isWithinDir(projectDir, actual)) continue
        const entries = await readdir(root)
        for (const entry of entries) {
          const match = entry.match(/^(.+?)-(\d[^-]*)\.dist-info$/)
          if (match) found.push(`${match[1]}\t${match[2]}`)
        }
      } catch { /* environment or site-packages directory is absent */ }
    }
  }
  return found
}

function pythonPackageKey(name: string): string { return name.toLowerCase().replace(/[-_.]+/g, '-') }

export async function readProjectDependencies(projectDir: string): Promise<ProjectDependencyReport> {
  const files = new Set(await readdir(projectDir).catch(() => [] as string[]))
  let ecosystem: ProjectEcosystem = 'unknown'
  let manifest: string | null = null
  let declared = new Map<string, { version: string; kind: ProjectDependency['kind'] }>()
  let error: string | undefined

  if (files.has('package.json')) {
    ecosystem = 'node'; manifest = 'package.json'
    try {
      const pkg = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf8'))
      for (const [section, kind] of [
        ['dependencies', 'runtime'], ['devDependencies', 'development'],
        ['peerDependencies', 'peer'], ['optionalDependencies', 'optional'],
      ] as const) {
        const values = pkg?.[section]
        if (!values || typeof values !== 'object' || Array.isArray(values)) continue
        for (const [name, version] of Object.entries(values)) {
          if (typeof version === 'string') declared.set(name, { version, kind })
        }
      }
    } catch (e) { error = `package.json could not be read: ${String(e instanceof Error ? e.message : e)}` }
  } else if (files.has('pyproject.toml') || files.has('requirements.txt') || files.has('Pipfile')) {
    ecosystem = 'python'
    manifest = files.has('pyproject.toml') ? 'pyproject.toml' : files.has('requirements.txt') ? 'requirements.txt' : 'Pipfile'
    const req = await readText(join(projectDir, 'requirements.txt'))
    if (req) declared = parseRequirements(req)
    const pyproject = await readText(join(projectDir, 'pyproject.toml'))
    if (pyproject) for (const [name, dep] of parsePythonToml(pyproject)) if (!declared.has(name)) declared.set(name, dep)
  } else if (files.has('Cargo.toml')) {
    ecosystem = 'rust'; manifest = 'Cargo.toml'
    const cargo = await readText(join(projectDir, 'Cargo.toml'))
    if (cargo) declared = parseCargo(cargo)
  } else if (files.has('go.mod')) {
    ecosystem = 'go'; manifest = 'go.mod'
    const go = await readText(join(projectDir, 'go.mod'))
    if (go) declared = parseGo(go)
  }

  const manager = managerFor(files, ecosystem)
  const dependencies: ProjectDependency[] = []
  for (const [name, dep] of declared) {
    const installedVersion = ecosystem === 'node' ? await installedNodeVersion(projectDir, name) : undefined
    dependencies.push({ name, version: dep.version, kind: dep.kind, installed: !!installedVersion, installedVersion })
  }

  if (ecosystem === 'python') {
    const installed = await pythonSitePackages(projectDir)
    const actual = new Map(installed.map((entry) => {
      const [name, version] = entry.split('\t')
      return [pythonPackageKey(name), version] as const
    }))
    for (const dep of dependencies) {
      const version = actual.get(pythonPackageKey(dep.name))
      if (version) { dep.installed = true; dep.installedVersion = version }
    }
  }

  dependencies.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
  return { ecosystem, manager, dependencies, manifest, ...(error ? { error } : {}) }
}
