-- Fix function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Drop the overly permissive tenant creation policy
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Create a more restrictive policy - only allow tenant creation if no profile exists yet (new user signup)
CREATE POLICY "Users can create tenant during registration" ON public.tenants
    FOR INSERT TO authenticated
    WITH CHECK (
        NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );