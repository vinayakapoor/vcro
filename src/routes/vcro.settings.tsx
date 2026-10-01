import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader, Widget } from "@/features/shared/widget";
import { usePrefs, useReady } from "@/features/shared/prefs";
import { InfoTip } from "@/features/shared/info";
import { signalStats, useSignals } from "@/lib/api";
import { HALF_LIFE_DAYS, IMPULSIVE_SECONDS, SIM_CAMPAIGN_WINDOW } from "@/lib/scoring";

export const Route = createFileRoute("/vcro/settings")({
  head: () => ({
    meta: [
      { title: "vCRO Settings | HumanFirewall vCRO" },
      { name: "description", content: "Scoring, alerts, automation, privacy and financial exposure settings for vCRO." },
      { property: "og:title", content: "vCRO Settings | HumanFirewall vCRO" },
      { property: "og:description", content: "Scoring, alerts, automation, privacy and financial exposure settings for vCRO." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Row({ label, hint, children, info }: { label: string; hint: string; children: React.ReactNode; info?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
      <div className="min-w-0"><div className="flex items-center gap-1.5 text-sm font-medium">{label}{info && <InfoTip label={label} text={info} />}</div><div className="text-xs text-muted-foreground">{hint}</div></div>
      {children}
    </div>
  );
}
const Num = ({ v, set, suffix, w = "w-20" }: { v: number; set: (n: number) => void; suffix: string; w?: string }) => (
  <span className="flex items-center gap-2"><Input type="number" min={0} value={v} onChange={(e) => set(Math.max(0, Number(e.target.value)))} className={`${w} text-right tabular-nums`} /><span className="text-xs text-muted-foreground">{suffix}</span></span>
);

function SettingsPage() {
  const ready = useReady();
  const { currency, setCurrency, privacy, setPrivacy } = usePrefs();
  const sig = useSignals();
  const st = signalStats(sig);
  const custom = Object.keys(sig.weights).length > 0;
  const [cfg, setCfg] = useState({ halfLife: HALF_LIFE_DAYS, window: SIM_CAMPAIGN_WINDOW, impulsive: IMPULSIVE_SECONDS, enterHigh: true, orgRise: 5, weekly: true, autoRun: true, approvalAbove: 25, costPerIncident: 120000, minConfidence: 60 });
  const set = <K extends keyof typeof cfg>(k: K, v: (typeof cfg)[K]) => setCfg({ ...cfg, [k]: v });
  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <PageHeader title="vCRO Settings" subtitle="How risk is scored, alerted and acted on" action={<Button onClick={() => toast.success("vCRO settings saved")}>Save settings</Button>} />

      <Widget title="Scoring model" ready={ready}>
        <div className="divide-y">
          <Row label="Weights" hint={custom ? "Custom weights applied" : "Default weights"}><Button asChild size="sm" variant="outline"><Link to="/vcro/weightage">Edit weights</Link></Button></Row>
          <Row label="Signals" hint={`${st.active} of ${st.total} signals live · confidence ${st.confidence}%`}><Button asChild size="sm" variant="outline"><Link to="/vcro/signals">Manage signals</Link></Button></Row>
          <Row label="Signal half-life" hint="Older events count less over time" info="An event loses half its weight after this many days, so recent behaviour matters most."><Num v={cfg.halfLife} set={(n) => set("halfLife", n)} suffix="days" /></Row>
          <Row label="Simulation window" hint="Recent campaigns counted per person"><Num v={cfg.window} set={(n) => set("window", n)} suffix="campaigns" /></Row>
          <Row label="Impulsive click" hint="Clicks faster than this are flagged"><Num v={cfg.impulsive} set={(n) => set("impulsive", n)} suffix="seconds" /></Row>
          <Row label="Minimum confidence to show a score" hint="Below this, scores show as low confidence" info="Protects you from acting on a score that has too little data behind it."><Num v={cfg.minConfidence} set={(n) => set("minConfidence", Math.min(100, n))} suffix="%" /></Row>
        </div>
      </Widget>

      <Widget title="Alerts" ready={ready}>
        <div className="divide-y">
          <Row label="Person enters High or Critical" hint="Alert the security team the same day"><Switch checked={cfg.enterHigh} onCheckedChange={(v) => set("enterHigh", v)} aria-label="Person enters High or Critical" /></Row>
          <Row label="Organisation score rises by" hint="Compared with last month"><Num v={cfg.orgRise} set={(n) => set("orgRise", n)} suffix="pts" /></Row>
          <Row label="Weekly risk digest" hint="Summary of movers, watchlists and actions"><Switch checked={cfg.weekly} onCheckedChange={(v) => set("weekly", v)} aria-label="Weekly risk digest" /></Row>
        </div>
      </Widget>

      <Widget title="Automation" ready={ready}>
        <div className="divide-y">
          <Row label="Run automatic actions" hint="Low-effort actions like training nudges run without review" info="Turn off to make every recommended action need approval."><Switch checked={cfg.autoRun} onCheckedChange={(v) => set("autoRun", v)} aria-label="Run automatic actions" /></Row>
          <Row label="Approval needed above" hint="Actions reaching more people than this need approval"><Num v={cfg.approvalAbove} set={(n) => set("approvalAbove", n)} suffix="people" /></Row>
        </div>
      </Widget>

      <Widget title="Financial exposure" ready={ready}>
        <div className="divide-y">
          <Row label="Currency" hint="Shown on the Riskometer and in reports">
            <ToggleGroup type="single" variant="outline" size="sm" value={currency} onValueChange={(v) => v && setCurrency(v as "INR" | "AED")}>
              <ToggleGroupItem value="INR">INR</ToggleGroupItem><ToggleGroupItem value="AED">AED</ToggleGroupItem>
            </ToggleGroup>
          </Row>
          <Row label="Cost per incident" hint="Average cost of one human-caused incident in INR" info="Used to estimate financial exposure. Set it to your own incident cost history."><Num v={cfg.costPerIncident} set={(n) => set("costPerIncident", n)} suffix="INR" w="w-28" /></Row>
        </div>
      </Widget>

      <Widget title="Privacy" ready={ready}>
        <Row label="Pseudonymise people" hint="Show employee numbers instead of names across vCRO" info="Useful when presenting or under works-council rules. Scores and actions stay the same.">
          <Switch checked={privacy} onCheckedChange={setPrivacy} aria-label="Pseudonymise people" />
        </Row>
      </Widget>
    </div>
  );
}
