import { DEPARTMENTS, ELEMENTS, LOCATIONS, TEMPLATES, type Department } from "./catalogue";
import type { Channel, Lure, Outcome, Readings, SimEvent } from "@/lib/scoring";
import { CHANNELS, LURES } from "@/lib/scoring";

export type Tag = "VIP" | "Privileged" | "Very attacked";
export type ActivityType = "Simulation" | "Real threat" | "Training" | "JIT nudge" | "Announcement";
export type Activity = { id: string; type: ActivityType; title: string; detail: string; source: string; ageDays: number; sim?: SimEvent };
export type Severity = "High" | "Medium" | "Low";

export type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: Department;
  location: (typeof LOCATIONS)[number];
  managerId: string | null;
  tags: Tag[];
  readings: Readings;
  sims: SimEvent[];
  activity: Activity[];
  osint: { item: string; severity: Severity }[];
  access: { item: string; level: Severity }[];
  knowledge: number; // 0-100
  drift: number; // monthly change in non-simulation readings
};

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const r = rng(42);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

const FIRST = [
  "Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Neha", "Arjun", "Kavya", "Siddharth", "Ishita",
  "Rahul", "Meera", "Karan", "Divya", "Aditya", "Pooja", "Nikhil", "Sneha", "Varun", "Riya",
  "Omar", "Fatima", "Ahmed", "Mariam", "Khalid", "Aisha", "Yousef", "Layla", "Hamdan", "Noura",
  "Suresh", "Lakshmi", "Manoj", "Deepa", "Rajesh", "Sunita", "Farhan", "Zara", "Imran", "Sana",
];
const LAST = [
  "Sharma", "Iyer", "Mehta", "Reddy", "Kapoor", "Nair", "Gupta", "Menon", "Bose", "Joshi",
  "Al Mansoori", "Al Nuaimi", "Khan", "Al Hashimi", "Pillai", "Chopra", "Rao", "Qureshi", "Desai", "Al Falasi",
];
const ROLES: Record<Department, string[]> = {
  Finance: ["Head of finance", "Accounts payable lead", "Treasury analyst", "Financial controller"],
  HR: ["Head of HR", "HR business partner", "Talent acquisition lead", "Payroll specialist"],
  IT: ["Head of IT", "Systems administrator", "IT support engineer", "Cloud administrator"],
  Engineering: ["Head of engineering", "Software engineer", "Engineering manager", "DevOps engineer"],
  Sales: ["Head of sales", "Account executive", "Regional sales manager", "Sales operations analyst"],
  Operations: ["Head of operations", "Operations manager", "Supply chain analyst", "Facilities lead"],
  Legal: ["General counsel", "Legal counsel", "Compliance officer", "Contracts manager"],
  "Executive Office": ["Chief executive officer", "Chief financial officer", "Chief operating officer", "Executive assistant"],
  "Customer Support": ["Head of support", "Support agent", "Support team lead", "Customer success manager"],
  Procurement: ["Head of procurement", "Procurement manager", "Vendor manager", "Buyer"],
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

let seq = 0;
const id = () => `a${++seq}`;

function build(i: number): Person {
  const department = DEPARTMENTS[i % DEPARTMENTS.length]!;
  const head = i < DEPARTMENTS.length;
  const location = pick(LOCATIONS);
  const first = pick(FIRST);
  const last = pick(LAST);
  const name = `${first} ${last}`;
  const email = `${first}.${last.replace(/\s/g, "")}${i}`.toLowerCase() + "@demoenterprise.com";
  const roles = ROLES[department];
  const role = head ? roles[0]! : roles[1 + Math.floor(r() * (roles.length - 1))]!;
  const managerIdx = head ? (department === "Executive Office" ? null : 7) : i % DEPARTMENTS.length;
  const bias = DEPT_BIAS[department];
  const personal = (r() - 0.5) * 50;
  const propensity = Math.max(0.03, Math.min(0.85, 0.22 + (bias + personal) / 120));

  const vip = head || department === "Executive Office" || r() < 0.03;
  const privileged = vip || (department === "IT" && r() < 0.5) || (department === "Finance" && r() < 0.35);
  const veryAttacked = (vip && r() < 0.55) || r() < 0.08;
  const tags: Tag[] = [];
  if (vip) tags.push("VIP");
  if (privileged) tags.push("Privileged");
  if (veryAttacked) tags.push("Very attacked");

  // Simulations
  const sims: SimEvent[] = [];
  const noSims = r() < 0.03;
  if (!noSims) {
    for (const ch of CHANNELS) {
      const tpl = TEMPLATES.filter((t) => t.channel === ch);
      for (let c = 0; c < CAMPAIGNS[ch]; c++) {
        const tp = pick(tpl);
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
          id: id(), channel: ch, template: tp.name, payload: tp.payload, lure: tp.lure, difficulty: tp.difficulty,
          outcome, reported: r() < repProb, ttcSec: fail ? Math.round(8 + r() * (propensity > 0.35 ? 60 : 280)) : undefined, ageDays: Math.max(1, ageDays),
        });
      }
    }
  }

  // Non-simulation readings (0-100 risk; reporting is 0-100 good)
  const readings: Readings = {};
  const noLearning = r() < 0.04;
  for (const el of ELEMENTS) {
    if (el.category === "Simulations") continue;
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
  if (!noSims) {
    readings["sim-mfa"] = { value: clamp(propensity * 100 + (r() - 0.5) * 30) };
    readings["sim-callback"] = { value: clamp(propensity * 90 + (r() - 0.5) * 30) };
  }

  // Activity timeline
  const activity: Activity[] = sims.map((s) => ({
    id: s.id, type: "Simulation", title: s.template, source: SIM_SOURCE[s.channel], ageDays: s.ageDays, sim: s,
    detail: s.outcome === "Passed" ? (s.reported ? "Reported" : "No action") : s.reported ? `${s.outcome}, then reported` : s.outcome,
  }));
  const threats = Math.floor(r() * 4);
  for (let k = 0; k < threats; k++) {
    const blocked = r() < 0.5;
    activity.push({
      id: id(), type: "Real threat", source: blocked ? "Email Security (ESA)" : "Email Remediator", ageDays: Math.floor(r() * 300) + 1,
      title: blocked ? "Malicious link blocked" : "Reported phish removed", detail: blocked ? "Clicked, blocked at gateway" : "Removed from 14 inboxes",
    });
  }
  for (const tr of ["Phishing fundamentals", "Payment fraud basics", "Safe use of QR codes"].slice(0, 1 + Math.floor(r() * 3))) {
    const done = r() < 0.8;
    activity.push({ id: id(), type: "Training", title: tr, source: "LMS", ageDays: Math.floor(r() * 320) + 1, detail: done ? `Completed, ${60 + Math.floor(r() * 40)}%` : "Overdue" });
  }
  for (const s of sims.filter((x) => x.outcome !== "Passed").slice(0, 3)) {
    activity.push({ id: id(), type: "JIT nudge", title: `${s.channel} lure coaching`, source: "JIT Training", ageDays: Math.max(0, s.ageDays - 1), detail: r() < 0.7 ? "Viewed" : "Not opened" });
  }
  activity.push({ id: id(), type: "Announcement", title: "Acceptable use policy 2026", source: "Announcements", ageDays: 210, detail: r() < 0.85 ? "Acknowledged" : "Not acknowledged" });
  activity.push({ id: id(), type: "Announcement", title: "Deepfake payment fraud alert", source: "Announcements", ageDays: 45, detail: r() < 0.8 ? "Acknowledged" : "Not acknowledged" });
  activity.sort((a, b) => a.ageDays - b.ageDays);

  const osint: Person["osint"] = [];
  if ((readings["exp-breach"]?.value ?? 0) > 55) osint.push({ item: "Work email in a public breach", severity: "High" });
  if ((readings["exp-contact"]?.value ?? 0) > 50) osint.push({ item: "Mobile number listed publicly", severity: "Medium" });
  if ((readings["exp-social"]?.value ?? 0) > 45) osint.push({ item: "Role and manager listed on social profile", severity: "Low" });
  if (vip) osint.push({ item: "Named in press releases", severity: "Medium" });

  const access: Person["access"] = [];
  if (privileged) access.push({ item: department === "IT" ? "Domain admin on 3 systems" : "Admin on finance platform", level: "High" });
  if ((readings["prv-fin"]?.value ?? 0) > 60) access.push({ item: "Payment approval up to ₹ 50 L", level: "High" });
  if ((readings["prv-shared"]?.value ?? 0) > 50) access.push({ item: "Owner of 2 shared mailboxes", level: "Medium" });
  if (vip) access.push({ item: "Board and leadership network", level: "Medium" });
  if (!access.length) access.push({ item: "Standard user access", level: "Low" });

  const knowledge = clamp(100 - (readings["lrn-assess"]?.value ?? 50) + (r() - 0.5) * 10);
  const drift = (r() - 0.35) * 0.04;

  return {
    id: `p${String(i + 1).padStart(3, "0")}`, name, email, role, department, location,
    managerId: managerIdx === null ? null : `p${String(managerIdx + 1).padStart(3, "0")}`,
    tags, readings, sims, activity, osint, access, knowledge, drift,
  };
}

export const PEOPLE: Person[] = Array.from({ length: 250 }, (_, i) => build(i));
export { LURES };
