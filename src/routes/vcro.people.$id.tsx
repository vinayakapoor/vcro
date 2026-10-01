import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { ChevronDown, Pin, PinOff, Play, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Widget, EmptyLine } from "@/features/shared/widget";
import { InfoTip } from "@/features/shared/info";
import { Gauge } from "@/features/shared/gauge";
import { DeltaBadge, PayloadBadge, SoftBadge, StatusBadge } from "@/features/shared/band";
import { usePrefs, useReady } from "@/features/shared/prefs";
import { AXIS, ChartTip, ConfidenceLine } from "@/features/riskometer/widgets";
import {
  ELEMENTS, LURES, PREV_MONTH, WORKFLOWS, clearRun, formatAge, formatStamp, getPerson, initials, managerName, nextSteps, pseudonym, queueRun, togglePinned,
  tagPeople, untagPerson, useCustomTags, usePinned, useRuns, useSignals,
} from "@/lib/api";
import { PERSON_BY_ID, personActivity, type ActivityType, type Finding } from "@/data/people";
import { TagList } from "@/features/shared/tags";
import { BAND_VAR } from "@/features/shared/band";
import { SOURCES, accessFindings, exposureFindings, missingSources } from "@/lib/api";

const SKILL_LEVELS = ["Starter", "Aware", "Capable", "Strong", "Champion"];
const SKILL_CUTS = [0, 40, 55, 70, 85];
const skillLevel = (v: number) => SKILL_CUTS.filter((c) => v >= c).length - 1;

export const Route = createFileRoute("/vcro/people/$id")({
  loader: ({ params }) => {
    const p = PERSON_BY_ID.get(params.id);
    if (!p) throw notFound();
    return { id: p.id, role: p.role, department: p.department };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found | HumanFirewall vCRO" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.role}, ${loaderData.department} | HumanFirewall vCRO`;
    const d = "Person risk score, breakdown, channel results and recommended next steps.";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }] };
  },
  notFoundComponent: PersonNotFound,
  component: PersonPage,
});

function PersonNotFound() {
  return <EmptyLine text="Person not found" action={<Button asChild variant="outline" size="sm"><Link to="/vcro/people">View people</Link></Button>} />;
}

const SEV = { High: "text-band-critical", Medium: "text-band-high", Low: "text-muted-foreground" } as const;
const TYPES: ActivityType[] = ["Simulation", "Real threat", "Training", "JIT nudge", "Announcement"];

function Findings({ items, none, missing }: { items: Finding[]; none: string; missing: { id: string; name: string }[] }) {
  return (
    <>
      {items.length ? (
        <ul className="space-y-2.5 text-sm">
          {items.map((o) => (
            <li key={o.item} className="flex items-start justify-between gap-2">
              <span className="min-w-0"><span className="block">{o.item}</span><span className="block text-xs text-muted-foreground">From {SOURCES.find((x) => x.id === o.sourceId)?.name}</span></span>
              <SoftBadge className={SEV[o.level]}>{o.level}</SoftBadge>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">{none}</p>}
      {missing.length > 0 && (
        <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          More would show with{" "}
          {missing.slice(0, 3).map((m, i) => <span key={m.id}>{i > 0 && ", "}<Link to="/vcro/signals/$id" params={{ id: m.id }} className="font-medium text-foreground underline underline-offset-2">{m.name}</Link></span>)}
          {missing.length > 3 && ` and ${missing.length - 3} more`} connected.
        </div>
      )}
    </>
  );
}

function PersonPage() {
  const { id } = Route.useParams();
  const ready = useReady();
  const signals = useSignals();
  const runs = useRuns();
  const pinned = usePinned();
  const customTags = useCustomTags();
  const { privacy } = usePrefs();
  const [type, setType] = useState<string>("All");
  const p = getPerson(signals, id);
  if (!p) return <PersonNotFound />;
  const name = privacy ? pseudonym(p.id) : p.name;
  const allActivity = personActivity(p);
  const custom = customTags.filter((t) => t.members.includes(p.id));
  const isPinned = pinned.includes(p.id);
  const myRuns = runs.filter((r) => r.key.startsWith(`${p.id}:`) && r.status === "Queued");
  const queue = (workflow: string) => {
    queueRun(`${p.id}:${workflow}`, workflow, name, 1);
    toast.success(`${workflow} queued for ${name}`, { description: "Sent to Workflows. Status stays on this page until it completes." });
  };

  // How the score adds up
  const pts = (pillar: string) => Math.round(p.contributions.filter((c) => c.pillar === pillar).reduce((a, c) => a + c.points, 0) * 10) / 10;
  const drivers = p.contributions.filter((c) => c.pillar !== "Reporting").map((c) => ({ ...c, points: Math.round(c.points * 10) / 10 })).sort((a, b) => b.points - a.points);
  const maxDriver = Math.max(1, ...drivers.map((d) => d.points));
  const top3 = drivers.slice(0, 3).map((d) => d.category);
  const reportingPts = pts("Reporting");

  const lures = LURES.map((l) => ({ lure: l, rate: p.lures[l] }));
  const activity = allActivity.filter((a) => type === "All" || a.type === type);
  const behaviourSafe = 100 - p.behaviour;
  const hasSims = p.sims.length > 0;
  const missing = [!hasSims && "a simulation result", !ELEMENTS.some((e) => e.category === "Learning" && p.now[e.id]) && "a learning signal"].filter(Boolean).join(" and ");
  const next = p.score === null ? [] : nextSteps(signals, p);
  const exposure = exposureFindings(p), access = accessFindings(p);
  const worst = [...p.channels].filter((c) => c.failures > 0).sort((a, b) => b.failRate - a.failRate)[0]?.channel;
  const first = privacy ? "This person" : p.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="size-14"><AvatarFallback>{privacy ? "··" : initials(p.name)}</AvatarFallback></Avatar>
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.role} · <Link to="/vcro/people" search={{ dept: p.department }} className="underline-offset-2 hover:underline">{p.department}</Link> · {p.location}
              {p.managerId && <> · Reports to {privacy ? "hidden" : <Link to="/vcro/people/$id" params={{ id: p.managerId }} className="underline-offset-2 hover:underline">{managerName(p.managerId)}</Link>}</>}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {p.level !== "Individual" && <SoftBadge>{p.level === "Head" ? "Department head" : "People manager"}</SoftBadge>}
              <TagList tags={p.tags} custom={custom.map((t) => t.name)} max={4} wrap />
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="size-3" />Tag</button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>{customTags.length ? "Your tags" : "No tags of your own yet"}</DropdownMenuLabel>
                  {customTags.map((t) => { const has = t.members.includes(p.id); return <DropdownMenuItem key={t.id} onSelect={() => (has ? untagPerson(t.id, p.id) : tagPeople(t.id, [p.id]))}>{has ? <X className="size-4" /> : <Plus className="size-4" />}{has ? `Remove ${t.name}` : t.name}</DropdownMenuItem>; })}
                  <DropdownMenuItem asChild><Link to="/vcro/watchlists">Manage tags</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { togglePinned(p.id); toast(isPinned ? "Removed from Pinned by you" : "Added to the Pinned by you watchlist"); }} aria-pressed={isPinned}>
            {isPinned ? <><PinOff className="size-4" />Unpin</> : <><Pin className="size-4" />Pin to watchlist</>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button><Play className="size-4" />Run workflow<ChevronDown className="size-3.5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Queue for this person</DropdownMenuLabel>
              {WORKFLOWS.map((w) => <DropdownMenuItem key={w} disabled={myRuns.some((r) => r.workflow === w)} onSelect={() => queue(w)}>{w}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {p.score === null && ready && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm">
          <div className="font-semibold">No score yet</div>
          <p className="mt-1 text-muted-foreground">A score needs at least one simulation result and one learning signal. This person is missing {missing}. Exposure and privilege below are still live.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!hasSims && <Button size="sm" variant="outline" onClick={() => queue("Vishing awareness drill")} disabled={myRuns.some((r) => r.workflow === "Vishing awareness drill")}>Queue a first simulation</Button>}
            <Button asChild size="sm" variant="outline"><Link to="/vcro/signals">Check signal sources</Link></Button>
          </div>
        </div>
      )}

      {p.score !== null && ready && (
        <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed" style={{ borderLeft: `4px solid ${BAND_VAR[p.band]}` }}>
          <span className="font-semibold">{first} scores {p.score}, in the {p.band} band{p.change ? `, ${p.change > 0 ? "up" : "down"} ${Math.abs(p.change)} since ${PREV_MONTH}` : `, unchanged since ${PREV_MONTH}`}.</span>{" "}
          The biggest drivers are {top3.slice(0, -1).join(", ")} and {top3.at(-1)}.
          {reportingPts < 0 && ` Reporting threats takes ${Math.abs(reportingPts)} points off.`}
          {p.impact > 1.02 ? ` Their access raises the result by ${Math.round((p.impact - 1) * 100)}%.` : p.impact < 0.98 ? ` Limited access lowers the result by ${Math.round((1 - p.impact) * 100)}%.` : ""}
          {next[0] && next[0].impact > 0 && <> The most useful next step is to <span className="font-medium">{next[0].action.charAt(0).toLowerCase() + next[0].action.slice(1)}</span>.</>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <Widget title="Riskometer" ready={ready} className="lg:col-span-4">
          <Gauge value={p.score} prev={p.prev} prevLabel={PREV_MONTH} compact {...(p.score !== null ? { confidence: p.confidence } : {})} />
          <div className="mt-4 border-t pt-3"><ConfidenceLine confidence={p.confidence} active={ELEMENTS.filter((e) => signals.active.has(e.id) && p.now[e.id] !== undefined).length} total={ELEMENTS.length} />
            {p.lowConfidence && <p className="mt-1 text-xs text-warning">Provisional: under your {signals.config.minConfidence}% minimum confidence.</p>}
          </div>
          <div className="mt-4 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Personal skill score<InfoTip label="Personal skill score" /></div>
                {p.skill !== null ? <div className="mt-1 text-sm font-semibold">Level {skillLevel(p.skill) + 1} · {SKILL_LEVELS[skillLevel(p.skill)]}</div> : <div className="mt-1 text-xs text-muted-foreground">Available once the person has a score</div>}
              </div>
              {p.skill !== null && (
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums">{p.skill}<span className="text-xs font-medium text-muted-foreground"> / 100</span></div>
                  {p.skillPrev !== null && <div className={`text-xs tabular-nums ${p.skill === p.skillPrev ? "text-muted-foreground" : p.skill > p.skillPrev ? "text-success" : "text-band-critical"}`}>{p.skill === p.skillPrev ? "No change" : `${p.skill > p.skillPrev ? "+" : ""}${p.skill - p.skillPrev}`} vs {PREV_MONTH}</div>}
                </div>
              )}
            </div>
            {p.skill !== null && (
              <div className="mt-3 grid grid-cols-5 gap-1">
                {SKILL_LEVELS.map((l, i) => (
                  <div key={l} className="min-w-0">
                    <div className={`h-1.5 rounded-full ${i <= skillLevel(p.skill!) ? "bg-success" : "bg-muted"}`} />
                    <div className={`mt-1 truncate text-[10px] ${i === skillLevel(p.skill!) ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{l}</div>
                  </div>
                ))}
              </div>
            )}
            {p.skill !== null && skillLevel(p.skill) < 4 && <div className="mt-2 text-[11px] text-muted-foreground">{SKILL_CUTS[skillLevel(p.skill) + 1]! - p.skill} points to {SKILL_LEVELS[skillLevel(p.skill) + 1]}</div>}
          </div>
        </Widget>

        <Widget title="Why this score" ready={ready} className="lg:col-span-8" empty={p.score === null && { text: `Shown once this person has ${missing}.`, action: null }}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl bg-muted/40 p-3 text-sm">
            {[["What they do", pts("Behaviour"), "Behaviour"], ["How exposed they are", pts("Exposure"), "Exposure"]].map(([label, v, k], i) => (
              <span key={k} className="flex items-center gap-2">{i > 0 && <span className="text-muted-foreground">+</span>}
                <span className="rounded-lg border bg-card px-2.5 py-1.5"><span className="block text-[11px] text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{v} pts</span></span></span>
            ))}
            <span className="text-muted-foreground">−</span>
            <span className="rounded-lg border bg-card px-2.5 py-1.5"><span className="block text-[11px] text-muted-foreground">Reporting credit</span><span className="font-semibold tabular-nums text-success">{Math.abs(reportingPts)} pts</span></span>
            <span className="text-muted-foreground">×</span>
            <span className="rounded-lg border bg-card px-2.5 py-1.5"><span className="block text-[11px] text-muted-foreground">What they can reach</span><span className="font-semibold tabular-nums">{p.impact}</span></span>
            <span className="text-muted-foreground">=</span>
            <span className="rounded-lg px-3 py-1.5 text-background" style={{ background: BAND_VAR[p.band] }}><span className="block text-[11px] opacity-90">Score</span><span className="font-bold tabular-nums">{p.score}</span></span>
          </div>
          <div className="mt-4 mb-1.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span>Drivers, largest first</span><span>Points</span></div>
          <div className="space-y-1.5">
            {drivers.map((d) => (
              <div key={d.category} className="grid grid-cols-[minmax(0,150px)_1fr_52px] items-center gap-3 text-sm sm:grid-cols-[200px_1fr_56px]">
                <span className="min-w-0"><span className="block truncate">{d.category}</span></span>
                <span className="h-2 rounded-full bg-muted/60"><span className="block h-full rounded-full" style={{ width: `${Math.max(1.5, (d.points / maxDriver) * 100)}%`, background: d.pillar === "Behaviour" ? "var(--foreground)" : "var(--muted-foreground)" }} /></span>
                <span className="text-right tabular-nums">{d.points}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-foreground" />What they do</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-muted-foreground" />How exposed they are</span>
            <span>Access multiplies the total between 0.8 and 1.3.</span>
          </div>
        </Widget>

        <Widget title="Recommended next steps" ready={ready} className="lg:col-span-12"
          empty={!next.length && !myRuns.length && { text: p.score === null ? "Next steps appear once this person has a score." : "Nothing to recommend: no weak channel, overdue training or recent credential entry.", action: null }}>
          <div className="divide-y">
            {next.map((s) => {
              const r = myRuns.find((x) => x.workflow === s.workflow);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1"><span className="block font-medium">{s.action}</span><span className="block text-xs text-muted-foreground">{s.workflow}</span></span>
                  {s.impact > 0 ? <DeltaBadge value={-s.impact} /> : <span className="text-xs text-muted-foreground">Already at the best-quarter level</span>}
                  {r ? <><StatusBadge on onText={`Queued ${formatStamp(r.at)}`} /><Button variant="ghost" size="sm" onClick={() => clearRun(r.key)}><RotateCcw className="size-3.5" />Cancel</Button></>
                    : <Button variant="outline" size="sm" onClick={() => queue(s.workflow)}><Play className="size-3.5" />Run</Button>}
                </div>
              );
            })}
            {myRuns.filter((r) => !next.some((s) => s.workflow === r.workflow)).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 font-medium">{r.workflow}</span>
                <StatusBadge on onText={`Queued ${formatStamp(r.at)}`} /><Button variant="ghost" size="sm" onClick={() => clearRun(r.key)}><RotateCcw className="size-3.5" />Cancel</Button>
              </div>
            ))}
          </div>
          {next.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Expected drop is modelled: the score if the signals this step addresses reached the level of the best-performing quarter of the organisation.</p>}
        </Widget>

        <Widget title="Channel results" ready={ready} className="lg:col-span-7" empty={!hasSims && { text: "No simulations have reached this person yet.", action: null }}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead>Fell for</TableHead><TableHead className="text-right">Reported</TableHead><TableHead className="whitespace-nowrap text-right">Time to click</TableHead></TableRow></TableHeader>
              <TableBody>
                {p.channels.filter((c) => c.attempts > 0).map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell className="font-medium">{c.channel}{c.channel === worst && <span className="ml-2 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">Weakest</span>}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${c.failRate * 100}%`, background: c.failRate >= 0.5 ? "var(--band-high)" : "var(--band-elevated)" }} /></span>
                        <span className="whitespace-nowrap tabular-nums">{c.failures} of {c.attempts}</span></span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.reports} of {c.attempts}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.avgTtc === null ? <span className="text-muted-foreground">No clicks</span> : c.avgTtc < signals.config.impulsiveSeconds ? <span className="text-warning">{c.avgTtc} s, impulsive</span> : `${c.avgTtc} s`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Simulated attacks over the last 12 months. A click under {signals.config.impulsiveSeconds} seconds counts as impulsive.</p>
        </Widget>
        <Widget title="Lure profile" ready={ready} className="lg:col-span-5" empty={!hasSims && { text: "Needs simulation results.", action: null }}>
          <div className="h-60">
            <ResponsiveContainer>
              <RadarChart data={lures} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="lure" tick={AXIS} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ ...AXIS, fontSize: 9 }} angle={90} tickFormatter={(v) => `${v}%`} />
                <Radar dataKey="rate" name="Failure rate" stroke="var(--band-high)" fill="var(--band-high)" fillOpacity={0.2} isAnimationActive={false} />
                <RTooltip content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as { lure: string; rate: number } | undefined;
                  return active && d ? <ChartTip>{d.lure}: {d.rate}% failure</ChartTip> : null;
                }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Widget>

        <Widget title="Activity" ready={ready} className="lg:col-span-12"
          action={
            <ToggleGroup type="single" size="sm" variant="outline" value={type} onValueChange={(v) => v && setType(v)} aria-label="Activity type" className="flex-wrap">
              {["All", ...TYPES].map((t) => <ToggleGroupItem key={t} value={t} className="px-2.5 text-xs">{t}</ToggleGroupItem>)}
            </ToggleGroup>
          }
          empty={activity.length === 0 && { text: "No activity for this type", action: <Button variant="outline" size="sm" onClick={() => setType("All")}>Show all</Button> }}>
          <ol className="relative ml-1.5 max-h-96 space-y-3 overflow-y-auto border-l pl-5">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[24px] top-1.5 size-2 rounded-full bg-muted-foreground ring-2 ring-card" aria-hidden />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{a.title}</span>
                  <SoftBadge>{a.type}</SoftBadge>
                  {a.sim && <><PayloadBadge payload={a.sim.payload} /><SoftBadge>Difficulty {a.sim.difficulty}</SoftBadge></>}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatAge(a.ageDays)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{a.source} · {a.detail}</div>
              </li>
            ))}
          </ol>
        </Widget>

        <Widget title="Exposure" ready={ready} className="lg:col-span-4"><Findings items={exposure} none="Nothing public found about this person." missing={missingSources(signals, "Exposure")} /></Widget>
        <Widget title="Privilege" ready={ready} className="lg:col-span-4"><Findings items={access} none="Standard user access." missing={missingSources(signals, "Privilege")} /></Widget>
        <Widget title="Behaviour profile" ready={ready} className="lg:col-span-4" empty={p.score === null && { text: "Needs a score.", action: null }}>
          <svg viewBox="-10 0 250 200" className="w-full" role="img" aria-label={`Knowledge ${p.knowledge}, safe behaviour ${behaviourSafe}`}>
            <rect x="30" y="8" width="200" height="160" rx="4" fill="none" stroke="var(--border)" />
            <line x1="130" x2="130" y1="8" y2="168" stroke="var(--border)" strokeDasharray="4 4" /><line x1="30" x2="230" y1="88" y2="88" stroke="var(--border)" strokeDasharray="4 4" />
            {[["Safe by habit", 36, 22, "start"], ["Guardian", 224, 22, "end"], ["Needs coaching", 36, 160, "start"], ["Knows, but slips", 224, 160, "end"]].map(([t, x, y, a]) => (
              <text key={t as string} x={x as number} y={y as number} textAnchor={a as "start"} fontSize={10} className="fill-muted-foreground">{t}</text>
            ))}
            <circle cx={30 + p.knowledge * 2} cy={168 - behaviourSafe * 1.6} r={6} className="fill-foreground" stroke="var(--card)" strokeWidth={2} />
            <text x="130" y="186" textAnchor="middle" fontSize={10} className="fill-muted-foreground">Knowledge: assessment results</text>
            <text transform="translate(12 88) rotate(-90)" textAnchor="middle" fontSize={10} className="fill-muted-foreground">Safe behaviour</text>
          </svg>
        </Widget>
      </div>
    </div>
  );
}
