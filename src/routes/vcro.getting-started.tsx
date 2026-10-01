import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Circle, Eye, FileBarChart, Gauge, Network, Plug, Repeat, Scale, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { BAND_VAR } from "@/features/shared/band";
import { DEPARTMENTS, TAGS, fmt, orgSummary, signalStats, useCustomTags, usePinned, useReports, useRuns, useSavedWatchlists, useSettings, useSignals, useVisited } from "@/lib/api";
import { BAND_RANGES } from "@/lib/scoring";
import { PEOPLE } from "@/data/people";

export const Route = createFileRoute("/vcro/getting-started")({
  head: () => ({
    meta: [
      { title: "Getting started | HumanFirewall vCRO" },
      { name: "description", content: "Set up vCRO for your organisation: connect data, tune the model, set a target, act and report." },
      { property: "og:title", content: "Getting started | HumanFirewall vCRO" },
      { property: "og:description", content: "Set up vCRO for your organisation: connect data, tune the model, set a target, act and report." },
    ],
  }),
  component: GettingStarted,
});

const PHASES = ["Set up", "Understand", "Act"] as const;

function GettingStarted() {
  const ready = useReady();
  const sig = useSignals();
  const settings = useSettings();
  const s = orgSummary(sig);
  const st = signalStats(sig);
  const visited = useVisited();
  const queued = useRuns().filter((r) => r.status === "Queued").length;
  const customTags = useCustomTags();
  const own = useSavedWatchlists().length + customTags.length + (usePinned().length ? 1 : 0);
  const reports = useReports().length;
  const customWeights = Object.keys(sig.weights).length > 0;
  const managers = new Set(PEOPLE.map((p) => p.managerId)).size - 1;
  const liveTags = TAGS.filter((t) => sig.connected.has(t.sourceId)).length;
  const hr = sig.connected.has("int-hr");

  // Every tick reads live state. Nothing is pre-ticked.
  const steps = [
    { phase: 0, icon: Plug, title: "Connect your data", body: "Turn on HumanFirewall modules and connect your security stack. The more sources, the narrower the likely range around the score.",
      done: s.confidence >= sig.config.minConfidence, meta: `${st.inbound.on} integrations and ${st.modules.total} modules · confidence ${s.confidence}%`, need: `Reach your ${sig.config.minConfidence}% minimum confidence`, to: "/vcro/signals" as const, cta: "Open Signals" },
    { phase: 0, icon: Network, title: "Check your organisation", body: "Confirm the departments, teams and reporting lines look right. Scores roll up along this structure.",
      done: hr && visited.includes("departments"), meta: `${fmt(s.total)} people · ${DEPARTMENTS.length} departments · ${fmt(managers)} teams`, need: hr ? "Open Departments to review" : "Connect the HR system first", to: "/vcro/departments" as const, cta: "Open Departments" },
    { phase: 0, icon: Scale, title: "Tune the model", body: "See how Behaviour, Exposure, Privilege and Reporting add up, and shift the weights if your priorities differ.",
      done: visited.includes("weightage"), meta: customWeights ? "Custom weights applied" : "Default weights in use", need: "Open Weightage to review", to: "/vcro/weightage" as const, cta: "Open Weightage" },
    { phase: 1, icon: Gauge, title: "Read the Riskometer", body: "One score for the organisation, with what moved it, where the risk sits and which signals are weakest.",
      done: visited.includes("riskometer"), meta: `Today ${s.score} · ${s.band} · ${fmt(s.highCount)} people High or Critical`, need: "Open the Riskometer", to: "/vcro/riskometer" as const, cta: "Open Riskometer" },
    { phase: 1, icon: Target, title: "Set a target and alerts", body: "Agree the score you are working towards and when vCRO should raise a flag.",
      done: settings.targetScore !== null, meta: settings.targetScore !== null ? `Target ${settings.targetScore} · ${s.score - settings.targetScore > 0 ? `${s.score - settings.targetScore} pts to go` : "reached"}` : "No target set", need: "Set a target score in Settings", to: "/vcro/settings" as const, cta: "Open Settings" },
    { phase: 1, icon: Eye, title: "Decide who to watch", body: "Tags and watchlists group people by who they are and how they behave. Add the groups that matter to you.",
      done: own > 0, meta: own ? `${own} of your own · ${liveTags} built-in tags live` : `${liveTags} built-in tags live`, need: "Create a watchlist or tag, or pin a person", to: "/vcro/watchlists" as const, cta: "Open Watchlists" },
    { phase: 2, icon: Repeat, title: "Act on the score", body: "Run a recommended action, or send the score to the tools that enforce and respond.",
      done: queued > 0 || st.outbound.on > 0, meta: `${queued} actions queued · ${st.outbound.on} tools acting on the score`, need: "Run an action or connect an Actions out integration", to: "/vcro/riskometer" as const, cta: "See actions" },
    { phase: 2, icon: FileBarChart, title: "Report to the board", body: "Generate the board pack, a monthly summary or audit evidence, as it stands today.",
      done: reports > 0, meta: reports ? `${reports} generated` : "None generated yet", need: "Generate a report", to: "/vcro/reports" as const, cta: "Open Reports" },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const nextIdx = steps.findIndex((x) => !x.done);

  const glance: [string, string][] = [
    ["People", fmt(s.total)], ["Scored", fmt(s.scored)], ["Departments", String(DEPARTMENTS.length)], ["Teams", fmt(managers)],
    ["Integrations connected", `${st.integrations.on}`], ["Signals live", `${st.active} of ${st.total}`], ["Confidence", `${s.confidence}%`], ["Tags live", `${liveTags + customTags.length}`],
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Getting started" subtitle={doneCount === steps.length ? "Setup complete. Everything below stays live." : "Eight steps to a risk score your organisation can act on"}
        action={ready && nextIdx >= 0 ? <Button asChild><Link to={steps[nextIdx]!.to}>Continue: {steps[nextIdx]!.title}<ArrowRight className="size-4" /></Link></Button> : undefined} />

      <Widget title="Setup guide" ready={ready}
        action={
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
            <span className="text-xs tabular-nums text-muted-foreground">{doneCount} of {steps.length} done</span>
          </div>
        }>
        <div className="space-y-5">
          {PHASES.map((ph, pi) => (
            <section key={ph}>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{ph}</span><span className="h-px flex-1 bg-border" /><span className="tabular-nums">{steps.filter((x) => x.phase === pi && x.done).length} of {steps.filter((x) => x.phase === pi).length}</span>
              </div>
              <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {steps.map((stp, i) => stp.phase !== pi ? null : (
                  <li key={stp.title} className={`flex flex-col rounded-xl border bg-card p-4 ${i === nextIdx ? "ring-2 ring-foreground" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><stp.icon className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground">Step {i + 1}{i === nextIdx && <span className="ml-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">Next</span>}</div>
                        <div className="truncate text-sm font-semibold">{stp.title}</div>
                      </div>
                      {stp.done ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" /> : <Circle className="size-5 shrink-0 text-muted-foreground/50" aria-label="To do" />}
                    </div>
                    <p className="mt-3 flex-1 text-sm text-muted-foreground">{stp.body}</p>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t pt-3">
                      <span className="min-w-0 text-xs tabular-nums text-muted-foreground">{stp.meta}{!stp.done && <span className="block text-[11px] opacity-80">To finish: {stp.need}</span>}</span>
                      <Button asChild variant={i === nextIdx ? "default" : "ghost"} size="sm" className="h-7 px-2"><Link to={stp.to}>{stp.cta}<ArrowRight className="size-3.5" /></Link></Button>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </Widget>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="How the score works" ready={ready}>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">What people do, plus how exposed they are, less a credit for reporting, scaled by what they can reach.</p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 font-medium">
              <span>(</span><span className="rounded-md bg-card px-2 py-1 shadow-sm">Behaviour less reporting × 0.65</span><span>+</span>
              <span className="rounded-md bg-card px-2 py-1 shadow-sm">Exposure × 0.35</span><span>)</span><span>×</span>
              <span className="rounded-md bg-card px-2 py-1 shadow-sm">Privilege impact 0.8 to 1.3</span>
            </div>
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full">{BAND_RANGES.map(({ band }) => <span key={band} className="flex-1" style={{ background: BAND_VAR[band] }} />)}</div>
              <div className="mt-1.5 grid grid-cols-5 text-center text-xs">
                {BAND_RANGES.map(({ band, from, to }) => <span key={band}><span className="block font-medium">{band}</span><span className="tabular-nums text-muted-foreground">{from} to {to}</span></span>)}
              </div>
            </div>
          </div>
        </Widget>

        <Widget title="Your setup at a glance" ready={ready}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {glance.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>)}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            <Button asChild variant="outline" size="sm"><Link to="/vcro/signals" search={{ tab: "integrations" }}>Add a source</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/vcro/watchlists">Manage tags and groups</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/vcro/settings">Scoring and privacy settings</Link></Button>
          </div>
        </Widget>
      </div>
    </div>
  );
}
