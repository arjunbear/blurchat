'use client';

import { useEffect } from 'react';
import {
  motion,
  useAnimate,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import Image from 'next/image';

const STORAGE_KEY = 'mascot-hero-seen';
const INITIAL = { x: '100%', y: '-20%', rotate: -15, opacity: 0 };
const REST = { x: '0%', y: '0%', rotate: 0, opacity: 1 };
const ENTRANCE_TARGET = {
  x: '0%',
  y: '0%',
  rotate: [-15, 6, 0],
  opacity: 1,
} as const;
const ENTRANCE_TRANSITION = {
  delay: 0.2,
  x: { duration: 1.3, ease: [0.16, 1, 0.3, 1] },
  y: { duration: 1.3, ease: [0.34, 1.56, 0.64, 1] },
  rotate: { duration: 1.3, times: [0, 0.65, 1], ease: 'easeOut' },
  opacity: { duration: 0.5, ease: 'easeOut' },
} as const;

// Background mascot on the right of the hero. Visible on every viewport
// (scaled down on mobile via the size clamp) so the character isn't
// desktop-only.
//
// Animation policy:
//   - Plays the entrance ONCE per tab session (sessionStorage flag)
//   - Re-plays on refresh (Performance API navigation type === 'reload')
//   - Snaps to rest on SPA back-nav within the same session
//   - Snaps on BFCache restore (pageshow.persisted)
//   - Respects `prefers-reduced-motion` — no entrance, no scroll-out
export function MascotHero() {
  const reducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const scrollX = useTransform(scrollY, [0, 400], ['0%', '110%']);
  const scrollOpacity = useTransform(scrollY, [0, 350], [1, 0]);
  const [scope, animate] = useAnimate();

  useEffect(() => {
    const navEntry = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming | undefined;
    const isReload = navEntry?.type === 'reload';
    const seen = sessionStorage.getItem(STORAGE_KEY) !== null;
    const shouldSkipEntrance = Boolean(reducedMotion) || (seen && !isReload);

    if (shouldSkipEntrance) {
      animate(scope.current, REST, { duration: 0 });
    } else {
      animate(scope.current, ENTRANCE_TARGET, ENTRANCE_TRANSITION);
      sessionStorage.setItem(STORAGE_KEY, '1');
    }

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) animate(scope.current, REST, { duration: 0 });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [animate, scope, reducedMotion]);

  return (
    <motion.div
      style={reducedMotion ? undefined : { x: scrollX, opacity: scrollOpacity }}
      className="pointer-events-none absolute inset-y-0 right-0 -z-10 flex items-center"
      aria-hidden
    >
      <motion.div ref={scope} initial={INITIAL}>
        <Image
          src="/mascot-hero.png"
          alt=""
          width={615}
          height={615}
          priority
          className="size-[clamp(140px,46vw,615px)] object-contain opacity-30 blur-[2px] xl:opacity-100 xl:blur-none"
        />
      </motion.div>
    </motion.div>
  );
}
