import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, CheckCircle2, Circle, Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Widget, EmptyLine } from "@/features/shared/widget";
import { StatusBadge } from "@/features/shared/band";
import { useReady } from "@/features/shared/prefs";
import {
  DEPARTMENTS, ELEMENTS, ELEMENT_WEIGHTS, SOURCES, connectSource, disconnectSource, fmt, formatStamp, orgScoreFor, orgSummary, patchConnector, previewSource,
  recommendedActions, toggleElement, useConnectors, useRuns, useSettings, useSignals,
} from "@/lib/api";
import type { Control, Source } from "@/data/catalogue";

export const Route = createFileRoute("/vcro/signals/$id")({
  loader: ({ params }) => {
    const src = SOURCES.find((x) => x.id === params.id && x.kind === "Integration");
    if (!src) throw notFound();
    return { name: src.name };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name ?? "Connector"} | HumanFirewall vCRO` }, { name: "description", content: "Connect and manage a vCRO integration." }] }),
  notFoundComponent: () => <EmptyLine text="Connector not found" action={<Button asChild variant="outline" size="sm"><Link to="/vcro/signals" search={{ tab: "integrations" }}>All integrations</Link></Button>} />,
  component: ConnectorPage,
});

const FIELDS: Record<NonNullable<Source["auth"]>, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  OAuth: [{ key: "account", label: "Tenant domain", placeholder: "yourcompany.com" }],
  "API key": [{ key: "account", label: "API endpoint", placeholder: "https://api.yourcompany.com" }, { key: "secret", label: "API key", placeholder: "Paste the key", secret: true }],
  "SCIM and API key": [{ key: "account", label: "SCIM base URL", placeholder: "https://hr.yourcompany.com/scim/v2" }, { key: "secret", label: "Bearer token", placeholder: "Paste the token", secret: true }],
  Webhook: [{ key: "account", label: "Destination URL", placeholder: "https://siem.yourcompany.com/ingest" }, { key: "secret", label: "Signing secret", placeholder: "Paste the secret", secret: true }],
  "Log stream": [],
  "Issued key": [],
};
const token = (prefix: string) => prefix + Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
const FREQ = ["Every 15 minutes", "Hourly", "Daily"];
/** Stable per-connector fraction, so match rates and run sizes do not change between visits. */
const frac = (id: string, salt = 0) => { let h = 2166136261 ^ salt; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

function ConnectorPage() {
  const { id } = Route.useParams();
  const src = SOURCES.find((x) => x.id === id)!;
  const sig = useSignals();
  const connectors = useConnectors();
  const on = sig.connected.has(id);
  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <div>
        <Link to="/vcro/signals" search={{ tab: "integrations" }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />All integrations</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{src.category} · {src.direction === "Action out" ? "Action out" : "Signal in"}</div>
            <h1 className="mt-0.5 text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{src.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{src.about}</p>
            {on && connectors[id] && <p className="mt-1 text-sm font-medium">Connected to {connectors[id]!.vendor}</p>}
          </div>
          <StatusBadge on={on} offText="Not connected" />
        </div>
      </div>
      {on ? <Connected src={src} /> : <Setup src={src} />}
    </div>
  );
}

// ---------- Setup ----------
const CHECKS = (src: Source, vendor: string, matched: number, total: number) => src.auth === "Issued key"
  ? ["Key is active", "Scopes: read scores", `First request from ${vendor === "REST API" ? "your client" : vendor}`, "Rate limit applied"]
  : src.direction === "Action out"
    ? [`Reach ${vendor}`, "Authenticate", src.id === "out-itsm" ? "Create and read back a test ticket" : "Send a test event", "Receive acknowledgement"]
    : src.auth === "Log stream"
      ? [`Stream from ${vendor} is arriving`, "Events parse correctly", "Read a sample of records", `Match people to the directory: ${fmt(matched)} of ${fmt(total)}`]
      : [`Reach ${vendor}`, "Authenticate", "Read a sample of records", `Match people to the directory: ${fmt(matched)} of ${fmt(total)}`];

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <div className="min-w-0 flex-1"><div className="text-[11px] text-muted-foreground">{label}</div><div className="truncate font-mono text-xs">{value}</div></div>
      <Button variant="ghost" size="sm" className="h-7" onClick={() => { void navigator.clipboard?.writeText(value); toast("Copied"); }}><Copy className="size-3.5" />Copy</Button>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
      <span className={`grid size-8 place-items-center rounded-full border text-sm font-semibold ${done ? "border-success bg-success text-background" : "bg-card"}`}>{done ? <Check className="size-4" /> : n}</span>
      <div className="min-w-0 pb-8"><h2 className="pt-1 text-sm font-semibold">{title}</h2><div className="mt-3">{children}</div></div>
    </li>
  );
}

function Setup({ src }: { src: Source }) {
  const ready = useReady();
  const sig = useSignals();
  const els = ELEMENTS.filter((e) => e.sourceId === src.id);
  const vendors = src.vendors ?? [];
  const [vendor, setVendor] = useState(vendors.length === 1 ? vendors[0]! : "");
  const picked = vendor ? vendor.split(", ") : [];
  // A multi-feed connector needs one key per outside feed. HumanFirewall's own scan needs none.
  const fields = src.multi
    ? picked.filter((v) => !v.startsWith("HumanFirewall")).map((v) => ({ key: v, label: `${v} API key`, placeholder: "Paste the key", secret: true }))
    : FIELDS[src.auth ?? "API key"];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [issued, setIssued] = useState<{ key: string; url: string } | null>(null);
  const [added, setAdded] = useState(false);
  const [authorised, setAuthorised] = useState(false);
  const [authorising, setAuthorising] = useState(false);
  const [skip, setSkip] = useState<string[]>([]);
  const [controls, setControls] = useState<Record<string, boolean>>(Object.fromEntries((src.controls ?? []).map((c) => [c.id, true])));
  const [scope, setScope] = useState("All people");
  const [freq, setFreq] = useState(FREQ[1]!);
  const [step, setStep] = useState(-1); // -1 not run, 0..3 running, 4 passed
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const total = ready ? orgSummary(sig).total : 0;
  const matched = Math.round(total * (0.972 + frac(src.id) * 0.025));
  const filled = fields.every((f) => (vals[f.key] ?? "").trim().length > 2);
  const stream = src.auth === "Log stream", keyed = src.auth === "Issued key";
  const authDone = !!vendor && (src.auth === "OAuth" ? authorised : stream ? !!issued && added : keyed ? !!issued : filled);
  const issue = () => setIssued({ key: token(keyed ? "vcro_live_" : "ing_"), url: `${window.location.origin}/${keyed ? "api/v1/scores" : `ingest/v1/${src.id.replace("int-", "")}`}` });
  const scopeDone = src.direction === "Action out" ? Object.values(controls).some(Boolean) : skip.length < els.length;
  const before = ready ? orgScoreFor(sig) : null;
  const after = ready && step === 4 ? orgScoreFor(previewSource(src.id, true)) : null;
  const checks = CHECKS(src, picked.length > 1 ? "each feed" : vendor || "the service", matched, total);

  const authorise = () => { setAuthorising(true); timer.current = setTimeout(() => { setAuthorising(false); setAuthorised(true); }, 1100); };
  const runTest = () => {
    setStep(0);
    const tick = (i: number) => { timer.current = setTimeout(() => { setStep(i + 1); if (i < 3) tick(i + 1); }, 650); };
    tick(0);
  };
  const connect = () => {
    connectSource(src.id, { vendor, account: src.multi ? `${picked.length} ${picked.length === 1 ? "feed" : "feeds"}` : keyed ? `Key ending ${issued!.key.slice(-4)}` : stream ? "Log stream" : vals["account"]!.trim(), frequency: stream ? "Continuous" : freq, scope, controls }, skip);
    toast.success(`${picked.length > 1 ? src.name : vendor} connected`, { description: src.direction === "Action out" ? "The score is now being sent." : `First sync complete. ${fmt(matched)} people matched.` });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ol className="rounded-xl border bg-card p-5 [&>li:last-child>div]:pb-0">
        <Step n={1} title={src.multi ? "Choose your feeds" : "Choose your product"} done={!!vendor}>
          <div className="flex flex-wrap gap-2">
            {vendors.map((v) => (
              <button key={v} type="button" aria-pressed={picked.includes(v)} disabled={authorised}
                onClick={() => { setVendor(src.multi ? (picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]).join(", ") : v); setStep(-1); }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${picked.includes(v) ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted"}`}>{v}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{src.multi && "Pick every feed you use. Breach feeds supply breached credentials; the web and social scan supplies public contact details and social footprint. "}Using something else? Your HumanFirewall contact can add a connector, or you can send events to the generic ingest API.</p>
        </Step>

        <Step n={2} title={src.auth === "OAuth" ? `Authorise access${vendor ? ` in ${vendor}` : ""}` : stream ? `Point ${vendor || "your gateway"} at vCRO` : keyed ? "Create an API key" : "Enter connection details"} done={authDone}>
          {(stream || keyed) && (
            <div className="space-y-2">
              {!issued ? <Button onClick={issue} disabled={!vendor}><KeyRound className="size-4" />{keyed ? "Generate API key" : "Generate ingest endpoint"}</Button> : (
                <>
                  <CopyRow label={keyed ? "Base URL" : "Ingest URL"} value={issued.url} />
                  <CopyRow label={keyed ? "API key, shown once" : "Token"} value={issued.key} />
                  {stream && <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm"><Checkbox checked={added} onCheckedChange={(v) => { setAdded(!!v); setStep(-1); }} />I have added this as a log destination in {vendor}</label>}
                </>
              )}
              {keyed && vendor && vendor !== "REST API" && issued && <p className="text-xs text-muted-foreground">Paste the key into the {vendor} connector for HumanFirewall. The nightly export starts once the first request arrives.</p>}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
                <Input id={`f-${f.key}`} type={f.secret ? "password" : "text"} autoComplete="off" placeholder={f.placeholder} value={vals[f.key] ?? ""} disabled={authorised}
                  onChange={(e) => { setVals({ ...vals, [f.key]: e.target.value }); setStep(-1); }} />
              </div>
            ))}
          </div>
          {src.auth === "OAuth" && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {authorised
                ? <span className="inline-flex items-center gap-1.5 text-sm text-success"><ShieldCheck className="size-4" />Authorised for {vals["account"]} with read-only access</span>
                : <Button onClick={authorise} disabled={!filled || authorising}>{authorising ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}{authorising ? "Waiting for consent" : "Authorise"}</Button>}
              {authorised && <Button variant="ghost" size="sm" onClick={() => { setAuthorised(false); setStep(-1); }}>Change</Button>}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{
            src.id === "out-access" || src.id === "out-mailpolicy" ? "vCRO only changes who is in the groups you name. It cannot create or edit policies, and break-glass accounts are never added."
            : src.id === "out-itsm" ? "vCRO creates tickets and reads their status back. It cannot see other tickets."
            : keyed ? "The key can only read scores. Revoke it at any time from this page."
            : src.direction === "Action out" ? "vCRO only sends data to this destination. It never reads from it."
            : stream ? "Send only the log types listed in step 3. vCRO keeps per-person totals, not raw browsing history."
            : "Read-only. vCRO never changes anything in the connected system."} Secrets are stored encrypted and never shown again.</p>
        </Step>

        <Step n={3} title={src.direction === "Action out" ? "Choose what the score does there" : "Choose what to bring in"} done={authDone && scopeDone}>
          {src.direction === "Action out" ? (
            <div className="divide-y rounded-lg border">
              {src.controls!.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center justify-between gap-4 p-3">
                  <span className="min-w-0"><span className="block text-sm font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.detail}</span></span>
                  <Switch checked={!!controls[c.id]} onCheckedChange={(v) => setControls({ ...controls, [c.id]: v })} aria-label={c.name} />
                </label>
              ))}
            </div>
          ) : (
            <>
              <div className="divide-y rounded-lg border">
                {els.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-3 p-3">
                    <Checkbox checked={!skip.includes(e.id)} onCheckedChange={(v) => setSkip(v ? skip.filter((x) => x !== e.id) : [...skip, e.id])} />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{e.name}</span><span className="block text-xs text-muted-foreground">{e.pillar} · {e.category}</span></span>
                    <span className="text-xs tabular-nums text-muted-foreground">{(ELEMENT_WEIGHTS[e.id]! * 100).toFixed(1)}% of the score</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>People in scope</Label>
                  <Select value={scope} onValueChange={setScope}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All people">All people</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d} only</SelectItem>)}</SelectContent></Select></div>
                <div className={`space-y-1.5 ${stream ? "hidden" : ""}`}><Label>Sync</Label>
                  <Select value={freq} onValueChange={setFreq}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FREQ.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </>
          )}
        </Step>

        <Step n={4} title="Test and connect" done={step === 4}>
          {step === -1 ? (
            <Button variant="outline" onClick={runTest} disabled={!authDone || !scopeDone}>Run connection test</Button>
          ) : (
            <ul className="space-y-2 rounded-lg border p-3 text-sm">
              {checks.map((c, i) => (
                <li key={c} className="flex items-center gap-2.5">
                  {step > i ? <CheckCircle2 className="size-4 text-success" /> : step === i ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Circle className="size-4 text-muted-foreground/40" />}
                  <span className={step >= i ? "" : "text-muted-foreground"}>{c}</span>
                </li>
              ))}
            </ul>
          )}
          {step === 4 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button onClick={connect}>Connect {picked.length > 1 ? `${picked.length} feeds` : vendor}</Button>
              <span className="text-xs text-muted-foreground">All checks passed.</span>
            </div>
          )}
          {!authDone && step === -1 && <p className="mt-2 text-xs text-muted-foreground">Complete steps 1 and 2 to run the test.</p>}
        </Step>
      </ol>

      <aside className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What you get</div>
          {src.direction === "Action out" ? (
            <ul className="mt-2 space-y-2 text-sm">{src.controls!.map((c) => <li key={c.id}><span className="font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.detail}</span></li>)}</ul>
          ) : (
            <>
              <ul className="mt-2 space-y-1 text-sm">{els.map((e) => <li key={e.id} className="flex items-center gap-2"><Check className="size-3.5 text-success" />{e.name}</li>)}</ul>
              {before && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">Confidence</div><div className="font-semibold tabular-nums">{before.confidence}% → {orgScoreFor(previewSource(src.id, true)).confidence}%</div></div>
                  <div><div className="text-xs text-muted-foreground">Org score</div><div className="font-semibold tabular-nums">{before.score}{after ? ` → ${after.score}` : " → after test"}</div></div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before you start</div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
            {(keyed ? ["The key is shown once. Store it in your secrets manager.", "Scores are served by organisation, department, team and person.", "Revoke the key at any time. Access stops immediately."]
              : stream ? [`You need admin access to ${vendor || "the gateway"} to add a log destination.`, "People are matched to your directory by work email.", "You can disconnect at any time. The score recalculates straight away."]
              : [src.auth === "OAuth" ? `An admin of ${vendor || "the other system"} must approve the consent screen.` : "Create a dedicated service credential with the least access needed.", src.direction === "Action out" ? "Changes follow the score on every sync, in both directions." : "People are matched to your directory by work email.", "You can disconnect at any time. The score recalculates straight away."]
            ).map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </aside>
    </div>
  );
}

// ---------- Connected ----------
function Connected({ src }: { src: Source }) {
  const ready = useReady();
  const sig = useSignals();
  const settings = useSettings();
  const runs = useRuns();
  const cfg = useConnectors()[src.id];
  const [syncing, setSyncing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const els = ELEMENTS.filter((e) => e.sourceId === src.id);
  const o = ready ? orgSummary(sig) : null;
  const out = src.direction === "Action out";
  const matched = o ? Math.round(o.total * (0.972 + frac(src.id) * 0.025)) : 0;
  const lastSync = cfg ? formatStamp(cfg.lastSync) : src.lastSync;
  const without = ready ? orgScoreFor(previewSource(src.id, false)) : null;
  const now = ready ? orgScoreFor(sig) : null;
  const applies = (c: Control) => !o ? 0 : c.people === "high" ? o.highCount : c.people === "vipAttacked" ? o.vipAttacked : c.people === "all" ? o.total
    : recommendedActions(sig, settings.automation).filter((a) => runs.some((r) => r.key === a.id && r.status === "Queued")).length;
  const unit = (c: Control) => (c.people === "actions" ? "approved actions" : "people");
  const sync = () => { setSyncing(true); timer.current = setTimeout(() => { setSyncing(false); patchConnector(src.id, { lastSync: new Date().toISOString() }); toast.success(`${src.name} synced`); }, 1400); };
  // Recent runs: spaced by the chosen frequency, sized around this connector's 30-day volume.
  const gap = cfg?.frequency === "Daily" ? 1440 : cfg?.frequency === "Every 15 minutes" ? 15 : 60;
  const base = cfg ? new Date(cfg.lastSync).getTime() : Date.now();
  const perRun = Math.max(1, Math.round((src.events30d / 30 / 1440) * gap));
  const history = Array.from({ length: 6 }, (_, i) => ({ at: new Date(base - i * gap * 60000).toISOString(), records: Math.max(1, Math.round(perRun * (0.7 + frac(src.id, i + 1) * 0.6))) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(out
          ? [["Status", "Sending"], ["Last delivery", lastSync], ["Destination", cfg?.account ?? "Configured"], ["Controls on", `${src.controls!.filter((c) => cfg?.controls[c.id] ?? true).length} of ${src.controls!.length}`]]
          : [["Last sync", lastSync], ["Events in 30 days", fmt(src.events30d)], ["People matched", o ? `${fmt(matched)} of ${fmt(o.total)}` : " "], ["Signals in the score", `${els.filter((e) => sig.active.has(e.id)).length} of ${els.length}`]]
        ).map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-2xl border bg-card p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</div><div className="mt-2 truncate text-xl font-bold tabular-nums">{v}</div></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {out ? (
          <Widget title="Controls" ready={ready} className="lg:col-span-7">
            <div className="divide-y">
              {src.controls!.map((c) => {
                const live = cfg?.controls[c.id] ?? true;
                return (
                  <div key={c.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0"><div className="text-sm font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.detail}</div>
                      <div className="mt-1 text-xs tabular-nums">{live ? <span className="text-success">Applied to {fmt(applies(c))} {unit(c)} now</span> : <span className="text-muted-foreground">Off</span>}</div></div>
                    <Switch checked={live} onCheckedChange={(v) => patchConnector(src.id, { controls: { ...(cfg?.controls ?? {}), [c.id]: v } })} aria-label={c.name} />
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Who a control applies to follows the score. When someone leaves High or Critical, the control lifts on the next delivery.</p>
          </Widget>
        ) : (
          <Widget title="Signals from this source" ready={ready} className="lg:col-span-7">
            <div className="divide-y">
              {els.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0"><div className="text-sm font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{e.pillar} · {e.category} · {(ELEMENT_WEIGHTS[e.id]! * 100).toFixed(1)}% of the score</div></div>
                  <Switch checked={sig.active.has(e.id)} onCheckedChange={(v) => { toggleElement(e.id, v); toast(`${e.name} ${v ? "counted in" : "removed from"} the score`); }} aria-label={`Use ${e.name} in score`} />
                </div>
              ))}
            </div>
            {now && without && <p className="mt-2 text-xs text-muted-foreground">With this source the organisation score is {now.score} at {now.confidence}% confidence. Without it: {without.score} at {without.confidence}%.</p>}
          </Widget>
        )}

        <Widget title={out ? "Recent deliveries" : "Sync history"} ready={ready} className="lg:col-span-5"
          action={<Button variant="outline" size="sm" onClick={sync} disabled={syncing}>{syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{out ? "Send now" : "Sync now"}</Button>}>
          <ul className="divide-y text-sm">
            {history.map((h) => (
              <li key={h.at} className="flex items-center justify-between gap-3 py-2">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-success" />{formatStamp(h.at)}</span>
                <span className="tabular-nums text-muted-foreground">{fmt(h.records)} {out ? "events sent" : "records"}</span>
              </li>
            ))}
          </ul>
        </Widget>

        <Widget title="Connection" ready={ready} className="lg:col-span-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><div className="text-xs text-muted-foreground">Product</div><div className="truncate text-sm font-medium">{cfg?.vendor}</div><div className="truncate text-xs text-muted-foreground">{cfg?.account}</div></div>
            <div><div className="text-xs text-muted-foreground">Authentication</div><div className="text-sm font-medium">{src.auth}</div></div>
            <div><div className="text-xs text-muted-foreground">Connected</div><div className="text-sm font-medium">{cfg ? formatStamp(cfg.connectedAt) : "At onboarding"}</div></div>
            {!out && (
              <div><div className="text-xs text-muted-foreground">Sync</div>
                <Select value={cfg?.frequency ?? FREQ[1]!} onValueChange={(v) => patchConnector(src.id, { frequency: v })} disabled={src.auth === "Log stream"}>
                  <SelectTrigger className="mt-0.5 h-8 w-44"><SelectValue /></SelectTrigger><SelectContent>{[...FREQ, ...(src.auth === "Log stream" ? ["Continuous"] : [])].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
            <p className="text-xs text-muted-foreground">{out ? "Disconnecting stops every control above on the next delivery." : `Disconnecting removes ${els.length} signals from the score${now && without ? ` and takes confidence from ${now.confidence}% to ${without.confidence}%` : ""}.`}</p>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Unplug className="size-4" />Disconnect</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Disconnect {src.name}?</AlertDialogTitle>
                  <AlertDialogDescription>{out ? "The score stops being sent and its controls lift." : now && without ? `The organisation score goes from ${now.score} to ${without.score} and confidence from ${now.confidence}% to ${without.confidence}%. History is kept, so reconnecting restores it.` : "Its signals leave the score."}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { disconnectSource(src.id); toast(`${src.name} disconnected`); }}>Disconnect</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Widget>
      </div>
    </div>
  );
}
