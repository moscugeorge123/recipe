import { useEffect, useState } from 'react';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(reducedMotionQuery).matches;
}

/** A counter that advances every `ms`; runs 4× slower when the viewer prefers reduced motion. */
export function useTicker(ms: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const period = prefersReducedMotion() ? ms * 4 : ms;
    const id = window.setInterval(() => setTick((t) => t + 1), period);
    return () => window.clearInterval(id);
  }, [ms]);
  return tick;
}

/** Adds `is-in` to every `[data-reveal]` element the first time it scrolls into view. */
export function useRevealOnScroll(): void {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);
}

/** Current `window.scrollY`, throttled to animation frames. */
export function useScrollY(): number {
  const [y, setY] = useState(0);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setY(window.scrollY));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return y;
}
