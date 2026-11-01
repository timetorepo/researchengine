/**
 * The start of Coding, the way Codex starts: describe what to build and go.
 *
 * Pressing "Build it" creates a project named from the prompt, opens it, and
 * sends the prompt to the AI as a build request. The user does not create a
 * project first. The prompt itself is handed over through lib/ide/pendingBuild.
 */
import { useState } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { createProjectRobust, postJson } from '@/lib/ide/create'
import { projectInstructionsTemplate } from '@/lib/ide/codex-flow'
import { nameFromPrompt, queueBuild } from '@/lib/ide/pendingBuild'
import { TaskSteps } from '@/components/ui/kit/interior/TaskSteps'

export function BuildFromPrompt({ taken, onCreated }: { taken: string[]; onCreated: (name: string) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const prompt = text.trim()
    if (!prompt || busy) return
    setBusy(true)
    setErr('')
    const requested = nameFromPrompt(prompt)
    const outcome = await createProjectRobust(postJson, {
      name: requested,
      fallback: 'new-project',
      files: {
        'README.md': `# ${requested}\n\nCreated with Research Engine Coding from this request:\n\n> ${prompt.replace(/\n+/g, ' ')}\n`,
        'AGENTS.md': projectInstructionsTemplate(requested),
      },
      taken,
      unique: true,
    })
    setBusy(false)
    if (!outcome.ok) {
      setErr(outcome.error ?? 'Could not create the project.')
      return
    }
    const name = outcome.name ?? requested
    queueBuild(name, prompt)
    setText('')
    onCreated(name)
  }

  return (
    <div className="surface p-4 mb-5">
      <label htmlFor="build-from-prompt" className="flex items-center gap-1.5 text-[13px] font-medium mb-2">
        <Wand2 size={14} style={{ color: 'var(--primary)' }} /> What should we build?
      </label>
      <textarea
        id="build-from-prompt"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }}
        rows={3}
        disabled={busy}
        placeholder="Make a habit tracker with a weekly chart and dark mode. The AI creates the project and builds it."
        className="w-full resize-none rounded-[10px] px-3 py-2 text-[13.5px] outline-none"
        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
      />
      {(busy || err) && (
        <div className="mt-3">
          {/* The three steps of creating a project, ticking off as the request goes through. */}
          <TaskSteps
            label="Creating the project"
            steps={[{ label: 'Name the project' }, { label: 'Create the folder and starter files' }, { label: 'Hand the brief to the AI' }]}
            current={busy ? 1 : 2}
            failed={err ? 1 : undefined}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mt-2">
        <p className="text-[11.5px]" style={{ color: err ? 'var(--danger)' : 'var(--text-3)' }}>
          {err || 'Enter starts the build. Shift+Enter adds a line. The project folder is named from your first few words.'}
        </p>
        <button onClick={() => void submit()} disabled={busy || !text.trim()}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-medium disabled:opacity-50"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} {busy ? 'Creating…' : 'Build it'}
        </button>
      </div>
    </div>
  )
}
