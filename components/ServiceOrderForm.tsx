"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { guessChecklist } from "@/lib/doc-hints";

interface SentDoc {
  filename: string;
  pageCount: number;
}

interface Confirmation {
  refCode: string;
  documents: SentDoc[];
}

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 12;

const inputCls =
  "w-full rounded-lg border border-line2 bg-white px-3.5 min-h-[46px] text-[15px] text-ink placeholder:text-subtle focus:outline-2 focus:outline-accent focus:outline-offset-1 focus:border-accent";
const labelCls = "block text-sm font-semibold mb-1.5";

function kb(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The service order form. No account, no sign-up: who you are, where the
 * finished report goes, which property, and the package as PDFs. On
 * success the sender gets a reference code and a link to the order's
 * status page — the report itself arrives by email.
 */
export default function ServiceOrderForm({ emailHint }: { emailHint?: string }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);

  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  const tooBig = totalBytes > MAX_BYTES;
  const covered = guessChecklist(files.map((f) => f.name));
  const coveredCount = covered.filter((c) => c.have).length;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const pdfs = Array.from(list).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...pdfs.filter((f) => !seen.has(f.name + f.size))].slice(0, MAX_FILES);
    });
    if (pdfs.length < list.length) setError("Only PDF files can be attached.");
    else setError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) {
      setError("Attach at least one PDF from the document package.");
      return;
    }
    if (tooBig) {
      setError("The package is over 4 MB. Remove a file or send the largest one separately.");
      return;
    }
    const form = new FormData(e.currentTarget);
    form.delete("picker");
    for (const f of files) form.append("files", f);
    setSending(true);
    try {
      const res = await fetch("/api/intake", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        refCode?: string;
        documents?: SentDoc[];
      };
      if (!res.ok || !data.refCode) {
        setError(data.error || "Something went wrong sending your package. Please try again.");
        return;
      }
      setConfirmation({ refCode: data.refCode, documents: data.documents ?? [] });
    } catch {
      setError("We couldn't reach the order desk. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (confirmation) {
    return (
      <div className="rise-in report-paper rounded-2xl p-6 sm:p-8 max-w-2xl">
        <div className="pop-in w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 14 14" aria-hidden>
            <path d="M3 7.3l2.4 2.4L11 4.2" stroke="#1d4ed8" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="micro-label text-subtle">Order received</div>
        <div className="font-bold text-3xl tracking-tight text-ink tabular-nums mt-1">{confirmation.refCode}</div>
        <p className="text-muted leading-relaxed mt-4 max-w-lg">
          Your package is with us. The verified report — every claim checked
          against the page it cites — will be delivered to your email. Keep
          the reference code with the client file.
        </p>
        {confirmation.documents.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2">
            {confirmation.documents.map((d) => (
              <li key={d.filename} className="flex justify-between gap-4 rounded-lg border border-line px-3.5 py-2.5 text-sm">
                <span className="truncate">{d.filename}</span>
                <span className="tabular-nums text-subtle whitespace-nowrap">{d.pageCount} pages</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/order/${confirmation.refCode}`}
            className="btn-lift inline-flex items-center rounded-[10px] bg-ink hover:bg-accent text-white font-semibold px-5 min-h-11"
          >
            Track this order
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center rounded-[10px] border border-line2 bg-white hover:border-ink font-semibold px-5 min-h-11 transition-colors"
          >
            See what the report looks like
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-8 items-start">
      <form onSubmit={onSubmit} className="flex-[999_1_560px] min-w-0 report-paper rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-bold mb-4">The documents</h2>
        <label
          htmlFor="so-files"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center text-center gap-2.5 rounded-xl border-[1.5px] border-dashed px-6 py-9 cursor-pointer transition-colors ${
            dragging ? "border-accent bg-accent-soft" : "border-info bg-surface2 hover:border-accent"
          }`}
        >
          <span className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 22 22" aria-hidden>
              <path d="M11 15V4M6.5 8.5L11 4l4.5 4.5M4 15v3h14v-3" stroke="#1d4ed8" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-semibold">
            Drop PDFs here or <span className="text-accent underline">browse</span>
          </span>
          <span className="text-sm text-subtle">Up to {MAX_FILES} files, 4 MB in total · scanned PDFs are fine</span>
          <input
            id="so-files"
            name="picker"
            aria-label="The document package (PDFs)"
            ref={filesRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {files.length > 0 && (
          <>
            <ul className="mt-4 flex flex-col gap-2">
              {files.map((f, i) => (
                <li key={f.name + f.size} className="open-in flex items-center gap-3 rounded-[10px] border border-line pl-3.5 pr-1 py-1">
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="flex-none">
                    <path d="M5 2h7l4 4v12H5z" stroke="#4a5058" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{f.name}</div>
                    <div className="text-[13px] text-subtle">{kb(f.size)}</div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="w-11 h-11 rounded-lg inline-flex items-center justify-center text-muted hover:bg-surface hover:text-ink"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <p className={`text-[13px] mt-2 tabular-nums ${tooBig ? "text-signal-dark font-semibold" : "text-subtle"}`}>
              {files.length} file{files.length === 1 ? "" : "s"} · {kb(totalBytes)} of 4 MB
            </p>
          </>
        )}

        <h2 className="text-lg font-bold mt-9 mb-4">You and the property</h2>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
          <div>
            <label htmlFor="so-name" className={labelCls}>
              Your name
            </label>
            <input id="so-name" name="realtorName" required autoComplete="name" placeholder="Jordan Lee" className={inputCls} />
          </div>
          <div>
            <label htmlFor="so-brokerage" className={labelCls}>
              Brokerage <span className="font-normal text-subtle">(optional)</span>
            </label>
            <input id="so-brokerage" name="brokerage" autoComplete="organization" placeholder="Century 21 Bamber" className={inputCls} />
          </div>
          <div>
            <label htmlFor="so-email" className={labelCls}>
              Email for the finished report
            </label>
            <input
              id="so-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={emailHint || "you@brokerage.ca"}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="so-date" className={labelCls}>
              Condition removal date <span className="font-normal text-subtle">(optional)</span>
            </label>
            <input id="so-date" name="conditionDate" type="date" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="so-address" className={labelCls}>
              Property address
            </label>
            <input
              id="so-address"
              name="propertyAddress"
              required
              autoComplete="street-address"
              placeholder="Unit 506, 1234 North Hill Terrace NW, Calgary"
              className={inputCls}
            />
          </div>
        </div>

        <label className="flex items-start gap-3 mt-6 text-sm text-muted leading-relaxed cursor-pointer">
          <input type="checkbox" name="consent" value="true" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#1d4ed8]" />
          <span>
            I&apos;m authorized to share these documents for review. ClearCondo
            reads them to prepare the report; the extracted text is deleted
            after 30 days and the PDFs themselves are never stored.
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-signal bg-signal-soft px-4 py-3 text-sm text-ink mt-6" role="alert">
            {error}
          </div>
        )}

        <div className="mt-7 pt-6 border-t border-[#eceee9] flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={sending}
            className="btn-lift inline-flex items-center rounded-[10px] bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-semibold px-6 min-h-12"
          >
            {sending ? "Sending…" : "Send the package"}
          </button>
          <span className="text-sm text-subtle">No account · No software to learn</span>
        </div>
        {sending && <div className="loadbar mt-5" aria-hidden />}
      </form>

      <aside className="flex-[1_1_300px] report-paper rounded-2xl p-6 sm:p-7" aria-label="Package checklist">
        <h2 className="text-lg font-bold">Package checklist</h2>
        <p className="text-sm text-subtle mt-1 mb-4">
          A complete Alberta resale package. More documents, fewer blind spots.
        </p>
        <div
          className="h-2 rounded-full bg-[#eceee9] overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={covered.length}
          aria-valuenow={coveredCount}
          aria-label="Documents attached"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${(coveredCount / covered.length) * 100}%` }}
          />
        </div>
        <div className="text-[13px] text-muted mt-2 mb-4 tabular-nums">
          {coveredCount} of {covered.length} look attached
        </div>
        <ul className="flex flex-col gap-3 text-[15px]">
          {covered.map((c) => (
            <li key={c.id} className={`flex gap-2.5 items-start ${c.have ? "" : "text-muted"}`}>
              {c.have ? (
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="pop-in flex-none mt-0.5" style={{ animationDelay: "0s" }}>
                  <circle cx="10" cy="10" r="9" fill="#1d4ed8" />
                  <path d="M6 10.2l2.6 2.6L14 7.4" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="flex-none mt-0.5">
                  <circle cx="10" cy="10" r="8.3" stroke="#b8bec6" strokeWidth="1.4" fill="none" />
                </svg>
              )}
              <span className={c.have ? "font-semibold" : ""}>
                {c.label}
                <span className="sr-only">{c.have ? " (attached)" : " (not attached)"}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-subtle mt-5">
          Matched by file name for now — we confirm each document&apos;s type
          when we read it. Missing something? Send what you have; the report
          lists what to ask the seller for.
        </p>
      </aside>
    </div>
  );
}
