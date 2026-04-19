import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Non-persisting client for API routes (avoids session conflicts)
function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'super_admin') return null;
  return { user, profile };
}

// GET: List all admins
export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado - Solo Super Admin' }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'super_admin'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Error al consultar administradores' }, { status: 500 });
  }

  return NextResponse.json({ admins: data });
}

// POST: Create new admin
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado - Solo Super Admin' }, { status: 403 });
  }

  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nombre, correo y contraseña son requeridos' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Check if email already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Este correo ya está registrado en el sistema' }, { status: 400 });
  }

  // Create user via Supabase Auth (trigger handle_new_user creates profile with role='admin')
  const { error } = await supabase.auth.signUp({
    email: email.toLowerCase().trim(),
    password,
    options: {
      data: { name: name.trim(), role: 'admin' }
    }
  });

  if (error) {
    return NextResponse.json({ error: 'Error al crear: ' + error.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: 'Administrador creado exitosamente'
  });
}

// DELETE: Remove admin access (change role to 'client')
export async function DELETE(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado - Solo Super Admin' }, { status: 403 });
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
  }

  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'No puedes remover tu propio acceso' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Change role from 'admin' to 'client' (soft remove - keeps account alive)
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'client' })
    .eq('id', userId)
    .eq('role', 'admin')
    .select('email')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar: ' + error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'No se encontró un administrador con ese ID' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: `Acceso de administrador removido para ${data.email}`
  });
}
