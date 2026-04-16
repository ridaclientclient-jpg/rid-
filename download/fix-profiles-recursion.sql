-- Fix: Infinite recursion in profiles RLS policies
-- The admin policies query the profiles table inside a policy on the profiles table = recursion
-- Solution: Use a security definer function to bypass RLS for the admin check

-- 1. Drop the 2 problematic policies
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

-- 2. Create a security definer function (runs as table owner, bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 3. Recreate the admin policies using the function (no recursion)
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- 4. Also add admin INSERT policy (needed for profile creation)
CREATE POLICY "Admin can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());
