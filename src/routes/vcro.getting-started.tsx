import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Circle, Gauge, GraduationCap, Megaphone, Plug, Repeat, Scale, Users, Eye, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { BAND_VAR } from "@/features/shared/band";
import { orgSummary, signalCoverage, useSignals } from "@/lib/api";

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

const BANDS = [["Low", "0-19"], ["Guarded", "20-39"], ["Elevated", "40-59"], ["High", "60-79"], ["Critical", "80-100"]] as const;

function GettingStarted() {
  const ready = useReady();
  const sig = useSignals();
  const cov = signalCoverage(sig);
  const s = orgSummary(sig);
  const live = cov.sources.filter((x) => x.on).length;

  const steps = [
    { icon: Plug, title: "Connect signals", body: "Turn on HumanFirewall modules and integrations. More signals give a narrower likely range.", done: live >= 10, meta: `${live} of ${cov.sources.length} sources live`, to: "/vcro/signals" as const, cta: "Open Signals" },
    { icon: Scale, title: "Review weightage", body: "Check how Behaviour, Exposure, Privilege and Reporting add up to the score.", done: false, meta: "Behaviour 45% · Exposure 25% · Privilege 20% · Reporting 10%", to: "/vcro/signals" as const, cta: "See elements" },
    { icon: Gauge, title: "Read the Riskometer", body: "One score from 0 to 100. Higher means riskier. The band around the dial shows the likely range.", done: s.score > 0, meta: `Today ${s.score} · ${s.band} · confidence ${s.confidence}%`, to: "/vcro/riskometer" as const, cta: "Open Riskometer" },
    { icon: Users, title: "Find who and why", body: "Sort people by score and weakest signal. Open a person to see each driver in points.", done: s.highCount >= 0, meta: `${s.highCount} people High or Critical`, to: "/vcro/people" as const, cta: "Open People" },
    { icon: Eye, title: "Watch the groups that matter", body: "Watchlists update as signals change: VIPs, repeat clickers, credential submitters and more.", done: true, meta: `${s.vipAttacked} very attacked VIPs`, to: "/vcro/watchlists" as const, cta: "Open Watchlists" },
    { icon: Repeat, title: "Act and measure", body: "Run recommended workflows, then watch the trend and department heatmap move.", done: false, meta: "Recommended actions on the Riskometer", to: "/vcro/riskometer" as const, cta: "See actions" },
  ];
  const doneCount = steps.filter((x) => x.done).length;

  const loop = [
    { icon: Zap, title: "JIT nudge", body: "Right after a risky action, a short lesson lands in the moment." },
    { icon: GraduationCap, title: "LMS and PhishTrainer", body: "Assigned by weakest signal and lure, not one course for all." },
    { icon: Megaphone, title: "Announcements", body: "Threat alerts and policy updates, tracked to acknowledgement." },
    { icon: Repeat, title: "Re-test", body: "A follow-up simulation on the same channel proves the change." },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Getting started" subtitle="Set up vCRO and turn the score into action" />

      <Widget title="Setup guide" ready={ready}
        action={
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
            <span className="text-xs tabular-nums text-muted-foreground">{doneCount} of {steps.length} done</span>
          </div>
        }>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {steps.map((st, i) => (
            <li key={st.title} className="flex flex-col rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><st.icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">Step {i + 1}</div>
                  <div className="truncate text-sm font-semibold">{st.title}</div>
                </div>
                {st.done ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" /> : <Circle className="size-5 shrink-0 text-muted-foreground/50" aria-label="To do" />}
              </div>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">{st.body}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <span className="text-xs tabular-nums text-muted-foreground">{st.meta}</span>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2"><Link to={st.to}>{st.cta}<ArrowRight className="size-3.5" /></Link></Button>
              </div>
            </li>
          ))}
        </ol>
      </Widget>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="How the score works" ready={ready}>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">Likelihood comes from what people do and how exposed they are. Privilege scales the impact. Reporting real and simulated threats takes points off.</p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 font-medium">
              <span className="rounded-md bg-card px-2 py-1 shadow-sm">Behaviour × 0.65</span><span>+</span>
              <span className="rounded-md bg-card px-2 py-1 shadow-sm">Exposure × 0.35</span><span>×</span>
              <span className="rounded-md bg-card px-2 py-1 shadow-sm">Privilege impact</span><span>−</span>
              <span className="rounded-md bg-card px-2 py-1 shadow-sm">Reporting offset</span>
            </div>
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full">
                {BANDS.map(([b]) => <span key={b} className="flex-1" style={{ background: BAND_VAR[b] }} />)}
              </div>
              <div className="mt-1.5 grid grid-cols-5 text-center text-xs">
                {BANDS.map(([b, r]) => <span key={b}><span className="block font-medium">{b}</span><span className="text-muted-foreground tabular-nums">{r}</span></span>)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Unconnected signals drop out and weights renormalise. Confidence shows the connected share of model weight.</p>
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
