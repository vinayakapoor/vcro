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
  Behaviour: { Simulations: 35, "Real-world incidents": 35, Learning: 18, Culture: 12, Attitude: 8 },
  Exposure: { Targeting: 35, "Human OSINT": 35, "Role visibility": 30 },
  Privilege: {
    "Access and admin": 35,
    "Financial authority": 25,
    "Data access": 25,
    "Seniority and network centrality": 15,
  },
} as const;

/** Share of total model weight per pillar, used for element weights and confidence. AI identities is reserved at 0%. */
export const PILLAR_SHARE: Record<Pillar, number> = { Behaviour: 0.45, Exposure: 0.25, Privilege: 0.2, Reporting: 0.1 };

export const LIKELIHOOD_WEIGHTS = { Behaviour: 0.65, Exposure: 0.35 } as const;
export const REPORTING_MAX_OFFSET = 15;
export const HALF_LIFE_DAYS = 90;
export const SIM_CAMPAIGN_WINDOW = 3;
export const IMPULSIVE_SECONDS = 30;

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

export function decay(value: number, ageDays = 0): number {
  return value * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** Difficulty 1 counts x1.4, difficulty 5 counts x0.7, linear in between. */
export function difficultyFactor(d: number): number {
  return 1.4 - ((Math.min(5, Math.max(1, d)) - 1) * 0.7) / 4;
}

export const failed = (e: SimEvent) => e.outcome !== "Passed";
export const isImpulsive = (e: SimEvent) => failed(e) && (e.ttcSec ?? Infinity) < IMPULSIVE_SECONDS;

/** Points for one simulation event before decay. */
export function eventPoints(e: SimEvent): number {
  const sev = OUTCOME_SEVERITY[e.outcome];
  let pts = sev * difficultyFactor(e.difficulty);
  if (e.reported) pts += sev > 0 ? REPORTED_AFTER_FAIL : REPORTED_WITHOUT_FAIL;
  return pts;
}

/** Channel simulation risk 0-100 from the last N campaigns, with 90-day decay. */
export function simulationRisk(events: SimEvent[], n = SIM_CAMPAIGN_WINDOW): number | null {
  const last = [...events].sort((a, b) => a.ageDays - b.ageDays).slice(0, n);
  if (!last.length) return null;
  const max = OUTCOME_SEVERITY["Data entered"] * difficultyFactor(1);
  const sum = last.reduce((a, e) => a + decay(eventPoints(e), e.ageDays), 0);
  return Math.max(0, Math.min(100, (sum / (last.length * max)) * 100));
}

export function rates(events: SimEvent[]) {
  const n = events.length;
  const fails = events.filter(failed).length;
  const reports = events.filter((e) => e.reported).length;
  return { attempts: n, failures: fails, reports, failRate: n ? fails / n : 0, reportRate: n ? reports / n : 0 };
}

/** Report-to-fail ratio = simulation reporting rate / simulation failure rate. */
export function reportToFail(events: SimEvent[]): number | null {
  const r = rates(events);
  return r.failRate ? r.reportRate / r.failRate : null;
}

/** Each element carries its pillar share x category weight, split evenly across the category. */
export function elementWeights(elements: ElementDef[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const el of elements) {
    if (el.pillar === "Reporting") {
      const n = elements.filter((e) => e.pillar === "Reporting").length;
      out[el.id] = PILLAR_SHARE.Reporting / n;
      continue;
    }
    const cats = CATEGORY_WEIGHTS[el.pillar] as Record<string, number>;
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    const n = elements.filter((e) => e.pillar === el.pillar && e.category === el.category).length;
    out[el.id] = (PILLAR_SHARE[el.pillar] * (cats[el.category] ?? 0)) / total / n;
  }
  return out;
}

/** Confidence = connected weight share, 0-100. */
export function confidenceFor(elements: ElementDef[], isLive: (e: ElementDef) => boolean): number {
  const w = elementWeights(elements);
  const total = elements.reduce((a, e) => a + w[e.id]!, 0);
  const live = elements.reduce((a, e) => a + (isLive(e) ? w[e.id]! : 0), 0);
  return total ? Math.round((live / total) * 100) : 0;
}

type PillarResult = { score: number; categories: Record<string, number | null>; weights: Record<string, number> };

function pillarScore(
  pillar: "Behaviour" | "Exposure" | "Privilege",
  elements: ElementDef[],
  readings: Readings,
  active: Set<string>,
  overrides: WeightOverrides,
): PillarResult {
  const base = { ...CATEGORY_WEIGHTS[pillar], ...overrides } as Record<string, number>;
  const categories: Record<string, number | null> = {};
  const weights: Record<string, number> = {};
  let num = 0;
  let den = 0;
  for (const [cat, w] of Object.entries(base)) {
    const live = elements.filter((e) => e.pillar === pillar && e.category === cat && active.has(e.id) && readings[e.id]);
    if (!live.length) {
      categories[cat] = null;
      continue;
    }
    const s = live.reduce((a, e) => a + decay(readings[e.id]!.value, readings[e.id]!.ageDays), 0) / live.length;
    categories[cat] = s;
    weights[cat] = w;
    num += w * s;
    den += w;
  }
  for (const c of Object.keys(weights)) weights[c] = weights[c]! / den; // renormalise
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

export function computeScore(
  elements: ElementDef[],
  readings: Readings,
  active: Set<string>,
  overrides: WeightOverrides = {},
): ScoreResult {
  const b = pillarScore("Behaviour", elements, readings, active, overrides);
  const x = pillarScore("Exposure", elements, readings, active, overrides);
  const p = pillarScore("Privilege", elements, readings, active, overrides);

  const rep = elements.filter((e) => e.pillar === "Reporting" && active.has(e.id) && readings[e.id]);
  const repGood = rep.length ? rep.reduce((a, e) => a + readings[e.id]!.value, 0) / rep.length : 0;
  const reportingOffset = -(REPORTING_MAX_OFFSET * repGood) / 100;

  const behaviour = Math.max(0, b.score + reportingOffset);
  const likelihood = LIKELIHOOD_WEIGHTS.Behaviour * behaviour + LIKELIHOOD_WEIGHTS.Exposure * x.score;
  const impact = 0.8 + 0.5 * (p.score / 100);

  const has = (cat: string) => elements.some((e) => e.category === cat && active.has(e.id) && readings[e.id]);
  const eligible = has("Simulations") && has("Learning");
  const score = eligible ? Math.min(100, Math.round(likelihood * impact)) : null;
  const confidence = confidenceFor(elements, (e) => active.has(e.id) && !!readings[e.id]);

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
    categories: { ...b.categories, ...x.categories, ...p.categories },
    contributions,
  };
}
