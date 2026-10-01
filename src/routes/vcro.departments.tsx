import { Fragment, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, GraduationCap, TrendingDown, TriangleAlert } from "lucide-react";
import { PageHeader, StatCard, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { BAND_VAR, BandBadge, DeltaBadge } from "@/features/shared/band";
import { HeatmapCard } from "@/features/riskometer/widgets";
import { awarenessByDept, deptHeatmap, fmt, orgSummary, teamStats, useSignals } from "@/lib/api";
import { usePrefs } from "@/features/shared/prefs";

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
  const [open, setOpen] = useState<string | null>(null);
  const { privacy } = usePrefs();
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
        <StatCard ready={ready} label="Most improved" icon={TrendingDown} value={improved?.department ?? "None"} caption={improved ? (improved.change < 0 ? `${improved.change} pts vs last month` : "No department improved this month") : ""} />
        <StatCard ready={ready} label="Training completion" icon={GraduationCap} value={`${avgCompletion}%`} caption={`${fmt(overdue)} people overdue`} />
        <StatCard ready={ready} label="Departments" icon={Building2} value={depts.length} caption={`${fmt(s.scored)} of ${fmt(s.total)} people scored`} />
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
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Department</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 pr-3 font-medium">Change</th>
                <th className="py-2 pr-3 font-medium">People</th>
                <th className="py-2 pr-3 font-medium">High or Critical</th>
                <th className="py-2 pr-3 font-medium">Top driver</th>
                <th className="py-2 pr-3 font-medium">Training complete</th>
                <th className="py-2 pr-3 font-medium">JIT response</th>
                <th className="py-2 pr-3 font-medium">Policy acknowledged</th>
                <th className="py-2 font-medium">Report rate</th>
              </tr>
            </thead>
            <tbody>
              {!shown.length && <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">No departments match these filters</td></tr>}
              {shown.map((d) => {
                const a = aw[d.department]!;
                const isOpen = open === d.department;
                const teams = isOpen ? teamStats(sig, d.department) : [];
                return (
                  <Fragment key={d.department}>
                  <tr tabIndex={0} className="cursor-pointer border-b hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => navigate({ to: "/vcro/people", search: { dept: d.department } })}
                    onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/vcro/people", search: { dept: d.department } })}>
                    <td className="py-2.5 pr-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} teams in ${d.department}`}
                          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : d.department); }} onKeyDown={(e) => e.stopPropagation()}>
                          <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        </button>
                        <span className="h-6 w-1 rounded-full" style={{ background: BAND_VAR[d.band] }} />{d.department}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3"><BandBadge band={d.band} score={d.score} /></td>
                    <td className="py-2.5 pr-3"><DeltaBadge value={d.change} /></td>
                    <td className="py-2.5 pr-3 tabular-nums">{fmt(d.headcount)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{fmt(d.high)}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{d.topDriver}</td>
                    <td className="py-2.5 pr-3"><Meter value={a.completion} tone="var(--band-low)" /></td>
                    <td className="py-2.5 pr-3"><Meter value={a.jit} tone="var(--band-guarded)" /></td>
                    <td className="py-2.5 pr-3"><Meter value={a.policy} tone="var(--chart-2)" /></td>
                    <td className="py-2.5"><Meter value={a.reportRate} tone="var(--band-low)" /></td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b bg-muted/30">
                      <td colSpan={10} className="px-3 py-3">
                        <div className="mb-2 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                          <span><span className="font-semibold text-foreground">{teams.length} teams</span> in {d.department}, riskiest first. A team is a manager and their direct reports.</span>
                        </div>
                        <div className="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                          {teams.map((t) => (
                            <button key={t.managerId} type="button" onClick={() => navigate({ to: "/vcro/people", search: { dept: d.department, team: t.managerId } })}
                              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{privacy ? `Team ${t.managerId.slice(1)}` : `${t.manager}'s team`}</span><span className="block truncate text-xs text-muted-foreground">{t.role} · {t.size} people · {t.high} High or Critical</span></span>
                              <BandBadge band={t.band} score={t.scored ? t.score : null} />
                              {t.scored > 0 && <DeltaBadge value={t.change} />}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
