import { useSyncExternalStore } from "react";
import {
  BENCHMARK, DEPARTMENTS, ELEMENTS, HEADCOUNT, INTERVENTIONS, LOCATIONS, MONTHS, SIM_ELEMENT_CHANNEL, SOURCES, TEMPLATES,
  TODAY, TOTAL_EMPLOYEES, WORKFLOWS, type Department,
} from "@/data/catalogue";
import { PEOPLE, type Person, type Tag } from "@/data/people";
import {
  bandFor, CHANNELS, computeScore, skillScore, confidenceFor, elementWeights, failed, isImpulsive, LURES, rates, reportToFail,
  simulationRisk, type Band, type Channel, type Lure, type Readings, type ScoreResult, type SimEvent,
} from "./scoring";

// ---------- Signal state store ----------
export type SignalState = { connected: Set<string>; disabled: Set<string>; active: Set<string>; weights: Record<string, number> };

function activeFor(connected: Set<string>, disabled: Set<string>) {
  return new Set(ELEMENTS.filter((e) => connected.has(e.sourceId) && !disabled.has(e.id)).map((e) => e.id));
}
function makeState(connected: Set<string>, disabled: Set<string>, weights: Record<string, number> = state.weights): SignalState {
  return { connected, disabled, active: activeFor(connected, disabled), weights };
}
let state: SignalState = makeState(new Set(SOURCES.filter((s) => s.defaultConnected).map((s) => s.id)), new Set(), {});
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useSignals() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state, () => state);
}
export function previewElement(id: string, on: boolean): SignalState {
  const d = new Set(state.disabled);
  on ? d.delete(id) : d.add(id);
  return makeState(state.connected, d);
}
export function previewSource(id: string, on: boolean): SignalState {
  const c = new Set(state.connected);
  on ? c.add(id) : c.delete(id);
  return makeState(c, state.disabled);
}
/** Custom category weights (0 to 50 each). Empty object means the default model. */
export function previewWeights(weights: Record<string, number>): SignalState {
  return makeState(state.connected, state.disabled, weights);
}
export function applyState(next: SignalState) {
  state = next;
  emit();
}

// ---------- People ----------
export type ChannelStat = { channel: Channel; attempts: number; failures: number; reports: number; failRate: number; reportRate: number; avgTtc: number | null };
export type ScoredPerson = Person & ScoreResult & {
  history: (number | null)[];
  prev: number | null;
  change: number | null;
  channels: ChannelStat[];
  lures: Record<Lure, number>;
  weakestChannel: Channel | null;
  weakestSignal: { id: string; name: string; category: string; value: number } | null;
  signalValues: Record<string, number>;
  topLure: Lure | null;
  topDriver: string | null;
  lastEventDays: number | null;
  impulsive: boolean;
  skill: number | null;
  skillPrev: number | null;
};

function readingsAt(p: Person, monthsAgo: number): Readings {
  const cutoff = monthsAgo * 30;
  const out: Readings = {};
  for (const [k, v] of Object.entries(p.readings)) {
    if (!v) continue;
    out[k] = { value: Math.max(0, Math.min(100, v.value * (1 + p.drift * monthsAgo))), ageDays: v.ageDays };
  }
  const sims = p.sims.filter((s) => s.ageDays >= cutoff).map((s) => ({ ...s, ageDays: s.ageDays - cutoff }));
  for (const [el, ch] of Object.entries(SIM_ELEMENT_CHANNEL)) {
    const v = simulationRisk(sims.filter((s) => s.channel === ch));
    if (v !== null) out[el] = { value: v };
  }
  if (sims.length) {
    const recentFails = sims.filter((s) => failed(s) && s.ageDays <= 180).length;
    out["sim-repeat"] = { value: Math.min(100, Math.max(0, recentFails - 1) * 25) };
  } else {
    delete out["sim-mfa"];
    delete out["sim-callback"];
  }
  return out;
}

export function channelStats(sims: SimEvent[]): ChannelStat[] {
  return CHANNELS.map((channel) => {
    const ev = sims.filter((s) => s.channel === channel);
    const r = rates(ev);
    const ttc = ev.filter((s) => s.ttcSec != null).map((s) => s.ttcSec!);
    return { channel, ...r, avgTtc: ttc.length ? Math.round(ttc.reduce((a, b) => a + b, 0) / ttc.length) : null };
  });
}
export function lureStats(sims: SimEvent[]): Record<Lure, number> {
  return Object.fromEntries(LURES.map((l) => [l, Math.round(rates(sims.filter((s) => s.lure === l)).failRate * 100)])) as Record<Lure, number>;
}

let cache: { key: SignalState; people: ScoredPerson[] } | null = null;

function simsFor(p: Person, active: Set<string>) {
  const live = new Set(Object.entries(SIM_ELEMENT_CHANNEL).filter(([el]) => active.has(el)).map(([, ch]) => ch));
  return p.sims.filter((s) => live.has(s.channel));
}

export function getPeople(s: SignalState): ScoredPerson[] {
  if (cache && cache.key === s) return cache.people;
  const people = PEOPLE.map((p): ScoredPerson => {
    const now = readingsAt(p, 0);
    const cur = computeScore(ELEMENTS, now, s.active, s.weights);
    const signalValues: Record<string, number> = {};
    for (const el of ELEMENTS) { const r = now[el.id]; if (r && s.active.has(el.id) && el.pillar !== "Reporting") signalValues[el.id] = Math.round(r.value); }
    const ws = ELEMENTS.filter((el) => signalValues[el.id] != null).sort((a, b) => signalValues[b.id]! * (ELEMENT_WEIGHTS[b.id] ?? 0) - signalValues[a.id]! * (ELEMENT_WEIGHTS[a.id] ?? 0))[0];
    const weakestSignal = ws && signalValues[ws.id]! > 0 ? { id: ws.id, name: ws.name, category: ws.category, value: signalValues[ws.id]! } : null;
    const history = MONTHS.map((_, i) => (i === 11 ? cur.score : computeScore(ELEMENTS, readingsAt(p, 11 - i), s.active, s.weights).score));
    const prev = history[10] ?? null;
    const sims = simsFor(p, s.active);
    const channels = channelStats(sims);
    const withAttempts = channels.filter((c) => c.attempts > 0 && c.failures > 0);
    const weakest = withAttempts.sort((a, b) => b.failRate - a.failRate)[0]?.channel ?? null;
    const lures = lureStats(sims);
    const topLureEntry = Object.entries(lures).sort((a, b) => b[1] - a[1])[0];
    const topDriver = [...cur.contributions].filter((c) => c.points > 0).sort((a, b) => b.points - a.points)[0]?.category ?? null;
    return {
      ...p, ...cur, history, prev,
      change: cur.score !== null && prev !== null ? cur.score - prev : null,
      channels, lures, weakestChannel: weakest, weakestSignal, signalValues,
      topLure: topLureEntry && topLureEntry[1] > 0 ? (topLureEntry[0] as Lure) : null,
      topDriver, lastEventDays: p.activity[0]?.ageDays ?? null,
      impulsive: sims.some((x) => isImpulsive(x) && x.ageDays <= 180),
      skill: skillScore(cur, p.knowledge), skillPrev: prev === null ? null : skillScore(computeScore(ELEMENTS, readingsAt(p, 1), s.active, s.weights), p.knowledge),
    };
  });
  cache = { key: s, people };
  return people;
}

export function getPerson(s: SignalState, id: string) {
  return getPeople(s).find((p) => p.id === id) ?? null;
}
export function managerName(s: SignalState, id: string | null) {
  if (!id) return "None";
  return PEOPLE.find((p) => p.id === id)?.name ?? "None";
}

// ---------- Aggregates ----------
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const isHigh = (b: Band) => b === "High" || b === "Critical";

export function orgScoreFor(s: SignalState) {
  const scores = PEOPLE.map((p) => computeScore(ELEMENTS, readingsAt(p, 0), s.active, s.weights).score).filter((x): x is number => x !== null);
  return { score: Math.round(mean(scores)), confidence: confidenceFor(ELEMENTS, (e) => s.active.has(e.id)) };
}

export type DeptStat = {
  department: Department; headcount: number; sample: number; score: number; prev: number; change: number; band: Band;
  likelihood: number; impact: number; topDriver: string;
};

function deptStats(people: ScoredPerson[]): DeptStat[] {
  return DEPARTMENTS.map((d) => {
    const ps = people.filter((p) => p.department === d && p.score !== null);
    const score = Math.round(mean(ps.map((p) => p.score!)));
    const prev = Math.round(mean(ps.filter((p) => p.prev !== null).map((p) => p.prev!)));
    const drivers: Record<string, number> = {};
    for (const p of ps) for (const c of p.contributions) if (c.points > 0) drivers[c.category] = (drivers[c.category] ?? 0) + c.points;
    return {
      department: d, headcount: HEADCOUNT[d], sample: ps.length, score, prev, change: score - prev, band: bandFor(score),
      likelihood: Math.round(mean(ps.map((p) => p.likelihood))), impact: Math.round(mean(ps.map((p) => p.impact)) * 100) / 100,
      topDriver: Object.entries(drivers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None",
    };
  });
}

export function orgSummary(s: SignalState) {
  const people = getPeople(s);
  const scored = people.filter((p) => p.score !== null);
  const trend = MONTHS.map((month, i) => {
    const vals = people.map((p) => p.history[i]).filter((x): x is number => x != null);
    const score = Math.round(mean(vals));
    return { month, score, band: bandFor(score), benchmark: BENCHMARK[i]!, intervention: INTERVENTIONS.find((x) => x.month === month)?.label ?? null };
  });
  for (let i = 0; i < trend.length; i++) (trend[i] as typeof trend[number] & { delta: number }).delta = i ? trend[i]!.score - trend[i - 1]!.score : 0;
  const score = trend[11]!.score;
  const prev = trend[10]!.score;
  const activeCount = s.active.size;
  const confidence = confidenceFor(ELEMENTS, (e) => s.active.has(e.id));
  const pillars = {
    Behaviour: Math.round(mean(scored.map((p) => p.behaviour))),
    Exposure: Math.round(mean(scored.map((p) => p.exposure))),
    Privilege: Math.round(mean(scored.map((p) => p.privilege))),
  };
  const highCount = scored.filter((p) => isHigh(p.band)).length;
  const highShare = scored.length ? highCount / people.length : 0;
  const allSims = people.flatMap((p) => simsFor(p, s.active));
  const rtf = reportToFail(allSims);
  const highRisk = scored.filter((p) => p.score! > 60);
  const lossInr = highRisk.reduce((a, p) => a + (p.score! / 100) * p.impact * 120000, 0) * (TOTAL_EMPLOYEES / people.length);
  const vipAttacked = people.filter((p) => p.tags.includes("VIP") && p.tags.includes("Very attacked")).length;
  const departments = deptStats(people);

  // Pareto
  // Risk above the Low band, per person
  const sorted = scored.map((p) => Math.max(0, p.score! - 20)).sort((a, b) => b - a);
  const totalRisk = sorted.reduce((a, b) => a + b, 0) || 1;
  const pareto: { people: number; risk: number }[] = [{ people: 0, risk: 0 }];
  let acc = 0;
  sorted.forEach((v, i) => {
    acc += v;
    const pct = ((i + 1) / sorted.length) * 100;
    if ((i + 1) % Math.max(1, Math.round(sorted.length / 20)) === 0 || i === sorted.length - 1) pareto.push({ people: Math.round(pct), risk: Math.round((acc / totalRisk) * 100) });
  });
  // Concentration: share of people above High threshold and their share of excess risk
  const topN = Math.max(1, Math.round(sorted.length * 0.12));
  const concentration = { people: 12, risk: Math.round((sorted.slice(0, topN).reduce((a, b) => a + b, 0) / totalRisk) * 100), count: topN };

  return {
    people, score, prev, change: score - prev, band: bandFor(score), confidence, activeCount, totalElements: ELEMENTS.length,
    trend: trend as (typeof trend[number] & { delta: number })[], pillars, highCount, highShare, rtf, lossInr, vipAttacked,
    departments, pareto, concentration, channels: channelStats(allSims), lures: lureStats(allSims),
    simsLive: allSims.length > 0,
  };
}

export function deptLures(s: SignalState, d: Department) {
  return lureStats(getPeople(s).filter((p) => p.department === d).flatMap((p) => simsFor(p, s.active)));
}

export type Action = { id: string; action: string; target: string; people: number; impact: number; workflow: (typeof WORKFLOWS)[number]; mode: "Automatic" | "Needs approval"; rank?: number };

export function recommendedActions(s: SignalState): Action[] {
  const people = getPeople(s);
  const scored = people.filter((p) => p.score !== null).length || 1;
  const est = (n: number, k: number) => Math.max(1, Math.round((n / scored) * k));
  const repeat = people.filter((p) => (p.categories["Simulations"] ?? 0) > 0 && p.sims.filter((x) => failed(x) && x.ageDays <= 180).length >= 2).length;
  const cred = people.filter((p) => p.sims.some((x) => x.outcome === "Data entered" && x.ageDays <= 120)).length;
  const vip = people.filter((p) => p.tags.includes("VIP") && p.tags.includes("Very attacked")).length;
  const overdue = people.filter((p) => (p.readings["lrn-overdue"]?.value ?? 0) > 60).length;
  const voice = people.filter((p) => p.department === "Customer Support").length;
  const qr = people.filter((p) => p.weakestChannel === "QR").length;
  const list: Action[] = [
    { id: "a1", action: "Remediate repeat clickers", target: "Repeat clickers", people: repeat, impact: est(repeat, 9), workflow: "Repeat clicker remediation", mode: "Needs approval" as const },
    { id: "a2", action: "Reset credential submitters", target: "Credential submitters", people: cred, impact: est(cred, 7), workflow: "Credential submitter reset", mode: "Needs approval" as const },
    { id: "a3", action: "Brief targeted VIPs", target: "Very attacked VIPs", people: vip, impact: est(vip, 14), workflow: "VIP protection briefing", mode: "Needs approval" as const },
    { id: "a4", action: "Run vishing drill", target: "Customer Support", people: voice, impact: est(voice, 6), workflow: "Vishing awareness drill", mode: "Needs approval" as const },
    { id: "a5", action: "Assign QR module", target: "Weakest on QR", people: qr, impact: est(qr, 5), workflow: "QR safety micro-module", mode: "Automatic" as const },
    { id: "a6", action: "Chase overdue training", target: "Overdue training", people: overdue, impact: est(overdue, 4), workflow: "Overdue training reminder", mode: "Automatic" as const },
  ];
  return list.sort((a, b) => b.impact - a.impact).map((a, i) => ({ ...a, rank: i + 1 }));
}

export function watchlistMembers(s: SignalState, group: string) {
  const people = getPeople(s);
  const def = WATCHLISTS.find((w) => w.id === group);
  if (def) return people.filter((p) => def.match(p, people));
  if (group === "very-attacked-vips") return people.filter((p) => p.tags.includes("VIP") && p.tags.includes("Very attacked"));
  if (group === "top-risk") {
    const sorted = people.filter((p) => p.score !== null).sort((a, b) => b.score! - a.score!);
    return sorted.slice(0, Math.max(1, Math.round(sorted.length * 0.12)));
  }
  return [];
}

export function nextSteps(p: ScoredPerson) {
  const steps: { action: string; impact: number; workflow: string }[] = [];
  if (p.weakestChannel) steps.push({ action: `Assign ${p.weakestChannel.toLowerCase()} lure module`, impact: 3, workflow: "Repeat clicker remediation" });
  if (p.sims.some((x) => x.outcome === "Data entered")) steps.push({ action: "Reset credentials and coach", impact: 4, workflow: "Credential submitter reset" });
  if ((p.readings["lrn-overdue"]?.value ?? 0) > 50) steps.push({ action: "Complete overdue training", impact: 2, workflow: "Overdue training reminder" });
  if (p.tags.includes("VIP")) steps.push({ action: "Schedule VIP briefing", impact: 3, workflow: "VIP protection briefing" });
  steps.push({ action: `Coach on ${(p.topLure ?? "Urgency").toLowerCase()} lures`, impact: 2, workflow: "Repeat clicker remediation" });
  return steps.slice(0, 3);
}

export const ELEMENT_WEIGHTS = elementWeights(ELEMENTS);

export function signalStats(s: SignalState) {
  const sources = SOURCES.filter((x) => s.connected.has(x.id));
  return { connectedSources: sources.length, totalSources: SOURCES.length, active: s.active.size, total: ELEMENTS.length, confidence: confidenceFor(ELEMENTS, (e) => s.active.has(e.id)), lastSync: "1 Oct, 10:44" };
}

// ---------- Formatting ----------
export function formatMoney(inr: number, currency: "INR" | "AED") {
  if (currency === "AED") {
    const aed = inr / 22.7;
    return aed >= 1e6 ? `AED ${(aed / 1e6).toFixed(1)} M` : `AED ${Math.round(aed / 1000)} K`;
  }
  return inr >= 1e7 ? `₹ ${(inr / 1e7).toFixed(1)} Cr` : `₹ ${(inr / 1e5).toFixed(1)} L`;
}
export function formatAge(ageDays: number | null) {
  if (ageDays === null) return "None";
  const d = new Date(TODAY.getTime() - ageDays * 86400000);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
export const pseudonym = (id: string) => `Employee ${id.slice(1)}`;
export const initials = (name: string) => name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export const PREV_MONTH = MONTHS[10]!;
export { ELEMENTS, SOURCES, MONTHS, DEPARTMENTS, LOCATIONS, CHANNELS, LURES, TEMPLATES, WORKFLOWS };
export type { Tag, Department, Band, Channel, Lure };

// ---------- Signal coverage for the Riskometer ----------
export function signalCoverage(s: SignalState) {
  const pillars = (["Behaviour", "Exposure", "Privilege", "Reporting"] as const).map((pillar) => {
    const els = ELEMENTS.filter((e) => e.pillar === pillar);
    const w = els.reduce((a, e) => a + (ELEMENT_WEIGHTS[e.id] ?? 0), 0) || 1;
    const live = els.filter((e) => s.active.has(e.id));
    const lw = live.reduce((a, e) => a + (ELEMENT_WEIGHTS[e.id] ?? 0), 0);
    return { pillar: pillar as string, active: live.length, total: els.length, coverage: Math.round((lw / w) * 100) };
  });
  {
    const els = ELEMENTS.filter((e) => e.category === "Attitude");
    const live = els.filter((e) => s.active.has(e.id));
    pillars.splice(1, 0, { pillar: "Attitude", active: live.length, total: els.length, coverage: els.length ? Math.round((live.length / els.length) * 100) : 0 });
  }
  const sources = SOURCES.map((x) => ({ ...x, on: s.connected.has(x.id) }));
  const events30d = sources.filter((x) => x.on).reduce((a, x) => a + x.events30d, 0);
  const missing = sources.filter((x) => !x.on && x.kind === "Integration");
  return { pillars, sources, events30d, missing };
}

// ---------- Org-wide weakest signals ----------
export function weakestSignals(s: SignalState, people = getPeople(s)) {
  return ELEMENTS.filter((el) => s.active.has(el.id) && el.pillar !== "Reporting").map((el) => {
    const vals = people.map((p) => p.signalValues[el.id]).filter((v): v is number => v != null);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const atRisk = vals.filter((v) => v >= 60).length;
    return { id: el.id, name: el.name, category: el.category, pillar: el.pillar, avg, atRisk, impact: avg * (ELEMENT_WEIGHTS[el.id] ?? 0) };
  }).sort((a, b) => b.impact - a.impact);
}

// ---------- Heatmap: department x category ----------
export const HEAT_CATEGORIES = ["Simulations", "Real-world incidents", "Learning", "Culture", "Attitude", "Targeting", "Human OSINT", "Role visibility", "Access and admin", "Financial authority", "Data access"] as const;
export function deptHeatmap(s: SignalState) {
  const people = getPeople(s).filter((p) => p.score !== null);
  return DEPARTMENTS.map((d) => {
    const ps = people.filter((p) => p.department === d);
    const cells = HEAT_CATEGORIES.map((c) => {
      const vals = ps.map((p) => p.categories[c]).filter((v): v is number => v != null);
      return { category: c, value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
    });
    return { department: d, cells };
  });
}

// ---------- Awareness and training ----------
export function awarenessByDept(s: SignalState) {
  const people = getPeople(s);
  const pct = (xs: boolean[]) => (xs.length ? Math.round((xs.filter(Boolean).length / xs.length) * 100) : 0);
  return DEPARTMENTS.map((d) => {
    const ps = people.filter((p) => p.department === d);
    return {
      department: d,
      completion: pct(ps.map((p) => (p.readings["lrn-complete"]?.value ?? 100) < 50)),
      overdue: ps.filter((p) => (p.readings["lrn-overdue"]?.value ?? 0) > 60).length,
      jit: pct(ps.map((p) => (p.readings["lrn-jit"]?.value ?? 100) < 50)),
      policy: pct(ps.map((p) => (p.readings["cul-policy"]?.value ?? 100) < 50)),
      reportRate: Math.round((ps.reduce((a, p) => a + p.channels.reduce((x, c) => x + c.reports, 0), 0) / Math.max(1, ps.reduce((a, p) => a + p.channels.reduce((x, c) => x + c.attempts, 0), 0))) * 100),
      people: ps.length,
    };
  });
}

// ---------- Watchlists ----------
export type WatchlistDef = { id: string; name: string; rule: string; custom?: boolean; match: (p: ScoredPerson, all: ScoredPerson[]) => boolean };
export const WATCHLISTS: WatchlistDef[] = [
  { id: "very-attacked-vips", name: "Very attacked VIPs", rule: "Tag VIP and Very attacked", match: (p) => p.tags.includes("VIP") && p.tags.includes("Very attacked") },
  { id: "top-risk", name: "Top 12% by risk", rule: "Score in the top 12% of scored people", match: (p, all) => {
    const sorted = all.filter((x) => x.score !== null).map((x) => x.score!).sort((a, b) => b - a);
    const cut = sorted[Math.max(0, Math.round(sorted.length * 0.12) - 1)] ?? 101;
    return p.score !== null && p.score >= cut;
  } },
  { id: "repeat-clickers", name: "Repeat clickers", rule: "2 or more failed simulations in 180 days", match: (p) => p.sims.filter((x) => failed(x) && x.ageDays <= 180).length >= 2 },
  { id: "credential-submitters", name: "Credential submitters", rule: "Entered data in a simulation in 120 days", match: (p) => p.sims.some((x) => x.outcome === "Data entered" && x.ageDays <= 120) },
  { id: "privileged-high", name: "Privileged and High risk", rule: "Tag Privileged and band High or Critical", match: (p) => p.tags.includes("Privileged") && isHigh(p.band) },
  { id: "impulsive", name: "Impulsive clickers", rule: "Clicked within 30 seconds in 180 days", match: (p) => p.impulsive },
  { id: "overdue-training", name: "Overdue training", rule: "Overdue training signal above 60", match: (p) => (p.readings["lrn-overdue"]?.value ?? 0) > 60 },
];
export type WatchlistRule = { department?: string; location?: string; tag?: string; minBand?: "Guarded" | "Elevated" | "High" | "Critical"; rising?: boolean; repeatClicker?: boolean };
const BAND_MIN: Record<string, number> = { Guarded: 21, Elevated: 41, High: 61, Critical: 81 };
export function describeRule(r: WatchlistRule) {
  const parts = [r.department && `Department ${r.department}`, r.location && `Location ${r.location}`, r.tag && `Tag ${r.tag}`, r.minBand && `${r.minBand} or above`, r.rising && "Score rising", r.repeatClicker && "2 or more fails in 180 days"].filter(Boolean);
  return parts.length ? parts.join(" and ") : "Everyone scored";
}
export function makeWatchlist(name: string, r: WatchlistRule): WatchlistDef {
  return {
    id: `custom-${Date.now().toString(36)}`, name, rule: describeRule(r), custom: true,
    match: (p) => (!r.department || p.department === r.department) && (!r.location || p.location === r.location)
      && (!r.tag || p.tags.includes(r.tag as never)) && (!r.minBand || (p.score ?? -1) >= BAND_MIN[r.minBand]!)
      && (!r.rising || (p.change ?? 0) > 0) && (!r.repeatClicker || p.sims.filter((x) => failed(x) && x.ageDays <= 180).length >= 2),
  };
}
let customLists: WatchlistDef[] = [];
const wlListeners = new Set<() => void>();
export function useCustomWatchlists() {
  return useSyncExternalStore((l) => (wlListeners.add(l), () => wlListeners.delete(l)), () => customLists, () => customLists);
}
export function addWatchlist(w: WatchlistDef) { customLists = [...customLists, w]; wlListeners.forEach((l) => l()); }
export function removeWatchlist(id: string) { customLists = customLists.filter((w) => w.id !== id); wlListeners.forEach((l) => l()); }
export function watchlistSummary(s: SignalState, custom: WatchlistDef[] = []) {
  const people = getPeople(s);
  return [...WATCHLISTS, ...custom].map((w) => {
    const members = people.filter((p) => w.match(p, people));
    const sc = members.filter((m) => m.score !== null);
    const prevSc = members.filter((m) => m.prev !== null);
    const avg = sc.length ? Math.round(sc.reduce((a, m) => a + m.score!, 0) / sc.length) : null;
    const prev = prevSc.length ? Math.round(prevSc.reduce((a, m) => a + m.prev!, 0) / prevSc.length) : null;
    return { ...w, members, avg, change: avg !== null && prev !== null ? avg - prev : null, band: bandFor(avg) };
  });
}

// ---------- Risk spreading ----------
/** High or Critical people ranked by how many teammates (same manager, or their direct reports) they work with. */
export function riskSpreaders(s: SignalState, people = getPeople(s)) {
  const byMgr = new Map<string, ScoredPerson[]>();
  for (const p of people) if (p.managerId) byMgr.set(p.managerId, [...(byMgr.get(p.managerId) ?? []), p]);
  return people.filter((p) => p.band === "High" || p.band === "Critical").map((p) => {
    const team = (p.managerId ? byMgr.get(p.managerId) ?? [] : []).filter((x) => x.id !== p.id);
    const reports = byMgr.get(p.id) ?? [];
    const peers = [...team, ...reports];
    return { id: p.id, name: p.name, role: p.role, department: p.department, score: p.score ?? 0, peers: peers.length, peersAtRisk: peers.filter((x) => (x.score ?? 0) >= 40).length };
  }).sort((a, b) => b.peers * b.score - a.peers * a.score).slice(0, 6);
}
/** Per department: how involved managers are (low Learning and Culture risk among managers) against average real-world incident risk. */
export function managerInvolvement(s: SignalState, people = getPeople(s)) {
  const mgrIds = new Set(people.map((p) => p.managerId).filter(Boolean) as string[]);
  return DEPARTMENTS.map((d) => {
    const dp = people.filter((p) => p.department === d);
    const mgrs = dp.filter((p) => mgrIds.has(p.id));
    const inv = mgrs.map((m) => 100 - mean([m.categories["Learning"] ?? 50, m.categories["Culture"] ?? 50]));
    const inc = dp.map((p) => p.categories["Real-world incidents"]).filter((v): v is number => v != null);
    return { department: d, involvement: Math.round(mean(inv)), incidents: Math.round(mean(inc)), managers: mgrs.length };
  }).filter((x) => x.managers > 0).sort((a, b) => a.involvement - b.involvement);
}
