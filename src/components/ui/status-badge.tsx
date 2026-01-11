import { cn } from "@/lib/utils";

type Status = "open" | "in_progress" | "resolved";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig = {
  open: {
    label: "Open",
    className: "bg-status-open/10 text-status-open border-status-open/20",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-status-in-progress/10 text-status-in-progress border-status-in-progress/20",
  },
  resolved: {
    label: "Resolved",
    className: "bg-status-resolved/10 text-status-resolved border-status-resolved/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        config.className,
        className
      )}
    >
      <span className={cn(
        "mr-1.5 h-1.5 w-1.5 rounded-full",
        status === "open" && "bg-status-open",
        status === "in_progress" && "bg-status-in-progress",
        status === "resolved" && "bg-status-resolved"
      )} />
      {config.label}
    </span>
  );
}
