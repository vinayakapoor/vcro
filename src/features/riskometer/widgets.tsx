import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { ArrowRight, Info, Play, RotateCcw, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Widget } from "@/features/shared/widget";
import { Gauge } from "@/features/shared/gauge";
import { BAND_VAR, BandBadge, DeltaBadge, StatusBadge } from "@/features/shared/band";
import { DataTable, type Column } from "@/features/shared/data-table";
import { usePrefs } from "@/features/shared/prefs";
import {
  DEPARTMENTS, LURES, PREV_MONTH, bestNextSources, clearRun, deptLures, dismissRun, fmt, formatStamp, pct, pseudonym, queueRun, recommendedActions, trends, useRuns, useSettings, useSignals,
  type Action, type Department, type orgSummary,
} from "@/lib/api";
import { bandFor, type Band } from "@/lib/scoring";

type Summary = ReturnType<typeof orgSummary>;
export const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };
/** Same ramp as the heatmap: band hue, stronger as the score rises. */
export const heat = (v: number) => `color-mix(in oklab, ${BAND_VAR[bandFor(v)]} ${20 + v * 0.6}%, transparent)`;

export function ChartTip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">{children}</div>;
}

export function ConfidenceLine({ confidence, active, total }: { confidence: number; active: number; total: number }) {
  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Confidence {confidence}% · {active} of {total} signals<Info className="size-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 space-y-1 text-xs">
        <p className="font-semibold">What confidence means</p>
        <p>How much of the scoring model is fed by live data. 100% means every signal is connected.</p>
        <p>Unconnected signals drop out and the rest rebalance, so a low confidence score can move once more sources connect.</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export function PillarMeters({ pillars, ai }: { pillars: Record<"Behaviour" | "Exposure" | "Privilege", number>; ai: number | null }) {
  const rows: [string, number | null][] = [...(Object.entries(pillars) as [string, number][]), ["AI identities", ai]];
  return (
    <div className="space-y-2.5">
      {rows.map(([k, v]) => v === null ? (
        <div key={k} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-sm text-muted-foreground">
          <span>{k}</span>
          <span className="h-1.5 rounded-full bg-muted" />
          <Link to="/vcro/signals/$id" params={{ id: "int-ai" }} className="text-xs font-medium text-foreground underline underline-offset-2">Connect</Link>
        </div>
      ) : (
        <div key={k} className="grid grid-cols-[84px_1fr_32px] items-center gap-3 text-sm">
          <span>{k}</span>
          <span className="h-1.5 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${v}%`, background: BAND_VAR[bandFor(v)] }} /></span>
          <span className="text-right tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function RiskometerCard({ s, ready }: { s: Summary; ready: boolean }) {
  const top = s.drivers.slice(0, 4);
  const max = Math.max(1, ...s.bands.map((b) => b.count));
  return (
    <Widget title="Riskometer" ready={ready} className="flex flex-col lg:col-span-5" contentClassName="flex flex-1 flex-col" empty={s.scored === 0 && { text: "No scored people yet", action: <Button asChild variant="outline" size="sm"><Link to="/vcro/signals">Connect source</Link></Button> }}>
      <div className="flex flex-1 items-center justify-center py-2"><Gauge value={s.score} prev={s.prev} prevLabel={PREV_MONTH} confidence={s.confidence} /></div>

      <div className="mt-3 border-t pt-4">
        <div className="mb-2 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span>People by band</span><span className="tabular-nums">{fmt(s.scored)} scored</span></div>
        <div className="space-y-1">
          {s.bands.map((b) => (
            <Link key={b.band} to="/vcro/people" search={{ band: b.band }} title={`See the ${fmt(b.count)} people in ${b.band}`}
              className="-mx-1.5 grid grid-cols-[78px_1fr_auto] items-center gap-3 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: BAND_VAR[b.band] }} />{b.band}</span>
              <span className="h-1.5 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(b.count / max) * 100}%`, minWidth: b.count ? 3 : 0, background: BAND_VAR[b.band] }} /></span>
              <span className="w-24 text-right tabular-nums">{fmt(b.count)}<span className="ml-1.5 text-xs text-muted-foreground">{pct(s.scored ? b.count / s.scored : 0)}</span></span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What drives it</div>
        <PillarMeters pillars={s.pillars} ai={s.aiAgents} />
      </div>
      <div className="mt-4 border-t pt-3"><ConfidenceLine confidence={s.confidence} active={s.activeCount} total={s.totalElements} /></div>
      <div className="mt-3 rounded-xl border bg-muted/30 p-3">
        <div className="flex items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>What moved the score since {PREV_MONTH}</span><span className="tabular-nums">{s.prev} to {s.score}</span>
        </div>
        {top.length ? (
          <ul className="mt-2 space-y-1.5">
            {top.map((d) => (
              <li key={d.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{d.category}</span>
                <span className={`shrink-0 text-xs font-medium tabular-nums ${d.delta < 0 ? "text-success" : "text-warning"}`}>{d.delta > 0 ? "+" : ""}{d.delta.toFixed(1)} pts</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted-foreground">No driver moved by 0.1 points or more.</p>}
      </div>
    </Widget>
  );
}

const tens = (v: number, up: boolean) => Math.max(0, Math.min(100, (up ? Math.ceil : Math.floor)(v / 10) * 10));

export function TrendCard({ ready }: { ready: boolean }) {
  const sig = useSignals();
  const { targetScore } = useSettings();
  const mobile = useIsMobile();
  const data = ready ? trends(sig).org : [];
  const vals = [...data.map((d) => d.score), ...(targetScore !== null ? [targetScore] : [])];
  const domain: [number, number] = vals.length ? [tens(Math.min(...vals) - 8, false), tens(Math.max(...vals) + 8, true)] : [0, 100];
  return (
    <Widget
      title="Risk trend" ready={ready} className="lg:col-span-8"
      action={targetScore !== null
        ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-px w-4 border-t border-dashed border-success" aria-hidden />Target {targetScore}</span>
        : <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"><Link to="/vcro/settings">Set a target score</Link></Button>}
    >
      <div className="h-64 lg:h-80">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 18, right: 12, left: 4, bottom: 16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} label={{ value: "Month", position: "insideBottom", offset: -8, ...AXIS }} />
            <YAxis domain={domain} tick={AXIS} tickLine={false} axisLine={false} width={44} allowDecimals={false} label={{ value: "Score", angle: -90, position: "insideLeft", offset: 10, ...AXIS }} />
            {data.filter((t) => t.intervention).map((t) => (
              <ReferenceLine key={t.month} x={t.month} stroke="var(--muted-foreground)" strokeDasharray="3 3" {...(mobile ? {} : { label: { value: t.intervention!, position: "top" as const, ...AXIS, fontSize: 10 } })} />
            ))}
            {targetScore !== null && <ReferenceLine y={targetScore} stroke="var(--success)" strokeDasharray="5 4" />}
            <Area dataKey="score" stroke="var(--foreground)" strokeWidth={2} fill="var(--foreground)" fillOpacity={0.05} isAnimationActive={false} dot={{ r: 2.5, fill: "var(--foreground)", strokeWidth: 0 }} />
            <RTooltip content={({ active, payload }) => {
              const d = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !d) return null;
              return (
                <ChartTip>
                  <div className="font-medium">{d.month}</div>
                  <div>Score {d.score} · {d.band}</div>
                  <div>Change {d.delta > 0 ? "+" : ""}{d.delta} pts</div>
                  {d.intervention && <div>{d.intervention}</div>}
                </ChartTip>
              );
            }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Axis shows {domain[0]} to {domain[1]} so month-to-month movement is visible. Dashed lines mark campaigns.</p>
    </Widget>
  );
}

export function MoversCard({ s, ready }: { s: Summary; ready: boolean }) {
  const { privacy } = usePrefs();
  const depts = [...s.departments].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 6);
  const people = useMemo(() => s.people.filter((p) => p.change).sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!)).slice(0, 6), [s.people]);
  const row = "flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <Widget title="Biggest movers" ready={ready} className="lg:col-span-4">
      <Tabs defaultValue="dept">
        <TabsList className="mb-2"><TabsTrigger value="dept">Departments</TabsTrigger><TabsTrigger value="people">People</TabsTrigger></TabsList>
        <TabsContent value="dept" className="space-y-0.5">
          {depts.map((d) => (
            <Link key={d.department} to="/vcro/people" search={{ dept: d.department }} className={row}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.department}</span>
                <span className="block truncate text-xs text-muted-foreground">Top driver: {d.topDriver}</span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{d.prev} → {d.score}</span>
              <DeltaBadge value={d.change} />
            </Link>
          ))}
        </TabsContent>
        <TabsContent value="people" className="space-y-0.5">
          {!people.length && <p className="px-2 py-6 text-sm text-muted-foreground">No person moved since {PREV_MONTH}.</p>}
          {people.map((p) => (
            <Link key={p.id} to="/vcro/people/$id" params={{ id: p.id }} className={row}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{privacy ? pseudonym(p.id) : p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.department} · {p.topDriver ?? "None"}</span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{p.prev} → {p.score}</span>
              <DeltaBadge value={p.change!} />
            </Link>
          ))}
        </TabsContent>
      </Tabs>
    </Widget>
  );
}

const MX = { w: 420, h: 280, l: 44, r: 12, t: 12, b: 36 };
/** Quadrant lines: likelihood above the Guarded band, privilege above the midpoint. */
const Q = { x: 40, y: 50 };

export function MatrixCard({ s, ready }: { s: Summary; ready: boolean }) {
  const navigate = useNavigate();
  const { privacy } = usePrefs();
  const [mode, setMode] = useState<"dept" | "people">("dept");
  const [hover, setHover] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const top50 = useMemo(() => s.people.filter((p) => p.score !== null).sort((a, b) => b.score! - a.score!).slice(0, 50), [s.people]);
  const maxHc = Math.max(...s.departments.map((d) => d.headcount));
  const pts = mode === "dept" ? s.departments.map((d) => [d.likelihood, d.privilege] as const) : top50.map((p) => [p.likelihood, p.privilege] as const);
  // Zoom to where the data is, always keeping both quadrant lines in view.
  const xd: [number, number] = [tens(Math.min(Q.x, ...pts.map((p) => p[0])) - 10, false), tens(Math.max(Q.x, ...pts.map((p) => p[0])) + 10, true)];
  const yd: [number, number] = [tens(Math.min(Q.y, ...pts.map((p) => p[1])) - 10, false), tens(Math.max(Q.y, ...pts.map((p) => p[1])) + 10, true)];
  const sx = (v: number) => MX.l + ((v - xd[0]) / (xd[1] - xd[0])) * (MX.w - MX.l - MX.r);
  const sy = (v: number) => MX.t + (1 - (v - yd[0]) / (yd[1] - yd[0])) * (MX.h - MX.t - MX.b);
  const ticks = (d: [number, number]) => Array.from({ length: (d[1] - d[0]) / 10 + 1 }, (_, i) => d[0] + i * 10).filter((v, _, a) => a.length <= 6 || v % 20 === 0);
  const qx = sx(Q.x), qy = sy(Q.y);

  return (
    <Widget title="Likelihood vs impact" ready={ready} className="lg:col-span-6"
      action={
        <ToggleGroup type="single" size="sm" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as "dept" | "people")} aria-label="Bubbles">
          <ToggleGroupItem value="dept" className="px-2.5 text-xs">Departments</ToggleGroupItem>
          <ToggleGroupItem value="people" className="px-2.5 text-xs">Top 50 people</ToggleGroupItem>
        </ToggleGroup>
      }>
      <div className="relative">
        <svg viewBox={`0 0 ${MX.w} ${MX.h}`} className="w-full" role="img" aria-label="Likelihood versus impact matrix">
          <rect x={MX.l} y={MX.t} width={MX.w - MX.l - MX.r} height={MX.h - MX.t - MX.b} rx={6} fill="none" stroke="var(--border)" />
          <rect x={qx} y={MX.t} width={MX.w - MX.r - qx} height={qy - MX.t} fill={BAND_VAR.Critical} fillOpacity={0.07} />
          <rect x={MX.l} y={MX.t} width={qx - MX.l} height={qy - MX.t} fill={BAND_VAR.Elevated} fillOpacity={0.06} />
          <rect x={qx} y={qy} width={MX.w - MX.r - qx} height={MX.h - MX.b - qy} fill={BAND_VAR.High} fillOpacity={0.06} />
          <rect x={MX.l} y={qy} width={qx - MX.l} height={MX.h - MX.b - qy} fill={BAND_VAR.Low} fillOpacity={0.05} />
          <line x1={qx} x2={qx} y1={MX.t} y2={MX.h - MX.b} stroke="var(--border)" strokeDasharray="4 4" />
          <line x1={MX.l} x2={MX.w - MX.r} y1={qy} y2={qy} stroke="var(--border)" strokeDasharray="4 4" />
          {[["Protect", MX.l + 6, MX.t + 14, "start"], ["Act now", MX.w - MX.r - 6, MX.t + 14, "end"], ["Monitor", MX.l + 6, MX.h - MX.b - 6, "start"], ["Coach", MX.w - MX.r - 6, MX.h - MX.b - 6, "end"]].map(([t, x, y, a]) => (
            <text key={t as string} x={x as number} y={y as number} textAnchor={a as "start"} fontSize={10} fontWeight={600} className="fill-muted-foreground">{t}</text>
          ))}
          {ticks(xd).map((v) => <text key={v} x={sx(v)} y={MX.h - MX.b + 12} textAnchor="middle" fontSize={9} className="fill-muted-foreground">{v}</text>)}
          {ticks(yd).map((v) => <text key={v} x={MX.l - 6} y={sy(v) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground">{v}</text>)}
          <text x={(MX.l + MX.w - MX.r) / 2} y={MX.h - 4} textAnchor="middle" fontSize={10} className="fill-muted-foreground">Likelihood: behaviour and exposure</text>
          <text transform={`translate(10 ${(MX.t + MX.h - MX.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} className="fill-muted-foreground">Impact: privilege</text>
          {mode === "dept" ? [...s.departments].sort((a, b) => b.headcount - a.headcount).map((d) => {
            const x = sx(d.likelihood), y = sy(d.privilege);
            const go = () => navigate({ to: "/vcro/people", search: { dept: d.department } });
            return (
              <circle key={d.department} cx={x} cy={y} r={5 + Math.sqrt(d.headcount / maxHc) * 16} fill={BAND_VAR[d.band]} fillOpacity={0.7} stroke="var(--card)" strokeWidth={2}
                tabIndex={0} role="button" aria-label={`${d.department}, score ${d.score}`} className="cursor-pointer outline-none focus-visible:stroke-foreground"
                onMouseEnter={() => setHover({ x, y, lines: [d.department, `Score ${d.score} · ${d.band}`, `Likelihood ${d.likelihood} · Privilege ${d.privilege}`, `${fmt(d.headcount)} people`] })}
                onMouseLeave={() => setHover(null)} onClick={go} onKeyDown={(e) => e.key === "Enter" && go()} />
            );
          }) : top50.map((p) => {
            const x = sx(p.likelihood), y = sy(p.privilege);
            return (
              <circle key={p.id} cx={x} cy={y} r={4.5} fill={BAND_VAR[p.band]} fillOpacity={0.8} stroke="var(--card)" strokeWidth={1} className="cursor-pointer"
                onMouseEnter={() => setHover({ x, y, lines: [privacy ? pseudonym(p.id) : p.name, `${p.role}, ${p.department}`, `Score ${p.score} · ${p.band}`] })}
                onMouseLeave={() => setHover(null)}
                onClick={() => navigate({ to: "/vcro/people/$id", params: { id: p.id } })} />
            );
          })}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute z-10" style={{ left: `${(hover.x / MX.w) * 100}%`, top: `${(hover.y / MX.h) * 100}%`, transform: "translate(-50%, calc(-100% - 12px))" }}>
            <ChartTip>{hover.lines.map((l, i) => <div key={i} className={i === 0 ? "font-medium" : ""}>{l}</div>)}</ChartTip>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{mode === "dept" ? "Bubble size is headcount. Click a bubble to see its people." : "The 50 highest scores. Click a dot to open the person."}</p>
    </Widget>
  );
}

export function SusceptibilityCard({ s, ready }: { s: Summary; ready: boolean }) {
  const signals = useSignals();
  const [dept, setDept] = useState<Department>("Finance");
  const deptL = deptLures(signals, dept);
  const channels = s.channels.map((c) => ({ channel: c.channel, failure: Math.round(c.failRate * 100), report: Math.round(c.reportRate * 100) }));
  const lures = LURES.map((l) => ({ lure: l, org: s.lures[l], dept: deptL[l] }));
  return (
    <Widget title="Susceptibility" ready={ready} className="lg:col-span-6" notConnected={!s.simsLive}>
      <Tabs defaultValue="channel">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <TabsList><TabsTrigger value="channel">By channel</TabsTrigger><TabsTrigger value="lure">By lure</TabsTrigger></TabsList>
        </div>
        <TabsContent value="channel">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={channels} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 16 }} barGap={2}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" label={{ value: "Rate (% of simulations)", position: "insideBottom", offset: -8, ...AXIS }} />
                <YAxis type="category" dataKey="channel" tick={AXIS} tickLine={false} axisLine={false} width={64} />
                <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="failure" name="Failure rate" fill="var(--band-high)" radius={[0, 5, 5, 0]} barSize={10} isAnimationActive={false} />
                <Bar dataKey="report" name="Report rate" fill="var(--band-low)" radius={[0, 5, 5, 0]} barSize={10} isAnimationActive={false} />
                <RTooltip cursor={{ fill: "var(--muted)" }} content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as (typeof channels)[number] | undefined;
                  return active && d ? <ChartTip><div className="font-medium">{d.channel}</div><div>Failure {d.failure}%</div><div>Report {d.report}%</div></ChartTip> : null;
                }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
        <TabsContent value="lure">
          <div className="flex justify-end">
            <Select value={dept} onValueChange={(v) => setDept(v as Department)}>
              <SelectTrigger className="h-8 w-48" aria-label="Department"><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="h-60">
            <ResponsiveContainer>
              <RadarChart data={lures} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="lure" tick={AXIS} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ ...AXIS, fontSize: 9 }} angle={90} tickFormatter={(v) => `${v}%`} />
                <Radar name="Organisation" dataKey="org" stroke="var(--foreground)" fill="var(--foreground)" fillOpacity={0.08} isAnimationActive={false} />
                <Radar name={dept} dataKey="dept" stroke="var(--band-high)" fill="var(--band-high)" fillOpacity={0.15} isAnimationActive={false} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RTooltip content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as (typeof lures)[number] | undefined;
                  return active && d ? <ChartTip><div className="font-medium">{d.lure}</div><div>Organisation {d.org}% failure</div><div>{dept} {d.dept}% failure</div></ChartTip> : null;
                }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </Widget>
  );
}

type Rect = { key: string; value: number; x: number; y: number; w: number; h: number };
function treemap(items: { key: string; value: number }[], x: number, y: number, w: number, h: number): Rect[] {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0]!, x, y, w, h }];
  const total = items.reduce((a, b) => a + b.value, 0);
  let acc = 0, i = 0;
  while (i < items.length - 1 && acc + items[i]!.value <= total / 2) acc += items[i++]!.value;
  if (i === 0) acc = items[i++]!.value;
  const a = items.slice(0, i), b = items.slice(i), k = acc / total;
  return w >= h
    ? [...treemap(a, x, y, w * k, h), ...treemap(b, x + w * k, y, w * (1 - k), h)]
    : [...treemap(a, x, y, w, h * k), ...treemap(b, x, y + h * k, w, h * (1 - k))];
}

export function TreemapCard({ s, ready }: { s: Summary; ready: boolean }) {
  const navigate = useNavigate();
  const W = 560, H = 300;
  const byKey = Object.fromEntries(s.departments.map((d) => [d.department, d]));
  const rects = treemap([...s.departments].sort((a, b) => b.headcount - a.headcount).map((d) => ({ key: d.department, value: d.headcount })), 0, 0, W, H);
  const scores = s.departments.map((d) => d.score);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  /** Band hue, shaded from the lowest to the highest department so small gaps stay visible. */
  const shade = (d: (typeof s.departments)[number]) => `color-mix(in oklab, ${BAND_VAR[d.band]} ${Math.round(28 + 62 * (hi === lo ? 0.5 : (d.score - lo) / (hi - lo)))}%, var(--card))`;
  const fit = (t: string, w: number) => {
    const max = Math.floor((w - 16) / 6.1);
    return max < 3 ? null : t.length <= max ? t : `${t.slice(0, max - 1)}…`;
  };
  return (
    <Widget title="Risk by department" ready={ready} className="lg:col-span-7">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Departments sized by headcount, shaded by score">
        {rects.map((r) => {
          const d = byKey[r.key]!;
          const go = () => navigate({ to: "/vcro/people", search: { dept: d.department } });
          const name = fit(d.department, r.w);
          const full = `${d.score} · ${fmt(d.headcount)} people`;
          const line2 = full.length * 6.1 <= r.w - 16 ? full : String(d.score);
          return (
            <g key={r.key} role="button" tabIndex={0} aria-label={`${d.department}, score ${d.score}, ${d.headcount} people`} className="cursor-pointer outline-none" onClick={go} onKeyDown={(e) => e.key === "Enter" && go()}>
              <title>{`${d.department}: score ${d.score} (${d.band}), ${fmt(d.headcount)} people`}</title>
              <rect x={r.x + 1.5} y={r.y + 1.5} width={Math.max(0, r.w - 3)} height={Math.max(0, r.h - 3)} rx={5} fill={shade(d)} stroke={BAND_VAR[d.band]} strokeOpacity={0.45} className="transition-opacity hover:opacity-80" />
              {r.h > 34 && name && r.w > 40 && (
                <>
                  <text x={r.x + 9} y={r.y + 19} fontSize={11} fontWeight={600} className="fill-foreground">{name}</text>
                  {line2 && <text x={r.x + 9} y={r.y + 33} fontSize={11} className="fill-foreground/70">{line2}</text>}
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Colour is the band; darker means a higher score, from {lo} to {hi}.</span>
        <span className="ml-auto">Area is headcount. Click a block to see its people.</span>
      </div>
    </Widget>
  );
}

export function ConcentrationCard({ s, ready }: { s: Summary; ready: boolean }) {
  return (
    <Widget title="Risk concentration" ready={ready} className="flex flex-col lg:col-span-4" contentClassName="flex flex-1 flex-col">
      <p className="text-sm"><span className="font-semibold">The riskiest {s.concentration.people}% of people carry {s.concentration.risk}% of the risk</span></p>
      <p className="mt-0.5 text-xs text-muted-foreground">{fmt(s.concentration.count)} people. Risk here is score above the Low band.</p>
      <div className="mt-2 min-h-52 flex-1">
        <ResponsiveContainer>
          <LineChart data={s.pareto} margin={{ top: 8, right: 12, left: 4, bottom: 16 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="people" type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" label={{ value: "People, riskiest first", position: "insideBottom", offset: -8, ...AXIS }} />
            <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" width={44} label={{ value: "Share of risk", angle: -90, position: "insideLeft", offset: 10, ...AXIS }} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <ReferenceLine x={s.concentration.people} stroke="var(--band-high)" strokeDasharray="3 3" />
            <Line dataKey="risk" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <RTooltip content={({ active, payload }) => {
              const d = payload?.[0]?.payload as { people: number; risk: number } | undefined;
              return active && d ? <ChartTip>The riskiest {d.people}% carry {d.risk}% of risk</ChartTip> : null;
            }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Button asChild variant="outline" size="sm" className="mt-3 self-start"><Link to="/vcro/watchlists" search={{ group: "top-risk" }}><Users className="size-4" />Open the top 10% watchlist</Link></Button>
    </Widget>
  );
}

type ActionRow = Action & { status: "Recommended" | "Queued" | "Dismissed"; at: string | null };

export function ActionsCard({ ready }: { ready: boolean }) {
  const signals = useSignals();
  const settings = useSettings();
  const runs = useRuns();
  const navigate = useNavigate();
  const base = useMemo(() => (ready ? recommendedActions(signals, settings.automation) : []), [ready, signals, settings.automation]);
  const rows: ActionRow[] = base.map((a) => { const r = runs.find((x) => x.key === a.id); return { ...a, status: r?.status ?? "Recommended", at: r?.at ?? null }; });
  const run = (r: ActionRow) => { queueRun(r.id, r.workflow, r.target, r.people); toast.success(`${r.workflow} queued for ${fmt(r.people)} people`, { description: "Sent to Workflows. Status stays here until it completes." }); };
  const cols: Column<ActionRow>[] = [
    { id: "rank", header: "#", cell: (r) => <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{r.rank}</span>, sort: (r) => -r.rank },
    { id: "action", header: "Action", cell: (r) => <div className="min-w-0"><div className="whitespace-nowrap font-medium">{r.action}</div><div className="whitespace-nowrap text-xs text-muted-foreground">{r.target} · {fmt(r.people)} people</div></div>, sort: (r) => r.action },
    { id: "org", header: "Expected drop", cell: (r) => <div className="whitespace-nowrap"><DeltaBadge value={-r.perPerson} /><span className="ml-1.5 text-xs text-muted-foreground">per person</span><div className="mt-0.5 text-xs tabular-nums text-muted-foreground">Org score -{r.orgDrop.toFixed(2)}</div></div>, sort: (r) => r.orgDrop },
    { id: "mode", header: "Runs", cell: (r) => <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${r.mode === "Automatic" ? "border-success/30 bg-success/10 text-success" : "text-muted-foreground"}`}>{r.mode}</span>, sort: (r) => r.mode },
    { id: "status", header: "Status", cell: (r) => r.status === "Queued" ? <div><StatusBadge on onText="Queued" /><div className="mt-0.5 text-xs text-muted-foreground">{formatStamp(r.at!)}</div></div> : <span className="inline-flex rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{r.status}</span>, sort: (r) => r.status },
  ];
  return (
    <Widget title="Recommended actions, ranked by expected impact" ready={ready} className="lg:col-span-8">
      <DataTable rows={rows} columns={cols} getId={(r) => r.id} search={(r) => `${r.action} ${r.target} ${r.workflow}`} searchPlaceholder="Search actions"
        filters={[{ id: "status", label: "Status", options: ["Recommended", "Queued", "Dismissed"], match: (r, v) => r.status === v }, { id: "mode", label: "Runs", options: ["Automatic", "Needs approval"], match: (r, v) => r.mode === v }]}
        defaultSort={{ id: "org", dir: "desc" }} pageSizeDefault={10}
        exportAs={{ name: "vcro-recommended-actions", header: ["Rank", "Action", "Workflow", "Target group", "People", "Expected drop per person", "Org score drop", "Runs", "Status"], row: (r) => [r.rank, r.action, r.workflow, r.target, r.people, r.perPerson, r.orgDrop, r.mode, r.status] }}
        rowMenu={(r) => (
          <>
            {r.status !== "Queued" && <DropdownMenuItem onSelect={() => run(r)}><Play className="size-4" />{r.mode === "Automatic" ? "Run now" : "Approve and run"}</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => (r.watchlist ? navigate({ to: "/vcro/watchlists", search: { group: r.watchlist } }) : r.dept ? navigate({ to: "/vcro/people", search: { dept: r.dept } }) : navigate({ to: "/vcro/people", search: { channel: "QR" } }))}><Users className="size-4" />View the {fmt(r.people)} people</DropdownMenuItem>
            {r.status === "Recommended"
              ? <DropdownMenuItem onSelect={() => dismissRun(r.id, r.workflow, r.target, r.people)}><X className="size-4" />Dismiss</DropdownMenuItem>
              : <DropdownMenuItem onSelect={() => clearRun(r.id)}><RotateCcw className="size-4" />{r.status === "Queued" ? "Cancel request" : "Restore"}</DropdownMenuItem>}
          </>
        )} />
    </Widget>
  );
}

const TILE_TO: Record<string, string> = { Behaviour: "What people do", Attitude: "How people feel about security", Exposure: "How targeted and visible people are", Privilege: "What people can reach", Reporting: "How people report threats", "AI identities": "AI agents people own" };

export function SignalsCard({ ready, cov }: { ready: boolean; cov: ReturnType<typeof import("@/lib/api").signalCoverage> }) {
  const sig = useSignals();
  const live = cov.sources.filter((x) => x.on);
  const next = ready ? bestNextSources(sig) : [];
  return (
    <Widget title="Signals feeding the score" ready={ready} className="flex flex-1 flex-col" contentClassName="flex flex-1 flex-col"
      action={<Button asChild variant="outline" size="sm"><Link to="/vcro/signals">Manage signals</Link></Button>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cov.pillars.map((p) => (
          <div key={p.pillar} className="rounded-xl border bg-muted/40 p-3" title={p.from.length ? `From ${p.from.join(", ")}` : undefined}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{p.pillar}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{p.active}/{p.total}</span>
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums">{p.coverage}%</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${p.coverage === 100 ? "bg-success" : p.coverage >= 70 ? "bg-foreground" : "bg-band-high"}`} style={{ width: `${p.coverage}%` }} />
            </div>
            <div className="mt-2 text-[11px] leading-snug text-muted-foreground">
              <span className="block text-foreground/80">{TILE_TO[p.pillar]}</span>
              {p.from.length ? <span className="block truncate">From {p.from.slice(0, 2).join(", ")}{p.from.length > 2 && ` +${p.from.length - 2}`}</span>
                : <Link to="/vcro/signals" search={{ tab: "integrations" }} className="font-medium text-foreground underline underline-offset-2">Connect a source</Link>}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Percentages show how much of each part of the model has live data. Attitude is part of Behaviour, shown on its own because it comes from check-in questions, not events.</p>

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 text-xs">
          <span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{live.length} of {cov.sources.length} sources connected</span> · {fmt(cov.events30d)} events in 30 days</span>
          {next.length > 0 && <Link to="/vcro/signals" search={{ tab: "integrations" }} className="font-medium underline underline-offset-2">See all {next.length} you can add</Link>}
        </div>
        {next.length > 0 ? (
          <ul className="mt-2 divide-y rounded-xl border">
            {next.slice(0, 3).map((n) => (
              <li key={n.id}>
                <Link to="/vcro/signals/$id" params={{ id: n.id }} className="group flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{n.name}</span><span className="block text-xs text-muted-foreground">Adds {n.signals} {n.signals === 1 ? "signal" : "signals"}</span></span>
                  <span className="shrink-0 rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-success">+{n.gain}% confidence</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium">Connect<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 rounded-xl border bg-success/5 p-3 text-sm text-success">Every source is connected. The score has full data behind it.</p>}
      </div>
    </Widget>
  );
}

export function WeakestSignalsCard({ ready, items, className }: { ready: boolean; items: ReturnType<typeof import("@/lib/api").weakestSignals>; className?: string }) {
  const top = items.slice(0, 6);
  return (
    <Widget title="Weakest signals" ready={ready} className={className}
      action={<span className="text-xs text-muted-foreground">Ranked by effect on the score</span>}>
      <ol className="space-y-3">
        {top.map((t, i) => (
          <li key={t.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{t.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.category}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${t.avg}%`, background: BAND_VAR[bandFor(t.avg)] }} />
              </div>
            </div>
            <span className="w-20 text-right text-xs leading-tight tabular-nums"><span className="block font-semibold">{t.avg} of 100</span><span className="block text-muted-foreground">{fmt(t.atRisk)} at 60+</span></span>
          </li>
        ))}
      </ol>
    </Widget>
  );
}

export function HeatmapCard({ ready, rows, className }: { ready: boolean; rows: ReturnType<typeof import("@/lib/api").deptHeatmap>; className?: string }) {
  const navigate = useNavigate();
  const all = rows[0]?.cells.map((c) => c.category) ?? [];
  const live = all.filter((c) => rows.some((r) => r.cells.find((x) => x.category === c)?.value != null));
  const off = all.filter((c) => !live.includes(c));
  return (
    <Widget title="Risk heatmap" ready={ready} className={className}
      action={<span className="text-xs text-muted-foreground">Department × signal category, 0 to 100</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-36" />
              {live.map((c) => <th key={c} className="h-16 px-1 align-bottom font-medium text-muted-foreground"><span className="block leading-tight">{c}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.department}>
                <th className="pr-2 text-left font-medium">
                  <button type="button" className="hover:underline" onClick={() => navigate({ to: "/vcro/people", search: { dept: r.department } })}>{r.department}</button>
                </th>
                {r.cells.filter((c) => live.includes(c.category)).map((c) => (
                  <td key={c.category} title={`${r.department} · ${c.category}: ${c.value ?? "no data"}`}
                    className="h-9 rounded-md text-center font-medium tabular-nums transition-transform hover:scale-105"
                    style={c.value === null ? undefined : { background: heat(c.value) }}>
                    {c.value === null ? <span className="text-muted-foreground">·</span> : c.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span>0</span>
          <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${heat(5)}, ${heat(30)}, ${heat(50)}, ${heat(70)}, ${heat(95)})` }} />
          <span>100, higher is riskier</span></span>
        {off.length > 0 && <span className="ml-auto">{off.join(" and ")} {off.length === 1 ? "appears" : "appear"} once a source is connected. <Link to="/vcro/signals" search={{ tab: "integrations" }} className="font-medium text-foreground underline underline-offset-2">Add a source</Link></span>}
      </div>
    </Widget>
  );
}

export function RiskSpreadingCard({ ready, spreaders, managers, className }: { ready: boolean; spreaders: ReturnType<typeof import("@/lib/api").riskSpreaders>; managers: ReturnType<typeof import("@/lib/api").managerInvolvement>; className?: string }) {
  const { privacy } = usePrefs();
  return (
    <Widget title="Risk spreading" ready={ready} className={className} empty={!spreaders.length && !managers.length && { text: "No High or Critical people", action: null }}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">High-risk people and the team around them</div>
          {!spreaders.length && <p className="py-4 text-sm text-muted-foreground">No High or Critical people.</p>}
          <ul className="divide-y">
            {spreaders.map((p) => (
              <li key={p.id}>
                <Link to="/vcro/people/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{privacy ? pseudonym(p.id) : p.name}</span><span className="block truncate text-xs text-muted-foreground">{p.role}, {p.department}</span></span>
                  <span className="shrink-0 text-right text-xs tabular-nums"><span className="block font-semibold">{p.peersAtRisk} of {p.peers} teammates</span><span className="text-muted-foreground">at Elevated or above</span></span>
                  <BandBadge band={p.band} score={p.score} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Manager involvement against real incidents, lowest first</div>
          <ul className="space-y-3">
            {managers.slice(0, 6).map((m) => (
              <li key={m.department} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-xs">
                <Link to="/vcro/people" search={{ dept: m.department, level: "Manager" }} className="truncate font-medium hover:underline">{m.department}<span className="block font-normal text-muted-foreground">{m.managers} managers</span></Link>
                <span className="space-y-1">
                  <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground" style={{ width: `${m.involvement}%` }} /></span><span className="w-28 shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">Involvement {m.involvement}</span></span>
                  <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-band-high" style={{ width: `${m.incidents ?? 0}%` }} /></span><span className="w-28 shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">{m.incidents === null ? "Incidents: no data" : `Incidents ${m.incidents}`}</span></span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Involvement is how well a department's managers do on their own training and policy signals, 0 to 100.</p>
        </div>
      </div>
    </Widget>
  );
}
