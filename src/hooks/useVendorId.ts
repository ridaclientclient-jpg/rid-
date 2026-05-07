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
      console.log('[useVendorId] Attempting to resolve vendor for user:', user.id);
      
      // 1. Intento primario: Usar RPC (Security Definer) para bypass RLS y auto-creación
      const { data: rows, error: rpcErr } = await supabase.rpc('get_or_create_vendor', {
        p_user_id: user.id,
      });

      if (rpcErr) {
        // Log detallado del error RPC
        console.error('[useVendorId] RPC error object:', JSON.stringify(rpcErr, null, 2));
        console.error('[useVendorId] RPC error message:', rpcErr?.message || 'No message');
        console.error('[useVendorId] RPC error code:', rpcErr?.code || 'No code');

        // FALLBACK: Si el RPC falla (ej: no existe), intentamos consulta directa a la tabla
        console.warn('[useVendorId] Falling back to direct table query...');
        const { data: directData, error: directErr } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (directErr) {
          console.error('[useVendorId] Fallback query failed:', directErr);
          setError('No se pudo encontrar tu tienda');
          toast.error('Error de acceso a la tienda. Contacta a soporte.');
          setLoading(false);
          return;
        }

        if (directData) {
          console.log('[useVendorId] Vendor found via direct query:', directData.id);
          setVendorId(directData.id);
          setLoading(false);
          return;
        } else {
          setError('No tienes una tienda activa');
          setLoading(false);
          return;
        }
      }

      // El RPC retorna un array de { id: uuid }
      if (rows && rows.length > 0 && rows[0].id) {
        console.log('[useVendorId] Vendor resolved via RPC:', rows[0].id);
        setVendorId(rows[0].id);
      } else {
        console.warn('[useVendorId] RPC returned empty or null data');
        setError('Perfil de vendedor no encontrado');
      }
    } catch (err: any) {
      console.error('[useVendorId] Unexpected exception:', err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    ensureVendor();
  }, [ensureVendor]);

  return { vendorId, loading, error, refetch: ensureVendor };
}
