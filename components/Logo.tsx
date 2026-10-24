/**
 * The ClearCondo CC monogram: two nested Cs that read as a lens, with a
 * focal dot. Ink outer C, accent inner C. `animate` draws it in on load.
 * Below ~24px the dot is dropped and strokes thicken so it stays legible.
 * The ink takes the surrounding text colour, and the accent reads
 * --logo-accent, so the mark works on dark backgrounds (the landing hero)
 * without a separate variant.
 */
export function LogoMark({
  size = 28,
  animate = false,
  inverse = false,
  className = "",
}: {
  size?: number;
  animate?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  const ink = inverse ? "#ffffff" : "currentColor";
  const accent = inverse ? "#7aa2ff" : "var(--logo-accent, #1d4ed8)";
  const small = size < 24;
  const stroke = small ? 5.4 : 4.4;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      className={`${animate ? "logo-draw" : ""} ${className}`}
    >
      <path
        className="arc-o"
        d="M35.3 12.7A16 16 0 1 0 35.3 35.3"
        fill="none"
        stroke={ink}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        className="arc-i"
        d="M30.4 17.6A9 9 0 1 0 30.4 30.4"
        fill="none"
        style={{ stroke: accent }}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {!small && <circle className="dot" cx="24" cy="24" r="2.6" fill={ink} />}
    </svg>
  );
}

export default function Logo({
  size = 28,
  animate = false,
  inverse = false,
}: {
  size?: number;
  animate?: boolean;
  inverse?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} animate={animate} inverse={inverse} />
      <span
        className={`font-semibold tracking-[-0.03em] ${inverse ? "text-white" : ""}`}
        style={{ fontSize: Math.round(size * 0.66) }}
      >
        ClearCondo
      </span>
    </span>
  );
}
