// packages/prompts — canonical prompt/skill payloads for every platform.
// The desktop files remain the single writer: this module *extracts* from
// frontend/src/lib/prompts/masters.ts and frontend/src/lib/skills/builtins.ts
// (imported directly under node --experimental-strip-types, so the extraction
// runs the real code, not a text approximation) and writes JSON snapshots.
// The drift test regenerates in memory and compares byte-for-byte: if desktop
// edits a prompt without re-running sync, CI fails with a clear instruction.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export async function extract() {
  const masters = await import(join(here, '..', '..', 'frontend', 'src', 'lib', 'prompts', 'masters.ts'))
  const skills = await import(join(here, '..', '..', 'frontend', 'src', 'lib', 'skills', 'builtins.ts'))
  return {
    meta: {
      extractedBy: 'packages/prompts/extract.mjs',
      masterVersion: masters.MASTER_VERSION,
      keys: masters.MASTERS.map((m) => m.key),
      categories: skills.SKILL_CATEGORIES,
      icons: skills.SKILL_ICONS,
    },
    masters: masters.MASTERS.map((m) => ({ key: m.key, label: m.label, version: m.version, text: m.text })),
    skills: skills.builtinSkills,
  }
}

export function serialize(data) {
  return JSON.stringify(data, null, 2) + '\n'
}

if (process.argv[1]?.endsWith('extract.mjs')) {
  const data = await extract()
  writeFileSync(join(here, 'prompts.json'), serialize(data))
  console.log(`[prompts] wrote prompts.json (${data.masters.length} masters, ${data.skills.length} skills)`)
}
