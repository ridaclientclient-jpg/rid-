import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create a fresh client for this request, authenticated with the user's token
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { 
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in approve-recharge:", authError);
      return NextResponse.json({ error: `Sesion invalida: ${authError?.message || 'No user'}` }, { status: 401 });
    }

    // Verificar si es admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado: se requiere rol de administrador' }, { status: 403 });
    }

    const { transaction_id } = await request.json();

    if (!transaction_id) {
      return NextResponse.json({ error: 'ID de transaccion requerido' }, { status: 400 });
    }

    // Llamar al RPC que creamos en el SQL
    const { error: rpcError } = await supabaseClient.rpc('approve_recharge', {
      p_transaction_id: transaction_id
    });

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Recarga aprobada y saldo actualizado' });
  } catch (error: any) {
    console.error("Catch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
