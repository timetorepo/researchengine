/**
 * The Composio endpoint rule, as the browser checks it before saving. The server
 * repeats the same rule (normalizeComposioBase), because the server is the one that
 * decides where a request really goes.
 */
export function composioEndpointProblem(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (text.length > 300) return 'That address is too long.'
  let u: URL
  try { u = new URL(text) } catch { return 'Enter a full address, such as https://composio.example.com.' }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return 'Use https. Plain http is allowed only for localhost.'
  if (u.username || u.password || u.search || u.hash) return 'Remove credentials, query strings and fragments from the address.'
  return null
}
