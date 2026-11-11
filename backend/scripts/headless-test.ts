/**
 * Checks the Lightpanda headless browsing service.
 *
 *   LIGHTPANDA_BIN=/path/to/lightpanda npx tsx backend/scripts/headless-test.ts
 *
 * The browse checks need a Lightpanda binary and network access to github.com;
 * without LIGHTPANDA_BIN they report the install hint instead of failing.
 */
import { browseWithLightpanda, clampText, findLightpanda, LIGHTPANDA_MAX_CHARS } from '../src/services/headless'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}

async function main() {
  // --- headless browsing ---
  const refused = await browseWithLightpanda('http://localhost:8080/admin')
  check('refuses localhost', !refused.ok && refused.status === 400)
  const refusedFile = await browseWithLightpanda('file:///etc/passwd')
  check('refuses file:// addresses', !refusedFile.ok && refusedFile.status === 400)

  const bin = findLightpanda()
  if (!bin) {
    const r = await browseWithLightpanda('https://github.com/lightpanda-io/browser')
    check('reports the install hint when Lightpanda is missing', !r.ok && r.status === 503 && /install-lightpanda/.test(r.error))
  } else {
    const r = await browseWithLightpanda('https://github.com/lightpanda-io/browser')
    check('renders a public GitHub page to Markdown', r.ok && r.result.text.length > 200, bin)
    if (r.ok) check('reports the URL it opened', r.result.url.startsWith('https://github.com/'))
  }

  const big = clampText('x'.repeat(LIGHTPANDA_MAX_CHARS + 50))
  check('clamps very long pages and says so', big.truncated && big.text.length === LIGHTPANDA_MAX_CHARS)
  check('leaves short pages alone', !clampText('hello').truncated)

  console.log(failed ? `\n${failed} check(s) failed` : '\nALL PASS')
  process.exit(failed ? 1 : 0)
}

main()
