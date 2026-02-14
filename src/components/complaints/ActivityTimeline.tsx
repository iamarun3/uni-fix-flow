import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Activity } from "lucide-react";

interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
  performed_by_profile?: { full_name: string } | null;
}

interface ActivityTimelineProps {
  complaintId: string;
}

export function ActivityTimeline({ complaintId }: ActivityTimelineProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("activity_logs")
        .select("*, performed_by_profile:profiles!activity_logs_performed_by_fkey(full_name)")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: true });
      if (data) setLogs(data as ActivityLog[]);
      setLoading(false);
    };
    fetchLogs();
  }, [complaintId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No activity recorded yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Activity className="h-4 w-4" /> Activity Log
      </p>
      <div className="relative pl-5 space-y-3">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
        {logs.map((log) => (
          <div key={log.id} className="relative">
            <div className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />
            <div>
              <p className="text-sm text-foreground">{log.action}</p>
              {log.details && <p className="text-xs text-muted-foreground">{log.details}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">
                {log.performed_by_profile?.full_name || "System"} · {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
