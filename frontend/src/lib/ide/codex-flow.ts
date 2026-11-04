/**
 * The task loop every coding turn follows, modelled on how Codex-style coding
 * agents work: understand the request, look before changing, plan in a few
 * steps, make the smallest change, prove it with the project's own checks, and
 * report in a fixed shape the user can scan.
 *
 * It is appended to the system prompt after the house rules (coding-rules.ts),
 * so the two never disagree: the house rules say what is allowed, this says how
 * to work through a task.
 */

export const CODEX_FLOW = `# Task loop (follow it on every coding turn)
1. Restate the request in one line. If it is ambiguous in a way that changes the work, ask ONE question and stop; otherwise state your assumption and go on.
2. Look before you change. Find the files involved (list, search, read). Name them.
3. Plan in at most 5 short steps. Keep the plan in the reply and tick each step as it is done.
4. Make the smallest change that solves the request, in the project's existing style. Do not reformat or rename code you were not asked to touch.
5. Prove it: run the project's own checks (the test, lint or build script from package.json or the README). Use the real output; never claim a pass you did not see.
6. Finish with exactly these headings, in this order, and omit a heading only if it has nothing under it:
   **Changed** — each file with a few words on why
   **Verified** — the command you ran and its result
   **Not verified** — what you could not check, and why
   **Next** — at most two suggestions, or none

Never run a destructive command (delete, reset, force push, overwrite a file the user did not ask you to change) without asking first. If a step is blocked, say what blocked it and what you need.`

/** A short, scannable reminder of what each intent is for. Used by the task starter and tests. */
export const CODEX_INTENT_IDS = ['fix', 'build', 'refine', 'review'] as const
export type CodexIntentId = typeof CODEX_INTENT_IDS[number]

/**
 * Review does not edit. It reads the change or the file it was pointed at and
 * reports findings with file and line, most serious first. It only edits when
 * the user then asks for a fix.
 */
export const REVIEW_PREAMBLE = 'INTENT: REVIEW. The user wants a critical read, not a change. Read the code in question (and the diff when there is one, via ide_git). Do not edit files. Report findings most-serious first: each one with path:line, what is wrong, why it matters, and the smallest fix. Separate real defects from taste. If you find nothing serious, say so plainly and name what you checked.'

/** The file a project uses to tell the agent how it works, read on every task. */
export const PROJECT_INSTRUCTIONS_FILE = 'AGENTS.md'

/** Enough for real guidance; a longer file is read as its first part. */
export const PROJECT_INSTRUCTIONS_MAX = 4000

/** What a new project starts with. The user edits it; the agent reads it. */
export function projectInstructionsTemplate(name: string): string {
  return `# ${name}

How the coding agent should work in this project. It is read on every task.

## Goal
One or two sentences on what this project is for.

## Commands
- Install: \`npm install\`
- Test: \`npm test\`
- Build: \`npm run build\`

## Conventions
- The style and structure to follow (naming, folders, state, styling).
- What must not change without asking.

## Done means
- The checks above pass, and the change is described in the reply.
`
}

/**
 * The project's AGENTS.md, clipped. Returns '' when there is none or it cannot
 * be read, so a missing file never blocks a turn.
 */
export async function loadProjectInstructions(project: string): Promise<string> {
  try {
    const res = await fetch(`/api/ide/file?project=${encodeURIComponent(project)}&path=${encodeURIComponent(PROJECT_INSTRUCTIONS_FILE)}`)
    if (!res.ok) return ''
    const body = (await res.json()) as { content?: unknown }
    const text = typeof body.content === 'string' ? body.content.trim() : ''
    if (!text) return ''
    return text.length > PROJECT_INSTRUCTIONS_MAX ? `${text.slice(0, PROJECT_INSTRUCTIONS_MAX)}\n…(truncated)` : text
  } catch {
    return ''
  }
}
