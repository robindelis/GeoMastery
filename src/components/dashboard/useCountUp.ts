import { useEffect, useRef, useState } from 'react';

const shouldSkipCountUp = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(pointer: coarse)').matches
  );
};

/**
 * Counts a number up to its target on mount / change.
 * Jumps straight to the value on mobile (coarse pointer) or when the user prefers reduced motion.
 */
export const useCountUp = (target: number, duration = 900): number => {
  const [value, setValue] = useState(() => (shouldSkipCountUp() ? target : 0));
  const fromRef = useRef(shouldSkipCountUp() ? target : 0);

  useEffect(() => {
    if (shouldSkipCountUp()) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;

    let frame = 0;
    let lastVal = from;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const next = Math.round(from + delta * eased);
      if (next !== lastVal) {
        lastVal = next;
        setValue(next);
      }
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
};
