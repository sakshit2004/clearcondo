import Link from "next/link";
import Logo from "./Logo";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Buyers",
    links: [
      ["For buyers", "/buyers"],
      ["Buyer dashboard", "/app"],
      ["Sample report", "/demo"],
    ],
  },
  {
    title: "Owners",
    links: [
      ["For owners", "/owners"],
      ["Owner dashboard", "/app/own"],
      ["Sample report", "/demo/own"],
    ],
  },
  {
    title: "ClearCondo",
    links: [
      ["Home", "/"],
      ["Privacy", "/privacy"],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-white overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-14">
        <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-x-8 gap-y-10">
          <div className="col-span-2 sm:col-span-1 max-w-sm">
            <Logo size={24} />
            <p className="text-[15px] text-ink2 leading-relaxed mt-3">Before you buy, and after.</p>
            <p className="text-sm text-subtle leading-relaxed mt-2">
              ClearCondo summarizes condominium documents and public records. It is not legal, financial, or
              real-estate advice.
            </p>
          </div>
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h2 className="micro-label text-stone-400">{c.title}</h2>
              <ul className="mt-3 space-y-2.5 text-sm">
                {c.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-muted hover:text-ink transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5 text-[13px] text-subtle">
          <span>© 2026 ClearCondo</span>
          <span>Made in Canada</span>
        </div>
      </div>

      {/* The full-width wordmark. Decorative: the name is already in the logo above. */}
      <div aria-hidden className="mx-auto max-w-6xl px-4 sm:px-6 select-none">
        <div className="font-bold text-ink tracking-[-0.055em] leading-[0.9] pb-[0.04em] text-[clamp(56px,17.6vw,200px)] whitespace-nowrap">
          ClearCondo
        </div>
      </div>
    </footer>
  );
}
