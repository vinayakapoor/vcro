import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Printer, Send, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Widget, EmptyLine } from "@/features/shared/widget";
import { BAND_VAR, BandBadge, DeltaBadge, SoftBadge, StatusBadge } from "@/features/shared/band";
import { usePrefs, useReady } from "@/features/shared/prefs";
import { BENCHMARK, PREV_MONTH, deptStats, fmt, formatAge, formatStamp, getPeople, getPerson, orgSummary, pseudonym, queueRun, useRuns, useSettings, useSignals, type ScoredPerson } from "@/lib/api";
import { PERSON_BY_ID } from "@/data/people";
import { bandFor } from "@/lib/scoring";

export const Route = createFileRoute("/vcro/scorecard/$id")({
  validateSearch: (s) => z.object({ view: z.enum(["me", "team"]).optional() }).parse(s),
  loader: ({ params }) => { if (!PERSON_BY_ID.has(params.id)) throw notFound(); return {}; },
  head: () => ({ meta: [{ title: "Scorecard | HumanFirewall vCRO" }, { name: "description", content: "Personal and team security scorecards." }] }),
  notFoundComponent: () => <EmptyLine text="Person not found" action={<Button asChild variant="outline" size="sm"><Link to="/vcro/people">View people</Link></Button>} />,
  component: ScorecardPage,
});

const LEVELS = ["Starter", "Aware", "Capable", "Strong", "Champion"];
const CUTS = [0, 40, 55, 70, 85];
const levelOf = (v: number) => CUTS.filter((c) => v >= c).length - 1;
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

function Ring({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative size-40">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`Skill score ${value} of 100`}>
        <circle cx="60" cy="60" r={r} fill="none" className="stroke-muted" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--success)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="text-4xl font-bold tabular-nums tracking-tight">{value}</div><div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">of 100</div></div></div>
    </div>
  );
}
function Compare({ rows, higherIsBetter }: { rows: [string, number, boolean?][]; higherIsBetter: boolean }) {
  return (
    <div className="space-y-3">
      {rows.map(([label, v, me]) => (
        <div key={label} className="grid grid-cols-[minmax(0,150px)_1fr_36px] items-center gap-3 text-sm">
          <span className={`truncate ${me ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${v}%`, background: me ? (higherIsBetter ? "var(--success)" : BAND_VAR[bandFor(v)]) : "var(--muted-foreground)" }} /></span>
          <span className={`text-right tabular-nums ${me ? "font-semibold" : ""}`}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function ScorecardPage() {
  const { id } = Route.useParams();
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const ready = useReady();
  const sig = useSignals();
  const settings = useSettings();
  const runs = useRuns();
  const { privacy } = usePrefs();
  const p = getPerson(sig, id);
  if (!p) return <EmptyLine text="Person not found" action={<Button asChild variant="outline" size="sm"><Link to="/vcro/people">View people</Link></Button>} />;
  const people = getPeople(sig);
  const reports = people.filter((x) => x.managerId === p.id);
  const mode = view ?? "me";
  const showTeam = mode === "team" && reports.length > 0;
  const name = privacy ? pseudonym(p.id) : p.name;
  const first = privacy ? "This person" : p.name.split(" ")[0]!;
  const key = `scorecard:${p.id}:${showTeam ? "team" : "me"}`;
  const sent = runs.find((r) => r.key === key);
  const send = () => { queueRun(key, showTeam ? "Team scorecard" : "Personal scorecard", name, 1); toast.success(`Scorecard queued for ${name}`, { description: "It will arrive by email with a link to this view." }); };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <div>
        <Link to="/vcro/people/$id" params={{ id: p.id }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground print:hidden"><ArrowLeft className="size-3.5" />Back to {name}</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{showTeam ? `Team scorecard: ${name}'s team` : `Scorecard: ${name}`}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{showTeam ? `What ${first} sees as a manager. ${reports.length} direct reports in ${p.department}.` : `What ${first} sees about themselves. ${p.role}, ${p.department}.`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {reports.length > 0 && (
              <ToggleGroup type="single" variant="outline" size="sm" value={showTeam ? "team" : "me"} onValueChange={(v) => v && navigate({ search: { view: v as "me" | "team" } })} aria-label="Scorecard">
                <ToggleGroupItem value="me">Personal</ToggleGroupItem><ToggleGroupItem value="team">Team</ToggleGroupItem>
              </ToggleGroup>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" />Print</Button>
            {sent?.status === "Queued" ? <StatusBadge on onText={`Sent ${formatStamp(sent.at)}`} /> : <Button size="sm" onClick={send}><Send className="size-4" />Send to {first}</Button>}
          </div>
        </div>
      </div>
      {showTeam ? <Team manager={p} team={reports} people={people} minGroup={settings.minGroupSize} privacy={privacy} ready={ready} /> : <Personal p={p} people={people} ready={ready} />}
    </div>
  );
}

function Personal({ p, people, ready }: { p: ScoredPerson; people: ScoredPerson[]; ready: boolean }) {
  if (p.skill === null) return <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">A scorecard appears once this person has a simulation result and a learning signal.</div>;
  const lv = levelOf(p.skill);
  const team = people.filter((x) => x.managerId === p.managerId && x.skill !== null);
  const org = people.filter((x) => x.skill !== null);
  const sims = p.sims.slice(0, 6);
  const passed = p.sims.filter((x) => x.outcome === "Passed").length, reported = p.sims.filter((x) => x.reported).length;
  const good: string[] = [], better: string[] = [];
  if (reported >= p.sims.length / 2) good.push(`You reported ${reported} of your last ${p.sims.length} simulated attacks.`);
  if (passed === p.sims.length && p.sims.length) good.push("You did not fall for a single simulated attack this year.");
  p.channels.filter((c) => c.attempts > 0 && c.failures === 0).slice(0, 2).forEach((c) => good.push(`No slips on ${c.channel} attacks.`));
  if ((p.now["lrn-complete"]?.value ?? 100) < 50) good.push("Your assigned training is complete.");
  if (p.weakestChannel) better.push(`${p.weakestChannel} is where you are caught most. Slow down on unexpected ${p.weakestChannel === "Email" ? "emails" : p.weakestChannel === "Voice" ? "calls" : p.weakestChannel === "QR" ? "QR codes" : p.weakestChannel === "SMS" ? "texts" : "video or voice messages"}.`);
  if (p.topLure) better.push(`Messages that use ${p.topLure.toLowerCase()} work on you most often. Pause when you feel it.`);
  if ((p.now["lrn-overdue"]?.value ?? 0) > 50) better.push("You have training that is overdue.");
  if (reported < p.sims.length / 3) better.push("Report what looks suspicious, even if you are not sure. It is the fastest way to raise your score.");
  if (p.impulsive) better.push("You tend to click within seconds. Give every unexpected message ten seconds first.");

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Widget title="Your security skill score" ready={ready} className="lg:col-span-5" info="0 to 100, higher is better. Built from how you handle simulated and real attacks, how often you report, and your training results.">
        <div className="flex flex-col items-center gap-4 py-2 sm:flex-row sm:gap-6">
          <Ring value={p.skill} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="text-lg font-semibold">Level {lv + 1} · {LEVELS[lv]}</div>
            {p.skillPrev !== null && <div className={`text-sm ${p.skill > p.skillPrev ? "text-success" : p.skill < p.skillPrev ? "text-warning" : "text-muted-foreground"}`}>{p.skill === p.skillPrev ? `Same as ${PREV_MONTH}` : `${p.skill > p.skillPrev ? "Up" : "Down"} ${Math.abs(p.skill - p.skillPrev)} since ${PREV_MONTH}`}</div>}
            {lv < 4 && <div className="mt-2 text-sm text-muted-foreground">{CUTS[lv + 1]! - p.skill} {CUTS[lv + 1]! - p.skill === 1 ? "point" : "points"} to {LEVELS[lv + 1]}</div>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {LEVELS.map((l, i) => <div key={l} className="min-w-0"><div className={`h-1.5 rounded-full ${i <= lv ? "bg-success" : "bg-muted"}`} /><div className={`mt-1.5 truncate text-[11px] ${i === lv ? "font-semibold" : "text-muted-foreground"}`}>{l}</div></div>)}
        </div>
      </Widget>
      <Widget title="How you compare" ready={ready} className="lg:col-span-7" info="Average skill score, higher is better. Other people's individual scores are never shown here.">
        <Compare higherIsBetter rows={[["You", p.skill, true], ["Your team", avg(team.map((x) => x.skill!))], [p.department, avg(org.filter((x) => x.department === p.department).map((x) => x.skill!))], ["Whole organisation", avg(org.map((x) => x.skill!))]]} />
      </Widget>
      <Widget title="What you do well" ready={ready} className="lg:col-span-6">
        {good.length ? <ul className="space-y-2.5 text-sm">{good.slice(0, 3).map((g) => <li key={g} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />{g}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing stands out yet. Reporting one suspicious message is the quickest win.</p>}
      </Widget>
      <Widget title="Where to focus next" ready={ready} className="lg:col-span-6">
        {better.length ? <ul className="space-y-2.5 text-sm">{better.slice(0, 3).map((g) => <li key={g} className="flex gap-2.5"><Target className="mt-0.5 size-4 shrink-0 text-warning" />{g}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing to fix right now. Keep reporting what looks suspicious.</p>}
      </Widget>
      <Widget title="Your last simulated attacks" ready={ready} className="lg:col-span-12" empty={!sims.length && { text: "No simulations yet.", action: null }}>
        <ul className="divide-y text-sm">
          {sims.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1"><span className="block font-medium">{x.template}</span><span className="block text-xs text-muted-foreground">{x.channel} · {x.lure} · {formatAge(x.ageDays)}</span></span>
              {x.reported && <SoftBadge className="text-success">Reported</SoftBadge>}
              <SoftBadge className={x.outcome === "Passed" ? "text-success" : "text-warning"}>{x.outcome === "Passed" ? "Spotted it" : x.outcome}</SoftBadge>
            </li>
          ))}
        </ul>
      </Widget>
    </div>
  );
}

function Team({ manager, team, people, minGroup, privacy, ready }: { manager: ScoredPerson; team: ScoredPerson[]; people: ScoredPerson[]; minGroup: number; privacy: boolean; ready: boolean }) {
  const sig = useSignals();
  const sc = team.filter((x) => x.score !== null);
  const score = avg(sc.map((x) => x.score!)), prev = avg(sc.filter((x) => x.prev !== null).map((x) => x.prev!));
  const dept = deptStats(sig).find((d) => d.department === manager.department)!;
  const org = orgSummary(sig);
  const small = team.length < minGroup;
  const overdue = team.filter((x) => (x.now["lrn-overdue"]?.value ?? 0) > 60), repeat = team.filter((x) => x.fails180 >= 2), high = sc.filter((x) => x.score! > 60);
  const done = team.filter((x) => (x.now["lrn-complete"]?.value ?? 100) < 50).length;
  const simsAll = team.flatMap((x) => x.sims), rep = simsAll.length ? Math.round((simsAll.filter((x) => x.reported).length / simsAll.length) * 100) : 0;
  const drivers: Record<string, number> = {};
  for (const x of sc) for (const c of x.contributions) if (c.points > 0) drivers[c.category] = (drivers[c.category] ?? 0) + c.points / sc.length;
  const top = Object.entries(drivers).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const todo = [
    overdue.length > 0 && `${overdue.length} ${overdue.length === 1 ? "person has" : "people have"} overdue training. A reminder from you works better than one from security.`,
    repeat.length > 0 && `${repeat.length} ${repeat.length === 1 ? "person has" : "people have"} failed two or more simulations in six months. Suggest the short coaching session.`,
    rep < Math.round(org.reportRate * 100) && `Your team reports ${rep}% of simulations against ${Math.round(org.reportRate * 100)}% across the organisation. Ask them to report anything that looks off.`,
    high.length > 0 && `${high.length} ${high.length === 1 ? "person is" : "people are"} in High or Critical. Security will contact you about next steps.`,
  ].filter(Boolean) as string[];
  const nm = (x: ScoredPerson) => (privacy ? pseudonym(x.id) : x.name);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Widget title="Team risk score" ready={ready} className="lg:col-span-5" info="Average risk score of your direct reports, 0 to 100. Lower is better.">
        <div className="flex items-end gap-4 py-2">
          <div className="text-6xl font-bold leading-none tabular-nums tracking-tighter">{score}</div>
          <div className="space-y-1.5 pb-1"><BandBadge band={bandFor(score)} /><div><DeltaBadge value={score - prev} /> <span className="text-xs text-muted-foreground">since {PREV_MONTH}</span></div></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
          <div><div className="text-xs text-muted-foreground">People</div><div className="text-lg font-bold tabular-nums">{team.length}</div></div>
          <div><div className="text-xs text-muted-foreground">Training done</div><div className="text-lg font-bold tabular-nums">{Math.round((done / team.length) * 100)}%</div></div>
          <div><div className="text-xs text-muted-foreground">Report rate</div><div className="text-lg font-bold tabular-nums">{rep}%</div></div>
        </div>
      </Widget>
      <Widget title="How your team compares" ready={ready} className="lg:col-span-7" info={`Risk score, lower is better. Peer median is ${BENCHMARK.group}, ${BENCHMARK.asOf}.`}>
        <Compare higherIsBetter={false} rows={[["Your team", score, true], [manager.department, dept.score], ["Whole organisation", org.score], ["Peer median", BENCHMARK.median.score]]} />
      </Widget>
      <Widget title="What to do this month" ready={ready} className="lg:col-span-7">
        {todo.length ? <ul className="space-y-2.5 text-sm">{todo.slice(0, 3).map((t) => <li key={t} className="flex gap-2.5"><Target className="mt-0.5 size-4 shrink-0 text-warning" />{t}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing needs your attention this month.</p>}
      </Widget>
      <Widget title="What drives your team's score" ready={ready} className="lg:col-span-5">
        <div className="space-y-2.5">{top.map(([k, v]) => <div key={k} className="grid grid-cols-[minmax(0,1fr)_90px_40px] items-center gap-3 text-sm"><span className="truncate">{k}</span><span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground" style={{ width: `${(v / top[0]![1]) * 100}%` }} /></span><span className="text-right tabular-nums">{v.toFixed(1)}</span></div>)}</div>
      </Widget>
      <Widget title="Your team" ready={ready} className="lg:col-span-12" info={`Individual bands are shown to a manager only when the team has ${minGroup} or more people. Change this in Settings, Privacy.`}>
        {small ? <p className="text-sm text-muted-foreground">This team has {team.length} {team.length === 1 ? "person" : "people"}. Individual results are hidden for teams under {minGroup}, so no one can be singled out.</p> : (
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {[...team].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((x) => (
              <li key={x.id} className="flex items-center gap-3 border-b py-2.5 text-sm">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{nm(x)}</span><span className="block truncate text-xs text-muted-foreground">{x.role}</span></span>
                {x.skill !== null && <span className="text-xs text-muted-foreground">{LEVELS[levelOf(x.skill)]}</span>}
                <BandBadge band={x.band} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{fmt(people.length)} people are scored the same way across the organisation. Managers see bands, not the detail behind them.</p>
      </Widget>
    </div>
  );
}
