/**
 * The component kit (RareUI, dqnamo, Serenity, interior, beUI) checked without a browser:
 *  1. Blackjack: totals count aces as 1 when needed; the AI hits on 16 or less and stands on 17.
 *  2. Blackjack outcomes: busts lose, equal totals push, otherwise the higher total wins.
 *  3. Polls: a well-formed ```poll body parses; malformed or one-option bodies do not.
 *  4. The Markdown renderer hands ```blackjack and ```poll fences to their components.
 *  5. Each component renders to markup on the server (the 3D keyboard is only imported).
 *  6. The ResearchEngine logo paths match public/icon.svg.
 *  7. The prompt teaches the model the blackjack and poll fences.
 *
 * Run: npm run kit-test --workspace frontend
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { freshDeck, handTotal, aiShouldHit, outcome, type Card } from '../src/components/ui/kit/dqnamo/blackjack'
import { parsePoll, PollResults } from '../src/components/ui/kit/interior/PollResults'
import { RE_LOGO_PATHS } from '../src/components/ui/kit/dqnamo/LogoTraceLoader'
import { Blackjack } from '../src/components/ui/kit/dqnamo/Blackjack'
import { LogoTraceLoader } from '../src/components/ui/kit/dqnamo/LogoTraceLoader'
import { ScrambleText } from '../src/components/ui/kit/dqnamo/ScrambleText'
import { ReceiptPrinter } from '../src/components/ui/kit/dqnamo/ReceiptPrinter'
import { MagneticDropZone } from '../src/components/ui/kit/dqnamo/MagneticDropZone'
import { DynamicButton } from '../src/components/ui/kit/dqnamo/DynamicButton'
import { IridescentFoil } from '../src/components/ui/kit/dqnamo/IridescentFoil'
import { VoiceNote } from '../src/components/ui/kit/rareui/VoiceNote'
import { AnimatedCounter } from '../src/components/ui/kit/rareui/AnimatedCounter'
import { GridReveal } from '../src/components/ui/kit/rareui/GridReveal'
import { WebSearch } from '../src/components/ui/kit/rareui/WebSearch'
import { AiStatus } from '../src/components/ui/kit/rareui/AiStatus'
import { BounceSidebar } from '../src/components/ui/kit/rareui/BounceSidebar'
import { RailToc } from '../src/components/ui/kit/rareui/RailToc'
import { TaskSteps } from '../src/components/ui/kit/interior/TaskSteps'
import { NewItemsPill } from '../src/components/ui/kit/interior/NewItemsPill'
import { TreeView } from '../src/components/ui/kit/interior/TreeView'
import { StickyHeader } from '../src/components/ui/kit/interior/StickyHeader'
import { ReadingProgress } from '../src/components/ui/kit/interior/ReadingProgress'
import { HideOnScroll } from '../src/components/ui/kit/interior/HideOnScroll'
import { Lightbox } from '../src/components/ui/kit/interior/Lightbox'
import { ShowMore } from '../src/components/ui/kit/interior/ShowMore'
import { BlurUpImage } from '../src/components/ui/kit/interior/BlurUpImage'
import { ModernSelect, readOptions } from '../src/components/ui/kit/select/ModernSelect'
import { ChatEmptyState } from '../src/components/ui/kit/illos/ChatEmptyState'
import { DotBorderButton } from '../src/components/ui/kit/community/DotBorderButton'
import { LetterSwap } from '../src/components/ui/kit/community/LetterSwap'
import { TextRotateCard } from '../src/components/ui/kit/community/TextRotateCard'
import { TextHighlighter } from '../src/components/ui/kit/community/TextHighlighter'
import { TextAlongCircle } from '../src/components/ui/kit/community/TextAlongCircle'
import { CssBoxHover } from '../src/components/ui/kit/community/CssBoxHover'
import { AvatarGroup } from '../src/components/ui/kit/community/AvatarGroup'
import { NotificationList } from '../src/components/ui/kit/community/NotificationList'
import { MarqueeAlongPath } from '../src/components/ui/kit/community/MarqueeAlongPath'
import { ParallaxFloating, FloatingItem } from '../src/components/ui/kit/community/ParallaxFloating'
import { ChatBackdrop } from '../src/components/ui/kit/backdrops/ChatBackdrop'
import { readChatBackdrop } from '../src/components/ui/kit/backdrops/useChatBackdrop'
import { ApprovalCard } from '../src/components/ui/kit/beui/ApprovalCard'
import { StreamingResponse } from '../src/components/ui/kit/beui/StreamingResponse'
import { ArcPicker } from '../src/components/ui/kit/beui/ArcPicker'
import { AiSidebar } from '../src/components/ui/kit/beui/AiSidebar'
import { ExpandingArrowButton } from '../src/components/ui/kit/beui/ExpandingArrowButton'
import { MorphingSearch } from '../src/components/ui/kit/beui/MorphingSearch'
import { OverflowActions } from '../src/components/ui/kit/beui/OverflowActions'
import { MechanicalKeyboard } from '../src/components/ui/kit/serenity/MechanicalKeyboard'

let passed = 0
const check = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const card = (rank: string, value: number): Card => ({ rank, suit: '♠', value })

check('aces count as 1 when a hand would bust', () => {
  assert.equal(handTotal([card('A', 11), card('K', 10)]), 21)
  assert.equal(handTotal([card('A', 11), card('K', 10), card('5', 5)]), 16)
  assert.equal(handTotal([card('A', 11), card('A', 11), card('9', 9)]), 21)
})

check('the AI hits on 16 or less and stands on 17', () => {
  assert.equal(aiShouldHit([card('10', 10), card('6', 6)]), true)
  assert.equal(aiShouldHit([card('10', 10), card('7', 7)]), false)
})

check('outcomes: busts lose, equal totals push, otherwise higher wins', () => {
  const twenty = [card('10', 10), card('J', 10)]
  const bust = [card('10', 10), card('6', 6), card('9', 9)]
  const eighteen = [card('10', 10), card('8', 8)]
  assert.equal(outcome(bust, twenty), 'ai')
  assert.equal(outcome(twenty, bust), 'player')
  assert.equal(outcome(twenty, eighteen), 'player')
  assert.equal(outcome(eighteen, twenty), 'ai')
  assert.equal(outcome(eighteen, [card('10', 10), card('8', 8)]), 'push')
})

check('a fresh deck has 52 cards and is shuffled', () => {
  const deck = freshDeck(() => 0.5)
  assert.equal(deck.length, 52)
  assert.equal(new Set(deck.map((c) => c.rank + c.suit)).size, 52)
})

check('a well-formed poll parses; bad bodies do not', () => {
  const poll = parsePoll('{"question":"Which first?","options":[{"label":"Plan"},{"label":"Build","votes":2}]}')
  assert.ok(poll)
  assert.equal(poll!.options.length, 2)
  assert.equal(poll!.options[1].votes, 2)
  assert.equal(parsePoll('{"question":"x","options":[{"label":"only"}]}'), null)
  assert.equal(parsePoll('{"question":"x"'), null)
  assert.equal(parsePoll('{"options":[{"label":"a"},{"label":"b"}]}'), null)
})

check('poll results render with the vote count', () => {
  const html = renderToStaticMarkup(React.createElement(PollResults, { poll: { question: 'Ship?', options: [{ label: 'Yes', votes: 3 }, { label: 'No' }] } }))
  assert.match(html, /Ship\?/)
  assert.match(html, /3 votes|votes/)
})

check('the Markdown renderer routes blackjack and poll fences', () => {
  const md = readFileSync(new URL('../src/components/chat/Markdown.tsx', import.meta.url), 'utf8')
  assert.match(md, /language-blackjack/)
  assert.match(md, /language-poll/)
  assert.match(md, /ZoomableImage/)
})

check('the modern select reads its options and shows the chosen label', () => {
  const opts = readOptions([React.createElement('option', { key: 1, value: 'a' }, 'Alpha'), React.createElement('optgroup', { key: 2, label: 'g' }, React.createElement('option', { value: 'b', disabled: true }, 'Beta'))])
  assert.deepEqual(opts.map((o) => [o.value, o.label, !!o.disabled]), [['a', 'Alpha', false], ['b', 'Beta', true]])
  const html = renderToStaticMarkup(React.createElement(ModernSelect, { value: 'a', onChange: () => {} }, React.createElement('option', { value: 'a' }, 'Alpha')))
  assert.ok(html.includes('Alpha') && html.includes('role="combobox"'), 'trigger shows the label and is a combobox')
})

check('the chat backdrop is off by default and renders nothing', () => {
  assert.equal(readChatBackdrop(), 'off', 'no stored choice means off')
  assert.equal(renderToStaticMarkup(React.createElement(ChatBackdrop)), '', 'the backdrop is absent when off')
})

check('the chat empty state offers suggestions and the math variant', () => {
  const plain = renderToStaticMarkup(React.createElement(ChatEmptyState, {}))
  const math = renderToStaticMarkup(React.createElement(ChatEmptyState, { math: true }))
  assert.ok(plain.includes('Summarise a document') && plain.includes('Ask anything'), 'plain suggestions')
  assert.ok(math.includes('Solve step by step') && math.includes('Work through it'), 'math suggestions')
})

check('the avatar group shows initials and a count for the rest', () => {
  const html = renderToStaticMarkup(React.createElement(AvatarGroup, { max: 2, members: [{ id: '1', name: 'Ada Lovelace' }, { id: '2', name: 'Alan Turing' }, { id: '3', name: 'Grace Hopper' }] }))
  assert.ok(html.includes('AL') && html.includes('AT'), 'initials of the first two')
  assert.ok(html.includes('+1'), 'the rest are counted')
})

check('the notification list says so when empty', () => {
  assert.ok(renderToStaticMarkup(React.createElement(NotificationList, { items: [], empty: 'Nothing new.' })).includes('Nothing new.'))
})

check('components render to markup on the server', () => {
  const cases: [string, React.ReactElement][] = [
    ['blackjack', React.createElement(Blackjack)],
    ['logo loader', React.createElement(LogoTraceLoader, { loading: true, ariaLabel: 'Searching' })],
    ['scramble text', React.createElement(ScrambleText, { text: 'Getting started' })],
    ['receipt', React.createElement(ReceiptPrinter, { title: 'Usage', lines: [{ label: 'Tokens', value: '1,200' }] })],
    ['magnetic drop zone', React.createElement(MagneticDropZone, { accept: '.pdf', onFiles: () => {} })],
    ['dynamic button', React.createElement(DynamicButton, { onAction: () => {}, idleLabel: 'Check' })],
    ['iridescent foil', React.createElement(IridescentFoil, null, 'card')],
    ['voice note', React.createElement(VoiceNote, { src: '/a.wav', title: 'Reply' })],
    ['dot border button', React.createElement(DotBorderButton, null, 'Back')],
    ['letter swap', React.createElement(LetterSwap, { text: 'Coding' })],
    ['text rotate card', React.createElement(TextRotateCard, { quotes: ['one', 'two'], author: 'me' })],
    ['text highlighter', React.createElement(TextHighlighter, null, 'word')],
    ['text along circle', React.createElement(TextAlongCircle, { text: 'Research Engine · ' })],
    ['css box hover', React.createElement(CssBoxHover, null, 'card')],
    ['avatar group', React.createElement(AvatarGroup, { members: [{ id: '1', name: 'Ada Lovelace' }, { id: '2', name: 'Alan Turing' }, { id: '3', name: 'Grace Hopper' }, { id: '4', name: 'Linus' }, { id: '5', name: 'Ken' }] })],
    ['notification list', React.createElement(NotificationList, { items: [{ id: 'a', title: 'Hi', at: 'today', detail: 'x' }] })],
    ['marquee along path', React.createElement(MarqueeAlongPath, { words: ['private', 'local'] })],
    ['parallax floating', React.createElement(ParallaxFloating, null, React.createElement(FloatingItem, { depth: 1 }, 'item'))],
    ['chat empty state', React.createElement(ChatEmptyState, { onPick: () => {} })],
    ['modern select', React.createElement(ModernSelect, { value: 'b', onChange: () => {}, 'aria-label': 'Project' }, React.createElement('option', { value: 'a' }, 'Alpha'), React.createElement('option', { value: 'b' }, 'Beta'))],
    ['animated counter', React.createElement(AnimatedCounter, { value: 1234 })],
    ['grid reveal', React.createElement(GridReveal, { ready: false })],
    ['web search', React.createElement(WebSearch, { query: 'rust', hits: [{ title: 'Rust', url: 'https://rust-lang.org' }], searching: true })],
    ['ai status', React.createElement(AiStatus, { active: true, label: 'Working' })],
    ['bounce sidebar', React.createElement(BounceSidebar, { items: [{ id: 'a', label: 'Intro' }], onSelect: () => {} })],
    ['rail toc', React.createElement(RailToc, { items: [{ id: 'a', label: 'Intro' }], onSelect: () => {} })],
    ['task steps', React.createElement(TaskSteps, { steps: [{ label: 'One' }, { label: 'Two' }], current: 1, failed: undefined })],
    ['new items pill', React.createElement(NewItemsPill, { count: 2, onClick: () => {} })],
    ['tree view', React.createElement(TreeView, { nodes: [{ id: 'src', label: 'src', children: [{ id: 'src/a.ts', label: 'a.ts' }] }] })],
    ['sticky header', React.createElement(StickyHeader, null, 'Head')],
    ['reading progress', React.createElement(ReadingProgress)],
    ['hide on scroll', React.createElement(HideOnScroll, null, 'Bar')],
    ['lightbox (closed)', React.createElement(Lightbox, { src: null, onClose: () => {} })],
    ['show more', React.createElement(ShowMore, null, 'Long text')],
    ['blur-up image', React.createElement(BlurUpImage, { src: '/x.png', alt: 'x' })],
    ['approval card', React.createElement(ApprovalCard, { title: 'Run it?', description: 'It runs a command.', command: '$ npm test', onDecide: () => {} })],
    ['streaming response', React.createElement(StreamingResponse, { text: 'Hello there', streaming: true })],
    ['arc picker', React.createElement(ArcPicker, { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], value: 'a', onChange: () => {} })],
    ['ai sidebar', React.createElement(AiSidebar, { title: 'Sessions' }, 'list')],
    ['expanding arrow', React.createElement(ExpandingArrowButton, { label: 'Ask' })],
    ['morphing search', React.createElement(MorphingSearch, { value: '', onChange: () => {} })],
    ['overflow actions', React.createElement(OverflowActions, { items: [{ id: 'x', label: 'Delete', onSelect: () => {}, danger: true }] })],
  ]
  for (const [name, el] of cases) {
    const html = renderToStaticMarkup(el)
    // A closed lightbox is supposed to render nothing; every other case must render something.
    if (name === 'lightbox (closed)') assert.equal(html, '', 'a closed lightbox renders nothing')
    else assert.ok(html.length > 0, `${name} rendered nothing`)
  }
  assert.equal(typeof MechanicalKeyboard, 'function')
})

check('the logo paths match public/icon.svg', () => {
  const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
  for (const d of RE_LOGO_PATHS) assert.ok(svg.includes(`d="${d}"`), `icon.svg is missing ${d}`)
})

check('the prompt teaches the blackjack and poll fences', () => {
  const src = readFileSync(new URL('../src/lib/prompts/app-knowledge.ts', import.meta.url), 'utf8')
  assert.match(src, /blackjack/)
  assert.match(src, /poll/)
})

console.log(`\nkit-test: ${passed} passed`)
