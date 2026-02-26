
-- Drop all existing restrictive policies and recreate as permissive

-- PROFILES
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their tenant" ON public.profiles FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- TENANTS
DROP POLICY IF EXISTS "Anyone can read tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can create tenant during registration" ON public.tenants;

CREATE POLICY "Anyone can read tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Users can create tenant during registration" ON public.tenants FOR INSERT WITH CHECK (NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- COMPLAINTS
DROP POLICY IF EXISTS "Users can view complaints based on role" ON public.complaints;
DROP POLICY IF EXISTS "Students can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admin can update any complaint in their tenant" ON public.complaints;
DROP POLICY IF EXISTS "Technicians can update assigned complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can delete complaints in their tenant" ON public.complaints;

CREATE POLICY "Users can view complaints based on role" ON public.complaints FOR SELECT USING (
  tenant_id = get_user_tenant_id() AND (
    get_user_role() = 'admin'::user_role OR
    (is_deleted = false AND (
      created_by = auth.uid() OR
      get_user_role() = 'supervisor'::user_role OR
      (get_user_role() = 'technician'::user_role AND assigned_to = auth.uid())
    ))
  )
);
CREATE POLICY "Students can create complaints" ON public.complaints FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id() AND created_by = auth.uid() AND get_user_role() = 'student'::user_role
);
CREATE POLICY "Admin can update any complaint in their tenant" ON public.complaints FOR UPDATE USING (
  tenant_id = get_user_tenant_id() AND get_user_role() = 'admin'::user_role
);
CREATE POLICY "Technicians can update assigned complaints" ON public.complaints FOR UPDATE USING (
  tenant_id = get_user_tenant_id() AND get_user_role() = 'technician'::user_role AND assigned_to = auth.uid()
);
CREATE POLICY "Admins can delete complaints in their tenant" ON public.complaints FOR DELETE USING (
  tenant_id = get_user_tenant_id() AND get_user_role() = 'admin'::user_role
);

-- ACTIVITY_LOGS
DROP POLICY IF EXISTS "Users can view activity logs in their tenant" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert activity logs in their tenant" ON public.activity_logs;

CREATE POLICY "Users can view activity logs in their tenant" ON public.activity_logs FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Users can insert activity logs in their tenant" ON public.activity_logs FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND performed_by = auth.uid());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications in their tenant" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());
CREATE POLICY "Users can insert notifications in their tenant" ON public.notifications FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

-- TENANT_SETTINGS
DROP POLICY IF EXISTS "Users can view their tenant settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Admins can insert tenant settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Admins can update their tenant settings" ON public.tenant_settings;

CREATE POLICY "Users can view their tenant settings" ON public.tenant_settings FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Admins can insert tenant settings" ON public.tenant_settings FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'admin'::user_role);
CREATE POLICY "Admins can update their tenant settings" ON public.tenant_settings FOR UPDATE USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'admin'::user_role);
