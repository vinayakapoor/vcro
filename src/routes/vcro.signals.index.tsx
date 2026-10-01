import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpFromLine, Clock, Gauge, Plug, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatCard } from "@/features/shared/widget";
import { SoftBadge, StatusBadge } from "@/features/shared/band";
import { InfoTip } from "@/features/shared/info";
import { DataTable, type Column } from "@/features/shared/data-table";
import { useReady } from "@/features/shared/prefs";
import {
  ELEMENTS, ELEMENT_WEIGHTS, SIGNAL_HOW, SOURCES, applyState, fmt, formatStamp, orgScoreFor, previewElement, signalStats, sourceGain, useConnectors, useSignals, type SignalState,
} from "@/lib/api";
import type { ElementDef } from "@/lib/scoring";

export const Route = createFileRoute("/vcro/signals/")({
  validateSearch: (s) => z.object({ tab: z.enum(["modules", "integrations", "signals"]).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Signals | HumanFirewall vCRO" },
      { name: "description", content: "Sources and signals feeding the human risk score, and where the score is sent." },
      { property: "og:title", content: "Signals | HumanFirewall vCRO" },
      { property: "og:description", content: "Sources and signals feeding the human risk score, and where the score is sent." },
    ],
  }),
  component: SignalsPage,
});

type Row = ElementDef & { source: string; product: string | null; sourceType: string; connected: boolean; on: boolean; weight: number };

function SignalsPage() {
  const ready = useReady();
  const s = useSignals();
  const connectors = useConnectors();
  const st = signalStats(s);
  const { tab = "modules" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [pending, setPending] = useState<{ next: SignalState; what: string } | null>(null);
  const before = pending ? orgScoreFor(s) : null;
  const after = pending ? orgScoreFor(pending.next) : null;

  const rows: Row[] = ELEMENTS.map((e) => {
    const src = SOURCES.find((x) => x.id === e.sourceId)!;
    const connected = s.connected.has(src.id);
    return { ...e, source: src.name, product: src.kind === "Module" ? "HumanFirewall module" : connected ? connectors[src.id]?.vendor ?? null : null, sourceType: src.kind === "Module" ? "HumanFirewall" : "Integration", connected, on: s.active.has(e.id), weight: ELEMENT_WEIGHTS[e.id]! * 100 };
  });
  const maxW = Math.max(...rows.map((r) => r.weight));
  const cols: Column<Row>[] = [
    { id: "name", header: "Signal", cell: (r) => <span className="flex items-center gap-1.5 font-medium">{r.name}<InfoTip label={r.name} text={`How it is measured: ${SIGNAL_HOW[r.id]}`} /></span>, sort: (r) => r.name },
    { id: "pillar", header: "Part of the score", cell: (r) => <div><div>{r.pillar}</div><div className="text-xs text-muted-foreground">{r.category}</div></div>, sort: (r) => `${r.pillar} ${r.category}` },
    { id: "source", header: "Comes from", cell: (r) => (
      <div className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${r.connected ? "bg-success" : "bg-muted-foreground/30"}`} aria-hidden />
        <div className="min-w-0"><div className="truncate">{r.source}</div><div className="truncate text-xs text-muted-foreground">{r.product ?? "Not connected"}</div></div>
      </div>
    ), sort: (r) => r.source },
    { id: "weight", header: "Weight", sort: (r) => r.weight, cell: (r) => (
      <span className="flex items-center gap-2"><span className="h-1.5 w-16 rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground" style={{ width: `${(r.weight / maxW) * 100}%` }} /></span><span className="tabular-nums">{r.weight.toFixed(1)}%</span></span>
    ) },
    { id: "status", header: "Status", cell: (r) => r.connected ? <StatusBadge on={r.on} onText="In the score" offText="Switched off" /> : <Button asChild variant="outline" size="sm" className="h-7"><Link to="/vcro/signals/$id" params={{ id: r.sourceId }}>Connect</Link></Button>, sort: (r) => (r.on ? 2 : r.connected ? 1 : 0) },
    { id: "switch", header: "Use in score", cell: (r) => (
      <Switch checked={r.on} disabled={!s.connected.has(r.sourceId)} onCheckedChange={(on) => setPending({ next: previewElement(r.id, on), what: `${on ? "Use" : "Stop using"} ${r.name} in the score` })} aria-label={`Use ${r.name} in score`} onClick={(e) => e.stopPropagation()} />
    ) },
  ];
  const integrations = SOURCES.filter((x) => x.kind === "Integration");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Signals" subtitle="What feeds the risk score, and where the score is put to work" action={<Button onClick={() => navigate({ search: { tab: "integrations" } })}><Plus className="size-4" />Add source</Button>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard ready={ready} label="Integrations connected" icon={Plug} value={st.integrations.on} caption={`${st.inbound.on} feeding the score · ${st.outbound.on} acting on it · ${st.modules.total} HumanFirewall modules always on`} />
        <StatCard ready={ready} label="Active signals" icon={Activity} value={st.active} caption={`From ${st.modules.total} modules and ${st.inbound.on} integrations`} />
        <StatCard ready={ready} label="Score confidence" icon={Gauge} value={`${st.confidence}%`} caption="Share of the model with live data" />
        <StatCard ready={ready} label="Last sync" icon={Clock} value={st.lastSync} caption="Most recent source" />
      </div>

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as "modules" } })} className="min-w-0">
        <TabsList className="flex w-full justify-start overflow-x-auto sm:inline-flex sm:w-fit"><TabsTrigger value="modules">HumanFirewall modules</TabsTrigger><TabsTrigger value="integrations">Integrations</TabsTrigger><TabsTrigger value="signals">All signals</TabsTrigger></TabsList>
        <TabsContent value="modules" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {SOURCES.filter((x) => x.kind === "Module").map((m) => (
              <Card key={m.id} className="gap-2 p-4 shadow-none">
                <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{m.name}</span><StatusBadge on={s.connected.has(m.id)} /></div>
                <div className="text-xs text-muted-foreground">{fmt(m.events30d)} events in 30 days · synced {m.lastSync}</div>
                <div className="mt-1 flex flex-wrap gap-1">{ELEMENTS.filter((e) => e.sourceId === m.id).map((e) => <span key={e.id} className={`rounded-md border px-1.5 py-0.5 text-[11px] ${s.active.has(e.id) ? "bg-muted" : "border-dashed text-muted-foreground line-through"}`}>{e.name}</span>)}</div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-6">
          {(["Signal in", "Action out"] as const).map((dir) => (
            <section key={dir}>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-muted">{dir === "Signal in" ? <ArrowDownToLine className="size-3.5" /> : <ArrowUpFromLine className="size-3.5" />}</span>
                <div><h2 className="text-sm font-semibold">{dir === "Signal in" ? "Signals in" : "Actions out"}</h2><p className="text-xs text-muted-foreground">{dir === "Signal in" ? "Data from your security stack that sharpens the score" : "Send the score to the tools that enforce and respond"}</p></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {integrations.filter((m) => m.direction === dir).map((m) => {
                  const on = s.connected.has(m.id);
                  const gain = sourceGain(s, m.id);
                  const cfg = connectors[m.id];
                  return (
                    <div key={m.id} className="group relative flex flex-col rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{m.category}</span>
                        <StatusBadge on={on} offText="Available" />
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-base font-semibold">{m.name}
                        <InfoTip label={m.name} text={`${m.about} ${dir === "Signal in" ? `Brings in: ${gain.signals.join(", ")}.` : `Does: ${m.controls?.map((c) => c.name).join(", ")}.`}`} /></div>
                      <p className="mt-1 min-h-10 text-sm text-muted-foreground">{on && cfg ? <span className="font-medium text-foreground">{cfg.vendor}</span> : m.vendors?.join(", ")}</p>
                      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs">
                        <span className="text-muted-foreground">{on ? `Synced ${cfg ? formatStamp(cfg.lastSync) : m.lastSync}` : dir === "Signal in" ? `+${gain.confidence - st.confidence}% confidence · ${gain.signals.length} ${gain.signals.length === 1 ? "signal" : "signals"}` : `${m.controls?.length ?? 0} controls`}</span>
                        <Link to="/vcro/signals/$id" params={{ id: m.id }} className="inline-flex items-center gap-1 font-semibold after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">{on ? "Manage" : "Connect"}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="signals" className="mt-4">
          <Card className="p-4 shadow-none">
            <DataTable rows={rows} columns={cols} getId={(r) => r.id} search={(r) => `${r.name} ${r.category} ${r.source} ${r.product ?? ""}`} searchPlaceholder="Search signals, sources or products" pageSizeDefault={25}
              onRowClick={(r) => r.sourceType === "Integration" && navigate({ to: "/vcro/signals/$id", params: { id: r.sourceId } })}
              exportAs={{ name: "vcro-signals", header: ["Signal", "Pillar", "Category", "Source", "Product", "Weight %", "Status", "How it is measured"], row: (r) => [r.name, r.pillar, r.category, r.source, r.product, r.weight.toFixed(1), r.on ? "In the score" : r.connected ? "Switched off" : "Not connected", SIGNAL_HOW[r.id]] }}
              filters={[
                { id: "pillar", label: "Pillar", options: ["Behaviour", "Exposure", "Privilege", "Reporting"], match: (r, v) => r.pillar === v },
                { id: "category", label: "Category", options: [...new Set(ELEMENTS.map((e) => e.category))], match: (r, v) => r.category === v },
                { id: "source", label: "Source", options: SOURCES.filter((x) => x.direction !== "Action out").map((x) => x.name), match: (r, v) => r.source === v },
                { id: "status", label: "Status", options: ["In the score", "Switched off", "Not connected"], match: (r, v) => (v === "In the score" ? r.on : v === "Switched off" ? r.connected && !r.on : !r.connected) },
              ]} />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalculate score?</DialogTitle>
            <DialogDescription>{pending?.what}. The remaining signals in the same category share its weight, so the scale stays 0 to 100.</DialogDescription>
          </DialogHeader>
          {before && after && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">Org score</div><div className="mt-1 text-lg font-semibold tabular-nums">{before.score} → {after.score}</div></div>
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">Confidence</div><div className="mt-1 text-lg font-semibold tabular-nums">{before.confidence}% → {after.confidence}%</div></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={() => { applyState(pending!.next); setPending(null); }}>Apply to every page</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
