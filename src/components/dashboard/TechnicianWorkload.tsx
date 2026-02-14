import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface TechWorkload {
  id: string;
  full_name: string | null;
  email: string;
  active_count: number;
}

export function TechnicianWorkload() {
  const [technicians, setTechnicians] = useState<TechWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Get technicians
      const { data: techs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "technician");

      if (!techs) { setLoading(false); return; }

      // Get active complaints counts
      const { data: complaints } = await supabase
        .from("complaints")
        .select("assigned_to")
        .in("status", ["open", "in_progress"])
        .not("assigned_to", "is", null);

      const counts: Record<string, number> = {};
      complaints?.forEach((c) => {
        if (c.assigned_to) counts[c.assigned_to] = (counts[c.assigned_to] || 0) + 1;
      });

      setTechnicians(
        techs.map((t) => ({ ...t, active_count: counts[t.id] || 0 }))
          .sort((a, b) => b.active_count - a.active_count)
      );
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Technician Workload
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : technicians.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No technicians found.</p>
        ) : (
          <div className="space-y-2">
            {technicians.map((tech) => (
              <div
                key={tech.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg transition-colors",
                  tech.active_count > 5
                    ? "bg-destructive/5 border border-destructive/20"
                    : "bg-muted/50"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{tech.full_name || tech.email}</p>
                  <p className="text-xs text-muted-foreground">{tech.email}</p>
                </div>
                <div className={cn(
                  "text-sm font-semibold px-2.5 py-1 rounded-full",
                  tech.active_count > 5
                    ? "bg-destructive/10 text-destructive"
                    : tech.active_count > 0
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {tech.active_count} active
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
