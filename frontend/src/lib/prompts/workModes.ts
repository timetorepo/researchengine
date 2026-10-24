/**
 * Work modes: the system prompt that fits what the user is doing right now.
 * Research is the default and adds nothing on top of the master prompt. The
 * other modes layer a short, specific brief on top of it.
 *
 * Keep each brief tight. These ride along on every request, and some models
 * have far less context than others.
 */

export type WorkMode = 'research' | 'coding' | 'design' | 'math'

export const WORK_MODES: { id: WorkMode; label: string }[] = [
  { id: 'research', label: 'Research' },
  { id: 'coding', label: 'Coding' },
  { id: 'design', label: 'Design' },
  { id: 'math', label: 'Math' },
]

export const WORK_MODE_PROMPTS: Record<Exclude<WorkMode, 'research'>, string> = {
  coding: [
    'You are in Coding mode, working inside the user’s project.',
    '- Read the relevant files before you change them. Make the smallest correct change.',
    '- Keep existing conventions, naming and dependencies. Do not add a library without saying why.',
    '- Show edits as complete, runnable code in fenced blocks with the file path above each one.',
    '- When something may fail, say how you verified it (a test, a type check, a run) and what you did not verify.',
    '- Name the risk in one line when a change touches data, auth or the build.',
  ].join('\n'),

  design: [
    'You are in Design mode, working on the user’s running interface.',
    '- Start from what is on screen: the layout, spacing, type scale, contrast and tap targets.',
    '- Give concrete values (px, rem, hex, contrast ratio), not adjectives like "cleaner".',
    '- Offer one recommended direction and at most two alternatives, each with a reason.',
    '- When you change UI code, keep the existing design tokens and components, and say which ones you used.',
    '- Check accessibility on every change: labels, focus states, contrast on both light and dark themes.',
  ].join('\n'),

  math: [
    'You are in Math mode.',
    '- Work step by step. State the method first, then each step, then the result.',
    '- Write maths in LaTeX ($…$ inline, $$…$$ for display).',
    '- Check the answer by substitution, a second method, or a units/sign check, and say which.',
    '- Give exact forms when you can; decimals only at the end, with the rounding stated.',
    '- If a question is ambiguous, state the interpretation you chose before solving it.',
  ].join('\n'),
}

/** The brief for a mode, or '' for research (which adds nothing). */
export function workModePrompt(mode: WorkMode | undefined): string {
  if (!mode || mode === 'research') return ''
  return WORK_MODE_PROMPTS[mode]
}

/**
 * Infer the mode from how a request arrived, unless the caller named one.
 * Design Studio says it is design; a math toggle says math; a request inside
 * a project (the code workspace) says coding; everything else is research.
 */
export function inferWorkMode(opts: { design?: boolean; math?: boolean; project?: string; explicit?: WorkMode }): WorkMode {
  if (opts.explicit) return opts.explicit
  if (opts.design) return 'design'
  if (opts.math) return 'math'
  if (opts.project) return 'coding'
  return 'research'
}
