"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReportView, { type ReportVM } from "./ReportView";
import type { VerifiedAnalysis } from "@/lib/report-schema";

interface BuildingCandidate {
  id: string;
  name: string;
  corp_number: string | null;
  address: string | null;
  report_count: number;
}

type Stage = "idle" | "extracting" | "analyzing" | "done" | "error";

interface ApiError {
  code?: string;
  error: string;
  checkoutUrl?: string;
}

interface StartResponse {
  docs?: {
    filename: string;
    status: string;
    truncated?: boolean;
    totalPages?: number;
    pageCount?: number;
  }[];
  failures?: string[];
  missing?: { id: string; label: string; askFor: string }[];
  buildingNameHint?: string;
}

interface RunResponse {
  reportId?: string;
  analysis?: unknown;
  missing?: { id: string; label: string; askFor: string }[];
}

/** Read a JSON body that may not be JSON (e.g. a platform 504 page). */
async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Map an HTTP response to an ApiError. A platform timeout (Vercel kills the
 * function at maxDuration) comes back as a non-JSON 504 — that must surface
 * as a clear "timed out, try again", never a stuck spinner or blank screen.
 */
function toApiError(res: Response, json: unknown, fallback: string): ApiError {
  if (json && typeof json === "object" && "error" in json) {
    const j = json as { error: unknown; code?: unknown; checkoutUrl?: unknown };
    if (typeof j.error === "string") {
      return {
        error: j.error,
        code: typeof j.code === "string" ? j.code : undefined,
        checkoutUrl:
          typeof j.checkoutUrl === "string" ? j.checkoutUrl : undefined,
      };
    }
  }
  if (res.status === 504 || res.status === 408) {
    return {
      code: "timeout",
      error:
        "The request timed out — your files are fine. Please try again with fewer or smaller files.",
    };
  }
  if (res.status === 413) {
    return {
      error: "The upload was too large. Please try fewer or smaller files.",
    };
  }
  return { error: `${fallback} (HTTP ${res.status}). Please try again.` };
}

const STAGES: { id: Exclude<Stage, "idle" | "done" | "error">; label: string; hint: string }[] = [
  { id: "extracting", label: "Reading your PDFs", hint: "Extracting text from each document…" },
  { id: "analyzing", label: "Analyzing with AI", hint: "Cross-referencing the stack for red flags. Usually a few minutes; large scanned stacks can take longer." },
];

export default function UploadForm({
  stripeEnabled,
  credits,
}: {
  stripeEnabled: boolean;
  credits: number | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [buildingName, setBuildingName] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [ephemeral, setEphemeral] = useState<ReportVM | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<
    { filename: string; status: string }[]
  >([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [truncatedDocs, setTruncatedDocs] = useState<
    { filename: string; totalPages: number }[]
  >([]);
  const [candidates, setCandidates] = useState<BuildingCandidate[]>([]);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [missing, setMissing] = useState<
    { id: string; label: string; askFor: string }[]
  >([]);

  // Confirm/merge: look up existing buildings as the user types a name.
  useEffect(() => {
    const hint = buildingName.trim();
    if (hint.length < 2) {
      // Deferred: the effect must not call setState synchronously.
      const t = setTimeout(() => setCandidates([]), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/buildings/match?hint=${encodeURIComponent(hint)}`
        );
        const json = await res.json();
        setCandidates(json.buildings ?? []);
      } catch {
        setCandidates([]);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [buildingName]);

  const addFiles = (list: FileList | File[]) => {
    const pdfs = Array.from(list).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !names.has(f.name))].slice(0, 12);
    });
  };

  const shortId = (rid: string) => {
    const parts = rid.split(":");
    return encodeURIComponent(parts.length > 1 ? parts[1] : rid);
  };

  async function run() {
    if (files.length === 0 || !consent) return;
    setStage("extracting");
    setError(null);
    setEphemeral(null);
    setFileStatuses([]);
    setWarnings([]);
    setTruncatedDocs([]);
    setMissing([]);
    try {
      // Step 1: extract text from the PDFs.
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("buildingName", buildingName);
      form.append("consent", "true");
      const startRes = await fetch("/api/analyze/start", {
        method: "POST",
        body: form,
      });
      const startJson = (await readJsonSafe(startRes)) as StartResponse | null;
      if (!startRes.ok || !startJson)
        throw toApiError(startRes, startJson, "Extraction failed");

      setFileStatuses(
        (startJson.docs ?? []).map((d) => ({
          filename: d.filename,
          status: d.status,
        }))
      );
      setWarnings(startJson.failures ?? []);
      setTruncatedDocs(
        (startJson.docs ?? [])
          .filter((d) => d.truncated)
          .map((d) => ({
            filename: d.filename,
            totalPages: d.totalPages ?? d.pageCount ?? 0,
          }))
      );
      setMissing(startJson.missing ?? []);

      // Step 2: run the AI analysis over the extracted text.
      setStage("analyzing");
      const runRes = await fetch("/api/analyze/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docs: startJson.docs,
          buildingNameHint: startJson.buildingNameHint,
          buildingId,
          missing: startJson.missing ?? [],
          consent,
        }),
      });
      const runJson = (await readJsonSafe(runRes)) as RunResponse | null;
      if (!runRes.ok || !runJson)
        throw toApiError(runRes, runJson, "Analysis failed");

      if (runJson.reportId) {
        router.push(`/app/reports/${shortId(runJson.reportId)}`);
        return;
      }
      // No database configured: render the report ephemerally.
      const analysis = runJson.analysis as VerifiedAnalysis;
      setEphemeral({
        buildingName: analysis.building.name || buildingName || "Unnamed building",
        buildingMeta: "Rendered without saving — connect SurrealDB to keep building memory.",
        analysis,
        missing: runJson.missing ?? [],
      });
      setStage("done");
    } catch (e) {
      setError(
        typeof e === "object" && e !== null && "error" in e
          ? (e as ApiError)
          : { error: "Something went wrong. Please try again." }
      );
      setStage("error");
    }
  }

  if (stage === "done" && ephemeral) {
    return (
      <div>
        <button
          onClick={() => {
            setStage("idle");
            setEphemeral(null);
            setFiles([]);
          }}
          className="micro-label text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-signal mb-6 inline-block"
        >
          ← Analyze another building
        </button>
        <ReportView report={ephemeral} />
      </div>
    );
  }

  const busy = stage === "extracting" || stage === "analyzing";

  return (
    <div className="max-w-2xl">
      <h1 className="font-bold text-4xl tracking-[-0.02em] text-ink mb-3">
        New analysis
      </h1>
      <p className="text-stone-600 mb-7 leading-relaxed">
        Upload the condo&apos;s document stack as PDFs. We&apos;ll read every
        page and produce a red-flag report.
        {stripeEnabled && credits !== null && (
          <span className="block mt-1 text-sm">
            Report credits remaining: <strong>{credits}</strong>
          </span>
        )}
      </p>

      <label className="micro-label block text-stone-600 mb-2">
        Building name <span className="normal-case tracking-normal font-sans text-[13px] text-stone-400">(optional — we&apos;ll also read it from the documents)</span>
      </label>
      <input
        type="text"
        value={buildingName}
        onChange={(e) => {
          setBuildingName(e.target.value);
          // A changed name invalidates any previously picked building.
          setBuildingId(null);
        }}
        placeholder="e.g. North Hill Terrace"
        disabled={busy}
        className="w-full border border-stone-300 bg-white px-4 py-3 mb-2 text-ink placeholder:text-stone-400 focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
      />

      {candidates.length > 0 && !busy && (
        <div className="mb-6 report-paper p-5">
          <div className="text-sm font-bold text-ink mb-2">
            Is this one of your existing buildings?
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 py-1 cursor-pointer">
            <input
              type="radio"
              name="building"
              checked={buildingId === null}
              onChange={() => setBuildingId(null)}
              className="accent-signal"
            />
            New building
          </label>
          {candidates.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 text-sm text-stone-700 py-1 cursor-pointer"
            >
              <input
                type="radio"
                name="building"
                checked={buildingId === c.id}
                onChange={() => setBuildingId(c.id)}
                className="accent-signal"
              />
              <span className="font-medium">{c.name}</span>
              <span className="text-stone-500">
                {c.corp_number ? `Corp ${c.corp_number} · ` : ""}
                {c.report_count} report{c.report_count === 1 ? "" : "s"}
              </span>
            </label>
          ))}
          <p className="text-xs text-stone-500 mt-2">
            Matching to an existing building keeps its memory growing — new
            reports are diffed against the last review.
          </p>
        </div>
      )}

      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label="Upload condo documents as PDFs"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          // Keyboard users can't use drag & drop: Enter/Space opens the picker.
          if (!busy && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed p-10 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
          dragOver
            ? "border-signal bg-red-50/50"
            : "border-stone-300 bg-white hover:border-ink"
        } ${busy ? "opacity-60 pointer-events-none" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <div className="font-bold text-lg text-ink mb-1.5">
          Drag &amp; drop PDFs here, or click to browse
        </div>
        <div className="text-sm text-stone-500">
          Drag &amp; drop here, or click to browse — reserve fund study, bylaws, minutes, information statements — up to 12 files, 4&nbsp;MB total
        </div>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between border border-stone-200 bg-white px-4 py-2.5 text-sm"
            >
              <span className="text-ink truncate">{f.name}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs text-stone-400">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                {!busy && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((prev) => prev.filter((x) => x.name !== f.name));
                    }}
                    className="text-stone-400 hover:text-red-700 font-medium"
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Per-file extraction status + warnings */}
      {(busy || warnings.length > 0) && fileStatuses.length > 0 && (
        <div className="mt-6 report-paper p-5">
          <div className="micro-label text-stone-500 mb-3">
            Documents
          </div>
          <ul className="space-y-1.5">
            {fileStatuses.map((f) => (
              <li key={f.filename} className="flex items-center justify-between text-sm">
                <span className="text-stone-700 truncate mr-3">{f.filename}</span>
                <span
                  className={`micro-label flex-none px-2 py-1 ${
                    f.status === "ocr"
                      ? "border border-stone-300 text-stone-500"
                      : "bg-ink text-white"
                  }`}
                >
                  {f.status === "ocr" ? "Read via OCR" : "Extracted"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {truncatedDocs.length > 0 && (
        <div className="mt-4 border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-900 mb-2">
            Some documents were too long to read fully
          </div>
          <ul className="space-y-1">
            {truncatedDocs.map((t) => (
              <li key={t.filename} className="text-sm text-amber-800">
                {t.filename} — analyzed the first 40 of {t.totalPages} pages.
                Content past that point was not reviewed.
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && !busy && (
        <div className="mt-4 border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-900 mb-2">
            Some files couldn&apos;t be read
          </div>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-800">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing documents */}
      {missing.length > 0 && (
        <div className="mt-4 report-paper p-5">
          <div className="text-sm font-bold text-ink mb-1">
            Not in your package — ask for it
          </div>
          <p className="text-xs text-stone-500 mb-3">
            A complete Alberta resale package usually includes these. The
            report covers what you uploaded; these gaps are worth closing.
          </p>
          <ul className="space-y-2">
            {missing.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-medium text-stone-800">{m.label}</span>
                <span className="text-stone-500"> — {m.askFor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress */}
      {busy && (
        <div className="mt-6 border border-stone-300 bg-white p-6" role="status">
          <div>
            {STAGES.map((s) => {
              const active = stage === s.id;
              const doneStage =
                (stage === "analyzing" && s.id === "extracting");
              return (
                <div key={s.id} className="flex gap-3 mb-4 last:mb-0">
                  <div
                    className={`mt-1 w-5 h-5 rounded-full flex-none ${
                      doneStage
                        ? "bg-signal"
                        : active
                          ? "border-2 border-signal border-t-transparent animate-spin"
                          : "border-2 border-stone-300"
                    }`}
                  />
                  <div className="flex-1">
                    <div
                      className={`font-semibold ${active || doneStage ? "text-ink" : "text-stone-400"}`}
                    >
                      {s.label}
                    </div>
                    {active && <div className="text-sm text-stone-500 mt-0.5">{s.hint}</div>}
                  </div>
                </div>
              );
            })}
            <div className="loadbar mt-5" />
          </div>
        </div>
      )}

      {/* Errors */}
      {stage === "error" && error && (
        <div className="mt-6 border border-red-200 bg-red-50 p-5">
          {error.code === "no_api_key" ? (
            <>
              <h3 className="font-semibold text-red-900 mb-1">
                AI analysis isn&apos;t configured
              </h3>
              <p className="text-sm text-red-800 mb-3">
                This deployment needs an <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> to
                analyze documents. The sample report still works without one.
              </p>
              <Link
                href="/demo"
                className="text-sm font-semibold text-red-900 underline"
              >
                View the sample report →
              </Link>
            </>
          ) : error.code === "payment_required" && error.checkoutUrl ? (
            <>
              <h3 className="font-semibold text-red-900 mb-1">
                You&apos;re out of report credits
              </h3>
              <p className="text-sm text-red-800 mb-3">{error.error}</p>
              <a
                href={error.checkoutUrl}
                className="inline-block bg-ink text-white hover:bg-signal px-5 py-2.5 font-semibold text-sm transition-colors"
              >
                Buy a report credit
              </a>
            </>
          ) : error.code === "timeout" ? (
            <>
              <h3 className="font-semibold text-red-900 mb-1">
                The analysis timed out
              </h3>
              <p className="text-sm text-red-800">{error.error}</p>
              <button
                onClick={() => {
                  setStage("idle");
                  setError(null);
                }}
                className="mt-3 text-sm font-semibold text-red-900 underline"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-red-900 mb-1">
                Something went wrong
              </h3>
              <p className="text-sm text-red-800">{error.error}</p>
              <button
                onClick={() => {
                  setStage("idle");
                  setError(null);
                }}
                className="mt-3 text-sm font-semibold text-red-900 underline"
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}

      <label className="mt-6 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy}
          className="mt-1 w-4 h-4 flex-none accent-signal"
        />
        <span className="text-sm text-stone-600">
          I confirm I have the right to upload these documents and I
          understand they will be processed to generate my report and stored
          per the retention policy.{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 text-stone-800"
          >
            Privacy note
          </Link>
        </span>
      </label>
      <p className="text-xs text-stone-500 mt-2">
        PDFs are read in memory and never stored as files. Extracted text and
        document details auto-delete after 30 days; your report stays until
        you delete it.
      </p>

      <button
        onClick={run}
        disabled={busy || files.length === 0 || !consent}
        className="mt-5 w-full bg-ink text-white hover:bg-signal disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed px-6 py-4 font-semibold text-base transition-colors"
      >
        {stage === "extracting"
          ? "Reading PDFs…"
          : stage === "analyzing"
            ? "Analyzing…"
            : `Analyze ${files.length > 0 ? `${files.length} document${files.length === 1 ? "" : "s"}` : "documents"}`}
      </button>
    </div>
  );
}
