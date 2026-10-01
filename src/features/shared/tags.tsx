import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TagBadge, tagIcon } from "./band";
import { TAGS } from "@/lib/api";

/**
 * A person's tags, rolled up: the first few as badges, the rest behind a "+N" that opens the full list
 * with what each tag means and which source applied it.
 */
export function TagList({ tags, custom = [], max = 2 }: { tags: readonly string[]; custom?: readonly string[]; max?: number }) {
  const all = [...tags, ...custom];
  if (!all.length) return <span className="text-xs text-muted-foreground">No tags</span>;
  const rest = all.length - max;
  return (
    <Popover>
      <div className="flex flex-wrap items-center gap-1">
        {all.slice(0, max).map((t) => <TagBadge key={t} tag={t} />)}
        <PopoverTrigger asChild>
          <button type="button" onClick={(e) => e.stopPropagation()} aria-label={all.length === 1 ? "About this tag" : `Show all ${all.length} tags`}
            className="rounded-md border px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {rest > 0 ? `+${rest}` : "About"}
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-80 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{all.length} {all.length === 1 ? "tag" : "tags"}</div>
        <ul className="max-h-72 divide-y overflow-y-auto">
          {all.map((t) => {
            const def = TAGS.find((x) => x.name === t);
            return (
              <li key={t} className="flex items-start gap-2.5 px-3 py-2">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-muted">{tagIcon(t)}</span>
                <span className="min-w-0 text-sm"><span className="block font-medium">{t}</span>
                  <span className="block text-xs text-muted-foreground">{def ? `${def.about}. Applied automatically from ${def.source}.` : "Your tag, applied by hand."}</span></span>
              </li>
            );
          })}
        </ul>
        <div className="border-t px-3 py-2 text-xs"><Link to="/vcro/watchlists" className="font-medium underline underline-offset-2">Manage tags and groups</Link></div>
      </PopoverContent>
    </Popover>
  );
}
