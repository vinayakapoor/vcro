import { useEffect, useId, useState } from "react";
import { BAND_VAR, BandBadge, Change } from "./band";
import { bandFor, type Band } from "@/lib/scoring";

const SEGMENTS: [number, number, Band][] = [[0, 20, "Low"], [20, 40, "Guarded"], [40, 60, "Elevated"], [60, 80, "High"], [80, 100, "Critical"]];
const CX = 110, CY = 108, R = 86;

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

/** Riskometer: banded track, gradient progress to the score, last-month marker, likely-range band. Higher = riskier. */
export function Gauge({ value, prev, prevLabel, compact, confidence }: { value: number | null; prev: number | null; prevLabel: string; compact?: boolean; confidence?: number }) {
  const gid = useId().replace(/:/g, "");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value === null) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const band = bandFor(value);
  const range = value !== null && confidence !== undefined ? rangeFor(value, confidence) : null;
  const [mx, my] = pt(Math.max(0.5, shown), R);

  return (
    <div className="flex flex-col items-center">
      <div className={compact ? "relative w-52" : "relative w-full max-w-80"}>
        <svg viewBox="0 0 220 124" className="w-full overflow-visible" role="img" aria-label={`Risk score ${value ?? "none"} of 100, ${band}. Higher is riskier.`}>
          <defs>
            <linearGradient id={`g${gid}`} x1="24" x2="196" y1="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={BAND_VAR.Low} />
              <stop offset="0.3" stopColor={BAND_VAR.Guarded} />
              <stop offset="0.5" stopColor={BAND_VAR.Elevated} />
              <stop offset="0.7" stopColor={BAND_VAR.High} />
              <stop offset="1" stopColor={BAND_VAR.Critical} />
            </linearGradient>
          </defs>
          <path d={arc(0, 100)} fill="none" className="stroke-muted" strokeWidth={12} strokeLinecap="round" />
          {SEGMENTS.map(([a, b, bd]) => (
            <path key={bd} d={arc(a + 0.6, b - 0.6, R + 1)} fill="none" stroke={BAND_VAR[bd]} strokeOpacity={0.1} strokeWidth={12} />
          ))}
          {value !== null && shown > 0.5 && <path d={arc(0, shown)} fill="none" stroke={`url(#g${gid})`} strokeWidth={12} strokeLinecap="round" />}
          {Array.from({ length: 21 }, (_, i) => i * 5).map((v) => {
            const [x1, y1] = pt(v, R - 13);
            const [x2, y2] = pt(v, R - (v % 20 === 0 ? 19 : 16));
            return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-muted-foreground/40" strokeWidth={v % 20 === 0 ? 1.2 : 0.7} />;
          })}
          {[0, 20, 40, 60, 80, 100].map((v) => {
            const [x, y] = pt(v, R + 15);
            return <text key={v} x={x} y={y + 3} textAnchor="middle" className="fill-muted-foreground" fontSize={8}>{v}</text>;
          })}
          {range && <path d={arc(range[0], range[1], R + 10)} fill="none" className="stroke-foreground/30" strokeWidth={3} strokeLinecap="round"><title>{`Likely range ${range[0]} to ${range[1]}`}</title></path>}
          {prev !== null && (() => {
            const [x1, y1] = pt(prev, R - 9);
            const [x2, y2] = pt(prev, R + 9);
            return <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-foreground/45" strokeWidth={2} strokeLinecap="round"><title>{`${prevLabel}: ${prev}`}</title></line>;
          })()}
          {value !== null && <circle cx={mx} cy={my} r={6.5} className="fill-background" stroke={BAND_VAR[band]} strokeWidth={3.5} />}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <div className={compact ? "text-3xl font-semibold leading-none tracking-tight tabular-nums" : "text-6xl font-bold leading-none tracking-tighter tabular-nums sm:text-7xl"}>{value ?? "None"}</div>
          <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">of 100</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <BandBadge band={band} />
        {value !== null && prev !== null && <span className="text-sm"><Change value={value - prev} vs={prevLabel} /></span>}
      </div>
      {range && <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">Likely range {range[0]} to {range[1]}</div>}
    </div>
  );
}
