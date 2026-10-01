import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePrefs } from "@/features/shared/prefs";
import { deptLures, orgSummary, recommendedActions, useSignals } from "@/lib/api";

type QA = { q: string; a: string; link: ReactNode };

export function AskAi() {
  const { askOpen, setAskOpen } = usePrefs();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const s = useSignals();
  const [asked, setAsked] = useState<QA[]>([]);
  const [text, setText] = useState("");
  const close = () => setAskOpen(false);

  const build = (): QA[] => {
    const o = orgSummary(s);
    const fin = o.departments.find((d) => d.department === "Finance")!;
    const sales = Object.entries(deptLures(s, "Sales")).sort((a, b) => b[1] - a[1])[0]!;
    const best = [...recommendedActions(s)].sort((a, b) => b.impact - a.impact)[0]!;
    return [
      { q: "Why did Finance rise this month?", a: `Finance moved ${fin.change >= 0 ? "+" : ""}${fin.change} pts to ${fin.score}. Top driver: ${fin.topDriver.toLowerCase()}.`, link: <Link to="/vcro/people" search={{ dept: "Finance" }} onClick={close}>View Finance people</Link> },
      { q: "Which VIPs are very attacked?", a: `${o.vipAttacked} VIPs are tagged very attacked.`, link: <Link to="/vcro/watchlists" search={{ group: "very-attacked-vips" }} onClick={close}>Open watchlist</Link> },
      { q: "Which lure works best on Sales?", a: `${sales[0]}: ${sales[1]}% failure rate in Sales simulations.`, link: <Link to="/vcro/people" search={{ dept: "Sales" }} onClick={close}>View Sales people</Link> },
      { q: "Which workflow reduced risk most?", a: `${best.workflow}: expected -${best.impact} pts across ${best.people} people.`, link: <Link to="/vcro/riskometer" onClick={close}>View actions</Link> },
    ];
  };

  const send = (q: string) => {
    const all = build();
    const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const m = all.find((x) => x.q.toLowerCase() === q.trim().toLowerCase()) ?? all.find((x) => words.some((w) => x.q.toLowerCase().includes(w)));
    setAsked((a) => [...a, m ?? { q, a: "No answer for this question. Try a suggested question.", link: null }]);
    setText("");
  };

  const suggestions = path.startsWith("/vcro") ? build().map((x) => x.q) : [];

  return (
    <Sheet open={askOpen} onOpenChange={setAskOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Sparkles className="size-4" />Ask AI</SheetTitle></SheetHeader>
        <div className="flex flex-wrap gap-2 px-4">
          {suggestions.map((q) => (
            <Button key={q} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5 text-left" onClick={() => send(q)}>{q}</Button>
          ))}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
          {asked.map((x, i) => (
            <div key={i} className="space-y-1.5 text-sm">
              <p className="font-semibold">{x.q}</p>
              <p className="text-muted-foreground">{x.a}</p>
              {x.link && <div className="underline underline-offset-2">{x.link}</div>}
            </div>
          ))}
        </div>
        <form className="flex gap-2 px-4 pb-4" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(text); }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question" aria-label="Ask a question" />
          <Button type="submit" variant="outline">Send</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
