import { useMemo } from 'react'
import { Route, Pin, PinOff, Check } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import type { Settings } from '@/types'
import { PERSONAS, DEFAULT_PERSONA, personaById, route } from '@/lib/snaffy/router'
import BorderGlow from '@/components/ui/reactbits/micro/BorderGlow'

/**
 * Snaffy: a router, not a model.
 *
 * Snaffy holds no key and owns no weights. It reads the providers you have
 * already configured and routes a request to one of them with a persona system
 * prompt in front of it, so the same model behaves like a different agent.
 *
 * The panel shows the route it would take for the persona you picked, with the
 * reason, because a router that silently picks a model is a router you cannot
 * debug. It also shows what it rejected and why, which is the part that matters
 * when the answer is "none of your models fit".
 */
export function SnaffyTab() {
  const snaffy = useStore((s) => s.settings.snaffy ?? { enabled: false, persona: DEFAULT_PERSONA })
  const providers = useStore((s) => s.settings.providers)
  const providerModels = useStore((s) => s.settings.providerModels)
  // The store has no dedicated setter for settings; every tab patches through
  // setState, which is the pattern the rest of Settings uses.
  const set = (patch: Partial<NonNullable<Settings['snaffy']>>) =>
    useStore.setState((s) => ({
      settings: {
        ...s.settings,
        snaffy: { enabled: false, persona: DEFAULT_PERSONA, ...s.settings.snaffy, ...patch },
      },
    }))

  // Only what you can actually call: a key present and the switch on. Snaffy
  // routing to a provider with no key would fail at the call, not here.
  const usable = useMemo(
    () =>
      Object.entries(providers)
        .filter(([, cfg]) => cfg?.enabled && cfg?.apiKey)
        .map(([id]) => ({ provider: id, models: providerModels[id] ?? [] }))
        .filter((e) => e.models.length > 0),
    [providers, providerModels],
  )

  const persona = personaById(snaffy.persona)
  const decision = useMemo(() => route(snaffy.persona, usable), [snaffy.persona, usable])
  const usableCount = usable.reduce((n, e) => n + e.models.length, 0)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Snaffy</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        A router over the models you already have. Snaffy holds no key and adds no model: it picks one of
        yours for the job and puts a persona system prompt in front of it, so the same model behaves like
        a different agent.
      </p>

      <div className="surface p-4 mb-5">
        <div className="flex items-center gap-2.5">
          <Route size={15} style={{ color: snaffy.enabled ? 'var(--primary)' : 'var(--text-3)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium">Route my chats through Snaffy</div>
            <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-2)' }}>
              Off by default. When on, Snaffy chooses the model per request instead of using your default.
            </div>
          </div>
          <button
            onClick={() => set({ enabled: !snaffy.enabled })}
            role="switch"
            aria-checked={snaffy.enabled}
            className="relative shrink-0 w-10 h-6 rounded-full transition-colors"
            style={{ background: snaffy.enabled ? 'var(--primary)' : 'var(--elevated)' }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: snaffy.enabled ? 18 : 2 }} />
          </button>
        </div>
      </div>

      <div className="text-[13px] font-semibold mb-2">Persona</div>
      <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
        The persona is the system prompt. It changes the behaviour, not the model, and you can read every
        one of them below.
      </p>
      <div className="grid sm:grid-cols-2 gap-2 mb-5">
        {PERSONAS.map((p) => {
          const on = snaffy.persona === p.id
          return (
            <button key={p.id} type="button" onClick={() => set({ persona: p.id })} className="text-left w-full">
            <BorderGlow borderRadius={12} backgroundColor={on ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))' : 'var(--elevated)'}
              className="p-3 transition-colors w-full">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-medium" style={{ color: on ? 'var(--primary)' : 'var(--text-1)' }}>{p.name}</span>
                {on && <Check size={12} style={{ color: 'var(--primary)' }} />}
              </div>
              <div className="text-[11.5px] leading-snug mt-0.5" style={{ color: 'var(--text-3)' }}>{p.about}</div>
            </BorderGlow>
            </button>
          )
        })}
      </div>

      <div className="surface p-4 mb-5">
        <div className="text-[13px] font-semibold mb-2">What {persona.name} sends</div>
        <pre className="text-[11.5px] font-mono whitespace-pre-wrap break-words overflow-auto m-0 p-3 rounded-[10px]" style={{ maxHeight: 260, background: 'var(--elevated)', color: 'var(--text-2)' }}>{persona.prompt}</pre>
        <div className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
          Needs, in order: {persona.wants.join(', ')}. Expects about {Math.round(persona.context / 1000)}k of context.
        </div>
      </div>

      <div className="surface p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Route size={13} style={{ color: 'var(--primary)' }} />
          <span className="text-[13px] font-semibold">Where {persona.name} would route</span>
        </div>
        {usableCount === 0 ? (
          <div className="text-[12px] leading-snug" style={{ color: 'var(--warning)' }}>
            No provider has both a key and the switch on, so there is nothing to route to. Add one in
            Providers and Snaffy will find it.
          </div>
        ) : decision.ref ? (
          <>
            <div className="text-[12.5px] font-medium" style={{ color: 'var(--text-1)' }}>{decision.ref}</div>
            <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-2)' }}>
              Chosen for {decision.because}. Out of {usableCount} models you can call.
            </div>
            {decision.considered.length > 1 && (
              <div className="mt-2 flex flex-col gap-0.5">
                {decision.considered.slice(1, 5).map((c) => (
                  <div key={c.ref} className="text-[11px] flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
                    <span className="truncate flex-1">{c.ref}</span>
                    <span className="tabular-nums">{c.score > 0 ? `score ${c.score}` : 'not a fit'}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-[12px] leading-snug" style={{ color: 'var(--warning)' }}>
            {decision.because}. You have {usableCount} models, but none of them carry what {persona.name} needs.
          </div>
        )}
      </div>

      <div className="surface p-4">
        <div className="flex items-center gap-2 mb-2">
          {snaffy.pinned ? <Pin size={13} style={{ color: 'var(--primary)' }} /> : <PinOff size={13} style={{ color: 'var(--text-3)' }} />}
          <span className="text-[13px] font-semibold">Pin a model</span>
        </div>
        <div className="text-[11.5px] mb-2" style={{ color: 'var(--text-2)' }}>
          When you know better than the router. Leave it off and Snaffy picks per request.
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => set({ pinned: undefined })}
            className="px-2.5 py-1 rounded-full text-[11.5px]"
            style={{
              background: !snaffy.pinned ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)',
              color: !snaffy.pinned ? 'var(--primary)' : 'var(--text-3)',
            }}>
            Let Snaffy choose
          </button>
          {usable.flatMap((e) => e.models.map((m) => `${e.provider}:${m}`)).slice(0, 24).map((ref) => {
            const on = snaffy.pinned === ref
            return (
              <button key={ref}
                onClick={() => set({ pinned: on ? undefined : ref })}
                className="px-2.5 py-1 rounded-full text-[11.5px] truncate max-w-[240px]"
                style={{
                  background: on ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)',
                  color: on ? 'var(--primary)' : 'var(--text-3)',
                }}>
                {ref}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
