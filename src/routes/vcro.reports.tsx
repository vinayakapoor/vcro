import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Building2, Download, FileText, Presentation, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Widget } from "@/features/shared/widget";
import { usePrefs, useReady } from "@/features/shared/prefs";
import { DEPARTMENTS, formatMoney, getPeople, MONTHS, orgSummary, useSignals } from "@/lib/api";
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

const TEMPLATES = [
  { id: "board", name: "Board pack", icon: Presentation, desc: "Score, trend, financial exposure and top actions on 6 slides.", audience: "Board and CXOs" },
  { id: "monthly", name: "Monthly risk summary", icon: BarChart3, desc: "Change since last month, biggest movers and weakest signals.", audience: "CISO and security team" },
  { id: "dept", name: "Department report", icon: Building2, desc: "One page per department with score, drivers and awareness.", audience: "Department heads" },
  { id: "people", name: "High-risk people", icon: Users, desc: "High and Critical people with their next steps.", audience: "Security team" },
  { id: "audit", name: "Audit evidence", icon: ShieldCheck, desc: "Training, simulation and reporting records for auditors.", audience: "Compliance and GRC" },
  { id: "signals", name: "Signal coverage", icon: FileText, desc: "Connected sources, confidence and data gaps.", audience: "Security operations" },
];

type Run = { id: string; name: string; at: string; score: number };

function ReportsPage() {
  const ready = useReady();
  const { currency } = usePrefs();
  const sig = useSignals();
  const s = orgSummary(sig);
  const people = getPeople(sig);
  const [period, setPeriod] = useState("12");
  const [dept, setDept] = useState("all");
  const [band, setBand] = useState("all");
  const [compare, setCompare] = useState<string[]>(["Finance", "Executive Office", "IT"]);
  const n = Number(period);
  const pool = people.filter((p) => (dept === "all" || p.department === dept) && (band === "all" || p.band === band));
  const avgAt = (ps: typeof people, i: number) => { const v = ps.map((p) => p.history[i]).filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const idx = MONTHS.map((_, i) => i).slice(12 - n);
  const lineData = idx.map((i) => ({ month: MONTHS[i], Selection: avgAt(pool, i), Organisation: avgAt(people, i), ...Object.fromEntries(compare.map((d) => [d, avgAt(people.filter((p) => p.department === d), i)])) }));
  const bandData = idx.map((i) => { const c: Record<string, number | string> = { month: MONTHS[i]!, Low: 0, Guarded: 0, Elevated: 0, High: 0, Critical: 0 }; for (const p of pool) { const b = bandFor(p.history[i] ?? null); if (b !== "No score") c[b] = (c[b] as number) + 1; } return c; });
  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const exportCsv = () => {
    const rows = [["Name", "Department", "Score", "Band", "Change"], ...pool.map((p) => [p.name, p.department, String(p.score ?? ""), p.band, String(p.change ?? "")])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "vcro-filtered-report.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const [runs, setRuns] = useState<Run[]>([]);
  const generate = (t: (typeof TEMPLATES)[number]) => {
    setRuns((r) => [{ id: `${t.id}-${r.length}`, name: t.name, at: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }), score: s.score ?? 0 }, ...r]);
    toast.success(`${t.name} generated`);
  };
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Reports" subtitle="Share human risk with every audience" />
      <div className="rounded-2xl border bg-card p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">This month at a glance</div>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[["Score", `${s.score ?? "None"} · ${s.band}`], ["High or Critical", `${s.highCount} people`], ["Report-to-fail ratio", s.rtf === null ? "None" : s.rtf.toFixed(1)], ["Financial exposure", formatMoney(s.lossInr, currency)]].map(([k, v]) => (
            <div key={k} className="min-w-0"><div className="text-xs text-muted-foreground">{k}</div><div className="truncate text-xl font-bold tabular-nums">{v}</div></div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
        <ToggleGroup type="single" variant="outline" size="sm" value={period} onValueChange={(v) => v && setPeriod(v)}>
          <ToggleGroupItem value="3">3 months</ToggleGroupItem><ToggleGroupItem value="6">6 months</ToggleGroupItem><ToggleGroupItem value="12">12 months</ToggleGroupItem>
        </ToggleGroup>
        <Select value={dept} onValueChange={setDept}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
        <Select value={band} onValueChange={setBand}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All bands</SelectItem>{["Low", "Guarded", "Elevated", "High", "Critical"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
        <span className="text-xs text-muted-foreground">{pool.length} people in selection</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}><Download className="size-4" />Export filtered CSV</Button>
      </div>

      <Widget title="Score over time" ready={ready} action={
        <ToggleGroup type="multiple" variant="outline" size="sm" value={compare} onValueChange={(v) => setCompare(v.slice(0, 5))} className="flex-wrap">
          {DEPARTMENTS.map((d) => <ToggleGroupItem key={d} value={d} className="text-xs">{d}</ToggleGroupItem>)}
        </ToggleGroup>}>
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={lineData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="Organisation" stroke="var(--foreground)" strokeWidth={2.5} dot={false} />
              <Line dataKey="Selection" stroke="var(--band-critical)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              {compare.map((d, i) => <Line key={d} dataKey={d} stroke={COLORS[i % 5]} strokeWidth={1.5} dot={false} />)}
              {n > 3 && <Brush dataKey="month" height={22} stroke="var(--muted-foreground)" fill="var(--muted)" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <Widget title="People by band over time" ready={ready}>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={bandData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(["Low", "Guarded", "Elevated", "High", "Critical"] as const).map((b) => <Area key={b} dataKey={b} stackId="1" stroke={`var(--band-${b.toLowerCase()})`} fill={`var(--band-${b.toLowerCase()})`} fillOpacity={0.55} />)}
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
            <Button variant="outline" size="sm" className="mt-4 self-start" onClick={() => generate(t)}>Generate</Button>
          </div>
        ))}
      </div>
      <Widget title="Generated reports" ready={ready} empty={!runs.length && { text: "No reports generated yet", action: null }}>
        <div className="divide-y">
          {runs.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.at} · score {r.score}</div></div>
              <Button variant="ghost" size="sm" onClick={() => toast.success("Download started")}><Download className="size-4" />Download</Button>
            </div>
          ))}
        </div>
      </Widget>
    </div>
  );
}
