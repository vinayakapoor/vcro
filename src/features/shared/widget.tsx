import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info";

export function Widget({
  title, action, ready, empty, notConnected, children, className, contentClassName, info,
}: {
  title: ReactNode;
  action?: ReactNode;
  ready: boolean;
  empty?: { text: string; action: ReactNode } | false;
  notConnected?: boolean;
  children: ReactNode;
  className?: string | undefined;
  contentClassName?: string | undefined;
  /** Explainer behind the (i). Falls back to the glossary entry for the title. */
  info?: string | undefined;
}) {
  return (
    <Card className={cn("min-w-0 gap-4 rounded-2xl py-5 shadow-[0_1px_2px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)] transition-shadow hover:shadow-[0_4px_16px_-6px_color-mix(in_oklab,var(--foreground)_14%,transparent)]", className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-5">
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">{title}{typeof title === "string" && <InfoTip label={title} text={info} />}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className={cn("min-w-0 px-5", contentClassName)}>
        {!ready ? (
          <div className="space-y-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-32 w-full" /></div>
        ) : notConnected ? (
          <EmptyLine text="Not connected" action={<Button asChild variant="outline" size="sm"><Link to="/vcro/signals">Connect source</Link></Button>} />
        ) : empty ? (
          <EmptyLine text={empty.text} action={empty.action} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyLine({ text, action }: { text: string; action: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-6 text-sm text-muted-foreground">
      <span>{text}</span>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string | undefined; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label, icon: Icon, value, caption, ready, active, onClick, headerExtra, chip,
}: {
  label: string; icon: LucideIcon; value: ReactNode; caption: string; ready: boolean; active?: boolean; onClick?: () => void; headerExtra?: ReactNode;
  /** A short secondary figure shown beside the value, for example a change or a companion rate. */
  chip?: { text: string; tone?: "good" | "bad" | "neutral" } | undefined;
}) {
  const tone = chip?.tone === "good" ? "bg-success/10 text-success" : chip?.tone === "bad" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
  const body = (
    <>
      <div className="flex min-h-9 items-start justify-between gap-2">
        <span className="text-[13px] font-medium leading-snug text-muted-foreground">{label} <span className="inline-block translate-y-0.5"><InfoTip label={label} /></span></span>
        <span className="flex shrink-0 items-center gap-2">{headerExtra}<Icon className="size-4 text-muted-foreground/70" aria-hidden /></span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
        {ready ? <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums">{value}</span> : <Skeleton className="h-7 w-20" />}
        {ready && chip && <span className={cn("whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums", tone)}>{chip.text}</span>}
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2 text-xs leading-snug text-muted-foreground">
        <span className="line-clamp-2">{caption}</span>
        {onClick && <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />}
      </div>
    </>
  );
  const cls = cn(
    "group flex min-w-0 flex-col rounded-2xl border bg-card p-5 text-left shadow-[0_1px_2px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)] transition-colors",
    active && "border-2 border-foreground p-[19px]",
    onClick && "cursor-pointer hover:border-foreground/25 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
  return onClick ? (
    <div role="button" tabIndex={0} className={cls} onClick={onClick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}>{body}</div>
  ) : (
    <div className={cls}>{body}</div>
  );
}
