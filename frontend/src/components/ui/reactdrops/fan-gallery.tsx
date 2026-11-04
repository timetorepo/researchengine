/*!
 * Fan Gallery, from ReactDrops (ReactDrops Component License 1.0, see LICENSE.txt in this
 * folder). Copyright (c) 2026 ReactDrops.
 *
 * Adapted for Research Engine: the JSX and prop plumbing were rebuilt by hand from the
 * registry source, which fetches without its JSX. The motion, layout and playback modules
 * are vendored unchanged. The props and the ref handle here are this app's own.
 */
'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import './fan-gallery.css';
import { fanDefaults, type FanEntrance, type FanStack } from './fan-layout';
import { createFanPlayback, type FanAction, type FanPlayback, type FanTrigger } from './fan-playback';

export interface FanGalleryItem {
  src: string;
  alt: string;
  href?: string;
}

export interface FanGalleryProps {
  items: FanGalleryItem[];
  heading?: ReactNode;
  cardWidth?: number;
  aspectRatio?: number;
  spacing?: number;
  lift?: number;
  entrance?: FanEntrance;
  trigger?: FanTrigger;
  stackFrom?: FanStack;
  speed?: number;
  stagger?: number;
  bounce?: number;
  hoverSpeed?: number;
  radius?: number;
  once?: boolean;
  viewportStart?: number;
  /** Called with the index of the card that was chosen (click or Enter). */
  onSelect?: (index: number) => void;
  className?: string;
  style?: CSSProperties;
}

export interface FanGalleryHandle {
  play: () => void;
  reset: () => void;
  finish: () => void;
}

const FanGallery = forwardRef<FanGalleryHandle, FanGalleryProps>(function FanGallery(
  {
    items,
    heading,
    cardWidth = fanDefaults.cardWidth,
    aspectRatio = fanDefaults.aspectRatio,
    spacing = fanDefaults.spacing,
    lift = fanDefaults.lift,
    entrance = 'stack',
    trigger = 'scroll',
    stackFrom = fanDefaults.stackFrom,
    speed = 0.9,
    stagger = 0.08,
    bounce = 0.25,
    hoverSpeed = 0.35,
    radius = 18,
    once = true,
    viewportStart = 85,
    onSelect,
    className,
    style,
  },
  ref,
) {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);
  const playbackRef = useRef<FanPlayback | null>(null);
  const pending = useRef<FanAction | null>(null);
  const options = {
    cardWidth,
    aspectRatio,
    spacing,
    lift,
    curve: fanDefaults.curve,
    tilt: fanDefaults.tilt,
    spread: fanDefaults.spread,
    stackFrom,
    entrance,
    radius,
    speed,
    stagger,
    bounce,
    hoverSpeed,
    trigger,
    viewportStart,
    once,
  };
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useImperativeHandle(
    ref,
    () => ({
      play: () => dispatch('play'),
      reset: () => dispatch('reset'),
      finish: () => dispatch('finish'),
    }),
    [],
  );
  function dispatch(action: FanAction) {
    if (playbackRef.current) playbackRef.current.dispatch(action);
    else pending.current = action;
  }

  // Mount and remount playback only when the set of cards or the trigger changes.
  const count = items.length;
  const structure = `${count}|${trigger}|${entrance}`;
  useLayoutEffect(() => {
    const root = rootRef.current,
      stage = stageRef.current;
    if (!root || !stage) return;
    const cards = cardRefs.current.slice(0, count) as (HTMLButtonElement | HTMLAnchorElement)[];
    const playback = createFanPlayback(root, stage, cards, optionsRef.current as never, pending);
    playbackRef.current = playback;
    return () => {
      playback.destroy();
      if (playbackRef.current === playback) playbackRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure]);

  // Geometry and timing update live, without remounting.
  useEffect(() => {
    playbackRef.current?.update(optionsRef.current as never);
  }, [cardWidth, aspectRatio, spacing, lift, stackFrom, speed, stagger, bounce, hoverSpeed, radius]);

  return (
    <section ref={rootRef} className={`fan-gallery${className ? ` ${className}` : ''}`} style={style}>
      {heading ? <div className="fan-gallery-heading">{heading}</div> : null}
      <div
        ref={stageRef}
        className="fan-gallery-stage"
        onPointerMove={(event) => playbackRef.current?.point(event.clientX, event.clientY)}
        onPointerLeave={() => playbackRef.current?.point(-1e6, -1e6)}
      >
        {items.map((item, index) => {
          const common = {
            ref: (node: HTMLButtonElement | HTMLAnchorElement | null) => {
              cardRefs.current[index] = node;
            },
            className: 'fan-gallery-card',
            onFocus: () => playbackRef.current?.activate(index),
            onBlur: () => playbackRef.current?.activate(-1),
          };
          const picture = <img src={item.src} alt={item.alt} draggable={false} />;
          return item.href ? (
            <a
              key={`${item.src}-${index}`}
              {...common}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => onSelect?.(index)}
            >
              {picture}
            </a>
          ) : (
            <button
              key={`${item.src}-${index}`}
              {...common}
              type="button"
              aria-label={item.alt}
              onClick={() => onSelect?.(index)}
            >
              {picture}
            </button>
          );
        })}
      </div>
    </section>
  );
});

export default FanGallery;
