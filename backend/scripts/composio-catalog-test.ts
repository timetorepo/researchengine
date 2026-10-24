// Composio catalog: live toolkits carry `deprecated` as an object, and must still be
// listed. One request covers up to 1000 apps, and an empty answer is not cached.
import { listApps } from '../src/services/composio'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const KEY = 'ak_catalog_test_1'
let urls: string[] = []
let items: any[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (url: any, init: any) => {
  const headers = init?.headers ?? {}
  if (!String(headers['x-api-key']).startsWith('ak_catalog_test')) {
    return new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 })
  }
  urls.push(String(url))
  return new Response(JSON.stringify({ items, next_cursor: null, total_items: items.length }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}) as typeof fetch

const toolkit = (slug: string, name: string, extra: Record<string, unknown> = {}) => ({
  slug, name, auth_schemes: ['oauth2'], no_auth: false,
  meta: { description: `${name} app`, categories: [{ id: 'productivity', name: 'Productivity' }], tools_count: 3 },
  ...extra,
})

// A live toolkit's `deprecated` is an object, not a boolean.
items = [
  toolkit('github', 'GitHub', { deprecated: { toolkitId: '550e8400-e29b-41d4-a716-446655440000' } }),
  toolkit('gmail', 'Gmail'),
  toolkit('old_app', 'Old App', { deprecated: true }),
]
const r = await listApps(KEY, { refresh: true })
check('a toolkit with a deprecated object is listed', r.ok && r.value.some((a) => a.slug === 'github'), JSON.stringify(r))
check('a toolkit with deprecated: true is hidden', r.ok && !r.value.some((a) => a.slug === 'old_app'))
check('every live app is listed', r.ok && r.value.length === 2, r.ok ? String(r.value.length) : JSON.stringify(r))
check('the catalog asks for 1000 per page', urls.some((u) => u.includes('limit=1000')), urls.join(' '))

// An empty answer is not kept for five minutes.
const KEY2 = 'ak_catalog_test_2'
items = []
urls = []
const empty = await listApps(KEY2, { refresh: true })
check('an empty catalog is returned', empty.ok && empty.value.length === 0)
items = [toolkit('gmail', 'Gmail')]
const again = await listApps(KEY2)
check('a later call asks Composio again instead of the empty cache', again.ok && again.value.length === 1, JSON.stringify(again))

globalThis.fetch = realFetch
console.log(`composio-catalog-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
