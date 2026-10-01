import { Fragment, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, GraduationCap, TrendingDown, TriangleAlert } from "lucide-react";
import { PageHeader, StatCard, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { BAND_VAR, BandBadge, DeltaBadge } from "@/features/shared/band";
import { HeatmapCard } from "@/features/riskometer/widgets";
import { MONTHS, PREV_MONTH, PEOPLE_HEADS, awarenessByDept, awarenessTotals, deptHeatmap, fmt, orgSummary, pct, teamStats, trends, useSettings, useSignals, type Department } from "@/lib/api";
import { download, fileDate, toCsv } from "@/lib/export";
import { getPeople } from "@/lib/api";
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

/** Share out of 100. One colour for every column: these are rates, not risk bands. */
function Meter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${value}%` }} /></div>
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
          {shown[p * TEAM_PAGE] && <Button variant="outline" size="sm" className="h-7 bg-card" onClick={() => navigate({ to: "/vcro/scorecard/$id", params: { id: shown[p * TEAM_PAGE]!.managerId }, search: { view: "team" } })}>Riskiest team's scorecard</Button>}
          <Button variant="outline" size="icon" className="size-7 bg-card" aria-label="Previous teams" disabled={p === 0} onClick={() => setPage(p - 1)}><ChevronLeft className="size-4" /></Button>
          <span className="px-1 tabular-nums">Page {p + 1} of {pages}</span>
          <Button variant="outline" size="icon" className="size-7 bg-card" aria-label="Next teams" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}

function Spark({ values }: { values: (number | null)[] }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return <span className="text-xs text-muted-foreground">None</span>;
  const lo = Math.min(...v) - 0.5, hi = Math.max(...v) + 0.5;
  const pts = values.map((x, i) => (x == null ? null : `${(i / (values.length - 1)) * 72 + 2},${22 - ((x - lo) / (hi - lo)) * 20}`)).filter(Boolean).join(" ");
  const up = v.at(-1)! > v[0]!;
  return <svg width="76" height="24" role="img" aria-label={`12 months, ${v[0]} to ${v.at(-1)}`}><polyline points={pts} fill="none" stroke={up ? "var(--warning)" : "var(--success)"} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

type SortKey = "department" | "score" | "change" | "headcount" | "teams" | "high" | "repeat" | "completion" | "policy" | "reportRate";

function DepartmentsPage() {
  const ready = useReady();
  const sig = useSignals();
  const { privacy } = usePrefs();
  const s = orgSummary(sig);
  const aw = Object.fromEntries(awarenessByDept(sig).map((a) => [a.department, a]));
  const totals = awarenessTotals(sig);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [bands, setBands] = useState<string[]>([]);
  const [trend, setTrend] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const [open, setOpen] = useState<string | null>(null);

  const people = getPeople(sig);
  const t = ready ? trends(sig) : null;
  const rows = s.departments.map((d) => {
    const idx = people.flatMap((p, i) => (p.department === d.department ? [i] : []));
    const a = aw[d.department]!;
    return { ...d, ...a, teams: teamStats(sig, d.department).length, head: PEOPLE_HEADS[d.department], history: t ? MONTHS.map((_, k) => t.avg(idx, k)) : [] };
  });
  const shown = rows
    .filter((d) => d.department.toLowerCase().includes(q.toLowerCase()) && (!bands.length || bands.includes(d.band)) && (trend === "all" || (trend === "rising" ? d.change > 0 : d.change <= 0)))
    .sort((a, b) => { const x = a[sort.key], y = b[sort.key]; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir; });
  const byScore = [...rows].sort((a, b) => b.score - a.score);
  const worst = byScore[0];
  const improved = [...rows].sort((a, b) => a.change - b.change)[0];
  const rising = rows.filter((d) => d.change > 0).length;

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`py-2 pr-4 font-medium ${right ? "text-right" : ""}`} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((c) => (c.key === k ? { key: k, dir: c.dir === 1 ? -1 : 1 } : { key: k, dir: k === "department" ? 1 : -1 }))}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}{sort.key === k ? (sort.dir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ArrowUpDown className="size-3.5 opacity-40" />}
      </button>
    </th>
  );
  const exportCsv = () => download(`vcro-departments-${fileDate()}.csv`, "text/csv", toCsv([
    ["Department", "Head", "Score", "Band", `Change since ${PREV_MONTH}`, "People", "Scored", "Teams", "High or Critical", "Repeat clickers", "Top driver", "Training complete %", "People overdue", "Policy acknowledged %", "Report rate %"],
    ...shown.map((d) => [d.department, privacy ? "" : d.head, d.score, d.band, d.change, d.headcount, d.scored, d.teams, d.high, d.repeat, d.topDriver, d.completion, d.overdue, d.policy, d.reportRate]),
    ["Organisation", "", s.score, s.band, s.change, s.total, s.scored, rows.reduce((a, d) => a + d.teams, 0), s.highCount, s.repeatCount, "", totals.completion, totals.overdue, totals.policy, Math.round(s.reportRate * 100)],
  ]));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Departments" subtitle="Risk, drivers and awareness for every department and the teams inside it" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard ready={ready} label="Highest risk" icon={TriangleAlert} value={worst?.department ?? "None"} caption={worst ? `Score ${worst.score} · ${worst.band} · ${fmt(worst.high)} High or Critical` : ""} />
        <StatCard ready={ready} label="Most improved" icon={TrendingDown} value={improved && improved.change < 0 ? improved.department : "None"} caption={improved && improved.change < 0 ? `${improved.change} pts since ${PREV_MONTH}` : `No department improved since ${PREV_MONTH}`} />
        <StatCard ready={ready} label="Rising" icon={Building2} value={`${rising} of ${rows.length}`} caption={`Departments with a higher score than ${PREV_MONTH}`} />
        <StatCard ready={ready} label="Training completion" icon={GraduationCap} value={`${totals.completion}%`} caption={`${fmt(totals.overdue)} people overdue`} />
      </div>

      <Widget title="Department scorecard" ready={ready} info="One row per department. Click a column to sort, the arrow to see its teams, or the row to see its people. The last row is the whole organisation."
        action={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" />Export</Button>}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search departments" className="pl-8" /></div>
          <ToggleGroup type="multiple" variant="outline" size="sm" value={bands} onValueChange={setBands} className="flex-wrap" aria-label="Bands">
            {["Low", "Guarded", "Elevated", "High", "Critical"].map((b) => <ToggleGroupItem key={b} value={b}>{b}</ToggleGroupItem>)}
          </ToggleGroup>
          <Select value={trend} onValueChange={setTrend}><SelectTrigger className="w-40" aria-label="Change"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any change</SelectItem><SelectItem value="rising">Rising risk</SelectItem><SelectItem value="falling">Falling or flat</SelectItem></SelectContent></Select>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{shown.length} of {rows.length} departments · {fmt(s.total)} people</span>
        </div>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <Th k="department">Department</Th><Th k="score">Score</Th><Th k="change">vs {PREV_MONTH}</Th><th className="py-2 pr-4 font-medium">12 months</th>
                <Th k="headcount" right>People</Th><Th k="teams" right>Teams</Th><Th k="high" right>High or Critical</Th><Th k="repeat" right>Repeat clickers</Th>
                <th className="py-2 pr-4 font-medium">Top driver</th><Th k="completion">Training complete</Th><Th k="policy">Policy acknowledged</Th><Th k="reportRate">Report rate</Th>
              </tr>
            </thead>
            <tbody>
              {!shown.length && <tr><td colSpan={12} className="py-8 text-center text-muted-foreground">No departments match these filters</td></tr>}
              {shown.map((d) => {
                const isOpen = open === d.department;
                const go = () => navigate({ to: "/vcro/people", search: { dept: d.department } });
                return (
                  <Fragment key={d.department}>
                    <tr tabIndex={0} className="cursor-pointer border-b hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none" onClick={go} onKeyDown={(e) => e.key === "Enter" && go()}>
                      <td className="py-3 pr-4">
                        <span className="flex items-center gap-2">
                          <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} teams in ${d.department}`}
                            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : d.department); }} onKeyDown={(e) => e.stopPropagation()}>
                            <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          </button>
                          <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: BAND_VAR[d.band] }} />
                          <span className="min-w-0"><span className="block font-medium">{d.department}</span><span className="block truncate text-xs text-muted-foreground">{privacy ? "Head hidden" : `Head: ${d.head}`}</span></span>
                        </span>
                      </td>
                      <td className="py-3 pr-4"><BandBadge band={d.band} score={d.score} /></td>
                      <td className="py-3 pr-4"><DeltaBadge value={d.change} /></td>
                      <td className="py-3 pr-4"><Spark values={d.history} /></td>
                      <td className="py-3 pr-4 text-right tabular-nums">{fmt(d.headcount)}{d.scored < d.headcount && <span className="block text-xs text-muted-foreground">{fmt(d.scored)} scored</span>}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{fmt(d.teams)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{fmt(d.high)}<span className="block text-xs text-muted-foreground">{pct(d.scored ? d.high / d.scored : 0)}</span></td>
                      <td className="py-3 pr-4 text-right tabular-nums">{fmt(d.repeat)}<span className="block text-xs text-muted-foreground">{pct(d.headcount ? d.repeat / d.headcount : 0)}</span></td>
                      <td className="py-3 pr-4 text-muted-foreground">{d.topDriver}</td>
                      <td className="py-3 pr-4"><Meter value={d.completion} /></td>
                      <td className="py-3 pr-4"><Meter value={d.policy} /></td>
                      <td className="py-3 pr-4"><Meter value={d.reportRate} /></td>
                    </tr>
                    {isOpen && <tr className="border-b bg-muted/30"><td colSpan={12} className="px-3 py-3"><TeamPanel department={d.department} /></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
            {shown.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 text-sm font-medium">
                  <td className="rounded-l-lg py-3 pl-10 pr-4">Organisation</td>
                  <td className="py-3 pr-4"><BandBadge band={s.band} score={s.score} /></td>
                  <td className="py-3 pr-4"><DeltaBadge value={s.change} /></td>
                  <td className="py-3 pr-4"><Spark values={t ? t.org.map((x) => x.value) : []} /></td>
                  <td className="py-3 pr-4 text-right tabular-nums">{fmt(s.total)}<span className="block text-xs font-normal text-muted-foreground">{fmt(s.scored)} scored</span></td>
                  <td className="py-3 pr-4 text-right tabular-nums">{fmt(rows.reduce((a, d) => a + d.teams, 0))}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{fmt(s.highCount)}<span className="block text-xs font-normal text-muted-foreground">{pct(s.scored ? s.highCount / s.scored : 0)}</span></td>
                  <td className="py-3 pr-4 text-right tabular-nums">{fmt(s.repeatCount)}<span className="block text-xs font-normal text-muted-foreground">{pct(s.repeatCount / s.total)}</span></td>
                  <td className="py-3 pr-4" />
                  <td className="py-3 pr-4"><Meter value={totals.completion} /></td>
                  <td className="py-3 pr-4"><Meter value={totals.policy} /></td>
                  <td className="rounded-r-lg py-3 pr-4"><Meter value={Math.round(s.reportRate * 100)} /></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Widget>

      <HeatmapCard ready={ready} rows={deptHeatmap(sig)} />
    </div>
  );
}
