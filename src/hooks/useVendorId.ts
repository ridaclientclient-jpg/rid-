'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * Hook que obtiene o crea automáticamente el registro `vendors` para el usuario actual.
 * Usa RPC SECURITY DEFINER para bypass de RLS.
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
      // Usar RPC SECURITY DEFINER — bypass RLS completamente
      const { data: rows, error: rpcErr } = await supabase.rpc('get_or_create_vendor', {
        p_user_id: user.id,
      });

      if (rpcErr) {
        console.error('[useVendorId] RPC error:', rpcErr);
        setError('Error al obtener tienda');
        toast.error('Error al cargar tu tienda. Recarga la página.');
        setLoading(false);
        return;
      }

      // El RPC retorna un array de { id: uuid }
      if (rows && rows.length > 0 && rows[0].id) {
        setVendorId(rows[0].id);
      } else {
        console.warn('[useVendorId] RPC returned empty');
        setError('No se encontró tienda');
      }
    } catch (err) {
      console.error('[useVendorId] Unexpected error:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    ensureVendor();
  }, [ensureVendor]);

  return { vendorId, loading, error, refetch: ensureVendor };
}
