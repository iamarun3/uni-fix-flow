import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Eye, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/auth");
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile) {
      fetchComplaints();
      if (profile.role === "admin") {
        fetchTechnicians();
      }
    }
  }, [profile, statusFilter]);

  const fetchComplaints = async () => {
    let query = supabase
      .from("complaints")
      .select(
        `
        *,
        created_by_profile:profiles!complaints_created_by_fkey(full_name),
        assigned_to_profile:profiles!complaints_assigned_to_fkey(full_name)
      `
      )
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter as "open" | "in_progress" | "resolved");
    }

    const { data } = await query;
    if (data) {
      setComplaints(data as Complaint[]);
    }
  };

  const fetchTechnicians = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "technician");

    if (data) {
      setTechnicians(data);
    }
  };

  const handleAssign = async () => {
    if (!selectedComplaint || !selectedTechnician) return;

    const { error } = await supabase
      .from("complaints")
      .update({
        assigned_to: selectedTechnician,
        status: "in_progress",
      })
      .eq("id", selectedComplaint.id);

    if (error) {
      toast({
        title: "Failed to assign",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Complaint assigned",
        description: "The technician has been notified.",
      });
      setAssignDialogOpen(false);
      setSelectedTechnician("");
      fetchComplaints();
    }
  };

  const handleStatusUpdate = async (complaintId: string, newStatus: "open" | "in_progress" | "resolved") => {
    const { error } = await supabase
      .from("complaints")
      .update({ status: newStatus })
      .eq("id", complaintId);

    if (error) {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status updated",
      });
      fetchComplaints();
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Complaints
            </h1>
            <p className="text-muted-foreground mt-1">
              {profile?.role === "student"
                ? "View and track your submitted complaints"
                : profile?.role === "technician"
                ? "View and resolve assigned complaints"
                : "Manage all campus complaints"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            {profile?.role === "student" && (
              <Button
                onClick={() => navigate("/complaints/new")}
                className="gradient-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Complaint
              </Button>
            )}
          </div>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {profile?.role !== "student" && (
                    <TableHead>Reported By</TableHead>
                  )}
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={profile?.role !== "student" ? 8 : 7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No complaints found
                    </TableCell>
                  </TableRow>
                ) : (
                  complaints.map((complaint) => (
                    <TableRow key={complaint.id}>
                      <TableCell className="font-medium">
                        {complaint.title}
                      </TableCell>
                      <TableCell className="capitalize">
                        {complaint.category}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={complaint.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={complaint.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(complaint.created_at), "MMM d, yyyy")}
                      </TableCell>
                      {profile?.role !== "student" && (
                        <TableCell>
                          {complaint.created_by_profile?.full_name || "Unknown"}
                        </TableCell>
                      )}
                      <TableCell>
                        {complaint.assigned_to_profile?.full_name || (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedComplaint(complaint);
                              setDetailDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {profile?.role === "admin" && !complaint.assigned_to && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedComplaint(complaint);
                                setAssignDialogOpen(true);
                              }}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          )}

                          {profile?.role === "technician" &&
                            complaint.assigned_to === profile.id &&
                            complaint.status !== "resolved" && (
                              <Select
                                value={complaint.status}
                                onValueChange={(value: "open" | "in_progress" | "resolved") =>
                                  handleStatusUpdate(complaint.id, value)
                                }
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="in_progress">
                                    In Progress
                                  </SelectItem>
                                  <SelectItem value="resolved">
                                    Resolved
                                  </SelectItem>
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
          </CardContent>
        </Card>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Assign a technician to handle: <strong>{selectedComplaint?.title}</strong>
            </p>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.full_name || tech.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedTechnician}
                className="gradient-primary"
              >
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedComplaint?.title}</DialogTitle>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4 pt-2">
              <div className="flex gap-2">
                <StatusBadge status={selectedComplaint.status} />
                <PriorityBadge priority={selectedComplaint.priority} />
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-foreground">{selectedComplaint.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Category
                  </p>
                  <p className="text-foreground capitalize">
                    {selectedComplaint.category}
                  </p>
                </div>
                {selectedComplaint.location && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Location
                    </p>
                    <p className="text-foreground">{selectedComplaint.location}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Reported By
                  </p>
                  <p className="text-foreground">
                    {selectedComplaint.created_by_profile?.full_name || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Assigned To
                  </p>
                  <p className="text-foreground">
                    {selectedComplaint.assigned_to_profile?.full_name || "Unassigned"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Created At
                </p>
                <p className="text-foreground">
                  {format(
                    new Date(selectedComplaint.created_at),
                    "MMMM d, yyyy 'at' h:mm a"
                  )}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
