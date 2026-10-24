"use client";

import { useEffect, useRef, useState } from "react";
import SeverityBadge from "./SeverityBadge";

/**
 * The landing hero's backdrop: a condo tower at dusk, drawn on a canvas.
 * A scan climbs the tower and its windows come on as it passes; then one
 * window turns orange and a leader line ties it to a floating flag card —
 * the product in one image. Background towers drift with the pointer.
 *
 * Everything is procedural (no photo assets). Reduced motion renders the
 * finished frame once; the loop pauses when the hero is off screen.
 */

type Win = { x: number; y: number; w: number; h: number; lit: boolean; warm: boolean; seed: number };
type Tower = { x: number; w: number; top: number; depth: number; wins: { x: number; y: number; on: boolean }[] };

const SCAN_START = 500;
const SCAN_MS = 2300;
const FLAG_AT = SCAN_START + SCAN_MS + 200;

/** Deterministic PRNG so the skyline is the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** `flagCard`: play the buyer story (a window gets flagged, a red-flag card appears). Off on the generic landing. */
export default function HeroScene({ flagCard = true }: { flagCard?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardOn, setCardOn] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let towers: Tower[] = [];
    let wins: Win[] = [];
    let sideWins: Win[] = [];
    let tower = { x: 0, w: 0, top: 0, side: 0, skew: 0 };
    let flag: Win | null = null;
    let grain: CanvasPattern | null = null;
    let rowYs: number[] = [];
    let bokeh: { x: number; y: number; r: number; a: number; s: number }[] = [];
    let narrow = false;
    let raf = 0;
    let visible = true;
    let start = performance.now();
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let cardShown = false;

    function build() {
      const r = wrap.getBoundingClientRect();
      W = r.width;
      H = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;

      const rand = rng(7);
      narrow = W < 768;

      // Background skyline, two depths.
      towers = [];
      for (let depth = 0; depth < 2; depth++) {
        let x = -40;
        while (x < W + 40) {
          const w = (narrow ? 40 : 60) + rand() * (narrow ? 70 : 110);
          const top = H * (depth === 0 ? 0.38 : 0.5) + rand() * H * 0.22;
          const tw: Tower = { x, w, top, depth, wins: [] };
          for (let wy = top + 10; wy < H; wy += 11) {
            for (let wx = x + 6; wx < x + w - 6; wx += 9) {
              if (rand() < (depth === 0 ? 0.08 : 0.14)) tw.wins.push({ x: wx, y: wy, on: rand() < 0.75 });
            }
          }
          towers.push(tw);
          x += w + rand() * 18;
        }
      }

      // The hero tower.
      const tw = narrow ? W * 0.5 : Math.min(W * 0.24, 400);
      tower = {
        x: narrow ? W * 0.46 : W * 0.56,
        w: tw,
        top: H * (narrow ? 0.12 : 0.1),
        side: tw * 0.34,
        skew: tw * 0.07,
      };
      const cols = 9;
      const cellW = tw / cols;
      const cellH = cellW * 1.25;
      wins = [];
      sideWins = [];
      rowYs = [];
      for (let row = 0; tower.top + 18 + row * cellH < H + cellH; row++) {
        rowYs.push(tower.top + 18 + row * cellH + cellH * 0.78);
        for (let c = 0; c < cols; c++) {
          wins.push({
            x: tower.x + c * cellW + cellW * 0.16,
            y: tower.top + 18 + row * cellH,
            w: cellW * 0.68,
            h: cellH * 0.62,
            lit: rand() < 0.42,
            warm: rand() < 0.82,
            seed: rand(),
          });
        }
        for (let c = 0; c < 3; c++) {
          sideWins.push({
            x: tower.x + tw + (c * tower.side) / 3 + tower.side * 0.06,
            y: tower.top + 18 + row * cellH,
            w: (tower.side / 3) * 0.62,
            h: cellH * 0.62,
            lit: rand() < 0.3,
            warm: true,
            seed: rand(),
          });
        }
      }
      // The flagged unit: a fixed spot about a third of the way down.
      const flagRow = Math.round((H * 0.36 - tower.top) / cellH);
      flag = wins[Math.max(0, flagRow) * cols + 6] ?? null;
      if (flag) flag.lit = true;

      // Out-of-focus city lights along the horizon.
      bokeh = [];
      for (let i = 0; i < (narrow ? 14 : 34); i++) {
        bokeh.push({
          x: rand() * W,
          y: H * (0.78 + rand() * 0.2),
          r: 4 + rand() * 14,
          a: 0.08 + rand() * 0.16,
          s: rand(),
        });
      }

      // Film grain tile.
      const g = document.createElement("canvas");
      g.width = g.height = 128;
      const gx = g.getContext("2d")!;
      const img = gx.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 22;
      }
      gx.putImageData(img, 0, 0);
      grain = ctx!.createPattern(g, "repeat");
    }

    function draw(now: number) {
      const t = reduced ? FLAG_AT + 1000 : now - start;
      const c = ctx!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      // Sky: deep blue overhead, ember at the horizon.
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#070a12");
      sky.addColorStop(0.45, "#101a2c");
      sky.addColorStop(0.78, "#3b2a24");
      sky.addColorStop(1, "#8a4a22");
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);
      const glow = c.createRadialGradient(W * 0.62, H * 0.95, 0, W * 0.62, H * 0.95, W * 0.7);
      glow.addColorStop(0, "rgba(233,140,60,0.45)");
      glow.addColorStop(1, "rgba(233,140,60,0)");
      c.fillStyle = glow;
      c.fillRect(0, 0, W, H);
      const teal = c.createRadialGradient(W * 0.18, H * 0.3, 0, W * 0.18, H * 0.3, W * 0.55);
      teal.addColorStop(0, "rgba(70,130,150,0.16)");
      teal.addColorStop(1, "rgba(70,130,150,0)");
      c.fillStyle = teal;
      c.fillRect(0, 0, W, H);

      // Skyline, with depth parallax.
      for (const tw of towers) {
        const px = pointer.x * (tw.depth === 0 ? 6 : 12);
        const py = pointer.y * (tw.depth === 0 ? 3 : 6);
        c.fillStyle = tw.depth === 0 ? "#141c2b" : "#0c111b";
        c.fillRect(tw.x + px, tw.top + py, tw.w, H - tw.top + 20);
        for (const w of tw.wins) {
          if (!w.on) continue;
          c.fillStyle = tw.depth === 0 ? "rgba(240,190,120,0.35)" : "rgba(245,196,128,0.55)";
          c.fillRect(w.x + px, w.y + py, 3, 4);
        }
      }

      // Haze between the skyline and the hero tower.
      const haze = c.createLinearGradient(0, H * 0.45, 0, H);
      haze.addColorStop(0, "rgba(16,26,44,0)");
      haze.addColorStop(1, "rgba(60,44,40,0.55)");
      c.fillStyle = haze;
      c.fillRect(0, 0, W, H);

      // Hero tower: front face + receding side face.
      const ox = pointer.x * 3;
      const oy = pointer.y * 2;
      const { x, w, top, side, skew } = tower;
      const face = c.createLinearGradient(0, top, 0, H);
      face.addColorStop(0, "#1d2638");
      face.addColorStop(1, "#0b0f17");
      c.fillStyle = face;
      c.fillRect(x + ox, top + oy, w, H - top + 10);
      c.fillStyle = "#0a0e15";
      c.beginPath();
      c.moveTo(x + w + ox, top + oy);
      c.lineTo(x + w + side + ox, top + skew + oy);
      c.lineTo(x + w + side + ox, H + 10);
      c.lineTo(x + w + ox, H + 10);
      c.closePath();
      c.fill();
      // Roof edge highlight.
      c.fillStyle = "rgba(255,210,160,0.18)";
      c.fillRect(x + ox, top + oy, w, 2);

      // Scan line position (bottom → top).
      const scanP = Math.min(1, Math.max(0, (t - SCAN_START) / SCAN_MS));
      const scanY = H - scanP * (H - top + 40);

      const drawWin = (win: Win, isSide: boolean) => {
        const passed = win.y > scanY;
        const sideSkew = isSide ? ((win.x - (x + w)) / side) * skew : 0;
        const wx = win.x + ox;
        const wy = win.y + oy + sideSkew;
        // Lights flicker on just after the scan passes.
        const on = win.lit && passed;
        if (on) {
          const flick = 0.85 + 0.15 * Math.sin(now / 900 + win.seed * 40);
          const a = (isSide ? 0.45 : 0.9) * flick * (narrow ? 0.6 : 1);
          // A lamp low in the room: brighter at the sill, dimmer at the head.
          const room = c.createLinearGradient(0, wy, 0, wy + win.h);
          if (win.warm) {
            room.addColorStop(0, `rgba(196,128,70,${a * 0.55})`);
            room.addColorStop(1, `rgba(255,206,140,${a})`);
          } else {
            room.addColorStop(0, `rgba(90,120,170,${a * 0.5})`);
            room.addColorStop(1, `rgba(170,198,240,${a * 0.85})`);
          }
          c.save();
          c.shadowColor = win.warm ? `rgba(255,170,90,${a * 0.7})` : `rgba(130,170,240,${a * 0.6})`;
          c.shadowBlur = isSide ? 6 : 14;
          c.fillStyle = room;
          c.fillRect(wx, wy, win.w, win.h);
          c.restore();
          // Mullion and a half-drawn blind on some units.
          c.fillStyle = "rgba(10,13,20,0.55)";
          if (!isSide) c.fillRect(wx + win.w / 2 - 0.5, wy, 1, win.h);
          if (win.seed > 0.6) c.fillRect(wx, wy, win.w, win.h * (win.seed - 0.45));
        } else {
          c.fillStyle = isSide ? "#0f141d" : "#141b28";
          c.fillRect(wx, wy, win.w, win.h);
          // A faint sky reflection on dark glass.
          c.fillStyle = "rgba(140,170,220,0.04)";
          c.fillRect(wx, wy, win.w * 0.4, win.h);
        }
      };
      for (const win of sideWins) drawWin(win, true);
      for (const win of wins) if (win !== flag) drawWin(win, false);
      // Balcony slabs: a thin lit edge under each floor.
      c.fillStyle = "rgba(255,220,180,0.06)";
      for (const ry of rowYs) c.fillRect(x + ox, ry + oy, w, 1.5);
      c.fillStyle = "rgba(0,0,0,0.25)";
      for (const ry of rowYs) c.fillRect(x + ox, ry + oy + 1.5, w, 2);

      // Scan band.
      if (scanP > 0 && scanP < 1) {
        const band = c.createLinearGradient(0, scanY - 60, 0, scanY + 6);
        band.addColorStop(0, "rgba(143,176,255,0)");
        band.addColorStop(1, "rgba(143,176,255,0.35)");
        c.fillStyle = band;
        c.fillRect(x + ox - 6, scanY - 60, w + side + 12, 66);
        c.fillStyle = "rgba(190,210,255,0.8)";
        c.fillRect(x + ox - 6, scanY, w + 12, 1.5);
      }

      // The flagged window, its pulse, and the leader line to the card.
      if (flag) {
        const fx = flag.x + ox;
        const fy = flag.y + oy;
        const flagged = flagCard && t > FLAG_AT;
        if (!flagged) {
          drawWin(flag, false);
        } else {
          const k = Math.min(1, (t - FLAG_AT) / 500);
          c.fillStyle = `rgba(233,105,44,${0.5 + 0.5 * k})`;
          c.fillRect(fx, fy, flag.w, flag.h);
          const pulse = ((now - start - FLAG_AT) % 2200) / 2200;
          const cx = fx + flag.w / 2;
          const cy = fy + flag.h / 2;
          c.strokeStyle = `rgba(233,105,44,${0.7 * (1 - pulse)})`;
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(cx, cy, 10 + pulse * 26, 0, Math.PI * 2);
          c.stroke();
          c.strokeStyle = "rgba(233,105,44,0.9)";
          c.strokeRect(fx - 5, fy - 5, flag.w + 10, flag.h + 10);

          const card = cardRef.current;
          if (card && card.offsetParent) {
            const cr = card.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            const ex = cr.right - wr.left;
            const ey = cr.top - wr.top + cr.height / 2;
            const len = Math.min(1, (t - FLAG_AT - 200) / 600);
            if (len > 0) {
              c.strokeStyle = "rgba(233,105,44,0.75)";
              c.lineWidth = 1;
              c.setLineDash([4, 4]);
              c.beginPath();
              c.moveTo(fx - 5, cy);
              const mx = fx - 5 + (ex - (fx - 5)) * len;
              const my = cy + (ey - cy) * len;
              c.lineTo(mx, my);
              c.stroke();
              c.setLineDash([]);
            }
          }
          if (!cardShown && t > FLAG_AT + 300) {
            cardShown = true;
            setCardOn(true);
          }
        }
      }

      // Drifting mist and bokeh at the horizon.
      for (let i = 0; i < 2; i++) {
        const drift = ((now / (60 + i * 30)) % (W * 1.6)) - W * 0.3;
        const mx = i === 0 ? drift : W * 1.2 - drift;
        const my = H * (0.74 + i * 0.1);
        c.save();
        c.translate(mx, my);
        c.scale(3.2, 1);
        const mist = c.createRadialGradient(0, 0, 0, 0, 0, W * 0.18);
        mist.addColorStop(0, "rgba(150,165,190,0.10)");
        mist.addColorStop(1, "rgba(150,165,190,0)");
        c.fillStyle = mist;
        c.fillRect(-W * 0.2, -W * 0.2, W * 0.4, W * 0.4);
        c.restore();
      }
      for (const b of bokeh) {
        const bx = b.x + pointer.x * 14 + Math.sin(now / 4000 + b.s * 10) * 4;
        const g = c.createRadialGradient(bx, b.y, 0, bx, b.y, b.r);
        g.addColorStop(0, `rgba(255,190,120,${b.a})`);
        g.addColorStop(1, "rgba(255,190,120,0)");
        c.fillStyle = g;
        c.fillRect(bx - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }

      // Ground fog, vignette, grain.
      const fog = c.createLinearGradient(0, H * 0.7, 0, H);
      fog.addColorStop(0, "rgba(7,10,18,0)");
      fog.addColorStop(1, "rgba(7,10,18,0.85)");
      c.fillStyle = fog;
      c.fillRect(0, 0, W, H);
      const vig = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      c.fillStyle = vig;
      c.fillRect(0, 0, W, H);
      // Left-side shade so the headline always reads.
      const shade = c.createLinearGradient(0, 0, W * 0.6, 0);
      shade.addColorStop(0, "rgba(5,7,12,0.7)");
      shade.addColorStop(1, "rgba(5,7,12,0)");
      c.fillStyle = shade;
      c.fillRect(0, 0, W, H);
      // On narrow screens the copy sits over the tower: darken from below.
      if (narrow) {
        const low = c.createLinearGradient(0, H * 0.3, 0, H);
        low.addColorStop(0, "rgba(5,7,12,0)");
        low.addColorStop(0.45, "rgba(5,7,12,0.75)");
        low.addColorStop(1, "rgba(5,7,12,0.92)");
        c.fillStyle = low;
        c.fillRect(0, 0, W, H);
      }
      if (grain) {
        c.save();
        c.translate((now / 40) % 128, (now / 55) % 128);
        c.fillStyle = grain;
        c.fillRect(-128, -128, W + 256, H + 256);
        c.restore();
      }
    }

    let last = 0;
    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      // Full rate during the intro, ~30fps once it settles.
      if (now - start > FLAG_AT + 1200 && now - last < 33) return;
      last = now;
      draw(now);
    }

    build();
    if (reduced) {
      // The card is shown by the reduced-motion CSS; just draw the frame.
      draw(performance.now());
      // Redraw once the card has laid out, so the leader line reaches it.
      requestAnimationFrame(() => draw(performance.now()));
    } else {
      start = performance.now();
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      build();
      if (reduced) draw(performance.now());
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(wrap);
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!reduced) window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [flagCard]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" aria-hidden={false}>
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden />
      {/* The floating flag card (sample data). */}
      {flagCard && (
      <div
        ref={cardRef}
        className={`hero-card absolute left-[max(2rem,calc((100%-72rem)/2+1.5rem))] top-[120px] w-[340px] rounded-2xl border border-white/15 bg-[#0d121c]/70 backdrop-blur-md text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] ${
          cardOn ? "hero-card-on" : ""
        }`}
      >
        <div className="flex items-center gap-1 px-4 pt-3 data-label text-white/50">
          <span className="text-white/90">Flag 01</span>
          <span className="mx-1.5">·</span>
          <span>North Hill Terrace · sample</span>
        </div>
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between gap-3">
            <SeverityBadge severity="critical" />
            <span className="text-[22px] font-bold tabular-nums text-[#ffb38a]">
              $8,500<span className="text-xs font-medium text-white/55"> /unit</span>
            </span>
          </div>
          <div className="mt-2.5 font-semibold leading-snug">Special assessment levied for parkade membrane</div>
          <div className="mt-3 rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2.5 text-[13px] leading-relaxed text-white/75">
            “…a special assessment of $8,500 per unit ($714,000 in total) be levied…”
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px]">
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <path d="M3 7.3l2.4 2.4L11 4.2" stroke="#8fb0ff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
            <span className="font-semibold text-[#b9ccff]">Verified</span>
            <span className="data-label text-white/55">AGM minutes, p. 1</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
