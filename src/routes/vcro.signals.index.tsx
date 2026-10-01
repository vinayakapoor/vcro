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
import { DataTable, type Column } from "@/features/shared/data-table";
import { useReady } from "@/features/shared/prefs";
import {
  ELEMENTS, ELEMENT_WEIGHTS, SOURCES, applyState, fmt, formatStamp, orgScoreFor, previewElement, signalStats, sourceGain, useConnectors, useSignals, type SignalState,
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

type Row = ElementDef & { source: string; sourceType: string; on: boolean; weight: number };

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
    return { ...e, source: src.name, sourceType: src.kind === "Module" ? "HumanFirewall" : "Integration", on: s.active.has(e.id), weight: ELEMENT_WEIGHTS[e.id]! * 100 };
  });
  const maxW = Math.max(...rows.map((r) => r.weight));
  const cols: Column<Row>[] = [
    { id: "name", header: "Signal", cell: (r) => <span className="font-medium">{r.name}</span>, sort: (r) => r.name },
    { id: "pillar", header: "Pillar", cell: (r) => r.pillar, sort: (r) => r.pillar },
    { id: "category", header: "Category", cell: (r) => r.category, sort: (r) => r.category },
    { id: "source", header: "Source", cell: (r) => <SoftBadge>{r.source}</SoftBadge>, sort: (r) => r.source },
    { id: "weight", header: "Weight", sort: (r) => r.weight, cell: (r) => (
      <span className="flex items-center gap-2"><span className="h-1.5 w-16 rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground" style={{ width: `${(r.weight / maxW) * 100}%` }} /></span><span className="tabular-nums">{r.weight.toFixed(1)}%</span></span>
    ) },
    { id: "status", header: "Status", cell: (r) => s.connected.has(r.sourceId) ? <StatusBadge on={r.on} onText="Active" offText="Off" /> : <Link to="/vcro/signals/$id" params={{ id: r.sourceId }} className="text-xs font-medium underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Connect {r.source}</Link>, sort: (r) => (r.on ? 1 : 0) },
    { id: "switch", header: "Use in score", cell: (r) => (
      <Switch checked={r.on} disabled={!s.connected.has(r.sourceId)} onCheckedChange={(on) => setPending({ next: previewElement(r.id, on), what: `${on ? "Use" : "Stop using"} ${r.name} in the score` })} aria-label={`Use ${r.name} in score`} onClick={(e) => e.stopPropagation()} />
    ) },
  ];
  const integrations = SOURCES.filter((x) => x.kind === "Integration");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Signals" subtitle="What feeds the risk score, and where the score is put to work" action={<Button onClick={() => navigate({ search: { tab: "integrations" } })}><Plus className="size-4" />Add source</Button>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard ready={ready} label="Connected sources" icon={Plug} value={`${st.connectedSources} / ${st.totalSources}`} caption={`Feeding the score · ${st.outbound} sending it out`} />
        <StatCard ready={ready} label="Active signals" icon={Activity} value={`${st.active} / ${st.total}`} caption="Counted in the score" />
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
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {integrations.filter((m) => m.direction === dir).map((m) => {
                  const on = s.connected.has(m.id);
                  const gain = sourceGain(s, m.id);
                  const cfg = connectors[m.id];
                  return (
                    <Link key={m.id} to="/vcro/signals/$id" params={{ id: m.id }}
                      className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.category}</span><StatusBadge on={on} offText="Available" /></div>
                      <span className="text-sm font-semibold">{m.name}{on && cfg && <span className="font-normal text-muted-foreground"> · {cfg.vendor}</span>}</span>
                      <p className="text-xs text-muted-foreground">{m.about}</p>
                      <div className="flex flex-wrap gap-1">
                        {dir === "Signal in" ? gain.signals.map((n) => <span key={n} className="rounded-md border bg-muted px-1.5 py-0.5 text-[11px]">{n}</span>)
                          : m.controls?.map((c) => <span key={c.id} className="rounded-md border bg-muted px-1.5 py-0.5 text-[11px]">{c.name}</span>)}
                      </div>
                      {!on && <div className="truncate text-[11px] text-muted-foreground">Works with {m.vendors?.slice(0, 3).join(", ")}{(m.vendors?.length ?? 0) > 3 && ` +${m.vendors!.length - 3}`}</div>}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs">
                        <span className="text-muted-foreground">{on ? `Synced ${cfg ? formatStamp(cfg.lastSync) : m.lastSync}` : dir === "Signal in" ? `Confidence ${st.confidence}% → ${gain.confidence}%` : `${m.controls?.length ?? 0} controls`}</span>
                        <span className="inline-flex items-center gap-1 font-medium">{on ? "Manage" : "Connect"}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="signals" className="mt-4">
          <Card className="p-4 shadow-none">
            <DataTable rows={rows} columns={cols} getId={(r) => r.id} search={(r) => `${r.name} ${r.category} ${r.source}`} searchPlaceholder="Search signals" pageSizeDefault={25}
              exportAs={{ name: "vcro-signals", header: ["Signal", "Pillar", "Category", "Source", "Weight %", "Status"], row: (r) => [r.name, r.pillar, r.category, r.source, r.weight.toFixed(1), r.on ? "Active" : s.connected.has(r.sourceId) ? "Off" : "Not connected"] }}
              filters={[
                { id: "pillar", label: "Pillar", options: ["Behaviour", "Exposure", "Privilege", "Reporting"], match: (r, v) => r.pillar === v },
                { id: "category", label: "Category", options: [...new Set(ELEMENTS.map((e) => e.category))], match: (r, v) => r.category === v },
                { id: "type", label: "Source type", options: ["HumanFirewall", "Integration"], match: (r, v) => r.sourceType === v },
                { id: "status", label: "Status", options: ["Active", "Inactive"], match: (r, v) => (v === "Active") === r.on },
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
