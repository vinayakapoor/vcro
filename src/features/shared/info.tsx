import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Plain-language explanations shown behind every (i) button, keyed by card or panel title. */
export const GLOSSARY: Record<string, string> = {
  "Riskometer": "The organisation's human risk score from 0 to 100. Higher means riskier. It blends Behaviour, Attitude, Exposure, Privilege and Reporting signals. The outer band shows the likely range given how much data is connected.",
  "Confidence": "How much of the scoring model is fed by connected sources. 100% means every signal is live. Low confidence means the score could move once more sources connect.",
  "Score confidence": "How much of the scoring model is fed by connected sources. 100% means every signal is live.",
  "Avg confidence": "Average share of the scoring model fed by connected sources, per person.",
  "High or Critical": "People scoring above 60. These are the people most likely to cause an incident and should get attention first.",
  "Report-to-fail ratio": "For every simulation someone failed, how many simulations were reported to security. Above 1.0 means people report more than they fall for attacks. Higher is better.",
  "Financial exposure": "A rough yearly cost estimate if High and Critical people cause incidents: each person's score times the impact of their role, scaled to the full workforce. Use it to compare months, not as an exact figure.",
  "Very attacked VIPs": "Senior or privileged people who also receive far more targeted attacks than average. One mistake here costs the most.",
  "Signals feeding the score": "Which data sources are live for each pillar. Unconnected signals drop out and the remaining weights rebalance, which lowers confidence.",
  "Weakest signals": "The signals where the organisation scores worst right now. Fixing these moves the score the most.",
  "Risk trend": "Monthly score over the last year with the training or campaigns run in between.",
  "Biggest movers": "People whose score rose or fell most since last month.",
  "Likelihood vs impact": "Each dot is a person. Right means more likely to fall for an attack, up means more damage if they do. Top right is the priority.",
  "Susceptibility": "Failure rate per attack channel and lure type in simulations.",
  "Risk by department": "Average score per department with the change since last month.",
  "Risk concentration": "How much of the total risk sits with a small share of people. A high share means focused help on a few people goes a long way.",
  "Recommended actions, ranked by expected impact": "Next steps ranked by how much they should lower the score. Automatic ones can run without review; others need approval.",
  "Risk spreading": "High-risk people who work closely with many colleagues, and departments where low manager involvement goes with more incidents.",
  "Risk heatmap": "Average signal score per department and signal category. Darker cells are riskier.",
  "Personal skill score": "A 0 to 100 skill score for this person, higher is better. Built from their behaviour, reporting and training knowledge.",
  "Score breakdown": "How each pillar contributes to this person's score.",
  "Lure profile": "Which persuasion tricks this person falls for most in simulations.",
  "Connected sources": "Modules and integrations sending data to vCRO.",
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
