import type { Channel, ElementDef, Lure, Payload } from "@/lib/scoring";

export type IntegrationCategory = "Identity" | "Endpoint" | "Data" | "Web" | "Email" | "HR" | "OSINT" | "AI identities" | "Collaboration" | "Browser" | "Security operations";
/** Signal in: data that feeds the score. Action out: the score drives a control in another system. */
export type Direction = "Signal in" | "Action out";
/** One thing an outbound connector does with the score. `people` is who it applies to. */
export type Control = { id: string; name: string; detail: string; people: "high" | "vipAttacked" | "all" | "actions" };

export type Source = {
  id: string;
  name: string;
  kind: "Module" | "Integration";
  category?: IntegrationCategory;
  direction?: Direction;
  /** One line on what connecting this gives you. */
  about?: string;
  /** How the connector authenticates. */
  auth?: "OAuth" | "API key" | "SCIM and API key" | "Webhook";
  controls?: Control[];
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
  { id: "int-identity", name: "Identity provider", kind: "Integration", category: "Identity", direction: "Signal in", about: "Sign-in risk, admin roles and MFA strength for every account.", auth: "OAuth", defaultConnected: true, lastSync: "1 Oct, 10:40", events30d: 9400 },
  { id: "int-pam", name: "Privileged access management", kind: "Integration", category: "Identity", direction: "Signal in", about: "Who holds standing privilege and how privileged sessions behave.", auth: "API key", defaultConnected: false, lastSync: "", events30d: 620 },
  { id: "int-password", name: "Password manager", kind: "Integration", category: "Identity", direction: "Signal in", about: "Weak and reused passwords, and who has adopted the vault.", auth: "API key", defaultConnected: false, lastSync: "", events30d: 1480 },
  { id: "int-endpoint", name: "Endpoint protection", kind: "Integration", category: "Endpoint", direction: "Signal in", about: "Malware and risky-action alerts tied to the person at the keyboard.", auth: "API key", defaultConnected: true, lastSync: "1 Oct, 10:42", events30d: 2150 },
  { id: "int-mdm", name: "Device management", kind: "Integration", category: "Endpoint", direction: "Signal in", about: "Whether the devices each person uses are compliant and patched.", auth: "OAuth", defaultConnected: false, lastSync: "", events30d: 5200 },
  { id: "int-data", name: "Data loss prevention", kind: "Integration", category: "Data", direction: "Signal in", about: "Data-handling events and who can reach sensitive data.", auth: "API key", defaultConnected: false, lastSync: "", events30d: 1730 },
  { id: "int-web", name: "Secure web gateway", kind: "Integration", category: "Web", direction: "Signal in", about: "Blocked sites and unsanctioned GenAI use per person.", auth: "API key", defaultConnected: true, lastSync: "1 Oct, 10:44", events30d: 12800 },
  { id: "int-browser", name: "Managed browser", kind: "Integration", category: "Browser", direction: "Signal in", about: "Risky extensions, data pasted into GenAI and password reuse, seen in the browser.", auth: "OAuth", defaultConnected: false, lastSync: "", events30d: 7300 },
  { id: "int-email", name: "Email gateway", kind: "Integration", category: "Email", direction: "Signal in", about: "Impersonation attempts aimed at each person and misdirected outbound email.", auth: "API key", defaultConnected: false, lastSync: "", events30d: 16400 },
  { id: "int-collab", name: "Collaboration and chat", kind: "Integration", category: "Collaboration", direction: "Signal in", about: "Phishing clicked and reported in chat, and risky external sharing.", auth: "OAuth", defaultConnected: false, lastSync: "", events30d: 3900 },
  { id: "int-hr", name: "HR system", kind: "Integration", category: "HR", direction: "Signal in", about: "Org chart, joiners, movers and leavers.", auth: "SCIM and API key", defaultConnected: true, lastSync: "1 Oct, 06:00", events30d: 140 },
  { id: "int-third", name: "Contractor and third-party directory", kind: "Integration", category: "HR", direction: "Signal in", about: "Contractors and vendors with access, and access that outlives a contract.", auth: "SCIM and API key", defaultConnected: false, lastSync: "", events30d: 260 },
  { id: "int-osint", name: "OSINT monitoring", kind: "Integration", category: "OSINT", direction: "Signal in", about: "Breached credentials and what is public about each person.", auth: "API key", defaultConnected: true, lastSync: "30 Sep, 23:00", events30d: 410 },
  { id: "int-ai", name: "AI agents and copilots", kind: "Integration", category: "AI identities", direction: "Signal in", about: "The AI agents each person owns, what those agents can reach and how they hold up to attack.", auth: "OAuth", defaultConnected: false, lastSync: "", events30d: 880 },
  { id: "out-access", name: "Conditional access", kind: "Integration", category: "Identity", direction: "Action out", about: "Tighten sign-in for the people the score says are riskiest.", auth: "OAuth", defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "stepup", name: "Step-up sign-in", detail: "Require stronger sign-in for High and Critical people", people: "high" }, { id: "session", name: "Shorter sessions", detail: "Limit session length for very attacked VIPs", people: "vipAttacked" }] },
  { id: "out-mailpolicy", name: "Email policy", kind: "Integration", category: "Email", direction: "Action out", about: "Stricter mail filtering where the risk is.", auth: "API key", defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "filter", name: "Stricter filtering", detail: "Apply the strict filtering policy to very attacked VIPs", people: "vipAttacked" }, { id: "banner", name: "External sender banner", detail: "Show a warning banner to High and Critical people", people: "high" }] },
  { id: "out-siem", name: "SIEM and SOAR", kind: "Integration", category: "Security operations", direction: "Action out", about: "Put each person's score and band on the alerts your SOC already works.", auth: "Webhook", defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "enrich", name: "Alert enrichment", detail: "Add score, band and tags to every alert about a person", people: "all" }, { id: "events", name: "Score change events", detail: "Send an event when someone enters High or Critical", people: "high" }] },
  { id: "out-itsm", name: "Ticketing", kind: "Integration", category: "Security operations", direction: "Action out", about: "A ticket for every approved action, closed with evidence.", auth: "API key", defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "ticket", name: "Ticket per action", detail: "Open a ticket when a recommended action is approved", people: "actions" }, { id: "evidence", name: "Evidence on close", detail: "Attach the before and after score when the ticket closes", people: "actions" }] },
  { id: "out-api", name: "Score API and BI export", kind: "Integration", category: "Data", direction: "Action out", about: "Scores for your own dashboards and warehouse.", auth: "API key", defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "api", name: "Score API", detail: "Scores by person, team and department on request", people: "all" }, { id: "export", name: "Scheduled export", detail: "Nightly export of every score to your warehouse", people: "all" }] },
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
  e("hyg-password", "Weak or reused passwords", "Behaviour", "Security hygiene", "int-password"),
  e("hyg-vault", "Password vault not adopted", "Behaviour", "Security hygiene", "int-password"),
  e("hyg-device", "Non-compliant device", "Behaviour", "Security hygiene", "int-mdm"),
  e("hyg-patch", "Unpatched personal device", "Behaviour", "Security hygiene", "int-mdm"),
  e("hyg-ext", "Risky browser extensions", "Behaviour", "Security hygiene", "int-browser"),
  e("hyg-reuse", "Password reuse on unknown sites", "Behaviour", "Security hygiene", "int-browser"),
  e("inc-paste", "Sensitive data pasted into GenAI", "Behaviour", "Real-world incidents", "int-browser"),
  e("inc-chat", "Chat phishing clicked", "Behaviour", "Real-world incidents", "int-collab"),
  e("inc-share", "Risky external sharing", "Behaviour", "Real-world incidents", "int-collab"),
  e("inc-misdirect", "Misdirected email", "Behaviour", "Real-world incidents", "int-email"),
  e("rep-chat", "Chat phishing reported", "Reporting", "Reporting", "int-collab"),
  e("exp-imperson", "Impersonation attempts", "Exposure", "Targeting", "int-email"),
  e("exp-contractor", "Contractor or third party", "Exposure", "Role visibility", "int-third"),
  e("prv-standing", "Standing privilege", "Privilege", "Access and admin", "int-pam"),
  e("prv-session", "Privileged session anomalies", "Privilege", "Access and admin", "int-pam"),
  e("prv-outlive", "Access outliving contract", "Privilege", "Access and admin", "int-third"),
  e("ai-owned", "AI agents owned", "Privilege", "AI agents", "int-ai"),
  e("ai-perms", "Agent permissions", "Privilege", "AI agents", "int-ai"),
  e("ai-inject", "Agent prompt-injection test results", "Privilege", "AI agents", "int-ai"),
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
