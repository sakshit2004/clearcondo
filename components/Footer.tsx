import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-ink bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="grid sm:grid-cols-12 gap-6">
          <div className="sm:col-span-7">
            <div className="flex items-baseline gap-2.5 mb-3">
              <span className="w-2.5 h-2.5 bg-signal inline-block translate-y-[-1px]" aria-hidden />
              <span className="font-bold tracking-tight text-ink">ClearCondo</span>
            </div>
            <p className="text-[13px] text-stone-500 max-w-md leading-relaxed">
              ClearCondo summarizes condominium documents. It is not legal,
              financial, or real-estate advice.
            </p>
          </div>
          <div className="sm:col-span-5 flex flex-col gap-2 sm:items-end">
            <Link
              href="/privacy"
              className="micro-label text-stone-500 hover:text-ink transition-colors"
            >
              Privacy
            </Link>
            <span className="micro-label text-stone-400">
              Built for Build North 2026
            </span>
            <span className="micro-label text-stone-400">Calgary · Alberta</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
