import { NextResponse } from 'next/server';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authResult = await getUserFromRequest(request);
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    const adminResult = await requireAdmin(user.id);
    if ('error' in adminResult) return adminResult.error;

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
