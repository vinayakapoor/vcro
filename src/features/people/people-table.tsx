import { useNavigate } from "@tanstack/react-router";
import { Line, LineChart, YAxis } from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DataTable, type Column, type Filter } from "@/features/shared/data-table";
import { BandBadge, ChannelBadge, SoftBadge, TagBadge } from "@/features/shared/band";
import { usePrefs } from "@/features/shared/prefs";
import { CHANNELS, DEPARTMENTS, LOCATIONS, formatAge, initials, managerName, pseudonym, type ScoredPerson, useSignals } from "@/lib/api";
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

export function PeopleTable({ people, initial = {}, toolbarExtra }: { people: ScoredPerson[]; initial?: PeopleFilters; toolbarExtra?: React.ReactNode }) {
  const navigate = useNavigate();
  const signals = useSignals();
  const { privacy } = usePrefs();
  const nm = (p: ScoredPerson) => (privacy ? pseudonym(p.id) : p.name);
  const bandOrder: Band[] = ["Critical", "High", "Elevated", "Guarded", "Low", "No score"];

  const columns: Column<ScoredPerson>[] = [
    {
      id: "name", header: "Name", sort: nm, cell: (p) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8"><AvatarFallback className="text-xs">{privacy ? "EM" : initials(p.name)}</AvatarFallback></Avatar>
          <div className="min-w-0"><div className="truncate font-medium">{nm(p)}</div><div className="truncate text-xs text-muted-foreground">{privacy ? "Hidden" : p.email}</div></div>
        </div>
      ),
    },
    { id: "department", header: "Department", cell: (p) => p.department, sort: (p) => p.department },
    { id: "manager", header: "Manager", cell: (p) => (privacy ? "Hidden" : managerName(signals, p.managerId)), sort: (p) => managerName(signals, p.managerId) },
    { id: "score", header: "Score", cell: (p) => <BandBadge band={p.band} score={p.score} />, sort: (p) => p.score ?? -1 },
    { id: "trend", header: "Trend", cell: (p) => (p.score === null ? <span className="text-muted-foreground">None</span> : <Spark data={p.history} />) },
    { id: "weakest", header: "Weakest signal", cell: (p) => (p.weakestSignal ? (
      <div className="min-w-0 max-w-44"><div className="truncate text-sm">{p.weakestSignal.name}</div><div className="truncate text-xs text-muted-foreground">{p.weakestSignal.category !== p.weakestSignal.name ? `${p.weakestSignal.category} · ` : ""}{p.weakestSignal.value} of 100</div></div>
    ) : <span className="text-muted-foreground">None</span>), sort: (p) => p.weakestSignal?.value ?? -1 },
    { id: "channel", header: "Weakest channel", cell: (p) => (p.weakestChannel ? <ChannelBadge channel={p.weakestChannel} /> : <span className="text-muted-foreground">None</span>), sort: (p) => p.weakestChannel ?? "" },
    { id: "lure", header: "Top lure", cell: (p) => (p.topLure ? <SoftBadge>{p.topLure}</SoftBadge> : <span className="text-muted-foreground">None</span>), sort: (p) => p.topLure ?? "" },
    { id: "tags", header: "Tags", cell: (p) => <div className="flex flex-wrap gap-1">{p.tags.map((t) => <TagBadge key={t} tag={t} />)}</div> },
    { id: "confidence", header: "Confidence", cell: (p) => <span className="tabular-nums">{p.confidence}%</span>, sort: (p) => p.confidence },
    { id: "last", header: "Last event", cell: (p) => <span className="whitespace-nowrap tabular-nums">{formatAge(p.lastEventDays)}</span>, sort: (p) => -(p.lastEventDays ?? 9999) },
  ];

  const filters: Filter<ScoredPerson>[] = [
    { id: "band", label: "Band", options: bandOrder, match: (p, v) => p.band === v },
    { id: "dept", label: "Department", options: [...DEPARTMENTS], match: (p, v) => p.department === v },
    { id: "location", label: "Location", options: [...LOCATIONS], match: (p, v) => p.location === v },
    { id: "tag", label: "Tag", options: ["VIP", "Privileged", "Very attacked"], match: (p, v) => p.tags.includes(v as never) },
    { id: "channel", label: "Channel", options: [...CHANNELS], match: (p, v) => p.weakestChannel === v },
  ];

  return (
    <DataTable
      key={JSON.stringify(initial)}
      rows={people} columns={columns} getId={(p) => p.id} filters={filters} initialFilters={initial}
      search={(p) => `${nm(p)} ${privacy ? "" : p.email} ${p.department}`} searchPlaceholder="Search people"
      onRowClick={(p) => navigate({ to: "/vcro/people/$id", params: { id: p.id } })}
      defaultSort={{ id: "score", dir: "desc" }} toolbarExtra={toolbarExtra}
      rowMenu={(p) => (
        <>
          <DropdownMenuItem onSelect={() => navigate({ to: "/vcro/people/$id", params: { id: p.id } })}>View person</DropdownMenuItem>
        </>
      )}
    />
  );
}
