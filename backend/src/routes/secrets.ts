// Secret redaction — applied to every string that could reach a log, an
// error message, or any outbound surface. Keys must never leak, even when a
// provider echoes part of the request back in an error body.
const PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,                      // OpenAI-style
  /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g,                  // Anthropic
  /\bsk-proj-[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,                     // Google / Gemini
  /\bghp_[A-Za-z0-9]{30,}\b/g,                       // GitHub PAT
  /\bgho_[A-Za-z0-9]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,               // Slack
  /\bAKIA[0-9A-Z]{16}\b/g,                           // AWS
  /\bhf_[A-Za-z0-9]{20,}\b/g,                        // HuggingFace
  /\bnvapi-[A-Za-z0-9_-]{16,}\b/g,                   // NVIDIA NIM
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{6,}\b/g, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{20,}?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bkey-[A-Za-z0-9]{20,}\b/g,
]

export function maskSecrets(text: string): string {
  let out = String(text ?? '')
  for (const re of PATTERNS) out = out.replace(re, '[REDACTED]')
  return out
}
