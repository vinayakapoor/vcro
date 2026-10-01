import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PageHeader, StatCard, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { InfoTip } from "@/features/shared/info";
import { applyState, ELEMENTS, orgScoreFor, previewWeights, signalStats, useSignals } from "@/lib/api";
import { BAND_RANGES } from "@/lib/scoring";
import { useEffect, useMemo } from "react";
import { CATEGORY_WEIGHTS, LIKELIHOOD_WEIGHTS, PILLAR_SHARE, type Pillar } from "@/lib/scoring";
import { Gauge, Layers, Scale, Sigma } from "lucide-react";

export const Route = createFileRoute("/vcro/weightage")({
  head: () => ({
    meta: [
      { title: "Weightage | HumanFirewall vCRO" },
      { name: "description", content: "How each pillar, category and signal counts towards the human risk score." },
      { property: "og:title", content: "Weightage | HumanFirewall vCRO" },
      { property: "og:description", content: "How each pillar, category and signal counts towards the human risk score." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WeightagePage,
});

const PRESETS = {
  Default: {} as Record<string, number>,
  "Behaviour first": { Simulations: 45, "Real-world incidents": 45, Learning: 10, Culture: 5 },
  "Incidents first": { Simulations: 20, "Real-world incidents": 50, "Access and admin": 45 },
  "Training first": { Learning: 35, Culture: 20 },
};
const PILLARS = Object.keys(PILLAR_SHARE) as Pillar[];
function WeightagePage() {
  const ready = useReady();
  const s = useSignals();
  const st = signalStats(s);
  const [draft, setDraft] = useState<Record<string, number>>(s.weights);
  // Saved weights arrive after first paint; pick them up unless the admin has already started editing.
  useEffect(() => setDraft(s.weights), [s.weights]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.weights);
  const custom = Object.keys(s.weights).length > 0;
  const now = orgScoreFor(s).score;
  const next = dirty ? orgScoreFor(previewWeights(draft)).score : now;
  const wOf = (p: string, c: string) => draft[c] ?? (CATEGORY_WEIGHTS as Record<string, Record<string, number>>)[p]?.[c] ?? 0;
  const preset = (name: keyof typeof PRESETS) => setDraft(PRESETS[name]);
  /** Share of the whole model each signal carries under the weights on screen. */
  const effective = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of PILLARS) {
      const els = ELEMENTS.filter((e) => e.pillar === p);
      if (p === "Reporting") { for (const e of els) out[e.id] = PILLAR_SHARE[p] / els.length; continue; }
      const cats = Object.keys(CATEGORY_WEIGHTS[p as keyof typeof CATEGORY_WEIGHTS]);
      const total = cats.reduce((a, c) => a + wOf(p, c), 0) || 1;
      for (const c of cats) { const ce = els.filter((e) => e.category === c); for (const e of ce) out[e.id] = (PILLAR_SHARE[p] * wOf(p, c)) / total / ce.length; }
    }
    return out;
  }, [draft]);
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Weightage" subtitle="How every signal counts towards the score" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard ready={ready} label="Pillars" icon={Layers} value={PILLARS.length} caption="Behaviour leads at 45%" />
        <StatCard ready={ready} label="Active signals" icon={Sigma} value={`${st.active} / ${st.total}`} caption="Signals in the score" />
        <StatCard ready={ready} label="Score confidence" icon={Gauge} value={`${st.confidence}%`} caption="Connected weight share" />
        <StatCard ready={ready} label="Likelihood split" icon={Scale} value={`${LIKELIHOOD_WEIGHTS.Behaviour * 100} / ${LIKELIHOOD_WEIGHTS.Exposure * 100}`} caption="Behaviour / Exposure" />
      </div>

      <Widget title="Weights by pillar" ready={ready} action={
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => preset(k)}>{k}</Button>)}
        </div>}>
        <div className="mb-4 grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 text-sm">
            <span className="font-semibold">Organisation score {now}{dirty && <> → {next}</>}</span>
            <span className="text-muted-foreground"> {dirty ? `· ${next - now >= 0 ? "+" : ""}${next - now} pts with these weights. Every page updates when you apply.` : "· Drag a slider to see how the score would change."}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!Object.keys(draft).length} onClick={() => setDraft({})}>Reset to default</Button>
            <Button size="sm" disabled={!dirty} onClick={() => { applyState(previewWeights(draft)); toast.success(`Weights applied and saved. Score ${now} → ${next}`); }}>Apply weights</Button>
          </div>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full">
          {PILLARS.map((p, i) => <div key={p} style={{ width: `${PILLAR_SHARE[p] * 100}%`, background: `color-mix(in oklab, var(--foreground) ${85 - i * 18}%, transparent)` }} title={`${p} ${PILLAR_SHARE[p] * 100}%`} />)}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {PILLARS.map((p) => {
            const cats = p === "Reporting" ? { "Reporting signals": 100 } : Object.fromEntries(Object.keys(CATEGORY_WEIGHTS[p as keyof typeof CATEGORY_WEIGHTS]).map((c) => [c, wOf(p, c)]));
            const total = Object.values(cats).reduce((a, b) => a + b, 0);
            const els = ELEMENTS.filter((e) => e.pillar === p);
            const live = els.filter((e) => s.active.has(e.id)).length;
            return (
              <div key={p} className="rounded-xl border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold">{p}</div>
                  <div className="text-2xl font-bold tabular-nums">{PILLAR_SHARE[p] * 100}%</div>
                </div>
                <div className="text-xs text-muted-foreground">{live} of {els.length} signals live</div>
                <div className="mt-3 space-y-2.5">
                  {Object.entries(cats).map(([c, w]) => {
                    const ce = p === "Reporting" ? els : els.filter((e) => e.category === c);
                    const share = (w / total) * PILLAR_SHARE[p] * 100;
                    return (
                      <div key={c}>
                        <div className="flex justify-between gap-2 text-xs"><span className="truncate">{c} <span className="text-muted-foreground">· {ce.length} signals</span></span><span className="shrink-0 font-semibold tabular-nums">{p !== "Reporting" && <span className="mr-2 font-normal text-muted-foreground">weight {w}</span>}{(total ? share : 0).toFixed(1)}%</span></div>
                        {p === "Reporting" ? <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-full rounded-full bg-foreground/70" /></div>
                          : <Slider className="mt-2" min={0} max={50} step={1} value={[w]} aria-label={`${c} weight`} onValueChange={([v]) => setDraft({ ...draft, [c]: v! })} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Widget>

      <div className="grid gap-4 lg:grid-cols-12">
        <Widget title="Top weighted signals" ready={ready} className="lg:col-span-7" action={<span className="text-xs text-muted-foreground">{dirty ? "With the weights on screen" : custom ? "Custom weights" : "Default weights"}</span>}>
          <div className="divide-y">
            {[...ELEMENTS].sort((a, b) => effective[b.id]! - effective[a.id]!).slice(0, 10).map((e) => (
              <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm">
                <div className="min-w-0"><div className="truncate">{e.name}</div><div className="text-xs text-muted-foreground">{e.pillar} · {e.category}{!s.active.has(e.id) && " · Off"}</div></div>
                <span className="font-semibold tabular-nums">{(effective[e.id]! * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Widget>
        <Widget title="Risk bands" ready={ready} className="lg:col-span-5">
          <div className="space-y-2">
            {BAND_RANGES.map((b) => (
              <div key={b.band} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                <span className="size-3 shrink-0 rounded-full" style={{ background: `var(--band-${b.band.toLowerCase()})` }} />
                <span className="flex-1 font-medium">{b.band}</span>
                <span className="tabular-nums text-muted-foreground">{b.from} to {b.to}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">Higher scores mean higher risk.<InfoTip label="How weights rebalance" text="When a signal is switched off or its source is not connected, its weight is shared among the remaining signals in the same category, so the score stays on the 0 to 100 scale. Confidence falls to show less data is behind it." /></p>
        </Widget>
      </div>
    </div>
  );
}
