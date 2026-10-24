"use client";

import { useEffect, useState } from "react";

/**
 * Counts from 0 to `target` with an ease-out curve after `delayMs`.
 * Stays on the target under prefers-reduced-motion. Starts at the target
 * so the server-rendered HTML carries the real figure.
 */
export function useCountUp(target: number, durationMs = 1500, delayMs = 400): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now() + delayMs;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, delayMs]);

  return value;
}
