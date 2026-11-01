// The integration gateway.
//
//   GET /api/integrations          what this build ships, and which are configured
//   GET /api/integrations/search   fan-out search across the configured ones
//   GET /api/integrations/read     one full item (mail body, Doc text, issue…)
//   GET /api/integrations/probe    a real authenticated call, to test a token
//
// Credentials come from the caller on every request (`x-re-integrations`), are
// used for that request only, and are never written, logged or echoed back. The
// reply always says which integration answered and what failed, so the UI (and
// the agent) can tell "no results" apart from "not connected".
import { Hono } from 'hono'
import type { Runtime } from '../runtime'
import {
  INTEGRATION_DEFS, credsFrom, integrationDef, readIntegration, searchIntegration, probeIntegration,
  type IntCreds, type IntId,
} from '../services/integrations'

export function integrationRoutes(rt: Runtime) {
  const r = new Hono()

  const isId = (v: string): v is IntId => INTEGRATION_DEFS.some((d) => d.id === v)
  const configured = (creds: Record<string, IntCreds>) =>
    INTEGRATION_DEFS.filter((d) => d.auth === 'none' || !!creds[d.id]?.token || !!creds[d.id]?.refreshToken).map((d) => d.id)

  r.get('/integrations', (c) => {
    const creds = credsFrom(c.req.header('x-re-integrations'))
    return c.json({
      integrations: INTEGRATION_DEFS.map((d) => ({
        ...d,
        // Never the token itself — only whether one arrived and how it authenticates.
        connected: d.auth === 'none' ? true : !!(creds[d.id]?.token || creds[d.id]?.refreshToken),
        via: d.auth === 'none' ? 'local' : creds[d.id]?.refreshToken && !creds[d.id]?.token ? 'refresh-token' : creds[d.id]?.token ? 'access-token' : null,
      })),
    })
  })

  r.get('/integrations/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim()
    const creds = credsFrom(c.req.header('x-re-integrations'))
    const limit = Math.max(1, Math.min(25, Number(c.req.query('limit')) || 12))
    const asked = (c.req.query('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const ids: IntId[] = (asked.length ? asked.filter(isId) : configured(creds)) as IntId[]

    if (!ids.length) {
      return c.json({
        q, results: [], errors: [],
        note: 'No integration is connected yet. Connect one in Settings → Integrations, or from the composer’s plug menu.',
      })
    }

    const settled = await Promise.all(ids.map(async (id) => {
      const out = await searchIntegration(rt, id, q, creds[id] ?? {}, limit)
      return { id, out }
    }))

    const results = settled.flatMap(({ out }) => (out.ok ? out.data ?? [] : []))
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
      .slice(0, limit * 2)

    const errors = settled
      .filter((s) => !s.out.ok)
      .map((s) => ({
        integration: s.id,
        name: integrationDef(s.id)?.name ?? s.id,
        error: s.out.error,
        needs: s.out.needs ?? null,
      }))

    return c.json({
      q,
      counts: settled.map((s) => ({ integration: s.id, n: s.out.ok ? (s.out.data ?? []).length : 0 })),
      results,
      errors,
      connected: configured(creds),
    })
  })

  r.get('/integrations/read', async (c) => {
    const integration = c.req.query('integration') ?? ''
    const id = c.req.query('id') ?? ''
    if (!isId(integration)) return c.json({ error: 'Unknown integration.' }, 400)
    if (!id) return c.json({ error: 'Missing item id.' }, 400)
    const creds = credsFrom(c.req.header('x-re-integrations'))
    const out = await readIntegration(rt, integration, id, creds[integration] ?? {})
    if (!out.ok) return c.json({ error: out.error, needs: out.needs ?? null, integration }, out.needs === 'auth' ? 401 : 502)
    return c.json(out.data)
  })

  r.get('/integrations/probe', async (c) => {
    const integration = c.req.query('integration') ?? ''
    if (!isId(integration)) return c.json({ error: 'Unknown integration.' }, 400)
    const creds = credsFrom(c.req.header('x-re-integrations'))
    const out = await probeIntegration(integration, creds[integration] ?? {})
    if (!out.ok) return c.json({ error: out.error, needs: out.needs ?? null, integration }, out.needs === 'auth' ? 401 : 502)
    return c.json({ integration, ...out.data })
  })

  return r
}
