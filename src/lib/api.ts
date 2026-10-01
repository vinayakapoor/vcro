// The only data layer the vCRO pages use. Every function takes the current store state and returns
// plain data, shaped the way a server would return it, so a real API can replace the bodies later.
import { useSyncExternalStore } from "react";
import {
  DEPARTMENTS, ELEMENTS, HEADCOUNT, INTERVENTIONS, LOCATIONS, MONTHS, SIM_ELEMENT_CHANNEL, SOURCES, TEMPLATES,
  TODAY, WORKFLOWS, type Department,
} from "@/data/catalogue";
import { PEOPLE, PERSON_BY_ID, TAGS, type Person, type Tag } from "@/data/people";
import {
  bandFor, CHANNELS, computeScore, confidenceFor, DEFAULT_CONFIG, elementWeights, failed, isImpulsive, LURES, rates, scoreOnly,
  simulationRisk, skillScore, type Band, type Channel, type Lure, type Readings, type ScoreResult, type ScoringConfig, type SimEvent,
} from "./scoring";

// ---------- Store ----------
export type SignalState = { connected: Set<string>; disabled: Set<string>; active: Set<string>; weights: Record<string, number>; config: ScoringConfig };
export type Currency = "USD" | "INR" | "AED";
export type Settings = {
  alerts: { enterHigh: boolean; orgRise: number; weekly: boolean; recipients: string };
  automation: { autoRun: boolean; approvalAbove: number };
  /** In the tenant's chosen currency. Null until the tenant sets it. */
  costPerIncident: number | null;
  /** Goal line on trend charts. Null until the tenant sets it. */
  targetScore: number | null;
  currency: Currency;
  privacy: boolean;
  /** Teams smaller than this show no score, so no one can be singled out through a small group. */
  minGroupSize: number;
};
export type WatchlistRule = { department?: string; location?: string; tag?: string; tags?: string[]; minBand?: "Guarded" | "Elevated" | "High" | "Critical"; rising?: boolean; repeatClicker?: boolean };
export type SavedWatchlist = { id: string; name: string; rule: WatchlistRule };
export type Run = { id: string; key: string; workflow: string; target: string; people: number; status: "Queued" | "Dismissed"; at: string };
export type ReportRun = { id: string; template: string; name: string; at: string; score: number; filename: string; mime: string; content: string };

/** A tag an admin created. Members are added by hand, one at a time or in bulk. */
export type CustomTag = { id: string; name: string; about: string; members: string[] };
export type ConnectorConfig = { connectedAt: string; account: string; frequency: string; scope: string; lastSync: string; controls: Record<string, boolean> };
type Store = {
  signals: SignalState; settings: Settings; watchlists: SavedWatchlist[]; pinned: string[]; runs: Run[]; reports: ReportRun[]; visited: string[];
  tags: CustomTag[]; connectors: Record<string, ConnectorConfig>;
};

function activeFor(connected: Set<string>, disabled: Set<string>) {
  return new Set(ELEMENTS.filter((e) => connected.has(e.sourceId) && !disabled.has(e.id)).map((e) => e.id));
}
function makeSignals(connected: Set<string>, disabled: Set<string>, weights: Record<string, number>, config: ScoringConfig): SignalState {
  return { connected, disabled, active: activeFor(connected, disabled), weights, config };
}
export const DEFAULT_SETTINGS: Settings = {
  alerts: { enterHigh: true, orgRise: 5, weekly: true, recipients: "" },
  automation: { autoRun: true, approvalAbove: 250 },
  costPerIncident: null, targetScore: null, currency: "USD", privacy: false, minGroupSize: 5,
};
const DEFAULT_STORE: Store = {
  signals: makeSignals(new Set(SOURCES.filter((s) => s.defaultConnected).map((s) => s.id)), new Set(), {}, DEFAULT_CONFIG),
  settings: DEFAULT_SETTINGS, watchlists: [], pinned: [], runs: [], reports: [], visited: [], tags: [], connectors: {},
};

let store: Store = DEFAULT_STORE;
const listeners = new Set<() => void>();
// Bump the version when the source catalogue changes, so old saved connections do not hide new defaults.
const KEY = "hf.vcro.v2";

function persist() {
  if (typeof localStorage === "undefined") return;
  const { signals, ...rest } = store;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      ...rest, signals: { connected: [...signals.connected], disabled: [...signals.disabled], weights: signals.weights, config: signals.config },
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
        new Set(sg.disabled ?? []), sg.weights ?? {}, { ...DEFAULT_CONFIG, ...sg.config },
      ),
      settings: { ...DEFAULT_SETTINGS, ...d.settings, alerts: { ...DEFAULT_SETTINGS.alerts, ...d.settings?.alerts }, automation: { ...DEFAULT_SETTINGS.automation, ...d.settings?.automation } },
      watchlists: d.watchlists ?? [], pinned: d.pinned ?? [], runs: d.runs ?? [], reports: d.reports ?? [], visited: d.visited ?? [], tags: d.tags ?? [], connectors: d.connectors ?? {},
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
  prev: number | null;
  change: number | null;
  /** Readings used for today's score, simulations included. */
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
    const people = PEOPLE.map((p): ScoredPerson => {
      const now = readingsAt(p, 0, s.config);
      const cur = computeScore(ELEMENTS, now, s.active, s.weights, s.config);
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
        ...p, ...cur, now, prev: before.score,
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
    const topN = Math.max(1, Math.round(sorted.length * 0.1));
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
      /** Sum of score / 100 over High and Critical people: the incident count used by the exposure estimate. */
      expectedIncidents: high.reduce((a, p) => a + p.score! / 100, 0),
      departments: deptStats(s), pareto, drivers,
      concentration: { people: 10, risk: Math.round((sorted.slice(0, topN).reduce((a, b) => a + b, 0) / totalRisk) * 100), count: topN },
      channels: channelStats(allSims), lures: lureStats(allSims), simsLive: allSims.length > 0,
    };
  });
}

export type TrendPoint = { month: string; score: number; band: Band; delta: number; intervention: string | null };
/** Monthly averages for the organisation, each department and each band count. */
export function trends(s: SignalState) {
  return memo(s, "trends", () => {
    const m = monthly(s, true);
    const people = getPeople(s);
    const avg = (idx: number[], k: number) => {
      let sum = 0, n = 0;
      for (const i of idx) { const v = m[i * 12 + k]!; if (v >= 0) { sum += v; n++; } }
      return n ? Math.round(sum / n) : null;
    };
    const all = people.map((_, i) => i);
    const org: TrendPoint[] = MONTHS.map((month, k) => {
      const score = avg(all, k) ?? 0;
      return { month, score, band: bandFor(score), delta: 0, intervention: INTERVENTIONS.find((x) => x.month === month)?.label ?? null };
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
      { id: "a3", action: "Brief targeted VIPs", target: "Very attacked VIPs", workflow: "VIP protection briefing", lowEffort: false, fix: ["sim-deepfake", "sim-vish", "sim-callback", "att-confidence"], members: (p) => p.tags.includes("VIP") && p.tags.includes("Very attacked"), watchlist: "very-attacked-vips" },
      { id: "a4", action: "Run vishing drill", target: voice.d, workflow: "Vishing awareness drill", lowEffort: false, fix: ["sim-vish", "sim-callback"], members: (p) => p.department === voice.d, dept: voice.d },
      { id: "a5", action: "Assign QR module", target: "Weakest on QR", workflow: "QR safety micro-module", lowEffort: true, fix: ["sim-qr"], members: (p) => p.weakestChannel === "QR" },
      { id: "a6", action: "Chase overdue training", target: "Overdue training", workflow: "Overdue training reminder", lowEffort: true, fix: ["lrn-overdue", "lrn-complete"], members: (p) => (p.readings["lrn-overdue"]?.value ?? 0) > 60, watchlist: "overdue-training" },
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
  channel: SIM_IDS, cred: ["sim-email", "sim-vish", "sim-smish", "sim-deepfake"], overdue: ["lrn-overdue", "lrn-complete"], vip: ["sim-deepfake", "sim-vish", "sim-callback", "att-confidence"],
};
export function nextSteps(s: SignalState, p: ScoredPerson) {
  const steps: { id: string; action: string; workflow: (typeof WORKFLOWS)[number]; fix: string[] }[] = [];
  if (p.weakestChannel) steps.push({ id: "channel", action: `Assign ${p.weakestChannel.toLowerCase()} lure coaching`, workflow: "Repeat clicker remediation", fix: [SIM_CHANNEL_ELEMENT[p.weakestChannel]] });
  if (p.sims.some((x) => x.outcome === "Data entered" && x.ageDays <= 120)) steps.push({ id: "cred", action: "Reset credentials and coach", workflow: "Credential submitter reset", fix: STEP_FIX["cred"]! });
  if ((p.readings["lrn-overdue"]?.value ?? 0) > 50) steps.push({ id: "overdue", action: "Complete overdue training", workflow: "Overdue training reminder", fix: STEP_FIX["overdue"]! });
  if (p.tags.includes("VIP")) steps.push({ id: "vip", action: "Schedule VIP briefing", workflow: "VIP protection briefing", fix: STEP_FIX["vip"]! });
  return steps.map((st) => { const w = whatIf(s, p, st.fix); return { ...st, impact: w === null ? 0 : Math.max(0, p.score! - w) }; })
    .sort((a, b) => b.impact - a.impact).slice(0, 3);
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
export function signalStats(s: SignalState) {
  const feeding = SOURCES.filter((x) => x.direction !== "Action out");
  return { connectedSources: feeding.filter((x) => s.connected.has(x.id)).length, totalSources: feeding.length, outbound: SOURCES.filter((x) => x.direction === "Action out" && s.connected.has(x.id)).length, active: s.active.size, total: ELEMENTS.length, confidence: confidenceFor(ELEMENTS, (e) => s.active.has(e.id)), lastSync: "1 Oct, 10:44" };
}
export function signalCoverage(s: SignalState) {
  const pillars = (["Behaviour", "Exposure", "Privilege", "Reporting"] as const).map((pillar) => {
    const els = ELEMENTS.filter((e) => e.pillar === pillar);
    const w = els.reduce((a, e) => a + ELEMENT_WEIGHTS[e.id]!, 0) || 1;
    const live = els.filter((e) => s.active.has(e.id));
    return { pillar: pillar as string, active: live.length, total: els.length, coverage: Math.round((live.reduce((a, e) => a + ELEMENT_WEIGHTS[e.id]!, 0) / w) * 100) };
  });
  const att = ELEMENTS.filter((e) => e.category === "Attitude");
  const attLive = att.filter((e) => s.active.has(e.id));
  pillars.splice(1, 0, { pillar: "Attitude", active: attLive.length, total: att.length, coverage: att.length ? Math.round((attLive.length / att.length) * 100) : 0 });
  const ai = ELEMENTS.filter((e) => e.category === "AI agents");
  const aiLive = ai.filter((e) => s.active.has(e.id));
  pillars.push({ pillar: "AI identities", active: aiLive.length, total: ai.length, coverage: Math.round((aiLive.length / ai.length) * 100) });
  const sources = SOURCES.filter((x) => x.direction !== "Action out").map((x) => ({ ...x, on: s.connected.has(x.id) }));
  return { pillars, sources, events30d: sources.filter((x) => x.on).reduce((a, x) => a + x.events30d, 0), missing: sources.filter((x) => !x.on && x.kind === "Integration") };
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

export const HEAT_CATEGORIES = ["Simulations", "Real-world incidents", "Learning", "Security hygiene", "Culture", "Attitude", "Targeting", "Human OSINT", "Role visibility", "Access and admin", "Financial authority", "Data access", "AI agents"] as const;
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
    const pct = (xs: boolean[]) => (xs.length ? Math.round((xs.filter(Boolean).length / xs.length) * 100) : 0);
    return DEPARTMENTS.map((d) => {
      const ps = people.filter((p) => p.department === d);
      const sim = rates(ps.flatMap((p) => p.sims));
      return {
        department: d,
        completion: pct(ps.map((p) => (p.readings["lrn-complete"]?.value ?? 100) < 50)),
        overdue: ps.filter((p) => (p.readings["lrn-overdue"]?.value ?? 0) > 60).length,
        jit: pct(ps.map((p) => (p.readings["lrn-jit"]?.value ?? 100) < 50)),
        policy: pct(ps.map((p) => (p.readings["cul-policy"]?.value ?? 100) < 50)),
        reportRate: Math.round(sim.reportRate * 100), people: ps.length,
      };
    });
  });
}

// ---------- Tags, groups and watchlists ----------
export type GroupKind = "who" | "behaviour" | "own";
export type WatchlistDef = { id: string; name: string; rule: string; kind: GroupKind; custom?: boolean; match: (p: ScoredPerson) => boolean };
const BAND_MIN: Record<string, number> = { Guarded: 21, Elevated: 41, High: 61, Critical: 81 };
const ruleTags = (r: WatchlistRule) => [...(r.tags ?? []), ...(r.tag ? [r.tag] : [])];
export function describeRule(r: WatchlistRule) {
  const t = ruleTags(r);
  const parts = [r.department && `Department ${r.department}`, r.location && `Location ${r.location}`, t.length && `Tagged ${t.join(" and ")}`, r.minBand && `${r.minBand} or above`, r.rising && "Score rising", r.repeatClicker && "2 or more fails in 180 days"].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Everyone scored";
}
/** Names of the admin-made tags each person carries. */
export function customTagsByPerson(tags: CustomTag[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of tags) for (const m of t.members) { const l = out.get(m); l ? l.push(t.name) : out.set(m, [t.name]); }
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
export const countRule = (s: SignalState, r: WatchlistRule, tags: CustomTag[]) => getPeople(s).filter(ruleMatch(r, customTagsByPerson(tags))).length;

function builtIn(s: SignalState): WatchlistDef[] {
  const sc = getPeople(s).filter((x) => x.score !== null).map((x) => x.score!).sort((a, b) => b - a);
  const cut = sc[Math.max(0, Math.round(sc.length * 0.1) - 1)] ?? 101;
  const b = (id: string, name: string, rule: string, match: WatchlistDef["match"]): WatchlistDef => ({ id, name, rule, kind: "behaviour", match });
  return [
    { id: "very-attacked-vips", name: "Very attacked VIPs", rule: "Tagged VIP and Very attacked", kind: "who", match: (p) => p.tags.includes("VIP") && p.tags.includes("Very attacked") },
    ...TAGS.map((t): WatchlistDef => ({ id: `tag:${t.name}`, name: t.name, rule: t.about, kind: "who", match: (p) => p.tags.includes(t.name) })),
    b("top-risk", "Top 10% by risk", `Score ${cut} or above, the top 10% of scored people`, (p) => p.score !== null && p.score >= cut),
    b("new-high", "New this month", `Entered High or Critical since ${PREV_MONTH}`, (p) => isHigh(p.band) && p.prev !== null && p.prev <= 60),
    b("privileged-high", "Privileged and High risk", "Tagged Privileged and in High or Critical", (p) => p.tags.includes("Privileged") && isHigh(p.band)),
    b("repeat-clickers", "Repeat clickers", "2 or more failed simulations in 180 days", (p) => p.fails180 >= 2),
    b("credential-submitters", "Credential submitters", "Entered data in a simulation in 120 days", (p) => p.sims.some((x) => x.outcome === "Data entered" && x.ageDays <= 120)),
    b("impulsive", "Impulsive clickers", `Clicked within ${s.config.impulsiveSeconds} seconds in 180 days`, (p) => p.impulsive),
    b("overdue-training", "Overdue training", "Overdue training signal above 60", (p) => (p.readings["lrn-overdue"]?.value ?? 0) > 60),
    b("never-reports", "Never reports", "Reported no simulation in the last 12 months", (p) => p.sims.length > 0 && !p.sims.some((x) => x.reported)),
    ...(s.active.has("inc-genai") ? [b("shadow-ai", "Unsanctioned GenAI use", "Unsanctioned GenAI signal at 75 or above", (p) => (p.readings["inc-genai"]?.value ?? 0) >= 75)] : []),
    ...(s.active.has("inc-signin") ? [b("risky-signin", "Risky sign-ins", "Risky sign-in signal at 75 or above", (p) => (p.readings["inc-signin"]?.value ?? 0) >= 75)] : []),
  ];
}
export function watchlistSummary(s: SignalState, saved: SavedWatchlist[], pinned: string[], tags: CustomTag[]) {
  const people = getPeople(s);
  const pin = new Set(pinned);
  const custom = customTagsByPerson(tags);
  const defs: WatchlistDef[] = [
    ...builtIn(s),
    ...(pinned.length ? [{ id: "pinned", name: "Pinned by you", rule: "People you added by hand", kind: "own" as const, custom: true, match: (p: ScoredPerson) => pin.has(p.id) }] : []),
    ...tags.map((t) => { const m = new Set(t.members); return { id: t.id, name: t.name, rule: t.about || "Your tag. Members are added by hand.", kind: "own" as const, custom: true, match: (p: ScoredPerson) => m.has(p.id) }; }),
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
export function formatMoney(v: number, currency: Currency) {
  if (currency === "INR") return v >= 1e7 ? `₹ ${(v / 1e7).toFixed(1)} Cr` : v >= 1e5 ? `₹ ${(v / 1e5).toFixed(1)} L` : `₹ ${fmt(Math.round(v))}`;
  const sym = currency === "USD" ? "$" : "AED ";
  return v >= 1e6 ? `${sym}${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${sym}${Math.round(v / 1e3)}K` : `${sym}${Math.round(v)}`;
}
export function formatAge(ageDays: number | null) {
  if (ageDays === null) return "None";
  return new Date(TODAY.getTime() - ageDays * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
export const formatStamp = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const pseudonym = (id: string) => `Employee ${id.slice(1)}`;
export const initials = (name: string) => name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export const PREV_MONTH = MONTHS[10]!;
export { ELEMENTS, SOURCES, MONTHS, DEPARTMENTS, LOCATIONS, CHANNELS, LURES, TEMPLATES, WORKFLOWS };
export { TAGS };
export type { Tag, Department, Band, Channel, Lure };
