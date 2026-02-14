
-- 1. Add is_deleted column to complaints for soft delete
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Index for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_complaints_is_deleted ON public.complaints(is_deleted);
CREATE INDEX IF NOT EXISTS idx_complaints_resolved_at ON public.complaints(resolved_at);

-- 2. Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert notifications in their tenant"
ON public.notifications FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- 3. Create tenant_settings table
CREATE TABLE public.tenant_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id),
  sla_high_hours INTEGER NOT NULL DEFAULT 24,
  sla_medium_hours INTEGER NOT NULL DEFAULT 72,
  sla_low_hours INTEGER NOT NULL DEFAULT 120,
  categories JSONB NOT NULL DEFAULT '["Electrical","Plumbing","Internet","Classroom Maintenance","Hostel Issue","Other"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant settings"
ON public.tenant_settings FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can update their tenant settings"
ON public.tenant_settings FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'admin'::user_role);

CREATE POLICY "Admins can insert tenant settings"
ON public.tenant_settings FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'admin'::user_role);

-- Trigger for updated_at
CREATE TRIGGER update_tenant_settings_updated_at
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Update complaints RLS to filter out soft-deleted for non-admins
-- Drop and recreate the SELECT policy to incorporate is_deleted
DROP POLICY IF EXISTS "Users can view complaints based on role" ON public.complaints;

CREATE POLICY "Users can view complaints based on role"
ON public.complaints FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    -- Admins see everything including deleted
    get_user_role() = 'admin'::user_role
    OR (
      -- Others only see non-deleted
      is_deleted = false
      AND (
        created_by = auth.uid()
        OR get_user_role() = 'supervisor'::user_role
        OR (get_user_role() = 'technician'::user_role AND assigned_to = auth.uid())
      )
    )
  )
);

-- 5. Function to set resolved_at automatically
CREATE OR REPLACE FUNCTION public.set_resolved_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') THEN
    NEW.resolved_at = now();
  END IF;
  IF NEW.status != 'resolved' THEN
    NEW.resolved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_complaints_resolved_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.set_resolved_at();
