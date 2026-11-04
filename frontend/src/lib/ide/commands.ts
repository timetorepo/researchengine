/**
 * Slash commands, the way Claude Code does them.
 *
 * Typing `/` in the composer opens this list; each entry expands into a real
 * instruction with the structure that makes the model useful (inspect first,
 * enumerate evidence, then act) instead of a one-word wish. Commands are
 * grouped by where the idea came from so it is obvious what you are getting:
 * deep review and godmode come from Claude Code's workflow, `/agents` from
 * Codex's parallel runs, `/handoff` from Devin, `/inline` from Cursor.
 */
export type CommandSource = 'claude' | 'codex' | 'devin' | 'cursor'

export interface SlashCommand {
  id: string
  label: string
  summary: string
  source: CommandSource
  /** Shown in the palette so nobody has to guess the shape of the argument. */
  hint?: string
  /** Prompt template. `{{arg}}` is replaced by what the user typed after it. */
  prompt: string
  /** Runs through the agent pool (own working copy) instead of the live folder. */
  asAgent?: boolean
  /** Hand the task to a cloud model rather than the local one. */
  cloud?: boolean
  /** Opens the review surface after the run. */
  review?: boolean
}

export const COMMAND_SOURCE_LABEL: Record<CommandSource, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  devin: 'Devin',
  cursor: 'Cursor',
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'ultrareview',
    label: '/ultrareview',
    summary: 'Deep review of the project: correctness, security, performance, accessibility — with file:line evidence.',
    source: 'claude',
    hint: 'optional path or area',
    prompt: [
      'Run an ULTRA review of {{arg}}.',
      'Pass 1 — map: list the files that matter and what each one does.',
      'Pass 2 — correctness: find real defects (races, off-by-one, unhandled errors, wrong assumptions). Quote file:line for each.',
      'Pass 3 — security: secrets, injection, unsafe shell, traversal, unvalidated input. Quote file:line.',
      'Pass 4 — performance and accessibility: N+1 work, re-render storms, missing labels/roles, contrast.',
      'Then: fix the top three findings yourself with ide_write_file, smallest correct change each, and say what you changed.',
      'Do not invent line numbers: every claim must come from a file you actually read (ide_read_file).',
    ].join('\n'),
  },
  {
    id: 'godmode',
    label: '/godmode',
    summary: 'Maximum effort autonomous build: plan, implement, verify, iterate until it works.',
    source: 'claude',
    hint: 'what to build',
    asAgent: true,
    prompt: [
      'GODMODE: build {{arg}} to a finished, working state, autonomously.',
      '1. Read the project (ide_list_files, then read the files you will touch).',
      '2. Write a short plan as a numbered list, then execute it without asking for permission for each step.',
      '3. Every file you create must be complete and runnable — no placeholders, no TODOs, no "…".',
      '4. Verify with real commands (ide_run_command): install, build, run, test. Show the actual output.',
      '5. If something fails, fix it and re-run until it passes. Never claim success you did not observe.',
      'Finish with: what works, how you proved it (the exact command and its output), and what is left.',
    ].join('\n'),
  },
  {
    id: 'plan',
    label: '/plan',
    summary: 'Read-only plan: the files to touch, the order, the risks.',
    source: 'claude',
    hint: 'the goal',
    prompt: 'Plan {{arg}} but do not edit anything. Inspect the project first, then give: the files to change (with line ranges), the order of the steps, the risks, and how to verify each step.',
  },
  {
    id: 'test',
    label: '/test',
    summary: 'Write and run tests for the change, then show the output.',
    source: 'claude',
    hint: 'path or feature',
    prompt: [
      'Add real tests for {{arg}} (detect the existing framework instead of inventing one; if there is none, pick the lightest idiomatic option and add it).',
      'Cover the happy path, one edge case and one failure case per behaviour.',
      'Run them with ide_run_command and paste the real output. Iterate until they pass.',
    ].join('\n'),
  },
  {
    id: 'fix',
    label: '/fix',
    summary: 'Trace a failure to its cause and fix it at the root.',
    source: 'claude',
    hint: 'symptom or error text',
    prompt: 'Fix this: {{arg}}. Reproduce it first (read the code, run the failing command), state the actual root cause with file:line, then apply the smallest fix that addresses the cause rather than the symptom, and prove the fix by re-running it.',
  },
  {
    id: 'commit',
    label: '/commit',
    summary: 'Review the diff, then commit it with a real message.',
    source: 'claude',
    prompt: 'Review the working tree with ide_git (status, diff), group the changes logically, and propose a commit message. Then commit the staged changes.',
  },
  {
    id: 'security',
    label: '/security',
    summary: 'Security pass: secrets, injection, traversal, unsafe shell.',
    source: 'claude',
    hint: 'optional area',
    prompt: 'Security review of {{arg}}: secrets in code or logs, injection (shell, SQL, HTML), path traversal, unvalidated input, unsafe defaults, missing auth checks. Quote file:line, rate each finding, then fix the critical ones.',
  },
  {
    id: 'agents',
    label: '/agents',
    summary: 'Split the work across parallel agents — each in its own working copy.',
    source: 'codex',
    hint: 'the goal',
    asAgent: true,
    prompt: 'Split {{arg}} into independent workstreams and implement them. Stay inside your own working copy; when the parts must meet, keep the interfaces explicit and documented.',
  },
  {
    id: 'parallel',
    label: '/parallel',
    summary: 'Run the same brief several ways and compare (opens the agent pool).',
    source: 'codex',
    hint: 'the goal',
    asAgent: true,
    prompt: 'Implement {{arg}} as a focused change: smallest surface, complete, tested. Another agent is doing the same brief in its own copy — optimise for a version that is easy to review on its own.',
  },
  {
    id: 'handoff',
    label: '/handoff',
    summary: 'Move this task between the local model and a cloud/API model.',
    source: 'devin',
    hint: 'local | cloud [model]',
    cloud: true,
    prompt: 'Continue this task after a handoff. Summarise the current state of the work in five lines (what is done, what is next, the files involved), then carry on from there.',
  },
  {
    id: 'cloud',
    label: '/cloud',
    summary: 'Hand this task off to a cloud model and keep working there.',
    source: 'devin',
    hint: 'the task',
    cloud: true,
    asAgent: true,
    prompt: 'Handoff: take over {{arg}} as a cloud run. Keep the changes reviewable, state every assumption, and finish with a diff summary.',
  },
  {
    id: 'inline',
    label: '/inline',
    summary: 'Make the edits in place and let me review them file by file.',
    source: 'cursor',
    hint: 'the change',
    prompt: 'Make this change directly in the files: {{arg}}. Keep each edit small and self-contained, preserve the existing style, and after editing list every file you touched with a one-line reason.',
    review: true,
  },
  {
    id: 'refactor',
    label: '/refactor',
    summary: 'Restructure without changing behaviour, then prove it.',
    source: 'cursor',
    hint: 'the area',
    prompt: 'Refactor {{arg}} without changing behaviour. No new features, no renames beyond what the refactor needs. After the edit, run the tests or the app and show the output that proves behaviour is unchanged.',
  },
  {
    id: 'explain',
    label: '/explain',
    summary: 'Explain how the code works, from the files themselves.',
    source: 'cursor',
    hint: 'file or feature',
    prompt: 'Explain {{arg}} by reading the actual files: the flow, the data, the sharp edges. Quote file:line. If something is genuinely unclear from the code, say so instead of guessing.',
  },
  {
    id: 'doc',
    label: '/doc',
    summary: 'Write the README/usage docs for what exists.',
    source: 'cursor',
    prompt: 'Write documentation for {{arg}}: what it does, how to run it, the configuration, and one worked example. Base every statement on the code you read; mark anything you could not verify as unverified.',
  },
]

/** Entries matching what the user has typed after the slash. */
export function matchCommands(query: string): SlashCommand[] {
  const q = query.replace(/^\//, '').trim().toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS
    .map((c) => {
      const id = c.id.toLowerCase()
      const score = id === q ? 100 : id.startsWith(q) ? 80 : id.includes(q) ? 60
        : c.summary.toLowerCase().includes(q) ? 30 : 0
      return { c, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id))
    .map((x) => x.c)
}

/** Split "/ultrareview src/api" into the command and its argument. */
export function parseCommand(text: string): { command: SlashCommand; arg: string } | null {
  const m = /^\/([a-z][a-z-]*)\s*([\s\S]*)$/i.exec(text.trim())
  if (!m) return null
  const command = SLASH_COMMANDS.find((c) => c.id === m[1].toLowerCase())
  if (!command) return null
  return { command, arg: m[2].trim() }
}

/** The prompt a command expands into, with the argument folded in. */
export function expandCommand(command: SlashCommand, arg: string): string {
  const insert = arg || 'the current project'
  return command.prompt.replace(/\{\{arg\}\}/g, insert)
}

/** True when the composer text is a slash command being typed (menu open). */
export function isCommandDraft(text: string): boolean {
  const t = text.trimStart()
  return t.startsWith('/') && !t.includes('\n') && t.length <= 24
}
