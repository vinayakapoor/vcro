import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Clock, Gauge, Plug, Plus } from "lucide-react";
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
  ELEMENTS, ELEMENT_WEIGHTS, SOURCES, applyState, orgScoreFor, previewElement, previewSource, signalStats, useSignals, type SignalState,
} from "@/lib/api";
import type { ElementDef } from "@/lib/scoring";

export const Route = createFileRoute("/vcro/signals")({
  head: () => ({
    meta: [
      { title: "Signals | HumanFirewall vCRO" },
      { name: "description", content: "Sources and elements feeding the human risk score." },
      { property: "og:title", content: "Signals | HumanFirewall vCRO" },
      { property: "og:description", content: "Sources and elements feeding the human risk score." },
    ],
  }),
  component: SignalsPage,
});

type Row = ElementDef & { source: string; sourceType: string; on: boolean; weight: number };

function SignalsPage() {
  const ready = useReady();
  const s = useSignals();
  const st = signalStats(s);
  const [tab, setTab] = useState("modules");
  const [pending, setPending] = useState<SignalState | null>(null);
  const before = pending ? orgScoreFor(s) : null;
  const after = pending ? orgScoreFor(pending) : null;
  const fed = (id: string) => ELEMENTS.filter((e) => e.sourceId === id).length;

  const rows: Row[] = ELEMENTS.map((e) => {
    const src = SOURCES.find((x) => x.id === e.sourceId)!;
    return { ...e, source: src.name, sourceType: src.kind === "Module" ? "HumanFirewall" : "Integration", on: s.active.has(e.id), weight: ELEMENT_WEIGHTS[e.id]! * 100 };
  });
  const maxW = Math.max(...rows.map((r) => r.weight));
  const cols: Column<Row>[] = [
    { id: "name", header: "Element", cell: (r) => <span className="font-medium">{r.name}</span>, sort: (r) => r.name },
    { id: "pillar", header: "Pillar", cell: (r) => r.pillar, sort: (r) => r.pillar },
    { id: "category", header: "Category", cell: (r) => r.category, sort: (r) => r.category },
    { id: "source", header: "Source", cell: (r) => <SoftBadge>{r.source}</SoftBadge>, sort: (r) => r.source },
    { id: "weight", header: "Weight", sort: (r) => r.weight, cell: (r) => (
      <span className="flex items-center gap-2"><span className="h-1.5 w-16 rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground" style={{ width: `${(r.weight / maxW) * 100}%` }} /></span><span className="tabular-nums">{r.weight.toFixed(1)}%</span></span>
    ) },
    { id: "status", header: "Status", cell: (r) => <StatusBadge on={r.on} onText="Active" offText={s.connected.has(r.sourceId) ? "Off" : "Not connected"} />, sort: (r) => (r.on ? 1 : 0) },
    { id: "switch", header: "Use in score", cell: (r) => (
      <Switch checked={r.on} disabled={!s.connected.has(r.sourceId)} onCheckedChange={(on) => setPending(previewElement(r.id, on))} aria-label={`Use ${r.name} in score`} onClick={(e) => e.stopPropagation()} />
    ) },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Signals" subtitle="Sources and elements feeding the risk score" action={<Button onClick={() => setTab("integrations")}><Plus className="size-4" />Add source</Button>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard ready={ready} label="Connected sources" icon={Plug} value={`${st.connectedSources} / ${st.totalSources}`} caption="Modules and integrations" />
        <StatCard ready={ready} label="Active elements" icon={Activity} value={`${st.active} / ${st.total}`} caption="Feeding the score" active />
        <StatCard ready={ready} label="Score confidence" icon={Gauge} value={`${st.confidence}%`} caption="Connected weight share" />
        <StatCard ready={ready} label="Last sync" icon={Clock} value={st.lastSync} caption="Most recent source" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList className="flex w-full justify-start overflow-x-auto sm:inline-flex sm:w-fit"><TabsTrigger value="modules">HumanFirewall modules</TabsTrigger><TabsTrigger value="integrations">Integrations</TabsTrigger><TabsTrigger value="elements">Elements</TabsTrigger></TabsList>
        <TabsContent value="modules" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {SOURCES.filter((x) => x.kind === "Module").map((m) => (
              <Card key={m.id} className="gap-2 p-4 shadow-none">
                <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{m.name}</span><StatusBadge on={s.connected.has(m.id)} /></div>
                <div className="text-xs text-muted-foreground">{fed(m.id)} elements fed · {m.events30d.toLocaleString("en-IN")} events in 30 days</div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {SOURCES.filter((x) => x.kind === "Integration").map((m) => {
              const on = s.connected.has(m.id);
              return (
                <Card key={m.id} className="gap-2 p-4 shadow-none">
                  <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.category}</span><StatusBadge on={on} /></div>
                  <span className="text-sm font-semibold">{m.name}</span>
                  <div className="text-xs text-muted-foreground">{fed(m.id)} elements · {on ? `Synced ${m.lastSync}` : "No sync"}</div>
                  <Button variant="outline" size="sm" className="mt-1 self-start" onClick={() => setPending(previewSource(m.id, !on))}>{on ? "Disconnect" : "Connect"}</Button>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="elements" className="mt-4">
          <Card className="p-4 shadow-none">
            <DataTable rows={rows} columns={cols} getId={(r) => r.id} search={(r) => `${r.name} ${r.category} ${r.source}`} searchPlaceholder="Search elements" pageSizeDefault={50}
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
            <DialogDescription>Weights renormalise across active elements.</DialogDescription>
          </DialogHeader>
          {before && after && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">Org score</div><div className="mt-1 text-lg font-semibold tabular-nums">{before.score} → {after.score}</div></div>
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">Confidence</div><div className="mt-1 text-lg font-semibold tabular-nums">{before.confidence}% → {after.confidence}%</div></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={() => { applyState(pending!); setPending(null); }}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
