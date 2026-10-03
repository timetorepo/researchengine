// The design preview route (dev builds only, ?design=1): every component in
// every state, at the four phone frames plus tablet, under any of the 12
// themes, three text scales, three quality levels. This is the mobile twin of
// the app's Developer Mode UI lab, and the render target for CI screenshot
// diffs (docs/mobile/08 + 10). The component inventory here is the SAME list
// the tests assert on: keep both in step (the test fails if a component listed
// here has no state rendered).
import React, { useMemo, useState } from 'react'
import { THEMES, applyTheme } from '../lib/theme'
import { PressButton, ModeChip, CitationChip, SwitchRow, SegmentedControl, SearchField, SkeletonRow, EmptyState, Snackbar } from '../components/base'
import { ThemeCard, ModelCard, ScopeRow, JobRow, AgentRow, ToolCallCard, QuizChoiceButton } from '../components/cards'
import { Sheet } from '../components/Sheet'
import { Composer } from '../components/Composer'
import { TabBar } from '../components/TabBar'
import { AskSheet } from './AskSheet'
import { Home } from './Home'  // eslint-disable-line
import { Library } from './Library'
import { You } from './You'

export const COMPONENTS = [
  'PressButton', 'ModeChip', 'CitationChip', 'SwitchRow', 'SegmentedControl', 'SearchField',
  'SkeletonRow', 'EmptyState', 'Snackbar', 'ThemeCard', 'ModelCard', 'ScopeRow', 'JobRow',
  'AgentRow', 'ToolCallCard', 'QuizChoiceButton', 'Sheet', 'TabBar', 'TabItem', 'AskButton',
  'Composer', 'ComposerEntry', 'DemoCard', 'Greeting', 'LaneRow', 'PerfCard',
] as const

export const FRAMES = [
  { id: 'small', name: '320×568', w: 320, h: 568 },
  { id: 'phone', name: '390×844', w: 390, h: 844 },
  { id: 'large', name: '412×915', w: 412, h: 915 },
  { id: 'max', name: '430×932', w: 430, h: 932 },
  { id: 'tablet', name: '834×1112', w: 834, h: 1112 },
] as const

const noop = () => undefined

/** All components, all states, once. Reused by the test harness (renderToString). */
export function AllStates() {
  return (
    <div className="preview-body">
      <div className="rowset">
        <PressButton variant="primary">Primary</PressButton>
        <PressButton variant="quiet">Quiet</PressButton>
        <PressButton variant="danger">Danger</PressButton>
        <PressButton variant="accent2">Accent2</PressButton>
        <PressButton variant="primary" disabled>Disabled</PressButton>
        <PressButton variant="quiet" data-loading="1">Loading</PressButton>
      </div>
      <div className="rowset">
        <ModeChip label="Search" active onToggle={noop} />
        <ModeChip label="Quality" onToggle={noop} />
        <ModeChip label="Math" active tone="warning" onToggle={noop} />
        <CitationChip n={3} />
      </div>
      <SwitchRow label="Reduce motion" checked onChange={noop} />
      <SwitchRow label="Sound" hint="Off by default" checked={false} onChange={noop} />
      <SegmentedControl value="a" onChange={noop} options={[{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }, { id: 'c', name: 'Three (off state)' }]} />
      <SearchField value="" onChange={noop} placeholder="Search your library (local)" />
      <SearchField value="hydrogen" onChange={noop} />
      <div className="list"><SkeletonRow /><SkeletonRow lines={1} /></div>
      <EmptyState title="Nothing yet. Your first answer will show up here." action={{ label: 'Ask something', run: noop }} />
      <Snackbar snack={{ id: 1, title: 'Saved to citations', tone: 'success' }} onDismiss={noop} />
      <Snackbar snack={{ id: 2, title: 'Search failed', body: 'SearXNG unreachable; fell back to keyless DDG', tone: 'warning', action: { label: 'Retry', run: noop } }} onDismiss={noop} />
      <Snackbar snack={{ id: 3, title: 'Blocked', body: 'Command matches a hard safety rule', tone: 'error' }} onDismiss={noop} />
      <div className="themegrid">
        {THEMES.slice(0, 4).map((t, i) => <ThemeCard key={t.id} theme={t as any} selected={i === 0} favourite={i === 1} onPick={noop} onFav={noop} />)}
      </div>
      <div className="list">
        <ModelCard provider="OpenAI" model="gpt-4o" state="ready" meta="openai" />
        <ModelCard provider="Ollama" model="llama3.3" state="loading" />
        <ModelCard provider="Anthropic" model="claude" state="error" />
        <ModelCard provider="Custom" model="local endpoint" state="disabled" />
        <ScopeRow scope="library.read" granted onChange={noop} />
        <ScopeRow scope="coding.exec" granted={false} onChange={noop} />
        <JobRow name="Indexing your documents" state="running" progress={0.62} onCancel={noop} />
        <JobRow name="Flood: quantum error correction" state="queued" />
        <JobRow name="Export library" state="done" />
        <JobRow name="Transcribe interview" state="failed" />
        <AgentRow name="Ada" role="Researcher" state="thinking" />
        <AgentRow name="Turing" role="Critic" state="done" color="var(--success)" />
        <ToolCallCard tool="ide_exec" label="Run tests" status="confirm" onApprove={noop} onReject={noop} />
        <ToolCallCard tool="web_search" label="Searched 6 sources" status="ok" />
        <ToolCallCard tool="connector_read" label="Read Drive/thesis.pdf" status="blocked" />
        <ToolCallCard tool="ide_git" label="git commit" status="error" />
      </div>
      <div className="quizchoices">
        {(['default', 'pressed', 'correct', 'wrong', 'disabled'] as const).map((s) => (
          <QuizChoiceButton key={s} state={s} label={`Choice (${s})`} onPick={noop} />
        ))}
      </div>
      <TabBar tab="home" onTab={noop} onAsk={noop} />
      <Sheet inline open onClose={noop} label="Ask Research Engine">
        <Composer variant="sheet" />
      </Sheet>
      <div className="screen-demo">
        <Home onAsk={noop} now={new Date(2026, 0, 1, 23, 30)} />
        <Library />
        <You />
      </div>
    </div>
  )
}

export function DesignPreview() {
  const [themeId, setThemeIdRaw] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [documentReadyOk] = useState(true)
  const setThemeId = (id: string) => { setThemeIdRaw(id); if (documentReadyOk) applyTheme(id, {}) }
  const [frameId, setFrameId] = useState<string>('phone')
  const [scale, setScale] = useState<'100' | '150' | '200'>('100')
  const [quality, setQuality] = useState<'full' | 'lean' | 'minimum'>('full')
  const [showScreens, setShowScreens] = useState(true)
  const [askOpen, setAskOpen] = useState(false)
  const frame = FRAMES.find((f) => f.id === frameId)!

  const rootVars = useMemo(() => ({
    ['--font-scale' as any]: scale === '200' ? 1.35 : scale === '150' ? 1.15 : 1,
  }) as React.CSSProperties, [scale])

  return (
    <div data-theme={themeId} data-quality={quality} data-design="1" style={rootVars} className="preview">
      <header className="preview-controls">
        <strong>Design preview</strong>
        <select aria-label="Theme" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
          {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select aria-label="Frame" value={frameId} onChange={(e) => setFrameId(e.target.value)}>
          {FRAMES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select aria-label="Text size" value={scale} onChange={(e) => setScale(e.target.value as any)}>
          <option value="100">Text 100%</option><option value="150">150%</option><option value="200">200%</option>
        </select>
        <select aria-label="Quality" value={quality} onChange={(e) => setQuality(e.target.value as any)}>
          <option value="full">Full</option><option value="lean">Lean</option><option value="minimum">Minimum</option>
        </select>
        <label className="preview-check"><input type="checkbox" checked={showScreens} onChange={(e) => setShowScreens(e.target.checked)} /> screens</label>
        <button onClick={() => setAskOpen(true)}>Ask sheet</button>
      </header>
      <main className="preview-stage">
        <div className="preview-frame" style={{ width: frame.w, height: frame.h, zoom: Math.min(1, 360 / frame.w) }}>
          <div className="frame-inner">
            <AllStates />
            {showScreens && (
              <>
                <div className="screen-demo"><Home onAsk={noop} /></div>
                <div className="screen-demo"><Library /></div>
                <div className="screen-demo"><You /></div>
              </>
            )}
          </div>
        </div>
      </main>
      <AskSheet open={askOpen} onClose={() => setAskOpen(false)} />
    </div>
  )
}
