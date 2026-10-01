// The only data layer the vCRO pages use. Every function takes the current store state and returns
// plain data, shaped the way a server would return it, so a real API can replace the bodies later.
import { useSyncExternalStore } from "react";
import {
  DEPARTMENTS, ELEMENTS, HEADCOUNT, INTERVENTIONS, LOCATIONS, MONTHS, SIM_ELEMENT_CHANNEL, SOURCES, TEMPLATES,
  TODAY, WORKFLOWS, type Department,
} from "@/data/catalogue";
import { BENCHMARK, FRAMEWORKS, type Evidence } from "@/data/catalogue";
export { BENCHMARK, FRAMEWORKS };
import { DIRECTORY_GROUPS, PEOPLE, PERSON_BY_ID, TAGS, groupMembers, type Finding, type Person, type Tag } from "@/data/people";
import {
  bandFor, CHANNELS, computeScore, confidenceFor, DEFAULT_CONFIG, elementWeights, failed, isImpulsive, LURES, rates, scoreOnly,
  scoreExact, simulationRisk, skillScore, type Band, type Channel, type Lure, type Readings, type ScoreResult, type ScoringConfig, type SimEvent,
} from "./scoring";

// ---------- Store ----------
/** Admin changes to built-in tags: added or removed by hand per person, and directory groups mapped to a tag. */
export type TagEdits = { add: Record<string, Tag[]>; remove: Record<string, Tag[]>; maps: { group: string; tag: Tag }[] };
const NO_EDITS: TagEdits = { add: {}, remove: {}, maps: [] };
export type SignalState = { connected: Set<string>; disabled: Set<string>; active: Set<string>; weights: Record<string, number>; config: ScoringConfig; edits: TagEdits };
export type Settings = {
  alerts: { enterHigh: boolean; orgRise: number; weekly: boolean; recipients: string };
  automation: { autoRun: boolean; approvalAbove: number };
  /** Goal line on trend charts. Null until the tenant sets it. */
  targetScore: number | null;
  privacy: boolean;
  /** Teams smaller than this show no score, so no one can be singled out through a small group. */
  minGroupSize: number;
  /** Which roles can open vCRO, and how much each one sees. */
  access: Record<RoleId, boolean>;
};
export type RoleId = "admin" | "analyst" | "deptHead" | "manager" | "auditor" | "employee";
export const ROLES: { id: RoleId; name: string; sees: string; locked?: boolean }[] = [
  { id: "admin", name: "Security admin", sees: "Everything, including settings, weights and integrations", locked: true },
  { id: "analyst", name: "Security analyst", sees: "Every page and every person. Cannot change settings or weights" },
  { id: "deptHead", name: "Department head", sees: "Their own department: scorecard, teams and people" },
  { id: "manager", name: "People manager", sees: "Their own team scorecard. Individual scores only where the team is large enough" },
  { id: "auditor", name: "Auditor", sees: "Reports and compliance evidence, with people pseudonymised" },
  { id: "employee", name: "Employee", sees: "Only their own scorecard" },
];
export type WatchlistRule = { department?: string; location?: string; tag?: string; tags?: string[]; minBand?: "Guarded" | "Elevated" | "High" | "Critical"; rising?: boolean; repeatClicker?: boolean };
export type SavedWatchlist = { id: string; name: string; rule: WatchlistRule };
export type Run = { id: string; key: string; workflow: string; target: string; people: number; status: "Queued" | "Dismissed"; at: string };
export type ReportRun = { id: string; template: string; name: string; at: string; score: number; filename: string; mime: string; content: string };

/** A tag an admin created. Members are added by hand, one at a time or in bulk. */
export type CustomTag = { id: string; name: string; about: string; members: string[]; /** Directory groups whose members carry this tag automatically. */ groups?: string[] };
export type ConnectorConfig = { connectedAt: string; vendor: string; account: string; frequency: string; scope: string; lastSync: string; controls: Record<string, boolean> };
type Store = {
  signals: SignalState; settings: Settings; watchlists: SavedWatchlist[]; pinned: string[]; runs: Run[]; reports: ReportRun[]; visited: string[];
  tags: CustomTag[]; connectors: Record<string, ConnectorConfig>;
};

function activeFor(connected: Set<string>, disabled: Set<string>) {
  return new Set(ELEMENTS.filter((e) => connected.has(e.sourceId) && !disabled.has(e.id)).map((e) => e.id));
}
function makeSignals(connected: Set<string>, disabled: Set<string>, weights: Record<string, number>, config: ScoringConfig, edits?: TagEdits): SignalState {
  return { connected, disabled, active: activeFor(connected, disabled), weights, config, edits: edits ?? store.signals.edits };
}
export const DEFAULT_SETTINGS: Settings = {
  alerts: { enterHigh: true, orgRise: 5, weekly: true, recipients: "" },
  automation: { autoRun: true, approvalAbove: 250 },
  targetScore: null, privacy: false, minGroupSize: 5,
  access: { admin: true, analyst: true, deptHead: true, manager: true, auditor: true, employee: false },
};
const DEFAULT_STORE: Store = {
  signals: makeSignals(new Set(SOURCES.filter((s) => s.defaultConnected).map((s) => s.id)), new Set(), {}, DEFAULT_CONFIG, NO_EDITS),
  settings: DEFAULT_SETTINGS, watchlists: [], pinned: [], runs: [], reports: [], visited: [], tags: [],
  // The demo tenant arrives with five integrations already set up.
  connectors: Object.fromEntries(([
    ["int-identity", "Microsoft Entra ID", "demoenterprise.com", "2026-06-12T09:10:00Z", "2026-10-01T10:40:00Z"],
    ["int-endpoint", "CrowdStrike Falcon", "https://api.eu-1.crowdstrike.com", "2026-06-18T11:25:00Z", "2026-10-01T10:42:00Z"],
    ["int-web", "Zscaler", "Log stream", "2026-07-02T08:05:00Z", "2026-10-01T10:44:00Z"],
    ["int-hr", "Workday", "https://wd3.myworkday.com/demoenterprise/scim/v2", "2026-06-12T09:40:00Z", "2026-10-01T06:00:00Z"],
    ["int-osint", "Have I Been Pwned", "https://haveibeenpwned.com/api/v3", "2026-06-20T14:00:00Z", "2026-09-30T23:00:00Z"],
  ] as const).map(([id, vendor, account, connectedAt, lastSync]) => [id, { vendor, account, connectedAt, lastSync, frequency: id === "int-hr" || id === "int-osint" ? "Daily" : "Hourly", scope: "All people", controls: {} }])),
};

let store: Store = DEFAULT_STORE;
const listeners = new Set<() => void>();
// Bump the version when the source catalogue changes, so old saved connections do not hide new defaults.
const KEY = "hf.vcro.v4";

function persist() {
  if (typeof localStorage === "undefined") return;
  const { signals, ...rest } = store;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      ...rest, signals: { connected: [...signals.connected], disabled: [...signals.disabled], weights: signals.weights, config: signals.config, edits: signals.edits },
    }));
  } catch { /* storage full or blocked: state stays in memory for this session */ }
}
function update(patch: Partial<Store>) {
  store = { ...store, ...patch };
  persist();
  listeners.forEach((l) => l());
}
let hydrated = false;
/** Load saved state once on the client. Server render and first client render use the defaults. */
export function hydrateStore() {
  if (hydrated || typeof localStorage === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    const known = new Set(SOURCES.map((s) => s.id));
    const sg = d.signals ?? {};
    store = {
      signals: makeSignals(
        new Set((sg.connected as string[] | undefined)?.filter((x) => known.has(x)) ?? DEFAULT_STORE.signals.connected),
        new Set(sg.disabled ?? []), sg.weights ?? {}, { ...DEFAULT_CONFIG, ...sg.config }, { ...NO_EDITS, ...sg.edits },
      ),
      settings: { ...DEFAULT_SETTINGS, ...d.settings, alerts: { ...DEFAULT_SETTINGS.alerts, ...d.settings?.alerts }, automation: { ...DEFAULT_SETTINGS.automation, ...d.settings?.automation }, access: { ...DEFAULT_SETTINGS.access, ...d.settings?.access } },
      watchlists: d.watchlists ?? [], pinned: d.pinned ?? [], runs: d.runs ?? [], reports: d.reports ?? [], visited: d.visited ?? [], tags: d.tags ?? [], connectors: { ...DEFAULT_STORE.connectors, ...d.connectors },
    };
    listeners.forEach((l) => l());
  } catch { /* unreadable saved state: keep defaults */ }
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
function useSlice<K extends keyof Store>(k: K): Store[K] {
  return useSyncExternalStore(subscribe, () => store[k], () => DEFAULT_STORE[k]);
}
export const useSignals = () => useSlice("signals");
export const useSettings = () => useSlice("settings");
export const useSavedWatchlists = () => useSlice("watchlists");
export const usePinned = () => useSlice("pinned");
export const useRuns = () => useSlice("runs");
export const useReports = () => useSlice("reports");
export const useVisited = () => useSlice("visited");
export const useCustomTags = () => useSlice("tags");
export const useConnectors = () => useSlice("connectors");
/** Remember which vCRO pages this admin has opened, for the setup guide. */
export const markVisited = (page: string) => { if (hydrated && !store.visited.includes(page)) update({ visited: [...store.visited, page] }); };

const S = () => store.signals;
export function previewElement(id: string, on: boolean): SignalState {
  const d = new Set(S().disabled);
  on ? d.delete(id) : d.add(id);
  return makeSignals(S().connected, d, S().weights, S().config);
}
export function previewSource(id: string, on: boolean): SignalState {
  const c = new Set(S().connected);
  on ? c.add(id) : c.delete(id);
  return makeSignals(c, S().disabled, S().weights, S().config);
}
/** Custom category weights (0 to 50 each). Empty object means the default model. */
export const previewWeights = (weights: Record<string, number>): SignalState => makeSignals(S().connected, S().disabled, weights, S().config);
export const previewConfig = (config: ScoringConfig): SignalState => makeSignals(S().connected, S().disabled, S().weights, config);
export const applyState = (next: SignalState) => update({ signals: next });
export const saveSettings = (settings: Settings) => update({ settings });
export const patchSettings = (p: Partial<Settings>) => update({ settings: { ...store.settings, ...p } });
export function resetVcro() {
  store = DEFAULT_STORE;
  persist();
  listeners.forEach((l) => l());
}

const stamp = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
export function addWatchlist(name: string, rule: WatchlistRule) {
  const w = { id: uid("custom"), name, rule };
  update({ watchlists: [...store.watchlists, w] });
  return w;
}
export const removeWatchlist = (id: string) => update({ watchlists: store.watchlists.filter((w) => w.id !== id) });
export const togglePinned = (id: string) => update({ pinned: store.pinned.includes(id) ? store.pinned.filter((x) => x !== id) : [...store.pinned, id] });
export const clearPinned = () => update({ pinned: [] });
export const pinMany = (ids: string[]) => update({ pinned: [...new Set([...store.pinned, ...ids])] });
export function createTag(name: string, about: string) {
  const t: CustomTag = { id: uid("tag"), name, about, members: [] };
  update({ tags: [...store.tags, t] });
  return t;
}
export const deleteTag = (id: string) => update({ tags: store.tags.filter((t) => t.id !== id) });
export const tagPeople = (id: string, ids: string[]) => update({ tags: store.tags.map((t) => (t.id === id ? { ...t, members: [...new Set([...t.members, ...ids])] } : t)) });
export const untagPerson = (id: string, personId: string) => update({ tags: store.tags.map((t) => (t.id === id ? { ...t, members: t.members.filter((m) => m !== personId) } : t)) });
/** Connect a source: record how it was set up and switch its signals on. */
export function connectSource(id: string, cfg: Omit<ConnectorConfig, "connectedAt" | "lastSync">, skip: string[] = []) {
  const c = new Set(S().connected).add(id);
  const d = new Set(S().disabled);
  for (const e of ELEMENTS) if (e.sourceId === id) skip.includes(e.id) ? d.add(e.id) : d.delete(e.id);
  update({ signals: makeSignals(c, d, S().weights, S().config), connectors: { ...store.connectors, [id]: { ...cfg, connectedAt: stamp(), lastSync: stamp() } } });
}
export function disconnectSource(id: string) {
  const c = new Set(S().connected);
  c.delete(id);
  const { [id]: _, ...rest } = store.connectors;
  update({ signals: makeSignals(c, S().disabled, S().weights, S().config), connectors: rest });
}
export const patchConnector = (id: string, p: Partial<ConnectorConfig>) => { const cur = store.connectors[id]; if (cur) update({ connectors: { ...store.connectors, [id]: { ...cur, ...p } } }); };
const withEdits = (edits: TagEdits) => update({ signals: makeSignals(S().connected, S().disabled, S().weights, S().config, edits) });
const without = (m: Record<string, Tag[]>, id: string, tag: Tag) => { const l = (m[id] ?? []).filter((t) => t !== tag); const { [id]: _, ...rest } = m; return l.length ? { ...rest, [id]: l } : rest; };
/** Add or remove a built-in tag for one person by hand, or go back to what the source says. */
export function overrideTag(id: string, tag: Tag, mode: "add" | "remove" | "auto") {
  const e = S().edits;
  const add = without(e.add, id, tag), remove = without(e.remove, id, tag);
  if (mode === "add") add[id] = [...(add[id] ?? []), tag];
  if (mode === "remove") remove[id] = [...(remove[id] ?? []), tag];
  withEdits({ ...e, add, remove });
}
/** Everyone in a directory group gets this built-in tag. */
export const mapGroupToTag = (group: string, tag: Tag) => withEdits({ ...S().edits, maps: [...S().edits.maps.filter((m) => !(m.group === group && m.tag === tag)), { group, tag }] });
export const unmapGroup = (group: string, tag: Tag) => withEdits({ ...S().edits, maps: S().edits.maps.filter((m) => !(m.group === group && m.tag === tag)) });
export const setTagGroups = (id: string, groups: string[]) => update({ tags: store.tags.map((t) => (t.id === id ? { ...t, groups } : t)) });
export const toggleElement = (id: string, on: boolean) => update({ signals: previewElement(id, on) });
/** Record a workflow request. Execution belongs to the Workflows module; vCRO keeps the request and its status. */
export function queueRun(key: string, workflow: string, target: string, people: number) {
  update({ runs: [{ id: uid("run"), key, workflow, target, people, status: "Queued", at: stamp() }, ...store.runs.filter((r) => r.key !== key)] });
}
export const dismissRun = (key: string, workflow: string, target: string, people: number) =>
  update({ runs: [{ id: uid("run"), key, workflow, target, people, status: "Dismissed", at: stamp() }, ...store.runs.filter((r) => r.key !== key)] });
export const clearRun = (key: string) => update({ runs: store.runs.filter((r) => r.key !== key) });
export function addReport(r: Omit<ReportRun, "id" | "at">) {
  const run = { ...r, id: uid("rep"), at: stamp() };
  update({ reports: [run, ...store.reports].slice(0, 12) });
  return run;
}
export const removeReport = (id: string) => update({ reports: store.reports.filter((r) => r.id !== id) });

// ---------- Per-state cache ----------
const caches = new WeakMap<SignalState, Map<string, unknown>>();
function memo<T>(s: SignalState, key: string, fn: () => T): T {
  let m = caches.get(s);
  if (!m) caches.set(s, (m = new Map()));
  if (!m.has(key)) m.set(key, fn());
  return m.get(key) as T;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const isHigh = (b: Band) => b === "High" || b === "Critical";

// ---------- People ----------
export type ChannelStat = { channel: Channel; attempts: number; failures: number; reports: number; failRate: number; reportRate: number; avgTtc: number | null };
export type ScoredPerson = Person & ScoreResult & {
  /** Built-in tags this person carries, from connected sources only. */
  tags: Tag[];
  /** Where a tag came from when it was not the source's own rule: added by hand, or a directory group. */
  tagNotes: Partial<Record<Tag, string>>;
  prev: number | null;
  change: number | null;
  /** Today's readings from connected, switched-on signals only. Nothing from an unconnected source is in here. */
  now: Readings;
  channels: ChannelStat[];
  lures: Record<Lure, number>;
  weakestChannel: Channel | null;
  weakestSignal: { id: string; name: string; category: string; value: number } | null;
  topLure: Lure | null;
  topDriver: string | null;
  lastSimDays: number | null;
  fails180: number;
  impulsive: boolean;
  skill: number | null;
  skillPrev: number | null;
};

const SIM_CHANNEL_ELEMENT = Object.fromEntries(Object.entries(SIM_ELEMENT_CHANNEL).map(([el, ch]) => [ch, el])) as Record<Channel, string>;

function readingsAt(p: Person, monthsAgo: number, cfg: ScoringConfig): Readings {
  const cutoff = monthsAgo * 30;
  const out: Readings = {};
  const k = 1 + p.drift * monthsAgo;
  for (const key in p.readings) {
    const v = p.readings[key]!;
    out[key] = monthsAgo ? { value: Math.max(0, Math.min(100, v.value * k)), ageDays: v.ageDays } : v;
  }
  const per: Partial<Record<Channel, SimEvent[]>> = {};
  let any = false, recentFails = 0;
  for (const s of p.sims) {
    if (s.ageDays < cutoff) continue;
    any = true;
    const age = s.ageDays - cutoff;
    if (failed(s) && age <= 180) recentFails++;
    const list = (per[s.channel] ??= []);
    if (list.length < cfg.simWindow) list.push(cutoff ? { ...s, ageDays: age } : s);
  }
  for (const ch of CHANNELS) {
    const list = per[ch];
    if (list) out[SIM_CHANNEL_ELEMENT[ch]] = { value: simulationRisk(list, cfg)! };
  }
  if (!any && p.sims.length) {
    // Before the person's first recorded campaign: carry their earliest result back as the baseline.
    const first = p.sims[p.sims.length - 1]!;
    out[SIM_CHANNEL_ELEMENT[first.channel]] = { value: simulationRisk([{ ...first, ageDays: 0 }], cfg)! };
    any = true;
  }
  if (any) out["sim-repeat"] = { value: Math.min(100, Math.max(0, recentFails - 1) * 25) };
  else { delete out["sim-mfa"]; delete out["sim-callback"]; }
  return out;
}

export function channelStats(sims: SimEvent[]): ChannelStat[] {
  return CHANNELS.map((channel) => {
    const ev = sims.filter((s) => s.channel === channel);
    const ttc = ev.filter((s) => s.ttcSec != null).map((s) => s.ttcSec!);
    return { channel, ...rates(ev), avgTtc: ttc.length ? Math.round(mean(ttc)) : null };
  });
}
export function lureStats(sims: SimEvent[]): Record<Lure, number> {
  return Object.fromEntries(LURES.map((l) => [l, Math.round(rates(sims.filter((s) => s.lure === l)).failRate * 100)])) as Record<Lure, number>;
}
function liveChannels(active: Set<string>) {
  return new Set(Object.entries(SIM_ELEMENT_CHANNEL).filter(([el]) => active.has(el)).map(([, ch]) => ch));
}

export const ELEMENT_WEIGHTS = elementWeights(ELEMENTS);
const RISK_ELEMENTS = ELEMENTS.filter((e) => e.pillar !== "Reporting");

type Scored = { people: ScoredPerson[]; byId: Map<string, ScoredPerson>; driversNow: Record<string, number>; driversPrev: Record<string, number> };

function scored(s: SignalState): Scored {
  return memo(s, "scored", () => {
    const live = liveChannels(s.active);
    const driversNow: Record<string, number> = {}, driversPrev: Record<string, number> = {};
    let nNow = 0, nPrev = 0;
    const mapped = s.edits.maps.map((m) => ({ ...m, members: groupMembers(m.group) }));
    const people = PEOPLE.map((p): ScoredPerson => {
      const all = readingsAt(p, 0, s.config);
      const now: Readings = {};
      for (const id of s.active) if (all[id]) now[id] = all[id];
      const cur = computeScore(ELEMENTS, now, s.active, s.weights, s.config);
      const v = (id: string) => now[id]?.value ?? 0;
      const f = p.flags, c = s.connected;
      const tags: Tag[] = [];
      if (f.vip) tags.push("VIP");
      if (f.privileged && c.has("int-identity")) tags.push("Privileged");
      if (f.veryAttacked && c.has("esa")) tags.push("Very attacked");
      if (v("exp-breach") > 60) tags.push("Externally exposed");
      if (v("prv-fin") > 60) tags.push("Financial authority");
      if (v("prv-data") > 60) tags.push("Sensitive data");
      if (c.has("int-hr")) { if (f.joiner) tags.push("Joiner or mover"); if (f.leaver) tags.push("Leaver"); if (f.remote) tags.push("Remote worker"); }
      if (f.contractor && c.has("int-hr")) tags.push("Contractor");
      const tagNotes: Partial<Record<Tag, string>> = {};
      if (c.has("int-identity")) for (const m of mapped) if (m.members.has(p.id) && !tags.includes(m.tag)) { tags.push(m.tag); tagNotes[m.tag] = `From directory group ${m.group}`; }
      for (const t of s.edits.add[p.id] ?? []) if (!tags.includes(t)) { tags.push(t); tagNotes[t] = "Added by hand"; }
      const gone = s.edits.remove[p.id];
      if (gone) for (const t of gone) { const i = tags.indexOf(t); if (i >= 0) tags.splice(i, 1); }
      const before = computeScore(ELEMENTS, readingsAt(p, 1, s.config), s.active, s.weights, s.config);
      if (cur.score !== null) { nNow++; for (const c of cur.contributions) driversNow[c.category] = (driversNow[c.category] ?? 0) + c.points * cur.impact; }
      if (before.score !== null) { nPrev++; for (const c of before.contributions) driversPrev[c.category] = (driversPrev[c.category] ?? 0) + c.points * before.impact; }
      let ws: (typeof ELEMENTS)[number] | undefined, best = 0;
      for (const el of RISK_ELEMENTS) {
        const r = now[el.id];
        if (!r || !s.active.has(el.id)) continue;
        const w = r.value * ELEMENT_WEIGHTS[el.id]!;
        if (w > best) { best = w; ws = el; }
      }
      const sims = live.size === CHANNELS.length ? p.sims : p.sims.filter((x) => live.has(x.channel));
      const channels = channelStats(sims);
      const weakest = channels.filter((c) => c.failures > 0).sort((a, b) => b.failRate - a.failRate)[0]?.channel ?? null;
      const lures = lureStats(sims);
      const topLureEntry = Object.entries(lures).sort((a, b) => b[1] - a[1])[0];
      let topDriver: string | null = null, top = 0;
      for (const c of cur.contributions) if (c.points > top) { top = c.points; topDriver = c.category; }
      return {
        ...p, ...cur, tags, tagNotes, now, prev: before.score,
        change: cur.score !== null && before.score !== null ? cur.score - before.score : null,
        channels, lures, weakestChannel: weakest,
        weakestSignal: ws ? { id: ws.id, name: ws.name, category: ws.category, value: Math.round(now[ws.id]!.value) } : null,
        topLure: topLureEntry && topLureEntry[1] > 0 ? (topLureEntry[0] as Lure) : null,
        topDriver, lastSimDays: p.sims[0]?.ageDays ?? null,
        fails180: sims.filter((x) => failed(x) && x.ageDays <= 180).length,
        impulsive: sims.some((x) => isImpulsive(x, s.config.impulsiveSeconds) && x.ageDays <= 180),
        skill: skillScore(cur, p.knowledge), skillPrev: skillScore(before, p.knowledge),
      };
    });
    for (const k in driversNow) driversNow[k] = driversNow[k]! / (nNow || 1);
    for (const k in driversPrev) driversPrev[k] = driversPrev[k]! / (nPrev || 1);
    return { people, byId: new Map(people.map((p) => [p.id, p])), driversNow, driversPrev };
  });
}

export const getPeople = (s: SignalState): ScoredPerson[] => scored(s).people;
export const getPerson = (s: SignalState, id: string) => scored(s).byId.get(id) ?? null;
export const managerName = (id: string | null) => (id ? PERSON_BY_ID.get(id)?.name ?? "None" : "None");

/** 12 monthly scores for one person, oldest first. Computed on demand for the rows on screen. */
export function historyOf(s: SignalState, p: ScoredPerson): (number | null)[] {
  const m = monthly(s, false);
  if (m) { const i = Number(p.id.slice(1)) - 1; return Array.from({ length: 12 }, (_, k) => (m[i * 12 + k]! < 0 ? null : m[i * 12 + k]!)); }
  return memo(s, `h:${p.id}`, () => MONTHS.map((_, i) => (i === 11 ? p.score : scoreOnly(ELEMENTS, readingsAt(p, 11 - i, s.config), s.active, s.weights, s.config))));
}
/** Every person's score for each of the last 12 months. -1 means no score. The one heavy pass: trend pages only. */
function monthly(s: SignalState, build: true): Int8Array;
function monthly(s: SignalState, build: false): Int8Array | null;
function monthly(s: SignalState, build: boolean): Int8Array | null {
  const m = caches.get(s);
  if (!build && !m?.has("monthly")) return null;
  return memo(s, "monthly", () => {
    const people = getPeople(s);
    const out = new Int8Array(people.length * 12);
    people.forEach((p, i) => {
      for (let k = 0; k < 12; k++) {
        const v = k === 11 ? p.score : k === 10 ? p.prev : scoreOnly(ELEMENTS, readingsAt(p, 11 - k, s.config), s.active, s.weights, s.config);
        out[i * 12 + k] = v === null ? -1 : v;
      }
    });
    return out;
  });
}

// ---------- Aggregates ----------
export function orgScoreFor(s: SignalState) {
  return memo(s, "orgScore", () => {
    const scores: number[] = [];
    for (const p of PEOPLE) {
      const v = scoreOnly(ELEMENTS, readingsAt(p, 0, s.config), s.active, s.weights, s.config);
      if (v !== null) scores.push(v);
    }
    return { score: Math.round(mean(scores)), confidence: confidenceFor(ELEMENTS, (e) => s.active.has(e.id)) };
  });
}

export type DeptStat = {
  department: Department; headcount: number; scored: number; score: number; prev: number; change: number; band: Band;
  likelihood: number; privilege: number; topDriver: string; high: number;
};
function statFor(ps: ScoredPerson[]) {
  const sc = ps.filter((p) => p.score !== null);
  const score = Math.round(mean(sc.map((p) => p.score!)));
  const prev = Math.round(mean(sc.filter((p) => p.prev !== null).map((p) => p.prev!)));
  const drivers: Record<string, number> = {};
  for (const p of sc) for (const c of p.contributions) if (c.points > 0) drivers[c.category] = (drivers[c.category] ?? 0) + c.points;
  return {
    scored: sc.length, score, prev, change: score - prev, band: sc.length ? bandFor(score) : ("No score" as Band),
    likelihood: Math.round(mean(sc.map((p) => p.likelihood))), privilege: Math.round(mean(sc.map((p) => p.privilege))),
    topDriver: Object.entries(drivers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None", high: sc.filter((p) => isHigh(p.band)).length,
  };
}
export function deptStats(s: SignalState): DeptStat[] {
  return memo(s, "depts", () => {
    const people = getPeople(s);
    return DEPARTMENTS.map((d) => ({ department: d, headcount: HEADCOUNT[d], ...statFor(people.filter((p) => p.department === d)) }));
  });
}
export type TeamStat = ReturnType<typeof statFor> & { managerId: string; manager: string; role: string; size: number };
/** Teams inside a department: each manager with their direct reports. */
export function teamStats(s: SignalState, d: Department): TeamStat[] {
  return memo(s, `teams:${d}`, () => {
    const byMgr = new Map<string, ScoredPerson[]>();
    for (const p of getPeople(s)) if (p.department === d && p.managerId) byMgr.set(p.managerId, [...(byMgr.get(p.managerId) ?? []), p]);
    return [...byMgr.entries()].filter(([id]) => PERSON_BY_ID.get(id)?.department === d).map(([id, ps]) => {
      const m = PERSON_BY_ID.get(id)!;
      return { managerId: id, manager: m.name, role: m.role, size: ps.length, ...statFor(ps) };
    }).sort((a, b) => b.score - a.score);
  });
}

export function orgSummary(s: SignalState) {
  return memo(s, "org", () => {
    const { people, driversNow, driversPrev } = scored(s);
    const sc = people.filter((p) => p.score !== null);
    const score = Math.round(mean(sc.map((p) => p.score!)));
    const prev = Math.round(mean(sc.filter((p) => p.prev !== null).map((p) => p.prev!)));
    const live = liveChannels(s.active);
    const allSims = people.flatMap((p) => (live.size === CHANNELS.length ? p.sims : p.sims.filter((x) => live.has(x.channel))));
    const sim = rates(allSims);
    const high = sc.filter((p) => isHigh(p.band));
    const sorted = sc.map((p) => Math.max(0, p.score! - 20)).sort((a, b) => b - a);
    const totalRisk = sorted.reduce((a, b) => a + b, 0) || 1;
    const pareto: { people: number; risk: number }[] = [{ people: 0, risk: 0 }];
    let acc = 0;
    const step = Math.max(1, Math.round(sorted.length / 20));
    sorted.forEach((v, i) => {
      acc += v;
      if ((i + 1) % step === 0 || i === sorted.length - 1) pareto.push({ people: Math.round(((i + 1) / sorted.length) * 100), risk: Math.round((acc / totalRisk) * 100) });
    });
    // Same cut as the Top 10% by risk watchlist, ties included, so the two counts always agree.
    const cut = sorted[Math.max(0, Math.round(sorted.length * 0.1) - 1)] ?? 0;
    const topN = sorted.filter((v) => v >= cut).length;
    const drivers = Object.keys({ ...driversNow, ...driversPrev })
      .map((category) => ({ category, delta: Math.round(((driversNow[category] ?? 0) - (driversPrev[category] ?? 0)) * 10) / 10 }))
      .filter((d) => d.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return {
      people, total: people.length, scored: sc.length, score, prev, change: score - prev, band: bandFor(score),
      confidence: confidenceFor(ELEMENTS, (e) => s.active.has(e.id)), activeCount: s.active.size, totalElements: ELEMENTS.length,
      pillars: { Behaviour: Math.round(mean(sc.map((p) => p.behaviour))), Exposure: Math.round(mean(sc.map((p) => p.exposure))), Privilege: Math.round(mean(sc.map((p) => p.privilege))) },
      bands: (["Low", "Guarded", "Elevated", "High", "Critical"] as const).map((b) => ({ band: b, count: sc.filter((p) => p.band === b).length })),
      aiAgents: (() => { const v = sc.map((p) => p.categories["AI agents"]).filter((x): x is number => x != null); return v.length ? Math.round(mean(v)) : null; })(),
      highCount: high.length, highShare: people.length ? high.length / people.length : 0,
      enteredHigh: high.filter((p) => p.prev !== null && p.prev <= 60).length,
      leftHigh: sc.filter((p) => !isHigh(p.band) && p.prev !== null && p.prev > 60).length,
      reportRate: sim.reportRate, failRate: sim.failRate, simEvents: sim.attempts,
      repeatCount: people.filter((p) => p.fails180 >= 2).length,
      vipAttacked: people.filter((p) => p.tags.includes("VIP") && p.tags.includes("Very attacked")).length,
      lowConfidence: sc.filter((p) => p.lowConfidence).length,
      departments: deptStats(s), pareto, drivers,
      /** Average points each driver adds to a person's score today. They add up to the organisation score. */
      makeup: (() => {
        const up = Object.entries(driversNow).filter(([c, v]) => c !== "Reporting offset" && v > 0).map(([category, points]) => ({ category, points: Math.round(points * 10) / 10 })).sort((a, b) => b.points - a.points);
        // The reporting credit is whatever separates the drivers from the actual average score, so the list always adds up.
        const credit = Math.round((mean(sc.map((p) => p.score!)) - up.reduce((a, d) => a + d.points, 0)) * 10) / 10;
        return credit < 0 ? [...up, { category: "Reporting offset", points: credit }] : up;
      })(),
      concentration: { people: Math.round((topN / (sorted.length || 1)) * 100), risk: Math.round((sorted.slice(0, topN).reduce((a, b) => a + b, 0) / totalRisk) * 100), count: topN },
      channels: channelStats(allSims), lures: lureStats(allSims), simsLive: allSims.length > 0,
    };
  });
}

export type TrendPoint = { month: string; score: number; /** One decimal, for charts. */ value: number; band: Band; delta: number; intervention: string | null };
/** Monthly averages for the organisation, each department and each band count. */
export function trends(s: SignalState) {
  return memo(s, "trends", () => {
    const m = monthly(s, true);
    const people = getPeople(s);
    /** Average to one decimal, so month-to-month movement shows as a slope and not as steps. */
    const avg = (idx: number[], k: number) => {
      let sum = 0, n = 0;
      for (const i of idx) { const v = m[i * 12 + k]!; if (v >= 0) { sum += v; n++; } }
      return n ? Math.round((sum / n) * 10) / 10 : null;
    };
    const all = people.map((_, i) => i);
    const org: TrendPoint[] = MONTHS.map((month, k) => {
      const value = avg(all, k) ?? 0;
      const score = Math.round(value);
      return { month, score, value, band: bandFor(score), delta: 0, intervention: INTERVENTIONS.find((x) => x.month === month)?.label ?? null };
    });
    org.forEach((t, k) => { t.delta = k ? t.score - org[k - 1]!.score : 0; });
    return { org, matrix: m, avg };
  });
}
export function deptLures(s: SignalState, d: Department) {
  return memo(s, `lures:${d}`, () => lureStats(getPeople(s).filter((p) => p.department === d).flatMap((p) => p.sims)));
}

// ---------- Recommended actions ----------
const SIM_IDS = ELEMENTS.filter((e) => e.category === "Simulations").map((e) => e.id);
type ActionDef = { id: string; action: string; target: string; workflow: (typeof WORKFLOWS)[number]; lowEffort: boolean; fix: string[]; members: (p: ScoredPerson) => boolean; watchlist?: string; dept?: Department };
export type Action = Omit<ActionDef, "members"> & { people: number; perPerson: number; orgDrop: number; mode: "Automatic" | "Needs approval"; rank: number };

/** Per signal, the level the best-performing quarter of the organisation is at or below. */
function medians(s: SignalState): Record<string, number> {
  return memo(s, "medians", () => {
    const out: Record<string, number> = {};
    const people = getPeople(s);
    for (const el of ELEMENTS) {
      const vals = people.map((p) => p.now[el.id]?.value).filter((v): v is number => v != null).sort((a, b) => a - b);
      if (vals.length) out[el.id] = vals[Math.floor(vals.length / 4)]!;
    }
    return out;
  });
}
/** Score this person would have if the given signals improved to the level of the best-performing quarter. */
export function whatIf(s: SignalState, p: ScoredPerson, fix: string[]): number | null {
  if (p.score === null) return null;
  const med = medians(s);
  const r: Readings = { ...p.now };
  for (const id of fix) { const cur = r[id]; const m = med[id]; if (cur && m != null && cur.value > m) r[id] = { ...cur, value: m }; }
  return scoreOnly(ELEMENTS, r, s.active, s.weights, s.config);
}

export function recommendedActions(s: SignalState, auto: Settings["automation"]): Action[] {
  const base = memo(s, "actions", () => {
    const people = getPeople(s);
    const scoredN = people.filter((p) => p.score !== null).length || 1;
    const voice = [...deptStats(s)].map((d) => {
      const ev = people.filter((p) => p.department === d.department).flatMap((p) => p.sims.filter((x) => x.channel === "Voice"));
      return { d: d.department, rate: rates(ev).failRate };
    }).sort((a, b) => b.rate - a.rate)[0]!;
    const defs: ActionDef[] = [
      { id: "a1", action: "Remediate repeat clickers", target: "Repeat clickers", workflow: "Repeat clicker remediation", lowEffort: false, fix: SIM_IDS, members: (p) => p.fails180 >= 2, watchlist: "repeat-clickers" },
      { id: "a2", action: "Reset credential submitters", target: "Credential submitters", workflow: "Credential submitter reset", lowEffort: false, fix: ["sim-email", "sim-vish", "sim-smish", "sim-deepfake"], members: (p) => p.sims.some((x) => x.outcome === "Data entered" && x.ageDays <= 120), watchlist: "credential-submitters" },
      { id: "a3", action: "Brief targeted VIPs", target: "Very attacked VIPs", workflow: "VIP protection briefing", lowEffort: false, fix: ["sim-deepfake", "sim-vish", "sim-callback"], members: (p) => p.tags.includes("VIP") && p.tags.includes("Very attacked"), watchlist: "very-attacked-vips" },
      { id: "a4", action: "Run vishing drill", target: voice.d, workflow: "Vishing awareness drill", lowEffort: false, fix: ["sim-vish", "sim-callback"], members: (p) => p.department === voice.d, dept: voice.d },
      { id: "a5", action: "Assign QR module", target: "Weakest on QR", workflow: "QR safety micro-module", lowEffort: true, fix: ["sim-qr"], members: (p) => p.weakestChannel === "QR" },
      { id: "a6", action: "Chase overdue training", target: "Overdue training", workflow: "Overdue training reminder", lowEffort: true, fix: ["lrn-overdue", "lrn-complete"], members: (p) => (p.now["lrn-overdue"]?.value ?? 0) > 60, watchlist: "overdue-training" },
    ];
    return defs.map(({ members, ...d }) => {
      const group = people.filter(members);
      let drop = 0;
      for (const p of group) { const w = whatIf(s, p, d.fix); if (w !== null) drop += Math.max(0, p.score! - w); }
      return { ...d, people: group.length, perPerson: group.length ? Math.round((drop / group.length) * 10) / 10 : 0, orgDrop: Math.round((drop / scoredN) * 100) / 100 };
    }).sort((a, b) => b.orgDrop - a.orgDrop);
  });
  return base.map((a, i) => ({ ...a, rank: i + 1, mode: auto.autoRun && a.lowEffort && a.people <= auto.approvalAbove ? "Automatic" : "Needs approval" }));
}

const STEP_FIX: Record<string, string[]> = {
  channel: SIM_IDS, cred: ["sim-email", "sim-vish", "sim-smish", "sim-deepfake"], overdue: ["lrn-overdue", "lrn-complete"], vip: ["sim-deepfake", "sim-vish", "sim-callback"],
};
export function nextSteps(s: SignalState, p: ScoredPerson) {
  const steps: { id: string; action: string; workflow: (typeof WORKFLOWS)[number]; fix: string[] }[] = [];
  if (p.weakestChannel) steps.push({ id: "channel", action: `Assign ${p.weakestChannel === "QR" || p.weakestChannel === "SMS" ? p.weakestChannel : p.weakestChannel.toLowerCase()} lure coaching`, workflow: "Repeat clicker remediation", fix: [SIM_CHANNEL_ELEMENT[p.weakestChannel]] });
  if (p.sims.some((x) => x.outcome === "Data entered" && x.ageDays <= 120)) steps.push({ id: "cred", action: "Reset credentials and coach", workflow: "Credential submitter reset", fix: STEP_FIX["cred"]! });
  if ((p.now["lrn-overdue"]?.value ?? 0) > 50) steps.push({ id: "overdue", action: "Complete overdue training", workflow: "Overdue training reminder", fix: STEP_FIX["overdue"]! });
  if (p.tags.includes("VIP")) steps.push({ id: "vip", action: "Schedule VIP briefing", workflow: "VIP protection briefing", fix: STEP_FIX["vip"]! });
  return steps.map((st) => { const w = whatIf(s, p, st.fix); return { ...st, impact: w === null ? 0 : Math.max(0, p.score! - w) }; })
    .sort((a, b) => b.impact - a.impact).slice(0, 3);
}

// ---------- Score ledger ----------
/** What each simulation did to this person's score: today's score against the score without that one event. */
export function scoreLedger(s: SignalState, p: ScoredPerson): Record<string, number> {
  return memo(s, `ledger:${p.id}`, () => {
    const out: Record<string, number> = {};
    if (p.score === null) return out;
    const exact = (person: Person) => {
      const all = readingsAt(person, 0, s.config);
      const now: Readings = {};
      for (const id of s.active) if (all[id]) now[id] = all[id];
      return scoreExact(ELEMENTS, now, s.active, s.weights, s.config);
    };
    const base = exact(p);
    if (base === null) return out;
    for (const ev of p.sims) {
      const w = exact({ ...p, sims: p.sims.filter((x) => x.id !== ev.id) });
      if (w !== null) out[ev.id] = Math.round((base - w) * 10) / 10;
    }
    return out;
  });
}

// ---------- Compliance evidence ----------
/** Live evidence vCRO holds for each kind of control requirement. */
export function evidenceFor(s: SignalState): Record<Evidence, { label: string; value: string; met: boolean; needs?: string }> {
  const o = orgSummary(s), t = awarenessTotals(s), people = getPeople(s);
  const priv = people.filter((p) => p.tags.includes("Privileged") || p.tags.includes("VIP") || p.tags.includes("Financial authority"));
  const privDone = priv.filter((p) => (p.now["lrn-complete"]?.value ?? 100) < 50).length;
  const joiners = people.filter((p) => p.tags.includes("Joiner or mover"));
  const joinDone = joiners.filter((p) => (p.now["lrn-complete"]?.value ?? 100) < 50).length;
  const share = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return {
    training: { label: "Training completion", value: `${t.completion}% complete · ${fmt(t.overdue)} people overdue`, met: s.active.has("lrn-complete") },
    simulation: { label: "Simulated attacks", value: `${fmt(o.simEvents)} simulations across 5 channels in 12 months · ${pct(o.failRate)} failed`, met: o.simsLive },
    reporting: { label: "Threat reporting", value: `${pct(o.reportRate)} of simulations reported`, met: s.active.has("rep-sim") },
    policy: { label: "Policy acknowledgement", value: `${t.policy}% of people acknowledged the current policies`, met: s.active.has("cul-policy") },
    privileged: { label: "Privileged and sensitive roles", value: `${fmt(priv.length)} people identified · ${share(privDone, priv.length)}% trained`, met: s.connected.has("int-identity"), needs: "int-identity" },
    measurement: { label: "Measurement and review", value: `Organisation score ${o.score}, ${o.change === 0 ? "unchanged" : `${o.change > 0 ? "up" : "down"} ${Math.abs(o.change)}`} since ${PREV_MONTH} · monthly trend kept for 12 months`, met: true },
    joiners: { label: "Joiners and movers", value: `${fmt(joiners.length)} in the last 90 days · ${share(joinDone, joiners.length)}% trained`, met: s.connected.has("int-hr"), needs: "int-hr" },
  };
}

// ---------- Person findings ----------

/** What is public about a person. Empty unless OSINT monitoring is connected. */
export function exposureFindings(p: ScoredPerson): Finding[] {
  const v = (id: string) => p.now[id]?.value ?? 0;
  const out: Finding[] = [];
  if (v("exp-breach") > 60) out.push({ item: "Work email found in a public breach", level: "High", sourceId: "int-osint" });
  if (v("exp-contact") > 50) out.push({ item: "Mobile number listed publicly", level: "Medium", sourceId: "int-osint" });
  if (v("exp-social") > 45) out.push({ item: "Role and manager visible on a social profile", level: "Low", sourceId: "int-osint" });
  if (v("exp-inbound") > 60) out.push({ item: "Receives a high volume of phishing", level: "Medium", sourceId: "esa" });
  if (v("exp-imperson") > 60) out.push({ item: "Often impersonated in inbound email", level: "High", sourceId: "int-email" });
  return out;
}
/** What a person can reach or approve, from connected sources only. */
export function accessFindings(p: ScoredPerson): Finding[] {
  const v = (id: string) => p.now[id]?.value ?? 0;
  const out: Finding[] = [];
  if (v("prv-admin") > 55) out.push({ item: "Holds admin accounts", level: "High", sourceId: "int-identity" });
  if (v("prv-critical") > 55) out.push({ item: "Signs in to critical systems", level: "High", sourceId: "int-identity" });
  if (v("prv-mfa") > 60) out.push({ item: "Weak MFA method on their account", level: "Medium", sourceId: "int-identity" });
  if (v("prv-fin") > 60) out.push({ item: "Payment approval authority", level: "High", sourceId: "recipients" });
  if (v("prv-shared") > 50) out.push({ item: "Owns shared mailboxes", level: "Medium", sourceId: "recipients" });
  if (v("prv-data") > 60) out.push({ item: "Regular access to sensitive data", level: "High", sourceId: "int-data" });
  if (v("prv-standing") > 55) out.push({ item: "Standing privileged access", level: "High", sourceId: "int-pam" });
  if (v("ai-perms") > 55) out.push({ item: "Owns AI agents with broad permissions", level: "Medium", sourceId: "int-ai" });
  if (p.level !== "Individual") out.push({ item: p.level === "Head" ? "Leads a department" : "Manages a team", level: "Low", sourceId: "recipients" });
  return out;
}
/** Sources that would add to a person's picture but are not connected. */
export function missingSources(s: SignalState, pillar: "Exposure" | "Privilege") {
  const ids = new Set(ELEMENTS.filter((e) => e.pillar === pillar && !s.connected.has(e.sourceId)).map((e) => e.sourceId));
  return SOURCES.filter((x) => ids.has(x.id));
}

// ---------- Alerts ----------
export type Alert = { id: string; text: string; to: "people" | "trend" };
export function alerts(s: SignalState, set: Settings): Alert[] {
  const o = orgSummary(s);
  const out: Alert[] = [];
  if (set.alerts.enterHigh && o.enteredHigh > 0) out.push({ id: "high", text: `${fmt(o.enteredHigh)} ${o.enteredHigh === 1 ? "person" : "people"} entered High or Critical since ${PREV_MONTH}`, to: "people" });
  if (set.alerts.orgRise > 0 && o.change >= set.alerts.orgRise) out.push({ id: "rise", text: `Organisation score rose ${o.change} pts since ${PREV_MONTH}`, to: "trend" });
  return out;
}

// ---------- Signals ----------
/** One set of counts for every page: modules, integrations that feed the score, integrations that act on it. */
export function signalStats(s: SignalState) {
  const of = (f: (x: (typeof SOURCES)[number]) => boolean) => { const l = SOURCES.filter(f); return { on: l.filter((x) => s.connected.has(x.id)).length, total: l.length }; };
  const modules = of((x) => x.kind === "Module"), inbound = of((x) => x.direction === "Signal in"), outbound = of((x) => x.direction === "Action out");
  return {
    modules, inbound, outbound,
    integrations: { on: inbound.on + outbound.on, total: inbound.total + outbound.total },
    active: s.active.size, total: ELEMENTS.length, confidence: confidenceFor(ELEMENTS, (e) => s.active.has(e.id)), lastSync: "1 Oct, 10:44",
  };
}
const fromOf = (els: typeof ELEMENTS) => [...new Set(els.map((e) => SOURCES.find((x) => x.id === e.sourceId)!.name))];
export function signalCoverage(s: SignalState) {
  const pillars = (["Behaviour", "Exposure", "Privilege", "Reporting"] as const).map((pillar) => {
    const els = ELEMENTS.filter((e) => e.pillar === pillar);
    const w = els.reduce((a, e) => a + ELEMENT_WEIGHTS[e.id]!, 0) || 1;
    const live = els.filter((e) => s.active.has(e.id));
    return { pillar: pillar as string, active: live.length, total: els.length, coverage: Math.round((live.reduce((a, e) => a + ELEMENT_WEIGHTS[e.id]!, 0) / w) * 100), from: fromOf(live) };
  });
  const ai = ELEMENTS.filter((e) => e.category === "AI agents");
  const aiLive = ai.filter((e) => s.active.has(e.id));
  pillars.push({ pillar: "AI identities", active: aiLive.length, total: ai.length, coverage: Math.round((aiLive.length / ai.length) * 100), from: fromOf(aiLive) });
  const sources = SOURCES.filter((x) => x.direction !== "Action out").map((x) => ({ ...x, on: s.connected.has(x.id) }));
  return { pillars, sources, events30d: sources.filter((x) => x.on).reduce((a, x) => a + x.events30d, 0), missing: sources.filter((x) => !x.on && x.kind === "Integration") };
}
/** For each driver of the score: the connected sources its signals come from, by product name. */
export function driverSources(s: SignalState, connectors: Record<string, ConnectorConfig>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of ELEMENTS) {
    if (!s.active.has(e.id)) continue;
    const src = SOURCES.find((x) => x.id === e.sourceId)!;
    const name = src.kind === "Module" ? src.name : connectors[src.id]?.vendor ?? src.name;
    const key = e.pillar === "Reporting" ? "Reporting offset" : e.category;
    if (!(out[key] ??= []).includes(name)) out[key]!.push(name);
  }
  return out;
}
/** Unconnected sources ranked by how much confidence each would add. */
export function bestNextSources(s: SignalState) {
  const base = confidenceFor(ELEMENTS, (e) => s.active.has(e.id));
  return SOURCES.filter((x) => x.direction === "Signal in" && !s.connected.has(x.id)).map((x) => {
    const g = sourceGain(s, x.id);
    return { id: x.id, name: x.name, signals: g.signals.length, gain: g.confidence - base };
  }).sort((a, b) => b.gain - a.gain);
}
/** What connecting one more source would add: signals gained and confidence after. */
export function sourceGain(s: SignalState, sourceId: string) {
  const next = previewSource(sourceId, true);
  return { signals: ELEMENTS.filter((e) => e.sourceId === sourceId).map((e) => e.name), confidence: confidenceFor(ELEMENTS, (e) => next.active.has(e.id)) };
}

export function weakestSignals(s: SignalState) {
  return memo(s, "weakest", () => {
    const people = getPeople(s);
    return RISK_ELEMENTS.filter((el) => s.active.has(el.id)).map((el) => {
      let sum = 0, n = 0, atRisk = 0;
      for (const p of people) { const r = p.now[el.id]; if (!r) continue; sum += r.value; n++; if (r.value >= 60) atRisk++; }
      const avg = n ? Math.round(sum / n) : 0;
      return { id: el.id, name: el.name, category: el.category, pillar: el.pillar, avg, atRisk, impact: avg * ELEMENT_WEIGHTS[el.id]! };
    }).sort((a, b) => b.impact - a.impact);
  });
}

export const HEAT_CATEGORIES = ["Simulations", "Real-world incidents", "Learning", "Security hygiene", "Culture", "Targeting", "Human OSINT", "Role visibility", "Access and admin", "Financial authority", "Data access", "AI agents"] as const;
export function deptHeatmap(s: SignalState) {
  return memo(s, "heat", () => {
    const people = getPeople(s).filter((p) => p.score !== null);
    return DEPARTMENTS.map((d) => {
      const ps = people.filter((p) => p.department === d);
      return { department: d, cells: HEAT_CATEGORIES.map((c) => {
        const vals = ps.map((p) => p.categories[c]).filter((v): v is number => v != null);
        return { category: c, value: vals.length ? Math.round(mean(vals)) : null };
      }) };
    });
  });
}

export function awarenessByDept(s: SignalState) {
  return memo(s, "aware", () => {
    const people = getPeople(s);
    return DEPARTMENTS.map((d) => {
      const ps = people.filter((p) => p.department === d);
      const share = (id: string) => { let n = 0, good = 0; for (const p of ps) { const r = p.now[id]; if (r) { n++; if (r.value < 50) good++; } } return n ? Math.round((good / n) * 100) : 0; };
      const sim = rates(ps.flatMap((p) => p.sims));
      return {
        department: d,
        completion: share("lrn-complete"),
        overdue: ps.filter((p) => (p.now["lrn-overdue"]?.value ?? 0) > 60).length,
        jit: share("lrn-jit"),
        policy: share("cul-policy"),
        repeat: ps.filter((p) => p.fails180 >= 2).length,
        reportRate: Math.round(sim.reportRate * 100), people: ps.length,
      };
    });
  });
}

/** Organisation-wide awareness figures, counted per person. Every page uses these, so they always agree. */
export function awarenessTotals(s: SignalState) {
  return memo(s, "awareTotals", () => {
    const people = getPeople(s);
    const share = (id: string) => { let n = 0, good = 0; for (const p of people) { const r = p.now[id]; if (r) { n++; if (r.value < 50) good++; } } return n ? Math.round((good / n) * 100) : 0; };
    return { completion: share("lrn-complete"), jit: share("lrn-jit"), policy: share("cul-policy"), overdue: people.filter((p) => (p.now["lrn-overdue"]?.value ?? 0) > 60).length };
  });
}

// ---------- Report data ----------
/** Simulation results per department. */
export function simsByDept(s: SignalState) {
  return memo(s, "simsDept", () => DEPARTMENTS.map((d) => {
    const ps = getPeople(s).filter((p) => p.department === d);
    const r = rates(ps.flatMap((p) => p.sims));
    return { department: d, people: ps.length, simulations: r.attempts, failRate: Math.round(r.failRate * 100), reportRate: Math.round(r.reportRate * 100), repeat: ps.filter((p) => p.fails180 >= 2).length, impulsive: ps.filter((p) => p.impulsive).length };
  }));
}
/** How many people sit in each 10-point slice of the scale. */
export function scoreHistogram(s: SignalState) {
  return memo(s, "hist", () => {
    const bins = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10 + (i ? 1 : 0)} to ${(i + 1) * 10}`, from: i * 10, people: 0, band: bandFor(i * 10 + 5) }));
    for (const p of getPeople(s)) if (p.score !== null) bins[Math.min(9, Math.max(0, Math.ceil(p.score / 10) - 1))]!.people++;
    return bins;
  });
}
/** Even axis ticks that always include the data. */
export function axisFor(values: number[], pad = 3): { domain: [number, number]; ticks: number[] } {
  if (!values.length) return { domain: [0, 100], ticks: [0, 25, 50, 75, 100] };
  const lo = Math.max(0, Math.min(...values) - pad), hi = Math.min(100, Math.max(...values) + pad);
  const step = hi - lo <= 12 ? 2 : hi - lo <= 30 ? 5 : hi - lo <= 60 ? 10 : 20;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
  return { domain: [a, b], ticks: Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step) };
}

// ---------- Tags, groups and watchlists ----------
export type GroupKind = "who" | "behaviour" | "own";
export type WatchlistDef = { id: string; name: string; rule: string; kind: GroupKind; custom?: boolean; match: (p: ScoredPerson) => boolean;
  /** Set when the source that supplies this group is not connected: the group is empty until it is. */
  needs?: { sourceId: string; source: string } };
const BAND_MIN: Record<string, number> = { Guarded: 21, Elevated: 41, High: 61, Critical: 81 };
const ruleTags = (r: WatchlistRule) => [...(r.tags ?? []), ...(r.tag ? [r.tag] : [])];
export function describeRule(r: WatchlistRule) {
  const t = ruleTags(r);
  const parts = [r.department && `Department ${r.department}`, r.location && `Location ${r.location}`, t.length && `Tagged ${t.join(" and ")}`, r.minBand && `${r.minBand} or above`, r.rising && "Score rising", r.repeatClicker && "2 or more fails in 180 days"].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Everyone scored";
}
/** Names of the admin-made tags each person carries: added by hand, or through a mapped directory group. */
export function customTagsByPerson(tags: CustomTag[], s: SignalState): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const put = (id: string, name: string) => { const l = out.get(id); if (!l) out.set(id, [name]); else if (!l.includes(name)) l.push(name); };
  const directory = s.connected.has("int-identity");
  for (const t of tags) {
    for (const m of t.members) put(m, t.name);
    if (directory) for (const g of t.groups ?? []) for (const m of groupMembers(g)) put(m, t.name);
  }
  return out;
}
const ruleMatch = (r: WatchlistRule, custom: Map<string, string[]>) => {
  const want = ruleTags(r);
  return (p: ScoredPerson) =>
    (!r.department || p.department === r.department) && (!r.location || p.location === r.location)
    && want.every((t) => (p.tags as string[]).includes(t) || custom.get(p.id)?.includes(t))
    && (!r.minBand || (p.score !== null && p.score >= BAND_MIN[r.minBand]!))
    && (!r.rising || (p.change ?? 0) > 0) && (!r.repeatClicker || p.fails180 >= 2);
};
export const countRule = (s: SignalState, r: WatchlistRule, tags: CustomTag[]) => getPeople(s).filter(ruleMatch(r, customTagsByPerson(tags, s))).length;

function builtIn(s: SignalState): WatchlistDef[] {
  const sc = getPeople(s).filter((x) => x.score !== null).map((x) => x.score!).sort((a, b) => b - a);
  const cut = sc[Math.max(0, Math.round(sc.length * 0.1) - 1)] ?? 101;
  const b = (id: string, name: string, rule: string, match: WatchlistDef["match"]): WatchlistDef => ({ id, name, rule, kind: "behaviour", match });
  return [
    { id: "very-attacked-vips", name: "Very attacked VIPs", rule: "Tagged VIP and Very attacked", kind: "who", match: (p) => p.tags.includes("VIP") && p.tags.includes("Very attacked") },
    ...TAGS.map((t): WatchlistDef => ({ id: `tag:${t.name}`, name: t.name, rule: t.about, kind: "who", match: (p) => p.tags.includes(t.name), ...(s.connected.has(t.sourceId) ? {} : { needs: { sourceId: t.sourceId, source: t.source } }) })),
    b("top-risk", "Top 10% by risk", `Score ${cut} or above, the top 10% of scored people`, (p) => p.score !== null && p.score >= cut),
    b("new-high", "New this month", `Entered High or Critical since ${PREV_MONTH}`, (p) => isHigh(p.band) && p.prev !== null && p.prev <= 60),
    b("privileged-high", "Privileged and High risk", "Tagged Privileged and in High or Critical", (p) => p.tags.includes("Privileged") && isHigh(p.band)),
    b("repeat-clickers", "Repeat clickers", "2 or more failed simulations in 180 days", (p) => p.fails180 >= 2),
    b("credential-submitters", "Credential submitters", "Entered data in a simulation in 120 days", (p) => p.sims.some((x) => x.outcome === "Data entered" && x.ageDays <= 120)),
    b("impulsive", "Impulsive clickers", `Clicked within ${s.config.impulsiveSeconds} seconds in 180 days`, (p) => p.impulsive),
    b("overdue-training", "Overdue training", "Overdue training signal above 60", (p) => (p.now["lrn-overdue"]?.value ?? 0) > 60),
    b("never-reports", "Never reports", "Reported no simulation in the last 12 months", (p) => p.sims.length > 0 && !p.sims.some((x) => x.reported)),
    ...(s.active.has("inc-genai") ? [b("shadow-ai", "Unsanctioned GenAI use", "Unsanctioned GenAI signal at 75 or above", (p) => (p.now["inc-genai"]?.value ?? 0) >= 75)] : []),
    ...(s.active.has("inc-signin") ? [b("risky-signin", "Risky sign-ins", "Risky sign-in signal at 75 or above", (p) => (p.now["inc-signin"]?.value ?? 0) >= 75)] : []),
  ];
}
export function watchlistSummary(s: SignalState, saved: SavedWatchlist[], pinned: string[], tags: CustomTag[]) {
  const people = getPeople(s);
  const pin = new Set(pinned);
  const custom = customTagsByPerson(tags, s);
  const defs: WatchlistDef[] = [
    ...builtIn(s),
    ...(pinned.length ? [{ id: "pinned", name: "Pinned by you", rule: "People you added by hand", kind: "own" as const, custom: true, match: (p: ScoredPerson) => pin.has(p.id) }] : []),
    ...tags.map((t) => ({ id: t.id, name: t.name, rule: t.about || (t.groups?.length ? `Your tag. Filled from ${t.groups.join(", ")}.` : "Your tag. Members are added by hand."), kind: "own" as const, custom: true, match: (p: ScoredPerson) => !!custom.get(p.id)?.includes(t.name) })),
    ...saved.map((w) => ({ id: w.id, name: w.name, rule: describeRule(w.rule), kind: "own" as const, custom: true, match: ruleMatch(w.rule, custom) })),
  ];
  return defs.map((w) => {
    const members = people.filter(w.match);
    const sc = members.filter((m) => m.score !== null);
    const prevSc = members.filter((m) => m.prev !== null);
    const avg = sc.length ? Math.round(mean(sc.map((m) => m.score!))) : null;
    const prev = prevSc.length ? Math.round(mean(prevSc.map((m) => m.prev!))) : null;
    return { ...w, members, avg, high: sc.filter((m) => isHigh(m.band)).length, change: avg !== null && prev !== null ? avg - prev : null, band: bandFor(avg) };
  });
}

// ---------- Risk spreading ----------
/** High or Critical people ranked by how many teammates (same manager, or their direct reports) they work with. */
export function riskSpreaders(s: SignalState) {
  return memo(s, "spread", () => {
    const people = getPeople(s);
    const byMgr = new Map<string, ScoredPerson[]>();
    for (const p of people) if (p.managerId) { const l = byMgr.get(p.managerId); l ? l.push(p) : byMgr.set(p.managerId, [p]); }
    return people.filter((p) => isHigh(p.band)).map((p) => {
      const peers = [...(p.managerId ? byMgr.get(p.managerId) ?? [] : []).filter((x) => x.id !== p.id), ...(byMgr.get(p.id) ?? [])];
      return { id: p.id, name: p.name, role: p.role, department: p.department, score: p.score ?? 0, band: p.band, peers: peers.length, peersAtRisk: peers.filter((x) => (x.score ?? 0) > 40).length };
    }).sort((a, b) => b.peersAtRisk - a.peersAtRisk || b.score - a.score).slice(0, 6);
  });
}
/** Per department: how involved managers are (low Learning and Culture risk among managers) against average real-world incident risk. */
export function managerInvolvement(s: SignalState) {
  return memo(s, "mgr", () => {
    const people = getPeople(s);
    const mgrIds = new Set(people.map((p) => p.managerId).filter(Boolean) as string[]);
    return DEPARTMENTS.map((d) => {
      const dp = people.filter((p) => p.department === d);
      const mgrs = dp.filter((p) => mgrIds.has(p.id));
      const inv = mgrs.map((m) => 100 - mean([m.categories["Learning"] ?? 50, m.categories["Culture"] ?? 50]));
      const inc = dp.map((p) => p.categories["Real-world incidents"]).filter((v): v is number => v != null);
      return { department: d, involvement: Math.round(mean(inv)), incidents: inc.length ? Math.round(mean(inc)) : null, managers: mgrs.length };
    }).filter((x) => x.managers > 0).sort((a, b) => a.involvement - b.involvement);
  });
}

// ---------- Formatting ----------
export const fmt = (n: number) => n.toLocaleString("en-US");
export const pct = (share: number) => (share > 0 && share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`);
export function formatAge(ageDays: number | null) {
  if (ageDays === null) return "None";
  return new Date(TODAY.getTime() - ageDays * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
export const formatStamp = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const pseudonym = (id: string) => `Employee ${id.slice(1)}`;
export const initials = (name: string) => name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export const PREV_MONTH = MONTHS[10]!;
/** Name of each department's head, from the directory. */
export const PEOPLE_HEADS = Object.fromEntries(PEOPLE.filter((p) => p.level === "Head").map((p) => [p.department, p.name])) as Record<Department, string>;
export { SIGNAL_HOW } from "@/data/catalogue";
export { ELEMENTS, SOURCES, MONTHS, DEPARTMENTS, LOCATIONS, CHANNELS, LURES, TEMPLATES, WORKFLOWS };
export { DIRECTORY_GROUPS, TAGS, groupMembers };
export type { Tag, Department, Band, Channel, Lure };
