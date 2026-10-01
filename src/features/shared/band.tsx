import type { ReactNode } from "react";
import { AlertTriangle, Crown, KeyRound, Link2, QrCode, Paperclip, FileInput, Mail, Phone, MessageSquare, Video } from "lucide-react";
import type { Band, Channel, Payload } from "@/lib/scoring";
import type { Tag } from "@/data/people";
import { cn } from "@/lib/utils";

export const BAND_VAR: Record<Band, string> = {
  Low: "var(--band-low)",
  Guarded: "var(--band-guarded)",
  Elevated: "var(--band-elevated)",
  High: "var(--band-high)",
  Critical: "var(--band-critical)",
  "No score": "var(--band-none)",
};

/** Band pill, optionally with the score number. */
export function BandBadge({ band, score, className }: { band: Band; score?: number | null; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", className)}
      style={{ borderColor: `color-mix(in oklab, ${BAND_VAR[band]} 45%, transparent)`, background: `color-mix(in oklab, ${BAND_VAR[band]} 12%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: BAND_VAR[band] }} aria-hidden />
      {score != null && <span className="tabular-nums">{score}</span>}
      {band}
    </span>
  );
}

export function SoftBadge({ children, icon, className }: { children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground", className)}>
      {icon}
      {children}
    </span>
  );
}

export function StatusBadge({ on, onText = "Connected", offText = "Not connected" }: { on: boolean; onText?: string; offText?: string }) {
  return on ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      <span className="size-1.5 rounded-full bg-success" aria-hidden />{onText}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">{offText}</span>
  );
}

const ic = "size-3";
const CHANNEL_ICON: Record<Channel, ReactNode> = {
  Email: <Mail className={ic} />, Voice: <Phone className={ic} />, SMS: <MessageSquare className={ic} />, QR: <QrCode className={ic} />, Deepfake: <Video className={ic} />,
};
export const ChannelBadge = ({ channel }: { channel: Channel }) => <SoftBadge icon={CHANNEL_ICON[channel]}>{channel}</SoftBadge>;

const PAYLOAD_ICON: Record<Payload, ReactNode> = {
  Link: <Link2 className={ic} />, "Data Entry": <FileInput className={ic} />, "QR Code": <QrCode className={ic} />, Attachment: <Paperclip className={ic} />,
};
export const PayloadBadge = ({ payload }: { payload: Payload }) => <SoftBadge icon={PAYLOAD_ICON[payload]}>{payload}</SoftBadge>;

const TAG_ICON: Record<Tag, ReactNode> = { VIP: <Crown className={ic} />, Privileged: <KeyRound className={ic} />, "Very attacked": <AlertTriangle className={ic} /> };
export const TagBadge = ({ tag }: { tag: Tag }) => <SoftBadge icon={TAG_ICON[tag]}>{tag}</SoftBadge>;

/** Delta vs previous month. Down is good (green), up is amber. */
export function Change({ value, vs }: { value: number | null; vs?: string }) {
  if (value === null) return <span className="text-muted-foreground">No change data</span>;
  if (value === 0) return <span className="tabular-nums text-muted-foreground">No change{vs ? ` vs ${vs}` : ""}</span>;
  return (
    <span className={cn("tabular-nums font-medium", value < 0 ? "text-success" : "text-warning")}>
      {value < 0 ? "↓" : "↑"} {Math.abs(value)}{vs ? ` vs ${vs}` : " pts"}
    </span>
  );
}

export function DeltaBadge({ value }: { value: number }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums", value < 0 ? "bg-success/10 text-success" : value > 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground")}>
      {value > 0 ? "+" : ""}{value} pts
    </span>
  );
}
