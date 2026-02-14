import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "student" | "technician" | "supervisor";
  created_at: string;
}

export default function Team() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (!loading && !profile) navigate("/auth");
    else if (!loading && profile?.role !== "admin") navigate("/dashboard");
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile?.role === "admin") fetchTeamMembers();
  }, [profile]);

  const fetchTeamMembers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("role").order("created_at");
    if (data) setMembers(data as TeamMember[]);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "default";
      case "supervisor": return "secondary";
      case "technician": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Team Members</h1>
          <p className="text-muted-foreground mt-1">View all users in your organization</p>
        </div>

        <Card className="shadow-card overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No team members found</TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                            {member.full_name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                          </div>
                          {member.full_name || "Unnamed"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize">{member.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(member.created_at), "MMM d, yyyy")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
