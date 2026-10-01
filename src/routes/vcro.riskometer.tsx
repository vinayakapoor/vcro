import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BellRing, Crosshair, Download, Repeat, ShieldCheck, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import {
  ActionsCard, BandsCard, ConcentrationCard, DriversCard, RiskSpreadingCard, HeatmapCard, SignalsCard, WeakestSignalsCard, MatrixCard, MoversCard, RiskometerCard, SusceptibilityCard, TreemapCard, TrendCard,
} from "@/features/riskometer/widgets";
import { addReport, alerts, deptHeatmap, fmt, managerInvolvement, orgSummary, pct, riskSpreaders, signalCoverage, useSettings, useSignals, weakestSignals } from "@/lib/api";
import { buildReport } from "@/lib/reports";
import { download } from "@/lib/export";

export const Route = createFileRoute("/vcro/riskometer")({
  head: () => ({
    meta: [
      { title: "Organisation Risk Score | HumanFirewall vCRO" },
      { name: "description", content: "Organisation human risk score across every channel, with trend, drivers and actions." },
      { property: "og:title", content: "Organisation Risk Score | HumanFirewall vCRO" },
      { property: "og:description", content: "Organisation human risk score across every channel, with trend, drivers and actions." },
    ],
  }),
  component: RiskometerPage,
});

function RiskometerPage() {
  const ready = useReady();
  const sig = useSignals();
  const settings = useSettings();
  const s = orgSummary(sig);
  const cov = signalCoverage(sig);
  const navigate = useNavigate();
  const notices = ready ? alerts(sig, settings) : [];

  const exportPack = () => {
    const f = buildReport("board", sig, settings);
    download(f.filename, f.mime, f.content);
    addReport({ template: "board", name: "Board pack", score: s.score, ...f });
    toast.success("Board pack downloaded", { description: "Open the file and print to PDF. A copy is kept under Reports." });
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Organisation Risk Score - vCRO"
        subtitle="A detailed report showcasing the Risk Score of the organisation and how different departments and users are influencing it."
        action={<Button onClick={exportPack}><Download className="size-4" />Export board pack</Button>}
      />

      {notices.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm">
          <BellRing className="size-4 shrink-0 text-warning" aria-hidden />
          {notices.map((n) => (
            <Link key={n.id} to="/vcro/people" search={n.to === "people" ? { move: "Entered High or Critical" } : { move: "Rising" }} className="font-medium underline-offset-2 hover:underline">{n.text}</Link>
          ))}
          <Link to="/vcro/settings" className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline">Alert settings</Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <RiskometerCard s={s} ready={ready} />
        <div className="flex flex-col gap-4 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard ready={ready} label="High or Critical" icon={UserRoundX} value={fmt(s.highCount)} caption={`${pct(s.highShare)} of people · ${fmt(s.enteredHigh)} new this month`}
              onClick={() => navigate({ to: "/vcro/people", search: { band: "High" } })} />
            <StatCard ready={ready} label="Report rate" icon={ShieldCheck} value={pct(s.reportRate)} caption={`of simulations reported · ${pct(s.failRate)} failed`} />
            <StatCard ready={ready} label="Repeat clickers" icon={Repeat} value={fmt(s.repeatCount)} caption="Failed 2 or more in 180 days"
              onClick={() => navigate({ to: "/vcro/watchlists", search: { group: "repeat-clickers" } })} />
            <StatCard ready={ready} label="Very attacked VIPs" icon={Crosshair} value={fmt(s.vipAttacked)} caption="Senior and heavily targeted"
              onClick={() => navigate({ to: "/vcro/watchlists", search: { group: "very-attacked-vips" } })} />
          </div>
          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <BandsCard s={s} ready={ready} />
            <DriversCard s={s} ready={ready} />
          </div>
        </div>

        <SignalsCard ready={ready} cov={cov} />

        <TrendCard ready={ready} />
        <MoversCard s={s} ready={ready} />
        <MatrixCard s={s} ready={ready} />
        <SusceptibilityCard s={s} ready={ready} />
        <HeatmapCard ready={ready} rows={deptHeatmap(sig)} className="lg:col-span-12" />
        <TreemapCard s={s} ready={ready} />
        <WeakestSignalsCard ready={ready} items={weakestSignals(sig)} className="lg:col-span-5" />
        <ConcentrationCard s={s} ready={ready} />
        <ActionsCard ready={ready} />
        <RiskSpreadingCard ready={ready} spreaders={riskSpreaders(sig)} managers={managerInvolvement(sig)} className="lg:col-span-12" />
      </div>
    </div>
  );
}
