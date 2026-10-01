import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ChevronDown, Download, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, Widget } from "@/features/shared/widget";
import { BAND_VAR, BandBadge, DeltaBadge, StatusBadge } from "@/features/shared/band";
import { DataTable, type Column } from "@/features/shared/data-table";
import { PeopleTable } from "@/features/people/people-table";
import { useReady } from "@/features/shared/prefs";
import {
  DEPARTMENTS, ELEMENTS, MONTHS, PREV_MONTH, SOURCES, addReport, awarenessByDept, axisFor, deptStats, fmt, formatStamp, getPeople, orgSummary, pct, removeReport,
  scoreHistogram, signalCoverage, simsByDept, trends, useConnectors, useReports, useSettings, useSignals,
} from "@/lib/api";
import { buildReport, type TemplateId } from "@/lib/reports";
import { download } from "@/lib/export";
import { bandFor } from "@/lib/scoring";

const TABS = ["overview", "departments", "people", "simulations", "training", "signals", "downloads"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { overview: "Risk overview", departments: "Departments", people: "People", simulations: "Simulations", training: "Training and awareness", signals: "Signal coverage", downloads: "Downloads" };

export const Route = createFileRoute("/vcro/reports")({
  validateSearch: (s) => z.object({ tab: z.enum(TABS).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Reports | HumanFirewall vCRO" },
      { name: "description", content: "Human risk reports with charts and tables: overview, departments, people, simulations, training and signal coverage." },
      { property: "og:title", content: "Reports | HumanFirewall vCRO" },
      { property: "og:description", content: "Human risk reports with charts and tables: overview, departments, people, simulations, training and signal coverage." },
    ],
  }),
  component: ReportsPage,
});

const EXPORTS: { id: TemplateId; name: string; format: "Print-ready page" | "CSV"; for: string }[] = [
  { id: "board", name: "Board pack", format: "Print-ready page", for: "Board and CXOs" },
  { id: "monthly", name: "Monthly risk summary", format: "Print-ready page", for: "CISO and security team" },
  { id: "dept", name: "Department report", format: "Print-ready page", for: "Department heads" },
  { id: "people", name: "High-risk people", format: "CSV", for: "Security team" },
  { id: "audit", name: "Audit evidence", format: "CSV", for: "Compliance and GRC" },
  { id: "signals", name: "Signal coverage", format: "CSV", for: "Security operations" },
];
const BANDS = ["Low", "Guarded", "Elevated", "High", "Critical"] as const;
const LINE = ["var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-2)", "var(--band-guarded)"];
const AX = { fontSize: 11, fill: "var(--muted-foreground)" };
const TIP = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, cursor: { fill: "var(--muted)", opacity: 0.5 } };
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

function Kpis({ items, ready }: { items: [string, string, string][]; ready: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map(([k, v, sub]) => (
        <div key={k} className="rounded-2xl border bg-card p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</div>
          {ready ? <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{v}</div> : <Skeleton className="mt-2 h-8 w-20" />}
          <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
        </div>
      ))}
    </div>
  );
}
const Chart = ({ children, h = "h-72" }: { children: React.ReactElement; h?: string }) => <div className={h}><ResponsiveContainer>{children}</ResponsiveContainer></div>;

function ReportsPage() {
  const ready = useReady();
  const settings = useSettings();
  const sig = useSignals();
  const runs = useReports();
  const connectors = useConnectors();
  const { tab = "overview" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [period, setPeriod] = useState("12");
  const [compare, setCompare] = useState<string[]>(["Finance", "Executive Office", "IT"]);
  const s = orgSummary(sig);
  const months = MONTHS.map((_, i) => i).slice(12 - Number(period));

  const generate = (t: (typeof EXPORTS)[number]) => {
    const f = buildReport(t.id, sig, settings);
    addReport({ template: t.id, name: t.name, score: s.score, ...f });
    download(f.filename, f.mime, f.content);
    toast.success(`${t.name} downloaded`, { description: t.format === "CSV" ? f.filename : "Open the file and print to save it as a PDF." });
  };

  // ---------- data per report (only built for the open tab) ----------
  const people = getPeople(sig);
  const depts = [...deptStats(sig)].sort((a, b) => b.score - a.score);
  const aw = Object.fromEntries(awarenessByDept(sig).map((a) => [a.department, a]));

  type MonthRow = { month: string; score: number; change: number; campaign: string } & Record<(typeof BANDS)[number], number>;
  let monthRows: MonthRow[] = [];
  let compareRows: Record<string, string | number | null>[] = [];
  if (ready && (tab === "overview" || tab === "departments")) {
    const t = trends(sig);
    const idx = Object.fromEntries(compare.map((d) => [d, people.flatMap((p, i) => (p.department === d ? [i] : []))]));
    monthRows = months.map((k) => {
      const c = { Low: 0, Guarded: 0, Elevated: 0, High: 0, Critical: 0 };
      for (let i = 0; i < people.length; i++) { const v = t.matrix[i * 12 + k]!; if (v >= 0) c[bandFor(v) as (typeof BANDS)[number]]++; }
      return { month: MONTHS[k]!, score: t.org[k]!.value, change: k ? Math.round((t.org[k]!.value - t.org[k - 1]!.value) * 10) / 10 : 0, campaign: t.org[k]!.intervention ?? "", ...c };
    });
    compareRows = months.map((k) => ({ month: MONTHS[k]!, Organisation: t.org[k]!.value, ...Object.fromEntries(compare.map((d) => [d, t.avg(idx[d]!, k)])) }));
  }
  const scoreAxis = axisFor([...monthRows.map((r) => r.score), ...(settings.targetScore !== null ? [settings.targetScore] : [])]);
  const cmpAxis = axisFor(compareRows.flatMap((r) => Object.values(r).filter((v): v is number => typeof v === "number")));

  const monthCols: Column<MonthRow>[] = [
    { id: "month", header: "Month", cell: (r) => <span className="font-medium">{r.month}</span> },
    { id: "score", header: "Score", cell: (r) => <BandBadge band={bandFor(Math.round(r.score))} score={r.score} />, sort: (r) => r.score },
    { id: "change", header: "Change", cell: (r) => <DeltaBadge value={r.change} />, sort: (r) => r.change },
    ...BANDS.map((b): Column<MonthRow> => ({ id: b, header: b, cell: (r) => <span className="tabular-nums">{fmt(r[b])}</span>, sort: (r) => r[b] })),
    { id: "campaign", header: "Campaign", cell: (r) => r.campaign || <span className="text-muted-foreground">None</span> },
  ];
  type Dept = (typeof depts)[number];
  const deptCols: Column<Dept>[] = [
    { id: "department", header: "Department", cell: (d) => <span className="font-medium">{d.department}</span>, sort: (d) => d.department },
    { id: "score", header: "Score", cell: (d) => <BandBadge band={d.band} score={d.score} />, sort: (d) => d.score },
    { id: "change", header: `vs ${PREV_MONTH}`, cell: (d) => <DeltaBadge value={d.change} />, sort: (d) => d.change },
    { id: "people", header: "People", cell: (d) => <span className="tabular-nums">{fmt(d.headcount)}</span>, sort: (d) => d.headcount },
    { id: "high", header: "High or Critical", cell: (d) => <span className="tabular-nums">{fmt(d.high)}</span>, sort: (d) => d.high },
    { id: "likelihood", header: "Likelihood", cell: (d) => <span className="tabular-nums">{d.likelihood}</span>, sort: (d) => d.likelihood },
    { id: "privilege", header: "Privilege", cell: (d) => <span className="tabular-nums">{d.privilege}</span>, sort: (d) => d.privilege },
    { id: "driver", header: "Top driver", cell: (d) => d.topDriver, sort: (d) => d.topDriver },
  ];
  const sims = simsByDept(sig);
  type Sim = (typeof sims)[number];
  const simCols: Column<Sim>[] = [
    { id: "department", header: "Department", cell: (d) => <span className="font-medium">{d.department}</span>, sort: (d) => d.department },
    { id: "simulations", header: "Simulations sent", cell: (d) => <span className="tabular-nums">{fmt(d.simulations)}</span>, sort: (d) => d.simulations },
    { id: "fail", header: "Fell for", cell: (d) => <span className="tabular-nums">{d.failRate}%</span>, sort: (d) => d.failRate },
    { id: "report", header: "Reported", cell: (d) => <span className="tabular-nums">{d.reportRate}%</span>, sort: (d) => d.reportRate },
    { id: "repeat", header: "Repeat clickers", cell: (d) => <span className="tabular-nums">{fmt(d.repeat)}</span>, sort: (d) => d.repeat },
    { id: "impulsive", header: "Impulsive clickers", cell: (d) => <span className="tabular-nums">{fmt(d.impulsive)}</span>, sort: (d) => d.impulsive },
  ];
  const train = awarenessByDept(sig);
  type Train = (typeof train)[number];
  const trainCols: Column<Train>[] = [
    { id: "department", header: "Department", cell: (d) => <span className="font-medium">{d.department}</span>, sort: (d) => d.department },
    { id: "people", header: "People", cell: (d) => <span className="tabular-nums">{fmt(d.people)}</span>, sort: (d) => d.people },
    { id: "completion", header: "Training complete", cell: (d) => <span className="tabular-nums">{d.completion}%</span>, sort: (d) => d.completion },
    { id: "overdue", header: "People overdue", cell: (d) => <span className="tabular-nums">{fmt(d.overdue)}</span>, sort: (d) => d.overdue },
    { id: "jit", header: "JIT nudges opened", cell: (d) => <span className="tabular-nums">{d.jit}%</span>, sort: (d) => d.jit },
    { id: "policy", header: "Policy acknowledged", cell: (d) => <span className="tabular-nums">{d.policy}%</span>, sort: (d) => d.policy },
  ];
  const sources = SOURCES.filter((x) => x.direction !== "Action out").map((x) => {
    const els = ELEMENTS.filter((e) => e.sourceId === x.id);
    const on = sig.connected.has(x.id);
    return { ...x, on, product: x.kind === "Module" ? "HumanFirewall module" : on ? connectors[x.id]?.vendor ?? "" : "", signals: els.length, live: els.filter((e) => sig.active.has(e.id)).length, synced: on ? (connectors[x.id] ? formatStamp(connectors[x.id]!.lastSync) : x.lastSync) : "" };
  });
  type Src = (typeof sources)[number];
  const srcCols: Column<Src>[] = [
    { id: "name", header: "Source", cell: (x) => <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted-foreground">{x.product || "Not connected"}</div></div>, sort: (x) => x.name },
    { id: "type", header: "Type", cell: (x) => (x.kind === "Module" ? "Module" : x.category ?? "Integration"), sort: (x) => x.kind },
    { id: "status", header: "Status", cell: (x) => <StatusBadge on={x.on} offText="Not connected" />, sort: (x) => (x.on ? 1 : 0) },
    { id: "signals", header: "Signals in the score", cell: (x) => <span className="tabular-nums">{x.live} of {x.signals}</span>, sort: (x) => x.live },
    { id: "events", header: "Events in 30 days", cell: (x) => <span className="tabular-nums">{x.on ? fmt(x.events30d) : "0"}</span>, sort: (x) => (x.on ? x.events30d : 0) },
    { id: "sync", header: "Last sync", cell: (x) => x.synced || <span className="text-muted-foreground">None</span> },
  ];
  const cov = signalCoverage(sig);
  const hist = scoreHistogram(sig);
  const highByDept = depts.map((d) => ({ department: d.department, high: d.high })).sort((a, b) => b.high - a.high);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Reports" subtitle="Every report is a chart and the table behind it. Sort, filter and export any of them."
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button disabled={!ready}><Download className="size-4" />Export<ChevronDown className="size-3.5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Ready-made documents</DropdownMenuLabel>
              {EXPORTS.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => generate(t)} className="items-start gap-2.5">
                  {t.format === "CSV" ? <FileSpreadsheet className="mt-0.5 size-4" /> : <FileText className="mt-0.5 size-4" />}
                  <span><span className="block font-medium">{t.name}</span><span className="block text-xs text-muted-foreground">{t.format} · {t.for}</span></span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ search: { tab: "downloads" } })}>See past downloads</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        } />

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab } })} className="min-w-0">
        <TabsList className="flex h-auto w-full flex-wrap justify-start sm:inline-flex sm:w-fit">{TABS.map((t) => <TabsTrigger key={t} value={t}>{TAB_LABEL[t]}{t === "downloads" && runs.length > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{runs.length}</span>}</TabsTrigger>)}</TabsList>

        <TabsContent value="overview" className="mt-5 space-y-5">
          <Kpis ready={ready} items={[
            ["Organisation score", `${s.score}`, `${s.band} · ${s.change === 0 ? "no change" : `${signed(s.change)} pts`} since ${PREV_MONTH}`],
            ["High or Critical", fmt(s.highCount), `${pct(s.highShare)} of ${fmt(s.total)} people`],
            ["Report rate", pct(s.reportRate), `${pct(s.failRate)} of simulations failed`],
            ["Confidence", `${s.confidence}%`, `${s.activeCount} of ${s.totalElements} signals live`],
          ]} />
          <div className="flex justify-end">
            <ToggleGroup type="single" variant="outline" size="sm" value={period} onValueChange={(v) => v && setPeriod(v)} aria-label="Period">
              <ToggleGroupItem value="3">3 months</ToggleGroupItem><ToggleGroupItem value="6">6 months</ToggleGroupItem><ToggleGroupItem value="12">12 months</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Widget title="Score over time" ready={ready} info={`Organisation score each month, to one decimal. The axis is zoomed to ${scoreAxis.domain[0]} to ${scoreAxis.domain[1]}.${settings.targetScore !== null ? " The dashed line is your target." : " Set a target in Settings to draw a goal line."}`}>
              <Chart><LineChart data={monthRows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tick={AX} tickLine={false} axisLine={false} />
                <YAxis domain={scoreAxis.domain} ticks={scoreAxis.ticks} tick={AX} tickLine={false} axisLine={false} />
                <Tooltip {...TIP} />
                {settings.targetScore !== null && <ReferenceLine y={settings.targetScore} stroke="var(--success)" strokeDasharray="5 4" />}
                <Line type="monotone" dataKey="score" name="Score" stroke="var(--foreground)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--foreground)", strokeWidth: 0 }} isAnimationActive={false} />
              </LineChart></Chart>
            </Widget>
            <Widget title="People by band over time" ready={ready}>
              <Chart><BarChart data={monthRows} margin={{ top: 8, right: 12, left: -4, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tick={AX} tickLine={false} axisLine={false} />
                <YAxis tick={AX} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} />
                <Tooltip {...TIP} formatter={(v) => fmt(Number(v))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                {BANDS.map((b, i) => <Bar key={b} dataKey={b} stackId="b" fill={BAND_VAR[b]} isAnimationActive={false} radius={i === BANDS.length - 1 ? [3, 3, 0, 0] : 0} />)}
              </BarChart></Chart>
            </Widget>
          </div>
          <Card className="p-5 shadow-none">{ready ? <DataTable rows={[...monthRows].reverse()} columns={monthCols} getId={(r) => r.month} pageSizeDefault={25}
            exportAs={{ name: "vcro-risk-overview", header: ["Month", "Score", "Change", ...BANDS, "Campaign"], row: (r) => [r.month, r.score, r.change, ...BANDS.map((b) => r[b]), r.campaign] }} /> : <Skeleton className="h-72 w-full" />}</Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-5 space-y-5">
          <Kpis ready={ready} items={[
            ["Departments", `${depts.length}`, `${fmt(s.total)} people`],
            ["Highest risk", depts[0]!.department, `Score ${depts[0]!.score} · ${depts[0]!.band}`],
            ["Lowest risk", depts.at(-1)!.department, `Score ${depts.at(-1)!.score} · ${depts.at(-1)!.band}`],
            ["Rising", `${depts.filter((d) => d.change > 0).length}`, `departments up since ${PREV_MONTH}`],
          ]} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Widget title="Score by department" ready={ready}>
              <Chart h="h-80"><BarChart data={depts} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={AX} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="department" tick={AX} tickLine={false} axisLine={false} width={112} />
                <Tooltip {...TIP} />
                <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: "var(--foreground)" }}>
                  {depts.map((d) => <Cell key={d.department} fill={BAND_VAR[d.band]} />)}
                </Bar>
              </BarChart></Chart>
            </Widget>
            <Widget title="Compare over time" ready={ready} info="Pick up to five departments to compare with the organisation line."
              action={<ToggleGroup type="multiple" variant="outline" size="sm" value={compare} onValueChange={(v) => setCompare(v.slice(-5))} className="flex-wrap justify-end" aria-label="Departments to compare">
                {DEPARTMENTS.map((d) => <ToggleGroupItem key={d} value={d} className="h-7 px-2 text-[11px]">{d}</ToggleGroupItem>)}</ToggleGroup>}>
              <Chart h="h-64"><LineChart data={compareRows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tick={AX} tickLine={false} axisLine={false} />
                <YAxis domain={cmpAxis.domain} ticks={cmpAxis.ticks} tick={AX} tickLine={false} axisLine={false} />
                <Tooltip {...TIP} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Organisation" stroke="var(--foreground)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                {compare.map((d, i) => <Line key={d} type="monotone" dataKey={d} stroke={LINE[i % 5]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />)}
              </LineChart></Chart>
            </Widget>
          </div>
          <Card className="p-5 shadow-none">{ready ? <DataTable rows={depts} columns={deptCols} getId={(d) => d.department} defaultSort={{ id: "score", dir: "desc" }} search={(d) => d.department} searchPlaceholder="Search departments"
            exportAs={{ name: "vcro-departments", header: ["Department", "Score", "Band", `Change since ${PREV_MONTH}`, "People", "High or Critical", "Likelihood", "Privilege", "Top driver", "Training complete %", "Report rate %"], row: (d) => [d.department, d.score, d.band, d.change, d.headcount, d.high, d.likelihood, d.privilege, d.topDriver, aw[d.department]!.completion, aw[d.department]!.reportRate] }} /> : <Skeleton className="h-72 w-full" />}</Card>
        </TabsContent>

        <TabsContent value="people" className="mt-5 space-y-5">
          <Kpis ready={ready} items={[
            ["People scored", fmt(s.scored), `of ${fmt(s.total)} in the directory`],
            ["High or Critical", fmt(s.highCount), `${fmt(s.enteredHigh)} new since ${PREV_MONTH}`],
            ["Repeat clickers", fmt(s.repeatCount), "2 or more fails in 180 days"],
            ["Very attacked VIPs", fmt(s.vipAttacked), "Senior and heavily targeted"],
          ]} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Widget title="How scores are spread" ready={ready} info="People in each 10-point slice of the scale. A long tail to the right is where to focus.">
              <Chart><BarChart data={hist} margin={{ top: 16, right: 12, left: -4, bottom: 0 }} barCategoryGap="12%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="range" tick={{ ...AX, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={AX} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} />
                <Tooltip {...TIP} formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="people" name="People" radius={[4, 4, 0, 0]} isAnimationActive={false}>{hist.map((h) => <Cell key={h.range} fill={BAND_VAR[h.band]} />)}</Bar>
              </BarChart></Chart>
            </Widget>
            <Widget title="High or Critical by department" ready={ready}>
              <Chart><BarChart data={highByDept} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tick={AX} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="department" tick={AX} tickLine={false} axisLine={false} width={112} />
                <Tooltip {...TIP} />
                <Bar dataKey="high" name="People" fill="var(--band-high)" radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: "var(--foreground)" }} />
              </BarChart></Chart>
            </Widget>
          </div>
          <Card className="p-5 shadow-none">{ready ? <PeopleTable people={people} exportName="vcro-people-report" /> : <Skeleton className="h-72 w-full" />}</Card>
        </TabsContent>

        <TabsContent value="simulations" className="mt-5 space-y-5">
          <Kpis ready={ready} items={[
            ["Simulations sent", fmt(s.simEvents), "Across 5 channels, last 12 months"],
            ["Fell for", pct(s.failRate), "Clicked, scanned or entered data"],
            ["Reported", pct(s.reportRate), "Flagged to security"],
            ["Repeat clickers", fmt(s.repeatCount), "2 or more fails in 180 days"],
          ]} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Widget title="By channel" ready={ready}>
              <Chart><BarChart data={s.channels.map((c) => ({ channel: c.channel, "Fell for": Math.round(c.failRate * 100), Reported: Math.round(c.reportRate * 100) }))} margin={{ top: 16, right: 12, left: -12, bottom: 0 }} barGap={4} barCategoryGap="26%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="channel" tick={AX} tickLine={false} axisLine={false} />
                <YAxis unit="%" tick={AX} tickLine={false} axisLine={false} />
                <Tooltip {...TIP} formatter={(v) => `${v}%`} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Fell for" fill="var(--band-high)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Reported" fill="var(--band-low)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart></Chart>
            </Widget>
            <Widget title="By lure" ready={ready} info="Share of simulations people fell for, by the persuasion trick used.">
              <Chart><BarChart data={Object.entries(s.lures).map(([lure, v]) => ({ lure, "Fell for": v })).sort((a, b) => b["Fell for"] - a["Fell for"])} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" unit="%" tick={AX} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="lure" tick={AX} tickLine={false} axisLine={false} width={80} />
                <Tooltip {...TIP} formatter={(v) => `${v}%`} />
                <Bar dataKey="Fell for" fill="var(--band-high)" radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: "var(--foreground)", formatter: (v: number) => `${v}%` }} />
              </BarChart></Chart>
            </Widget>
          </div>
          <Card className="p-5 shadow-none">{ready ? <DataTable rows={sims} columns={simCols} getId={(d) => d.department} defaultSort={{ id: "fail", dir: "desc" }} search={(d) => d.department} searchPlaceholder="Search departments"
            exportAs={{ name: "vcro-simulations", header: ["Department", "People", "Simulations sent", "Fell for %", "Reported %", "Repeat clickers", "Impulsive clickers"], row: (d) => [d.department, d.people, d.simulations, d.failRate, d.reportRate, d.repeat, d.impulsive] }} /> : <Skeleton className="h-72 w-full" />}</Card>
        </TabsContent>

        <TabsContent value="training" className="mt-5 space-y-5">
          <Kpis ready={ready} items={[
            ["Training complete", `${Math.round(train.reduce((a, d) => a + d.completion * d.people, 0) / s.total)}%`, "Of people, weighted by department size"],
            ["People overdue", fmt(train.reduce((a, d) => a + d.overdue, 0)), "Oldest course 60 days or more late"],
            ["JIT nudges opened", `${Math.round(train.reduce((a, d) => a + d.jit * d.people, 0) / s.total)}%`, "Within 7 days"],
            ["Policy acknowledged", `${Math.round(train.reduce((a, d) => a + d.policy * d.people, 0) / s.total)}%`, "Of published policies"],
          ]} />
          <Widget title="Completion and acknowledgement by department" ready={ready}>
            <Chart><BarChart data={[...train].sort((a, b) => a.completion - b.completion)} margin={{ top: 16, right: 12, left: -12, bottom: 0 }} barGap={4} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="department" tick={{ ...AX, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
              <YAxis unit="%" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AX} tickLine={false} axisLine={false} />
              <Tooltip {...TIP} formatter={(v) => `${v}%`} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completion" name="Training complete" fill="var(--band-low)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="policy" name="Policy acknowledged" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart></Chart>
          </Widget>
          <Card className="p-5 shadow-none">{ready ? <DataTable rows={train} columns={trainCols} getId={(d) => d.department} defaultSort={{ id: "completion", dir: "asc" }} search={(d) => d.department} searchPlaceholder="Search departments"
            exportAs={{ name: "vcro-training", header: ["Department", "People", "Training complete %", "People overdue", "JIT nudges opened %", "Policy acknowledged %"], row: (d) => [d.department, d.people, d.completion, d.overdue, d.jit, d.policy] }} /> : <Skeleton className="h-72 w-full" />}</Card>
        </TabsContent>

        <TabsContent value="signals" className="mt-5 space-y-5">
          <Kpis ready={ready} items={[
            ["Confidence", `${s.confidence}%`, "Share of the model with live data"],
            ["Sources connected", `${sources.filter((x) => x.on).length} of ${sources.length}`, "Modules and integrations"],
            ["Signals in the score", `${s.activeCount} of ${s.totalElements}`, "Connected and switched on"],
            ["Events in 30 days", fmt(cov.events30d), "From connected sources"],
          ]} />
          <Widget title="Live data by part of the score" ready={ready} info="How much of each part of the model has live data behind it. This is coverage, not risk.">
            <Chart h="h-64"><BarChart data={cov.pillars.map((p) => ({ part: p.pillar, Coverage: p.coverage }))} margin={{ top: 20, right: 12, left: -12, bottom: 0 }} barCategoryGap="34%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="part" tick={AX} tickLine={false} axisLine={false} />
              <YAxis unit="%" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AX} tickLine={false} axisLine={false} />
              <Tooltip {...TIP} formatter={(v) => `${v}%`} />
              <Bar dataKey="Coverage" fill="var(--foreground)" radius={[4, 4, 0, 0]} isAnimationActive={false} label={{ position: "top", fontSize: 11, fill: "var(--foreground)", formatter: (v: number) => `${v}%` }} />
            </BarChart></Chart>
          </Widget>
          <Card className="p-5 shadow-none">{ready ? <DataTable rows={sources} columns={srcCols} getId={(x) => x.id} pageSizeDefault={25} search={(x) => `${x.name} ${x.product}`} searchPlaceholder="Search sources or products"
            filters={[{ id: "status", label: "Status", options: ["Connected", "Not connected"], match: (x, v) => (v === "Connected") === x.on }]}
            exportAs={{ name: "vcro-signal-coverage", header: ["Source", "Product", "Type", "Status", "Signals live", "Signals total", "Events in 30 days", "Last sync"], row: (x) => [x.name, x.product, x.kind, x.on ? "Connected" : "Not connected", x.live, x.signals, x.on ? x.events30d : 0, x.synced] }} /> : <Skeleton className="h-72 w-full" />}</Card>
        </TabsContent>

        <TabsContent value="downloads" className="mt-5">
          <Widget title="Past downloads" ready={ready} info="Each document is kept exactly as it was when generated, so you can download the same file again."
            empty={!runs.length && { text: "Nothing downloaded yet. Use Export, top right, to generate the board pack, a summary or a CSV.", action: null }}>
            <div className="divide-y">
              {runs.map((r) => (
                <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm">
                  <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="truncate text-xs text-muted-foreground">{formatStamp(r.at)} · organisation score {r.score} · {r.filename}</div></div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => download(r.filename, r.mime, r.content)}><Download className="size-4" />Download</Button>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete ${r.name}`} onClick={() => removeReport(r.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </Widget>
        </TabsContent>
      </Tabs>
    </div>
  );
}
