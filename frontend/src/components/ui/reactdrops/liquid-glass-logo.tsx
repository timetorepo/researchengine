/*!
 * Liquid Glass Logo, from ReactDrops (ReactDrops Component License 1.0, see LICENSE.txt
 * in this folder). Copyright (c) 2026 ReactDrops. Vendored into Research Engine.
 * Local changes: the "use client" directive is removed (this is a Vite app), and the
 * JSX is written out for this build. The WebGL renderer does the drawing; a plain
 * image is shown instead when WebGL 2 is not available.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  createLiquidGlassLogoRenderer,
  liquidGlassLogoDefaults,
  liquidGlassLogoThemes,
  normalizeLiquidGlassLogo,
  type LiquidGlassLogoRenderer,
  type LiquidGlassLogoTuning,
} from './liquid-glass-logo-renderer';
import './liquid-glass-logo.css';

export type LiquidGlassLogoHandle = {
  replay: () => void;
  seek: (seconds: number) => void;
  pause: () => void;
  play: () => void;
};

export type LiquidGlassLogoProps = Partial<LiquidGlassLogoTuning> & {
  height?: number | string;
  /** Image URL drawn behind the animation, covering the container. The plate turns see-through. */
  backgroundImage?: string;
  /** Horizontal and vertical offsets as percentages of the frame; 0 centers the image. */
  backgroundX?: number;
  backgroundY?: number;
  /** Scale of the cover image, from 1 to 3. */
  backgroundScale?: number;
  /** Color and opacity (0–1) of the overlay between the image and the logo. */
  backgroundTint?: string;
  backgroundTintOpacity?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name; defaults to "Logo" or the visible wordmark text. */
  'aria-label'?: string;
};

export const LiquidGlassLogo = forwardRef<LiquidGlassLogoHandle, LiquidGlassLogoProps>(
  function LiquidGlassLogo(
    {
      height,
      backgroundImage,
      backgroundX = 0,
      backgroundY = 0,
      backgroundScale = 1,
      backgroundTint = '#000000',
      backgroundTintOpacity = 0,
      className = '',
      style,
      'aria-label': label,
      ...overrides
    },
    ref,
  ) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const engine = useRef<LiquidGlassLogoRenderer | null>(null);
    const [ready, setReady] = useState(false);
    const [fallback, setFallback] = useState(false);
    // A theme supplies the colors; any color passed explicitly still wins.
    const theme = liquidGlassLogoThemes[overrides.theme === 'light' ? 'light' : 'dark'];
    // Over a background image the plate is see-through: the glass keeps its
    // optics, but its own color would hide the picture behind it.
    const tuning = normalizeLiquidGlassLogo({
      ...liquidGlassLogoDefaults,
      ...theme,
      ...overrides,
      ...(backgroundImage ? { tile: false } : {}),
    });
    const key = JSON.stringify(tuning);
    const latest = useRef(tuning);
    latest.current = tuning;
    useImperativeHandle(
      ref,
      () => ({
        replay: () => engine.current?.replay(),
        seek: (seconds) => engine.current?.seek(seconds),
        pause: () => engine.current?.pause(),
        play: () => engine.current?.play(),
      }),
      [],
    );
    useEffect(() => {
      if (!canvas.current) return;
      let renderer: LiquidGlassLogoRenderer | null = null;
      try {
        renderer = createLiquidGlassLogoRenderer(canvas.current, latest.current, () =>
          setReady(true),
        );
      } catch {
        renderer = null;
      }
      if (!renderer) setFallback(true);
      engine.current = renderer;
      return () => {
        renderer?.dispose();
        engine.current = null;
      };
    }, []);
    // Apply size and DPR changes before the resized canvas can be painted.
    useLayoutEffect(() => engine.current?.update(latest.current), [key]);
    const markSource = tuning.mark === 'logo' ? tuning.logo : tuning.mark;
    return (
      <div
        className={`liquid-glass-logo ${className}`.trim()}
        role="img"
        aria-label={label ?? (tuning.ending === 'wordmark' ? tuning.text : 'Logo')}
        data-liquid-glass-ready={ready ? '' : undefined}
        style={{
          background: backgroundImage ? 'transparent' : tuning.background,
          height,
          ...style,
        }}
      >
        {backgroundImage && (
          <>
            <div
              aria-hidden="true"
              className="liquid-glass-logo-background"
              style={{
                backgroundImage: `url("${backgroundImage}")`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                transform: `translate(${backgroundX}%, ${backgroundY}%) scale(${backgroundScale})`,
              }}
            />
            <div
              aria-hidden="true"
              className="liquid-glass-logo-background"
              style={{ background: backgroundTint, opacity: backgroundTintOpacity }}
            />
          </>
        )}
        <canvas ref={canvas} aria-hidden="true" />
        {fallback && (
          <div className="liquid-glass-logo-fallback" aria-hidden="true" style={{ color: tuning.textColor }}>
            {tuning.ending === 'logo' ? (
              tuning.logo && <img src={tuning.logo} alt="" />
            ) : (
              <>
                {markSource && <img src={markSource} alt="" />}
                {tuning.text}
              </>
            )}
          </div>
        )}
      </div>
    );
  },
);
