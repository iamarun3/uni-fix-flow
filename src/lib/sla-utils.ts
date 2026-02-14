import { differenceInMilliseconds, addHours } from "date-fns";

const SLA_HOURS: Record<string, number> = {
  critical: 24,
  high: 24,
  medium: 72,
  low: 120,
};

export function getSlaDeadline(createdAt: string, priority: string): Date {
  const hours = SLA_HOURS[priority] ?? 72;
  return addHours(new Date(createdAt), hours);
}

export function getSlaStatus(createdAt: string, priority: string, status: string) {
  if (status === "resolved") return { overdue: false, remaining: null, label: "Resolved" };
  
  const deadline = getSlaDeadline(createdAt, priority);
  const now = new Date();
  const diff = differenceInMilliseconds(deadline, now);
  
  if (diff <= 0) return { overdue: true, remaining: null, label: "Overdue" };
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return { overdue: false, remaining: diff, label: `${days}d ${remHours}h left` };
  }
  
  return { overdue: false, remaining: diff, label: `${hours}h ${minutes}m left` };
}
