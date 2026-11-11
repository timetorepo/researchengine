import { useLayoutEffect, useRef, type RefObject } from "react"
import gsap from "gsap"

/**
 * A small stand-in for @gsap/react's useGSAP. It runs `fn` inside a gsap.Context,
 * reverts that context on unmount or when `dependencies` change, and returns
 * `contextSafe`, which wraps event-handler animations so they are cleaned up too.
 */
export function useGSAP(
  fn?: (ctx: gsap.Context) => void,
  config?: unknown[] | { scope?: RefObject<Element | null>; dependencies?: unknown[] },
): { contextSafe: <T extends (...args: any[]) => any>(f: T) => T; context: RefObject<gsap.Context | null> } {
  const context = useRef<gsap.Context | null>(null)
  const isList = Array.isArray(config)
  const scope = isList ? undefined : config?.scope
  const deps: unknown[] = isList ? config : (config?.dependencies ?? [])
  useLayoutEffect(() => {
    const ctx = gsap.context((self) => { fn?.(self) }, scope?.current ?? undefined)
    context.current = ctx
    return () => { ctx.revert(); context.current = null }
    // The caller owns the dependency list, as it does with @gsap/react.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  const contextSafe = <T extends (...args: any[]) => any>(f: T): T =>
    ((...args: Parameters<T>) => {
      const ctx = context.current
      return ctx ? ctx.add(() => f(...args)) : f(...args)
    }) as T
  return { contextSafe, context }
}
