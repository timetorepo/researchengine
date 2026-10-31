/* Adapted from easeUI (MIT, Ryan Cuff, Saurabh Chauhan), https://github.com/rjcuff/easeui */
import { Brain, ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ReasoningStatus = "thinking" | "done";

export interface ReasoningDisclosureProps {
  /** "thinking" while the model reasons, "done" once the answer starts. */
  status: ReasoningStatus;
  /** The reasoning text so far. Append to it as it streams. */
  children: ReactNode;
  /** Seconds spent thinking, shown once done. Leave it out and the component times it. */
  duration?: number;
  /** Controlled open state. */
  open?: boolean;
  /** Starting open state when uncontrolled. Default true, so the reasoning shows while it streams. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Folds the reasoning away once status turns "done", unless someone opened or closed it by hand. Default true. */
  collapseOnDone?: boolean;
  /** Header text while thinking. Default "Thinking". */
  thinkingLabel?: string;
  className?: string;
}

/** With a 200% wide gradient, a 200 point position swing moves it one full tile, so the loop never jumps. */
const SHIMMER_SWEEP: Keyframe[] = [{ backgroundPosition: "200% 0" }, { backgroundPosition: "0% 0" }];
const SHIMMER_MS = 2000;

// Only the shown label takes up space, so the chevron hugs it. The other one fades out on top of it.
const SWAP = "whitespace-nowrap text-left transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none";
const SWAP_SHOWN = "relative translate-y-0 opacity-100";
const SWAP_GONE = "pointer-events-none absolute left-0 top-0 opacity-0";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatDuration(seconds: number): string {
  const whole = Math.max(1, Math.round(seconds));
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

/** Tracks how long status stayed "thinking", restarting whenever it goes back to thinking. */
function useThinkingTime(status: ReasoningStatus) {
  const startedAt = useRef<number | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (status === "thinking") {
      startedAt.current = Date.now();
      setSeconds(null);
      return;
    }
    if (startedAt.current !== null) setSeconds((Date.now() - startedAt.current) / 1000);
  }, [status]);

  return seconds;
}

/**
 * A model's reasoning, shown while it thinks and folded away once it answers. The header
 * shimmers "Thinking" while it works, then crossfades to "Thought for 8s". The reasoning
 * stays pinned to its newest line as it streams, and can be reopened any time.
 */
export function ReasoningDisclosure({
  status,
  children,
  duration,
  open,
  defaultOpen = true,
  onOpenChange,
  collapseOnDone = true,
  thinkingLabel = "Thinking",
  className,
}: ReasoningDisclosureProps) {
  const panelId = useId();
  const shimmerRef = useRef<HTMLSpanElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  // A message loaded from history is already done, so it starts folded rather than folding on mount.
  const [uncontrolled, setUncontrolled] = useState(defaultOpen && !(status === "done" && collapseOnDone));
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolled;
  const thinking = status === "thinking";
  const timed = useThinkingTime(status);
  const seconds = duration ?? timed;
  const doneLabel = seconds === null ? "Thought for a moment" : `Thought for ${formatDuration(seconds)}`;

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolled(next);
    onOpenChange?.(next);
  };

  // Folding on its own only happens if nobody has opened or closed it by hand.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the change to "done" should fold it, not every render.
  useEffect(() => {
    if (thinking || !collapseOnDone || touched.current) return;
    setOpen(false);
  }, [thinking, collapseOnDone]);

  // While thinking, keep the newest line in view as the text grows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: children is the trigger, the effect reads the DOM.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (thinking && scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [children, thinking]);

  useEffect(() => {
    const element = shimmerRef.current;
    if (!thinking || !element || typeof element.animate !== "function" || prefersReducedMotion()) return;
    const animation = element.animate(SHIMMER_SWEEP, {
      duration: SHIMMER_MS,
      iterations: Number.POSITIVE_INFINITY,
      easing: "linear",
    });
    return () => animation.cancel();
  }, [thinking]);

  return (
    <div className={cn("flex flex-col", className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          touched.current = true;
          setOpen(!isOpen);
        }}
        className={cn(
          "group relative -ml-1 inline-flex min-h-9 w-fit touch-manipulation items-center gap-1.5 rounded-full px-1 text-sm text-muted-foreground outline-none",
          "transition-colors duration-150 ease-out hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-foreground/40",
          "after:absolute after:-inset-y-1 after:-inset-x-1",
        )}
      >
        <Brain aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="relative">
          <span
            ref={shimmerRef}
            aria-hidden={!thinking}
            className={cn(
              SWAP,
              "block bg-clip-text font-medium [-webkit-background-clip:text]",
              thinking ? cn(SWAP_SHOWN, "text-transparent") : cn(SWAP_GONE, "-translate-y-1"),
            )}
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--muted-foreground) 40%, var(--foreground) 50%, var(--muted-foreground) 60%)",
              backgroundSize: "200% 100%",
            }}
          >
            {thinkingLabel}
          </span>
          <span aria-hidden={thinking} className={cn(SWAP, "block", thinking ? cn(SWAP_GONE, "translate-y-1") : SWAP_SHOWN)}>
            {doneLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
            isOpen && "rotate-180",
          )}
        />
        <span aria-live="polite" className="sr-only">
          {thinking ? "" : doneLabel}
        </span>
      </button>

      {/* Grows from zero rows to its natural height with a grid transition, so nothing is measured. */}
      <section
        id={panelId}
        aria-label="Reasoning"
        aria-busy={thinking}
        inert={!isOpen}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            ref={scrollRef}
            className={cn(
              "ml-2 mt-1.5 max-h-60 overflow-y-auto border-l-2 border-border pl-3.5 text-sm leading-6 text-muted-foreground",
              "transition-opacity duration-200 ease-out motion-reduce:transition-none",
              isOpen ? "opacity-100" : "opacity-0",
            )}
          >
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
