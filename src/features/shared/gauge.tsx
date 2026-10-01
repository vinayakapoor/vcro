import { useEffect, useId, useState } from "react";
import { BAND_VAR, Change } from "./band";
import { BAND_RANGES, bandFor } from "@/lib/scoring";

const CX = 120, CY = 114, R = 92, W = 9;
const GAP = 1.1;

function pt(v: number, r: number) {
  const a = Math.PI - (v / 100) * Math.PI;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
}
function arc(a: number, b: number, r = R) {
  const [x1, y1] = pt(a, r);
  const [x2, y2] = pt(b, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}
export const rangeFor = (value: number, confidence: number) => {
  const u = Math.max(1, Math.round((100 - confidence) * 0.3));
  return [Math.max(0, value - u), Math.min(100, value + u)] as const;
};
/** The dial splits at 20, 40, 60 and 80, the same cut-offs as the bands. */
const SEGMENTS = BAND_RANGES.map((b) => ({ band: b.band, from: b.from === 0 ? 0 : b.from - 1, to: b.to }));
/** Settles slightly past the value and eases back, like a real needle. */
const settle = (k: number) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

/**
 * Riskometer: a needle gauge. The band the score sits in is lit; the needle sweeps to the score and
 * its tip pulses in the band colour. The thin outer arc is the likely range. Higher = riskier.
 */
export function Gauge({ value, prev, prevLabel, compact, confidence, hideRange }: { value: number | null; prev: number | null; prevLabel: string; compact?: boolean; confidence?: number; hideRange?: boolean }) {
  const gid = useId().replace(/:/g, "");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value === null) return;
    // No sweep in a background tab or when the person has asked for reduced motion.
    if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1300);
      setShown(Math.max(0, value * settle(k)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const band = bandFor(value);
  const tone = BAND_VAR[band];
  const range = value !== null && confidence !== undefined ? rangeFor(value, confidence) : null;
  const tip = pt(shown, R - W / 2 - 12);
  const settled = value !== null && Math.abs(shown - value) < 0.5;

  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="-8 0 256 134" className={compact ? "w-60" : "w-full max-w-[18.5rem]"} role="img" aria-label={`Risk score ${value ?? "none"} of 100, ${band}. Higher is riskier.`}>
        <defs>
          <radialGradient id={`glow${gid}`} cx="50%" cy="100%" r="75%">
            <stop offset="0" stopColor={tone} stopOpacity={value === null ? 0 : 0.32} />
            <stop offset="1" stopColor={tone} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`needle${gid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={tone} />
            <stop offset="0.45" stopColor="var(--foreground)" />
          </linearGradient>
          <filter id={`blur${gid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>

        {/* Soft wash of the band colour behind the dial. */}
        <path d={`M ${CX - R + 6} ${CY} A ${R - 6} ${R - 6} 0 0 1 ${CX + R - 6} ${CY} Z`} fill={`url(#glow${gid})`} />

        {/* Fine scale. */}
        {Array.from({ length: 51 }, (_, i) => i * 2).map((v) => {
          const major = v % 20 === 0;
          const [x1, y1] = pt(v, R - W / 2 - 4);
          const [x2, y2] = pt(v, R - W / 2 - (major ? 9 : 6.5));
          return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} {...(value !== null && v <= shown ? { stroke: BAND_VAR[bandFor(Math.max(1, v))], strokeOpacity: 0.9 } : { className: major ? "stroke-muted-foreground/70" : "stroke-muted-foreground/30" })} strokeWidth={major ? 1.2 : 0.8} strokeLinecap="round" />;
        })}

        {/* Bands: the one the score sits in is lit, the rest step back. */}
        {SEGMENTS.map((sg, i) => {
          const active = sg.band === band;
          return (
            <g key={sg.band}>
            {active && value !== null && (
              <path d={arc(sg.from + GAP, sg.to - GAP)} fill="none" stroke={BAND_VAR[sg.band]} strokeWidth={W + 8} filter={`url(#blur${gid})`} opacity={0.35}>
                <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3.2s" repeatCount="indefinite" />
              </path>
            )}
            <path d={arc(sg.from + (i === 0 ? 0 : GAP), sg.to - (i === SEGMENTS.length - 1 ? 0 : GAP))} fill="none" stroke={BAND_VAR[sg.band]}
              strokeWidth={active ? W + 2.5 : W} strokeOpacity={value === null ? 0.2 : active ? 1 : 0.55}
              strokeLinecap={i === 0 || i === SEGMENTS.length - 1 ? "round" : "butt"} style={{ transition: "stroke-opacity .4s, stroke-width .4s" }} />
            </g>
          );
        })}

        {range && (
          <g>
            <path d={arc(range[0], range[1], R + W / 2 + 7)} fill="none" stroke={tone} strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" />
            {range.map((v) => { const [x, y] = pt(v, R + W / 2 + 7); return <circle key={v} cx={x} cy={y} r={1.8} fill={tone} />; })}
          </g>
        )}
        {prev !== null && value !== null && prev !== value && (() => {
          const [x, y] = pt(prev, R - W / 2 - 15);
          return <circle cx={x} cy={y} r={2} className="fill-muted-foreground" />;
        })()}

        {[0, 20, 40, 60, 80, 100].map((v) => {
          const [x, y] = pt(v, R + W / 2 + (v === 0 || v === 100 ? 0 : 18));
          return <text key={v} x={x} y={v === 0 || v === 100 ? CY + 15 : y + 3} textAnchor="middle" className="fill-muted-foreground" fontSize={8}>{v}</text>;
        })}

        {value !== null && (
          <g>
            {/* Needle: tapered, tinted towards the tip, with a soft shadow. */}
            <g transform={`rotate(${shown * 1.8} ${CX} ${CY})`}>
              <polygon points={`${CX - (R - W / 2 - 12)},${CY} ${CX + 1},${CY - 3.6} ${CX + 9},${CY} ${CX + 1},${CY + 3.6}`} fill="var(--foreground)" opacity={0.12} transform="translate(0 2.5)" />
              <polygon points={`${CX - (R - W / 2 - 12)},${CY} ${CX + 1},${CY - 3.4} ${CX + 9},${CY} ${CX + 1},${CY + 3.4}`} fill={`url(#needle${gid})`} />
            </g>
            {/* Tip: pulses once the needle has settled. */}
            {settled && (
              <circle cx={tip[0]} cy={tip[1]} r={3} fill={tone} opacity={0.5}>
                <animate attributeName="r" values="3;9;3" dur="2.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.45;0;0.45" dur="2.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={tip[0]} cy={tip[1]} r={3} fill={tone} stroke="var(--card)" strokeWidth={1.25} />
            <circle cx={CX} cy={CY} r={9} className="fill-card" stroke="var(--foreground)" strokeWidth={2.5} />
            <circle cx={CX} cy={CY} r={3.25} fill={tone} />
          </g>
        )}
      </svg>

      {/* The score, then one line under it: the band and the change since last month. */}
      <div className="mt-2 flex items-baseline justify-center gap-1.5">
        <span className={compact ? "text-4xl font-bold leading-none tracking-tight tabular-nums" : "text-[3.25rem] font-bold leading-none tracking-tighter tabular-nums"}>
          {value === null ? <span className="text-2xl tracking-tight text-muted-foreground">No score yet</span> : Math.round(Math.min(100, shown))}
        </span>
        {value !== null && <span className="text-sm text-muted-foreground">/ 100</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-sm leading-none">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold" style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tone} 50%, transparent)` }}>
          <span className="size-1.5 rounded-full" style={{ background: tone }} aria-hidden />{band}
        </span>
        {value !== null && prev !== null && value !== prev && <><span className="h-3.5 w-px bg-border" aria-hidden /><Change value={value - prev} vs={prevLabel} /></>}
      </div>
      {range && !hideRange && <div className="mt-2 text-xs text-muted-foreground tabular-nums">Likely range {range[0]} to {range[1]}</div>}
    </div>
  );
}
