"use client";

import { useRef, useState } from "react";
import Link from "next/link";

interface SentDoc {
  filename: string;
  pageCount: number;
}

interface Confirmation {
  refCode: string;
  documents: SentDoc[];
}

const inputCls =
  "w-full border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-stone-400 focus:outline-none focus:border-ink";
const labelCls = "micro-label text-stone-500 block mb-2";

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
  const [fileNames, setFileNames] = useState<string[]>([]);
  const filesRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const files = filesRef.current?.files;
    if (!files || files.length === 0) {
      setError("Attach at least one PDF from the document package.");
      return;
    }
    for (const f of Array.from(files)) form.append("files", f);
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
      <div className="border border-ink bg-white p-6 sm:p-8">
        <div className="micro-label text-stone-500 mb-2">Order received</div>
        <div className="font-bold text-3xl tracking-tight text-ink tabular-nums">
          {confirmation.refCode}
        </div>
        <p className="text-stone-600 leading-relaxed mt-4 max-w-lg">
          Your package is with us. The verified report — every claim checked
          against the page it cites — will be delivered to your email. Keep
          the reference code with the client file.
        </p>
        {confirmation.documents.length > 0 && (
          <table className="w-full text-sm mt-6">
            <tbody className="text-stone-600">
              {confirmation.documents.map((d) => (
                <tr key={d.filename} className="border-t border-stone-200">
                  <td className="py-2 pr-4">{d.filename}</td>
                  <td className="py-2 text-right tabular-nums">
                    {d.pageCount} pages
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3">
          <Link
            href={`/order/${confirmation.refCode}`}
            className="font-semibold text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-signal"
          >
            Track this order →
          </Link>
          <Link
            href="/demo"
            className="font-semibold text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-signal"
          >
            See what the report looks like
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-ink bg-white p-6 sm:p-8"
      noValidate={false}
    >
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="so-name" className={labelCls}>
            Your name
          </label>
          <input
            id="so-name"
            name="realtorName"
            required
            autoComplete="name"
            placeholder="Jordan Lee"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="so-brokerage" className={labelCls}>
            Brokerage (optional)
          </label>
          <input
            id="so-brokerage"
            name="brokerage"
            autoComplete="organization"
            placeholder="Century 21 Bamber"
            className={inputCls}
          />
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
            Condition removal date (optional)
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
        <div className="sm:col-span-2">
          <label htmlFor="so-files" className={labelCls}>
            The document package (PDFs)
          </label>
          <input
            id="so-files"
            ref={filesRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="w-full border border-dashed border-stone-300 bg-stone-50 px-3.5 py-4 text-sm text-stone-600 file:mr-4 file:border-0 file:bg-ink file:px-4 file:py-2 file:text-white file:font-semibold hover:file:bg-signal"
            onChange={(e) =>
              setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))
            }
          />
          {fileNames.length > 0 && (
            <p className="text-[13px] text-stone-500 mt-2">
              {fileNames.length} file{fileNames.length === 1 ? "" : "s"} attached:{" "}
              {fileNames.join(", ")}
            </p>
          )}
          <p className="text-[13px] text-stone-500 mt-2">
            Reserve fund study, bylaws, minutes, information statements —
            whatever the seller&apos;s side delivered. 4 MB total, up to 12
            files.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 mt-6 text-sm text-stone-600 leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          name="consent"
          value="true"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#111110]"
        />
        <span>
          I&apos;m authorized to share these documents for review. ClearCondo
          reads them to prepare the report; the extracted text is deleted
          after 30 days and the PDFs themselves are never stored.
        </span>
      </label>

      {error && (
        <div className="border border-signal bg-white px-4 py-3 text-sm text-ink mt-6" role="alert">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
        <button
          type="submit"
          disabled={sending}
          className="bg-ink hover:bg-signal disabled:opacity-50 text-white font-semibold px-7 py-3.5 transition-colors"
        >
          {sending ? "Sending…" : "Send the package"}
        </button>
        <span className="micro-label text-stone-400">
          No account · No software to learn
        </span>
      </div>
    </form>
  );
}
