import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 text-sm text-stone-500 flex flex-col sm:flex-row gap-2 justify-between">
        <p>
          ClearCondo summarizes condominium documents. It is not legal,
          financial, or real-estate advice.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-stone-800 underline underline-offset-2">
            Privacy
          </Link>
          <p>Built for Build North 2026.</p>
        </div>
      </div>
    </footer>
  );
}
