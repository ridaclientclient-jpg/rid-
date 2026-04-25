'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * Hook que obtiene o crea automáticamente el registro `vendors` para el usuario actual.
 * Retorna:
 *   - vendorId: string | null  → ID del vendor (null mientras carga o si falla)
 *   - loading: boolean         → true mientras carga
 *   - error: string | null     → mensaje de error si algo falla
 *   - refetch: () => void      → para forzar recarga
 */
export function useVendorId() {
  const { user } = useAuthStore();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ensureVendor = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Intentar obtener el vendor existente
      const { data: existing, error: fetchErr } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Si existe, usarlo
      if (existing) {
        setVendorId(existing.id);
        setLoading(false);
        return;
      }

      // 2. Si el error NO es "no rows found", reportarlo pero intentar crear de todas formas
      if (fetchErr && fetchErr.code !== 'PGRST116') {
        console.warn('[useVendorId] Fetch error (attempting auto-create):', fetchErr);
      }

      // 3. Auto-crear el registro vendor
      const storeName = user.name || user.email?.split('@')[0] || 'Mi Tienda';

      const { data: created, error: createErr } = await supabase
        .from('vendors')
        .insert({
          user_id: user.id,
          store_name: storeName,
          category: 'other',
          is_approved: true,
          rating: 5.00,
        })
        .select('id')
        .single();

      if (createErr) {
        console.error('[useVendorId] Auto-create vendor failed:', createErr);

        // Si falla por UNIQUE (ya existe de una carrera), re-intentar select
        if (createErr.code === '23505') {
          const { data: retry } = await supabase
            .from('vendors')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (retry) {
            setVendorId(retry.id);
            setLoading(false);
            return;
          }
        }

        setError('No se pudo crear la tienda. Contacta soporte.');
        toast.error('Error al crear tu tienda. Intenta recargar la página.');
        setLoading(false);
        return;
      }

      if (created) {
        setVendorId(created.id);
        toast.success('Tienda creada automáticamente');
      }
    } catch (err) {
      console.error('[useVendorId] Unexpected error:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.name, user?.email]);

  useEffect(() => {
    ensureVendor();
  }, [ensureVendor]);

  return { vendorId, loading, error, refetch: ensureVendor };
}
