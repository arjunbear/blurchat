'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  motion,
  useAnimate,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import Image from 'next/image';

// All mascots share one "seen this session" flag — they all animate together
// on first visit and all snap to rest on return.
const STORAGE_KEY = 'mascots-seen';

// Shared image styling used by every mascot on the page (size + dimming).
// Tuning these values affects all mascots consistently.
const MASCOT_IMAGE_CLASSES =
  'size-[clamp(140px,35vw,480px)] opacity-30 blur-[2px]';

const REST = { x: '0%', y: '0%', rotate: 0, opacity: 1 };

const ENTRANCE_TRANSITION = {
  delay: 0.2,
  x: { duration: 1.3, ease: [0.16, 1, 0.3, 1] },
  y: { duration: 1.3, ease: [0.34, 1.56, 0.64, 1] },
  rotate: { duration: 1.3, times: [0, 0.65, 1], ease: 'easeOut' },
  opacity: { duration: 0.5, ease: 'easeOut' },
} as const;

type EnterFrom = 'right' | 'left' | 'top' | 'bottom';

const INITIAL_BY_DIRECTION: Record<
  EnterFrom,
  { x: string; y: string; rotate: number }
> = {
  right: { x: '100%', y: '-20%', rotate: -15 },
  left: { x: '-100%', y: '-20%', rotate: 15 },
  top: { x: '0%', y: '-100%', rotate: -10 },
  bottom: { x: '0%', y: '100%', rotate: 10 },
};

interface MascotProps {
  src: string;
  width: number;
  height: number;
  /** Tailwind classes for the outer wrapper — position, flex alignment, etc. */
  containerClassName?: string;
  /** Tailwind classes for the <Image> — size, opacity/blur breakpoints. */
  imageClassName?: string;
  /** Off-screen direction the mascot enters from. Defaults to 'right'. */
  enterFrom?: EnterFrom;
  /** Direction the mascot slides off-screen as user scrolls past. Defaults to match enterFrom (or 'right' for top/bottom enters). */
  scrollOutTo?: 'right' | 'left' | 'up' | 'down';
  /** LCP hint — use only for the most prominent above-the-fold mascot. */
  priority?: boolean;
}

// Generic mascot — absolutely positioned, sliding entrance from off-screen with
// a curve + rotation overshoot, fades out as the user scrolls past it.
//
// Animation policy (shared across all mascots on the page):
//   - Entrance plays ONCE per tab session (sessionStorage flag)
//   - Re-plays on refresh (Performance API navigation type === 'reload')
//   - Snaps to rest on SPA back-nav within the same session
//   - Snaps on BFCache restore (pageshow.persisted)
//   - Respects `prefers-reduced-motion` — no entrance, no scroll-out
export function Mascot({
  src,
  width,
  height,
  containerClassName,
  imageClassName,
  enterFrom = 'right',
  scrollOutTo,
  priority = false,
}: MascotProps) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Per-element scroll progress — 0 as the mascot enters the viewport from
  // bottom, 1 when it has fully scrolled past the top. Lets each mascot fade
  // based on its own position rather than global page scroll (which would
  // pre-fade everything below the fold before the user could see it).
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const exitDirection = scrollOutTo ?? (enterFrom === 'left' ? 'left' : 'right');
  const isVerticalExit = exitDirection === 'up' || exitDirection === 'down';
  // Horizontal exits use % (relative to container — image-width for edge-anchored
  // mascots → ~150-500px of travel). Vertical exits use vh (viewport-relative)
  // because vertical containers are often full-section height; using % there
  // would produce a 110vh sweep which feels far too dramatic.
  const horizontalExitOffset = exitDirection === 'left' ? '-110%' : '110%';
  const verticalExitOffset = exitDirection === 'up' ? '-30vh' : '30vh';
  const scrollX = useTransform(
    scrollYProgress,
    [0.5, 0.7],
    ['0%', isVerticalExit ? '0%' : horizontalExitOffset]
  );
  const scrollY = useTransform(
    scrollYProgress,
    [0.5, 0.7],
    ['0%', isVerticalExit ? verticalExitOffset : '0%']
  );
  const scrollOpacity = useTransform(scrollYProgress, [0.5, 0.7], [1, 0]);

  const [scope, animate] = useAnimate();

  const initial = useMemo(() => {
    const { x, y, rotate } = INITIAL_BY_DIRECTION[enterFrom];
    return { x, y, rotate, opacity: 0 };
  }, [enterFrom]);

  useEffect(() => {
    const navEntry = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming | undefined;
    const isReload = navEntry?.type === 'reload';
    const seen = sessionStorage.getItem(STORAGE_KEY) !== null;
    const shouldSkipEntrance = Boolean(reducedMotion) || (seen && !isReload);

    if (shouldSkipEntrance) {
      animate(scope.current, REST, { duration: 0 });
      return;
    }

    const startRotate = INITIAL_BY_DIRECTION[enterFrom].rotate;
    const overshoot = -startRotate * 0.4;
    animate(
      scope.current,
      {
        x: '0%',
        y: '0%',
        rotate: [startRotate, overshoot, 0],
        opacity: 1,
      },
      ENTRANCE_TRANSITION
    );
    sessionStorage.setItem(STORAGE_KEY, '1');

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) animate(scope.current, REST, { duration: 0 });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [animate, scope, reducedMotion, enterFrom]);

  return (
    <motion.div
      ref={containerRef}
      style={
        reducedMotion
          ? undefined
          : { x: scrollX, y: scrollY, opacity: scrollOpacity }
      }
      className={`pointer-events-none absolute -z-10 select-none ${containerClassName ?? ''}`}
      aria-hidden
    >
      <motion.div ref={scope} initial={initial}>
        <Image
          src={src}
          alt=""
          width={width}
          height={height}
          priority={priority}
          loading="eager"
          className={`object-contain ${imageClassName ?? ''}`}
        />
      </motion.div>
    </motion.div>
  );
}

// The five-mascot ensemble pinned around the hero. Each enters from a
// different direction and fades as it scrolls past. Drop into any
// `relative w-full overflow-hidden` section to render the cluster.
export function MascotCluster() {
  // Stacking order (top → bottom as they overlap): blue, yellow, orange, purple, green.
  // DOM order is the reverse: first rendered = bottom of stack.
  return (
    <>
      <Mascot
        src="/mascots/green.png"
        width={615}
        height={615}
        containerClassName="-top-4 md:-top-12 xl:-top-20 inset-x-0 bottom-0 flex items-start justify-center"
        imageClassName={MASCOT_IMAGE_CLASSES}
        enterFrom="top"
        scrollOutTo="down"
      />
      <Mascot
        src="/mascots/purple.png"
        width={615}
        height={615}
        containerClassName="inset-y-0 left-0 flex items-center pb-48"
        imageClassName={MASCOT_IMAGE_CLASSES}
        enterFrom="left"
        scrollOutTo="right"
      />
      <Mascot
        src="/mascots/orange.png"
        width={615}
        height={615}
        containerClassName="inset-y-0 right-0 flex items-center"
        imageClassName={MASCOT_IMAGE_CLASSES}
        enterFrom="right"
        scrollOutTo="left"
        priority
      />
      <Mascot
        src="/mascots/yellow.png"
        width={615}
        height={615}
        containerClassName="bottom-12 left-12 xl:left-72"
        imageClassName={MASCOT_IMAGE_CLASSES}
        enterFrom="bottom"
      />
      <Mascot
        src="/mascots/blue.png"
        width={615}
        height={615}
        containerClassName="bottom-0 right-12 xl:right-72"
        imageClassName={MASCOT_IMAGE_CLASSES}
        enterFrom="bottom"
        scrollOutTo="left"
      />
    </>
  );
}

