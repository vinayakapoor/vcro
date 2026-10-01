import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Plain-language explanations shown behind every (i) button, keyed by card or panel title. */
export const GLOSSARY: Record<string, string> = {
  "Riskometer": "The organisation's human risk score from 0 to 100. Higher means riskier. It blends Behaviour, Exposure, Privilege and Reporting signals. The outer band shows the likely range given how much data is connected.",
  "Confidence": "How much of the scoring model is fed by connected sources. 100% means every signal is live. Low confidence means the score could move once more sources connect.",
  "Score confidence": "How much of the scoring model is fed by connected sources. 100% means every signal is live.",
  "Avg confidence": "Average share of the scoring model fed by connected sources, per person.",
  "High or Critical": "People scoring above 60. These are the people most likely to cause an incident and should get attention first.",
  "Report rate": "Of all simulated attacks sent, the share people reported to security. Next to it is the share they fell for. You want the first to be the bigger number.",
  "Repeat clickers": "People who failed 2 or more simulated attacks in the last 180 days. One slip is normal; a pattern needs coaching.",
  "Very attacked VIPs": "Senior or privileged people who also receive far more targeted attacks than average. One mistake here costs the most.",
  "Provisional scores": "People whose score has less live data behind it than your minimum confidence. Their score is shown with a dashed outline and can move once more sources connect.",
  "Scored people": "People with at least one simulation result and one learning signal, the minimum for a score.",
  "Insufficient data": "People without a score yet because they have no simulation result or no learning signal.",
  "Signals feeding the score": "How much of each part of the scoring model has live data behind it, and which sources supply it. Nothing from a source that is not connected is used or shown anywhere in vCRO.",
  "People by band": "How many scored people sit in each risk band today. Click a band to see its people.",
  "What drives the score": "The average for each part of the model across everyone scored, and which drivers moved the organisation score since last month.",
  "Weakest signals": "The signals where the organisation scores worst right now. Fixing these moves the score the most.",
  "Risk trend": "Organisation score for each of the last 12 months, with the campaigns run in between. Set a target score in Settings to draw a goal line.",
  "Biggest movers": "Departments and people whose score rose or fell most since last month.",
  "Likelihood vs impact": "Right means more likely to fall for an attack, from behaviour and exposure. Up means more damage if they do, from privilege. Top right is the priority. Bubble size is headcount. Click a bubble or a dot to open it.",
  "Susceptibility": "Failure rate per attack channel and lure type in simulations.",
  "Risk concentration": "How much of the total risk sits with a small share of people. Risk here is score above the Low band. A high share means focused help on a few people goes a long way.",
  "Recommended actions, ranked by expected impact": "Each action is modelled: we recalculate the score of every targeted person as if the signals the action addresses reached the level of the best-performing quarter of the organisation. Expected drop is the average per person; Org score is the effect on the organisation score. Automatic actions can run without review; others need approval.",
  "Recommended next steps": "Steps for this person, each modelled the same way as organisation actions: the score if the signals it addresses reached the best-quarter level.",
  "Risk spreading": "High-risk people whose own team is also at Elevated or above, and departments where low manager involvement goes with more real incidents. Involvement is how well a department's managers do on their own training and policy signals, 0 to 100.",
  "Risk by department": "Each block is a department. Bigger means more people, stronger colour means a higher score.",
  "Channel results": "This person's results on simulated attacks over the last 12 months, by channel. A click faster than your impulsive-click setting is marked impulsive.",
  "Activity": "Everything recorded for this person, newest first.",
  "Exposure": "What an attacker can find out about this person from public sources.",
  "Privilege": "What this person can reach or approve. More access means more damage if they are compromised.",
  "Behaviour profile": "Where this person sits on knowledge, from assessment results, against safe behaviour, from simulations and real incidents.",
  "Setup guide": "Six steps from first connection to first action. Each tick reads live state.",
  "Active signals": "Signals currently counted in the score. Turn them on or off on the Signals page.",
  "Top weighted signals": "The ten signals that carry the most weight in the model, under the weights currently on screen.",
  "Generated reports": "Each report is kept exactly as it was when generated, so you can download the same file again.",
  "Risk heatmap": "Average signal score per department and signal category. Darker cells are riskier.",
  "Personal skill score": "A 0 to 100 skill score for this person, higher is better. Built from their behaviour, reporting and training knowledge.",
  "Why this score": "The score is what a person does plus how exposed they are, less a credit for reporting threats, multiplied by what they can reach. The bars show which parts add the most points.",
  "Lure profile": "Which persuasion tricks this person falls for most in simulations.",
  "Integrations connected": "Tools from your security stack linked to vCRO. Some feed the score, some act on it. The HumanFirewall modules are always on and are counted separately.",
  "Active elements": "Signals currently counted in the score. Turn them on or off on the Signals page.",
  "Department scorecard": "Score, change, top driver and awareness measures per department.",
  "Score over time": "Average score per month for the organisation, your filtered selection and up to 5 departments. Drag the handles under the chart to zoom into a period.",
  "People by band over time": "How many people in your selection sat in each risk band each month. A shrinking red and orange area means risk is falling.",
  "Weights by pillar": "How much each pillar counts towards the score. Within a pillar, each category's weight is split evenly across its signals.",
};

export function InfoTip({ text, label }: { text?: string | undefined; label: string }) {
  const body = text ?? GLOSSARY[label];
  if (!body) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`About ${label}`} onClick={(e) => e.stopPropagation()}
          className="inline-grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs leading-relaxed" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        {body}
      </PopoverContent>
    </Popover>
  );
}
