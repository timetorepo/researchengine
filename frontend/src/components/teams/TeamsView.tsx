import { useEffect, useRef, useState } from 'react'
import { Users, ShieldCheck, Unplug } from 'lucide-react'
import { TeamClient, TeamJoin, TeamClientError, type TeamEndpoint } from '@/lib/teams/client'
import { inspectPortableCredential, sealPortableCredential, unlockPortableCredential } from '../../../../shared/teams/portable-credential'
import { activeNamespace } from '@/lib/security/lock'
import { boardWritesFrozen } from '@/lib/board/storage'
import './teams.css'

const config = { native: false, timeoutMs: 15000, responseBytes: 2 * 1024 * 1024 }
type Identity = ReturnType<TeamClient['identity']>
export function TeamsView() {
  const [namespace] = useState(activeNamespace)
  const [origin, setOrigin] = useState(''), [team, setTeam] = useState(''), [invitation, setInvitation] = useState('')
  const [review, setReview] = useState<TeamEndpoint>(), [identity, setIdentity] = useState<Identity>()
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('Not connected. No Team request has been made.')
  const [artifact, setArtifact] = useState<Uint8Array>(), [artifactMeta, setArtifactMeta] = useState<TeamEndpoint>(), [password, setPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('')
  const [counts, setCounts] = useState<{ sequence: number; boards: number; posts: number }>()
  const join = useRef<TeamJoin | undefined>(undefined), client = useRef<TeamClient | undefined>(undefined), controller = useRef<AbortController | undefined>(undefined), alive = useRef(true), generation = useRef(0)
  const scoped = () => alive.current && activeNamespace() === namespace && !boardWritesFrozen()
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; controller.current?.abort(); client.current?.disconnect(); join.current = undefined } }, [])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (client.current || join.current) { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [])
  function resetReview() {
    if (busy || client.current) return
    join.current = undefined; setReview(undefined); setConsent(false); setError('')
  }
  function failure(e: unknown) {
    return e instanceof TeamClientError ? `Teams request failed (${e.code}). Check the host, trusted HTTPS certificate, exact allowed UI origin and session/invitation validity. No automatic retry or certificate bypass.` : e instanceof Error && e.message.startsWith('Could not unlock Teams') ? e.message : 'Teams action could not finish. Check the reviewed destination, file and passphrase. No automatic retry.'
  }
  function prepare() {
    if (busy || !scoped()) return
    setError(''); setConsent(false)
    try {
      if (artifact) {
        if (origin !== artifactMeta?.origin || team !== artifactMeta.team) throw new Error('Destination differs from credential file')
        setReview({ origin, team }); setStatus('Review credential destination and host trust. No network request yet.')
      } else {
        join.current = TeamJoin.prepare({ origin, team }, invitation, config)
        setReview({ origin, team }); setInvitation(''); setStatus('Invitation prepared in memory. Review the exact destination before redeeming.')
      }
    } catch (e) { join.current = undefined; setReview(undefined); setError(failure(e)) }
  }
  async function connect() {
    if (!consent || !review || busy || !scoped() || controller.current) return
    const abort = new AbortController(), epoch = ++generation.current
    controller.current = abort; setBusy(true); setError(''); setConsent(false)
    let connected: TeamClient | undefined
    try {
      if (artifact) connected = await unlockPortableCredential(artifact, password, review, config)
      else {
        const pending = join.current; join.current = undefined
        if (!pending) throw new Error('Prepare a fresh invitation')
        connected = await pending.confirm({ reviewedOrigin: review.origin, reviewedTeam: review.team, acceptHostTrust: true, acceptSingleUse: true }, abort.signal)
      }
      if (!scoped() || abort.signal.aborted || epoch !== generation.current) { connected.disconnect(); return }
      // Join already succeeded if this read fails: retain credentials for explicit
      // refresh/export, rather than discarding the only single-use join response.
      client.current = connected; setIdentity(connected.identity()); setPassword(''); setConfirmPassword(''); setArtifact(undefined); setArtifactMeta(undefined); setReview(undefined)
      try {
        const result = await connected.read(abort.signal)
        if (scoped() && epoch === generation.current && !abort.signal.aborted) { setIdentity(connected.identity()); setCounts({ sequence: result.state.sequence, boards: result.state.boards.length, posts: result.state.posts.length }); setStatus('Connected. Shared state read completed; no private local content was imported.') }
      } catch (e) {
        if (scoped() && epoch === generation.current) { setError(failure(e)); setStatus('Credential is held in memory; shared state could not be verified. Export it or explicitly refresh. Joining was not retried.') }
      }
    } catch (e) {
      connected?.disconnect()
      if (scoped() && epoch === generation.current) { setError(failure(e)); setReview(undefined); setPassword(''); setStatus(artifact ? 'Not connected. Explicitly review and unlock the file again.' : 'Join outcome is uncertain: the invitation may have been consumed. Ask the host to review/revoke the session and issue a new invitation; do not blindly redeem it again.') }
    } finally { if (controller.current === abort) controller.current = undefined; if (alive.current && epoch === generation.current) setBusy(false) }
  }
  function disconnect() {
    generation.current++; controller.current?.abort(); controller.current = undefined; client.current?.disconnect(); client.current = undefined; join.current = undefined
    setBusy(false); setIdentity(undefined); setCounts(undefined); setReview(undefined); setConsent(false); setInvitation(''); setPassword(''); setConfirmPassword(''); setArtifact(undefined); setArtifactMeta(undefined); setError(''); setStatus('Disconnected locally. The host session was not revoked. No reconnect runs automatically.')
  }
  async function refresh() {
    if (!client.current || busy || !scoped() || controller.current) return
    const current = client.current, epoch = generation.current, abort = new AbortController()
    controller.current = abort; setBusy(true); setError('')
    try { const result = await current.read(abort.signal); if (scoped() && epoch === generation.current) { setIdentity(current.identity()); setCounts({ sequence: result.state.sequence, boards: result.state.boards.length, posts: result.state.posts.length }); setStatus('Shared state refreshed from the host. No automatic polling.') } }
    catch (e) { if (scoped() && epoch === generation.current) { setError(failure(e)); setStatus('Refresh failed. Previous counts are a stale snapshot, not live state.') } }
    finally { if (controller.current === abort) controller.current = undefined; if (alive.current && epoch === generation.current) setBusy(false) }
  }
  async function exportCredential() {
    if (!client.current || busy || !scoped() || password !== confirmPassword) return
    const current = client.current, epoch = generation.current
    setBusy(true); setError('')
    try {
      let encrypted: Uint8Array | undefined
      await current.persistCredential(async (destination, session) => { encrypted = await sealPortableCredential(destination, session, password) })
      if (!encrypted || !scoped() || epoch !== generation.current) return
      const blob = new Blob([encrypted as BlobPart], { type: 'application/json' }), url = URL.createObjectURL(blob), anchor = document.createElement('a')
      try { anchor.href = url; anchor.download = 'team-credential.reteam-client'; anchor.click(); setStatus('Encrypted credential download requested. Verify the file was saved before leaving; this is not proof the browser saved it.') } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
    } catch (e) { if (scoped() && epoch === generation.current) setError(failure(e)) }
    finally { if (alive.current && epoch === generation.current) { setPassword(''); setConfirmPassword(''); setBusy(false) } }
  }
  async function importFile(file?: File) {
    if (!file || busy || identity || !scoped()) return
    resetReview(); setArtifact(undefined); setArtifactMeta(undefined); setPassword(''); setInvitation(''); setBusy(true)
    const epoch = ++generation.current
    try { if (file.size > 8192) throw new Error('Unsupported credential artifact'); const bytes = new Uint8Array(await file.arrayBuffer()), metadata = inspectPortableCredential(bytes); if (!scoped() || epoch !== generation.current) return; setArtifact(bytes); setArtifactMeta(metadata); setOrigin(metadata.origin); setTeam(metadata.team); setInvitation(''); setStatus('File metadata loaded, not authenticated. Independently verify the exact host/team. No connection or unlock yet.') }
    catch { if (scoped() && epoch === generation.current) setError('Unsupported or damaged portable credential file. Node scrypt Owner/client artifacts require explicit operator conversion; they are not this browser format.') }
    finally { if (scoped() && epoch === generation.current) setBusy(false) }
  }
  return <section className="re-teams-page" aria-label="Teams connection">
    <header><Users size={20} aria-hidden /><h1>Teams</h1></header>
    <p>Connect only to a host you trust. TLS protects transit and the host encrypts its storage; an authorized host can read shared data. This is not host-blind end-to-end encryption.</p>
    <div className="re-teams-notice"><ShieldCheck size={16} aria-hidden /><p>Private chats, memories, local Boards and provider keys are not imported or sent. This connection page reads shared-state metadata only; collaborative editing and BackChat are separate integration work.</p></div>
    <p role="status">{status}</p>{busy&&!identity&&!review&&<button className="bui-button" onClick={disconnect}>Cancel credential load</button>}{error && <p role="alert">{error}</p>}
    {identity ? <>
      <section className="re-teams-card"><h2>{identity.team}</h2><dl><dt>Host</dt><dd>{identity.origin}</dd><dt>Member / last known role</dt><dd>{identity.member} · {identity.role}</dd><dt>Session expiry</dt><dd>{new Date(identity.expiresAt).toISOString()}</dd></dl>
        {counts && <p>Last read: revision sequence {counts.sequence} · {counts.boards} shared Boards · {counts.posts} BackChat posts. Counts are a snapshot, not live sync.</p>}
        <div className="re-teams-actions"><button className="bui-button" disabled={busy} onClick={() => void refresh()}>Refresh shared state</button><button className="bui-button" onClick={disconnect}><Unplug size={14} aria-hidden />Disconnect</button></div>
      </section>
      <section className="re-teams-card"><h2>Keep an encrypted credential file</h2><p>Credentials are memory-only until you explicitly export. Leaving this page, reloading or disconnecting drops them; a consumed invitation cannot restore them. Keep the file and a strong unique passphrase separately. Export does not extend expiry or prevent host revocation. No OS keychain or browser persistence is used.</p>
        <label>Export passphrase<input className="bui-field" aria-label="Export passphrase" type="password" autoComplete="new-password" disabled={busy} value={password} onChange={e => setPassword(e.target.value)} /></label><label>Confirm export passphrase<input className="bui-field" aria-label="Confirm export passphrase" type="password" autoComplete="new-password" disabled={busy} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
        <p>Portable format: AES-256-GCM with PBKDF2-SHA256, 600,000 iterations; 12–1024 UTF-8 passphrase bytes. Length alone does not guarantee strength. This is distinct from the operator's scrypt artifacts.</p>
        <button className="bui-button" disabled={busy || !password || password !== confirmPassword} onClick={() => void exportCredential()}>Export encrypted credential</button>
      </section>
    </> : <section className="re-teams-card"><h2>Join or reconnect</h2>
      <fieldset disabled={busy || !!review}>
        <label>HTTPS host origin<input className="bui-field" aria-label="Team HTTPS origin" placeholder="https://host.example:8443" value={origin} onChange={e => { resetReview(); setOrigin(e.target.value) }} autoComplete="off" /></label>
        <label>Team ID<input className="bui-field" aria-label="Team ID" value={team} onChange={e => { resetReview(); setTeam(e.target.value) }} autoComplete="off" /></label>
        {!artifact && <label>Single-use invitation<input className="bui-field" aria-label="Team invitation" type="password" autoComplete="off" value={invitation} onChange={e => { resetReview(); setInvitation(e.target.value) }} /></label>}
        <label>Or import a portable encrypted credential<input type="file" aria-label="Import Team credential" accept=".reteam-client,application/json" onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void importFile(file) }} /></label>
        {artifact && <label>Credential passphrase<input className="bui-field" aria-label="Credential passphrase" type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} /></label>}
        <div className="re-teams-actions"><button className="bui-button" disabled={!origin || !team || (!artifact && !invitation) || (!!artifact && !password)} onClick={prepare}>Review connection</button>{artifact && <button className="bui-button" onClick={() => { setArtifact(undefined); setArtifactMeta(undefined); setPassword(''); setOrigin(''); setTeam('') }}>Discard credential file</button>}</div>
      </fieldset>
      {review && <div className="re-teams-review"><h3>Verify this destination independently</h3><p>Host: <strong>{review.origin}</strong><br />Team: <strong>{review.team}</strong><br />UI origin: {location.origin}</p><p>The host must allow this exact HTTPS UI origin. Certificate trust is managed by your browser/OS, not by this app. Do not bypass certificate warnings. Local HTTP UI origins are not accepted by the Teams host. No tunnel, internet short code or discovery service is used.</p><label><input type="checkbox" disabled={busy} checked={consent} onChange={e => setConsent(e.target.checked)} /> I verified the exact host/team and trust the host with shared data. {artifact ? 'Unlock locally and explicitly connect using this credential.' : 'Redeem once; a lost response may consume the invitation. I will not retry blindly.'}</label><div className="re-teams-actions"><button className="bui-button" disabled={busy || !consent} onClick={() => void connect()}>{artifact ? 'Unlock and connect' : 'Redeem invitation and connect'}</button><button className="bui-button" onClick={disconnect}>{busy ? 'Cancel connection' : 'Cancel review'}</button></div></div>}
    </section>}
    <details className="re-teams-card"><summary>Host a Team and certificate guidance</summary><p>Host startup requires a separately configured dedicated HTTPS listener, encrypted host storage, a valid certificate and an exact UI-origin allowlist. This page never opens a port or exposes the private-local application API.</p><p>Use the documented Teams operator tools; never upload host.keys, recovery keys, TLS private keys, raw Owner artifacts or host passphrases here. Host commands: use node bin/research-engine.mjs teams in a built Node distribution, or npm run teams-host --workspace backend -- in the source tree. Initialize, bootstrap an encrypted Owner file, export a portable Owner credential or issue a private invitation file offline, then serve with explicit network confirmation. See docs/teams-host-and-join.md. OS certificate installation and attachment streaming are not implied by a successful connection.</p></details>
  </section>
}
