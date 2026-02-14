import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, ShieldCheck, TrendingUp, PieChart } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line,
} from "recharts";
import { getSlaStatus } from "@/lib/sla-utils";
import { format, subMonths, startOfMonth } from "date-fns";

interface AnalyticsData {
  avgResolutionHours: number;
  slaCompliancePercent: number;
  monthlyTrend: { month: string; count: number }[];
  topCategories: { name: string; count: number }[];
}

export function AdvancedAnalytics() {
  const [data, setData] = useState<AnalyticsData>({
    avgResolutionHours: 0,
    slaCompliancePercent: 0,
    monthlyTrend: [],
    topCategories: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const { data: complaints } = await supabase
      .from("complaints")
      .select("created_at, status, priority, category, resolved_at, is_deleted")
      .eq("is_deleted", false);

    if (!complaints) { setLoading(false); return; }

    // Avg resolution time
    const resolved = complaints.filter((c) => c.status === "resolved" && c.resolved_at);
    let avgHours = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((sum, c) => {
        return sum + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime());
      }, 0);
      avgHours = Math.round(totalMs / resolved.length / (1000 * 60 * 60));
    }

    // SLA compliance
    const nonOpen = complaints.filter((c) => c.status !== "open");
    let compliant = 0;
    nonOpen.forEach((c) => {
      const sla = getSlaStatus(c.created_at, c.priority, c.status);
      if (!sla.overdue) compliant++;
    });
    const slaPercent = nonOpen.length > 0 ? Math.round((compliant / nonOpen.length) * 100) : 100;

    // Monthly trend (last 6 months)
    const monthlyMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      monthlyMap[format(d, "MMM yyyy")] = 0;
    }
    complaints.forEach((c) => {
      const key = format(new Date(c.created_at), "MMM yyyy");
      if (key in monthlyMap) monthlyMap[key]++;
    });
    const monthlyTrend = Object.entries(monthlyMap).map(([month, count]) => ({ month, count }));

    // Top categories
    const catMap: Record<string, number> = {};
    complaints.forEach((c) => {
      catMap[c.category] = (catMap[c.category] || 0) + 1;
    });
    const topCategories = Object.entries(catMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setData({ avgResolutionHours: avgHours, slaCompliancePercent: slaPercent, monthlyTrend, topCategories });
    setLoading(false);
  };

  const catColors = [
    "hsl(226, 70%, 45%)", "hsl(173, 58%, 39%)", "hsl(38, 92%, 50%)",
    "hsl(0, 84%, 60%)", "hsl(262, 60%, 50%)",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Resolution Time</p>
                <p className="text-3xl font-display font-bold text-foreground mt-1">{data.avgResolutionHours}h</p>
              </div>
              <div className="bg-accent/10 p-3 rounded-xl">
                <Timer className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SLA Compliance</p>
                <p className="text-3xl font-display font-bold text-foreground mt-1">{data.slaCompliancePercent}%</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Monthly Complaint Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5 text-accent" />
              Top Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topCategories} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={100} className="capitalize" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.topCategories.map((_, i) => (
                      <Cell key={i} fill={catColors[i % catColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
