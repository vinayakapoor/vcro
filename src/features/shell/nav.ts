import {
  Home, Sparkles, Users, Workflow, FileBarChart, Gauge, Fish, Megaphone, GraduationCap, PenTool, Zap, ShieldCheck, MailWarning,
  Target, MessageSquare, Trophy, LayoutDashboard, Settings, type LucideIcon,
} from "lucide-react";

export type PlatformItem = { slug: string; label: string; icon: LucideIcon };

const P = (slug: string, label: string, icon: LucideIcon): PlatformItem => ({ slug, label, icon });

export const BEFORE_VCRO: PlatformItem[] = [
  P("home", "Home", Home), P("ask-hf-ai", "Ask HF AI", Sparkles), P("recipients", "Recipients", Users),
  P("workflows", "Workflows", Workflow), P("executive-reports", "Executive Reports", FileBarChart),
];
export const AFTER_VCRO: PlatformItem[] = [
  P("phishing", "Phishing", Fish), P("announcements", "Announcements", Megaphone), P("lms", "LMS", GraduationCap),
  P("content-studio", "Content Studio", PenTool), P("jit-training", "JIT Training", Zap), P("email-security", "Email Security (ESA)", ShieldCheck),
  P("email-remediator", "Email Remediator", MailWarning), P("phishtrainer", "PhishTrainer", Target), P("feedback", "Feedback", MessageSquare),
  P("gamification", "Gamification", Trophy), P("user-portal", "User Portal", LayoutDashboard), P("settings", "Settings", Settings),
];
export const PLATFORM_PAGES: Record<string, string> = Object.fromEntries([...BEFORE_VCRO, ...AFTER_VCRO].map((i) => [i.slug, i.label]));

export const VCRO_ICON = Gauge;

/** vCRO sub-pages that have their own route file. */
export const VCRO_BUILT = [
  { to: "/vcro/riskometer", label: "Riskometer" },
  { to: "/vcro/people", label: "People" },
  { to: "/vcro/watchlists", label: "Watchlists" },
  { to: "/vcro/signals", label: "Signals" },
] as const;

/** vCRO sub-pages served by the shared /vcro/$page route. */
export const VCRO_PAGES: Record<string, string> = {
  weightage: "Weightage",
  reports: "Reports",
  settings: "Settings",
};

export const VCRO_ORDER: { label: string; to: string; page?: string }[] = [
  { label: "Getting started", to: "/vcro/getting-started" },
  { label: "Riskometer", to: "/vcro/riskometer" },
  { label: "People", to: "/vcro/people" },
  { label: "Departments", to: "/vcro/departments" },
  { label: "Watchlists", to: "/vcro/watchlists" },
  { label: "Signals", to: "/vcro/signals" },
  { label: "Weightage", to: "/vcro/$page", page: "weightage" },
  { label: "Reports", to: "/vcro/$page", page: "reports" },
  { label: "Settings", to: "/vcro/$page", page: "settings" },
];
