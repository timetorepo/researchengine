// packages/types — shared DTO snapshots. Providers and themes are extracted by
// IMPORTING the real desktop modules (node --experimental-strip-types erases
// their `import type` lines, so no alias resolution is needed). Quiz types and
// privacy modes live in type-only unions, so they are captured as lists and
// verified textually by the drift test.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const fe = join(here, '..', '..', 'frontend', 'src')

export async function extract() {
  const registry = await import(join(fe, 'lib', 'providers', 'registry.ts'))
  const meta = await import(join(fe, 'lib', 'themes', 'meta.ts'))
  return {
    meta: { extractedBy: 'packages/types/extract.mjs', product: 'researchengine', version: '0.16.0-beta.1' },
    providers: registry.PROVIDERS.map((p) => ({ ...p })),
    themes: meta.THEMES.map((t) => ({ id: t.id, name: t.name, kind: t.kind, swatches: t.swatches, codeTheme: t.codeTheme })),
    quizTypes: ['mc', 'tf', 'short', 'fill', 'ordering', 'matching'],
    answerModes: ['flow', 'search', 'quality', 'math', 'replicate'],
    privacyModes: ['none', 'private', 'topsecret'],
    glassModes: ['off', 'liquid', 'blur'],
    perfProfiles: ['eco', 'balanced', 'performance'],
  }
}

export function serialize(data) { return JSON.stringify(data, null, 2) + '\n' }

if (process.argv[1]?.endsWith('extract.mjs')) {
  writeFileSync(join(here, 'types.json'), serialize(await extract()))
  console.log('[types] wrote types.json')
}
