-- Create role enum for users
CREATE TYPE public.user_role AS ENUM ('admin', 'student', 'technician');

-- Create complaint status enum
CREATE TYPE public.complaint_status AS ENUM ('open', 'in_progress', 'resolved');

-- Create complaint priority enum
CREATE TYPE public.complaint_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create tenants table (each college/campus)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create profiles table with tenant reference
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create complaints table with tenant reference
CREATE TABLE public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority complaint_priority NOT NULL DEFAULT 'medium',
    status complaint_status NOT NULL DEFAULT 'open',
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Tenants policies (public can read for registration)
CREATE POLICY "Anyone can read tenants" ON public.tenants
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated users can create tenants" ON public.tenants
    FOR INSERT TO authenticated WITH CHECK (true);

-- Profiles policies (tenant isolation)
CREATE POLICY "Users can view profiles in their tenant" ON public.profiles
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Complaints policies (tenant isolation + role-based access)
CREATE POLICY "Students can view their own complaints" ON public.complaints
    FOR SELECT TO authenticated
    USING (
        tenant_id = public.get_user_tenant_id() AND
        (
            created_by = auth.uid() OR
            public.get_user_role() = 'admin' OR
            (public.get_user_role() = 'technician' AND assigned_to = auth.uid())
        )
    );

CREATE POLICY "Students can create complaints" ON public.complaints
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_user_tenant_id() AND
        created_by = auth.uid() AND
        public.get_user_role() = 'student'
    );

CREATE POLICY "Admin can update any complaint in their tenant" ON public.complaints
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_user_tenant_id() AND
        public.get_user_role() = 'admin'
    );

CREATE POLICY "Technicians can update assigned complaints" ON public.complaints
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_user_tenant_id() AND
        public.get_user_role() = 'technician' AND
        assigned_to = auth.uid()
    );

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();