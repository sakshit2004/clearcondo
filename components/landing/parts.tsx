import Link from "next/link";
import type { ReactNode } from "react";
import Reveal from "@/components/Reveal";

export function Arrow() {
  return (
    <svg className="nudge" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SectionHead({ title, body }: { title: string; body: string }) {
  return (
    <Reveal className="max-w-2xl mb-10">
      <h2 className="text-3xl sm:text-[40px] font-bold tracking-[-0.025em] leading-[1.1]">{title}</h2>
      <p className="mt-3 text-lg text-muted leading-relaxed">{body}</p>
    </Reveal>
  );
}

export const primaryBtn =
  "btn-lift inline-flex items-center gap-2.5 rounded-[10px] bg-ink hover:bg-accent text-white font-semibold px-6 min-h-12";
export const secondaryBtn =
  "inline-flex items-center rounded-[10px] border border-line2 bg-white hover:border-ink text-ink font-semibold px-6 min-h-12 transition-colors";

/** The top of /buyers and /owners: who it's for, what it does, one way in. */
export function AudienceHero({
  audience,
  title,
  body,
  cta,
  sample,
  note,
}: {
  audience: "buyers" | "owners";
  title: string;
  body: ReactNode;
  cta: { href: string; label: string };
  sample: { href: string; label: string };
  note: string;
}) {
  const own = audience === "owners";
  return (
    <section className="bg-surface border-b border-line">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-14 sm:pt-20 sm:pb-20">
        <span
          className={`rise-in inline-block rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] ${
            own ? "bg-ink text-white" : "bg-accent-soft text-accent-dark"
          }`}
        >
          For condo {audience}
        </span>
        <h1
          className="rise-in mt-5 max-w-3xl font-bold text-[38px] sm:text-[56px] tracking-[-0.03em] leading-[1.05] text-ink"
          style={{ animationDelay: "80ms", textWrap: "balance" }}
        >
          {title}
        </h1>
        <p className="rise-in mt-5 max-w-2xl text-lg text-ink2 leading-relaxed" style={{ animationDelay: "160ms" }}>
          {body}
        </p>
        <div className="rise-in mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "240ms" }}>
          <Link href={cta.href} className={primaryBtn}>
            {cta.label} <Arrow />
          </Link>
          <Link href={sample.href} className={secondaryBtn}>
            {sample.label}
          </Link>
        </div>
        <p className="rise-in mt-4 text-sm text-subtle" style={{ animationDelay: "320ms" }}>
          {note}
        </p>
      </div>
    </section>
  );
}

/** The one link between the two sides, at the foot of each page. */
export function SwitchBand({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="rounded-[14px] border border-line bg-white p-6 sm:p-7 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="max-w-xl">
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            <p className="mt-1.5 text-muted leading-relaxed">{body}</p>
          </div>
          <Link href={href} className={secondaryBtn}>
            {label} <span aria-hidden className="ml-2">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
