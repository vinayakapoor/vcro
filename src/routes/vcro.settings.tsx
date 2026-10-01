import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader, Widget } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { InfoTip } from "@/features/shared/info";
import {
  DEFAULT_SETTINGS, ROLES, applyState, orgScoreFor, previewConfig, resetVcro, saveSettings, signalStats, useSettings, useSignals,
  type Settings,
} from "@/lib/api";
import { DEFAULT_CONFIG, type ScoringConfig } from "@/lib/scoring";

export const Route = createFileRoute("/vcro/settings")({
  head: () => ({
    meta: [
      { title: "vCRO Settings | HumanFirewall vCRO" },
      { name: "description", content: "Scoring, alerts, automation and privacy settings for vCRO." },
      { property: "og:title", content: "vCRO Settings | HumanFirewall vCRO" },
      { property: "og:description", content: "Scoring, alerts, automation and privacy settings for vCRO." },
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
function Num({ v, set, suffix, w = "w-20", min = 0, max, label, placeholder }: { v: number | null; set: (n: number | null) => void; suffix: string; w?: string; min?: number; max?: number; label: string; placeholder?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Input type="number" inputMode="numeric" min={min} max={max} value={v ?? ""} placeholder={placeholder} aria-label={label} className={`${w} text-right tabular-nums`}
        onChange={(e) => {
          if (e.target.value === "") return set(placeholder ? null : min);
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) set(Math.max(min, max === undefined ? n : Math.min(max, n)));
        }} />
      <span className="w-16 text-xs text-muted-foreground">{suffix}</span>
    </span>
  );
}

function SettingsPage() {
  const ready = useReady();
  const sig = useSignals();
  const saved = useSettings();
  const st = signalStats(sig);
  const custom = Object.keys(sig.weights).length > 0;
  const [cfg, setCfg] = useState<ScoringConfig>(sig.config);
  const [set, setSet] = useState<Settings>(saved);
  useEffect(() => setCfg(sig.config), [sig.config]);
  useEffect(() => setSet(saved), [saved]);

  const cfgDirty = JSON.stringify(cfg) !== JSON.stringify(sig.config);
  const dirty = cfgDirty || JSON.stringify(set) !== JSON.stringify(saved);
  const now = ready ? orgScoreFor(sig).score : null;
  const next = ready && cfgDirty ? orgScoreFor(previewConfig(cfg)).score : now;
  const c = <K extends keyof ScoringConfig>(k: K, v: number | null) => setCfg({ ...cfg, [k]: v ?? DEFAULT_CONFIG[k] });
  const alertsSet = (p: Partial<Settings["alerts"]>) => setSet({ ...set, alerts: { ...set.alerts, ...p } });
  const autoSet = (p: Partial<Settings["automation"]>) => setSet({ ...set, automation: { ...set.automation, ...p } });

  const save = () => {
    if (cfgDirty) applyState(previewConfig(cfg));
    saveSettings(set);
    toast.success("vCRO settings saved", cfgDirty && now !== next ? { description: `Scoring changed. Organisation score ${now} → ${next} on every page.` } : undefined);
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <PageHeader title="vCRO Settings" subtitle="How risk is scored, alerted and acted on"
        action={
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
            <Button variant="outline" disabled={!dirty} onClick={() => { setCfg(sig.config); setSet(saved); }}>Discard</Button>
            <Button disabled={!dirty} onClick={save}>Save settings</Button>
          </div>
        } />

      <Widget title="Scoring model" ready={ready}>
        <div className="divide-y">
          <Row label="Weights" hint={custom ? "Custom weights applied" : "Default weights"}><Button asChild size="sm" variant="outline"><Link to="/vcro/weightage">Edit weights</Link></Button></Row>
          <Row label="Signals" hint={`${st.active} of ${st.total} signals live · confidence ${st.confidence}%`}><Button asChild size="sm" variant="outline"><Link to="/vcro/signals">Manage signals</Link></Button></Row>
          <Row label="Signal half-life" hint="Older events count less over time" info="An event loses half its weight after this many days, so recent behaviour matters most. Applies to simulations and real-world incidents."><Num label="Signal half-life in days" v={cfg.halfLifeDays} set={(n) => c("halfLifeDays", n)} suffix="days" min={7} max={720} /></Row>
          <Row label="Simulation window" hint="Most recent campaigns counted per channel, per person" info="A person's simulation risk on each channel uses only their latest campaigns, so one old mistake does not follow them forever."><Num label="Simulation window in campaigns" v={cfg.simWindow} set={(n) => c("simWindow", n)} suffix="campaigns" min={1} max={12} /></Row>
          <Row label="Impulsive click" hint="A failed simulation faster than this marks the person as an impulsive clicker" info="Feeds the Impulsive clickers watchlist."><Num label="Impulsive click in seconds" v={cfg.impulsiveSeconds} set={(n) => c("impulsiveSeconds", n)} suffix="seconds" min={1} max={600} /></Row>
          <Row label="Minimum confidence" hint="Scores with less data behind them are marked provisional" info="A person's confidence is the share of the model fed by live signals for them. Provisional scores show with a dashed outline."><Num label="Minimum confidence percent" v={cfg.minConfidence} set={(n) => c("minConfidence", n)} suffix="%" max={100} /></Row>
        </div>
        {cfgDirty && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm"><span className="font-semibold tabular-nums">Organisation score {now} → {next}</span><span className="text-muted-foreground"> with these scoring settings. Every page updates when you save.</span></p>}
      </Widget>

      <Widget title="Goals" ready={ready}>
        <Row label="Target score" hint="Shown as a goal line on the Risk trend chart" info="The organisation score you are working towards. Leave empty for no target.">
          <Num label="Target score" v={set.targetScore} set={(n) => setSet({ ...set, targetScore: n })} suffix="of 100" max={100} placeholder="None" />
        </Row>
      </Widget>

      <Widget title="Alerts" ready={ready}>
        <div className="divide-y">
          <Row label="People entering High or Critical" hint="Flag on the Riskometer when anyone crosses into High or Critical in a month"><Switch checked={set.alerts.enterHigh} onCheckedChange={(v) => alertsSet({ enterHigh: v })} aria-label="People entering High or Critical" /></Row>
          <Row label="Organisation score rises by" hint="Flag when the score rises this much against last month. 0 turns it off."><Num label="Organisation score rise in points" v={set.alerts.orgRise} set={(n) => alertsSet({ orgRise: n ?? 0 })} suffix="pts" max={50} /></Row>
          <Row label="Send alerts to" hint="Email addresses, separated by commas. Leave empty to alert every vCRO admin.">
            <Input value={set.alerts.recipients} onChange={(e) => alertsSet({ recipients: e.target.value })} placeholder="soc@yourcompany.com" aria-label="Alert recipients" className="w-64" />
          </Row>
          <Row label="Weekly risk digest" hint="Email summary of movers, watchlists and actions to vCRO admins" info="Delivery is handled by the platform's notification service; this switch records your preference."><Switch checked={set.alerts.weekly} onCheckedChange={(v) => alertsSet({ weekly: v })} aria-label="Weekly risk digest" /></Row>
        </div>
      </Widget>

      <Widget title="Automation" ready={ready}>
        <div className="divide-y">
          <Row label="Run automatic actions" hint="Low-effort actions like training reminders can run without review" info="Turn off to make every recommended action need approval."><Switch checked={set.automation.autoRun} onCheckedChange={(v) => autoSet({ autoRun: v })} aria-label="Run automatic actions" /></Row>
          <Row label="Approval needed above" hint="Any action reaching more people than this needs approval, even a low-effort one"><Num label="Approval threshold in people" v={set.automation.approvalAbove} set={(n) => autoSet({ approvalAbove: n ?? 0 })} suffix="people" w="w-24" /></Row>
        </div>
      </Widget>

      <Widget title="Privacy" ready={ready}>
        <div className="divide-y">
          <Row label="Pseudonymise people" hint="Show employee numbers instead of names across vCRO and in exports" info="Useful when presenting or under works-council rules. Scores and actions stay the same.">
            <Switch checked={set.privacy} onCheckedChange={(v) => setSet({ ...set, privacy: v })} aria-label="Pseudonymise people" />
          </Row>
          <Row label="Smallest team to show a score for" hint="Teams with fewer people show no team score in Departments" info="Stops anyone working out one person's score from a very small team. 0 shows every team.">
            <Num label="Smallest team size" v={set.minGroupSize} set={(n) => setSet({ ...set, minGroupSize: n ?? 0 })} suffix="people" max={50} />
          </Row>
        </div>
      </Widget>

      <Widget title="Access" ready={ready} info="Who can open vCRO and how much each role sees. Roles are assigned in the platform's user settings; this decides what each role can see here.">
        <div className="divide-y">
          {ROLES.map((r) => (
            <Row key={r.id} label={r.name} hint={r.sees}>
              <Switch checked={set.access[r.id]} disabled={r.locked} onCheckedChange={(v) => setSet({ ...set, access: { ...set.access, [r.id]: v } })} aria-label={`${r.name} can open vCRO`} />
            </Row>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">To see what a manager or an employee sees, open any person and choose Scorecard.</p>
      </Widget>

      <Widget title="People and groups" ready={ready}>
        <div className="divide-y">
          <Row label="Tags and watchlists" hint="Create your own tags, build rule-based watchlists and pin people"><Button asChild size="sm" variant="outline"><Link to="/vcro/watchlists">Open Watchlists</Link></Button></Row>
          <Row label="Integrations" hint="Sources that feed the score and tools that act on it"><Button asChild size="sm" variant="outline"><Link to="/vcro/signals" search={{ tab: "integrations" }}>Open integrations</Link></Button></Row>
        </div>
      </Widget>

      <Widget title="Reset" ready={ready}>
        <Row label="Restore vCRO defaults" hint="Clears custom weights, connections you added, settings, your tags and watchlists, queued actions and generated reports">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm">Restore defaults</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Restore vCRO defaults?</AlertDialogTitle><AlertDialogDescription>This removes everything you have customised in vCRO on this browser. It cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { resetVcro(); setSet(DEFAULT_SETTINGS); toast.success("vCRO restored to defaults"); }}>Restore defaults</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Row>
      </Widget>
    </div>
  );
}
