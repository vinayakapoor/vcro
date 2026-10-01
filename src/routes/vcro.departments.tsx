import { Fragment, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, GraduationCap, TrendingDown, TriangleAlert } from "lucide-react";
import { PageHeader, StatCard, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { BAND_VAR, BandBadge, DeltaBadge } from "@/features/shared/band";
import { HeatmapCard } from "@/features/riskometer/widgets";
import { awarenessByDept, deptHeatmap, fmt, orgSummary, teamStats, useSettings, useSignals, type Department } from "@/lib/api";
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

const TEAM_PAGE = 9;
const TEAM_SORTS = {
  score: "Riskiest first", change: "Rising fastest", high: "Most High or Critical", size: "Largest first", name: "Manager name",
} as const;

/** Teams inside one department. Built for departments with hundreds of teams: search, sort and pages. */
function TeamPanel({ department }: { department: Department }) {
  const sig = useSignals();
  const navigate = useNavigate();
  const { privacy } = usePrefs();
  const { minGroupSize } = useSettings();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof typeof TEAM_SORTS>("score");
  const [page, setPage] = useState(0);
  const all = teamStats(sig, department);
  const label = (t: (typeof all)[number]) => (privacy ? `Team ${t.managerId.slice(1)}` : `${t.manager}'s team`);
  const shown = all.filter((t) => `${label(t)} ${t.role}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) =>
    sort === "score" ? b.score - a.score : sort === "change" ? b.change - a.change : sort === "high" ? b.high - a.high : sort === "size" ? b.size - a.size : a.manager.localeCompare(b.manager));
  const pages = Math.max(1, Math.ceil(shown.length / TEAM_PAGE));
  const p = Math.min(page, pages - 1);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{fmt(all.length)} teams</span> in {department}. A team is a manager and their direct reports.</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative"><Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search manager or role" aria-label="Search teams" className="h-8 w-52 bg-card pl-7 text-xs" /></div>
          <Select value={sort} onValueChange={(v) => { setSort(v as keyof typeof TEAM_SORTS); setPage(0); }}>
            <SelectTrigger className="h-8 w-48 bg-card text-xs" aria-label="Sort teams"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TEAM_SORTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {!shown.length ? <p className="py-4 text-center text-sm text-muted-foreground">No team matches "{q}".</p> : (
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.slice(p * TEAM_PAGE, (p + 1) * TEAM_PAGE).map((t) => {
            const hidden = t.size < minGroupSize;
            return (
              <button key={t.managerId} type="button" onClick={() => navigate({ to: "/vcro/people", search: { dept: department, team: t.managerId } })}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{label(t)}</span><span className="block truncate text-xs text-muted-foreground">{t.role} · {t.size} people{!hidden && ` · ${t.high} High or Critical`}</span></span>
                {hidden ? <span className="shrink-0 text-xs text-muted-foreground" title={`Teams under ${minGroupSize} people show no score. Change this in Settings, Privacy.`}>Too small to show</span>
                  : <><BandBadge band={t.band} score={t.scored ? t.score : null} />{t.scored > 0 && <DeltaBadge value={t.change} />}</>}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{shown.length ? `${p * TEAM_PAGE + 1} to ${Math.min(shown.length, (p + 1) * TEAM_PAGE)} of ${fmt(shown.length)} teams` : "0 teams"}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 bg-card" onClick={() => navigate({ to: "/vcro/people", search: { dept: department, level: "Manager" } })}>See all managers</Button>
          <Button variant="outline" size="icon" className="size-7 bg-card" aria-label="Previous teams" disabled={p === 0} onClick={() => setPage(p - 1)}><ChevronLeft className="size-4" /></Button>
          <span className="px-1 tabular-nums">Page {p + 1} of {pages}</span>
          <Button variant="outline" size="icon" className="size-7 bg-card" aria-label="Next teams" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
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
                  {isOpen && <tr className="border-b bg-muted/30"><td colSpan={10} className="px-3 py-3"><TeamPanel department={d.department} /></td></tr>}
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
