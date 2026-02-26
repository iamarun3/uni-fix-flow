-- Add DELETE policy for admins on complaints table
CREATE POLICY "Admins can delete complaints in their tenant"
ON public.complaints
FOR DELETE
USING (
  tenant_id = get_user_tenant_id() AND
  get_user_role() = 'admin'::user_role
);