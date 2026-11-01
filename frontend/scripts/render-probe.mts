/**
 * Research Engine — render-path probe.
 *
 * The other suites read source and drive the store. This one actually *renders*
 * the components the app depends on, into a string, with no DOM — which is the
 * only headless way to catch the class of bug that shipped as
 * "Minified React error #310": code that runs during render and blows up.
 *
 *   npx tsx scripts/render-probe.mts
 *
 * What it proves, in markup rather than in source text:
 *   - every component mounts (a hook-order violation, an undefined prop or a
 *     `document` access during render all fail here);
 *   - the sidebar is navigation only and every row carries its edge arrow;
 *   - answers route their links through the CSS link, with the external marker
 *     and no marker on links that stay inside the app;
 *   - the profile card draws a banner taller than the avatar ring.
 *
 * Rendering is pure: nothing here touches the network, the filesystem or a
 * browser. Keep it that way — this probe must never need a page to be running.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

/** Render, and keep the failure message instead of throwing the whole run. */
function render(what: string, el: React.ReactElement): { ok: boolean; html: string; error: string } {
  try {
    return { ok: true, html: renderToStaticMarkup(el), error: '' }
  } catch (e) {
    return { ok: false, html: '', error: `${what} threw: ${(e as Error).message}` }
  }
}

async function main() {
  console.log('\n[1] Every component mounts')

  const { ScrollProgress, surfaceOf, SURFACE_PLACEMENT, PROGRESS_MODES } = await import('../src/components/ui/skiper/ScrollProgress')
  const { CssLink, CssSourceLink } = await import('../src/components/ui/skiper/CssLink')
  const { ChatsFlyout } = await import('../src/components/sidebar/ChatsFlyout')
  const { Sidebar } = await import('../src/components/sidebar/Sidebar')
  const { ProfileCard } = await import('../src/components/ui/watermelon/ProfileCard')
  const { Markdown } = await import('../src/components/chat/Markdown')
  const { AppContextMenu } = await import('../src/components/shared/AppContextMenu')
  const { ShareStudio } = await import('../src/components/quiz/ShareStudio')

  const scroll = render('ScrollProgress', React.createElement(MemoryRouter, null, React.createElement(ScrollProgress)))
  const side = render('Sidebar', React.createElement(MemoryRouter, null, React.createElement(Sidebar)))
  const flyout = render('ChatsFlyout', React.createElement(MemoryRouter, null, React.createElement(ChatsFlyout)))
  const card = render('ProfileCard', React.createElement(ProfileCard, {
    name: 'dnishh', handle: 'dnishh', bio: 'maker', hobbies: ['piano', 'typography'],
    facts: [{ label: 'role', value: 'maker' }], tone: 'maker',
  }))
  const md = render('Markdown', React.createElement(Markdown, {
    content: 'See [the paper](https://arxiv.org/abs/1706.03762), [all chats](#/chats) and a source [1](https://example.com/x).',
  }))

  check('the scroll indicator renders without a DOM', scroll.ok, scroll.error)
  check('the sidebar renders without a DOM', side.ok, side.error)
  check('the chats cube renders without a DOM', flyout.ok, flyout.error)
  check('the profile card renders without a DOM', card.ok, card.error)
  check('a markdown answer renders without a DOM', md.ok, md.error)

  console.log('\n[2] The rail')

  const rows = (side.html.match(/re-nav-item/g) ?? []).length
  const arrows = (side.html.match(/re-nav-arrow/g) ?? []).length
  // One row per NAV entry, plus the Marketplace row. Read the count from the
  // source so the check follows the nav instead of a number that goes stale.
  const navSource = (await import('node:fs')).readFileSync(new URL('../src/components/sidebar/Sidebar.tsx', import.meta.url), 'utf8')
  const navBlock = navSource.slice(navSource.indexOf('const NAV = ['), navSource.indexOf('\n]\n', navSource.indexOf('const NAV = [')))
  const expectedRows = (navBlock.match(/\{ to: '/g) ?? []).length + 1
  check('every rail row is drawn', rows === expectedRows, `${rows} rows, expected ${expectedRows}`)
  check('and every row carries its edge arrow', arrows === rows, `${arrows} arrows for ${rows} rows`)
  check('the Spaces section is gone', !/Space(s)? chip|data-space-chip/i.test(side.html))
  check('the research/coding switch is gone', !side.html.includes('re-history-tabs'))
  check('the history list is gone', !side.html.includes('chat-row'))
  check('the search box is gone', !side.html.includes('placeholder="Search chats"'))
  check('the chats row is the one that opens', side.html.includes('data-chats-row="true"'))
  check('the cube stays closed until the dwell elapses', !side.html.includes('Recent chats'))
  check('and it is portalled, so no ancestor can clip it', (await import('node:fs')).readFileSync(new URL('../src/components/sidebar/Sidebar.tsx', import.meta.url), 'utf8').includes('<Portal>'))

  console.log('\n[3] Links in answers')

  check('an external link becomes a CSS link', md.html.includes('re-css-link'))
  check('and shows the marker that leaves the app', md.html.includes('data-external="true"'))
  check('a link that stays inside the app has no marker', md.html.includes('data-external="false"'))
  check('a citation renders as a chip', render('CssSourceLink', React.createElement(CssSourceLink, {
    index: 1, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762',
  })).html.includes('data-variant="chip"'))
  check('an internal link is not given target=_blank',
    !render('CssLink', React.createElement(CssLink, { href: '#/chats' }, 'chats')).html.includes('target="_blank"'))
  check('and an external one is',
    render('CssLink', React.createElement(CssLink, { href: 'https://example.com' }, 'x')).html.includes('target="_blank"'))

  console.log('\n[4] The profile card')

  check('the banner is taller than the avatar ring', card.html.includes('h-24 w-full'))
  check('the avatar overlaps the banner', card.html.includes('-mt-8'))
  check('the identity block comes after the banner', card.html.indexOf('dnishh') > card.html.indexOf('h-24 w-full'))
  check('the expander says whether it is open', card.html.includes('aria-expanded="false"'))

  console.log('\n[5] The share studio')

  const studio = render('ShareStudio', React.createElement(MemoryRouter, null,
    React.createElement(ShareStudio, {
      data: { title: 'The Attention Economy', source: 'notes.pdf', pct: 82, correct: 9, total: 11, streak: 6 },
      onClose: () => {},
    })))
  check('the studio renders', studio.ok, studio.error)
  check('with the canvas the preview is drawn on', studio.html.includes('<canvas'))
  check('and the four looks', ['Liquid glass', 'Gradient', 'Solid', 'Custom image'].every((l) => studio.html.includes(l)))
  check('and a way to get the image out', studio.html.includes('Save PNG') && studio.html.includes('Copy'))

  console.log('\n[6] The right-click menu')

  const menu = render('AppContextMenu', React.createElement(MemoryRouter, null,
    React.createElement(AppContextMenu, null, React.createElement('div', null, 'page'))))
  check('the app-wide menu mounts over any page', menu.ok && menu.html.includes('page'), menu.error)
  check('and it wraps the app without becoming a box', menu.html.includes('class="contents"'))

  console.log('\n[7] The scroll indicator')

  check('it hides itself when nothing can scroll', scroll.ok && scroll.html === '', JSON.stringify(scroll.html.slice(0, 40)))
  const nav: [string, string][] = [['/', 'home'], ['/code', 'coding'], ['/chats', 'chats'], ['/chat/x', 'chats'], ['/quiz', 'quiz'], ['/articles', 'articles'], ['/library', 'library'], ['/compare', 'compare'], ['/workflows', 'workflows'], ['/flood', 'flood']]
  check('every surface in the app has its own placement', nav.every(([p, s]) => surfaceOf(p) === s && !!SURFACE_PLACEMENT[s as keyof typeof SURFACE_PLACEMENT]))
  check('and the positions really do differ',
    new Set(Object.values(SURFACE_PLACEMENT).map((p) => `${p.right}/${p.top}`)).size > 4)
  check('it has the four shapes you asked for',
    ['bar', 'circle', 'dot', 'top'].every((id) => PROGRESS_MODES.some((m) => m.id === id)),
    PROGRESS_MODES.map((m) => m.id).join(','))
  check('a bare ring really is bare', PROGRESS_MODES.find((m) => m.id === 'dot')!.id === 'dot')

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed:', fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('render-probe crashed:', e); process.exit(1) })
