// Report builders. Each returns a complete file: a print-ready HTML document or a CSV.
import { TENANT } from "@/data/catalogue";
import {
  awarenessByDept, deptStats, ELEMENTS, ELEMENT_WEIGHTS, fmt, formatAge, getPeople, orgSummary, pct, PREV_MONTH, pseudonym,
  recommendedActions, signalStats, SOURCES, trends, weakestSignals, type Settings, type SignalState,
} from "./api";
import { BAND_RANGES } from "./scoring";
import { fileDate, toCsv } from "./export";

export type ReportFile = { filename: string; mime: string; content: string };
export type TemplateId = "board" | "monthly" | "dept" | "people" | "audit" | "signals";

const esc = (v: unknown) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const BAND_HEX: Record<string, string> = { Low: "#2e7d5b", Guarded: "#6b9e3f", Elevated: "#c9a227", High: "#d9822b", Critical: "#d7262e", "No score": "#9aa3af" };
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

function page(title: string, body: string) {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | ${esc(TENANT)}</title>
<style>
*{box-sizing:border-box}body{font:14px/1.5 Inter,system-ui,sans-serif;color:#171717;margin:0;background:#fff}
main{max-width:920px;margin:0 auto;padding:40px 32px}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #171717;padding-bottom:12px;margin-bottom:28px}
h1{font-size:26px;margin:0;letter-spacing:-.02em}h2{font-size:15px;margin:32px 0 10px}
.meta{color:#737373;font-size:12px;text-align:right}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi{border:1px solid #e5e5e5;border-radius:10px;padding:12px 14px}
.kpi b{display:block;font-size:22px;letter-spacing:-.02em}.kpi span{font-size:11px;color:#737373;text-transform:uppercase;letter-spacing:.06em}.kpi small{color:#737373}
.hero{display:grid;grid-template-columns:220px 1fr;gap:24px;align-items:center;border:1px solid #e5e5e5;border-radius:12px;padding:20px}
.score{font-size:64px;font-weight:700;line-height:1;letter-spacing:-.04em}
.pill{display:inline-block;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:600;color:#fff}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;font-size:11px;color:#737373;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #d4d4d4;padding:6px 8px}
td{border-bottom:1px solid #eee;padding:7px 8px}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.note{color:#737373;font-size:12px;margin-top:8px}
@media print{main{padding:0}h2{break-after:avoid}table,.hero,.kpis{break-inside:avoid}@page{margin:16mm}}
</style></head><body><main>
<header><div><div style="font-size:12px;color:#737373">${esc(TENANT)} · Human risk</div><h1>${esc(title)}</h1></div><div class="meta">Generated ${today}<br>HumanFirewall vCRO</div></header>
${body}
</main></body></html>`;
}
const pill = (band: string, text?: string) => `<span class="pill" style="background:${BAND_HEX[band]}">${esc(text ?? band)}</span>`;
const table = (head: [string, boolean?][], rows: (string | number)[][]) =>
  `<table><thead><tr>${head.map(([h, n]) => `<th${n ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${head[i]?.[1] ? ' class="n"' : ""}>${typeof c === "number" ? fmt(c) : c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

function trendSvg(points: { month: string; score: number }[]) {
  const W = 620, H = 150, l = 30, b = 22, t = 8;
  const lo = Math.max(0, Math.min(...points.map((p) => p.score)) - 10), hi = Math.min(100, Math.max(...points.map((p) => p.score)) + 10);
  const x = (i: number) => l + (i / (points.length - 1)) * (W - l - 8);
  const y = (v: number) => t + (1 - (v - lo) / (hi - lo || 1)) * (H - t - b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="12 month score trend">
<line x1="${l}" x2="${W - 8}" y1="${y(lo)}" y2="${y(lo)}" stroke="#d4d4d4"/><line x1="${l}" x2="${W - 8}" y1="${y(hi)}" y2="${y(hi)}" stroke="#eee"/>
<text x="${l - 6}" y="${y(lo) + 4}" font-size="10" text-anchor="end" fill="#737373">${lo}</text><text x="${l - 6}" y="${y(hi) + 4}" font-size="10" text-anchor="end" fill="#737373">${hi}</text>
<path d="${d}" fill="none" stroke="#171717" stroke-width="2"/>
${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score)}" r="2.5" fill="#171717"/><text x="${x(i)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#737373">${p.month}</text>`).join("")}
</svg>`;
}

function kpis(s: SignalState) {
  const o = orgSummary(s);
  const items: [string, string, string][] = [
    ["High or Critical", fmt(o.highCount), `${pct(o.highShare)} of ${fmt(o.total)} people`],
    ["Report rate", pct(o.reportRate), `Fail rate ${pct(o.failRate)} in simulations`],
    ["Repeat clickers", fmt(o.repeatCount), "2 or more fails in 180 days"],
    ["Very attacked VIPs", fmt(o.vipAttacked), "Senior and heavily targeted"],
  ];
  return `<div class="kpis">${items.map(([k, v, c]) => `<div class="kpi"><span>${esc(k)}</span><b>${esc(v)}</b><small>${esc(c)}</small></div>`).join("")}</div>`;
}

function hero(s: SignalState) {
  const o = orgSummary(s);
  const range = BAND_RANGES.find((r) => r.band === o.band);
  return `<div class="hero"><div><div class="score">${o.score}</div><div style="margin-top:8px">${pill(o.band)} <span style="font-size:12px;color:#737373">of 100, higher is riskier</span></div></div>
<div><b>${o.change === 0 ? "No change" : `${signed(o.change)} points`} since ${PREV_MONTH}.</b> The organisation sits in the ${esc(o.band)} band${range ? ` (${range.from} to ${range.to})` : ""}.
${fmt(o.scored)} of ${fmt(o.total)} people have a score. Confidence is ${o.confidence}%: ${o.activeCount} of ${o.totalElements} signals are live.</div></div>`;
}

function boardPack(s: SignalState, set: Settings): string {
  const o = orgSummary(s);
  const depts = [...deptStats(s)].sort((a, b) => b.score - a.score);
  const acts = recommendedActions(s, set.automation).slice(0, 5);
  return page("Board pack", `${hero(s)}
<h2>Key figures</h2>${kpis(s)}
<h2>12 month trend</h2>${trendSvg(trends(s).org)}
<h2>What moved the score since ${PREV_MONTH}</h2>${o.drivers.length ? table([["Driver"], ["Change in points", true]], o.drivers.slice(0, 6).map((d) => [esc(d.category), signed(d.delta)])) : '<p class="note">No driver moved by 0.1 points or more.</p>'}
<h2>Departments</h2>${table([["Department"], ["Score", true], ["Band"], ["Change", true], ["People", true], ["High or Critical", true], ["Top driver"]], depts.map((d) => [esc(d.department), d.score, pill(d.band), signed(d.change), d.headcount, d.high, esc(d.topDriver)]))}
<h2>Recommended actions</h2>${table([["Action"], ["Target group"], ["People", true], ["Expected drop per person", true], ["Runs"]], acts.map((a) => [esc(a.action), esc(a.target), a.people, `${a.perPerson} pts`, a.mode]))}
<p class="note">Expected drop is modelled: the score each targeted person would have if the signals this action addresses improved to the level of the best-performing quarter of the organisation.</p>`);
}

function monthly(s: SignalState, set: Settings): string {
  const o = orgSummary(s);
  const depts = [...deptStats(s)].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const movers = o.people.filter((p) => p.change !== null && p.change !== 0).sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!)).slice(0, 15);
  const nm = (p: (typeof movers)[number]) => (set.privacy ? pseudonym(p.id) : p.name);
  return page("Monthly risk summary", `${hero(s)}
<h2>Key figures</h2>${kpis(s)}
<p class="note">${fmt(o.enteredHigh)} people entered High or Critical since ${PREV_MONTH}; ${fmt(o.leftHigh)} left.</p>
<h2>Departments by change</h2>${table([["Department"], [PREV_MONTH, true], ["Now", true], ["Change", true], ["Top driver"]], depts.map((d) => [esc(d.department), d.prev, d.score, signed(d.change), esc(d.topDriver)]))}
<h2>Biggest movers</h2>${movers.length ? table([["Person"], ["Department"], [PREV_MONTH, true], ["Now", true], ["Change", true]], movers.map((p) => [esc(nm(p)), esc(p.department), p.prev!, p.score!, signed(p.change!)])) : '<p class="note">No person moved this month.</p>'}
<h2>Weakest signals</h2>${table([["Signal"], ["Category"], ["Average", true], ["People at 60 or above", true]], weakestSignals(s).slice(0, 10).map((w) => [esc(w.name), esc(w.category), w.avg, w.atRisk]))}`);
}

function deptReport(s: SignalState): string {
  const aw = Object.fromEntries(awarenessByDept(s).map((a) => [a.department, a]));
  const depts = [...deptStats(s)].sort((a, b) => b.score - a.score);
  return page("Department report", `${table(
    [["Department"], ["Score", true], ["Band"], ["Change", true], ["People", true], ["High or Critical", true], ["Top driver"], ["Training complete", true], ["Policy acknowledged", true], ["Report rate", true]],
    depts.map((d) => [esc(d.department), d.score, pill(d.band), signed(d.change), d.headcount, d.high, esc(d.topDriver), `${aw[d.department]!.completion}%`, `${aw[d.department]!.policy}%`, `${aw[d.department]!.reportRate}%`]),
  )}<p class="note">Change is against ${PREV_MONTH}. Report rate is the share of simulations reported.</p>`);
}

export function buildReport(id: TemplateId, s: SignalState, set: Settings): ReportFile {
  const d = fileDate();
  const html = (name: string, content: string): ReportFile => ({ filename: `vcro-${name}-${d}.html`, mime: "text/html", content });
  const csv = (name: string, rows: (string | number | null)[][]): ReportFile => ({ filename: `vcro-${name}-${d}.csv`, mime: "text/csv", content: toCsv(rows) });
  const people = getPeople(s);
  const nm = (p: (typeof people)[number]) => (set.privacy ? pseudonym(p.id) : p.name);
  switch (id) {
    case "board": return html("board-pack", boardPack(s, set));
    case "monthly": return html("monthly-summary", monthly(s, set));
    case "dept": return html("department-report", deptReport(s));
    case "people": return csv("high-risk-people", [
      ["Person", "Department", "Role", "Location", "Score", "Band", `Change since ${PREV_MONTH}`, "Weakest signal", "Tags", "Confidence %"],
      ...people.filter((p) => p.band === "High" || p.band === "Critical").sort((a, b) => b.score! - a.score!)
        .map((p) => [nm(p), p.department, p.role, p.location, p.score, p.band, p.change, p.weakestSignal?.name ?? "", p.tags.join("; "), p.confidence]),
    ]);
    case "audit": return csv("audit-evidence", [
      ["Person", "Department", "Simulations", "Failed", "Reported", "Last simulation", "Training complete", "Training overdue", "Policy acknowledged"],
      ...people.map((p) => {
        const sim = p.channels.reduce((a, c) => ({ n: a.n + c.attempts, f: a.f + c.failures, r: a.r + c.reports }), { n: 0, f: 0, r: 0 });
        const yes = (k: string, good: (v: number) => boolean) => { const v = p.now[k]?.value; return v == null ? "No data" : good(v) ? "Yes" : "No"; };
        return [nm(p), p.department, sim.n, sim.f, sim.r, formatAge(p.lastSimDays), yes("lrn-complete", (v) => v < 50), yes("lrn-overdue", (v) => v > 60), yes("cul-policy", (v) => v < 50)];
      }),
    ]);
    case "signals": {
      const st = signalStats(s);
      return csv("signal-coverage", [
        ["Source", "Type", "Status", "Last sync", "Events in 30 days", "Signal", "Pillar", "Category", "Weight %", "In score"],
        ...ELEMENTS.map((e) => {
          const src = SOURCES.find((x) => x.id === e.sourceId)!;
          const on = s.connected.has(src.id);
          return [src.name, src.kind, on ? "Connected" : "Not connected", on ? src.lastSync : "", on ? src.events30d : 0, e.name, e.pillar, e.category, (ELEMENT_WEIGHTS[e.id]! * 100).toFixed(1), s.active.has(e.id) ? "Yes" : "No"];
        }),
        [], ["Confidence %", st.confidence], ["Signals live", `${st.active} of ${st.total}`],
      ]);
    }
  }
}
