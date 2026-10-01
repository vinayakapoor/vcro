import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { ChevronDown, Info, Play, X } from "lucide-react";
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
  DEPARTMENTS, LURES, PREV_MONTH, deptLures, useSignals, pseudonym, recommendedActions, type Action, type Department, type orgSummary,
} from "@/lib/api";
import { bandFor, type Band } from "@/lib/scoring";

type Summary = ReturnType<typeof orgSummary>;
export const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };
const ON_BAND: Record<Band, string> = { Low: "#ffffff", Guarded: "#111111", Elevated: "#111111", High: "#111111", Critical: "#ffffff", "No score": "#111111" };

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

export function PillarMeters({ pillars }: { pillars: Record<"Behaviour" | "Exposure" | "Privilege", number> }) {
  return (
    <div className="space-y-2.5">
      {(Object.entries(pillars) as [string, number][]).map(([k, v]) => (
        <div key={k} className="grid grid-cols-[84px_1fr_32px] items-center gap-3 text-sm">
          <span>{k}</span>
          <span className="h-1.5 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${v}%`, background: BAND_VAR[bandFor(v)] }} /></span>
          <span className="text-right tabular-nums">{v}</span>
        </div>
      ))}
      <div className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-sm text-muted-foreground">
        <span>AI identities</span>
        <span className="h-1.5 rounded-full bg-muted" />
        <StatusBadge on={false} />
      </div>
    </div>
  );
}

export function RiskometerCard({ s, ready }: { s: Summary; ready: boolean }) {
  return (
    <Widget title="Riskometer" ready={ready} className="lg:col-span-5" empty={s.people.every((p) => p.score === null) && { text: "No scored people yet", action: <Button asChild variant="outline" size="sm"><Link to="/vcro/signals">Connect source</Link></Button> }}>
      <Gauge value={s.score} prev={s.prev} prevLabel={PREV_MONTH} confidence={s.confidence} />
      <div className="mt-5"><PillarMeters pillars={s.pillars} /></div>
      <div className="mt-4 border-t pt-3"><ConfidenceLine confidence={s.confidence} active={s.activeCount} total={s.totalElements} /></div>
      <div className="mt-4 rounded-xl border bg-muted/30 p-3">
        <div className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span>Last 12 months</span><span className="tabular-nums">{s.trend[0]?.score} to {s.trend[s.trend.length - 1]?.score}</span></div>
        <div className="mt-2 h-14">
          <ResponsiveContainer>
            <AreaChart data={s.trend} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
              <YAxis hide domain={["dataMin - 4", "dataMax + 4"]} />
              <Area dataKey="score" stroke="var(--foreground)" strokeWidth={1.5} fill="var(--foreground)" fillOpacity={0.06} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{s.trend[0]?.month}</span><span>{s.trend[s.trend.length - 1]?.month}</span></div>
      </div>
    </Widget>
  );
}

export function TrendCard({ s, ready }: { s: Summary; ready: boolean }) {
  const [bench, setBench] = useState(true);
  const mobile = useIsMobile();
  return (
    <Widget
      title="Risk trend" ready={ready} className="lg:col-span-8"
      action={
        <button type="button" onClick={() => setBench((b) => !b)} aria-pressed={bench}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${bench ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
          <span className="size-2 rounded-sm bg-muted-foreground/30" aria-hidden />Industry benchmark (sample)
        </button>
      }
    >
      <div className="h-64 lg:h-80">
        <ResponsiveContainer>
          <AreaChart data={s.trend} margin={{ top: 18, right: 12, left: 4, bottom: 16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} label={{ value: "Month", position: "insideBottom", offset: -8, ...AXIS }} />
            <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={44} label={{ value: "Score (0-100)", angle: -90, position: "insideLeft", offset: 10, ...AXIS }} />
            {bench && <Area dataKey="benchmark" stroke="none" fill="var(--muted-foreground)" fillOpacity={0.12} isAnimationActive={false} />}
            {s.trend.filter((t) => t.intervention).map((t) => (
              <ReferenceLine key={t.month} x={t.month} stroke="var(--muted-foreground)" strokeDasharray="3 3" {...(mobile ? {} : { label: { value: t.intervention!, position: "top" as const, ...AXIS, fontSize: 10 } })} />
            ))}
            <Area dataKey="score" stroke="var(--foreground)" strokeWidth={2} fill="var(--foreground)" fillOpacity={0.05} isAnimationActive={false} />
            <RTooltip content={({ active, payload }) => {
              const d = payload?.[0]?.payload as Summary["trend"][number] | undefined;
              if (!active || !d) return null;
              return (
                <ChartTip>
                  <div className="font-medium">{d.month}</div>
                  <div>Score {d.score} · {d.band}</div>
                  <div>Change {d.delta > 0 ? "+" : ""}{d.delta} pts</div>
                  {bench && <div>Benchmark {d.benchmark[0]}-{d.benchmark[1]}</div>}
                  {d.intervention && <div>{d.intervention}</div>}
                </ChartTip>
              );
            }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Widget>
  );
}

export function MoversCard({ s, ready }: { s: Summary; ready: boolean }) {
  const { privacy } = usePrefs();
  const depts = [...s.departments].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 6);
  const people = s.people.filter((p) => p.change !== null).sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!)).slice(0, 6);
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
                <span className="block truncate text-xs text-muted-foreground">{d.topDriver}</span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{d.prev} → {d.score}</span>
              <DeltaBadge value={d.change} />
            </Link>
          ))}
        </TabsContent>
        <TabsContent value="people" className="space-y-0.5">
          {people.map((p) => (
            <Link key={p.id} to="/vcro/people/$id" params={{ id: p.id }} className={row}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{privacy ? pseudonym(p.id) : p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.topDriver ?? "None"}</span>
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
const IMP: [number, number] = [0.8, 1.3];
const sx = (v: number) => MX.l + (v / 100) * (MX.w - MX.l - MX.r);
const sy = (v: number) => MX.t + (1 - (v - IMP[0]) / (IMP[1] - IMP[0])) * (MX.h - MX.t - MX.b);

export function MatrixCard({ s, ready }: { s: Summary; ready: boolean }) {
  const navigate = useNavigate();
  const { privacy } = usePrefs();
  const [mode, setMode] = useState<"dept" | "people">("dept");
  const [hover, setHover] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const top50 = useMemo(() => s.people.filter((p) => p.score !== null).sort((a, b) => b.score! - a.score!).slice(0, 50), [s.people]);
  const maxHc = Math.max(...s.departments.map((d) => d.headcount));
  const qx = sx(50), qy = sy(1.05);

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
            <text key={t as string} x={x as number} y={y as number} textAnchor={a as "start"} fontSize={10} className="fill-muted-foreground">{t}</text>
          ))}
          {[0, 25, 50, 75, 100].map((v) => <text key={v} x={sx(v)} y={MX.h - MX.b + 12} textAnchor="middle" fontSize={9} className="fill-muted-foreground">{v}</text>)}
          {[0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map((v) => <text key={v} x={MX.l - 6} y={sy(v) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground">{v.toFixed(1)}</text>)}
          <text x={(MX.l + MX.w - MX.r) / 2} y={MX.h - 4} textAnchor="middle" fontSize={10} className="fill-muted-foreground">Likelihood (0-100)</text>
          <text transform={`translate(10 ${(MX.t + MX.h - MX.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} className="fill-muted-foreground">Impact (x multiplier)</text>
          {mode === "dept" ? s.departments.map((d) => {
            const x = sx(d.likelihood), y = sy(Math.min(IMP[1], Math.max(IMP[0], d.impact)));
            return (
              <circle key={d.department} cx={x} cy={y} r={5 + Math.sqrt(d.headcount / maxHc) * 18} fill={BAND_VAR[d.band]} fillOpacity={0.75} stroke="var(--background)" strokeWidth={2}
                tabIndex={0} role="button" aria-label={`${d.department}, score ${d.score}`} className="cursor-pointer outline-none focus-visible:stroke-foreground"
                onMouseEnter={() => setHover({ x, y, lines: [d.department, `Score ${d.score} · ${d.band}`, `Likelihood ${d.likelihood} · Impact x${d.impact}`, `${d.headcount.toLocaleString("en-IN")} people`] })}
                onMouseLeave={() => setHover(null)}
                onClick={() => navigate({ to: "/vcro/people", search: { dept: d.department } })}
                onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/vcro/people", search: { dept: d.department } })} />
            );
          }) : top50.map((p) => {
            const x = sx(p.likelihood), y = sy(Math.min(IMP[1], Math.max(IMP[0], p.impact)));
            return (
              <circle key={p.id} cx={x} cy={y} r={4.5} fill={BAND_VAR[p.band]} fillOpacity={0.8} className="cursor-pointer"
                onMouseEnter={() => setHover({ x, y, lines: [privacy ? pseudonym(p.id) : p.name, `${p.department}`, `Score ${p.score} · ${p.band}`] })}
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
  return (
    <Widget title="Risk by department" ready={ready} className="lg:col-span-7">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Departments sized by headcount, coloured by band">
        {rects.map((r) => {
          const d = byKey[r.key]!;
          return (
            <g key={r.key} role="button" tabIndex={0} aria-label={`${d.department}, score ${d.score}, ${d.headcount} people`} className="cursor-pointer outline-none"
              onClick={() => navigate({ to: "/vcro/people", search: { dept: d.department } })}
              onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/vcro/people", search: { dept: d.department } })}>
              <title>{`${d.department}: score ${d.score} (${d.band}), ${d.headcount.toLocaleString("en-IN")} people`}</title>
              <rect x={r.x + 1} y={r.y + 1} width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)} rx={4} fill={BAND_VAR[d.band]} className="transition-opacity hover:opacity-85" />
              {r.w > 60 && r.h > 34 && (
                <>
                  <text x={r.x + 8} y={r.y + 18} fontSize={11} fontWeight={600} fill={ON_BAND[d.band]}>{d.department}</text>
                  <text x={r.x + 8} y={r.y + 32} fontSize={11} fill={ON_BAND[d.band]}>{d.score} · {d.headcount.toLocaleString("en-IN")} people</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(["Low", "Guarded", "Elevated", "High", "Critical"] as Band[]).map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: BAND_VAR[b] }} />{b}</span>
        ))}
        <span className="ml-auto">Area: headcount</span>
      </div>
    </Widget>
  );
}

export function ConcentrationCard({ s, ready }: { s: Summary; ready: boolean }) {
  const navigate = useNavigate();
  return (
    <Widget title="Risk concentration" ready={ready} className="lg:col-span-4">
      <p className="text-sm"><span className="font-semibold">{s.concentration.people}% of people carry {s.concentration.risk}% of risk</span></p>
      <div className="mt-2 h-52">
        <ResponsiveContainer>
          <LineChart data={s.pareto} margin={{ top: 8, right: 12, left: 4, bottom: 16 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="people" type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" label={{ value: "People (% of scored)", position: "insideBottom", offset: -8, ...AXIS }} />
            <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" width={44} label={{ value: "Cumulative risk", angle: -90, position: "insideLeft", offset: 10, ...AXIS }} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <ReferenceLine x={s.concentration.people} stroke="var(--band-high)" strokeDasharray="3 3" />
            <Line dataKey="risk" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <RTooltip content={({ active, payload }) => {
              const d = payload?.[0]?.payload as { people: number; risk: number } | undefined;
              return active && d ? <ChartTip>{d.people}% of people carry {d.risk}% of risk</ChartTip> : null;
            }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate({ to: "/vcro/watchlists", search: { group: "top-risk" } })}>Create watchlist</Button>
    </Widget>
  );
}

type ActionRow = Action & { status: "Recommended" | "Running" | "Dismissed" };

export function ActionsCard({ ready }: { ready: boolean }) {
  const signals = useSignals();
  const base = useMemo(() => recommendedActions(signals), [signals]);
  const [status, setStatus] = useState<Record<string, ActionRow["status"]>>({});
  const rows: ActionRow[] = base.map((a) => ({ ...a, status: status[a.id] ?? "Recommended" }));
  const set = (id: string, st: ActionRow["status"]) => setStatus((s) => ({ ...s, [id]: st }));
  const cols: Column<ActionRow>[] = [
    { id: "rank", header: "Rank", cell: (r) => <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{r.rank}</span>, sort: (r) => -(r.rank ?? 0) },
    { id: "action", header: "Action", cell: (r) => <span className="whitespace-nowrap font-medium">{r.action}</span>, sort: (r) => r.action },
    { id: "target", header: "Target group", cell: (r) => <span className="whitespace-nowrap">{r.target}</span>, sort: (r) => r.target },
    { id: "people", header: "People", cell: (r) => <span className="tabular-nums">{r.people}</span>, sort: (r) => r.people },
    { id: "impact", header: "Expected impact", cell: (r) => <DeltaBadge value={-r.impact} />, sort: (r) => r.impact },
    { id: "mode", header: "Runs", cell: (r) => <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${r.mode === "Automatic" ? "border-success/30 bg-success/10 text-success" : "text-muted-foreground"}`}>{r.mode}</span>, sort: (r) => r.mode },
    { id: "workflow", header: "Workflow", cell: (r) => <Link to="/$section" params={{ section: "workflows" }} className="underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>{r.workflow}</Link>, sort: (r) => r.workflow },
    { id: "status", header: "Status", cell: (r) => r.status === "Running" ? <StatusBadge on onText="Running" /> : <span className="inline-flex rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{r.status}</span>, sort: (r) => r.status },
  ];
  return (
    <Widget title="Recommended actions, ranked by expected impact" ready={ready} className="lg:col-span-8">
      <DataTable rows={rows} columns={cols} getId={(r) => r.id} search={(r) => `${r.action} ${r.target} ${r.workflow}`} searchPlaceholder="Search actions"
        filters={[{ id: "status", label: "Status", options: ["Recommended", "Running", "Dismissed"], match: (r, v) => r.status === v }, { id: "mode", label: "Runs", options: ["Automatic", "Needs approval"], match: (r, v) => r.mode === v }]}
        defaultSort={{ id: "impact", dir: "desc" }} pageSizeDefault={10}
        rowMenu={(r) => (
          <>
            <DropdownMenuItem onSelect={() => { set(r.id, "Running"); toast(`${r.workflow} started`); }}><Play className="size-4" />{r.mode === "Automatic" ? "Run workflow" : "Approve and run"}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => set(r.id, "Dismissed")}><X className="size-4" />Dismiss</DropdownMenuItem>
          </>
        )} />
    </Widget>
  );
}

export function SignalsCard({ ready, cov }: { ready: boolean; cov: ReturnType<typeof import("@/lib/api").signalCoverage> }) {
  const [open, setOpen] = useState(false);
  const live = cov.sources.filter((x) => x.on);
  const off = cov.sources.filter((x) => !x.on);
  const chip = (x: (typeof cov.sources)[number]) => (
    <span key={x.id} title={x.on ? `Last sync ${x.lastSync}` : "Not connected"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${x.on ? "bg-card" : "border-dashed text-muted-foreground"}`}>
      <span className={`size-1.5 rounded-full ${x.on ? "bg-success" : "bg-muted-foreground/40"}`} aria-hidden />{x.name}
    </span>
  );
  return (
    <Widget title="Signals feeding the score" ready={ready} className="flex-1"
      action={<Button asChild variant="outline" size="sm"><Link to="/vcro/signals">Manage signals</Link></Button>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cov.pillars.map((p) => (
          <div key={p.pillar} className="rounded-xl border bg-muted/40 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{p.pillar}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{p.active}/{p.total}</span>
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums">{p.coverage}%</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${p.coverage === 100 ? "bg-success" : p.coverage >= 70 ? "bg-foreground" : "bg-band-high"}`} style={{ width: `${p.coverage}%` }} />
            </div>
          </div>
        ))}
        <div className="flex flex-col justify-between rounded-xl border border-dashed p-3 text-muted-foreground">
          <span className="text-[10px] font-bold uppercase tracking-wider">AI identities</span>
          <span className="mt-1 text-sm">Not connected</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{live.length} of {cov.sources.length} sources live · {cov.events30d.toLocaleString("en-IN")} events in 30 days</span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {open ? "Hide sources" : `Show all ${cov.sources.length} sources`}<ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {off.length > 0 && !open && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Not connected</span>{off.map(chip)}
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">{live.map(chip)}</div>
          <div className="flex flex-wrap gap-1.5">{off.map(chip)}</div>
        </div>
      )}
    </Widget>
  );
}

export function WeakestSignalsCard({ ready, items, className }: { ready: boolean; items: ReturnType<typeof import("@/lib/api").weakestSignals>; className?: string }) {
  const top = items.slice(0, 6);
  const max = Math.max(1, ...top.map((t) => t.avg));
  return (
    <Widget title="Weakest signals" ready={ready} className={className}
      action={<span className="text-xs text-muted-foreground">All channels and sources</span>}>
      <ol className="space-y-2.5">
        {top.map((t, i) => (
          <li key={t.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{t.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.category}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(t.avg / max) * 100}%`, background: BAND_VAR[bandFor(t.avg)] }} />
              </div>
            </div>
            <span className="w-24 text-right text-xs tabular-nums"><span className="font-semibold">{t.avg}</span><span className="text-muted-foreground"> avg · {t.atRisk} at risk</span></span>
          </li>
        ))}
      </ol>
    </Widget>
  );
}

export function HeatmapCard({ ready, rows, className }: { ready: boolean; rows: ReturnType<typeof import("@/lib/api").deptHeatmap>; className?: string }) {
  const navigate = useNavigate();
  const cats = rows[0]?.cells.map((c) => c.category) ?? [];
  return (
    <Widget title="Risk heatmap" ready={ready} className={className}
      action={<span className="text-xs text-muted-foreground">Department × signal category, 0-100</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-36" />
              {cats.map((c) => <th key={c} className="h-16 px-1 align-bottom font-medium text-muted-foreground"><span className="block leading-tight">{c}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.department}>
                <th className="pr-2 text-left font-medium">
                  <button type="button" className="hover:underline" onClick={() => navigate({ to: "/vcro/people", search: { dept: r.department } })}>{r.department}</button>
                </th>
                {r.cells.map((c) => (
                  <td key={c.category} title={`${r.department} · ${c.category}: ${c.value ?? "Not connected"}`}
                    className="h-9 rounded-md text-center font-medium tabular-nums transition-transform hover:scale-105"
                    style={c.value === null ? undefined : { background: `color-mix(in oklab, ${BAND_VAR[bandFor(c.value)]} ${20 + c.value * 0.6}%, transparent)` }}>
                    {c.value === null ? <span className="text-muted-foreground">·</span> : c.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>0</span>
        <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${BAND_VAR.Low}, ${BAND_VAR.Guarded}, ${BAND_VAR.Elevated}, ${BAND_VAR.High}, ${BAND_VAR.Critical})` }} />
        <span>100</span><span className="ml-2">· Not connected</span>
      </div>
    </Widget>
  );
}

export function RiskSpreadingCard({ ready, spreaders, managers, className }: { ready: boolean; spreaders: ReturnType<typeof import("@/lib/api").riskSpreaders>; managers: ReturnType<typeof import("@/lib/api").managerInvolvement>; className?: string }) {
  const { privacy } = usePrefs();
  return (
    <Widget title="Risk spreading" ready={ready} className={className} empty={!spreaders.length && !managers.length && { text: "No High or Critical people", action: null }}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">High-risk people and the colleagues they work with</div>
          <ul className="divide-y">
            {spreaders.map((p) => (
              <li key={p.id}>
                <Link to="/vcro/people/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{privacy ? `Employee ${p.id.slice(1)}` : p.name}</span><span className="block truncate text-xs text-muted-foreground">{p.role}, {p.department}</span></span>
                  <span className="shrink-0 text-right text-xs tabular-nums"><span className="block font-semibold">{p.peers} colleagues</span><span className="text-muted-foreground">{p.peersAtRisk} at Elevated or above</span></span>
                  <span className="shrink-0 rounded-md bg-band-high/15 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{p.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Least involved managers against incidents</div>
          <ul className="space-y-2.5">
            {managers.slice(0, 6).map((m) => (
              <li key={m.department} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-xs">
                <span className="truncate font-medium">{m.department}</span>
                <span className="space-y-1">
                  <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground" style={{ width: `${m.involvement}%` }} /></span><span className="w-28 shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">Involvement {m.involvement}</span></span>
                  <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-band-high" style={{ width: `${m.incidents}%` }} /></span><span className="w-28 shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">Incidents {m.incidents}</span></span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Widget>
  );
}
