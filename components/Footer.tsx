import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row gap-6 justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 bg-signal text-ink flex items-center justify-center font-display text-xs pt-0.5">
                CC
              </span>
              <span className="font-display uppercase tracking-wide">
                ClearCondo
              </span>
            </div>
            <p className="text-sm text-white/50 max-w-md leading-relaxed">
              ClearCondo summarizes condominium documents. It is not legal,
              financial, or real-estate advice.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:text-right">
            <Link
              href="/privacy"
              className="micro-label text-white/60 hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <span className="micro-label text-white/35">
              Built for Build North 2026
            </span>
            <span className="micro-label text-white/35">Calgary · Alberta</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
