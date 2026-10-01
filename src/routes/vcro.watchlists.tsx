import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Eye, LayoutGrid, List, Plus, Tags, Trash2, UserRoundX, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader, StatCard } from "@/features/shared/widget";
import { usePrefs, useReady } from "@/features/shared/prefs";
import { BAND_VAR, BandBadge, DeltaBadge, tagIcon } from "@/features/shared/band";
import { PeopleTable } from "@/features/people/people-table";
import {
  TAGS, addWatchlist, clearPinned, countRule, createTag, deleteTag, describeRule, fmt, initials, removeWatchlist, useCustomTags, usePinned, useSavedWatchlists, useSignals,
  watchlistSummary, type GroupKind, type WatchlistRule,
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
  const { privacy } = usePrefs();
  const sig = useSignals();
  const tags = useCustomTags();
  const lists = watchlistSummary(sig, useSavedWatchlists(), usePinned(), tags);
  const { group } = Route.useSearch();
  const [view, setView] = useState("cards");
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
        <StatCard ready={ready} label="Groups" icon={Users} value={lists.length} caption={`${lists.filter((l) => l.kind === "who").length} by tag · ${lists.filter((l) => l.kind === "behaviour").length} by behaviour`} />
        <StatCard ready={ready} label="Your own" icon={Tags} value={own.length} caption={own.length ? `${tags.length} tags · ${own.length - tags.length} lists` : "Create a watchlist or a tag"} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Select a group to see its people below.</span>
        <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v)} aria-label="View">
          <ToggleGroupItem value="cards"><LayoutGrid className="size-4" />Cards</ToggleGroupItem>
          <ToggleGroupItem value="table"><List className="size-4" />Table</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === "cards" ? SECTIONS.map((sec) => {
        const items = lists.filter((l) => l.kind === sec.kind);
        return (
          <section key={sec.kind}>
            <div className="mb-2"><h2 className="text-sm font-semibold">{sec.title} <span className="font-normal text-muted-foreground">· {items.length}</span></h2><p className="text-xs text-muted-foreground">{sec.hint}</p></div>
            {!items.length ? <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nothing here yet. Use Create watchlist or Manage tags above.</div> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {items.map((l) => l.needs ? (
                  <Link key={l.id} to="/vcro/signals/$id" params={{ id: l.needs.sourceId }}
                    className="group flex flex-col rounded-xl border border-dashed p-4 transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted">{tagIcon(l.name)}</span>{l.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{l.rule}</div>
                    <div className="mt-auto pt-4 text-xs"><span className="text-muted-foreground">This tag comes from {l.needs.source}.</span> <span className="font-medium underline underline-offset-2">Connect it to start tagging</span></div>
                  </Link>
                ) : (
                  <Link key={l.id} to="/vcro/watchlists" search={{ group: l.id }} resetScroll={false}
                    className={cn("group rounded-xl border bg-card p-4 shadow-[0_1px_2px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      l.id === sel.id && "ring-2 ring-foreground")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">{l.kind === "who" && l.id.startsWith("tag:") && <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted">{tagIcon(l.name)}</span>}<span className="truncate">{l.name}</span></div>
                      {l.change !== null && l.change !== 0 && <DeltaBadge value={l.change} />}
                    </div>
                    <div className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">{l.rule}</div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div><div className="text-2xl font-semibold tabular-nums">{fmt(l.members.length)}</div><div className="text-xs text-muted-foreground">people · {fmt(l.high)} High or Critical</div></div>
                      <div className="flex flex-col items-end gap-2">
                        {l.avg !== null && <BandBadge band={l.band} score={l.avg} />}
                        <div className="flex -space-x-2">
                          {l.members.slice(0, 4).map((m) => (
                            <span key={m.id} className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-medium" style={{ boxShadow: `inset 0 -2px 0 ${BAND_VAR[m.band]}` }}>{privacy ? "··" : initials(m.name)}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      }) : (
        <Card className="overflow-x-auto p-0 shadow-none">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><th className="px-4 py-2 font-medium">Group</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 text-right font-medium">People</th><th className="px-3 py-2 text-right font-medium">High or Critical</th><th className="px-3 py-2 font-medium">Average score</th><th className="px-3 py-2 font-medium">Change</th></tr></thead>
            <tbody>
              {lists.filter((l) => !l.needs).map((l) => (
                <tr key={l.id} className={cn("border-b last:border-0 hover:bg-muted/50", l.id === sel.id && "bg-muted/60")}>
                  <td className="px-4 py-2.5"><Link to="/vcro/watchlists" search={{ group: l.id }} resetScroll={false} className="font-medium underline-offset-2 hover:underline">{l.name}</Link><div className="max-w-md truncate text-xs text-muted-foreground">{l.rule}</div></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{l.kind === "who" ? "Tag" : l.kind === "behaviour" ? "Behaviour" : "Yours"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(l.members.length)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(l.high)}</td>
                  <td className="px-3 py-2.5">{l.avg !== null ? <BandBadge band={l.band} score={l.avg} /> : <span className="text-muted-foreground">None</span>}</td>
                  <td className="px-3 py-2.5">{l.change !== null ? <DeltaBadge value={l.change} /> : <span className="text-muted-foreground">None</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="gap-3 rounded-xl p-4 shadow-none">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{sel.name} <span className="font-normal text-muted-foreground">· {fmt(sel.members.length)} people</span></h2>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">{sel.rule}
            {sel.custom && <Button variant="ghost" size="sm" onClick={del}><Trash2 className="size-3.5" />{sel.id === "pinned" ? "Clear" : "Delete"}</Button>}</span>
        </div>
        {ready ? <PeopleTable key={sel.id} people={sel.members} exportName={`vcro-watchlist-${sel.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} /> : <Skeleton className="h-96 w-full" />}
      </Card>
    </div>
  );
}

function ManageTags() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const tags = useCustomTags();
  const taken = [...TAGS.map((t) => t.name), ...tags.map((t) => t.name)].some((n) => n.toLowerCase() === name.trim().toLowerCase());
  const add = () => { const t = createTag(name.trim(), about.trim()); toast.success(`Tag "${t.name}" created`, { description: "Add people from the People table or a person's page." }); setName(""); setAbout(""); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Tags className="size-4" />Manage tags</Button></DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Tags</DialogTitle><DialogDescription>Tags say who a person is. Built-in tags are applied automatically from your data. Your own tags are applied by hand.</DialogDescription></DialogHeader>
        <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your tags</div>
            {!tags.length && <p className="text-sm text-muted-foreground">None yet.</p>}
            <ul className="divide-y">
              {tags.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted">{tagIcon(t.name)}</span>
                  <span className="min-w-0 flex-1"><span className="block font-medium">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.about || "No description"} · {fmt(t.members.length)} people</span></span>
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete tag ${t.name}`} onClick={() => deleteTag(t.id)}><Trash2 className="size-4" /></Button>
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
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Built-in tags</div>
            <ul className="divide-y">
              {TAGS.map((t) => (
                <li key={t.name} className="flex items-center gap-3 py-2 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted">{tagIcon(t.name)}</span>
                  <span className="min-w-0 flex-1"><span className="block font-medium">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.about}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">From {t.source}</span>
                </li>
              ))}
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
