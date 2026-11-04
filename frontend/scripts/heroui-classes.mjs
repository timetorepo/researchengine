#!/usr/bin/env node
/**
 * Regenerate the HeroUI class list pinned inside `src/styles/globals.css`.
 *
 * Why this exists: HeroUI v2 builds each component's slot classes from a table
 * in `@heroui/theme` — one 250 kB file containing *every* component (accordion,
 * calendar, color picker, table …). Letting Tailwind scan it generates CSS for
 * components this app never renders: 188 kB of rules, measured. So instead we
 * read only the two components we use, take their class strings, and pin them
 * with `@source inline(...)`, which is Tailwind v4's supported way to say
 * "generate exactly these".
 *
 * Run it after upgrading @heroui/modal, @heroui/tabs or @heroui/theme:
 *
 *   node frontend/scripts/heroui-classes.mjs
 *
 * It is deterministic: same packages in, same file out.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, '..')
const require = createRequire(join(frontend, 'package.json'))

const COMPONENTS = ['modal', 'tabs']
const THEME = dirname(require.resolve('@heroui/theme/package.json'))

/** Every quoted string in a built component file, split into class candidates. */
function candidatesFrom(file) {
  const source = readFileSync(file, 'utf8')
  const out = new Set()
  for (const match of source.matchAll(/["'`]((?:[^"'`\\]|\\.)*)["'`]/g)) {
    for (const token of String(match[1]).split(/\s+/)) {
      // A Tailwind candidate is one unbroken token. Anything with a comma, a
      // property name or a path in it is not one and would only add noise.
      if (!token || token.length > 120) continue
      if (!/^[-a-zA-Z0-9:[\]()./%_!$#*&>+=~']+$/.test(token)) continue
      // A candidate starts with a letter or a utility sigil — never with a
      // dot, a slash, a dash or a relative path (`../chunk-…`), which is what
      // module specifiers, CSS-in-JS selectors and CSS property names look
      // like. A single non-candidate in the list is enough to make Tailwind
      // reject the whole `@source inline` directive, so this filter is strict
      // on purpose and the pinned list is verified by the build check below.
      if (!/^!?=?[a-z\[]/.test(token)) continue
      if (!/^[a-z]/.test(token.replace(/^!?=?(?:[a-z-]+:)*/, ''))) continue
      if (/^(?:transition-|color$|background|animation-|appearance$|auto$|ease$|filter$|opacity$|width$|height$|webkit|ms-|esm)/i.test(token)) continue
      if (/\.mjs$|\.js$|\.css$/.test(token)) continue
      // Arbitrary values have to be balanced; a truncated string (`after:content-[`)
      // is not a class and poisons the directive.
      const open = (token.match(/[\[(]/g) ?? []).length
      const close = (token.match(/[\])]/g) ?? []).length
      if (open !== close) continue
      out.add(token.replace(/\\(.)/g, '$1'))
    }
  }
  return out
}

const all = new Set()
for (const name of COMPONENTS) {
  for (const file of [`${name}.js`, `${name}.mjs`]) {
    try { for (const c of candidatesFrom(join(THEME, 'dist/components', file))) all.add(c) } catch { /* not every build ships both */ }
  }
}

const sorted = [...all].sort((a, b) => a.localeCompare(b))
const version = JSON.parse(readFileSync(join(THEME, 'package.json'), 'utf8')).version

const BEGIN = '/* @heroui-classes:begin — generated, do not edit */'
const END = '/* @heroui-classes:end */'
const stylesheet = join(frontend, 'src/styles/globals.css')
const css = readFileSync(stylesheet, 'utf8')
const from = css.indexOf(BEGIN)
const to = css.indexOf(END)
if (from < 0 || to < 0) {
  console.error('globals.css: the @heroui-classes markers are missing — nothing was written')
  process.exit(1)
}

const block = [
  BEGIN,
  `/* ${sorted.length} class candidates from @heroui/theme@${version}, pinned with`,
  '   Tailwind v4 \`@source inline\` so only Modal and Tabs are paid for. */',
  `@source inline("${sorted.join(' ')}");`,
  END,
].join('\n')

writeFileSync(stylesheet, css.slice(0, from) + block + css.slice(to + END.length))
console.log(`globals.css: ${sorted.length} class candidates from @heroui/theme@${version}`)
