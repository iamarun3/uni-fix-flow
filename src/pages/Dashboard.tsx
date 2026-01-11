import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Clock, CheckCircle, AlertCircle, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export default function Dashboard() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [recentComplaints, setRecentComplaints] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/auth");
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile) {
      fetchStats();
      fetchRecentComplaints();
    }
  }, [profile]);

  const fetchStats = async () => {
    const { data } = await supabase
      .from("complaints")
      .select("status");

    if (data) {
      setStats({
        total: data.length,
        open: data.filter((c) => c.status === "open").length,
        inProgress: data.filter((c) => c.status === "in_progress").length,
        resolved: data.filter((c) => c.status === "resolved").length,
      });
    }
  };

  const fetchRecentComplaints = async () => {
    const { data } = await supabase
      .from("complaints")
      .select("*, created_by_profile:profiles!complaints_created_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setRecentComplaints(data);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Complaints",
      value: stats.total,
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Open",
      value: stats.open,
      icon: AlertCircle,
      color: "text-status-open",
      bgColor: "bg-status-open/10",
    },
    {
      title: "In Progress",
      value: stats.inProgress,
      icon: Clock,
      color: "text-status-in-progress",
      bgColor: "bg-status-in-progress/10",
    },
    {
      title: "Resolved",
      value: stats.resolved,
      icon: CheckCircle,
      color: "text-status-resolved",
      bgColor: "bg-status-resolved/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Welcome back, {profile?.full_name || "User"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's an overview of your campus maintenance status
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="shadow-card hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-display font-bold text-foreground mt-1">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-xl`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Resolution Rate */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-accent" />
                Resolution Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Overall</span>
                  <span className="font-semibold text-foreground">
                    {stats.total > 0
                      ? Math.round((stats.resolved / stats.total) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-accent transition-all duration-500"
                    style={{
                      width: `${
                        stats.total > 0
                          ? Math.round((stats.resolved / stats.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile?.role === "student" && (
                <button
                  onClick={() => navigate("/complaints/new")}
                  className="w-full text-left p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  <p className="font-medium text-foreground">Raise a Complaint</p>
                  <p className="text-sm text-muted-foreground">
                    Report an issue on campus
                  </p>
                </button>
              )}
              <button
                onClick={() => navigate("/complaints")}
                className="w-full text-left p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <p className="font-medium text-foreground">View All Complaints</p>
                <p className="text-sm text-muted-foreground">
                  See complaint history and status
                </p>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
