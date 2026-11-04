// Privacy Shield — three postures for outbound traffic and scanning.
//   none      no scanning, nothing blocked
//   private   scans interactions; redacts secrets from anything outbound;
//             chats stay local (default)
//   topsecret scans EVERYTHING; only the selected chat provider may be
//             contacted — search backends, image fetches and any other
//             non-essential outbound traffic are blocked outright.
import { useStore } from '@/stores/useStore'

export type PrivacyMode = 'none' | 'private' | 'topsecret'

export const PRIVACY_MODES: { id: PrivacyMode; name: string; desc: string }[] = [
  { id: 'none', name: 'No Privacy', desc: 'No scanning. Requests go out exactly as composed.' },
  { id: 'private', name: 'Privated', desc: 'Scans interactions and redacts keys/secrets from anything leaving this device. Chats stay private to the outside world. (default)' },
  { id: 'topsecret', name: 'Top Secret', desc: 'Scans EVERY interaction. Only your selected chat provider may be contacted — web search, article images and all other outbound traffic is blocked. Secrets are redacted and connection history is never persisted.' },
]

export const getPrivacyMode = (): PrivacyMode => useStore.getState().settings.privacyMode ?? 'private'

interface Pattern { re: RegExp; label: string }
const PATTERNS: Pattern[] = [
  { re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}\b/g, label: 'API key (OpenAI-style)' },
  { re: /\bAIza[0-9A-Za-z_-]{30,}\b/g, label: 'Google API key' },
  { re: /\bghp_[A-Za-z0-9]{30,}\b/g, label: 'GitHub token' },
  { re: /\bgho_[A-Za-z0-9]{30,}\b/g, label: 'GitHub OAuth token' },
  { re: /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g, label: 'GitHub fine-grained token' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, label: 'Slack token' },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, label: 'AWS key id' },
  { re: /\bhf_[A-Za-z0-9]{20,}\b/g, label: 'HuggingFace token' },
  { re: /\bnvapi-[A-Za-z0-9_-]{16,}\b/g, label: 'NVIDIA API key' },
  { re: /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{6,}\b/g, label: 'JWT' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{20,}?-----END [A-Z ]*PRIVATE KEY-----/g, label: 'Private key block' },
  { re: /\bkey-[A-Za-z0-9]{20,}\b/g, label: 'Generic key' },
  { re: /\b(?:\d[ -]?){13,19}\b/g, label: 'Card-like number' },
]

export interface ScanFinding { label: string; count: number }

/** Scan a payload string; returns what was found (never the matches themselves). */
export function scanSecrets(text: string): ScanFinding[] {
  const out: ScanFinding[] = []
  for (const p of PATTERNS) {
    const m = String(text ?? '').match(p.re)
    if (m?.length) out.push({ label: p.label, count: m.length })
  }
  return out
}

/** Redact every secret-looking token in place. */
export function redactSecrets(text: string): string {
  let out = String(text ?? '')
  for (const p of PATTERNS) out = out.replace(p.re, '[REDACTED]')
  return out
}

/**
 * Gate an outbound request. `kind` describes the traffic:
 *   provider — chat/completions traffic to the configured model provider
 *   search / images / misc — everything else
 * In topsecret mode only `provider` passes.
 */
export function allowOutbound(kind: 'provider' | 'search' | 'images' | 'misc'): { ok: boolean; reason?: string } {
  const mode = getPrivacyMode()
  if (mode === 'topsecret' && kind !== 'provider') {
    return { ok: false, reason: 'Top Secret mode blocks all outbound traffic except your selected chat provider.' }
  }
  return { ok: true }
}

/** Prepare outbound text per mode: redact secrets in private/topsecret. */
export function shieldOutbound(text: string): { text: string; findings: ScanFinding[] } {
  const mode = getPrivacyMode()
  if (mode === 'none') return { text, findings: [] }
  const findings = scanSecrets(text)
  return { text: findings.length ? redactSecrets(text) : text, findings }
}

let scanLog: { t: number; where: string; findings: ScanFinding[]; blocked?: boolean }[] = []

export function recordScan(where: string, findings: ScanFinding[], blocked = false) {
  scanLog = [{ t: Date.now(), where, findings, blocked }, ...scanLog].slice(0, 60)
}

export const getScanLog = () => scanLog

export function clearScanLog() { scanLog = [] }
