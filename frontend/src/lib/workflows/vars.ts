// Variable injection: {{input}}, {{item}}, {{<node label>}}, {{<label>.path.to.value}}
export type VarContext = Record<string, any>

function dig(value: any, path: string[]): any {
  let v = value
  for (const p of path) {
    if (v == null) return undefined
    if (Array.isArray(v) && /^\d+$/.test(p)) { v = v[Number(p)]; continue }
    v = v[p]
  }
  return v
}

export function resolveVars(template: string, ctx: VarContext): string {
  if (!template) return template
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, raw: string) => {
    const parts = raw.split('.')
    const head = parts.shift()!
    let value: any
    if (head === 'input') value = ctx.input
    else if (head === 'item') value = ctx.item
    else value = ctx[head] ?? ctx[head.toLowerCase()]
    if (parts.length > 0) value = dig(value, parts)
    if (value === undefined || value === null) return ''
    if (typeof value === 'object') {
      try { return JSON.stringify(value) } catch { return String(value) }
    }
    return String(value)
  })
}

/** Read a config value, resolving variables inside strings. */
export function resolveConfig(value: any, ctx: VarContext): any {
  if (typeof value === 'string') return resolveVars(value, ctx)
  return value
}

/** Resolve a field that may carry structured data. A bare single reference
 *  (e.g. `{{Loop}}` with nothing else in the string) passes the raw value
 *  through untouched — arrays stay arrays. Anything mixed is interpolated as text. */
export function resolveValue(template: any, ctx: VarContext): any {
  if (typeof template !== 'string') return template
  const bare = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(template.trim())
  if (bare) {
    const parts = bare[1].split('.')
    const head = parts.shift()!
    let value: any
    if (head === 'input') value = ctx.input
    else if (head === 'item') value = ctx.item
    else value = ctx[head] ?? ctx[head.toLowerCase()]
    if (parts.length > 0) value = dig(value, parts)
    return value
  }
  return resolveVars(template, ctx)
}

export function toDisplay(value: any): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}
