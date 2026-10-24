/**
 * Importing a skill, with the scanner standing in the doorway.
 *
 * A skill is instructions and scripts that this app will run with its own
 * permissions, so the flow is: bring it in → scan it → read the verdict → then
 * decide. The scan is not decoration: a `DO_NOT_INSTALL` verdict cannot be
 * clicked past by accident (the install button changes to a deliberate
 * override), and whatever the verdict was, it is stored with the skill and
 * shown in the list from then on.
 *
 * The scanner is NVIDIA's SkillSpector when it is installed, run as a process
 * with `--no-llm` so the skill's contents never leave the machine. When it is
 * not installed, this app's own static pass runs instead and the panel says
 * exactly that, with the install command, rather than implying a full review.
 */
import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  ShieldCheck, ShieldAlert, ShieldX, Upload, FileText, AlertTriangle, Loader2,
  ClipboardPaste, Check, Info, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/heroui/Button'
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/modal'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { nanoid } from 'nanoid'
import type { Skill, SkillSecurity, SkillSecurityFinding } from '@/types'

interface ScannerInfo { available: boolean; how: string; detail: string; install: string }

const ACCEPT = '.md,.markdown,.txt,.json,.yaml,.yml,.js,.ts,.py,.sh'
const MAX_FILES = 40

export function SkillImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ui = useUI()
  const [files, setFiles] = useState<{ path: string; text: string }[]>([])
  const [paste, setPaste] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState<{ scanner: string; scannerNote?: string; install?: string; verdict: SkillSecurity } | null>(null)
  const [info, setInfo] = useState<ScannerInfo | null>(null)
  const [override, setOverride] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setFiles([]); setPaste(''); setName(''); setScan(null); setOverride(false)
    void fetch('/api/skills/scanner').then((r) => r.json()).then(setInfo).catch(() => setInfo(null))
  }, [open])

  const collected = () => {
    const out = [...files]
    if (paste.trim()) out.push({ path: `${(name.trim() || 'SKILL').replace(/\s+/g, '-')}.md`, text: paste })
    return out
  }

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    const next: { path: string; text: string }[] = []
    for (const f of Array.from(list).slice(0, MAX_FILES)) {
      const text = await f.text().catch(() => '')
      next.push({ path: (f as any).webkitRelativePath || f.name, text })
    }
    setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES))
    if (!name && next[0]) setName(guessName(next[0]))
    setScan(null)
  }

  const runScan = async () => {
    const payload = collected()
    if (!payload.length) { ui.toast('Nothing to scan', 'Paste a skill or pick its files first.', 'warning'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/skills/scan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'untitled-skill', files: payload }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'The scan failed')
      setScan({
        scanner: json.scanner,
        scannerNote: json.scannerNote,
        install: json.install,
        verdict: { ...json.verdict, scanner: json.scanner, at: Date.now(), files: json.files, llmUsed: json.verdict?.llmUsed ?? false },
      })
    } catch (e: any) {
      ui.toast('Could not scan', String(e?.message ?? e).slice(0, 160), 'danger')
    } finally { setBusy(false) }
  }

  const install = () => {
    const payload = collected()
    const skillName = name.trim() || guessName(payload[0]) || 'Imported skill'
    const body = payload.find((f) => /skill\.md$/i.test(f.path))?.text ?? payload[0]?.text ?? ''
    const description = frontmatter(body, 'description') || firstLine(body) || 'Imported skill'
    const skill: Skill = {
      id: `sk-${nanoid(8)}`,
      name: frontmatter(body, 'name') || skillName,
      description: description.slice(0, 240),
      promptTemplate: stripFrontmatter(body).slice(0, 8000),
      params: [],
      outputFormat: 'natural',
      category: 'imported',
      icon: 'wand',
      builtin: false,
    }
    useStore.setState((s) => ({
      skills: [...s.skills, skill],
      skillSecurity: scan ? { ...s.skillSecurity, [skill.id]: scan.verdict } : s.skillSecurity,
    }))
    // The record on the server carries the verdict with the import, so the
    // report survives even if the browser's storage is cleared.
    void fetch('/api/skills/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: skill.name, description: skill.description, source: 'import',
        files: payload.length, tags: ['skill', ...(scan ? [scan.verdict.severity.toLowerCase()] : [])],
        security: scan?.verdict ?? null,
      }),
    }).catch(() => null)
    ui.toast('Skill imported', `${skill.name} is in your skills.`, 'success')
    onClose()
  }

  const verdict = scan?.verdict
  const blocked = !!verdict && (verdict.recommendation === 'DO_NOT_INSTALL' || verdict.score > 50) && !override
  const Tone = !verdict ? Info : verdict.score > 50 ? ShieldX : verdict.score > 0 ? ShieldAlert : ShieldCheck
  const tone = !verdict ? 'var(--text-3)' : verdict.score > 50 ? 'var(--danger)' : verdict.score > 0 ? 'var(--warning)' : 'var(--success)'

  return (
    <Modal isOpen={open} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="text-[14px] flex items-center gap-2">
          <Upload size={15} /> Import a skill
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* what you are importing */}
            <div>
              <label className="block text-[11.5px] mb-1.5" style={{ color: 'var(--text-3)' }}>Paste a skill (SKILL.md and friends)</label>
              <textarea
                value={paste}
                onChange={(e) => { setPaste(e.target.value); setScan(null) }}
                placeholder={'---\nname: my-skill\ndescription: what it does\n---\n\nInstructions for the agent…'}
                className="w-full h-[190px] rounded-[12px] px-3 py-2.5 text-[12px] font-mono outline-none resize-none"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden"
                  onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
                <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} startContent={<FileText size={12} />}>
                  Pick files
                </Button>
                <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} startContent={<ClipboardPaste size={12} />}>
                  Or a folder
                </Button>
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{files.length + (paste.trim() ? 1 : 0)} file(s)</span>
              </div>
              {files.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 max-h-[120px] overflow-y-auto">
                  {files.map((f, i) => (
                    <div key={`${f.path}-${i}`} className="flex items-center gap-2 text-[11.5px] px-2 py-1 rounded-[8px]" style={{ background: 'var(--elevated)' }}>
                      <FileText size={11} style={{ color: 'var(--text-3)' }} />
                      <span className="truncate flex-1">{f.path}</span>
                      <span style={{ color: 'var(--text-3)' }}>{f.text.length.toLocaleString()} chars</span>
                    </div>
                  ))}
                </div>
              )}
              <label className="block text-[11.5px] mt-3 mb-1" style={{ color: 'var(--text-3)' }}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What to call this skill"
                className="w-full rounded-[10px] px-3 py-2 text-[12.5px] outline-none"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
            </div>

            {/* what the scanner says */}
            <div className="rounded-[14px] p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Tone size={15} style={{ color: tone }} />
                <span className="text-[12.5px] font-medium flex-1">Security scan</span>
                {scan && (
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
                    {scan.scanner === 'skillspector' ? 'NVIDIA SkillSpector' : 'local static pass'}
                  </span>
                )}
              </div>

              {!scan && (
                <>
                  <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>
                    The skill is scanned before it can be installed. SkillSpector runs with <code className="font-mono">--no-llm</code>, so nothing in it is uploaded anywhere.
                  </p>
                  {info && (
                    <div className="text-[11px] mb-3 flex items-start gap-1.5" style={{ color: info.available ? 'var(--success)' : 'var(--text-3)' }}>
                      {info.available ? <Check size={12} className="mt-0.5" /> : <AlertTriangle size={12} className="mt-0.5" />}
                      <span>
                        {info.available
                          ? <>SkillSpector found ({info.how}).</>
                          : <>SkillSpector is not installed here — this app's own static pass will run instead. <span style={{ color: 'var(--text-3)' }}>{info.install}</span></>}
                      </span>
                    </div>
                  )}
                  <Button size="md" fullWidth onClick={() => void runScan()} disabled={busy || !collected().length}
                    startContent={busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}>
                    {busy ? 'Scanning…' : 'Scan it'}
                  </Button>
                </>
              )}

              {scan && verdict && (
                <>
                  <div className="flex items-end gap-3 mb-2">
                    <span className="text-[28px] font-semibold tabular-nums" style={{ color: tone, letterSpacing: '-0.03em' }}>{verdict.score}</span>
                    <span className="text-[11px] pb-1.5" style={{ color: 'var(--text-3)' }}>/ 100 risk · {verdict.severity}</span>
                    <span className="ml-auto text-[11.5px] font-medium pb-1.5" style={{ color: tone }}>{verdict.recommendation.replace(/_/g, ' ')}</span>
                  </div>
                  {scan.scannerNote && <p className="text-[11px] mb-2 leading-snug" style={{ color: 'var(--text-3)' }}>{scan.scannerNote}</p>}
                  {verdict.findings.length === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
                      No findings in {verdict.files?.length ?? 1} file(s). {scan.scanner === 'skillspector' ? 'This is SkillSpector’s verdict.' : 'This is this app’s static pass, not SkillSpector’s.'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-[190px] overflow-y-auto pr-1">
                      {verdict.findings.map((f: SkillSecurityFinding, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className="px-2 py-1.5 rounded-[9px]" style={{ background: 'var(--elevated)' }}>
                          <div className="flex items-center gap-1.5 text-[11.5px] font-medium">
                            <span className="px-1.5 rounded-full text-[9.5px] uppercase"
                              style={{
                                background: 'var(--surface)',
                                color: String(f.severity ?? '').toLowerCase().includes('high') ? 'var(--danger)'
                                  : String(f.severity ?? '').toLowerCase().includes('med') ? 'var(--warning)' : 'var(--text-3)',
                              }}>{f.severity ?? 'note'}</span>
                            <span className="flex-1 min-w-0 truncate">{f.title ?? f.description ?? f.id ?? 'finding'}</span>
                          </div>
                          {(f.why || f.evidence) && (
                            <p className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>
                              {f.why}{f.file ? ` · ${f.file}${f.line ? `:${f.line}` : ''}` : ''}
                            </p>
                          )}
                          {f.evidence && (
                            <code className="block mt-1 text-[10.5px] font-mono truncate px-1.5 py-1 rounded-[6px]" style={{ background: 'var(--surface)', color: 'var(--text-2)' }}>
                              {f.evidence}
                            </code>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {!verdict.safeToInstall && (
                    <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: 'var(--danger)' }}>
                      <AlertTriangle size={12} className="mt-0.5" />
                      <span>This skill is not recommended for installation. If you install it anyway, do it deliberately.</span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" variant="ghost" onClick={() => void runScan()} disabled={busy}
                      startContent={busy ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}>Scan again</Button>
                    {blocked && (
                      <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
                        <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                        Install it anyway
                      </label>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {scan?.install && !info?.available && (
            <p className="text-[10.5px] mt-3 flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
              <ExternalLink size={11} /> Full scans: <code className="font-mono">{scan.install}</code> — github.com/NVIDIA/SkillSpector
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={install} disabled={!collected().length || blocked}
            startContent={<Upload size={13} />}>
            {blocked ? 'Blocked by the scan' : 'Install the skill'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

/* ------------------------------------------------------------- helpers ---- */

function frontmatter(text: string, key: string): string | null {
  const m = text.match(/^\s*---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return null
  const line = m[1].split(/\r?\n/).find((l) => l.trim().toLowerCase().startsWith(`${key.toLowerCase()}:`))
  return line ? line.slice(line.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '') : null
}
function stripFrontmatter(text: string): string {
  return text.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}
function firstLine(text: string): string {
  return stripFrontmatter(text).split(/\r?\n/).map((l) => l.replace(/^#+\s*/, '').trim()).find(Boolean) ?? ''
}
function guessName(f?: { path: string; text: string }): string {
  if (!f) return 'Imported skill'
  const fromDoc = frontmatter(f.text, 'name')
  if (fromDoc) return fromDoc
  const base = f.path.split('/').filter(Boolean).slice(-2).join(' / ').replace(/\.(md|markdown|txt|json|ya?ml|js|ts|py|sh)$/i, '')
  return base || 'Imported skill'
}
