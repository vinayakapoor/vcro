import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, GraduationCap, TrendingDown, TriangleAlert } from "lucide-react";
import { PageHeader, StatCard, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { BAND_VAR, BandBadge, DeltaBadge } from "@/features/shared/band";
import { HeatmapCard } from "@/features/riskometer/widgets";
import { awarenessByDept, deptHeatmap, orgSummary, useSignals } from "@/lib/api";

export const Route = createFileRoute("/vcro/departments")({
  head: () => ({
    meta: [
      { title: "Departments | HumanFirewall vCRO" },
      { name: "description", content: "Human risk, drivers, awareness and training by department." },
      { property: "og:title", content: "Departments | HumanFirewall vCRO" },
      { property: "og:description", content: "Human risk, drivers, awareness and training by department." },
    ],
  }),
  component: DepartmentsPage,
});

function Meter({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${value}%`, background: tone }} /></div>
      <span className="text-xs tabular-nums">{value}%</span>
    </div>
  );
}

function DepartmentsPage() {
  const ready = useReady();
  const sig = useSignals();
  const s = orgSummary(sig);
  const aw = Object.fromEntries(awarenessByDept(sig).map((a) => [a.department, a]));
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [bands, setBands] = useState<string[]>([]);
  const [sort, setSort] = useState("score");
  const [trend, setTrend] = useState("all");
  const depts = [...s.departments].sort((a, b) => b.score - a.score);
  const SORTS: Record<string, (a: (typeof depts)[number], b: (typeof depts)[number]) => number> = {
    score: (a, b) => b.score - a.score, change: (a, b) => b.change - a.change, headcount: (a, b) => b.headcount - a.headcount,
    training: (a, b) => (aw[a.department]?.completion ?? 0) - (aw[b.department]?.completion ?? 0), name: (a, b) => a.department.localeCompare(b.department),
  };
  const shown = depts.filter((d) => d.department.toLowerCase().includes(q.toLowerCase()) && (!bands.length || bands.includes(d.band))
    && (trend === "all" || (trend === "rising" ? d.change > 0 : d.change <= 0))).sort(SORTS[sort]);
  const worst = depts[0];
  const improved = [...depts].sort((a, b) => a.change - b.change)[0];
  const overdue = Object.values(aw).reduce((a, x) => a + x.overdue, 0);
  const avgCompletion = Math.round(Object.values(aw).reduce((a, x) => a + x.completion, 0) / Math.max(1, Object.values(aw).length));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Departments" subtitle="Risk, drivers and awareness for every team" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard ready={ready} label="Highest risk" icon={TriangleAlert} value={worst?.department ?? "None"} caption={worst ? `Score ${worst.score} · ${worst.band}` : ""} />
        <StatCard ready={ready} label="Most improved" icon={TrendingDown} value={improved?.department ?? "None"} caption={improved ? `${improved.change} pts vs last month` : ""} />
        <StatCard ready={ready} label="Training completion" icon={GraduationCap} value={`${avgCompletion}%`} caption={`${overdue} people overdue in sample`} />
        <StatCard ready={ready} label="Departments" icon={Building2} value={depts.length} caption={`${s.people.length} people scored in sample`} />
      </div>

      <Widget title="Department scorecard" ready={ready}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search departments" className="pl-8" /></div>
          <ToggleGroup type="multiple" variant="outline" size="sm" value={bands} onValueChange={setBands} className="flex-wrap">
            {["Low", "Guarded", "Elevated", "High", "Critical"].map((b) => <ToggleGroupItem key={b} value={b}>{b}</ToggleGroupItem>)}
          </ToggleGroup>
          <Select value={trend} onValueChange={setTrend}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any change</SelectItem><SelectItem value="rising">Rising risk</SelectItem><SelectItem value="falling">Falling or flat</SelectItem></SelectContent></Select>
          <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="score">Sort by score</SelectItem><SelectItem value="change">Sort by change</SelectItem><SelectItem value="headcount">Sort by headcount</SelectItem><SelectItem value="training">Lowest training first</SelectItem><SelectItem value="name">Sort by name</SelectItem></SelectContent></Select>
          <span className="ml-auto text-xs text-muted-foreground">{shown.length} of {depts.length} departments</span>
        </div>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Department</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 pr-3 font-medium">Change</th>
                <th className="py-2 pr-3 font-medium">Headcount</th>
                <th className="py-2 pr-3 font-medium">Top driver</th>
                <th className="py-2 pr-3 font-medium">Training complete</th>
                <th className="py-2 pr-3 font-medium">JIT response</th>
                <th className="py-2 pr-3 font-medium">Policy acknowledged</th>
                <th className="py-2 font-medium">Report rate</th>
              </tr>
            </thead>
            <tbody>
              {!shown.length && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No departments match these filters</td></tr>}
              {shown.map((d) => {
                const a = aw[d.department]!;
                return (
                  <tr key={d.department} tabIndex={0} className="cursor-pointer border-b last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => navigate({ to: "/vcro/people", search: { dept: d.department } })}
                    onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/vcro/people", search: { dept: d.department } })}>
                    <td className="py-2.5 pr-3 font-medium">
                      <span className="inline-flex items-center gap-2"><span className="h-6 w-1 rounded-full" style={{ background: BAND_VAR[d.band] }} />{d.department}</span>
                    </td>
                    <td className="py-2.5 pr-3"><BandBadge band={d.band} score={d.score} /></td>
                    <td className="py-2.5 pr-3"><DeltaBadge value={d.change} /></td>
                    <td className="py-2.5 pr-3 tabular-nums">{d.headcount.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{d.topDriver}</td>
                    <td className="py-2.5 pr-3"><Meter value={a.completion} tone="var(--band-low)" /></td>
                    <td className="py-2.5 pr-3"><Meter value={a.jit} tone="var(--band-guarded)" /></td>
                    <td className="py-2.5 pr-3"><Meter value={a.policy} tone="var(--chart-2)" /></td>
                    <td className="py-2.5"><Meter value={a.reportRate} tone="var(--band-low)" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Widget>

      <HeatmapCard ready={ready} rows={deptHeatmap(sig)} />
    </div>
  );
}
