import { useSyncExternalStore } from "react";
import { useStore } from "@/stores/useStore";
const query = "(prefers-reduced-motion: reduce)";
const snapshot = () => window.matchMedia(query).matches;
const subscribe = (changed: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
};
/** Reactively follow both saved preference and OS changes, including mid-motion. */
export function useInterfaceReducedMotion(): boolean {
  const system = useSyncExternalStore(subscribe, snapshot, () => true);
  const setting = useStore((s) => s.settings.reduceMotion);
  return !!setting || system;
}
