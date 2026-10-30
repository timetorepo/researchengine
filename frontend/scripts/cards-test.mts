/**
 * Result cards, checked without a browser:
 *  1. The catalog has 200–300 cards, every id unique.
 *  2. Connected-app actions route to the right card (SPOTIFY_SEARCH_TRACKS → spotify.search…).
 *  3. A track search becomes a card with cover art, artists, duration and a link.
 *  4. Secret-looking keys never reach a payload; raw JSON never appears in a summary.
 *  5. Failed and empty results become error and empty cards, not dumps.
 *  6. web_search sources become link rows; long text is clipped.
 *
 * Run: npm run cards-test --workspace frontend
 */
import assert from 'node:assert/strict'
import { CARD_SPECS, SPEC_BY_ID, BUILTIN_TOOL_SPEC } from '../src/lib/cards/catalog'
import { buildCardPayload, resolveSpec } from '../src/lib/cards/build'

let passed = 0
const check = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

check('catalog has 200–300 cards with unique ids', () => {
  assert.ok(CARD_SPECS.length >= 200 && CARD_SPECS.length <= 300, `count ${CARD_SPECS.length}`)
  assert.equal(new Set(CARD_SPECS.map((s) => s.id)).size, CARD_SPECS.length)
  for (const s of CARD_SPECS) {
    assert.ok(/^#[0-9A-Fa-f]{6}$/.test(s.accent), `accent ${s.id}`)
    assert.ok(s.headline.length > 0 && s.summary.length > 0, `text ${s.id}`)
  }
})

check('built-in tools each have a card', () => {
  for (const t of ['web_search', 'library_search', 'docs_search', 'connector_search', 'crm_search', 'seo_domain', 'voice_speak', 'ide_run_command']) {
    assert.ok(BUILTIN_TOOL_SPEC[t], t)
  }
})

check('connected-app actions route by name prefix and verb', () => {
  const route = (tool: string) => resolveSpec('composio_run', { tool }).spec.id
  assert.equal(route('SPOTIFY_SEARCH_TRACKS'), 'spotify.search')
  assert.equal(route('GMAIL_FETCH_EMAILS'), 'gmail.list')
  assert.equal(route('NOTION_CREATE_PAGE'), 'notion.create')
  assert.equal(route('GITHUB_DELETE_ISSUE'), 'github.delete')
  assert.equal(route('GOOGLECALENDAR_GET_EVENT'), 'googlecalendar.read')
  assert.equal(route('MICROSOFT_TEAMS_SEND_MESSAGE'), 'microsoft_teams.send')
  assert.equal(route('SLACK_UPDATE_MESSAGE'), 'slack.update')
  assert.ok(SPEC_BY_ID[route('SHOPIFY_LIST_ORDERS')], 'every routed id exists')
  assert.equal(route('UNKNOWNAPP_DO_THING'), 'composio.generic')
})

check('a Spotify track search becomes a card with art, artists, length and a link', () => {
  const data = {
    tracks: {
      total: 42,
      items: [
        {
          name: 'Acid Ritual', artists: [{ name: 'Nightcore Foe' }], duration_ms: 185000,
          album: { name: 'Vein', images: [{ url: 'https://i.scdn.co/image/abc' }] },
          external_urls: { spotify: 'https://open.spotify.com/track/abc' }, id: 'abc', access_token: 'sekret',
        },
        { name: 'Relapse Choir', artists: ['Dub Hex'], duration_ms: 240500, external_urls: { spotify: 'https://open.spotify.com/track/def' } },
      ],
    },
  }
  const card = buildCardPayload({ tool: 'composio_run', args: { tool: 'SPOTIFY_SEARCH_TRACKS' }, text: JSON.stringify(data), data, ok: true })!
  assert.equal(card.specId, 'spotify.search')
  assert.equal(card.status, 'ok')
  assert.equal(card.items.length, 2)
  assert.equal(card.items[0].title, 'Acid Ritual')
  assert.equal(card.items[0].subtitle, 'Nightcore Foe')
  assert.equal(card.items[0].meta, '3:05')
  assert.equal(card.items[0].image, 'https://i.scdn.co/image/abc')
  assert.equal(card.items[0].href, 'https://open.spotify.com/track/abc')
  assert.equal(card.items[1].subtitle, 'Dub Hex')
  assert.equal(card.total, 42)
  assert.match(card.summary, /42 results\. Best: Acid Ritual/)
})

check('secrets and raw JSON never reach the payload', () => {
  const data = { items: [{ title: 'Doc', api_key: 'AKIA-LEAK', password: 'hunter2', token: 'tok', body: '{"nested":true}' }] }
  const card = buildCardPayload({ tool: 'composio_run', args: { tool: 'GOOGLEDRIVE_LIST_FILES' }, text: JSON.stringify(data), data, ok: true })!
  const serialised = JSON.stringify(card)
  assert.ok(!serialised.includes('AKIA-LEAK') && !serialised.includes('hunter2') && !serialised.includes('"tok"'), 'secret leaked')
  assert.ok(!card.summary.includes('{"'), 'raw JSON in summary')
})

check('a failed call is an error card; an empty answer is an empty card', () => {
  const failed = buildCardPayload({ tool: 'composio_run', args: { tool: 'SPOTIFY_SEARCH_TRACKS' }, text: 'The action failed: rate limited', ok: false })!
  assert.equal(failed.status, 'error')
  assert.match(failed.summary, /rate limited/)
  const empty = buildCardPayload({ tool: 'composio_run', args: { tool: 'SPOTIFY_SEARCH_TRACKS' }, text: '{"items":[]}', data: { items: [] }, ok: true })!
  assert.equal(empty.status, 'empty')
  assert.equal(empty.summary, 'Nothing matched.')
})

check('web_search sources become link rows', () => {
  const sources = [
    { title: 'Breakcore history', url: 'https://www.example.org/breakcore', snippet: 'A short history of the genre.' },
    { title: 'Mixes', url: 'https://mixes.example.com/x', snippet: '' },
  ]
  const text = JSON.stringify({ live: true, sources })
  const card = buildCardPayload({ tool: 'web_search', args: { query: 'breakcore' }, text, ok: true })!
  assert.equal(card.specId, 'tool.web_search')
  assert.equal(card.items.length, 2)
  assert.equal(card.items[0].subtitle, 'example.org')
  assert.equal(card.items[0].href, 'https://www.example.org/breakcore')
})

check('long text is clipped and non-https links are dropped', () => {
  const long = 'x'.repeat(900)
  const data = { items: [{ title: long, url: 'javascript:alert(1)', image: 'http://insecure.example/a.png' }] }
  const card = buildCardPayload({ tool: 'composio_run', args: { tool: 'NOTION_SEARCH_PAGES' }, text: '', data, ok: true })!
  assert.ok(card.items[0].title.length <= 120)
  assert.equal(card.items[0].href, undefined)
  assert.equal(card.items[0].image, undefined)
})

console.log(`\ncards-test: ${passed} passed`)
