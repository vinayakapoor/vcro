import { useNavigate } from "@tanstack/react-router";
import { Line, LineChart, YAxis } from "recharts";
import { Pin, PinOff, Tag as TagIcon, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DataTable, type Column, type Filter } from "@/features/shared/data-table";
import { BandBadge, ChannelBadge, SoftBadge, TagBadge } from "@/features/shared/band";
import { usePrefs } from "@/features/shared/prefs";
import { CHANNELS, DEPARTMENTS, LOCATIONS, PREV_MONTH, TAGS, customTagsByPerson, fmt, formatAge, historyOf, initials, managerName, pinMany, pseudonym, tagPeople, togglePinned, useCustomTags, usePinned, useSignals, type ScoredPerson } from "@/lib/api";
import type { Band } from "@/lib/scoring";

export type PeopleFilters = Record<string, string | undefined>;

function Spark({ data }: { data: (number | null)[] }) {
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <LineChart width={80} height={24} data={pts}>
      <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
      <Line dataKey="v" stroke="var(--foreground)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
    </LineChart>
  );
}

export function PeopleTable({ people, initial = {}, toolbarExtra, exportName = "vcro-people" }: { people: ScoredPerson[]; initial?: PeopleFilters; toolbarExtra?: React.ReactNode; exportName?: string }) {
  const navigate = useNavigate();
  const signals = useSignals();
  const pinned = usePinned();
  const customTags = useCustomTags();
  const custom = customTagsByPerson(customTags);
  const tagsOf = (p: ScoredPerson) => [...p.tags, ...(custom.get(p.id) ?? [])];
  const { privacy } = usePrefs();
  const nm = (p: ScoredPerson) => (privacy ? pseudonym(p.id) : p.name);
  const mgr = (p: ScoredPerson) => (privacy ? "Hidden" : managerName(p.managerId));
  const bandOrder: Band[] = ["Critical", "High", "Elevated", "Guarded", "Low", "No score"];

  const columns: Column<ScoredPerson>[] = [
    {
      id: "name", header: "Name", sort: nm, cell: (p) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8"><AvatarFallback className="text-xs">{privacy ? "··" : initials(p.name)}</AvatarFallback></Avatar>
          <div className="min-w-0"><div className="truncate font-medium">{nm(p)}</div><div className="truncate text-xs text-muted-foreground">{privacy ? p.role : p.email}</div></div>
        </div>
      ),
    },
    { id: "department", header: "Department", cell: (p) => p.department, sort: (p) => p.department },
    { id: "manager", header: "Manager", cell: mgr, sort: (p) => managerName(p.managerId) },
    { id: "score", header: "Score", cell: (p) => <BandBadge band={p.band} score={p.score} provisional={p.lowConfidence} />, sort: (p) => p.score ?? -1 },
    { id: "change", header: `vs ${PREV_MONTH}`, cell: (p) => (p.change === null ? <span className="text-muted-foreground">None</span> : <span className={`tabular-nums ${p.change > 0 ? "text-warning" : p.change < 0 ? "text-success" : "text-muted-foreground"}`}>{p.change > 0 ? "+" : ""}{p.change}</span>), sort: (p) => p.change ?? 0 },
    { id: "trend", header: "12 months", cell: (p) => (p.score === null ? <span className="text-muted-foreground">None</span> : <Spark data={historyOf(signals, p)} />) },
    { id: "weakest", header: "Weakest signal", cell: (p) => (p.weakestSignal ? (
      <div className="min-w-0 max-w-44"><div className="truncate text-sm">{p.weakestSignal.name}</div><div className="truncate text-xs text-muted-foreground">{p.weakestSignal.category !== p.weakestSignal.name ? `${p.weakestSignal.category} · ` : ""}{p.weakestSignal.value} of 100</div></div>
    ) : <span className="text-muted-foreground">None</span>), sort: (p) => p.weakestSignal?.value ?? -1 },
    { id: "channel", header: "Weakest channel", cell: (p) => (p.weakestChannel ? <ChannelBadge channel={p.weakestChannel} /> : <span className="text-muted-foreground">None</span>), sort: (p) => p.weakestChannel ?? "" },
    { id: "lure", header: "Top lure", cell: (p) => (p.topLure ? <SoftBadge>{p.topLure}</SoftBadge> : <span className="text-muted-foreground">None</span>), sort: (p) => p.topLure ?? "" },
    { id: "tags", header: "Tags", cell: (p) => { const t = tagsOf(p); return <div className="flex max-w-56 flex-wrap gap-1">{t.slice(0, 3).map((x) => <TagBadge key={x} tag={x} />)}{t.length > 3 && <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground" title={t.slice(3).join(", ")}>+{t.length - 3}</span>}</div>; } },
    { id: "confidence", header: "Confidence", cell: (p) => <span className={`tabular-nums ${p.lowConfidence ? "text-warning" : ""}`}>{p.confidence}%</span>, sort: (p) => p.confidence },
    { id: "last", header: "Last simulation", cell: (p) => <span className="whitespace-nowrap tabular-nums">{formatAge(p.lastSimDays)}</span>, sort: (p) => -(p.lastSimDays ?? 9999) },
  ];

  const filters: Filter<ScoredPerson>[] = [
    { id: "band", label: "Band", options: bandOrder, match: (p, v) => p.band === v },
    { id: "dept", label: "Department", options: [...DEPARTMENTS], match: (p, v) => p.department === v },
    { id: "location", label: "Location", options: [...LOCATIONS], match: (p, v) => p.location === v },
    { id: "tag", label: "Tag", options: [...TAGS.map((t) => t.name as string), ...customTags.map((t) => t.name)], match: (p, v) => tagsOf(p).includes(v) },
    { id: "channel", label: "Weakest channel", options: [...CHANNELS], match: (p, v) => p.weakestChannel === v },
    { id: "level", label: "Level", options: ["Head", "Manager", "Individual"], match: (p, v) => p.level === v },
    { id: "team", label: "Team", options: [], match: (p, v) => p.managerId === v },
    { id: "move", label: "Movement", options: ["Rising", "Falling", "Entered High or Critical"], match: (p, v) => (v === "Rising" ? (p.change ?? 0) > 0 : v === "Falling" ? (p.change ?? 0) < 0 : (p.score ?? 0) > 60 && p.prev !== null && p.prev <= 60) },
  ];

  return (
    <DataTable
      key={JSON.stringify(initial)}
      rows={people} columns={columns} getId={(p) => p.id} filters={filters} initialFilters={initial}
      search={(p) => `${nm(p)} ${privacy ? "" : p.email} ${p.department} ${p.role}`} searchPlaceholder="Search name, role or department"
      onRowClick={(p) => navigate({ to: "/vcro/people/$id", params: { id: p.id } })}
      defaultSort={{ id: "score", dir: "desc" }} toolbarExtra={toolbarExtra}
      filterLabels={initial["team"] ? { team: privacy ? "Selected team" : `${managerName(initial["team"])}'s team` } : {}}
      exportAs={{
        name: exportName,
        header: ["Person", "Email", "Department", "Role", "Manager", "Location", "Score", "Band", `Change since ${PREV_MONTH}`, "Weakest signal", "Weakest channel", "Top lure", "Tags", "Confidence %", "Last simulation"],
        row: (p) => [nm(p), privacy ? "" : p.email, p.department, p.role, mgr(p), p.location, p.score, p.band, p.change, p.weakestSignal?.name, p.weakestChannel, p.topLure, tagsOf(p).join("; "), p.confidence, formatAge(p.lastSimDays)],
      }}
      bulk={(ids, clear) => (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-7"><TagIcon className="size-3.5" />Add tag</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{customTags.length ? "Your tags" : "No tags of your own yet"}</DropdownMenuLabel>
              {customTags.map((t) => <DropdownMenuItem key={t.id} onSelect={() => { tagPeople(t.id, ids); toast.success(`${fmt(ids.length)} people tagged ${t.name}`); clear(); }}>{t.name}</DropdownMenuItem>)}
              <DropdownMenuItem onSelect={() => navigate({ to: "/vcro/watchlists" })}>Manage tags</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-7" onClick={() => { pinMany(ids); toast.success(`${fmt(ids.length)} people pinned`); clear(); }}><Pin className="size-3.5" />Pin</Button>
        </>
      )}
      rowMenu={(p) => (
        <>
          <DropdownMenuItem onSelect={() => navigate({ to: "/vcro/people/$id", params: { id: p.id } })}><UserRound className="size-4" />View person</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => togglePinned(p.id)}>{pinned.includes(p.id) ? <><PinOff className="size-4" />Remove from pinned</> : <><Pin className="size-4" />Pin to watchlist</>}</DropdownMenuItem>
        </>
      )}
    />
  );
}
