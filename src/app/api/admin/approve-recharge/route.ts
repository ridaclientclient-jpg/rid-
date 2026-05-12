import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Sesion invalida' }, { status: 401 });
    }

    // Verificar si es admin
    const { data: profile } = await supabase
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
    const { error: rpcError } = await supabase.rpc('approve_recharge', {
      p_transaction_id: transaction_id
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Recarga aprobada y saldo actualizado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
