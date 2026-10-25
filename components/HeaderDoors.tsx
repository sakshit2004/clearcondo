"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Which side a path belongs to; null on shared pages (landing, privacy…). */
export function activeSide(path: string): "buy" | "own" | null {
  if (path === "/owners" || path.startsWith("/app/own") || path.startsWith("/demo/own")) return "own";
  if (path === "/buyers" || path === "/app" || path.startsWith("/app/") || path === "/demo") return "buy";
  return null;
}

const base =
  "header-door btn-lift border text-[14px] sm:text-[15px] font-semibold px-3 sm:px-4 min-h-10 sm:min-h-11 inline-flex items-center rounded-lg whitespace-nowrap transition-colors";
const idle = "bg-white border-line2 text-ink hover:border-ink";
const active = "bg-ink border-ink text-white";

/** The two doors in the header: both white, the side you're on in black. */
export default function HeaderDoors() {
  return <Doors side={activeSide(usePathname() ?? "/")} />;
}

/** Before the path is known (static shell): both doors white. */
export function HeaderDoorsStatic() {
  return <Doors side={null} />;
}

function Doors({ side }: { side: "buy" | "own" | null }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/app"
        aria-current={side === "buy" ? "page" : undefined}
        data-active={side === "buy" || undefined}
        className={`${base} ${side === "buy" ? active : idle}`}
      >
        <span className="sm:hidden">Buying</span>
        <span className="hidden sm:inline">For buyers</span>
      </Link>
      <Link
        href="/app/own"
        aria-current={side === "own" ? "page" : undefined}
        data-active={side === "own" || undefined}
        className={`${base} ${side === "own" ? active : idle}`}
      >
        <span className="sm:hidden">Owning</span>
        <span className="hidden sm:inline">For owners</span>
      </Link>
    </div>
  );
}
