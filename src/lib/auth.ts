import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Extract and verify the Supabase user from the Authorization header.
 * Returns either a user object or a NextResponse containing an error.
 */
export async function getUserFromRequest(request: Request): Promise<{ user: any } | { error: ReturnType<typeof NextResponse.json> }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Sesion invalida' }, { status: 401 }) };
  }
  return { user };
}

/**
 * Verify that the given user id belongs to an admin profile.
 * Returns the profile or an error response.
 */
export async function requireAdmin(userId: string): Promise<{ profile: any } | { error: ReturnType<typeof NextResponse.json> }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return { error: NextResponse.json({ error: 'Acceso denegado: se requiere rol de administrador' }, { status: 403 }) };
  }
  return { profile };
}
