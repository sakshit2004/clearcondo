"use client";

import { cad } from "@/lib/format";
import { useCountUp } from "./useCountUp";

/** The headline exposure number, counted up on first view. */
export default function ExposureFigure({
  amount,
  className = "",
}: {
  amount: number;
  className?: string;
}) {
  const value = useCountUp(amount);
  return (
    <span className={`tabular-nums ${className}`} aria-label={cad(amount)}>
      {cad(value)}
    </span>
  );
}
