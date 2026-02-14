import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { SLABadge } from "@/components/complaints/SLABadge";
import { SearchFilters } from "@/components/complaints/SearchFilters";
import { ActivityTimeline } from "@/components/complaints/ActivityTimeline";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Eye, UserPlus, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/export-utils";
import { getSlaStatus } from "@/lib/sla-utils";

interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  location: string | null;
  created_at: string;
  created_by: string | null;
  assigned_to: string | null;
  created_by_profile?: { full_name: string } | null;
  assigned_to_profile?: { full_name: string } | null;
}

interface Technician {
  id: string;
  full_name: string | null;
  email: string;
}

export default function Complaints() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) navigate("/auth");
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile) {
      fetchComplaints();
      if (profile.role === "admin") fetchTechnicians();
    }
  }, [profile, statusFilter, priorityFilter, categoryFilter]);

  const fetchComplaints = async () => {
    setFetching(true);
    let query = supabase
      .from("complaints")
      .select(`*, created_by_profile:profiles!complaints_created_by_fkey(full_name), assigned_to_profile:profiles!complaints_assigned_to_fkey(full_name)`)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as any);
    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);

    const { data } = await query;
    if (data) setComplaints(data as Complaint[]);
    setFetching(false);
  };

  const fetchTechnicians = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, email").eq("role", "technician");
    if (data) setTechnicians(data);
  };

  const logActivity = async (complaintId: string, action: string, details?: string) => {
    if (!profile) return;
    await supabase.from("activity_logs").insert({
      complaint_id: complaintId,
      tenant_id: profile.tenant_id,
      action,
      details: details || null,
      performed_by: profile.id,
    });
  };

  const handleAssign = async () => {
    if (!selectedComplaint || !selectedTechnician) return;
    const tech = technicians.find(t => t.id === selectedTechnician);
    const { error } = await supabase.from("complaints").update({ assigned_to: selectedTechnician, status: "in_progress" }).eq("id", selectedComplaint.id);
    if (error) {
      toast({ title: "Failed to assign", description: error.message, variant: "destructive" });
    } else {
      await logActivity(selectedComplaint.id, "Assigned to technician", `Assigned to ${tech?.full_name || tech?.email}`);
      toast({ title: "Complaint assigned", description: "The technician has been notified." });
      setAssignDialogOpen(false);
      setSelectedTechnician("");
      fetchComplaints();
    }
  };

  const handleStatusUpdate = async (complaintId: string, newStatus: "open" | "in_progress" | "resolved") => {
    const { error } = await supabase.from("complaints").update({ status: newStatus }).eq("id", complaintId);
    if (error) {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    } else {
      await logActivity(complaintId, "Status updated", `Status changed to ${newStatus.replace("_", " ")}`);
      toast({ title: "Status updated" });
      fetchComplaints();
    }
  };

  // Client-side search filter
  const filteredComplaints = complaints.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const canAssign = profile?.role === "admin";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Complaints</h1>
            <p className="text-muted-foreground mt-1">
              {profile?.role === "student"
                ? "View and track your submitted complaints"
                : profile?.role === "technician"
                ? "View and resolve assigned complaints"
                : profile?.role === "supervisor"
                ? "Monitor all campus complaints"
                : "Manage all campus complaints"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredComplaints)} title="Export to CSV">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            {profile?.role === "student" && (
              <Button onClick={() => navigate("/complaints/new")} className="gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                New Complaint
              </Button>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <SearchFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityChange={setPriorityFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />

        <Card className="shadow-card overflow-hidden">
          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold">Priority</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">SLA</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    {profile?.role !== "student" && <TableHead className="font-semibold">Reported By</TableHead>}
                    <TableHead className="font-semibold">Assigned To</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComplaints.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={profile?.role !== "student" ? 9 : 8} className="text-center py-12 text-muted-foreground">
                        No complaints found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComplaints.map((complaint) => (
                      <TableRow key={complaint.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{complaint.title}</TableCell>
                        <TableCell className="capitalize">{complaint.category}</TableCell>
                        <TableCell><PriorityBadge priority={complaint.priority} /></TableCell>
                        <TableCell><StatusBadge status={complaint.status} /></TableCell>
                        <TableCell>
                          <SLABadge createdAt={complaint.created_at} priority={complaint.priority} status={complaint.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(complaint.created_at), "MMM d, yyyy")}</TableCell>
                        {profile?.role !== "student" && (
                          <TableCell>{complaint.created_by_profile?.full_name || "Unknown"}</TableCell>
                        )}
                        <TableCell>
                          {complaint.assigned_to_profile?.full_name || (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedComplaint(complaint); setDetailDialogOpen(true); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canAssign && !complaint.assigned_to && (
                              <Button variant="outline" size="sm" onClick={() => { setSelectedComplaint(complaint); setAssignDialogOpen(true); }}>
                                <UserPlus className="h-4 w-4 mr-1" />
                                Assign
                              </Button>
                            )}
                            {profile?.role === "technician" && complaint.assigned_to === profile.id && complaint.status !== "resolved" && (
                              <Select value={complaint.status} onValueChange={(value: "open" | "in_progress" | "resolved") => handleStatusUpdate(complaint.id, value)}>
                                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="resolved">Resolved</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Technician</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Assign a technician to handle: <strong>{selectedComplaint?.title}</strong>
            </p>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>{tech.full_name || tech.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={!selectedTechnician} className="gradient-primary">Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog with SLA + Activity */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedComplaint?.title}</DialogTitle></DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4 pt-2">
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={selectedComplaint.status} />
                <PriorityBadge priority={selectedComplaint.priority} />
                <SLABadge createdAt={selectedComplaint.created_at} priority={selectedComplaint.priority} status={selectedComplaint.status} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-foreground">{selectedComplaint.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Category</p>
                  <p className="text-foreground capitalize">{selectedComplaint.category}</p>
                </div>
                {selectedComplaint.location && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                    <p className="text-foreground">{selectedComplaint.location}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Reported By</p>
                  <p className="text-foreground">{selectedComplaint.created_by_profile?.full_name || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Assigned To</p>
                  <p className="text-foreground">{selectedComplaint.assigned_to_profile?.full_name || "Unassigned"}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Created At</p>
                <p className="text-foreground">{format(new Date(selectedComplaint.created_at), "MMMM d, yyyy 'at' h:mm a")}</p>
              </div>

              {/* SLA Info */}
              {selectedComplaint.status !== "resolved" && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium text-muted-foreground mb-1">SLA Deadline</p>
                  {(() => {
                    const sla = getSlaStatus(selectedComplaint.created_at, selectedComplaint.priority, selectedComplaint.status);
                    return (
                      <p className={sla.overdue ? "text-destructive font-semibold" : "text-foreground"}>
                        {sla.label}
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* Activity Timeline */}
              <div className="border-t pt-4">
                <ActivityTimeline complaintId={selectedComplaint.id} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
