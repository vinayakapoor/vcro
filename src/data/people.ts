import { DEPARTMENTS, ELEMENTS, HEADCOUNT, LOCATIONS, TEMPLATES, type Department } from "./catalogue";
import type { Channel, Lure, Outcome, Readings, SimEvent } from "@/lib/scoring";
import { CHANNELS, LURES } from "@/lib/scoring";

export const TAGS = [
  { name: "VIP", about: "Executives, board-facing leaders and department heads", source: "Recipients" },
  { name: "Privileged", about: "Holds admin rights on systems or platforms", source: "Identity provider" },
  { name: "Very attacked", about: "Receives far more targeted attacks than peers", source: "Email Security (ESA)" },
  { name: "Externally exposed", about: "Credentials or personal data found in an external breach", source: "OSINT monitoring" },
  { name: "Financial authority", about: "Can approve payments or change bank details", source: "Recipients" },
  { name: "Sensitive data", about: "Works with confidential or regulated data every day", source: "Recipients" },
  { name: "Joiner or mover", about: "Joined or changed role in the last 90 days", source: "HR system" },
  { name: "Leaver", about: "In a notice period or being offboarded", source: "HR system" },
  { name: "Contractor", about: "Contractor or vendor staff with system access", source: "HR system" },
  { name: "Remote worker", about: "Works mostly outside the office network", source: "HR system" },
] as const;
export type Tag = (typeof TAGS)[number]["name"];
export type Level = "Head" | "Manager" | "Individual";
export type ActivityType = "Simulation" | "Real threat" | "Training" | "JIT nudge" | "Announcement";
export type Activity = { id: string; type: ActivityType; title: string; detail: string; source: string; ageDays: number; sim?: SimEvent };
export type Severity = "High" | "Medium" | "Low";

export type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  level: Level;
  department: Department;
  location: (typeof LOCATIONS)[number];
  managerId: string | null;
  tags: Tag[];
  readings: Readings;
  /** Newest first. */
  sims: SimEvent[];
  knowledge: number; // 0-100
  drift: number; // monthly change in non-simulation readings
};
export type PersonDetail = { activity: Activity[]; osint: { item: string; severity: Severity }[]; access: { item: string; level: Severity }[] };

/** Deterministic generator: one independent stream per person, so the tenant is identical on every load. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

const FIRST = [
  "Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Neha", "Arjun", "Kavya", "Siddharth", "Ishita",
  "Rahul", "Meera", "Karan", "Divya", "Aditya", "Pooja", "Nikhil", "Sneha", "Varun", "Riya",
  "Omar", "Fatima", "Ahmed", "Mariam", "Khalid", "Aisha", "Yousef", "Layla", "Hamdan", "Noura",
  "Suresh", "Lakshmi", "Manoj", "Deepa", "Rajesh", "Sunita", "Farhan", "Zara", "Imran", "Sana",
  "Tanvi", "Harsh", "Nisha", "Gaurav", "Shreya", "Amit", "Anjali", "Vivek", "Swati", "Kunal",
  "Rashid", "Hessa", "Saeed", "Reem", "Majid", "Salma", "Tariq", "Dana", "Faisal", "Huda",
  "Ritika", "Abhishek", "Tara", "Mohit", "Jyoti", "Sandeep", "Aditi", "Naveen", "Pallavi", "Dev",
];
const LAST = [
  "Sharma", "Iyer", "Mehta", "Reddy", "Kapoor", "Nair", "Gupta", "Menon", "Bose", "Joshi",
  "Al Mansoori", "Al Nuaimi", "Khan", "Al Hashimi", "Pillai", "Chopra", "Rao", "Qureshi", "Desai", "Al Falasi",
  "Verma", "Krishnan", "Banerjee", "Shetty", "Malhotra", "Agarwal", "Kulkarni", "Chatterjee", "Bhatt", "Saxena",
  "Al Suwaidi", "Al Marri", "Siddiqui", "Al Ketbi", "Fernandes", "Ghosh", "Patil", "Hussain", "Thomas", "Al Zaabi",
];
const ROLES: Record<Department, { head: string; manager: string[]; ic: string[] }> = {
  Finance: { head: "Head of finance", manager: ["Finance manager", "Financial controller"], ic: ["Accounts payable analyst", "Treasury analyst", "Financial analyst"] },
  HR: { head: "Head of HR", manager: ["HR manager", "Talent acquisition lead"], ic: ["HR business partner", "Payroll specialist", "Recruiter"] },
  IT: { head: "Head of IT", manager: ["IT operations manager", "Infrastructure lead"], ic: ["Systems administrator", "IT support engineer", "Cloud administrator"] },
  Engineering: { head: "Head of engineering", manager: ["Engineering manager"], ic: ["Software engineer", "DevOps engineer", "QA engineer"] },
  Sales: { head: "Head of sales", manager: ["Regional sales manager"], ic: ["Account executive", "Sales operations analyst", "Sales development representative"] },
  Operations: { head: "Head of operations", manager: ["Operations manager", "Facilities lead"], ic: ["Supply chain analyst", "Operations analyst", "Logistics coordinator"] },
  Legal: { head: "General counsel", manager: ["Senior legal counsel"], ic: ["Legal counsel", "Compliance officer", "Contracts manager"] },
  "Executive Office": { head: "Chief executive officer", manager: ["Chief financial officer", "Chief operating officer", "Chief technology officer", "Chief revenue officer", "Chief people officer"], ic: ["Executive assistant", "Chief of staff", "Strategy analyst"] },
  "Customer Support": { head: "Head of support", manager: ["Support team lead"], ic: ["Support agent", "Customer success manager", "Support specialist"] },
  Procurement: { head: "Head of procurement", manager: ["Procurement manager"], ic: ["Vendor manager", "Buyer", "Sourcing analyst"] },
};
const DEPT_BIAS: Record<Department, number> = {
  Finance: 18, HR: 6, IT: -2, Engineering: -8, Sales: 12, Operations: 0, Legal: -4,
  "Executive Office": 14, "Customer Support": 8, Procurement: 10,
};
const DEPT_WEAK_CHANNEL: Record<Department, Channel> = {
  Finance: "Deepfake", HR: "Email", IT: "Voice", Engineering: "QR", Sales: "SMS", Operations: "QR",
  Legal: "Email", "Executive Office": "Deepfake", "Customer Support": "Voice", Procurement: "Email",
};
const DEPT_WEAK_LURE: Record<Department, Lure> = {
  Finance: "Authority", HR: "Familiarity", IT: "Curiosity", Engineering: "Curiosity", Sales: "Reward", Operations: "Urgency",
  Legal: "Fear", "Executive Office": "Authority", "Customer Support": "Urgency", Procurement: "Authority",
};
const CAMPAIGNS: Record<Channel, number> = { Email: 5, Voice: 3, SMS: 3, QR: 3, Deepfake: 2 };
const OUTCOME_FOR: Record<string, Outcome[]> = {
  Link: ["Clicked"], "Data Entry": ["Clicked", "Data entered", "Data entered"], "QR Code": ["QR scanned"], Attachment: ["Attachment enabled"],
};
const SIM_SOURCE: Record<Channel, string> = { Email: "Phishing", Voice: "Vishing", SMS: "Smishing", QR: "QR", Deepfake: "Deepfake" };
const TPL_BY_CHANNEL = Object.fromEntries(CHANNELS.map((c) => [c, TEMPLATES.filter((t) => t.channel === c)])) as Record<Channel, typeof TEMPLATES>;
const NON_SIM_ELEMENTS = ELEMENTS.filter((e) => e.category !== "Simulations");

/** Direct reports per manager. Departments small enough for one team report straight to the head. */
const TEAM_SIZE = 12;
const pid = (i: number) => `p${String(i + 1).padStart(4, "0")}`;

const emailSeen = new Map<string, number>();

function build(i: number, department: Department, level: Level, managerIdx: number | null): Person {
  const r = rng(0x9e3779b1 ^ Math.imul(i + 1, 2654435761));
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const location = pick(LOCATIONS);
  const first = pick(FIRST);
  const last = pick(LAST);
  const base = `${first}.${last.replace(/\s/g, "")}`.toLowerCase();
  const n = (emailSeen.get(base) ?? 0) + 1;
  emailSeen.set(base, n);
  const roles = ROLES[department];
  const role = level === "Head" ? roles.head : level === "Manager" ? pick(roles.manager) : pick(roles.ic);
  const bias = DEPT_BIAS[department];
  // Most people sit near their department norm; a small tail is markedly riskier.
  const personal = (r() - 0.5) * 50 + (r() < 0.07 ? 22 + r() * 22 : 0);
  const propensity = Math.max(0.02, Math.min(0.8, 0.06 + (bias + personal) / 150));

  const vip = level === "Head" || department === "Executive Office" || r() < 0.01;
  const privileged = vip || (department === "IT" && r() < 0.5) || (department === "Finance" && r() < 0.35);
  const veryAttacked = (vip && r() < 0.55) || r() < 0.08;
  const joiner = level === "Individual" && r() < 0.06;
  const leaver = !vip && r() < 0.015;
  const contractor = level === "Individual" && !vip && r() < 0.07;
  const remote = r() < 0.3;

  const id = pid(i);
  const sims: SimEvent[] = [];
  const noSims = r() < 0.03;
  if (!noSims) {
    let k = 0;
    for (const ch of CHANNELS) {
      for (let c = 0; c < CAMPAIGNS[ch]; c++) {
        const tp = pick(TPL_BY_CHANNEL[ch]);
        const ageDays = Math.floor(((CAMPAIGNS[ch] - c) / CAMPAIGNS[ch]) * 330 - r() * 25 + 5);
        let p = propensity * (1 + 0.45 * (ageDays / 330));
        if (ch === DEPT_WEAK_CHANNEL[department]) p *= 1.5;
        if (tp.lure === DEPT_WEAK_LURE[department]) p *= 1.35;
        if (veryAttacked) p *= 1.1;
        p *= 1.25 - tp.difficulty * 0.08;
        const fail = r() < Math.min(0.92, p);
        const outcome: Outcome = fail ? pick(OUTCOME_FOR[tp.payload]!) : "Passed";
        const repProb = Math.max(0.05, 0.6 - propensity) * (ageDays < 60 ? 1.4 : 1);
        sims.push({
          id: `${id}-s${++k}`, channel: ch, template: tp.name, payload: tp.payload, lure: tp.lure, difficulty: tp.difficulty,
          outcome, reported: r() < repProb, ttcSec: fail ? Math.round(8 + r() * (propensity > 0.35 ? 60 : 280)) : undefined, ageDays: Math.max(1, ageDays),
        });
      }
    }
    sims.sort((a, b) => a.ageDays - b.ageDays);
  }

  // Non-simulation readings (0-100 risk; reporting is 0-100 good)
  const readings: Readings = {};
  const noLearning = r() < 0.04;
  for (const el of NON_SIM_ELEMENTS) {
    if (noLearning && el.category === "Learning") continue;
    if (r() < 0.08) continue;
    let v = 38 + bias + personal + (r() - 0.5) * 40;
    if (el.pillar === "Reporting") v = 55 - personal + (r() - 0.5) * 40;
    if (el.pillar === "Exposure") v = 30 + (veryAttacked ? 35 : 0) + (vip ? 15 : 0) + r() * 30;
    if (el.pillar === "Privilege") {
      v = 20 + (privileged ? 40 : 0) + (vip ? 15 : 0) + r() * 25;
      if (department === "Finance" && el.category === "Financial authority") v += 30;
    }
    readings[el.id] = el.category === "Real-world incidents" ? { value: clamp(v), ageDays: Math.floor(r() * 180) } : { value: clamp(v) };
  }
  if (readings["exp-joiner"]) readings["exp-joiner"] = { value: joiner ? clamp(72 + r() * 25) : clamp(r() * 30) };
  if (readings["exp-contractor"]) readings["exp-contractor"] = { value: contractor ? clamp(78 + r() * 20) : 0 };
  if (readings["prv-outlive"] && !contractor) readings["prv-outlive"] = { value: 0 };
  if (readings["prv-data"] && (department === "HR" || department === "Legal" || department === "Finance")) readings["prv-data"] = { value: clamp(readings["prv-data"].value + 30) };
  const tags: Tag[] = [];
  if (vip) tags.push("VIP");
  if (privileged) tags.push("Privileged");
  if (veryAttacked) tags.push("Very attacked");
  if ((readings["exp-breach"]?.value ?? 0) > 60) tags.push("Externally exposed");
  if ((readings["prv-fin"]?.value ?? 0) > 60) tags.push("Financial authority");
  if ((readings["prv-data"]?.value ?? 0) > 60) tags.push("Sensitive data");
  if (joiner) tags.push("Joiner or mover");
  if (leaver) tags.push("Leaver");
  if (contractor) tags.push("Contractor");
  if (remote) tags.push("Remote worker");
  if (!noSims) {
    readings["sim-mfa"] = { value: clamp(propensity * 100 + (r() - 0.5) * 30) };
    readings["sim-callback"] = { value: clamp(propensity * 90 + (r() - 0.5) * 30) };
  }

  return {
    id, name: `${first} ${last}`, email: `${base}${n > 1 ? n : ""}@demoenterprise.com`, role, level, department, location,
    managerId: managerIdx === null ? null : pid(managerIdx), tags, readings, sims,
    knowledge: clamp(100 - (readings["lrn-assess"]?.value ?? 50) + (r() - 0.5) * 10),
    drift: (r() - 0.35) * 0.04,
  };
}

function buildTenant(): Person[] {
  const out: Person[] = [];
  const start: Partial<Record<Department, number>> = {};
  let at = 0;
  for (const d of DEPARTMENTS) { start[d] = at; at += HEADCOUNT[d]; }
  const ceo = start["Executive Office"]!;
  for (const d of DEPARTMENTS) {
    const s = start[d]!;
    const size = HEADCOUNT[d];
    const managers = size - 1 > TEAM_SIZE ? Math.ceil((size - 1) / (TEAM_SIZE + 1)) : 0;
    for (let k = 0; k < size; k++) {
      const i = s + k;
      if (k === 0) out.push(build(i, d, "Head", d === "Executive Office" ? null : ceo));
      else if (k <= managers) out.push(build(i, d, "Manager", s));
      else out.push(build(i, d, "Individual", managers ? s + 1 + ((k - managers - 1) % managers) : s));
    }
  }
  return out;
}

export const PEOPLE: Person[] = buildTenant();
export const PERSON_BY_ID = new Map(PEOPLE.map((p) => [p.id, p]));

const detailCache = new Map<string, PersonDetail>();

/** Timeline, exposure findings and access for one person. Built on demand, only the person page needs it. */
export function personDetail(p: Person): PersonDetail {
  const hit = detailCache.get(p.id);
  if (hit) return hit;
  const r = rng(0x85ebca6b ^ Math.imul(Number(p.id.slice(1)), 40503));
  let seq = 0;
  const aid = () => `${p.id}-a${++seq}`;
  const vip = p.tags.includes("VIP");
  const activity: Activity[] = p.sims.map((s) => ({
    id: s.id, type: "Simulation", title: s.template, source: SIM_SOURCE[s.channel], ageDays: s.ageDays, sim: s,
    detail: s.outcome === "Passed" ? (s.reported ? "Reported" : "No action") : s.reported ? `${s.outcome}, then reported` : s.outcome,
  }));
  const threats = Math.floor(r() * 4);
  for (let k = 0; k < threats; k++) {
    const blocked = r() < 0.5;
    activity.push({
      id: aid(), type: "Real threat", source: blocked ? "Email Security (ESA)" : "Email Remediator", ageDays: Math.floor(r() * 300) + 1,
      title: blocked ? "Malicious link blocked" : "Reported phish removed", detail: blocked ? "Clicked, blocked at gateway" : "Removed from 14 inboxes",
    });
  }
  for (const tr of ["Phishing fundamentals", "Payment fraud basics", "Safe use of QR codes"].slice(0, 1 + Math.floor(r() * 3))) {
    const done = r() < 0.8;
    activity.push({ id: aid(), type: "Training", title: tr, source: "LMS", ageDays: Math.floor(r() * 320) + 1, detail: done ? `Completed, ${60 + Math.floor(r() * 40)}%` : "Overdue" });
  }
  for (const s of p.sims.filter((x) => x.outcome !== "Passed").slice(0, 3)) {
    activity.push({ id: aid(), type: "JIT nudge", title: `${s.channel} lure coaching`, source: "JIT Training", ageDays: Math.max(0, s.ageDays - 1), detail: r() < 0.7 ? "Viewed" : "Not opened" });
  }
  activity.push({ id: aid(), type: "Announcement", title: "Acceptable use policy 2026", source: "Announcements", ageDays: 210, detail: r() < 0.85 ? "Acknowledged" : "Not acknowledged" });
  activity.push({ id: aid(), type: "Announcement", title: "Deepfake payment fraud alert", source: "Announcements", ageDays: 45, detail: r() < 0.8 ? "Acknowledged" : "Not acknowledged" });
  activity.sort((a, b) => a.ageDays - b.ageDays);

  const v = (k: string) => p.readings[k]?.value ?? 0;
  const osint: PersonDetail["osint"] = [];
  if (v("exp-breach") > 55) osint.push({ item: "Work email in a public breach", severity: "High" });
  if (v("exp-contact") > 50) osint.push({ item: "Mobile number listed publicly", severity: "Medium" });
  if (v("exp-social") > 45) osint.push({ item: "Role and manager listed on social profile", severity: "Low" });
  if (vip) osint.push({ item: "Named in press releases", severity: "Medium" });

  const access: PersonDetail["access"] = [];
  if (p.tags.includes("Privileged")) access.push({ item: p.department === "IT" ? "Domain admin on 3 systems" : "Admin on finance platform", level: "High" });
  if (v("prv-fin") > 60) access.push({ item: "Payment approval authority", level: "High" });
  if (v("prv-shared") > 50) access.push({ item: "Owner of 2 shared mailboxes", level: "Medium" });
  if (vip) access.push({ item: "Board and leadership network", level: "Medium" });
  if (!access.length) access.push({ item: "Standard user access", level: "Low" });

  const d = { activity, osint, access };
  if (detailCache.size > 200) detailCache.clear();
  detailCache.set(p.id, d);
  return d;
}

export { LURES };
