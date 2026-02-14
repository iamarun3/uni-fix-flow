import { cn } from "@/lib/utils";
import { getSlaStatus } from "@/lib/sla-utils";
import { Clock, AlertTriangle } from "lucide-react";

interface SLABadgeProps {
  createdAt: string;
  priority: string;
  status: string;
  className?: string;
}

export function SLABadge({ createdAt, priority, status, className }: SLABadgeProps) {
  const sla = getSlaStatus(createdAt, priority, status);

  if (status === "resolved") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        sla.overdue
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-accent/10 text-accent border-accent/20",
        className
      )}
    >
      {sla.overdue ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {sla.label}
    </span>
  );
}
