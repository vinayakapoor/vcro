import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Circle, Gauge, GraduationCap, Megaphone, Plug, Repeat, Scale, Users, Eye, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { BAND_VAR } from "@/features/shared/band";
import { fmt, orgSummary, signalCoverage, useRuns, useSavedWatchlists, usePinned, useSignals, useVisited } from "@/lib/api";
import { BAND_RANGES } from "@/lib/scoring";

export const Route = createFileRoute("/vcro/getting-started")({
  head: () => ({
    meta: [
      { title: "Getting started | HumanFirewall vCRO" },
      { name: "description", content: "Set up vCRO step by step: connect signals, read the Riskometer, act through training and awareness." },
      { property: "og:title", content: "Getting started | HumanFirewall vCRO" },
      { property: "og:description", content: "Set up vCRO step by step: connect signals, read the Riskometer, act through training and awareness." },
    ],
  }),
  component: GettingStarted,
});


function GettingStarted() {
  const ready = useReady();
  const sig = useSignals();
  const cov = signalCoverage(sig);
  const s = orgSummary(sig);
  const live = cov.sources.filter((x) => x.on).length;
  const visited = useVisited();
  const queued = useRuns().filter((r) => r.status === "Queued").length;
  const lists = useSavedWatchlists().length + (usePinned().length ? 1 : 0);
  const customWeights = Object.keys(sig.weights).length > 0;

  // Each tick reads live state: nothing here is pre-ticked.
  const steps = [
    { icon: Plug, title: "Connect signals", body: "Turn on HumanFirewall modules and integrations. More signals give a narrower likely range.", done: s.confidence >= sig.config.minConfidence, meta: `${live} of ${cov.sources.length} sources live · confidence ${s.confidence}%`, need: `Done when confidence reaches your ${sig.config.minConfidence}% minimum`, to: "/vcro/signals" as const, cta: "Open Signals" },
    { icon: Scale, title: "Review weightage", body: "Check how Behaviour, Exposure, Privilege and Reporting add up to the score, and adjust if your priorities differ.", done: visited.includes("weightage"), meta: customWeights ? "Custom weights applied" : "Default weights in use", need: "Done when you have opened Weightage", to: "/vcro/weightage" as const, cta: "Open Weightage" },
    { icon: Gauge, title: "Read the Riskometer", body: "One score from 0 to 100. Higher means riskier. The band around the dial shows the likely range.", done: visited.includes("riskometer"), meta: `Today ${s.score} · ${s.band}`, need: "Done when you have opened the Riskometer", to: "/vcro/riskometer" as const, cta: "Open Riskometer" },
    { icon: Users, title: "Find who and why", body: "Sort people by score and weakest signal. Open a person to see each driver in points.", done: visited.includes("people"), meta: `${fmt(s.highCount)} people High or Critical`, need: "Done when you have opened People", to: "/vcro/people" as const, cta: "Open People" },
    { icon: Eye, title: "Watch the groups that matter", body: "Built-in watchlists update as signals change. Create your own, or pin people by hand.", done: lists > 0, meta: lists ? `${lists} of your own` : `${fmt(s.vipAttacked)} very attacked VIPs to start with`, need: "Done when you create a watchlist or pin a person", to: "/vcro/watchlists" as const, cta: "Open Watchlists" },
    { icon: Repeat, title: "Act and measure", body: "Run a recommended action, then watch the trend and department heatmap move.", done: queued > 0, meta: queued ? `${queued} queued` : "Nothing queued yet", need: "Done when you run a recommended action", to: "/vcro/riskometer" as const, cta: "See actions" },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const nextIdx = steps.findIndex((x) => !x.done);

  const loop = [
    { icon: Zap, title: "JIT nudge", body: "Right after a risky action, a short lesson lands in the moment." },
    { icon: GraduationCap, title: "LMS and PhishTrainer", body: "Assigned by weakest signal and lure, not one course for all." },
    { icon: Megaphone, title: "Announcements", body: "Threat alerts and policy updates, tracked to acknowledgement." },
    { icon: Repeat, title: "Re-test", body: "A follow-up simulation on the same channel proves the change." },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Getting started" subtitle={doneCount === steps.length ? "Setup complete. Everything below stays live." : "Six steps from first connection to first action"} />

      <Widget title="Setup guide" ready={ready}
        action={
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
            <span className="text-xs tabular-nums text-muted-foreground">{doneCount} of {steps.length} done</span>
          </div>
        }>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {steps.map((st, i) => (
            <li key={st.title} className={`flex flex-col rounded-xl border bg-card p-4 ${i === nextIdx ? "ring-2 ring-foreground" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><st.icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">Step {i + 1}{i === nextIdx && <span className="ml-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">Next</span>}</div>
                  <div className="truncate text-sm font-semibold">{st.title}</div>
                </div>
                {st.done ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" /> : <Circle className="size-5 shrink-0 text-muted-foreground/50" aria-label="To do" />}
              </div>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">{st.body}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <span className="min-w-0 text-xs tabular-nums text-muted-foreground">{st.meta}{!st.done && <span className="block text-[11px] opacity-80">{st.need}</span>}</span>
                <Button asChild variant={i === nextIdx ? "default" : "ghost"} size="sm" className="h-7 px-2"><Link to={st.to}>{st.cta}<ArrowRight className="size-3.5" /></Link></Button>
              </div>
            </li>
          ))}
        </ol>
      </Widget>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="How the score works" ready={ready}>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">Likelihood comes from what people do and how exposed they are. Reporting real and simulated threats takes up to 15 points off Behaviour. Privilege then scales the result: more access, more impact.</p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 font-medium">
              <span>(</span><span className="rounded-md bg-card px-2 py-1 shadow-sm">Behaviour less reporting × 0.65</span><span>+</span>
              <span className="rounded-md bg-card px-2 py-1 shadow-sm">Exposure × 0.35</span><span>)</span><span>×</span>
              <span className="rounded-md bg-card px-2 py-1 shadow-sm">Privilege impact 0.8 to 1.3</span>
            </div>
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full">
                {BAND_RANGES.map(({ band }) => <span key={band} className="flex-1" style={{ background: BAND_VAR[band] }} />)}
              </div>
              <div className="mt-1.5 grid grid-cols-5 text-center text-xs">
                {BAND_RANGES.map(({ band, from, to }) => <span key={band}><span className="block font-medium">{band}</span><span className="text-muted-foreground tabular-nums">{from} to {to}</span></span>)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Signals that are not connected drop out and the rest share their weight. Confidence shows how much of the model is fed by live data.</p>
          </div>
        </Widget>

        <Widget title="Training and awareness loop" ready={ready}>
          <ol className="relative space-y-4 border-l pl-6">
            {loop.map((l) => (
              <li key={l.title} className="relative">
                <span className="absolute -left-[37px] grid size-6 place-items-center rounded-full border bg-card"><l.icon className="size-3.5" /></span>
                <div className="text-sm font-semibold">{l.title}</div>
                <p className="text-sm text-muted-foreground">{l.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">Each step feeds Learning, Culture and Reporting signals back into the score.</p>
        </Widget>
      </div>
    </div>
  );
}
