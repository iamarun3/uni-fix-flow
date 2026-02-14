
-- Update complaint SELECT policy to include supervisor
DROP POLICY IF EXISTS "Students can view their own complaints" ON public.complaints;
CREATE POLICY "Users can view complaints based on role"
ON public.complaints
FOR SELECT
USING (
  (tenant_id = get_user_tenant_id()) 
  AND (
    (created_by = auth.uid()) 
    OR (get_user_role() = 'admin'::user_role) 
    OR (get_user_role() = 'supervisor'::user_role)
    OR ((get_user_role() = 'technician'::user_role) AND (assigned_to = auth.uid()))
  )
);
