"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReportView, { type ReportVM } from "./ReportView";
import type { VerifiedAnalysis } from "@/lib/report-schema";
import { DOC_CHECKLIST } from "@/lib/doc-checklist";
import { guessChecklist } from "@/lib/doc-hints";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 12;

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
  { id: "extracting", label: "Reading your PDFs", hint: "Extracting the text of every page…" },
  { id: "analyzing", label: "Finding and verifying red flags", hint: "Reading the package for assessments, reserves, litigation and more, then checking every quote against its page. Usually a few minutes; large scanned packages take longer." },
];

export default function UploadForm({
  stripeEnabled,
  credits,
  initialBuildingName = "",
}: {
  stripeEnabled: boolean;
  credits: number | null;
  /** Pre-filled from /app/new?building=… (the Calgary lookup's "add documents"). */
  initialBuildingName?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [buildingName, setBuildingName] = useState(initialBuildingName);
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
      return [...prev, ...pdfs.filter((f) => !names.has(f.name))].slice(0, MAX_FILES);
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

  const busy = stage === "extracting" || stage === "analyzing";
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  const tooBig = totalBytes > MAX_BYTES;
  // Before the server has read anything, guess coverage from file names;
  // once extraction returns, its missing-documents list is authoritative.
  const serverChecked = fileStatuses.length > 0;
  const checklist = serverChecked
    ? DOC_CHECKLIST.map((item) => ({ ...item, have: !missing.some((m) => m.id === item.id) }))
    : guessChecklist(files.map((f) => f.name));
  const coveredCount = checklist.filter((c) => c.have).length;
  const blocker =
    files.length === 0
      ? "Add at least one PDF to start."
      : tooBig
        ? "The package is over 4 MB — remove a file to continue."
        : !consent
          ? "Tick the consent box to start."
          : null;

  if (stage === "done" && ephemeral) {
    return (
      <div>
        <button
          onClick={() => {
            setStage("idle");
            setEphemeral(null);
            setFiles([]);
          }}
          className="text-[15px] text-muted hover:text-ink mb-6 inline-flex items-center min-h-11"
        >
          ← Analyze another building
        </button>
        <ReportView report={ephemeral} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <h1 className="rise-in font-bold text-3xl sm:text-4xl tracking-[-0.025em]">New analysis</h1>
          <p className="rise-in text-muted text-[17px] leading-relaxed mt-2" style={{ animationDelay: "80ms" }}>
            Upload the condo&apos;s document package. We read every page, check
            each claim against the page it cites, and add what we verify to
            the building&apos;s record.
          </p>
        </div>
        {stripeEnabled && credits !== null && (
          <span className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-muted tabular-nums">
            <strong className="text-ink">{credits}</strong> report credit{credits === 1 ? "" : "s"} left
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-8 items-start">
        <div className="flex-[999_1_560px] min-w-0 space-y-4">
          {busy ? (
            <section className="rise-in report-paper rounded-2xl p-6 sm:p-8" role="status" aria-live="polite">
              <h2 className="text-lg font-bold">Working on {files.length} document{files.length === 1 ? "" : "s"}</h2>
              <p className="text-sm text-subtle mt-1">You can keep this tab open — it moves to the report when it&apos;s done.</p>
              <ol className="mt-6 space-y-5">
                {STAGES.map((s, i) => {
                  const active = stage === s.id;
                  const done = stage === "analyzing" && s.id === "extracting";
                  return (
                    <li key={s.id} className="flex gap-3.5">
                      <span
                        className={`mt-0.5 w-6 h-6 rounded-full flex-none inline-flex items-center justify-center text-xs font-semibold ${
                          done
                            ? "bg-accent text-white"
                            : active
                              ? "border-2 border-accent border-t-transparent animate-spin"
                              : "border border-line2 text-subtle"
                        }`}
                        aria-hidden
                      >
                        {done ? (
                          <svg width="12" height="12" viewBox="0 0 14 14">
                            <path d="M3 7.3l2.4 2.4L11 4.2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                          </svg>
                        ) : active ? null : (
                          i + 1
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold ${active || done ? "text-ink" : "text-subtle"}`}>
                          {s.label}
                          {done && <span className="sr-only"> (done)</span>}
                        </div>
                        {active && <div className="text-sm text-subtle mt-0.5">{s.hint}</div>}
                        {s.id === "extracting" && fileStatuses.length > 0 && (
                          <ul className="mt-3 flex flex-col gap-1.5">
                            {fileStatuses.map((f) => (
                              <li key={f.filename} className="open-in flex items-center justify-between gap-3 text-sm">
                                <span className="truncate text-ink2">{f.filename}</span>
                                <span
                                  className={`flex-none rounded-md px-2 py-0.5 text-xs font-semibold ${
                                    f.status === "ocr" ? "bg-warn-soft text-warn-dark" : "bg-accent-soft text-accent-dark"
                                  }`}
                                >
                                  {f.status === "ocr" ? "Read via OCR" : "Text extracted"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="loadbar mt-7" aria-hidden />
            </section>
          ) : (
            <section className="report-paper rounded-2xl p-6 sm:p-8">
              <label htmlFor="na-building" className="block text-sm font-semibold mb-1.5">
                Building name <span className="font-normal text-subtle">(optional — we also read it from the documents)</span>
              </label>
              <input
                id="na-building"
                type="text"
                value={buildingName}
                onChange={(e) => {
                  setBuildingName(e.target.value);
                  // A changed name invalidates any previously picked building.
                  setBuildingId(null);
                }}
                placeholder="e.g. North Hill Terrace"
                autoComplete="off"
                className="w-full rounded-lg border border-line2 bg-white px-3.5 min-h-[46px] text-[15px] text-ink placeholder:text-subtle focus:outline-2 focus:outline-accent focus:outline-offset-1 focus:border-accent"
              />

              {candidates.length > 0 && (
                <fieldset className="open-in mt-4 rounded-xl border border-line bg-surface2 p-4">
                  <legend className="px-1 text-sm font-semibold">Is this a building you&apos;ve reviewed before?</legend>
                  <p className="text-[13px] text-subtle mb-3">
                    Matching keeps its record growing: the new report is checked against what we already verified.
                  </p>
                  <div className="flex flex-col gap-2">
                    {[{ id: null, name: "A new building", meta: "Start a fresh record" }, ...candidates.map((c) => ({
                      id: c.id,
                      name: c.name,
                      meta: `${c.corp_number ? `Corp No. ${c.corp_number} · ` : ""}${c.report_count} report${c.report_count === 1 ? "" : "s"} on record`,
                    }))].map((opt) => {
                      const picked = buildingId === opt.id;
                      return (
                        <label
                          key={opt.id ?? "new"}
                          className={`flex items-center gap-3 rounded-lg border bg-white px-3.5 py-2.5 cursor-pointer transition-colors ${
                            picked ? "border-accent ring-1 ring-accent" : "border-line hover:border-line2"
                          }`}
                        >
                          <input
                            type="radio"
                            name="building"
                            checked={picked}
                            onChange={() => setBuildingId(opt.id)}
                            className="w-4 h-4 accent-[#1d4ed8]"
                          />
                          <span className="min-w-0">
                            <span className="block text-[15px] font-medium truncate">{opt.name}</span>
                            <span className="block text-[13px] text-subtle">{opt.meta}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="mt-7 text-sm font-semibold mb-2">The documents</div>
              <label
                htmlFor="na-files"
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
                className={`flex flex-col items-center justify-center text-center gap-2.5 rounded-xl border-[1.5px] border-dashed px-6 py-9 cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2 ${
                  dragOver ? "border-accent bg-accent-soft" : "border-info bg-surface2 hover:border-accent"
                }`}
              >
                <span className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 22 22" aria-hidden>
                    <path d="M11 15V4M6.5 8.5L11 4l4.5 4.5M4 15v3h14v-3" stroke="#1d4ed8" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="font-semibold">
                  <span className="hidden sm:inline">
                    Drop PDFs here or <span className="text-accent underline">browse</span>
                  </span>
                  <span className="sm:hidden text-accent underline">Choose PDFs</span>
                </span>
                <span className="text-sm text-subtle">
                  Reserve fund study, bylaws, minutes, information statements · up to {MAX_FILES} files, 4 MB in total
                </span>
                <input
                  id="na-files"
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  aria-label="The document package (PDFs)"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>

              {files.length > 0 && (
                <>
                  <ul className="mt-4 flex flex-col gap-2">
                    {files.map((f) => (
                      <li key={f.name} className="open-in flex items-center gap-3 rounded-[10px] border border-line pl-3.5 pr-1 py-1">
                        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="flex-none">
                          <path d="M5 2h7l4 4v12H5z" stroke="#4a5058" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{f.name}</div>
                          <div className="text-[13px] text-subtle tabular-nums">{kb(f.size)}</div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => setFiles((prev) => prev.filter((x) => x.name !== f.name))}
                          className="w-11 h-11 rounded-lg inline-flex items-center justify-center text-muted hover:bg-surface hover:text-ink"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-[#eceee9] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${tooBig ? "bg-signal" : "bg-accent"}`}
                        style={{ width: `${Math.min(100, (totalBytes / MAX_BYTES) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-[13px] tabular-nums whitespace-nowrap ${tooBig ? "text-signal-dark font-semibold" : "text-subtle"}`}>
                      {files.length} file{files.length === 1 ? "" : "s"} · {kb(totalBytes)} of 4 MB
                    </span>
                  </div>
                </>
              )}

              <label className="mt-7 flex items-start gap-3 cursor-pointer text-sm text-muted leading-relaxed">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-5 h-5 flex-none accent-[#1d4ed8]"
                />
                <span>
                  I consent to these documents being processed to generate my
                  report, and confirm I have the right to upload them. PDFs are
                  read in memory and never stored as files; extracted text
                  auto-deletes after 30 days. Verified facts (figures and
                  dates, never the documents or who uploaded them) are added
                  to this building&apos;s shared record, so the next buyer sees
                  its history.{" "}
                  <Link href="/privacy" className="text-ink underline underline-offset-2">
                    Privacy note
                  </Link>
                </span>
              </label>

              <div className="mt-6 pt-6 border-t border-[#eceee9] flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={run}
                  disabled={!!blocker}
                  className="btn-lift inline-flex items-center gap-2.5 rounded-[10px] bg-accent hover:bg-accent-dark disabled:bg-line disabled:text-subtle disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed text-white font-semibold px-6 min-h-12"
                >
                  {`Analyze ${files.length > 0 ? `${files.length} document${files.length === 1 ? "" : "s"}` : "documents"}`}
                </button>
                {blocker && <span className="text-sm text-subtle">{blocker}</span>}
              </div>
            </section>
          )}

          {truncatedDocs.length > 0 && (
            <Notice tone="warn" title="Some documents were too long to read fully">
              {truncatedDocs.map((t) => (
                <li key={t.filename}>
                  {t.filename} — analyzed the first 40 of {t.totalPages} pages. Content past that point was not reviewed.
                </li>
              ))}
            </Notice>
          )}
          {warnings.length > 0 && !busy && (
            <Notice tone="warn" title="Some files couldn't be read">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </Notice>
          )}

          {stage === "error" && error && (
            <section className="open-in rounded-[14px] border border-signal/40 bg-signal-soft p-5" role="alert">
              {error.code === "no_api_key" ? (
                <>
                  <h3 className="font-semibold">AI analysis isn&apos;t configured</h3>
                  <p className="text-sm text-ink2 mt-1 mb-3">
                    This deployment needs an <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> to analyze
                    documents. The sample report still works without one.
                  </p>
                  <Link href="/demo" className="text-sm font-semibold text-accent hover:text-accent-dark">
                    View the sample report →
                  </Link>
                </>
              ) : error.code === "payment_required" && error.checkoutUrl ? (
                <>
                  <h3 className="font-semibold">You&apos;re out of report credits</h3>
                  <p className="text-sm text-ink2 mt-1 mb-3">{error.error}</p>
                  <a
                    href={error.checkoutUrl}
                    className="btn-lift inline-flex items-center rounded-lg bg-ink hover:bg-accent text-white font-semibold text-sm px-4 min-h-11"
                  >
                    Buy a report credit
                  </a>
                </>
              ) : (
                <>
                  <h3 className="font-semibold">
                    {error.code === "timeout" ? "The analysis timed out" : "Something went wrong"}
                  </h3>
                  <p className="text-sm text-ink2 mt-1">{error.error}</p>
                  {/* Files, building and consent are all still set: rerun as is. */}
                  <button
                    type="button"
                    onClick={run}
                    className="mt-3 inline-flex items-center rounded-lg border border-line2 bg-white hover:border-ink font-semibold text-sm px-4 min-h-11 transition-colors"
                  >
                    Try again
                  </button>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="flex-[1_1_300px] space-y-4" aria-label="Package checklist">
          <section className="report-paper rounded-2xl p-6">
            <h2 className="text-lg font-bold">Package checklist</h2>
            <p className="text-sm text-subtle mt-1 mb-4">
              A complete Alberta resale package. More documents, fewer blind spots.
            </p>
            <div
              className="h-2 rounded-full bg-[#eceee9] overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={checklist.length}
              aria-valuenow={coveredCount}
              aria-label="Checklist documents covered"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${(coveredCount / checklist.length) * 100}%` }}
              />
            </div>
            <div className="text-[13px] text-muted mt-2 mb-4 tabular-nums">
              {coveredCount} of {checklist.length} {serverChecked ? "found in your package" : "look attached"}
            </div>
            <ul className="flex flex-col gap-3 text-[15px]">
              {checklist.map((c) => {
                const ask = serverChecked && !c.have;
                return (
                  <li key={c.id} className={`flex gap-2.5 items-start ${c.have ? "" : "text-muted"}`}>
                    {c.have ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="pop-in flex-none mt-0.5" style={{ animationDelay: "0s" }}>
                        <circle cx="10" cy="10" r="9" fill="#1d4ed8" />
                        <path d="M6 10.2l2.6 2.6L14 7.4" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                      </svg>
                    ) : ask ? (
                      <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden className="flex-none mt-0.5">
                        <circle cx="9" cy="9" r="7.5" stroke="#9a3412" strokeWidth="1.5" fill="none" />
                        <path d="M9 5.5v4M9 12.2v.3" stroke="#9a3412" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="flex-none mt-0.5">
                        <circle cx="10" cy="10" r="8.3" stroke="#b8bec6" strokeWidth="1.4" fill="none" />
                      </svg>
                    )}
                    <span>
                      <span className={c.have ? "font-semibold text-ink" : ask ? "font-semibold text-ink" : ""}>{c.label}</span>
                      <span className="sr-only">{c.have ? " (included)" : " (not included)"}</span>
                      {ask && <span className="block text-[13px] text-subtle mt-0.5">{c.askFor}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[13px] text-subtle mt-5">
              {serverChecked
                ? "From the documents we read. Missing items don't block the report — it covers what you uploaded."
                : "Matched by file name until we read the documents. Missing something? Send what you have — the report lists what to ask for."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function kb(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Notice({ tone, title, children }: { tone: "warn"; title: string; children: React.ReactNode }) {
  return (
    <section className={`open-in rounded-[14px] border p-5 ${tone === "warn" ? "border-warn/50 bg-warn-soft" : ""}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-ink2">{children}</ul>
    </section>
  );
}
