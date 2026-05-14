import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { withdrawal_id, reason } = await request.json();

    if (!withdrawal_id) {
      return NextResponse.json({ error: 'withdrawal_id requerido' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: admin } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    // Get withdrawal details
    const { data: withdrawal, error: fetchErr } = await supabase
      .from('withdrawal_queue')
      .select('*')
      .eq('id', withdrawal_id)
      .in('status', ['queued', 'processing'])
      .single();

    if (fetchErr || !withdrawal) {
      return NextResponse.json({ error: 'Retiro no encontrado o ya procesado' }, { status: 404 });
    }

    // Update withdrawal status
    const { error: updateErr } = await supabase
      .from('withdrawal_queue')
      .update({
        status: 'failed',
        error_message: reason || 'Retiro rechazado por administracion',
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_id);

    if (updateErr) throw updateErr;

    // Refund the amount back to wallet and update transaction status
    if (withdrawal.wallet_id) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', withdrawal.wallet_id)
        .single();

      if (wallet) {
        await supabase
          .from('wallets')
          .update({ balance: wallet.balance + withdrawal.amount })
          .eq('id', withdrawal.wallet_id);
      }

      // Update linked transaction
      if (withdrawal.transaction_id) {
        await supabase
          .from('transactions')
          .update({ status: 'failed', description: `Retiro rechazado: ${reason || 'Decision administrativa'}` })
          .eq('id', withdrawal.transaction_id);
      }
    }

    // Notify the user
    await supabase.from('notifications').insert({
      user_id: withdrawal.user_id,
      title: 'Retiro Rechazado',
      message: `Tu solicitud de retiro de ₡${withdrawal.amount.toLocaleString()} ha sido rechazada. Motivo: ${reason || 'Decision administrativa'}. El monto ha sido devuelto a tu billetera.`,
      type: 'payment',
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
