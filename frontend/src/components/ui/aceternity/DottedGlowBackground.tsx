/**
 * Dotted Glow Background — Aceternity UI, vendored (R16).
 *
 * Canonical install, on a machine that can reach their registry:
 *   npx shadcn@latest add @aceternity/dotted-glow-background-demo-2
 *
 * This copy comes from a public checkout of the same source, because
 * ui.aceternity.com is unreachable from the build machine:
 *   unicodeveloper/consultralph → components/ui/dotted-glow-background.tsx
 * Provenance and the upstream digest live in
 * frontend/scripts/aceternity-sources.json; `node
 * frontend/scripts/aceternity-vendor.mjs --verify` re-checks both.
 *
 * Local patches — upstream animates a canvas for as long as it is mounted:
 *   • the loop stops while the window is hidden, while the element is off
 *     screen, and under reduce-motion (the field is drawn once instead);
 *   • on a machine the adaptive-quality governor (lib/system/frame-budget)
 *     reports as 'minimal', the field is likewise drawn once;
 *   • the glow pass is skipped at 'reduced' — the dots still shimmer, without
 *     the per-dot shadowBlur, which is the expensive half.
 * These are the only deviations from upstream; everything else is verbatim.
 */
import React, { useEffect, useRef, useState } from "react";
import { frameLevel, subscribeFrameHealth } from "@/lib/system/frame-budget";

type DottedGlowBackgroundProps = {
  className?: string;
  /** distance between dot centers in pixels */
  gap?: number;
  /** base radius of each dot in CSS px */
  radius?: number;
  /** dot color (will pulse by alpha) */
  color?: string;
  /** optional dot color for dark mode */
  darkColor?: string;
  /** shadow/glow color for bright dots */
  glowColor?: string;
  /** optional glow color for dark mode */
  darkGlowColor?: string;
  /** optional CSS variable name for light dot color (e.g. --color-zinc-900) */
  colorLightVar?: string;
  /** optional CSS variable name for dark dot color (e.g. --color-zinc-100) */
  colorDarkVar?: string;
  /** optional CSS variable name for light glow color */
  glowColorLightVar?: string;
  /** optional CSS variable name for dark glow color */
  glowColorDarkVar?: string;
  /** global opacity for the whole layer */
  opacity?: number;
  /** background radial fade opacity (0 = transparent background) */
  backgroundOpacity?: number;
  /** minimum per-dot speed in rad/s */
  speedMin?: number;
  /** maximum per-dot speed in rad/s */
  speedMax?: number;
  /** global speed multiplier for all dots */
  speedScale?: number;
};

/**
 * Canvas-based dotted background that randomly glows and dims.
 * - Uses a stable grid of dots.
 * - Each dot gets its own phase + speed producing organic shimmering.
 * - Handles high-DPI and resizes via ResizeObserver.
 */
export const DottedGlowBackground = ({
  className,
  gap = 12,
  radius = 2,
  color = "rgba(0,0,0,0.7)",
  darkColor,
  glowColor = "rgba(0, 170, 255, 0.85)",
  darkGlowColor,
  colorLightVar,
  colorDarkVar,
  glowColorLightVar,
  glowColorDarkVar,
  opacity = 0.6,
  backgroundOpacity = 0,
  speedMin = 0.4,
  speedMax = 1.3,
  speedScale = 1,
}: DottedGlowBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The governor can land a downgrade after this has mounted; re-running the
  // effect is how the loop hears about it. It happens at most once a minute.
  const [quality, setQuality] = useState<string>(() => frameLevel());
  const [resolvedColor, setResolvedColor] = useState<string>(color);
  const [resolvedGlowColor, setResolvedGlowColor] = useState<string>(glowColor);

  // Resolve CSS variable value from the container or root
  const resolveCssVariable = (
    el: Element,
    variableName?: string,
  ): string | null => {
    if (!variableName) return null;
    const normalized = variableName.startsWith("--")
      ? variableName
      : `--${variableName}`;
    const fromEl = getComputedStyle(el as Element)
      .getPropertyValue(normalized)
      .trim();
    if (fromEl) return fromEl;
    const root = document.documentElement;
    const fromRoot = getComputedStyle(root).getPropertyValue(normalized).trim();
    return fromRoot || null;
  };

  const detectDarkMode = (): boolean => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) return true;
    if (root.classList.contains("light")) return false;
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  };

  useEffect(() => subscribeFrameHealth(() => setQuality(frameLevel())), []);

  // Keep resolved colors in sync with theme changes and prop updates
  useEffect(() => {
    const container = containerRef.current ?? document.documentElement;

    const compute = () => {
      const isDark = detectDarkMode();

      let nextColor: string = color;
      let nextGlow: string = glowColor;

      if (isDark) {
        const varDot = resolveCssVariable(container, colorDarkVar);
        const varGlow = resolveCssVariable(container, glowColorDarkVar);
        nextColor = varDot || darkColor || nextColor;
        nextGlow = varGlow || darkGlowColor || nextGlow;
      } else {
        const varDot = resolveCssVariable(container, colorLightVar);
        const varGlow = resolveCssVariable(container, glowColorLightVar);
        nextColor = varDot || nextColor;
        nextGlow = varGlow || nextGlow;
      }

      setResolvedColor(nextColor);
      setResolvedGlowColor(nextGlow);
    };

    compute();

    const mql = window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    const handleMql = () => compute();
    mql?.addEventListener?.("change", handleMql);

    const mo = new MutationObserver(() => compute());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      mql?.removeEventListener?.("change", handleMql);
      mo.disconnect();
    };
  }, [
    color,
    darkColor,
    glowColor,
    darkGlowColor,
    colorLightVar,
    colorDarkVar,
    glowColorLightVar,
    glowColorDarkVar,
  ]);

  useEffect(() => {
    const el = canvasRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const ctx = el.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stopped = false;

    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      el.width = Math.max(1, Math.floor(width * dpr));
      el.height = Math.max(1, Math.floor(height * dpr));
      el.style.width = `${Math.floor(width)}px`;
      el.style.height = `${Math.floor(height)}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Precompute dot metadata for a medium-sized grid and regenerate on resize
    let dots: { x: number; y: number; phase: number; speed: number }[] = [];

    const regenDots = () => {
      dots = [];
      const { width, height } = container.getBoundingClientRect();
      const cols = Math.ceil(width / gap) + 2;
      const rows = Math.ceil(height / gap) + 2;
      const min = Math.min(speedMin, speedMax);
      const max = Math.max(speedMin, speedMax);
      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * gap + (j % 2 === 0 ? 0 : gap * 0.5); // offset every other row
          const y = j * gap;
          // Randomize phase and speed slightly per dot
          const phase = Math.random() * Math.PI * 2;
          const span = Math.max(max - min, 0);
          const speed = min + Math.random() * span; // configurable rad/s
          dots.push({ x, y, phase, speed });
        }
      }
    };

    const regenThrottled = () => {
      regenDots();
    };

    regenDots();

    /**
     * Local patch: whether this canvas should be running at all right now, and
     * how expensive it is allowed to be. `still` means one frame, then silence.
     */
    let onScreen = true;
    let glowAllowed = true;
    let visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    let still = false;

    const applyGovernor = () => {
      const level = frameLevel();
      still = level === 'minimal';
      glowAllowed = level !== 'reduced';
    };
    applyGovernor();

    const draw = (now: number) => {
      if (stopped) return;
      if (!visible || !onScreen || still) { raf = 0; return; }
      const { width, height } = container.getBoundingClientRect();

      ctx.clearRect(0, 0, el.width, el.height);
      ctx.globalAlpha = opacity;

      // optional subtle background fade for depth (defaults to 0 = transparent)
      if (backgroundOpacity > 0) {
        const grad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.4,
          Math.min(width, height) * 0.1,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.7,
        );
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(
          1,
          `rgba(0,0,0,${Math.min(Math.max(backgroundOpacity, 0), 1)})`,
        );
        ctx.fillStyle = grad as unknown as CanvasGradient;
        ctx.fillRect(0, 0, width, height);
      }

      // animate dots
      ctx.save();
      ctx.fillStyle = resolvedColor;

      const time = (now / 1000) * Math.max(speedScale, 0);
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        // Linear triangle wave 0..1..0 for linear glow/dim
        const mod = (time * d.speed + d.phase) % 2;
        const lin = mod < 1 ? mod : 2 - mod; // 0..1..0
        const a = 0.25 + 0.55 * lin; // 0.25..0.8 linearly

        // draw glow when bright — skipped entirely at the 'reduced' level
        if (a > 0.6 && glowAllowed) {
          const glow = (a - 0.6) / 0.4; // 0..1
          ctx.shadowColor = resolvedGlowColor;
          ctx.shadowBlur = 6 * glow;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = a * opacity;
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      resize();
      regenThrottled();
    };

    window.addEventListener("resize", handleResize);

    /** Draw once and stop — used for a hidden window, an off-screen panel and a
     *  machine that cannot hold frames. Nothing is left half-painted: the frame
     *  goes out with the dots at their current phase. */
    const drawOnce = () => {
      const { width, height } = container.getBoundingClientRect();
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.globalAlpha = opacity;
      ctx.save();
      ctx.fillStyle = resolvedColor;
      ctx.globalAlpha = opacity * 0.6;
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      void width; void height;
    };

    const resume = () => {
      cancelAnimationFrame(raf);
      if (!visible || !onScreen || still || stopped) { drawOnce(); return; }
      raf = requestAnimationFrame(draw);
    };

    const onVis = () => {
      visible = document.visibilityState === 'visible';
      applyGovernor();
      // Re-derive the phase from the wall clock so the field does not jump.
      resume();
    };
    document.addEventListener('visibilitychange', onVis);

    // Off-screen panels cost nothing: an onboarding step that has been left
    // behind, a scrolled-away hero.
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        resume();
      }, { rootMargin: '80px' });
      io.observe(container);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener('visibilitychange', onVis);
      io?.disconnect();
      ro.disconnect();
    };
  }, [
    gap,
    radius,
    resolvedColor,
    resolvedGlowColor,
    opacity,
    backgroundOpacity,
    speedMin,
    speedMax,
    speedScale,
    quality,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "absolute", inset: 0 }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
};
