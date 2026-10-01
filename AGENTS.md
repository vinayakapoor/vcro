<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- vCRO scoring lives as pure functions in src/lib/scoring.ts; UI reads data only through src/lib/api.ts. Why: keeps the score model testable and swappable for a real backend.
- All visible copy follows the UI Copy Register in the Phase 1 build prompt (Files). Why: no invented or decorative text.
- vCRO routes live under /vcro/*; non-vCRO platform items share src/routes/$section.tsx and unbuilt vCRO pages (Weightage, Reports, Settings) share vcro.$page.tsx. Why: one placeholder pattern, real pages override by static route priority.
- Source/element on-off state is a module store in src/lib/api.ts (useSignals); every aggregate takes that state. Why: toggles recompute all scores consistently.
- Personal skill score, risk spreading and manager involvement are pure derivations in src/lib/scoring.ts / src/lib/api.ts. Why: same testable, swappable model as the risk score.
- Custom category weights live on SignalState.weights (src/lib/api.ts) and pass to computeScore. Why: weight changes recompute every page like signal toggles.
