
-- Create activity_logs table for complaint activity tracking
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  action TEXT NOT NULL,
  details TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view activity logs for complaints they can see (same tenant)
CREATE POLICY "Users can view activity logs in their tenant"
ON public.activity_logs
FOR SELECT
USING (tenant_id = get_user_tenant_id());

-- Users can insert activity logs in their tenant
CREATE POLICY "Users can insert activity logs in their tenant"
ON public.activity_logs
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND performed_by = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_activity_logs_complaint_id ON public.activity_logs(complaint_id);
CREATE INDEX idx_activity_logs_tenant_id ON public.activity_logs(tenant_id);
