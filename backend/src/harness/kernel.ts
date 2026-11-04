/**
 * A small plugin kernel for the agent harness, after the design of Cordis.
 *
 * Credit: the ideas here (services claimed by stable keys, plugins that wait
 * for the services they inject, effects that revert when a plugin unmounts,
 * and boot profiles that decide which plugin bundles stack) come from Cordis
 * by Shigma (MIT), as used by DeepSeek Harness (MIT, Copyright 2026 DeepSeek).
 * This is an independent, much smaller implementation in TypeScript. It is not
 * a copy of Cordis's source, and it has none of its proxy-based scoping. See
 * THIRD-PARTY-NOTICES.md and docs/technical/19-agent-harness.md.
 *
 * Model:
 *  - A **service** is a value under a string key (`tools`, `llm`, `sessions`).
 *    A plugin claims one with `ctx.provide(key, value)`.
 *  - A **plugin** declares `inject` keys. It is mounted only when every key is
 *    provided. If a provider unmounts, its dependents unmount and wait again.
 *  - An **effect** is anything a plugin sets up and must undo: a provided
 *    service, an event listener, a timer. `ctx.effect(setup)` runs `setup`
 *    now and its returned disposer runs on unmount, in reverse order.
 *  - A **fiber** is one plugin instance: waiting, mounted, or disposed.
 *    Children unmount with their parent.
 */

export type Dispose = () => void
export type Listener = (...args: any[]) => void

export interface PluginDef<C = any> {
  /** Unique label, used in errors and diagnostics. */
  name: string
  /** Service keys that must be provided before this plugin mounts. */
  inject?: string[]
  /** Mount the plugin. It may return a disposer, which runs on unmount. */
  apply: (ctx: Ctx, config: C) => void | Dispose
}

export interface Ctx {
  /** The plugin's name, for diagnostics. */
  readonly name: string
  /** Read a service. Returns undefined when no plugin provides it. */
  get<T = any>(key: string): T | undefined
  /** Provide a service for the lifetime of this plugin. */
  provide<T>(key: string, value: T): void
  /** Run `setup` now; the disposer it returns runs when this plugin unmounts. */
  effect(setup: () => void | Dispose): void
  /** Subscribe to an event for the lifetime of this plugin. */
  on(event: string, fn: Listener): void
  /** Emit an event to every live listener. */
  emit(event: string, ...args: unknown[]): void
  /** Load a child plugin. It unmounts when this plugin does. */
  plugin<C>(def: PluginDef<C>, config?: C): Fiber
  /** Unmount this plugin, and its children, now. */
  dispose(): void
}

export interface Fiber {
  readonly name: string
  readonly parent: Fiber | null
  state: 'waiting' | 'mounted' | 'disposed'
  readonly children: Set<Fiber>
  readonly effects: Dispose[]
  readonly provided: Set<string>
  def: PluginDef
  config: unknown
}

interface Service { value: unknown; owner: Fiber }

export class Kernel {
  private services = new Map<string, Service>()
  private listeners = new Map<string, Set<Listener>>()
  private root: Fiber
  private flushing = false
  /** Errors thrown by plugins during mount. A broken plugin never takes the kernel down. */
  readonly errors: Array<{ plugin: string; error: string }> = []

  constructor() {
    this.root = {
      name: '<root>', parent: null, state: 'mounted', children: new Set(), effects: [], provided: new Set(),
      def: { name: '<root>', apply() {} }, config: undefined,
    }
  }

  /** Load a plugin at the root. Returns its fiber. */
  load<C>(def: PluginDef<C>, config?: C): Fiber {
    return this.loadUnder(this.root, def, config)
  }

  /** Read a service from outside any plugin. */
  get<T = any>(key: string): T | undefined {
    return this.services.get(key)?.value as T | undefined
  }

  /** Names of the plugins that are mounted right now. */
  mounted(): string[] {
    return this.allFibers().filter((f) => f.state === 'mounted').map((f) => f.name)
  }

  /** Plugins still waiting, and the service keys each one is missing. */
  waiting(): Array<{ name: string; missing: string[] }> {
    return this.allFibers()
      .filter((f) => f.state === 'waiting')
      .map((f) => ({ name: f.name, missing: (f.def.inject ?? []).filter((k) => !this.services.has(k)) }))
  }

  /** Unmount a fiber and everything under it, for good. */
  unload(fiber: Fiber) {
    this.remove(fiber)
    this.flush()
  }

  // ---- internals -------------------------------------------------------

  private loadUnder<C>(parent: Fiber, def: PluginDef<C>, config?: C): Fiber {
    const fiber: Fiber = {
      name: def.name, parent, state: 'waiting', children: new Set(), effects: [], provided: new Set(), def, config,
    }
    parent.children.add(fiber)
    this.flush()
    return fiber
  }

  private allFibers(): Fiber[] {
    const out: Fiber[] = []
    const walk = (f: Fiber) => {
      for (const c of f.children) { out.push(c); walk(c) }
    }
    walk(this.root)
    return out
  }

  /** Mount every waiting plugin whose services are now available, until nothing changes. */
  private flush() {
    if (this.flushing) return
    this.flushing = true
    try {
      let progress = true
      while (progress) {
        progress = false
        for (const f of this.allFibers()) {
          if (f.state === 'waiting' && (f.def.inject ?? []).every((k) => this.services.has(k))) {
            this.mount(f)
            progress = true
          }
        }
      }
    } finally {
      this.flushing = false
    }
  }

  private mount(fiber: Fiber) {
    fiber.state = 'mounted'
    try {
      const dispose = fiber.def.apply(this.ctxFor(fiber), fiber.config)
      if (typeof dispose === 'function') fiber.effects.push(dispose)
    } catch (err) {
      // A plugin that throws on mount is removed, not retried: retrying would loop forever.
      this.errors.push({ plugin: fiber.name, error: err instanceof Error ? err.message : String(err) })
      this.remove(fiber)
    }
  }

  /** Revert a fiber and take it out of the tree for good. */
  private remove(fiber: Fiber) {
    this.teardown(fiber)
    fiber.parent?.children.delete(fiber)
    fiber.state = 'disposed'
  }

  /**
   * Revert everything a fiber did, and leave it waiting so it can mount again.
   * Children are removed, not kept: a parent that remounts re-creates them.
   * Plugins that injected a service this fiber provided go back to waiting too.
   */
  private teardown(fiber: Fiber) {
    if (fiber.state === 'disposed') return
    const wasMounted = fiber.state === 'mounted'
    for (const c of [...fiber.children]) this.remove(c)
    while (fiber.effects.length) {
      const d = fiber.effects.pop()!
      try { d() } catch { /* a failing disposer must not stop the rest */ }
    }
    const keys = [...fiber.provided]
    for (const key of keys) {
      if (this.services.get(key)?.owner === fiber) this.services.delete(key)
    }
    fiber.provided.clear()
    fiber.state = 'waiting'
    if (wasMounted && keys.length) {
      for (const d of this.allFibers()) {
        if (d.state === 'mounted' && (d.def.inject ?? []).some((k) => keys.includes(k))) this.teardown(d)
      }
    }
  }

  private ctxFor(fiber: Fiber): Ctx {
    const kernel = this
    return {
      name: fiber.name,
      get<T>(key: string) { return kernel.services.get(key)?.value as T | undefined },
      provide<T>(key: string, value: T) {
        const existing = kernel.services.get(key)
        if (existing && existing.owner !== fiber && existing.owner.state === 'mounted') {
          throw new Error(`service "${key}" is already provided by ${existing.owner.name}`)
        }
        kernel.services.set(key, { value, owner: fiber })
        fiber.provided.add(key)
        // A new provider can unblock plugins that were waiting for it.
        kernel.flush()
      },
      effect(setup) {
        const d = setup()
        if (typeof d === 'function') fiber.effects.push(d)
      },
      on(event, fn) {
        let set = kernel.listeners.get(event)
        if (!set) kernel.listeners.set(event, (set = new Set()))
        set.add(fn)
        fiber.effects.push(() => { kernel.listeners.get(event)?.delete(fn) })
      },
      emit(event, ...args) {
        for (const fn of [...(kernel.listeners.get(event) ?? [])]) {
          try { fn(...args) } catch (err) {
            kernel.errors.push({ plugin: `event:${event}`, error: err instanceof Error ? err.message : String(err) })
          }
        }
      },
      plugin<C>(def: PluginDef<C>, config?: C) {
        return kernel.loadUnder(fiber, def, config)
      },
      dispose() { kernel.unload(fiber) },
    }
  }
}

/** Define a plugin with the types filled in. */
export function definePlugin<C = any>(def: PluginDef<C>): PluginDef<C> {
  return def
}
