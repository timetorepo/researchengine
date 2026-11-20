import { useLayoutEffect, useEffect, useRef } from "react";
import { useInterfaceReducedMotion } from "@/lib/ui/useInterfaceReducedMotion";
import { SIDEBAR_MOTION } from "@/lib/ui/handoff";

/** One immediate layout change, then a small directional surface settle.
 * No width/blur tween, cloned navigation, delayed input or per-frame React work. */
export function useSidebarTransition(collapsed: boolean, mobileOpen: boolean) {
  const reduced = useInterfaceReducedMotion();
  const surface = useRef<HTMLDivElement>(null);
  const previous = useRef(collapsed);
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const changed = previous.current !== collapsed;
    previous.current = collapsed;
    const element = surface.current;
    const running = animation.current?.playState === "running";
    const current = running && element ? getComputedStyle(element) : null;
    const transform = current?.transform;
    const opacity = current?.opacity;
    animation.current?.cancel();
    animation.current = null;
    if (!changed || reduced || mobileOpen || !element?.animate) return;
    animation.current = element.animate(
      [
        {
          transform: transform ?? `translateX(${collapsed ? 8 : -12}px)`,
          opacity: opacity ?? 0.72,
        },
        { transform: "translateX(0)", opacity: 1 },
      ],
      {
        duration:
          (collapsed ? SIDEBAR_MOTION.close : SIDEBAR_MOTION.open) * 1000,
        easing: SIDEBAR_MOTION.cssEase,
      },
    );
  }, [collapsed, mobileOpen, reduced]);
  useEffect(() => () => animation.current?.cancel(), []);
  return { surface, reduced };
}
