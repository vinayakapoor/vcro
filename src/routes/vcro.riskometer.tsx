import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Crosshair, Download, Landmark, ShieldCheck, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader, StatCard } from "@/features/shared/widget";
import { usePrefs, useReady } from "@/features/shared/prefs";
import {
  ActionsCard, ConcentrationCard, RiskSpreadingCard, HeatmapCard, SignalsCard, WeakestSignalsCard, MatrixCard, MoversCard, RiskometerCard, SusceptibilityCard, TreemapCard, TrendCard,
} from "@/features/riskometer/widgets";
import { deptHeatmap, managerInvolvement, riskSpreaders, formatMoney, orgSummary, signalCoverage, useSignals, weakestSignals } from "@/lib/api";

export const Route = createFileRoute("/vcro/riskometer")({
  head: () => ({
    meta: [
      { title: "Riskometer | HumanFirewall vCRO" },
      { name: "description", content: "Organisation human risk score across every channel, with trend, drivers and actions." },
      { property: "og:title", content: "Riskometer | HumanFirewall vCRO" },
      { property: "og:description", content: "Organisation human risk score across every channel, with trend, drivers and actions." },
    ],
  }),
  component: RiskometerPage,
});

function RiskometerPage() {
  const ready = useReady();
  const sig = useSignals();
  const s = orgSummary(sig);
  const cov = signalCoverage(sig);
  const { currency, setCurrency } = usePrefs();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Riskometer"
        subtitle="Human risk across every channel, in one score"
        action={<Button onClick={() => toast("Board pack export started")}><Download className="size-4" />Export board pack</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <RiskometerCard s={s} ready={ready} />
        <div className="flex flex-col gap-4 lg:col-span-7">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard ready={ready} label="High or Critical" icon={UserRoundX} value={`${s.highCount} people`} caption={`${Math.round(s.highShare * 100)}% of workforce`} />
          <StatCard ready={ready} label="Report-to-fail ratio" icon={ShieldCheck} value={s.rtf === null ? "None" : s.rtf.toFixed(1)} caption="Reports per failure" />
          <StatCard ready={ready} label="Financial exposure" icon={Landmark} value={formatMoney(s.lossInr, currency)} caption="Estimated annual"
            headerExtra={
              <ToggleGroup type="single" size="sm" value={currency} onValueChange={(v) => v && setCurrency(v as "INR" | "AED")} aria-label="Currency" className="h-6">
                <ToggleGroupItem value="INR" className="h-6 px-1.5 text-[11px]">INR</ToggleGroupItem>
                <ToggleGroupItem value="AED" className="h-6 px-1.5 text-[11px]">AED</ToggleGroupItem>
              </ToggleGroup>
            } />
          <StatCard ready={ready} label="Very attacked VIPs" icon={Crosshair} value={`${s.vipAttacked} people`} caption="Targeted and privileged"
            onClick={() => navigate({ to: "/vcro/watchlists", search: { group: "very-attacked-vips" } })} />
        </div>
        <SignalsCard ready={ready} cov={cov} />
        </div>

        <TrendCard s={s} ready={ready} />
        <MoversCard s={s} ready={ready} />
        <MatrixCard s={s} ready={ready} />
        <SusceptibilityCard s={s} ready={ready} />
        <HeatmapCard ready={ready} rows={deptHeatmap(sig)} className="lg:col-span-12" />
        <TreemapCard s={s} ready={ready} />
        <WeakestSignalsCard ready={ready} items={weakestSignals(sig, s.people)} className="lg:col-span-5" />
        <ConcentrationCard s={s} ready={ready} />
        <ActionsCard ready={ready} />
        <RiskSpreadingCard ready={ready} spreaders={riskSpreaders(sig, s.people)} managers={managerInvolvement(sig, s.people)} className="lg:col-span-12" />
      </div>
    </div>
  );
}
