import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Eye, Plus, Search, Tags, Trash2, UserRoundX, Users, X } from "lucide-react";
import { InfoTip } from "@/features/shared/info";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader, StatCard } from "@/features/shared/widget";
import { useReady } from "@/features/shared/prefs";
import { BAND_VAR, BandBadge, DeltaBadge, tagIcon } from "@/features/shared/band";
import { PeopleTable } from "@/features/people/people-table";
import {
  DIRECTORY_GROUPS, TAGS, addWatchlist, clearPinned, countRule, createTag, customTagsByPerson, deleteTag, describeRule, fmt, getPeople, groupMembers, mapGroupToTag,
  removeWatchlist, setTagGroups, unmapGroup, useCustomTags, usePinned, useSavedWatchlists, useSignals, watchlistSummary, type GroupKind, type WatchlistRule,
} from "@/lib/api";
import { DEPARTMENTS, LOCATIONS } from "@/data/catalogue";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vcro/watchlists")({
  validateSearch: (s) => z.object({ group: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Watchlists | HumanFirewall vCRO" },
      { name: "description", content: "Risk groups and watchlists: who people are, how they behave, and the groups you define." },
      { property: "og:title", content: "Watchlists | HumanFirewall vCRO" },
      { property: "og:description", content: "Risk groups and watchlists: who people are, how they behave, and the groups you define." },
    ],
  }),
  component: WatchlistsPage,
});

const SECTIONS: { kind: GroupKind; title: string; hint: string }[] = [
  { kind: "who", title: "Who they are", hint: "Tags from your directory, HR system and connected sources. People are tagged automatically." },
  { kind: "behaviour", title: "How they behave", hint: "Membership follows the signals, so these lists change as behaviour changes." },
  { kind: "own", title: "Your own", hint: "Watchlists you built from rules, tags you created and people you pinned." },
];

function WatchlistsPage() {
  const ready = useReady();
  const sig = useSignals();
  const tags = useCustomTags();
  const lists = watchlistSummary(sig, useSavedWatchlists(), usePinned(), tags);
  const { group } = Route.useSearch();
  const [find, setFind] = useState("");
  const sel = lists.find((l) => l.id === group && !l.needs) ?? lists[0]!;
  const watched = new Map(lists.filter((l) => l.kind !== "who" || l.id === "very-attacked-vips").flatMap((l) => l.members.map((m) => [m.id, m] as const)));
  const highWatched = [...watched.values()].filter((m) => m.band === "High" || m.band === "Critical").length;
  const own = lists.filter((l) => l.kind === "own");
  const del = () => {
    if (sel.id === "pinned") clearPinned();
    else if (tags.some((t) => t.id === sel.id)) deleteTag(sel.id);
    else removeWatchlist(sel.id);
    toast.success(`${sel.name} removed`);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Watchlists" subtitle="Groups of people to watch: who they are, how they behave, and the groups you define"
        action={<div className="flex items-center gap-2"><ManageTags /><CreateWatchlist /></div>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard ready={ready} label="People on a watchlist" icon={Eye} value={fmt(watched.size)} caption="On at least one behaviour list or your own" />
        <StatCard ready={ready} label="High or Critical watched" icon={UserRoundX} value={fmt(highWatched)} caption="Of the people on a watchlist" />
        <StatCard ready={ready} label="Groups" icon={Users} value={lists.length} caption={`${lists.filter((l) => l.kind === "who").length} by tag · ${lists.filter((l) => l.kind === "behaviour").length} by behaviour · ${own.length} yours`} />
        <StatCard ready={ready} label="Your own" icon={Tags} value={own.length} caption={own.length ? `${tags.length} tags · ${own.length - tags.length} lists` : "Create a watchlist or a tag"} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border bg-card p-3 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto" aria-label="Groups">
          <div className="relative mb-2"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a group" aria-label="Find a group" className="h-8 pl-8" /></div>
          {SECTIONS.map((sec) => {
            const items = lists.filter((l) => l.kind === sec.kind && l.name.toLowerCase().includes(find.trim().toLowerCase()));
            if (!items.length && (find || sec.kind !== "own")) return null;
            return (
              <div key={sec.kind} className="mt-3 first:mt-0">
                <div className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{sec.title}<InfoTip label={sec.title} text={sec.hint} /></div>
                {!items.length && <p className="px-2 py-1.5 text-xs text-muted-foreground">Nothing yet. Create a watchlist or a tag.</p>}
                <ul>
                  {items.map((l) => l.needs ? (
                    <li key={l.id}>
                      <Link to="/vcro/signals/$id" params={{ id: l.needs.sourceId }} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="grid size-6 shrink-0 place-items-center rounded-md border border-dashed">{tagIcon(l.name)}</span>
                        <span className="min-w-0 flex-1 truncate">{l.name}</span><span className="shrink-0 text-xs font-medium text-foreground underline underline-offset-2">Connect</span>
                      </Link>
                    </li>
                  ) : (
                    <li key={l.id}>
                      <Link to="/vcro/watchlists" search={{ group: l.id }} resetScroll={false} aria-current={l.id === sel.id ? "true" : undefined}
                        className={cn("flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", l.id === sel.id && "bg-muted font-medium")}>
                        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted" style={l.id === sel.id ? { background: "var(--card)" } : undefined}>{l.kind === "who" || tags.some((t) => t.id === l.id) ? tagIcon(l.name) : <span className="size-2 rounded-full" style={{ background: BAND_VAR[l.band] }} />}</span>
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(l.members.length)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </aside>

        <Card className="min-w-0 gap-4 rounded-2xl p-5 shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">{sel.name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{sel.rule}</p>
            </div>
            {sel.custom && <Button variant="outline" size="sm" onClick={del}><Trash2 className="size-3.5" />{sel.id === "pinned" ? "Clear" : "Delete"}</Button>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["People", fmt(sel.members.length)], ["High or Critical", fmt(sel.high)]].map(([k, v]) => <div key={k} className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="mt-0.5 text-xl font-bold tabular-nums">{v}</div></div>)}
            <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Average score</div><div className="mt-1">{sel.avg !== null ? <BandBadge band={sel.band} score={sel.avg} /> : <span className="text-sm text-muted-foreground">None</span>}</div></div>
            <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Since last month</div><div className="mt-1">{sel.change !== null ? <DeltaBadge value={sel.change} /> : <span className="text-sm text-muted-foreground">None</span>}</div></div>
          </div>
          {ready ? <PeopleTable key={sel.id} people={sel.members} exportName={`vcro-watchlist-${sel.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} /> : <Skeleton className="h-96 w-full" />}
        </Card>
      </div>
    </div>
  );
}

function GroupPicker({ taken, onPick }: { taken: string[]; onPick: (g: string) => void }) {
  const left = DIRECTORY_GROUPS.filter((g) => !taken.includes(g.id));
  if (!left.length) return null;
  return (
    <Select value="" onValueChange={onPick}>
      <SelectTrigger className="h-7 w-auto gap-1 border-dashed px-2 text-xs text-muted-foreground" aria-label="Add a directory group"><Plus className="size-3" /><SelectValue placeholder="Directory group" /></SelectTrigger>
      <SelectContent>{left.map((g) => <SelectItem key={g.id} value={g.id}><span className="font-mono text-xs">{g.id}</span><span className="ml-2 text-xs text-muted-foreground">{g.about} · {fmt(groupMembers(g.id).size)}</span></SelectItem>)}</SelectContent>
    </Select>
  );
}
const GroupChip = ({ id, onRemove }: { id: string; onRemove: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-md border bg-muted py-0.5 pl-1.5 pr-0.5 font-mono text-[11px]">{id}
    <button type="button" aria-label={`Stop using ${id}`} className="grid size-4 place-items-center rounded hover:bg-foreground/10" onClick={onRemove}><X className="size-3" /></button></span>
);

function ManageTags() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const tags = useCustomTags();
  const sig = useSignals();
  const directory = sig.connected.has("int-identity");
  const counts = open ? Object.fromEntries(TAGS.map((t) => [t.name, getPeople(sig).filter((p) => p.tags.includes(t.name)).length])) : {};
  const byPerson = open ? customTagsByPerson(tags, sig) : new Map<string, string[]>();
  const countOwn = (n: string) => { let c = 0; for (const l of byPerson.values()) if (l.includes(n)) c++; return c; };
  const edits = Object.keys(sig.edits.add).length + Object.keys(sig.edits.remove).length;
  const taken = [...TAGS.map((t) => t.name), ...tags.map((t) => t.name)].some((n) => n.toLowerCase() === name.trim().toLowerCase());
  const add = () => { const t = createTag(name.trim(), about.trim()); toast.success(`Tag "${t.name}" created`, { description: "Fill it from a directory group below, or add people from the People table." }); setName(""); setAbout(""); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Tags className="size-4" />Manage tags</Button></DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Tags</DialogTitle><DialogDescription>A tag says who a person is. Tags fill three ways: automatically from a connected source, from a directory group you map, or by hand on a person's page or the People table.</DialogDescription></DialogHeader>
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {!directory && <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Directory groups come from the identity provider. <Link to="/vcro/signals/$id" params={{ id: "int-identity" }} className="font-medium text-foreground underline underline-offset-2">Connect it</Link> to map groups to tags.</p>}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your tags</div>
            {!tags.length && <p className="text-sm text-muted-foreground">None yet. Create one for any group your organisation cares about.</p>}
            <ul className="divide-y">
              {tags.map((t) => (
                <li key={t.id} className="py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted">{tagIcon(t.name)}</span>
                    <span className="min-w-0 flex-1"><span className="block font-medium">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.about || "No description"}</span></span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(countOwn(t.name))} people</span>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete tag ${t.name}`} onClick={() => deleteTag(t.id)}><Trash2 className="size-4" /></Button>
                  </div>
                  {directory && <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-9">
                    {(t.groups ?? []).map((g) => <GroupChip key={g} id={g} onRemove={() => setTagGroups(t.id, (t.groups ?? []).filter((x) => x !== g))} />)}
                    <GroupPicker taken={t.groups ?? []} onPick={(g) => setTagGroups(t.id, [...(t.groups ?? []), g])} />
                    {t.members.length > 0 && <span className="text-xs text-muted-foreground">+ {fmt(t.members.length)} added by hand</span>}
                  </div>}
                </li>
              ))}
            </ul>
            <div className="mt-2 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <div className="space-y-1"><Label htmlFor="tag-name">New tag</Label><Input id="tag-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Tag name" /></div>
              <div className="space-y-1"><Label htmlFor="tag-about">What it means</Label><Input id="tag-about" value={about} maxLength={90} onChange={(e) => setAbout(e.target.value)} placeholder="Optional description" /></div>
              <Button disabled={name.trim().length < 2 || taken} onClick={add}><Plus className="size-4" />Add</Button>
            </div>
            {taken && <p className="mt-1 text-xs text-warning">A tag with this name already exists.</p>}
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span>Built-in tags</span>{edits > 0 && <span className="normal-case tracking-normal">{fmt(edits)} people edited by hand</span>}</div>
            <ul className="divide-y">
              {TAGS.map((t) => {
                const live = sig.connected.has(t.sourceId);
                const maps = sig.edits.maps.filter((m) => m.tag === t.name).map((m) => m.group);
                return (
                  <li key={t.name} className="py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted">{tagIcon(t.name)}</span>
                      <span className="min-w-0 flex-1"><span className="block font-medium">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.about}</span></span>
                      <span className="shrink-0 text-right text-xs text-muted-foreground"><span className="block tabular-nums text-foreground">{fmt(counts[t.name] ?? 0)} people</span>
                        {live ? `From ${t.source}` : <Link to="/vcro/signals/$id" params={{ id: t.sourceId }} className="underline underline-offset-2">Connect {t.source}</Link>}</span>
                    </div>
                    {directory && <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-9">
                      {maps.map((g) => <GroupChip key={g} id={g} onRemove={() => unmapGroup(g, t.name)} />)}
                      <GroupPicker taken={maps} onPick={(g) => mapGroupToTag(g, t.name)} />
                    </div>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ANY = "any";
function CreateWatchlist() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [r, setR] = useState<WatchlistRule>({});
  const all = useSignals();
  const custom = useCustomTags();
  const navigate = Route.useNavigate();
  const preview = open ? countRule(all, r, custom) : 0;
  const picked = r.tags ?? [];
  const sel = (key: "department" | "location" | "minBand", label: string, opts: readonly string[]) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={(r[key] as string | undefined) ?? ANY} onValueChange={(v) => setR({ ...r, [key]: v === ANY ? undefined : v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={ANY}>Any</SelectItem>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const save = () => {
    const w = addWatchlist(name.trim(), r);
    toast.success(`Watchlist "${w.name}" created`);
    setOpen(false); setName(""); setR({});
    navigate({ search: { group: w.id } });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" />Create watchlist</Button></DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create watchlist</DialogTitle>
          <DialogDescription>Combine conditions. People join and leave automatically as their data changes.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5"><Label htmlFor="wl-name">Name</Label><Input id="wl-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Watchlist name" /></div>
          <div className="space-y-1.5">
            <Label>Has all of these tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {[...TAGS.map((t) => t.name as string), ...custom.map((t) => t.name)].map((t) => {
                const on = picked.includes(t);
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => setR({ ...r, tags: on ? picked.filter((x) => x !== t) : [...picked, t] })}
                    className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>
                    {tagIcon(t)}{t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {sel("department", "Department", DEPARTMENTS)}
            {sel("location", "Location", LOCATIONS)}
            {sel("minBand", "Risk band at least", ["Guarded", "Elevated", "High", "Critical"])}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="wl-rise">Score rising since last month</Label><Switch id="wl-rise" checked={!!r.rising} onCheckedChange={(v) => setR({ ...r, rising: v })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="wl-rep">2 or more failed simulations in 180 days</Label><Switch id="wl-rep" checked={!!r.repeatClicker} onCheckedChange={(v) => setR({ ...r, repeatClicker: v })} /></div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm"><span className="font-semibold tabular-nums">{fmt(preview)} people</span><span className="text-muted-foreground"> match today: {describeRule(r)}</span></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={save}>Create watchlist</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
