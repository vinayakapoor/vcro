import { useState } from "react";
import { InfoTip } from "@/features/shared/info";

const SKILL_LEVELS = ["Starter", "Aware", "Capable", "Strong", "Champion"];
const SKILL_CUTS = [0, 40, 55, 70, 85];
const skillLevel = (v: number) => SKILL_CUTS.filter((c) => v >= c).length - 1;
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { MoreHorizontal, Play } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Widget, EmptyLine } from "@/features/shared/widget";
import { Gauge } from "@/features/shared/gauge";
import { DeltaBadge, PayloadBadge, SoftBadge, TagBadge } from "@/features/shared/band";
import { usePrefs, useReady } from "@/features/shared/prefs";
import { AXIS, ChartTip, ConfidenceLine } from "@/features/riskometer/widgets";
import { ELEMENTS, LURES, PREV_MONTH, formatAge, getPerson, initials, managerName, nextSteps, pseudonym, useSignals } from "@/lib/api";
import { PEOPLE } from "@/data/people";
import type { ActivityType } from "@/data/people";

export const Route = createFileRoute("/vcro/people/$id")({
  loader: ({ params }) => {
    const p = PEOPLE.find((x) => x.id === params.id);
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

function PersonPage() {
  const { id } = Route.useParams();
  const ready = useReady();
  const signals = useSignals();
  const { privacy } = usePrefs();
  const [type, setType] = useState<string>("All");
  const p = getPerson(signals, id);
  if (!p) return <PersonNotFound />;
  const name = privacy ? pseudonym(p.id) : p.name;

  // Waterfall
  const contribs = p.contributions.map((c) => ({ label: c.category, points: Math.round(c.points * 10) / 10 }));
  const impactPts = Math.round(p.likelihood * (p.impact - 1) * 10) / 10;
  const bars = [...contribs, { label: `Impact multiplier x${p.impact}`, points: impactPts }];
  let run = 0;
  const steps = bars.map((b) => { const start = run; run += b.points; return { ...b, start, end: run }; });
  const maxV = Math.max(100, ...steps.map((s) => Math.max(s.start, s.end)));

  const lures = LURES.map((l) => ({ lure: l, rate: p.lures[l] }));
  const activity = p.activity.filter((a) => type === "All" || a.type === type);
  const knowledge = p.knowledge;
  const behaviourSafe = 100 - p.behaviour;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="size-14"><AvatarFallback>{privacy ? "EM" : initials(p.name)}</AvatarFallback></Avatar>
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{p.role} · {p.department} · Manager {privacy ? "hidden" : managerName(signals, p.managerId)} · {p.location}</p>
            <div className="mt-2 flex flex-wrap gap-1">{p.tags.map((t) => <TagBadge key={t} tag={t} />)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => toast("Training assigned")}>Assign training</Button>
          <Button onClick={() => toast("Workflow started")}><Play className="size-4" />Run workflow</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => toast("Added to watchlist")}>Add to watchlist</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast("Risk booster applied")}>Apply risk booster</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast("Manager notified")}>Notify manager</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Widget title="Riskometer" ready={ready} className="lg:col-span-4">
          <Gauge value={p.score} prev={p.prev} prevLabel={PREV_MONTH} compact />
          <div className="mt-4 border-t pt-3"><ConfidenceLine confidence={p.confidence} active={ELEMENTS.filter((e) => signals.active.has(e.id) && p.readings[e.id] !== undefined).length} total={ELEMENTS.length} /></div>
          <div className="mt-4 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Personal skill score<InfoTip label="Personal skill score" /></div>
                {p.skill !== null ? <div className="mt-1 text-sm font-semibold">Level {skillLevel(p.skill) + 1} · {SKILL_LEVELS[skillLevel(p.skill)]}</div> : <div className="mt-1 text-[11px] text-muted-foreground">Higher is better</div>}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{p.skill ?? "None"}<span className="text-xs font-medium text-muted-foreground"> / 100</span></div>
                {p.skill !== null && p.skillPrev !== null && <div className={`text-xs tabular-nums ${p.skill >= p.skillPrev ? "text-success" : "text-band-critical"}`}>{p.skill >= p.skillPrev ? "+" : ""}{p.skill - p.skillPrev} vs {PREV_MONTH}</div>}
              </div>
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
        <Widget title="Score breakdown" ready={ready} className="lg:col-span-8" empty={p.score === null && { text: "Needs 1 simulation and 1 learning signal", action: <Button asChild variant="outline" size="sm"><Link to="/vcro/signals">Connect source</Link></Button> }}>
          <div className="space-y-1.5">
            {steps.map((s) => {
              const lo = Math.min(s.start, s.end), hi = Math.max(s.start, s.end);
              const neg = s.points < 0;
              const isImpact = s.label.startsWith("Impact");
              return (
                <div key={s.label} className="grid grid-cols-[minmax(0,140px)_1fr_68px] sm:grid-cols-[180px_1fr_72px] items-center gap-3 text-sm">
                  <span className="truncate">{s.label}</span>
                  <span className="relative h-4 rounded bg-muted/50">
                    <span className="absolute inset-y-0 rounded" style={{ left: `${(lo / maxV) * 100}%`, width: `${Math.max(0.5, ((hi - lo) / maxV) * 100)}%`, background: neg ? "var(--success)" : isImpact ? "var(--foreground)" : "var(--muted-foreground)" }} />
                  </span>
                  <span className={`whitespace-nowrap text-right tabular-nums ${neg ? "text-success" : ""}`}>{s.points > 0 ? "+" : ""}{s.points} pts</span>
                </div>
              );
            })}
            <div className="grid grid-cols-[minmax(0,140px)_1fr_68px] sm:grid-cols-[180px_1fr_72px] gap-3 border-t pt-2 text-sm font-semibold">
              <span>Score</span><span className="text-xs font-normal text-muted-foreground">0 to {maxV} pts</span><span className="text-right tabular-nums">{p.score ?? "None"}</span>
            </div>
          </div>
        </Widget>

        <Widget title="Channel results" ready={ready} className="lg:col-span-7">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Failures</TableHead><TableHead className="text-right">Reports</TableHead><TableHead className="whitespace-nowrap text-right">Avg time to click</TableHead></TableRow></TableHeader>
              <TableBody>
                {p.channels.map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell className="font-medium">{c.channel}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.attempts}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.failures}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.reports}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.avgTtc === null ? "None" : `${c.avgTtc} s`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Widget>
        <Widget title="Lure profile" ready={ready} className="lg:col-span-5">
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
          <ol className="relative max-h-96 space-y-3 overflow-y-auto border-l pl-5">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-muted-foreground" aria-hidden />
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

        <Widget title="Exposure" ready={ready} className="lg:col-span-4" empty={p.osint.length === 0 && { text: "No OSINT findings", action: <Button asChild variant="outline" size="sm"><Link to="/vcro/signals">View signals</Link></Button> }}>
          <ul className="space-y-2 text-sm">{p.osint.map((o) => <li key={o.item} className="flex items-center justify-between gap-2"><span>{o.item}</span><SoftBadge className={SEV[o.severity]}>{o.severity}</SoftBadge></li>)}</ul>
        </Widget>
        <Widget title="Privilege" ready={ready} className="lg:col-span-4">
          <ul className="space-y-2 text-sm">{p.access.map((o) => <li key={o.item} className="flex items-center justify-between gap-2"><span>{o.item}</span><SoftBadge className={SEV[o.level]}>{o.level}</SoftBadge></li>)}</ul>
        </Widget>
        <Widget title="Behaviour profile" ready={ready} className="lg:col-span-4">
          <svg viewBox="-10 0 250 200" className="w-full" role="img" aria-label={`Knowledge ${knowledge}, safe behaviour ${behaviourSafe}`}>
            <rect x="30" y="8" width="200" height="160" fill="none" stroke="var(--border)" />
            <line x1="130" x2="130" y1="8" y2="168" stroke="var(--border)" /><line x1="30" x2="230" y1="88" y2="88" stroke="var(--border)" />
            {[["Learner", 36, 22, "start"], ["Guardian", 224, 22, "end"], ["Risk-taker", 36, 160, "start"], ["Drifter", 224, 160, "end"]].map(([t, x, y, a]) => (
              <text key={t as string} x={x as number} y={y as number} textAnchor={a as "start"} fontSize={10} className="fill-muted-foreground">{t}</text>
            ))}
            <circle cx={30 + knowledge * 2} cy={168 - behaviourSafe * 1.6} r={6} className="fill-foreground" />
            <text x="130" y="186" textAnchor="middle" fontSize={10} className="fill-muted-foreground">Knowledge (0-100)</text>
            <text transform="translate(12 88) rotate(-90)" textAnchor="middle" fontSize={10} className="fill-muted-foreground">Safe behaviour (0-100)</text>
          </svg>
        </Widget>

        <Widget title="Recommended next steps" ready={ready} className="lg:col-span-12">
          <div className="divide-y">
            {nextSteps(p).map((s) => (
              <div key={s.action} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="flex-1 font-medium">{s.action}</span>
                <span className="text-xs text-muted-foreground">{s.workflow}</span>
                <DeltaBadge value={-s.impact} />
                <Button variant="outline" size="sm" onClick={() => toast(`${s.workflow} started`)}>Run</Button>
              </div>
            ))}
          </div>
        </Widget>
      </div>
    </div>
  );
}
