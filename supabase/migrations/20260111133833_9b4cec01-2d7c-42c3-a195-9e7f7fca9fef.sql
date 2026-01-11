-- Update SECURITY DEFINER functions with explicit NULL checks for improved security

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.profiles 
    WHERE id = auth.uid() AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles 
    WHERE id = auth.uid() AND auth.uid() IS NOT NULL
$$;