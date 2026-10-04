import React from 'react'
import { ShieldCheck, TerminalSquare } from 'lucide-react'

export function CodingTab() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Coding</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        The local-project workbench: edit files, inspect dependencies, run guarded commands, use git and preview changes.
      </p>

      <section className="surface p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={15} style={{ color: 'var(--success)' }} />
          <h3 className="text-[13.5px] font-medium">Command safety</h3>
        </div>
        <ul className="text-[12px] space-y-1" style={{ color: 'var(--text-2)' }}>
          <li>Commands run only inside the open project folder, with secrets stripped from their environment.</li>
          <li>Destructive commands such as sudo, disk tools, pipe-to-shell and force-push are blocked outright.</li>
          <li>Installs, builds, git commits and pushes require your explicit approval before they run.</li>
          <li>Commands have a 60-second timeout and capped output.</li>
        </ul>
      </section>

      <section className="surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <TerminalSquare size={15} style={{ color: 'var(--primary)' }} />
          <h3 className="text-[13.5px] font-medium">Local workspace</h3>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Projects and their files stay in the Research Engine data folder on this machine. The assistant reads and edits files only in the open workspace; preview servers and terminal commands are managed by the local backend.
        </p>
      </section>
    </div>
  )
}
