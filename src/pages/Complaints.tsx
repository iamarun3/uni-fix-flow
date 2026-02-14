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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { SLABadge } from "@/components/complaints/SLABadge";
import { SearchFilters } from "@/components/complaints/SearchFilters";
import { ActivityTimeline } from "@/components/complaints/ActivityTimeline";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Eye, UserPlus, Download, Trash2, RotateCcw, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { exportToCSV, exportActivityLogsToCSV } from "@/lib/export-utils";
import { getSlaStatus } from "@/lib/sla-utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  is_deleted: boolean;
  created_by_profile?: { full_name: string } | null;
  assigned_to_profile?: { full_name: string } | null;
}

interface TechnicianWithWorkload {
  id: string;
  full_name: string | null;
  email: string;
  active_count: number;
}

export default function Complaints() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianWithWorkload[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Complaint | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!loading && !profile) navigate("/auth");
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile) {
      fetchComplaints();
      if (profile.role === "admin") fetchTechniciansWithWorkload();
    }
  }, [profile, statusFilter, priorityFilter, categoryFilter, showDeleted]);

  const fetchComplaints = async () => {
    setFetching(true);
    let query = supabase
      .from("complaints")
      .select(`*, created_by_profile:profiles!complaints_created_by_fkey(full_name), assigned_to_profile:profiles!complaints_assigned_to_fkey(full_name)`)
      .order("created_at", { ascending: false });

    // Admin can toggle deleted view; others always see non-deleted (handled by RLS)
    if (profile?.role === "admin" && !showDeleted) {
      query = query.eq("is_deleted", false);
    } else if (profile?.role === "admin" && showDeleted) {
      query = query.eq("is_deleted", true);
    }

    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as any);
    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);

    const { data } = await query;
    if (data) setComplaints(data as Complaint[]);
    setFetching(false);
  };

  const fetchTechniciansWithWorkload = async () => {
    const { data: techs } = await supabase.from("profiles").select("id, full_name, email").eq("role", "technician");
    if (!techs) return;

    const { data: activeComplaints } = await supabase
      .from("complaints")
      .select("assigned_to")
      .in("status", ["open", "in_progress"])
      .eq("is_deleted", false)
      .not("assigned_to", "is", null);

    const counts: Record<string, number> = {};
    activeComplaints?.forEach((c) => {
      if (c.assigned_to) counts[c.assigned_to] = (counts[c.assigned_to] || 0) + 1;
    });

    const withWorkload = techs
      .map((t) => ({ ...t, active_count: counts[t.id] || 0 }))
      .sort((a, b) => a.active_count - b.active_count); // Sort by lowest workload first

    setTechnicians(withWorkload);
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

  const sendNotification = async (userId: string, title: string, message: string, type: string, complaintId?: string) => {
    if (!profile) return;
    await supabase.from("notifications").insert({
      tenant_id: profile.tenant_id,
      user_id: userId,
      title,
      message,
      type,
      complaint_id: complaintId || null,
    });
  };

  const handleAssign = async () => {
    if (!selectedComplaint || !selectedTechnician) return;
    const tech = technicians.find((t) => t.id === selectedTechnician);

    if (tech && tech.active_count >= 10) {
      toast({ title: "Cannot assign", description: "This technician has 10+ active complaints. Choose another.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("complaints").update({ assigned_to: selectedTechnician, status: "in_progress" }).eq("id", selectedComplaint.id);
    if (error) {
      toast({ title: "Failed to assign", description: error.message, variant: "destructive" });
    } else {
      await logActivity(selectedComplaint.id, "Assigned to technician", `Assigned to ${tech?.full_name || tech?.email}`);
      // Notify the technician
      if (tech) {
        await sendNotification(tech.id, "New Assignment", `You've been assigned: ${selectedComplaint.title}`, "assigned", selectedComplaint.id);
      }
      // Notify the complainant
      if (selectedComplaint.created_by) {
        await sendNotification(selectedComplaint.created_by, "Complaint Assigned", `Your complaint "${selectedComplaint.title}" has been assigned to a technician.`, "assigned", selectedComplaint.id);
      }
      toast({ title: "Complaint assigned", description: "The technician has been notified." });
      setAssignDialogOpen(false);
      setSelectedTechnician("");
      fetchComplaints();
      fetchTechniciansWithWorkload();
    }
  };

  const handleStatusUpdate = async (complaintId: string, newStatus: "open" | "in_progress" | "resolved") => {
    const complaint = complaints.find((c) => c.id === complaintId);
    const { error } = await supabase.from("complaints").update({ status: newStatus }).eq("id", complaintId);
    if (error) {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    } else {
      await logActivity(complaintId, "Status updated", `Status changed to ${newStatus.replace("_", " ")}`);
      // Notify complainant on resolution
      if (newStatus === "resolved" && complaint?.created_by) {
        await sendNotification(complaint.created_by, "Complaint Resolved", `Your complaint "${complaint.title}" has been resolved.`, "resolved", complaintId);
      }
      toast({ title: "Status updated" });
      fetchComplaints();
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("complaints")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", deleteTarget.id);

    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      await logActivity(deleteTarget.id, "Complaint soft-deleted", "Marked as deleted by admin");
      toast({ title: "Complaint deleted", description: "The complaint has been moved to trash." });
      setDeleteTarget(null);
      fetchComplaints();
    }
  };

  const handleRestore = async (complaint: Complaint) => {
    const { error } = await supabase
      .from("complaints")
      .update({ is_deleted: false, deleted_at: null })
      .eq("id", complaint.id);

    if (error) {
      toast({ title: "Failed to restore", description: error.message, variant: "destructive" });
    } else {
      await logActivity(complaint.id, "Complaint restored", "Restored from trash by admin");
      toast({ title: "Complaint restored" });
      fetchComplaints();
    }
  };

  const handleExportActivityLogs = async () => {
    const { data } = await supabase
      .from("activity_logs")
      .select("*, performed_by_profile:profiles!activity_logs_performed_by_fkey(full_name)")
      .order("created_at", { ascending: false });
    if (data) exportActivityLogsToCSV(data);
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

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredComplaints)} title="Export complaints">
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            {(profile?.role === "admin" || profile?.role === "supervisor") && (
              <Button variant="outline" size="sm" onClick={handleExportActivityLogs} title="Export activity logs">
                <FileDown className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Logs</span>
              </Button>
            )}
            {profile?.role === "student" && (
              <Button onClick={() => navigate("/complaints/new")} className="gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                New Complaint
              </Button>
            )}
          </div>
        </div>

        {/* Admin: toggle deleted view */}
        {profile?.role === "admin" && (
          <div className="flex items-center gap-2">
            <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
            <Label htmlFor="show-deleted" className="text-sm text-muted-foreground cursor-pointer">
              Show deleted complaints
            </Label>
          </div>
        )}

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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Title</TableHead>
                      <TableHead className="font-semibold hidden md:table-cell">Category</TableHead>
                      <TableHead className="font-semibold">Priority</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold hidden lg:table-cell">SLA</TableHead>
                      <TableHead className="font-semibold hidden lg:table-cell">Created</TableHead>
                      {profile?.role !== "student" && <TableHead className="font-semibold hidden xl:table-cell">Reported By</TableHead>}
                      <TableHead className="font-semibold hidden md:table-cell">Assigned To</TableHead>
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
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {complaint.title}
                              {complaint.is_deleted && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Deleted</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize hidden md:table-cell">{complaint.category}</TableCell>
                          <TableCell><PriorityBadge priority={complaint.priority} /></TableCell>
                          <TableCell><StatusBadge status={complaint.status} /></TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <SLABadge createdAt={complaint.created_at} priority={complaint.priority} status={complaint.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">{format(new Date(complaint.created_at), "MMM d, yyyy")}</TableCell>
                          {profile?.role !== "student" && (
                            <TableCell className="hidden xl:table-cell">{complaint.created_by_profile?.full_name || "Unknown"}</TableCell>
                          )}
                          <TableCell className="hidden md:table-cell">
                            {complaint.assigned_to_profile?.full_name || (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedComplaint(complaint); setDetailDialogOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canAssign && !complaint.assigned_to && !complaint.is_deleted && (
                                <Button variant="outline" size="sm" onClick={() => { setSelectedComplaint(complaint); setAssignDialogOpen(true); }}>
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              )}
                              {canAssign && !complaint.is_deleted && (
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(complaint)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              {canAssign && complaint.is_deleted && (
                                <Button variant="outline" size="sm" onClick={() => handleRestore(complaint)}>
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                              {profile?.role === "technician" && complaint.assigned_to === profile.id && complaint.status !== "resolved" && !complaint.is_deleted && (
                                <Select value={complaint.status} onValueChange={(value: "open" | "in_progress" | "resolved") => handleStatusUpdate(complaint.id, value)}>
                                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Complaint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This complaint will be soft-deleted and can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSoftDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Dialog with Smart Assignment */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
            <DialogDescription>
              Technicians are sorted by workload (lowest first). Max 10 active complaints per technician.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Assign a technician to: <strong>{selectedComplaint?.title}</strong>
            </p>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id} disabled={tech.active_count >= 10}>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>{tech.full_name || tech.email}</span>
                      <Badge variant={tech.active_count >= 10 ? "destructive" : tech.active_count > 5 ? "secondary" : "outline"} className="ml-2 text-xs">
                        {tech.active_count} active
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {technicians.length > 0 && technicians[0].active_count < 10 && (
              <p className="text-xs text-muted-foreground">
                💡 Suggested: <strong>{technicians[0].full_name || technicians[0].email}</strong> ({technicians[0].active_count} active)
              </p>
            )}
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
                {selectedComplaint.is_deleted && <Badge variant="destructive">Deleted</Badge>}
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
