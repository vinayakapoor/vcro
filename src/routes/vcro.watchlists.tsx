import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/features/shared/widget";
import { usePrefs, useReady } from "@/features/shared/prefs";
import { BAND_VAR, BandBadge, DeltaBadge } from "@/features/shared/band";
import { PeopleTable } from "@/features/people/people-table";
import { addWatchlist, describeRule, initials, makeWatchlist, removeWatchlist, useCustomWatchlists, useSignals, watchlistSummary, type WatchlistRule } from "@/lib/api";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEPARTMENTS, LOCATIONS } from "@/data/catalogue";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vcro/watchlists")({
  validateSearch: (s) => z.object({ group: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Watchlists | HumanFirewall vCRO" },
      { name: "description", content: "Dynamic groups of people to monitor for human risk." },
      { property: "og:title", content: "Watchlists | HumanFirewall vCRO" },
      { property: "og:description", content: "Dynamic groups of people to monitor for human risk." },
    ],
  }),
  component: WatchlistsPage,
});

function WatchlistsPage() {
  const ready = useReady();
  const { privacy } = usePrefs();
  const lists = watchlistSummary(useSignals(), useCustomWatchlists());
  const { group } = Route.useSearch();
  const sel = lists.find((l) => l.id === group) ?? lists[0]!;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Watchlists" subtitle="Dynamic groups that update as signals change" action={<CreateWatchlist />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {lists.map((l) => (
          <Link key={l.id} to="/vcro/watchlists" search={{ group: l.id }}
            className={cn("group rounded-xl border bg-card p-4 shadow-[0_1px_2px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              l.id === sel.id && "ring-2 ring-foreground")}>
            <div className="flex items-start justify-between gap-2"><div className="text-sm font-semibold">{l.name}</div>{l.custom && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">Yours</span>}</div>
            <div className="mt-0.5 min-h-8 text-xs text-muted-foreground">{l.rule}</div>
            <div className="mt-4 flex items-end justify-between gap-2">
              <div>
                <div className="text-2xl font-semibold tabular-nums">{l.members.length}</div>
                <div className="text-xs text-muted-foreground">people</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5">{l.avg !== null && <BandBadge band={l.band} score={l.avg} />}{l.change !== null && <DeltaBadge value={l.change} />}</div>
                <div className="flex -space-x-2">
                  {l.members.slice(0, 4).map((m) => (
                    <span key={m.id} className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-medium"
                      style={{ boxShadow: `inset 0 -2px 0 ${BAND_VAR[m.band]}` }}>
                      {privacy ? "··" : initials(m.name)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Card className="gap-3 rounded-xl p-4 shadow-none">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{sel.name}</h2>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">{sel.rule} · {sel.members.length} people
            {sel.custom && <Button variant="ghost" size="sm" onClick={() => { removeWatchlist(sel.id); toast.success("Watchlist deleted"); }}><Trash2 className="size-3.5" />Delete</Button>}</span>
        </div>
        {ready ? <PeopleTable people={sel.members} /> : <Skeleton className="h-96 w-full" />}
      </Card>
    </div>
  );
}

const ANY = "any";
function CreateWatchlist() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [r, setR] = useState<WatchlistRule>({});
  const all = useSignals();
  const preview = watchlistSummary(all, [makeWatchlist("p", r)]).at(-1)!.members.length;
  const sel = (key: "department" | "location" | "tag" | "minBand", label: string, opts: readonly string[]) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={(r[key] as string | undefined) ?? ANY} onValueChange={(v) => setR({ ...r, [key]: v === ANY ? undefined : v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={ANY}>Any</SelectItem>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const save = () => {
    const w = makeWatchlist(name.trim(), r);
    addWatchlist(w);
    toast.success(`Watchlist "${w.name}" created`);
    setOpen(false); setName(""); setR({});
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" />Create watchlist</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create watchlist</DialogTitle>
          <DialogDescription>People join and leave automatically as their signals change.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="wl-name">Name</Label><Input id="wl-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Watchlist name" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sel("department", "Department", DEPARTMENTS)}
            {sel("location", "Location", LOCATIONS)}
            {sel("tag", "Tag", ["VIP", "Privileged", "Very attacked"])}
            {sel("minBand", "Risk band at least", ["Guarded", "Elevated", "High", "Critical"])}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="wl-rise">Score rising since last month</Label><Switch id="wl-rise" checked={!!r.rising} onCheckedChange={(v) => setR({ ...r, rising: v })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="wl-rep">2 or more failed simulations in 180 days</Label><Switch id="wl-rep" checked={!!r.repeatClicker} onCheckedChange={(v) => setR({ ...r, repeatClicker: v })} /></div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm"><span className="font-semibold tabular-nums">{preview} people</span><span className="text-muted-foreground"> match: {describeRule(r)}</span></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={save}>Create watchlist</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
