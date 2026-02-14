interface ExportableComplaint {
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  location: string | null;
  created_at: string;
  created_by_profile?: { full_name: string } | null;
  assigned_to_profile?: { full_name: string } | null;
}

export function exportToCSV(complaints: ExportableComplaint[], filename = "complaints-export.csv") {
  const headers = ["Title", "Description", "Category", "Priority", "Status", "Location", "Created At", "Reported By", "Assigned To"];
  
  const rows = complaints.map(c => [
    `"${(c.title || "").replace(/"/g, '""')}"`,
    `"${(c.description || "").replace(/"/g, '""')}"`,
    c.category,
    c.priority,
    c.status,
    c.location || "",
    new Date(c.created_at).toLocaleDateString(),
    c.created_by_profile?.full_name || "Unknown",
    c.assigned_to_profile?.full_name || "Unassigned",
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
