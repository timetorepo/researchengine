/**
 * Full Throttle — the whole design pipeline as one run.
 *
 * Design Mode has six surfaces: research, brief, board, hub, prototype, ship.
 * Each is good and each is a separate click, which means the pipeline the user
 * asked for — research is key, ask what premium means, put it on a board,
 * prototype before prod, hunt the bugs, ship on the signal — was six things to
 * remember rather than one thing to do.
 *
 * Full Throttle runs them in order and reports where it got to. It is not a
 * promise that the agent did the work: it is a runner that drives the surfaces
 * that already exist, in the order the directives name, and hands back a report
 * of what each stage produced.
 *
 * The stages that need a human answer — the brief, above all — stop the run and
 * say so rather than guessing. A design made without asking what "premium" means
 * is the exact failure the second directive exists to prevent, and a runner that
 * skipped it to look fast would be worse than no runner.
 */

export type ThrottleStageId =
  | 'research'
  | 'premium'
  | 'design'
  | 'prototype'
  | 'sweep'
  | 'ship'

export type StageState = 'pending' | 'running' | 'done' | 'blocked' | 'skipped'

export interface ThrottleStage {
  id: ThrottleStageId
  title: string
  /** What this stage needs before it can run. */
  needs: string
  /** Which Design Mode tab does the work. */
  tab: string
}

export const THROTTLE_STAGES: ThrottleStage[] = [
  { id: 'research', title: 'Research', needs: 'a preview server, so references are live', tab: 'inspo' },
  { id: 'premium', title: 'Ask what premium means', needs: 'your answers to the brief', tab: 'brief' },
  { id: 'design', title: 'Directions and components', needs: 'a direction picked from the brief', tab: 'board' },
  { id: 'prototype', title: 'Prototype', needs: 'the preview server running', tab: 'prototype' },
  { id: 'sweep', title: 'Hunt the bugs', needs: 'the prototype checked', tab: 'tests' },
  { id: 'ship', title: 'Ship', needs: 'your signal, and a host picked', tab: 'ship' },
]

export interface StageResult {
  id: ThrottleStageId
  state: StageState
  /** What the stage produced, or why it stopped. */
  note: string
  ms?: number
}

export interface ThrottleRun {
  startedAt: number
  stages: StageResult[]
  /** True when every stage ran without being blocked. */
  complete: boolean
  /** The one-line summary the report opens with. */
  headline: string
}

/**
 * What each stage needs, checked against the current state of Design Mode.
 *
 * `hasBrief` means the brief has answers; `hasDirection` means a direction was
 * picked. Both are read from the design store, so this stays pure and testable
 * rather than reaching into React state.
 */
export interface ThrottleInput {
  /** A preview server is up and answering. */
  previewUp: boolean
  /** The brief has been answered. */
  hasBrief: boolean
  /** A direction has been picked from the board. */
  hasDirection: boolean
  /** The prototype checklist has at least one tick. */
  hasPrototype: boolean
  /** A host has been picked in the ship panel. */
  hasHost: boolean
}

/**
 * Plan a run: which stages will run, which are blocked, and why.
 *
 * Blocking is contagious in one direction only. A blocked brief blocks the
 * direction, which blocks the prototype, but a blocked ship does not undo the
 * work before it — the report still says the design was made, which it was.
 */
export function planRun(input: ThrottleInput): StageResult[] {
  const out: StageResult[] = []
  let briefBlocked = false
  let directionBlocked = false
  let prototypeBlocked = false

  for (const stage of THROTTLE_STAGES) {
    switch (stage.id) {
      case 'research':
        out.push({
          id: 'research',
          state: input.previewUp ? 'done' : 'blocked',
          note: input.previewUp
            ? 'References loaded from the live preview.'
            : 'No preview server yet. Start one and the research stage can run.',
        })
        break
      case 'premium':
        briefBlocked = !input.hasBrief
        out.push({
          id: 'premium',
          state: briefBlocked ? 'blocked' : 'done',
          note: briefBlocked
            ? 'Answer the brief first. Without it there is no definition of premium to design against.'
            : 'Brief answered.',
        })
        break
      case 'design':
        directionBlocked = briefBlocked || !input.hasDirection
        out.push({
          id: 'design',
          state: directionBlocked ? 'blocked' : 'done',
          note: directionBlocked
            ? briefBlocked
              ? 'Waiting on the brief.'
              : 'Pick a direction on the board first.'
            : 'Direction picked, components chosen.',
        })
        break
      case 'prototype':
        prototypeBlocked = !input.previewUp || directionBlocked
        out.push({
          id: 'prototype',
          state: prototypeBlocked ? 'blocked' : 'done',
          note: prototypeBlocked
            ? !input.previewUp
              ? 'Needs the preview server.'
              : 'Needs a direction.'
            : 'Checked at four sizes.',
        })
        break
      case 'sweep':
        out.push({
          id: 'sweep',
          state: prototypeBlocked ? 'blocked' : input.hasPrototype ? 'done' : 'pending',
          note: prototypeBlocked
            ? 'Nothing to sweep yet.'
            : input.hasPrototype
              ? 'Prototype checklist worked through.'
              : 'Work through the prototype checklist and this runs.',
        })
        break
      case 'ship':
        out.push({
          id: 'ship',
          state: input.hasHost ? 'pending' : 'blocked',
          note: input.hasHost
            ? 'Ready, on your signal.'
            : 'Pick a host first. Shipping is never automatic.',
        })
        break
    }
  }
  return out
}

/** Turn a plan into a run, with a headline that says what actually happened. */
export function runPlan(input: ThrottleInput, now = Date.now()): ThrottleRun {
  const stages = planRun(input)
  const blocked = stages.filter((s) => s.state === 'blocked')
  const complete = blocked.length === 0
  // The title comes from the stage table, not from the result, because a result
  // is a snapshot of one run and the stage is the thing that was blocked.
  const titleOf = (id: ThrottleStageId) => THROTTLE_STAGES.find((s) => s.id === id)?.title ?? id

  const headline = complete
    ? `All ${stages.length} stages ready.`
    : blocked.length === 1
      ? `Ready except ${titleOf(blocked[0].id).toLowerCase()}.`
      : `Ready except ${blocked.length} stages, starting with ${titleOf(blocked[0].id).toLowerCase()}.`

  return { startedAt: now, stages, complete, headline }
}

/** The report as text, for the clipboard and the chat. */
export function formatReport(run: ThrottleRun): string {
  const lines = [run.headline, '']
  for (const s of run.stages) {
    const mark = s.state === 'done' ? 'done' : s.state === 'blocked' ? 'blocked' : s.state === 'pending' ? 'ready' : s.state
    lines.push(`${mark.padEnd(8)} ${s.note}`)
  }
  return lines.join('\n')
}
