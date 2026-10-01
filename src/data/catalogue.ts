import type { Channel, ElementDef, Lure, Payload } from "@/lib/scoring";

export type IntegrationCategory = "Identity" | "Endpoint" | "Data" | "Web" | "Email" | "HR" | "OSINT" | "AI identities";
/** Signal in: data that feeds the score. Action out: the score drives a control in another system. */
export type Direction = "Signal in" | "Action out";

export type Source = {
  id: string;
  name: string;
  kind: "Module" | "Integration";
  category?: IntegrationCategory;
  defaultConnected: boolean;
  lastSync: string;
  events30d: number;
};

export const SOURCES: Source[] = [
  { id: "phishing", name: "Phishing", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:44", events30d: 6420 },
  { id: "vishing", name: "Vishing", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:31", events30d: 1180 },
  { id: "smishing", name: "Smishing", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:31", events30d: 1530 },
  { id: "qr", name: "QR", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:31", events30d: 980 },
  { id: "deepfake", name: "Deepfake", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 09:50", events30d: 310 },
  { id: "phishtrainer", name: "PhishTrainer", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:12", events30d: 2240 },
  { id: "lms", name: "LMS", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:40", events30d: 4870 },
  { id: "jit", name: "JIT Training", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:38", events30d: 1460 },
  { id: "announcements", name: "Announcements", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 08:00", events30d: 5110 },
  { id: "esa", name: "Email Security (ESA)", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:44", events30d: 18900 },
  { id: "remediator", name: "Email Remediator", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:43", events30d: 2730 },
  { id: "feedback", name: "Feedback", kind: "Module", defaultConnected: true, lastSync: "30 Sep, 18:00", events30d: 890 },
  { id: "gamification", name: "Gamification", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:00", events30d: 3320 },
  { id: "recipients", name: "Recipients", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 06:00", events30d: 5200 },
  { id: "int-identity", name: "Identity provider", kind: "Integration", category: "Identity", defaultConnected: false, lastSync: "", events30d: 0 },
  { id: "int-endpoint", name: "Endpoint protection", kind: "Integration", category: "Endpoint", defaultConnected: false, lastSync: "", events30d: 0 },
  { id: "int-data", name: "Data loss prevention", kind: "Integration", category: "Data", defaultConnected: false, lastSync: "", events30d: 0 },
  { id: "int-web", name: "Secure web gateway", kind: "Integration", category: "Web", defaultConnected: false, lastSync: "", events30d: 0 },
  { id: "int-email", name: "Email gateway", kind: "Integration", category: "Email", defaultConnected: false, lastSync: "", events30d: 0 },
  { id: "int-hr", name: "HR system", kind: "Integration", category: "HR", defaultConnected: true, lastSync: "1 Oct, 06:00", events30d: 140 },
  { id: "int-osint", name: "OSINT monitoring", kind: "Integration", category: "OSINT", defaultConnected: true, lastSync: "30 Sep, 23:00", events30d: 410 },
  { id: "int-ai", name: "AI agents and copilots", kind: "Integration", category: "AI identities", defaultConnected: false, lastSync: "", events30d: 0 },
];

const e = (id: string, name: string, pillar: ElementDef["pillar"], category: string, sourceId: string): ElementDef => ({
  id, name, pillar, category, sourceId,
});

export const ELEMENTS: ElementDef[] = [
  e("sim-email", "Email phishing", "Behaviour", "Simulations", "phishing"),
  e("sim-vish", "AI voice vishing", "Behaviour", "Simulations", "vishing"),
  e("sim-smish", "Smishing", "Behaviour", "Simulations", "smishing"),
  e("sim-qr", "QR phishing", "Behaviour", "Simulations", "qr"),
  e("sim-deepfake", "Deepfake", "Behaviour", "Simulations", "deepfake"),
  e("sim-callback", "Callback phishing", "Behaviour", "Simulations", "vishing"),
  e("sim-mfa", "MFA fatigue", "Behaviour", "Simulations", "phishing"),
  e("sim-repeat", "Repeat failure", "Behaviour", "Simulations", "phishing"),
  e("inc-click", "Real malicious email clicked", "Behaviour", "Real-world incidents", "esa"),
  e("inc-attach", "Malicious attachment", "Behaviour", "Real-world incidents", "esa"),
  e("inc-web", "Blocked web visits", "Behaviour", "Real-world incidents", "int-web"),
  e("inc-edr", "Endpoint alerts", "Behaviour", "Real-world incidents", "int-endpoint"),
  e("inc-dlp", "DLP events", "Behaviour", "Real-world incidents", "int-data"),
  e("inc-genai", "Unsanctioned GenAI use", "Behaviour", "Real-world incidents", "int-web"),
  e("inc-signin", "Risky sign-ins", "Behaviour", "Real-world incidents", "int-identity"),
  e("lrn-complete", "Training completion", "Behaviour", "Learning", "lms"),
  e("lrn-overdue", "Overdue training", "Behaviour", "Learning", "lms"),
  e("lrn-assess", "Assessment scores", "Behaviour", "Learning", "lms"),
  e("lrn-jit", "JIT nudge response", "Behaviour", "Learning", "jit"),
  e("lrn-pt", "PhishTrainer accuracy", "Behaviour", "Learning", "phishtrainer"),
  e("cul-survey", "Attitude survey", "Behaviour", "Culture", "feedback"),
  e("cul-policy", "Policy acknowledgement", "Behaviour", "Culture", "announcements"),
  e("att-confidence", "Check-in: confidence spotting scams", "Behaviour", "Attitude", "feedback"),
  e("att-report", "Check-in: willingness to report", "Behaviour", "Attitude", "feedback"),
  e("att-pressure", "Check-in: work pressure", "Behaviour", "Attitude", "feedback"),
  e("rep-sim", "Simulations reported", "Reporting", "Reporting", "phishing"),
  e("rep-real", "Real threats reported", "Reporting", "Reporting", "remediator"),
  e("rep-acc", "Report accuracy", "Reporting", "Reporting", "remediator"),
  e("rep-time", "Time to report", "Reporting", "Reporting", "gamification"),
  e("exp-inbound", "Inbound phishing volume", "Exposure", "Targeting", "esa"),
  e("exp-vip", "VIP target", "Exposure", "Targeting", "recipients"),
  e("exp-breach", "Breached credentials", "Exposure", "Human OSINT", "int-osint"),
  e("exp-contact", "Public contact exposure", "Exposure", "Human OSINT", "int-osint"),
  e("exp-social", "Social footprint", "Exposure", "Human OSINT", "int-osint"),
  e("exp-external", "External-facing role", "Exposure", "Role visibility", "recipients"),
  e("exp-joiner", "Joiner or mover", "Exposure", "Role visibility", "int-hr"),
  e("prv-admin", "Admin accounts", "Privilege", "Access and admin", "int-identity"),
  e("prv-critical", "Critical systems accessed", "Privilege", "Access and admin", "int-identity"),
  e("prv-mfa", "MFA strength", "Privilege", "Access and admin", "int-identity"),
  e("prv-shared", "Shared mailbox ownership", "Privilege", "Access and admin", "recipients"),
  e("prv-fin", "Financial authority", "Privilege", "Financial authority", "recipients"),
  e("prv-data", "Sensitive data access", "Privilege", "Data access", "int-data"),
  e("prv-senior", "Seniority", "Privilege", "Seniority and network centrality", "recipients"),
  e("prv-network", "Network centrality", "Privilege", "Seniority and network centrality", "recipients"),
];

/**
 * Connector categories designed into the model but not yet shipped. They carry no weight and do not
 * affect confidence until they move into SOURCES and ELEMENTS.
 */
export type PlannedConnector = { id: string; name: string; category: string; direction: Direction; adds: string[] };
export const PLANNED_CONNECTORS: PlannedConnector[] = [
  { id: "plan-collab", name: "Collaboration and chat", category: "Collaboration", direction: "Signal in", adds: ["Chat phishing clicked", "Chat phishing reported", "External guest sharing"] },
  { id: "plan-browser", name: "Managed browser", category: "Browser", direction: "Signal in", adds: ["Risky extensions", "Sensitive data pasted into GenAI", "Password reuse on unknown sites"] },
  { id: "plan-password", name: "Password manager", category: "Identity", direction: "Signal in", adds: ["Weak or reused passwords", "Vault adoption"] },
  { id: "plan-pam", name: "Privileged access management", category: "Identity", direction: "Signal in", adds: ["Standing privilege", "Privileged session anomalies"] },
  { id: "plan-mdm", name: "Device management", category: "Endpoint", direction: "Signal in", adds: ["Device compliance", "Unpatched personal devices"] },
  { id: "plan-agents", name: "AI agent inventory", category: "AI identities", direction: "Signal in", adds: ["Agents owned per person", "Agent permissions", "Agent prompt-injection test results"] },
  { id: "plan-third", name: "Contractor and third-party directory", category: "HR", direction: "Signal in", adds: ["Contractor flag", "Access outliving contract"] },
  { id: "plan-access", name: "Conditional access", category: "Identity", direction: "Action out", adds: ["Step-up sign-in for High and Critical people", "Session limits for watchlists"] },
  { id: "plan-mailpolicy", name: "Email policy", category: "Email", direction: "Action out", adds: ["Stricter filtering for very attacked people", "External sender banners by risk band"] },
  { id: "plan-siem", name: "SIEM and SOAR", category: "Security operations", direction: "Action out", adds: ["Score and band on every alert", "Score change events"] },
  { id: "plan-itsm", name: "Ticketing", category: "Security operations", direction: "Action out", adds: ["Ticket per approved action", "Evidence attached on close"] },
  { id: "plan-api", name: "Score API and BI export", category: "Data", direction: "Action out", adds: ["Scores by person, team and department", "Scheduled warehouse export"] },
];

/** Which simulation channel feeds each simulation element. */
export const SIM_ELEMENT_CHANNEL: Record<string, Channel> = {
  "sim-email": "Email", "sim-vish": "Voice", "sim-smish": "SMS", "sim-qr": "QR", "sim-deepfake": "Deepfake",
};

export type Template = { id: string; name: string; channel: Channel; payload: Payload; difficulty: number; lure: Lure };
const t = (id: string, name: string, channel: Channel, payload: Payload, difficulty: number, lure: Lure): Template => ({ id, name, channel, payload, difficulty, lure });

export const TEMPLATES: Template[] = [
  t("t1", "Payroll portal update", "Email", "Data Entry", 2, "Urgency"),
  t("t2", "Courier delivery notice", "Email", "Link", 1, "Curiosity"),
  t("t3", "Shared invoice for approval", "Email", "Attachment", 3, "Authority"),
  t("t4", "Annual bonus letter", "Email", "Link", 2, "Reward"),
  t("t5", "Mailbox storage warning", "Email", "Data Entry", 1, "Fear"),
  t("t6", "Team lunch poll", "Email", "Link", 4, "Familiarity"),
  t("t7", "Vendor bank detail change", "Email", "Attachment", 5, "Authority"),
  t("t8", "IT helpdesk password reset call", "Voice", "Data Entry", 3, "Authority"),
  t("t9", "Bank fraud alert call", "Voice", "Data Entry", 2, "Fear"),
  t("t10", "Travel desk callback", "Voice", "Link", 4, "Familiarity"),
  t("t11", "Parcel held at customs", "SMS", "Link", 1, "Urgency"),
  t("t12", "Reward points expiring", "SMS", "Link", 2, "Reward"),
  t("t13", "Account locked notice", "SMS", "Data Entry", 3, "Fear"),
  t("t14", "Parking permit renewal", "QR", "QR Code", 2, "Urgency"),
  t("t15", "Canteen feedback poster", "QR", "QR Code", 3, "Curiosity"),
  t("t16", "Wi-Fi access card", "QR", "QR Code", 4, "Familiarity"),
  t("t17", "CFO video payment request", "Deepfake", "Data Entry", 5, "Authority"),
  t("t18", "Leadership voice note", "Deepfake", "Link", 4, "Urgency"),
];

export const DEPARTMENTS = [
  "Finance", "HR", "IT", "Engineering", "Sales", "Operations", "Legal", "Executive Office", "Customer Support", "Procurement",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const LOCATIONS = ["Gurugram", "Mumbai", "Bengaluru", "Dubai", "Abu Dhabi"] as const;

export const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
export const TODAY = new Date(Date.UTC(2026, 9, 1));

export const TENANT = "Demo Enterprise";
export const TOTAL_EMPLOYEES = 5200;
export const HEADCOUNT: Record<Department, number> = {
  Finance: 420, HR: 260, IT: 380, Engineering: 1150, Sales: 860, Operations: 720, Legal: 110,
  "Executive Office": 60, "Customer Support": 940, Procurement: 300,
};

export const INTERVENTIONS: { month: string; label: string }[] = [
  { month: "Mar", label: "Vishing drill" },
  { month: "Jun", label: "QR campaign" },
  { month: "Aug", label: "Reporter Button rollout" },
];

/** Industry benchmark (sample) range per month. */
export const BENCHMARK: [number, number][] = MONTHS.map((_, i) => [36 - Math.round(i * 0.3), 50 - Math.round(i * 0.4)]);

export const WORKFLOWS = [
  "Repeat clicker remediation",
  "Credential submitter reset",
  "Vishing awareness drill",
  "QR safety micro-module",
  "VIP protection briefing",
  "Overdue training reminder",
] as const;
