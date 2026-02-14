import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Clock, Tag, X, Plus, BarChart3 } from "lucide-react";

interface TenantSettings {
  id?: string;
  sla_high_hours: number;
  sla_medium_hours: number;
  sla_low_hours: number;
  categories: string[];
}

export default function Settings() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState<TenantSettings>({
    sla_high_hours: 24,
    sla_medium_hours: 72,
    sla_low_hours: 120,
    categories: ["Electrical", "Plumbing", "Internet", "Classroom Maintenance", "Hostel Issue", "Other"],
  });
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, totalComplaints: 0, totalTechnicians: 0 });

  useEffect(() => {
    if (!loading && !profile) navigate("/auth");
    else if (!loading && profile?.role !== "admin") navigate("/dashboard");
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchSettings();
      fetchStats();
    }
  }, [profile]);

  const fetchSettings = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    if (data) {
      setSettings({
        id: data.id,
        sla_high_hours: data.sla_high_hours,
        sla_medium_hours: data.sla_medium_hours,
        sla_low_hours: data.sla_low_hours,
        categories: Array.isArray(data.categories) ? (data.categories as string[]) : [],
      });
    }
    setFetching(false);
  };

  const fetchStats = async () => {
    const [usersRes, complaintsRes, techsRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("complaints").select("id", { count: "exact", head: true }).eq("is_deleted", false),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "technician"),
    ]);
    setStats({
      totalUsers: usersRes.count || 0,
      totalComplaints: complaintsRes.count || 0,
      totalTechnicians: techsRes.count || 0,
    });
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    const payload = {
      tenant_id: profile.tenant_id,
      sla_high_hours: settings.sla_high_hours,
      sla_medium_hours: settings.sla_medium_hours,
      sla_low_hours: settings.sla_low_hours,
      categories: settings.categories,
    };

    let error;
    if (settings.id) {
      ({ error } = await supabase.from("tenant_settings").update(payload).eq("id", settings.id));
    } else {
      ({ error } = await supabase.from("tenant_settings").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved successfully" });
      fetchSettings();
    }
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !settings.categories.includes(trimmed)) {
      setSettings((s) => ({ ...s, categories: [...s.categories, trimmed] }));
      setNewCategory("");
    }
  };

  const removeCategory = (cat: string) => {
    setSettings((s) => ({ ...s, categories: s.categories.filter((c) => c !== cat) }));
  };

  if (loading || fetching) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure SLA, categories, and view system statistics</p>
        </div>

        {/* System Stats */}
        <div className="grid gap-4 grid-cols-3">
          {[
            { label: "Total Users", value: stats.totalUsers },
            { label: "Total Complaints", value: stats.totalComplaints },
            { label: "Technicians", value: stats.totalTechnicians },
          ].map((s) => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* SLA Configuration */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              SLA Configuration
            </CardTitle>
            <CardDescription>Set maximum resolution hours for each priority level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>High Priority (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.sla_high_hours}
                  onChange={(e) => setSettings((s) => ({ ...s, sla_high_hours: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Medium Priority (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.sla_medium_hours}
                  onChange={(e) => setSettings((s) => ({ ...s, sla_medium_hours: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Low Priority (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.sla_low_hours}
                  onChange={(e) => setSettings((s) => ({ ...s, sla_low_hours: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Management */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-accent" />
              Complaint Categories
            </CardTitle>
            <CardDescription>Manage available complaint categories for your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {settings.categories.map((cat) => (
                <Badge key={cat} variant="secondary" className="pl-3 pr-1 py-1.5 text-sm gap-1">
                  {cat}
                  <button
                    onClick={() => removeCategory(cat)}
                    className="ml-1 rounded-full hover:bg-muted p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add new category..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
              />
              <Button variant="outline" onClick={addCategory}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gradient-primary px-8">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
