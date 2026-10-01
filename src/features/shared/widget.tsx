import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
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
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label, icon: Icon, value, caption, ready, active, onClick, headerExtra,
}: {
  label: string; icon: LucideIcon; value: ReactNode; caption: string; ready: boolean; active?: boolean; onClick?: () => void; headerExtra?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}<InfoTip label={label} /></span>
        <span className="flex items-center gap-2">{headerExtra}<Icon className="size-4 text-muted-foreground" aria-hidden /></span>
      </div>
      {ready ? <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums sm:text-[28px]">{value}</div> : <Skeleton className="mt-3 h-8 w-20" />}
      <div className="mt-1 text-xs text-muted-foreground">{caption}</div>
    </>
  );
  const cls = cn(
    "rounded-2xl border bg-card p-4 text-left transition-colors hover:border-foreground/20 sm:p-5 shadow-[0_1px_2px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)]",
    active && "border-2 border-foreground p-[15px] sm:p-[19px]",
    onClick && "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
  return onClick ? (
    <div role="button" tabIndex={0} className={cls} onClick={onClick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}>{body}</div>
  ) : (
    <div className={cls}>{body}</div>
  );
}
