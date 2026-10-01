import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CircleSlash, Download, Gauge, UserRoundX, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, StatCard } from "@/features/shared/widget";
import { usePrefs, useReady } from "@/features/shared/prefs";
import { PeopleTable } from "@/features/people/people-table";
import { getPeople, useSignals } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const search = z.object({
  dept: z.string().optional(), band: z.string().optional(), location: z.string().optional(), tag: z.string().optional(), channel: z.string().optional(),
});

export const Route = createFileRoute("/vcro/people/")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "People | HumanFirewall vCRO" },
      { name: "description", content: "Individual human risk scores, drivers, weakest channels and lures." },
      { property: "og:title", content: "People | HumanFirewall vCRO" },
      { property: "og:description", content: "Individual human risk scores, drivers, weakest channels and lures." },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const ready = useReady();
  const filters = Route.useSearch();
  const people = getPeople(useSignals());
  const { privacy, setPrivacy } = usePrefs();
  const scored = people.filter((p) => p.score !== null);
  const high = scored.filter((p) => p.band === "High" || p.band === "Critical").length;
  const avgConf = Math.round(people.reduce((a, p) => a + p.confidence, 0) / people.length);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="People" subtitle="Individual human risk scores and drivers" action={<Button onClick={() => toast("Export started")}><Download className="size-4" />Export</Button>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard ready={ready} label="Scored people" icon={Users} value={`${scored.length} people`} caption={`of ${people.length} tracked`} />
        <StatCard ready={ready} label="High or Critical" icon={UserRoundX} value={`${high} people`} caption={`${Math.round((high / people.length) * 100)}% of tracked`} />
        <StatCard ready={ready} label="Insufficient data" icon={CircleSlash} value={`${people.length - scored.length} people`} caption="Need 1 simulation and 1 learning signal" />
        <StatCard ready={ready} label="Avg confidence" icon={Gauge} value={`${avgConf}%`} caption="Connected weight share" />
      </div>
      <Card className="p-4 shadow-none">
        {ready ? (
          <PeopleTable people={people} initial={filters}
            toolbarExtra={
              <div className="flex items-center gap-2 pl-1">
                <Switch id="privacy" checked={privacy} onCheckedChange={setPrivacy} />
                <Label htmlFor="privacy" className="text-sm font-normal">Privacy mode</Label>
              </div>
            } />
        ) : <Skeleton className="h-96 w-full" />}
      </Card>
    </div>
  );
}
