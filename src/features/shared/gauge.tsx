import { useEffect, useState } from "react";
import { BAND_VAR, BandBadge, Change } from "./band";
import { BAND_RANGES, bandFor } from "@/lib/scoring";

const CX = 120, CY = 116, R = 92, W = 15;
const GAP = 0.9;

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

/**
 * Riskometer dial. Five band segments, filled up to the score. A pointer marks the score, a tick marks
 * last month, and the thin inner arc is the likely range given how much data is connected. Higher = riskier.
 */
export function Gauge({ value, prev, prevLabel, compact, confidence }: { value: number | null; prev: number | null; prevLabel: string; compact?: boolean; confidence?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value === null) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 800);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const band = bandFor(value);
  const range = value !== null && confidence !== undefined ? rangeFor(value, confidence) : null;
  const [mx, my] = pt(shown, R);

  return (
    <div className="flex flex-col items-center">
      <div className={compact ? "relative w-56" : "relative w-full max-w-[22rem]"}>
        <svg viewBox="-6 -8 252 140" className="w-full overflow-visible" role="img" aria-label={`Risk score ${value ?? "none"} of 100, ${band}. Higher is riskier.`}>
          {SEGMENTS.map((sg, i) => {
            const a = sg.from + (i === 0 ? 0 : GAP), b = sg.to - (i === SEGMENTS.length - 1 ? 0 : GAP);
            const fillTo = Math.min(b, shown);
            const cap = i === 0 || i === SEGMENTS.length - 1 ? "round" : "butt";
            return (
              <g key={sg.band}>
                <path d={arc(a, b)} fill="none" stroke={BAND_VAR[sg.band]} strokeOpacity={0.2} strokeWidth={W} strokeLinecap={cap} />
                {value !== null && fillTo > a && <path d={arc(a, fillTo)} fill="none" stroke={BAND_VAR[sg.band]} strokeWidth={W} strokeLinecap={i === 0 ? "round" : "butt"} />}
              </g>
            );
          })}
          {[0, 20, 40, 60, 80, 100].map((v) => {
            const [x, y] = pt(v, R + 21);
            return <text key={v} x={x} y={y + 3} textAnchor="middle" className="fill-muted-foreground" fontSize={8.5}>{v}</text>;
          })}
          {range && <path d={arc(range[0], range[1], R + W / 2 + 5)} fill="none" className="stroke-foreground/35" strokeWidth={2.5} strokeLinecap="round"><title>{`Likely range ${range[0]} to ${range[1]}`}</title></path>}
          {prev !== null && value !== null && prev !== value && (() => {
            const [x1, y1] = pt(prev, R - W / 2 - 1);
            const [x2, y2] = pt(prev, R + W / 2 + 1);
            return <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-background" strokeWidth={2.5}><title>{`${prevLabel}: ${prev}`}</title></line>;
          })()}
          {value !== null && (
            <>
              <circle cx={mx} cy={my} r={W / 2 + 6} className="fill-card" />
              <circle cx={mx} cy={my} r={W / 2 + 2} className="fill-card" stroke={BAND_VAR[band]} strokeWidth={4.5} />
            </>
          )}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <div className={compact ? "text-4xl font-bold leading-none tracking-tight tabular-nums" : "text-6xl font-bold leading-none tracking-tighter tabular-nums sm:text-7xl"}>{value ?? <span className="text-3xl tracking-tight text-muted-foreground">None</span>}</div>
          <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{value === null ? "No score yet" : "of 100"}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <BandBadge band={band} />
        {value !== null && prev !== null && <span className="text-sm"><Change value={value - prev} vs={prevLabel} /></span>}
      </div>
      {range && <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">Likely range {range[0]} to {range[1]} at {confidence}% confidence</div>}
    </div>
  );
}
