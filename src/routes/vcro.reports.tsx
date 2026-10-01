import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Building2, Download, FileSpreadsheet, FileText, Presentation, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Widget } from "@/features/shared/widget";
import { InfoTip } from "@/features/shared/info";
import { useReady } from "@/features/shared/prefs";
import { addReport, DEPARTMENTS, fmt, formatMoney, formatStamp, getPeople, MONTHS, orgSummary, pct, PREV_MONTH, pseudonym, removeReport, trends, useReports, useSettings, useSignals } from "@/lib/api";
import { buildReport, type TemplateId } from "@/lib/reports";
import { download, fileDate, toCsv } from "@/lib/export";
import { bandFor } from "@/lib/scoring";
import { Area, AreaChart, Brush, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/vcro/reports")({
  head: () => ({
    meta: [
      { title: "Reports | HumanFirewall vCRO" },
      { name: "description", content: "Board packs, department reports and audit evidence for human risk." },
      { property: "og:title", content: "Reports | HumanFirewall vCRO" },
      { property: "og:description", content: "Board packs, department reports and audit evidence for human risk." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

const TEMPLATES: { id: TemplateId; name: string; icon: typeof Presentation; desc: string; audience: string; format: "Print-ready page" | "CSV" }[] = [
  { id: "board", name: "Board pack", icon: Presentation, desc: "Score, key figures, 12 month trend, what moved, departments and top actions.", audience: "Board and CXOs", format: "Print-ready page" },
  { id: "monthly", name: "Monthly risk summary", icon: BarChart3, desc: "Change since last month, biggest movers and weakest signals.", audience: "CISO and security team", format: "Print-ready page" },
  { id: "dept", name: "Department report", icon: Building2, desc: "Every department with score, drivers and awareness measures.", audience: "Department heads", format: "Print-ready page" },
  { id: "people", name: "High-risk people", icon: Users, desc: "Everyone in High or Critical with score, change and weakest signal.", audience: "Security team", format: "CSV" },
  { id: "audit", name: "Audit evidence", icon: ShieldCheck, desc: "Per person: simulations, failures, reports, training and policy status.", audience: "Compliance and GRC", format: "CSV" },
  { id: "signals", name: "Signal coverage", icon: FileText, desc: "Every source and signal with status, weight and last sync.", audience: "Security operations", format: "CSV" },
];
const BANDS = ["Low", "Guarded", "Elevated", "High", "Critical"] as const;
const COLORS = ["var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-2)", "var(--band-guarded)"];
const TIP = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

function ReportsPage() {
  const ready = useReady();
  const settings = useSettings();
  const sig = useSignals();
  const runs = useReports();
  const s = orgSummary(sig);
  const [period, setPeriod] = useState("12");
  const [dept, setDept] = useState("all");
  const [band, setBand] = useState("all");
  const [compare, setCompare] = useState<string[]>(["Finance", "Executive Office", "IT"]);
  const n = Number(period);
  const people = getPeople(sig);
  const filtered = dept !== "all" || band !== "all";
  const poolIdx: number[] = [];
  people.forEach((p, i) => { if ((dept === "all" || p.department === dept) && (band === "all" || p.band === band)) poolIdx.push(i); });
  const months = MONTHS.map((_, i) => i).slice(12 - n);

  let lineData: Record<string, string | number | null>[] = [];
  let bandData: Record<string, string | number>[] = [];
  if (ready) {
    const t = trends(sig);
    const deptIdx = Object.fromEntries(compare.map((d) => [d, people.flatMap((p, i) => (p.department === d ? [i] : []))]));
    lineData = months.map((k) => ({
      month: MONTHS[k]!, Organisation: t.org[k]!.score, ...(filtered ? { Selection: t.avg(poolIdx, k) } : {}),
      ...Object.fromEntries(compare.map((d) => [d, t.avg(deptIdx[d]!, k)])),
    }));
    bandData = months.map((k) => {
      const c: Record<string, string | number> = { month: MONTHS[k]!, Low: 0, Guarded: 0, Elevated: 0, High: 0, Critical: 0 };
      for (const i of poolIdx) { const v = t.matrix[i * 12 + k]!; if (v >= 0) { const b = bandFor(v); c[b] = (c[b] as number) + 1; } }
      return c;
    });
  }
  const scores = lineData.flatMap((r) => Object.entries(r).filter(([k, v]) => k !== "month" && typeof v === "number").map(([, v]) => v as number));
  const yDomain: [number, number] = scores.length ? [Math.max(0, Math.floor((Math.min(...scores) - 5) / 10) * 10), Math.min(100, Math.ceil((Math.max(...scores) + 5) / 10) * 10)] : [0, 100];

  const exportCsv = () => {
    const pool = poolIdx.map((i) => people[i]!);
    download(`vcro-selection-${fileDate()}.csv`, "text/csv", toCsv([
      ["Person", "Department", "Role", "Score", "Band", `Change since ${PREV_MONTH}`],
      ...pool.map((p) => [settings.privacy ? pseudonym(p.id) : p.name, p.department, p.role, p.score, p.band, p.change]),
    ]));
  };
  const generate = (t: (typeof TEMPLATES)[number]) => {
    const f = buildReport(t.id, sig, settings);
    addReport({ template: t.id, name: t.name, score: s.score, ...f });
    download(f.filename, f.mime, f.content);
    toast.success(`${t.name} downloaded`, { description: t.format === "CSV" ? f.filename : "Open the file and print to save it as a PDF." });
  };
  const glance: { k: string; v: string; sub: string; info?: string }[] = [
    { k: "Score", v: String(s.score), sub: `${s.band} · ${s.change === 0 ? "no change" : `${s.change > 0 ? "+" : ""}${s.change} pts`} since ${PREV_MONTH}` },
    { k: "High or Critical", v: fmt(s.highCount), sub: `${pct(s.highShare)} of ${fmt(s.total)} people` },
    { k: "Report rate", v: pct(s.reportRate), sub: `${pct(s.failRate)} of simulations failed` },
    settings.costPerIncident
      ? { k: "Exposure estimate", v: formatMoney(s.expectedIncidents * settings.costPerIncident, settings.currency), sub: `${s.expectedIncidents.toFixed(1)} expected incidents`, info: "Exposure estimate" }
      : { k: "Repeat clickers", v: fmt(s.repeatCount), sub: "2 or more fails in 180 days" },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Reports" subtitle="Share human risk with every audience" />
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">This month at a glance</div>
          {!settings.costPerIncident && <Link to="/vcro/settings" className="text-xs text-muted-foreground underline-offset-2 hover:underline">Add a cost per incident to show an exposure estimate</Link>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          {glance.map((g) => (
            <div key={g.k} className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{g.k}{g.info && <InfoTip label={g.info} />}</div>
              <div className="truncate text-2xl font-bold tabular-nums">{ready ? g.v : "\u00a0"}</div>
              <div className="truncate text-xs text-muted-foreground">{ready ? g.sub : "\u00a0"}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
        <ToggleGroup type="single" variant="outline" size="sm" value={period} onValueChange={(v) => v && setPeriod(v)}>
          <ToggleGroupItem value="3">3 months</ToggleGroupItem><ToggleGroupItem value="6">6 months</ToggleGroupItem><ToggleGroupItem value="12">12 months</ToggleGroupItem>
        </ToggleGroup>
        <Select value={dept} onValueChange={setDept}><SelectTrigger className="w-44" aria-label="Department"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
        <Select value={band} onValueChange={setBand}><SelectTrigger className="w-36" aria-label="Band"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All bands</SelectItem>{BANDS.map((b) => <SelectItem key={b} value={b}>{b} today</SelectItem>)}</SelectContent></Select>
        <span className="text-xs tabular-nums text-muted-foreground">{fmt(poolIdx.length)} people in selection</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv} disabled={!poolIdx.length}><Download className="size-4" />Export selection as CSV</Button>
      </div>

      <Widget title="Score over time" ready={ready} action={
        <ToggleGroup type="multiple" variant="outline" size="sm" value={compare} onValueChange={(v) => setCompare(v.slice(-5))} className="flex-wrap" aria-label="Departments to compare, up to 5">
          {DEPARTMENTS.map((d) => <ToggleGroupItem key={d} value={d} className="text-xs">{d}</ToggleGroupItem>)}
        </ToggleGroup>}>
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={lineData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={yDomain} allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={TIP} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="Organisation" stroke="var(--foreground)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              {filtered && <Line dataKey="Selection" stroke="var(--band-critical)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />}
              {compare.map((d, i) => <Line key={d} dataKey={d} stroke={COLORS[i % 5]} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />)}
              {n > 3 && <Brush dataKey="month" height={22} stroke="var(--muted-foreground)" fill="var(--muted)" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Axis shows {yDomain[0]} to {yDomain[1]}. Pick up to 5 departments to compare. {filtered ? "The dashed line is your filtered selection." : "Set a department or band filter to add your selection as a dashed line."}</p>
      </Widget>

      <Widget title="People by band over time" ready={ready} empty={ready && !poolIdx.length && { text: "No people match these filters", action: <Button variant="outline" size="sm" onClick={() => { setDept("all"); setBand("all"); }}>Clear filters</Button> }}>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={bandData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={TIP} formatter={(v) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {BANDS.map((b) => <Area key={b} dataKey={b} stackId="1" stroke={`var(--band-${b.toLowerCase()})`} fill={`var(--band-${b.toLowerCase()})`} fillOpacity={0.55} isAnimationActive={false} />)}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <h2 className="pt-2 text-sm font-semibold">Report templates</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => (
          <div key={t.id} className="flex flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/20">
            <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted"><t.icon className="size-4" /></span><div className="min-w-0"><div className="truncate text-sm font-semibold">{t.name}</div><div className="text-xs text-muted-foreground">{t.audience}</div></div></div>
            <p className="mt-3 flex-1 text-sm text-muted-foreground">{t.desc}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => generate(t)} disabled={!ready}><Download className="size-4" />Generate</Button>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{t.format === "CSV" ? <FileSpreadsheet className="size-3.5" /> : <FileText className="size-3.5" />}{t.format}</span>
            </div>
          </div>
        ))}
      </div>
      <Widget title="Generated reports" ready={ready} empty={!runs.length && { text: "No reports generated yet. Generate one above and it is kept here, as it was at that moment.", action: null }}>
        <div className="divide-y">
          {runs.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="truncate text-xs text-muted-foreground">{formatStamp(r.at)} · organisation score {r.score} · {r.filename}</div></div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => download(r.filename, r.mime, r.content)}><Download className="size-4" />Download</Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete ${r.name}`} onClick={() => removeReport(r.id)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </Widget>
    </div>
  );
}
