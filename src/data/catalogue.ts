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
  auth?: "OAuth" | "API key" | "SCIM and API key" | "Webhook" | "Log stream" | "Issued key";
  /** Products this connector supports. The admin picks theirs during setup. */
  vendors?: string[];
  /** True when the connector usually runs on several feeds at once. */
  multi?: boolean;
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
  { id: "feedback", name: "Surveys", kind: "Module", defaultConnected: true, lastSync: "30 Sep, 18:00", events30d: 890 },
  { id: "gamification", name: "Gamification", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 10:00", events30d: 3320 },
  { id: "recipients", name: "Recipients", kind: "Module", defaultConnected: true, lastSync: "1 Oct, 06:00", events30d: 5200 },
  { id: "int-identity", name: "Identity provider", kind: "Integration", category: "Identity", direction: "Signal in", about: "Sign-in risk, admin roles and MFA strength across every account in the organisation.", auth: "OAuth", vendors: ["Microsoft Entra ID", "Okta", "Google Workspace", "Ping Identity", "OneLogin"], defaultConnected: true, lastSync: "1 Oct, 10:40", events30d: 9400 },
  { id: "int-pam", name: "Privileged access management", kind: "Integration", category: "Identity", direction: "Signal in", about: "Where standing privilege sits in the organisation and how privileged sessions behave.", auth: "API key", vendors: ["CyberArk", "BeyondTrust", "Delinea"], defaultConnected: false, lastSync: "", events30d: 620 },
  { id: "int-password", name: "Password manager", kind: "Integration", category: "Identity", direction: "Signal in", about: "Password health across the organisation, and vault adoption by team.", auth: "API key", vendors: ["1Password", "Keeper", "LastPass", "Bitwarden"], defaultConnected: false, lastSync: "", events30d: 1480 },
  { id: "int-endpoint", name: "Endpoint protection", kind: "Integration", category: "Endpoint", direction: "Signal in", about: "Malware and risky-action alerts from every managed device.", auth: "API key", vendors: ["CrowdStrike Falcon", "Microsoft Defender for Endpoint", "SentinelOne", "Sophos"], defaultConnected: true, lastSync: "1 Oct, 10:42", events30d: 2150 },
  { id: "int-mdm", name: "Device management", kind: "Integration", category: "Endpoint", direction: "Signal in", about: "Compliance and patch levels across every enrolled device.", auth: "OAuth", vendors: ["Microsoft Intune", "Jamf", "Workspace ONE"], defaultConnected: false, lastSync: "", events30d: 5200 },
  { id: "int-data", name: "Data security", kind: "Integration", category: "Data", direction: "Signal in", about: "Data-handling events, and where access to sensitive data is concentrated.", auth: "API key", vendors: ["Microsoft Purview", "Varonis", "Netskope", "Forcepoint"], defaultConnected: false, lastSync: "", events30d: 1730 },
  { id: "int-web", name: "Secure web gateway", kind: "Integration", category: "Web", direction: "Signal in", about: "Blocked sites and unsanctioned GenAI use across the organisation.", auth: "Log stream", vendors: ["Zscaler", "Netskope", "Cisco Umbrella", "Prisma Access"], defaultConnected: true, lastSync: "1 Oct, 10:44", events30d: 12800 },
  { id: "int-browser", name: "Managed browser", kind: "Integration", category: "Browser", direction: "Signal in", about: "Risky extensions, data pasted into GenAI and password reuse, seen in managed browsers.", auth: "OAuth", vendors: ["Chrome Enterprise", "Microsoft Edge for Business", "Island"], defaultConnected: false, lastSync: "", events30d: 7300 },
  { id: "int-email", name: "Email gateway", kind: "Integration", category: "Email", direction: "Signal in", about: "Impersonation attempts aimed at the organisation and misdirected outbound email.", auth: "API key", vendors: ["Proofpoint", "Mimecast", "Microsoft Defender for Office 365", "Abnormal"], defaultConnected: false, lastSync: "", events30d: 16400 },
  { id: "int-collab", name: "Collaboration and chat", kind: "Integration", category: "Collaboration", direction: "Signal in", about: "Phishing clicked and reported in chat, and risky external sharing across workspaces.", auth: "OAuth", vendors: ["Microsoft Teams", "Slack", "Google Chat"], defaultConnected: false, lastSync: "", events30d: 3900 },
  { id: "int-hr", name: "HR system", kind: "Integration", category: "HR", direction: "Signal in", about: "Org chart, departments, joiners, movers, leavers and contractors.", auth: "SCIM and API key", vendors: ["Workday", "SAP SuccessFactors", "Oracle HCM", "Bayzat", "BambooHR"], defaultConnected: true, lastSync: "1 Oct, 06:00", events30d: 140 },
  { id: "int-osint", name: "OSINT monitoring", kind: "Integration", category: "OSINT", direction: "Signal in", about: "What an attacker can find: breached credentials from breach-data feeds, and public contact details and social footprint from a web and social scan.", auth: "API key", multi: true, vendors: ["HumanFirewall web and social scan", "Have I Been Pwned", "SpyCloud", "Recorded Future", "Flashpoint"], defaultConnected: true, lastSync: "30 Sep, 23:00", events30d: 410 },
  { id: "int-ai", name: "AI agents and copilots", kind: "Integration", category: "AI identities", direction: "Signal in", about: "The AI agents in use across the organisation, what they can reach and who has reviewed them.", auth: "OAuth", vendors: ["Microsoft Entra Agent ID", "Microsoft Copilot Studio", "Custom agent registry"], defaultConnected: false, lastSync: "", events30d: 880 },
  { id: "out-access", name: "Conditional access", kind: "Integration", category: "Identity", direction: "Action out", about: "Keep directory groups in step with the score, so your own access policies act on them.", auth: "OAuth", vendors: ["Microsoft Entra ID", "Okta"], defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "stepup", name: "High risk group", detail: "Keep a directory group of High and Critical people. Your step-up sign-in policy targets the group.", people: "high" }, { id: "session", name: "Very attacked VIP group", detail: "Keep a directory group of very attacked VIPs for shorter sessions or stricter device rules.", people: "vipAttacked" }] },
  { id: "out-mailpolicy", name: "Email policy", kind: "Integration", category: "Email", direction: "Action out", about: "Stricter mail filtering for the groups that are attacked most.", auth: "API key", vendors: ["Microsoft Exchange Online", "Proofpoint", "Mimecast"], defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "filter", name: "Strict filtering group", detail: "Keep the group your strict mail-filtering policy applies to in step with very attacked VIPs.", people: "vipAttacked" }, { id: "banner", name: "External sender banner group", detail: "Keep the group that sees the external-sender warning in step with High and Critical people.", people: "high" }] },
  { id: "out-siem", name: "SIEM and SOAR", kind: "Integration", category: "Security operations", direction: "Action out", about: "Add human risk context to the alerts your SOC already works.", auth: "Webhook", vendors: ["Microsoft Sentinel", "Splunk", "IBM QRadar", "Google Security Operations"], defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "enrich", name: "Risk list for enrichment", detail: "Keep a live list of score, band and tags in your SIEM, so analysts see it on every alert.", people: "all" }, { id: "events", name: "Score change events", detail: "Send an event when someone enters High or Critical.", people: "high" }] },
  { id: "out-itsm", name: "Ticketing", kind: "Integration", category: "Security operations", direction: "Action out", about: "A ticket for every approved action, closed with evidence.", auth: "API key", vendors: ["ServiceNow", "Jira Service Management", "Freshservice"], defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "ticket", name: "Ticket per action", detail: "Open a ticket when a recommended action is approved.", people: "actions" }, { id: "evidence", name: "Evidence on close", detail: "Read the ticket status back and attach the before and after score when it closes.", people: "actions" }] },
  { id: "out-api", name: "Score API and BI export", kind: "Integration", category: "Data", direction: "Action out", about: "Organisation, department and team scores for your own dashboards and warehouse.", auth: "Issued key", vendors: ["REST API", "Snowflake", "Google BigQuery", "Amazon S3", "Microsoft Power BI"], defaultConnected: false, lastSync: "", events30d: 0,
    controls: [{ id: "api", name: "Score API", detail: "Organisation, department, team and person scores on request.", people: "all" }, { id: "export", name: "Scheduled export", detail: "Nightly export of every score to your warehouse or BI tool.", people: "all" }] },
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
  e("cul-survey", "Security culture survey", "Behaviour", "Culture", "feedback"),
  e("cul-policy", "Policy acknowledgement", "Behaviour", "Culture", "announcements"),
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
  e("hyg-password", "Poor password health", "Behaviour", "Security hygiene", "int-password"),
  e("hyg-vault", "Password vault not adopted", "Behaviour", "Security hygiene", "int-password"),
  e("hyg-device", "Non-compliant device", "Behaviour", "Security hygiene", "int-mdm"),
  e("hyg-patch", "Unpatched device", "Behaviour", "Security hygiene", "int-mdm"),
  e("hyg-ext", "Risky browser extensions", "Behaviour", "Security hygiene", "int-browser"),
  e("hyg-reuse", "Password reuse on unknown sites", "Behaviour", "Security hygiene", "int-browser"),
  e("inc-paste", "Sensitive data pasted into GenAI", "Behaviour", "Real-world incidents", "int-browser"),
  e("inc-chat", "Chat phishing clicked", "Behaviour", "Real-world incidents", "int-collab"),
  e("inc-share", "Risky external sharing", "Behaviour", "Real-world incidents", "int-collab"),
  e("inc-misdirect", "Misdirected email", "Behaviour", "Real-world incidents", "int-email"),
  e("rep-chat", "Chat phishing reported", "Reporting", "Reporting", "int-collab"),
  e("exp-imperson", "Impersonation attempts", "Exposure", "Targeting", "int-email"),
  e("exp-contractor", "Contractor or third party", "Exposure", "Role visibility", "int-hr"),
  e("prv-standing", "Standing privilege", "Privilege", "Access and admin", "int-pam"),
  e("prv-session", "Privileged session anomalies", "Privilege", "Access and admin", "int-pam"),
  e("prv-outlive", "Access outliving contract", "Privilege", "Access and admin", "int-hr"),
  e("ai-owned", "AI agents owned", "Privilege", "AI agents", "int-ai"),
  e("ai-perms", "Agent permissions", "Privilege", "AI agents", "int-ai"),
  e("ai-inject", "Agent access not reviewed", "Privilege", "AI agents", "int-ai"),
];

/** How each signal turns raw data into a 0 to 100 value. Higher is riskier unless it says credit. */
export const SIGNAL_HOW: Record<string, string> = {
  "sim-email": "Results of the most recent email simulations in your simulation window. A click or scan scores 3, entering data or enabling an attachment scores 6, harder templates count less, and reporting takes points off. Older results fade with the signal half-life.",
  "sim-vish": "Results of the most recent voice simulations in your simulation window. A click or scan scores 3, entering data or enabling an attachment scores 6, harder templates count less, and reporting takes points off. Older results fade with the signal half-life.",
  "sim-smish": "Results of the most recent SMS simulations in your simulation window. A click or scan scores 3, entering data or enabling an attachment scores 6, harder templates count less, and reporting takes points off. Older results fade with the signal half-life.",
  "sim-qr": "Results of the most recent QR simulations in your simulation window. A click or scan scores 3, entering data or enabling an attachment scores 6, harder templates count less, and reporting takes points off. Older results fade with the signal half-life.",
  "sim-deepfake": "Results of the most recent deepfake simulations in your simulation window. A click or scan scores 3, entering data or enabling an attachment scores 6, harder templates count less, and reporting takes points off. Older results fade with the signal half-life.",
  "sim-callback": "Share of callback simulations where the person rang the number and gave information.",
  "sim-mfa": "Share of MFA fatigue simulations where the person approved a sign-in prompt they did not start.",
  "sim-repeat": "0 for one failure or none in 180 days, then 25 points for each further failure, up to 100.",
  "inc-click": "Real malicious links clicked in 180 days, from Email Security. Each click raises the value and fades with the half-life.",
  "inc-attach": "Real malicious attachments opened in 180 days, from Email Security.",
  "inc-web": "Visits to blocked categories per month against the organisation's norm. Twice the norm or more reads as 100.",
  "inc-edr": "Malware and risky-action alerts on the person's devices in 180 days, weighted by severity.",
  "inc-dlp": "Data-handling policy events in 180 days, weighted by severity.",
  "inc-genai": "Use of GenAI tools that are not on your approved list, by number of days used in the last 30.",
  "inc-signin": "Sign-ins the identity provider flagged as risky in 90 days, weighted by its own risk level.",
  "lrn-complete": "Share of assigned training not completed. All done reads as 0.",
  "lrn-overdue": "Days the oldest assigned course is overdue. 60 days or more reads as 100.",
  "lrn-assess": "100 minus the average assessment mark across completed courses.",
  "lrn-jit": "Share of just-in-time nudges not opened within 7 days.",
  "lrn-pt": "Share of PhishTrainer practice emails judged wrongly.",
  "cul-survey": "Latest culture survey answers on a five-point scale, turned into 0 to 100. Lower agreement with secure habits reads higher.",
  "cul-policy": "Share of published policies not yet acknowledged.",
  "rep-sim": "Share of simulations the person reported. This is a credit: higher takes points off the score.",
  "rep-real": "Real threats reported in 180 days against the organisation's norm. A credit.",
  "rep-acc": "Share of the person's reports that were real threats or simulations, not safe email. A credit.",
  "rep-time": "How quickly the person reports after delivery. Under 5 minutes reads as 100. A credit.",
  "exp-inbound": "Phishing aimed at the person in 30 days against the organisation's norm.",
  "exp-vip": "100 for people tagged VIP, 0 otherwise.",
  "exp-breach": "Breaches the work email appears in, weighted by how recent and whether a password was exposed.",
  "exp-contact": "Whether a work phone number or personal email is findable in public sources.",
  "exp-social": "How much role, reporting line and project detail is visible on public profiles.",
  "exp-external": "How much of the role is outward-facing, from job family: sales, support, recruiting and procurement read higher.",
  "exp-joiner": "High for the first 90 days after joining or changing role, then fades to 0.",
  "prv-admin": "Number and scope of admin roles held, from the identity provider.",
  "prv-critical": "Sign-ins to the applications you marked as critical, in 90 days.",
  "prv-mfa": "Strength of the person's strongest MFA method. Phishing-resistant reads 0, SMS reads high, none reads 100.",
  "prv-shared": "Shared mailboxes the person owns or has full access to.",
  "prv-fin": "Payment approval limit and ability to change bank details, from the role and finance approver lists.",
  "prv-data": "Volume of sensitive-labelled data the person can open.",
  "prv-senior": "Job level, from the directory.",
  "prv-network": "How many people report to or work closely with the person, from the org chart.",
  "hyg-password": "The password manager's own health score for the person, inverted so weaker reads higher.",
  "hyg-vault": "100 if the person has not activated their vault, 0 if they use it.",
  "hyg-device": "Share of the person's enrolled devices that are out of compliance.",
  "hyg-patch": "Days the person's least-patched enrolled device is behind. 30 days or more reads as 100.",
  "hyg-ext": "Browser extensions with broad permissions that are not on your approved list.",
  "hyg-reuse": "Times the browser saw the work password typed into another site, in 90 days.",
  "inc-paste": "Times sensitive-labelled data was pasted into a GenAI tool, in 90 days.",
  "inc-chat": "Malicious links clicked in chat in 180 days.",
  "inc-share": "Files shared with external guests or by public link, against the organisation's norm.",
  "inc-misdirect": "Emails the gateway flagged as sent to the wrong recipient, in 180 days.",
  "rep-chat": "Suspicious chat messages reported, against the organisation's norm. A credit.",
  "exp-imperson": "Inbound emails pretending to be this person, in 30 days.",
  "exp-contractor": "High for contractors and vendor staff, 0 for employees.",
  "prv-standing": "Privileged accounts the person holds permanently instead of on request.",
  "prv-session": "Privileged sessions the access-management tool flagged as unusual, in 90 days.",
  "prv-outlive": "Days access has continued past the contract end date. 0 for employees.",
  "ai-owned": "Number of AI agents the person owns or sponsors.",
  "ai-perms": "Breadth of data and tools those agents can reach.",
  "ai-inject": "Share of the person's agents whose access has not been reviewed in 90 days.",
};

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

export const LOCATIONS = ["Dubai", "Abu Dhabi", "Riyadh", "Jeddah", "Doha"] as const;

export const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
export const TODAY = new Date(Date.UTC(2026, 9, 1));

export const TENANT = "Demo Enterprise";

/** Peer figures for the tenant's benchmark group, refreshed monthly from organisations in the same sector and region. */
export const BENCHMARK = {
  group: "Banking and financial services, GCC",
  organisations: 38,
  asOf: "September 2026",
  median: { score: 31, reportRate: 34, failRate: 24, completion: 63, highShare: 2.1 },
  best: { score: 22, reportRate: 52, failRate: 14, completion: 82, highShare: 0.6 },
};

/** Awareness and human-risk controls in the frameworks customers in the region are audited against. */
export type Evidence = "training" | "simulation" | "reporting" | "policy" | "privileged" | "measurement" | "joiners";
export const FRAMEWORKS: { id: string; name: string; body: string; controls: { ref: string; title: string; evidence: Evidence[] }[] }[] = [
  { id: "uae-ia", name: "UAE Information Assurance Regulation", body: "UAE Cybersecurity Council", controls: [
    { ref: "M3.1", title: "Awareness and training policy", evidence: ["policy"] },
    { ref: "M3.2", title: "Awareness and training programme", evidence: ["training", "simulation"] },
    { ref: "M3.3", title: "Training needs", evidence: ["measurement", "privileged"] },
    { ref: "M3.4", title: "Awareness campaigns", evidence: ["simulation", "reporting"] },
  ] },
  { id: "nca-ecc", name: "Saudi NCA Essential Cybersecurity Controls", body: "National Cybersecurity Authority", controls: [
    { ref: "1-10-1", title: "Awareness programme defined and approved", evidence: ["policy"] },
    { ref: "1-10-2", title: "Awareness programme implemented", evidence: ["training", "simulation"] },
    { ref: "1-10-3", title: "Programme covers current threats, including phishing and social engineering", evidence: ["simulation", "reporting"] },
    { ref: "1-10-4", title: "Specialised training for privileged and sensitive roles", evidence: ["privileged"] },
    { ref: "1-10-5", title: "Programme reviewed periodically", evidence: ["measurement"] },
  ] },
  { id: "sama-csf", name: "SAMA Cyber Security Framework", body: "Saudi Central Bank", controls: [
    { ref: "3.1.6", title: "Cyber security awareness", evidence: ["simulation", "reporting", "measurement"] },
    { ref: "3.1.7", title: "Cyber security training", evidence: ["training", "privileged", "joiners"] },
  ] },
  { id: "iso-27001", name: "ISO/IEC 27001:2022", body: "ISO", controls: [
    { ref: "A.6.3", title: "Information security awareness, education and training", evidence: ["training", "simulation", "measurement"] },
    { ref: "A.6.8", title: "Information security event reporting", evidence: ["reporting"] },
    { ref: "A.5.10", title: "Acceptable use of information and other associated assets", evidence: ["policy"] },
  ] },
  { id: "nist-csf", name: "NIST Cybersecurity Framework 2.0", body: "NIST", controls: [
    { ref: "PR.AT-01", title: "Personnel are provided awareness and training", evidence: ["training", "simulation"] },
    { ref: "PR.AT-02", title: "People in specialised roles are provided awareness and training", evidence: ["privileged"] },
  ] },
];
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

export const WORKFLOWS = [
  "Repeat clicker remediation",
  "Credential submitter reset",
  "Vishing awareness drill",
  "QR safety micro-module",
  "VIP protection briefing",
  "Overdue training reminder",
] as const;
