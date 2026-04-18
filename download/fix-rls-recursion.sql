-- =====================================================
-- FIX: RLS Recursion on ALL tables (not just profiles)
-- The admin policies query profiles inside RLS = recursion
-- Solution: Use public.is_admin() function (from fix-profiles-recursion.sql)
-- PREREQUISITE: Run fix-profiles-recursion.sql FIRST
-- =====================================================

-- Make sure is_admin() function exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- =====================================================
-- 1. DRIVERS — Fix admin policies
-- =====================================================
DROP POLICY IF EXISTS "Drivers can view own data" ON public.drivers;
DROP POLICY IF EXISTS "Admin can manage drivers" ON public.drivers;
DROP POLICY IF EXISTS "Active drivers visible for ride matching" ON public.drivers;

CREATE POLICY "Drivers can view own data" ON public.drivers FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "Admin can manage drivers" ON public.drivers FOR ALL USING (public.is_admin());
CREATE POLICY "Active drivers visible for ride matching" ON public.drivers FOR SELECT USING (status = 'online');

-- =====================================================
-- 2. VEHICLES — Fix admin policy
-- =====================================================
DROP POLICY IF EXISTS "Vehicle access via driver" ON public.vehicles;

CREATE POLICY "Vehicle access via driver" ON public.vehicles FOR ALL USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR public.is_admin()
);

-- =====================================================
-- 3. RIDES — Fix admin policies
-- =====================================================
DROP POLICY IF EXISTS "Riders can view own rides" ON public.rides;
DROP POLICY IF EXISTS "Admin can manage all rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can view available rides" ON public.rides;

CREATE POLICY "Riders can view own rides" ON public.rides FOR SELECT USING (
  rider_id = auth.uid()
  OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR public.is_admin()
);
CREATE POLICY "Admin can manage all rides" ON public.rides FOR ALL USING (public.is_admin());
CREATE POLICY "Drivers can view available rides" ON public.rides FOR SELECT USING (status = 'searching');

-- =====================================================
-- 4. WALLET — Fix admin policy
-- =====================================================
DROP POLICY IF EXISTS "Admin can view all wallets" ON public.wallets;

CREATE POLICY "Admin can view all wallets" ON public.wallets FOR SELECT USING (public.is_admin());

-- =====================================================
-- 5. DOCUMENTS — Fix admin policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Admin can manage documents" ON public.documents;

CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "Admin can manage documents" ON public.documents FOR ALL USING (public.is_admin());

-- =====================================================
-- 6. REPORTS — Fix admin policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Admin can manage reports" ON public.reports;

CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "Admin can manage reports" ON public.reports FOR ALL USING (public.is_admin());

-- =====================================================
-- 7. VENDORS — Fix admin policy
-- =====================================================
DROP POLICY IF EXISTS "Vendors can view own data" ON public.vendors;

CREATE POLICY "Vendors can view own data" ON public.vendors FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);

-- =====================================================
-- 8. PRODUCTS — Fix admin policy
-- =====================================================
DROP POLICY IF EXISTS "Admin can manage all products" ON public.products;

CREATE POLICY "Admin can manage all products" ON public.products FOR ALL USING (public.is_admin());

-- =====================================================
-- 9. NOTIFICATIONS — Fix admin select
-- =====================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);

-- =====================================================
-- 10. SETTINGS — Fix admin policy
-- =====================================================
DROP POLICY IF EXISTS "Settings visible to all authenticated" ON public.settings;
DROP POLICY IF EXISTS "Admin can manage settings" ON public.settings;

CREATE POLICY "Settings visible to all authenticated" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON public.settings FOR ALL USING (public.is_admin());

-- =====================================================
-- 11. SOS EVENTS — Fix admin policies
-- =====================================================
DROP POLICY IF EXISTS "Admin can view all SOS" ON public.sos_events;
DROP POLICY IF EXISTS "Admin can resolve SOS" ON public.sos_events;

CREATE POLICY "Admin can view all SOS" ON public.sos_events FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin can resolve SOS" ON public.sos_events FOR UPDATE USING (public.is_admin());

-- =====================================================
-- DONE — All RLS policies fixed, no more recursion errors
-- =====================================================
