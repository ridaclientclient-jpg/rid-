import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // Get the session from cookies
    const cookieStore = cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    const refreshToken = cookieStore.get('sb-refresh-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Sesion invalida o expirada' }, { status: 401 });
    }

    // Create a Supabase client with the user's session
    const supabaseWithSession = supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });

    // Wait for session to be set
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('Password update error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Contrasena actualizada' });
  } catch (error) {
    console.error('Update password API error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
