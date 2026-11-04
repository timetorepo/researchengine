import React from 'react'
import { ShieldCheck, Timer, Store } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useNavigate } from 'react-router-dom'
import { useUI } from '@/stores/useUI'
import { Input } from '@/components/ui/heroui/Input'
import { Button } from '@/components/ui/heroui/Button'
import { InlineAlert } from '@/components/ui/heroui/InlineAlert'

export const COMMAND_TIMEOUT_DEFAULT = 60
export const COMMAND_TIMEOUT_MIN = 10
export const COMMAND_TIMEOUT_MAX = 300

/** Coding settings. Only settings that the coding backend actually reads live here. */
export function CodingTab() {
  const navigate = useNavigate()
  const sec = useStore((s) => s.settings.coding?.commandTimeoutSec ?? COMMAND_TIMEOUT_DEFAULT)
  const [draft, setDraft] = React.useState(String(sec))
  const [saved, setSaved] = React.useState(false)
  const n = Number(draft)
  const valid = Number.isInteger(n) && n >= COMMAND_TIMEOUT_MIN && n <= COMMAND_TIMEOUT_MAX
  const dirty = valid && n !== sec

  React.useEffect(() => { setDraft(String(sec)) }, [sec])

  const save = () => {
    if (!valid) return
    useStore.setState((s) => ({ settings: { ...s.settings, coding: { ...s.settings.coding, commandTimeoutSec: n } } }))
    setSaved(true)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Coding</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        The Coding workspace: an AI pair-programmer over your local projects, with a guarded terminal and git.
      </p>

      <section className="surface-elevated p-4 mb-5" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Timer size={15} strokeWidth={1.6} style={{ color: 'var(--primary)' }} aria-hidden />
          <h3 className="text-[13.5px] font-semibold">Command time limit</h3>
        </div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
          How long one terminal command may run before it is stopped. Raise it for slow builds or large installs.
          Applies to the terminal and to commands the AI runs.
        </p>
        <div className="flex items-end gap-3">
          <div className="w-[160px]">
            <Input
              label="Seconds"
              type="number"
              value={draft}
              onChange={setDraft}
              description={`${COMMAND_TIMEOUT_MIN}–${COMMAND_TIMEOUT_MAX} seconds`}
              isInvalid={draft !== '' && !valid}
              errorMessage={draft !== '' && !valid ? `Use a whole number from ${COMMAND_TIMEOUT_MIN} to ${COMMAND_TIMEOUT_MAX}.` : undefined}
            />
          </div>
          <Button size="sm" disabled={!dirty} onClick={save}>Save</Button>
          <Button size="sm" variant="ghost" color="default" disabled={sec === COMMAND_TIMEOUT_DEFAULT} onClick={() => { setDraft(String(COMMAND_TIMEOUT_DEFAULT)); useStore.setState((s) => ({ settings: { ...s.settings, coding: { ...s.settings.coding, commandTimeoutSec: COMMAND_TIMEOUT_DEFAULT } } })); setSaved(true) }}>
            Reset to 60
          </Button>
        </div>
        {saved && !dirty && (
          <div className="mt-3">
            <InlineAlert status="success" title="Saved" onClose={() => setSaved(false)}>
              New commands use a {sec}-second limit.
            </InlineAlert>
          </div>
        )}
      </section>

      <section className="surface p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={15} style={{ color: 'var(--success)' }} />
          <h3 className="text-[13.5px] font-medium">Command safety</h3>
        </div>
        <ul className="text-[12px] space-y-1" style={{ color: 'var(--text-2)' }}>
          <li>Every command runs only inside the project folder, with secrets stripped from its environment.</li>
          <li>Destructive commands (rm -rf /, sudo, pipe-to-shell, disk tools, force-push…) are blocked outright, for everyone.</li>
          <li>Mutating commands (installs, builds, git commit/push, file moves) always need your approval first, in the terminal and when the AI asks.</li>
          <li>Output is capped on every run, and the time limit above applies to all of them.</li>
        </ul>
      </section>

      <section className="surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <Store size={15} style={{ color: 'var(--primary)' }} aria-hidden />
          <h3 className="text-[13.5px] font-medium">MCP servers</h3>
        </div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
          MCP servers are installed and managed in Marketplace now, next to the apps they extend.
        </p>
        <Button size="sm" variant="bordered" color="default" onClick={() => { useUI.setState({ settingsOpen: false }); useUI.setState({ connectorsTab: 'mcp' }); navigate('/marketplace') }}>
          Open Marketplace
        </Button>
      </section>
    </div>
  )
}
