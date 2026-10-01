// Pure scoring functions for the Human Risk Score. No UI imports.

export type Band = "Low" | "Guarded" | "Elevated" | "High" | "Critical" | "No score";
export type Pillar = "Behaviour" | "Exposure" | "Privilege" | "Reporting";
export type Channel = "Email" | "Voice" | "SMS" | "QR" | "Deepfake";
export type Lure = "Urgency" | "Authority" | "Reward" | "Curiosity" | "Fear" | "Familiarity";
export type Payload = "Link" | "Data Entry" | "QR Code" | "Attachment";
export type Outcome = "Passed" | "Clicked" | "QR scanned" | "Data entered" | "Attachment enabled";

export const CHANNELS: Channel[] = ["Email", "Voice", "SMS", "QR", "Deepfake"];
export const LURES: Lure[] = ["Urgency", "Authority", "Reward", "Curiosity", "Fear", "Familiarity"];

export const CATEGORY_WEIGHTS = {
  Behaviour: { Simulations: 35, "Real-world incidents": 35, Learning: 18, "Security hygiene": 15, Culture: 12, Attitude: 8 },
  Exposure: { Targeting: 35, "Human OSINT": 35, "Role visibility": 30 },
  Privilege: {
    "Access and admin": 35,
    "Financial authority": 25,
    "Data access": 25,
    "Seniority and network centrality": 15,
    "AI agents": 15,
  },
} as const;
type ScoredPillar = keyof typeof CATEGORY_WEIGHTS;
const SCORED_PILLARS: ScoredPillar[] = ["Behaviour", "Exposure", "Privilege"];

/** Share of total model weight per pillar, used for element weights and confidence. AI identities is reserved at 0%. */
export const PILLAR_SHARE: Record<Pillar, number> = { Behaviour: 0.45, Exposure: 0.25, Privilege: 0.2, Reporting: 0.1 };

export const LIKELIHOOD_WEIGHTS = { Behaviour: 0.65, Exposure: 0.35 } as const;
export const REPORTING_MAX_OFFSET = 15;
/** Privilege scales likelihood between these two multipliers. */
export const IMPACT_RANGE = [0.8, 1.3] as const;

/** Tenant-editable scoring settings (vCRO Settings). */
export type ScoringConfig = { halfLifeDays: number; simWindow: number; impulsiveSeconds: number; minConfidence: number };
export const DEFAULT_CONFIG: ScoringConfig = { halfLifeDays: 90, simWindow: 3, impulsiveSeconds: 30, minConfidence: 60 };

export const OUTCOME_SEVERITY: Record<Outcome, number> = {
  Passed: 0,
  Clicked: 3,
  "QR scanned": 3,
  "Data entered": 6,
  "Attachment enabled": 6,
};
export const REPORTED_AFTER_FAIL = -2;
export const REPORTED_WITHOUT_FAIL = -3;

export type ElementDef = { id: string; name: string; pillar: Pillar; category: string; sourceId: string };
export type ElementReading = { value: number; ageDays?: number | undefined };
export type Readings = Record<string, ElementReading | undefined>;
export type WeightOverrides = Partial<Record<string, number>>;

export type SimEvent = {
  id: string;
  channel: Channel;
  template: string;
  payload: Payload;
  lure: Lure;
  difficulty: number; // 1-5
  outcome: Outcome;
  reported: boolean;
  ttcSec?: number | undefined;
  ageDays: number;
};

export function bandFor(score: number | null): Band {
  if (score === null) return "No score";
  if (score <= 20) return "Low";
  if (score <= 40) return "Guarded";
  if (score <= 60) return "Elevated";
  if (score <= 80) return "High";
  return "Critical";
}
/** Inclusive score range per band, the single source for every legend. */
export const BAND_RANGES: { band: Exclude<Band, "No score">; from: number; to: number }[] = [
  { band: "Low", from: 0, to: 20 },
  { band: "Guarded", from: 21, to: 40 },
  { band: "Elevated", from: 41, to: 60 },
  { band: "High", from: 61, to: 80 },
  { band: "Critical", from: 81, to: 100 },
];

export function decay(value: number, ageDays = 0, halfLifeDays = DEFAULT_CONFIG.halfLifeDays): number {
  return halfLifeDays > 0 ? value * Math.pow(0.5, ageDays / halfLifeDays) : value;
}

/** Difficulty 1 counts x1.4, difficulty 5 counts x0.7, linear in between. */
export function difficultyFactor(d: number): number {
  return 1.4 - ((Math.min(5, Math.max(1, d)) - 1) * 0.7) / 4;
}

export const failed = (e: SimEvent) => e.outcome !== "Passed";
export const isImpulsive = (e: SimEvent, seconds = DEFAULT_CONFIG.impulsiveSeconds) => failed(e) && (e.ttcSec ?? Infinity) < seconds;

/** Points for one simulation event before decay. */
export function eventPoints(e: SimEvent): number {
  const sev = OUTCOME_SEVERITY[e.outcome];
  let pts = sev * difficultyFactor(e.difficulty);
  if (e.reported) pts += sev > 0 ? REPORTED_AFTER_FAIL : REPORTED_WITHOUT_FAIL;
  return pts;
}

const SIM_MAX = OUTCOME_SEVERITY["Data entered"] * difficultyFactor(1);

/** Channel simulation risk 0-100 from the last N campaigns, with half-life decay. Events must be sorted newest first. */
export function simulationRisk(events: SimEvent[], cfg: ScoringConfig = DEFAULT_CONFIG): number | null {
  const n = Math.min(events.length, Math.max(1, cfg.simWindow));
  if (!n) return null;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += decay(eventPoints(events[i]!), events[i]!.ageDays, cfg.halfLifeDays);
  return Math.max(0, Math.min(100, (sum / (n * SIM_MAX)) * 100));
}

export function rates(events: SimEvent[]) {
  const n = events.length;
  let fails = 0, reports = 0;
  for (const e of events) { if (failed(e)) fails++; if (e.reported) reports++; }
  return { attempts: n, failures: fails, reports, failRate: n ? fails / n : 0, reportRate: n ? reports / n : 0 };
}

// ---------- Element index (built once per catalogue) ----------
type Index = {
  weights: Record<string, number>;
  total: number;
  byPillar: Record<ScoredPillar, [category: string, ids: string[]][]>;
  reporting: string[];
  simulations: string[];
  learning: string[];
};
const INDEX = new WeakMap<ElementDef[], Index>();

function indexOf(elements: ElementDef[]): Index {
  const hit = INDEX.get(elements);
  if (hit) return hit;
  const ids = (f: (e: ElementDef) => boolean) => elements.filter(f).map((e) => e.id);
  const byPillar = Object.fromEntries(SCORED_PILLARS.map((p) => [
    p, Object.keys(CATEGORY_WEIGHTS[p]).map((c) => [c, ids((e) => e.pillar === p && e.category === c)] as [string, string[]]),
  ])) as Index["byPillar"];
  const reporting = ids((e) => e.pillar === "Reporting");
  const weights: Record<string, number> = {};
  for (const id of reporting) weights[id] = PILLAR_SHARE.Reporting / reporting.length;
  for (const p of SCORED_PILLARS) {
    const cats = CATEGORY_WEIGHTS[p] as Record<string, number>;
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    for (const [c, list] of byPillar[p]) for (const id of list) weights[id] = (PILLAR_SHARE[p] * cats[c]!) / total / list.length;
  }
  const idx: Index = {
    weights, total: Object.values(weights).reduce((a, b) => a + b, 0), byPillar, reporting,
    simulations: ids((e) => e.category === "Simulations"), learning: ids((e) => e.category === "Learning"),
  };
  INDEX.set(elements, idx);
  return idx;
}

/** Each element carries its pillar share x category weight, split evenly across the category. */
export function elementWeights(elements: ElementDef[]): Record<string, number> {
  return indexOf(elements).weights;
}

/** Confidence = connected weight share, 0-100. */
export function confidenceFor(elements: ElementDef[], isLive: (e: ElementDef) => boolean): number {
  const { weights, total } = indexOf(elements);
  let live = 0;
  for (const e of elements) if (isLive(e)) live += weights[e.id]!;
  return total ? Math.round((live / total) * 100) : 0;
}

type PillarResult = { score: number; categories: Record<string, number | null>; weights: Record<string, number> };

function pillarScore(pillar: ScoredPillar, idx: Index, readings: Readings, active: Set<string>, overrides: WeightOverrides, halfLife: number): PillarResult {
  const base = CATEGORY_WEIGHTS[pillar] as Record<string, number>;
  const categories: Record<string, number | null> = {};
  const weights: Record<string, number> = {};
  let num = 0, den = 0;
  for (const [cat, ids] of idx.byPillar[pillar]) {
    const w = overrides[cat] ?? base[cat]!;
    let sum = 0, n = 0;
    for (const id of ids) {
      const r = readings[id];
      if (!r || !active.has(id)) continue;
      sum += decay(r.value, r.ageDays, halfLife);
      n++;
    }
    if (!n) { categories[cat] = null; continue; }
    const s = sum / n;
    categories[cat] = s;
    weights[cat] = w;
    num += w * s;
    den += w;
  }
  if (den) for (const c of Object.keys(weights)) weights[c] = weights[c]! / den; // renormalise
  return { score: den ? num / den : 0, categories, weights };
}

export type ScoreResult = {
  score: number | null;
  band: Band;
  likelihood: number;
  impact: number;
  behaviour: number;
  exposure: number;
  privilege: number;
  reportingOffset: number;
  confidence: number;
  /** True when confidence is under the tenant's minimum: treat the score as provisional. */
  lowConfidence: boolean;
  categories: Record<string, number | null>;
  /** Points each category adds to likelihood; reporting offset negative. */
  contributions: { category: string; pillar: Pillar; points: number }[];
};

/** Personal skill score, 0-100, higher is better: inverse behaviour risk, reporting habit and knowledge. */
export function skillScore(r: ScoreResult, knowledge: number): number | null {
  if (r.score === null) return null;
  const rep = Math.min(100, (-r.reportingOffset / REPORTING_MAX_OFFSET) * 100);
  return Math.max(0, Math.min(100, Math.round(0.55 * (100 - r.behaviour) + 0.25 * rep + 0.2 * knowledge)));
}

const hasAny = (ids: string[], readings: Readings, active: Set<string>) => ids.some((id) => active.has(id) && readings[id]);

/**
 * likelihood = 0.65 x (Behaviour - reporting offset) + 0.35 x Exposure
 * score      = likelihood x impact, where impact runs 0.8 to 1.3 with Privilege
 */
export function computeScore(
  elements: ElementDef[],
  readings: Readings,
  active: Set<string>,
  overrides: WeightOverrides = {},
  cfg: ScoringConfig = DEFAULT_CONFIG,
): ScoreResult {
  const idx = indexOf(elements);
  const b = pillarScore("Behaviour", idx, readings, active, overrides, cfg.halfLifeDays);
  const x = pillarScore("Exposure", idx, readings, active, overrides, cfg.halfLifeDays);
  const p = pillarScore("Privilege", idx, readings, active, overrides, cfg.halfLifeDays);

  let repSum = 0, repN = 0, liveWeight = 0;
  for (const id of idx.reporting) { const r = readings[id]; if (r && active.has(id)) { repSum += r.value; repN++; } }
  for (const e of elements) if (active.has(e.id) && readings[e.id]) liveWeight += idx.weights[e.id]!;
  const reportingOffset = repN ? -(REPORTING_MAX_OFFSET * (repSum / repN)) / 100 : 0;

  const behaviour = Math.max(0, b.score + reportingOffset);
  const likelihood = LIKELIHOOD_WEIGHTS.Behaviour * behaviour + LIKELIHOOD_WEIGHTS.Exposure * x.score;
  const impact = IMPACT_RANGE[0] + (IMPACT_RANGE[1] - IMPACT_RANGE[0]) * (p.score / 100);

  const eligible = hasAny(idx.simulations, readings, active) && hasAny(idx.learning, readings, active);
  const score = eligible ? Math.min(100, Math.round(likelihood * impact)) : null;
  const confidence = idx.total ? Math.round((liveWeight / idx.total) * 100) : 0;

  const contributions: ScoreResult["contributions"] = [];
  for (const [cat, w] of Object.entries(b.weights))
    contributions.push({ category: cat, pillar: "Behaviour", points: LIKELIHOOD_WEIGHTS.Behaviour * w * b.categories[cat]! });
  for (const [cat, w] of Object.entries(x.weights))
    contributions.push({ category: cat, pillar: "Exposure", points: LIKELIHOOD_WEIGHTS.Exposure * w * x.categories[cat]! });
  contributions.push({ category: "Reporting offset", pillar: "Reporting", points: LIKELIHOOD_WEIGHTS.Behaviour * reportingOffset });

  return {
    score,
    band: bandFor(score),
    likelihood: Math.round(likelihood),
    impact: Math.round(impact * 100) / 100,
    behaviour: Math.round(behaviour),
    exposure: Math.round(x.score),
    privilege: Math.round(p.score),
    reportingOffset: Math.round(reportingOffset),
    confidence,
    lowConfidence: score !== null && confidence < cfg.minConfidence,
    categories: { ...b.categories, ...x.categories, ...p.categories },
    contributions,
  };
}

/** Score only, for bulk history and what-if runs. */
export function scoreOnly(elements: ElementDef[], readings: Readings, active: Set<string>, overrides: WeightOverrides = {}, cfg: ScoringConfig = DEFAULT_CONFIG): number | null {
  const idx = indexOf(elements);
  if (!(hasAny(idx.simulations, readings, active) && hasAny(idx.learning, readings, active))) return null;
  const b = pillarScore("Behaviour", idx, readings, active, overrides, cfg.halfLifeDays).score;
  const x = pillarScore("Exposure", idx, readings, active, overrides, cfg.halfLifeDays).score;
  const p = pillarScore("Privilege", idx, readings, active, overrides, cfg.halfLifeDays).score;
  let repSum = 0, repN = 0;
  for (const id of idx.reporting) { const r = readings[id]; if (r && active.has(id)) { repSum += r.value; repN++; } }
  const behaviour = Math.max(0, b - (repN ? (REPORTING_MAX_OFFSET * (repSum / repN)) / 100 : 0));
  const likelihood = LIKELIHOOD_WEIGHTS.Behaviour * behaviour + LIKELIHOOD_WEIGHTS.Exposure * x;
  return Math.min(100, Math.round(likelihood * (IMPACT_RANGE[0] + (IMPACT_RANGE[1] - IMPACT_RANGE[0]) * (p / 100))));
}
