import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { withdrawal_id } = await request.json();

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
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_id);

    if (updateErr) throw updateErr;

    // Notify the user
    await supabase.from('notifications').insert({
      user_id: withdrawal.user_id,
      title: 'Retiro Aprobado',
      message: `Tu retiro de ₡${withdrawal.amount.toLocaleString()} ha sido aprobado y procesado exitosamente.`,
      type: 'payment',
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
