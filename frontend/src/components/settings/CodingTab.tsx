import React from 'react'
import { ShieldCheck, Plug } from 'lucide-react'

export function CodingTab() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Coding</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        The Coding workspace: an AI pair-programmer over your local projects, with a guarded terminal, git, and MCP tool servers.
      </p>

      <section className="surface p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={15} style={{ color: 'var(--success)' }} />
          <h3 className="text-[13.5px] font-medium">Command safety</h3>
        </div>
        <ul className="text-[12px] space-y-1" style={{ color: 'var(--text-2)' }}>
          <li>Every command runs only inside the project folder, with secrets stripped from its environment.</li>
          <li>Destructive commands (rm -rf /, sudo, pipe-to-shell, disk tools, force-push…) are blocked outright — never runnable, by anyone.</li>
          <li>Mutating commands (installs, builds, git commit/push, file moves) always require your explicit approval first — in the terminal and when the AI asks.</li>
          <li>60-second timeout and output caps on every run.</li>
        </ul>
      </section>

      <section className="surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <Plug size={15} style={{ color: 'var(--primary)' }} />
          <h3 className="text-[13.5px] font-medium">MCP servers</h3>
        </div>
        <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
          MCP servers live in the Coding workspace now, where they are used: open a project and choose the
          plug in the left rail. You will find your configured servers, recommended servers with one-click
          installs, and links to the open MCP registries. Nothing here is configured from Settings anymore.
        </p>
      </section>
    </div>
  )
}
