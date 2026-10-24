import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-md">
            <Logo size={24} />
            <p className="text-sm text-subtle leading-relaxed mt-3">
              ClearCondo summarizes condominium documents. It is not legal,
              financial, or real-estate advice.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <Link href="/demo" className="text-muted hover:text-ink transition-colors">
              Sample report
            </Link>
            <Link href="/privacy" className="text-muted hover:text-ink transition-colors">
              Privacy
            </Link>
            <span className="text-subtle">Know before you buy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
