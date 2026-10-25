/**
 * Small animated scenes for the landing pages, in the hero's language:
 * windows that light up, a scan that finds the line that matters.
 *
 * Pure SVG + CSS (see "Landing motion" in globals.css). Each scene starts
 * when its <Reveal> wrapper scrolls into view; reduced motion shows the
 * finished frame. Illustrations only: the figures are the sample report's.
 */

const ACCENT = "#1d4ed8";
const SIGNAL = "#c2410c";

/** Buying: a scan runs down a page and stops on the line that costs money. */
export function ScanDoc({ className = "" }: { className?: string }) {
  const lines = [96, 118, 104, 112, 88, 124, 100, 116, 92];
  const flagged = 5;
  return (
    <svg viewBox="0 0 320 180" className={`block w-full h-auto ${className}`} role="img" aria-label="A document page being scanned; one line is flagged as a special assessment, traced to its page">
      <defs>
        <linearGradient id="mo-scan-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ACCENT} stopOpacity="0" />
          <stop offset="1" stopColor={ACCENT} stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#f5f6f3" stroke="#e3e5e1" />
      <rect x="20" y="16" width="150" height="150" rx="6" fill="#fff" stroke="#e3e5e1" />
      <rect x="34" y="28" width="62" height="7" rx="2" fill="#15181c" opacity="0.85" />
      <rect className="mo-mark" x="29" y={44 + flagged * 12 - 3} width="132" height="11" rx="2" fill="#fdede4" />
      {lines.map((w, i) => (
        <rect
          key={i}
          className={i === flagged ? "mo-tint" : undefined}
          x="34"
          y={44 + i * 12}
          width={w}
          height="5"
          rx="2"
          fill={i === flagged ? SIGNAL : "#cfd3cd"}
        />
      ))}
      <g className="mo-scan">
        <rect x="20" y="0" width="150" height="22" fill="url(#mo-scan-g)" />
        <rect x="20" y="21" width="150" height="1.5" fill={ACCENT} />
      </g>
      <path className="mo-draw mo-d1" pathLength={1} d="M161 106.5H176V74H186" fill="none" stroke={SIGNAL} strokeWidth="1.5" />
      <g className="mo-pop mo-d2">
        <rect x="186" y="52" width="120" height="44" rx="8" fill="#fff" stroke="#f3c5ad" />
        <text x="197" y="68" fontSize="7.5" fontWeight="600" letterSpacing="0.6" fill="#5b6168">SPECIAL ASSESSMENT</text>
        <text x="197" y="87" fontSize="15" fontWeight="700" fill={SIGNAL}>$8,500 / unit</text>
      </g>
      <g className="mo-pop mo-d3">
        <rect x="186" y="104" width="120" height="26" rx="8" fill="#eaf0fd" />
        <path d="M196 117.5l3 3 6-6.5" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <text x="211" y="120.5" fontSize="9" fontWeight="600" fill="#1e3a8a">Page 14 · verified</text>
      </g>
    </svg>
  );
}

/** Owning: a building's windows come on; the City's value against what the evidence says. */
export function TaxDrop({ className = "" }: { className?: string }) {
  const rows = 8;
  const cols = 4;
  const yours = { r: 3, c: 2 };
  // Fixed pattern of windows that stay dark, so every load looks the same.
  const dark = new Set(["0-1", "1-3", "2-0", "4-2", "5-1", "6-3", "7-0", "3-0"]);
  return (
    <svg viewBox="0 0 320 180" className={`block w-full h-auto ${className}`} role="img" aria-label="A condo building with your unit lit; the City's value is taller than what comparable evidence supports, and the gap is your saving">
      <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#ffffff" fillOpacity="0.05" stroke="#ffffff" strokeOpacity="0.12" />
      <rect x="26" y="30" width="80" height="136" rx="2" fill="#222831" stroke="#ffffff" strokeOpacity="0.14" />
      <rect x="40" y="22" width="52" height="8" rx="1" fill="#222831" stroke="#ffffff" strokeOpacity="0.14" />
      {Array.from({ length: rows * cols }, (_, k) => {
        const r = Math.floor(k / cols);
        const c = k % cols;
        const isYours = r === yours.r && c === yours.c;
        const on = !dark.has(`${r}-${c}`);
        return (
          <rect
            key={k}
            className={isYours ? "mo-win mo-yours" : on ? "mo-win" : undefined}
            style={
              isYours
                ? { animationDelay: `${(rows - 1 - r) * 110 + c * 35}ms, 2.6s` }
                : on
                  ? { animationDelay: `${(rows - 1 - r) * 110 + c * 35}ms` }
                  : undefined
            }
            x={35 + c * 17}
            y={40 + r * 15}
            width="11"
            height="8"
            rx="1"
            fill={isYours ? "#8fb0ff" : on ? "#f2c879" : "#2c333d"}
          />
        );
      })}
      <line x1="14" y1="166.5" x2="120" y2="166.5" stroke="#ffffff" strokeOpacity="0.18" />

      <rect className="mo-grow mo-d0" x="136" y="40" width="44" height="110" rx="3" fill="#ffffff" fillOpacity="0.82" />
      <rect className="mo-grow mo-d1" x="198" y="66" width="44" height="84" rx="3" fill="#8fb0ff" />
      <rect className="mo-fade mo-d2" x="198.5" y="40.5" width="43" height="24" rx="3" fill="#8fb0ff" fillOpacity="0.12" stroke="#8fb0ff" strokeDasharray="3 3" />
      <g className="mo-pop mo-d3">
        <path d="M242 52.5h10" stroke="#8fb0ff" strokeWidth="1.5" />
        <rect x="252" y="42" width="56" height="21" rx="6" fill="#8fb0ff" />
        <text x="280" y="56" fontSize="10" fontWeight="700" textAnchor="middle" fill="#15181c">Saving</text>
      </g>
      <line x1="128" y1="150.5" x2="250" y2="150.5" stroke="#ffffff" strokeOpacity="0.18" />
      <text x="158" y="164" fontSize="8.5" textAnchor="middle" fill="#ffffff" fillOpacity="0.62">City&apos;s value</text>
      <text x="220" y="164" fontSize="8.5" textAnchor="middle" fill="#ffffff" fillOpacity="0.62">Evidence</text>
    </svg>
  );
}

/** The condo icon in "Where this goes", drawn in with its lights on. */
export function RoadmapIcon({ kind, live = false }: { kind: "condo"; live?: boolean }) {
  const stroke = live ? "#15181c" : "#8a9099";
  const paths = {
    condo: ["M11 37V7h18v30", "M6 37h28"],
  }[kind];
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden className="flex-none">
      {paths.map((d, i) => (
        <path
          key={d}
          className="mo-draw"
          style={{ animationDelay: `${150 + i * 160}ms` }}
          pathLength={1}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {kind === "condo" &&
        [0, 1, 2, 3].flatMap((r) =>
          [0, 1].map((c) => (
            <rect
              key={`${r}-${c}`}
              className={live ? "mo-win mo-twinkle-soft" : "mo-fade"}
              style={{ animationDelay: live ? `${600 + (3 - r) * 120 + c * 60}ms, 1.6s` : `${600 + (3 - r) * 120 + c * 60}ms` }}
              x={15 + c * 7}
              y={12 + r * 6}
              width="3.5"
              height="3"
              rx="0.5"
              fill={live ? ACCENT : "#b8bec6"}
            />
          ))
        )}
    </svg>
  );
}

/** Deterministic PRNG so the skyline renders the same on server and every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type SkyWin = { x: number; y: number; dur: number; delay: number };

function buildSkyline() {
  const rand = rng(11);
  const towers: { x: number; w: number; top: number }[] = [];
  const wins: SkyWin[] = [];
  let x = -10;
  while (x < 1210) {
    const w = 34 + rand() * 62;
    const top = 18 + rand() * 54;
    towers.push({ x, w, top });
    for (let wy = top + 7; wy < 86; wy += 9) {
      for (let wx = x + 6; wx < x + w - 6; wx += 8) {
        if (rand() < 0.16) wins.push({ x: wx, y: wy, dur: 3 + rand() * 5, delay: -rand() * 8 });
      }
    }
    x += w + 2 + rand() * 10;
  }
  return { towers, wins };
}

/** A dusk skyline along the bottom of a dark section; a few windows come and go. */
export function Skyline({ className = "" }: { className?: string }) {
  const { towers, wins } = buildSkyline();
  return (
    <svg viewBox="0 0 1200 90" preserveAspectRatio="xMidYMax slice" className={`block w-full h-[72px] sm:h-[90px] ${className}`} aria-hidden>
      {towers.map((t, i) => (
        <rect key={i} x={t.x} y={t.top} width={t.w} height={90 - t.top} fill="#1f242b" />
      ))}
      {wins.map((w, i) => (
        <rect
          key={i}
          className="mo-twinkle"
          style={{ animationDuration: `${w.dur.toFixed(2)}s`, animationDelay: `${w.delay.toFixed(2)}s` }}
          x={w.x}
          y={w.y}
          width="3"
          height="4"
          fill="#f2c879"
        />
      ))}
    </svg>
  );
}
