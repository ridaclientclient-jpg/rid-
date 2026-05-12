import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/drivers/weekly-summary
 * Returns the weekly performance summary for the authenticated driver.
 * Calls the Supabase RPC generate_weekly_summary and also fetches
 * the persisted record from driver_weekly_summaries.
 */
export async function GET(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado: se requiere token de autenticación' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado: token inválido o expirado' }, { status: 401 });
    }

    // ── Get driver record ───────────────────────────────────────
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, user_id, status, rating, total_rides, total_earnings')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    }

    // ── Call RPC to generate fresh summary ──────────────────────
    const { data: rpcSummary, error: rpcError } = await supabase.rpc('generate_weekly_summary', {
      p_driver_id: driver.id,
    });

    if (rpcError) {
      return NextResponse.json(
        { error: `Error al generar resumen semanal: ${rpcError.message}` },
        { status: 500 },
      );
    }

    // ── Fetch persisted summary from driver_weekly_summaries ────
    const { data: persistedSummary, error: summaryError } = await supabase
      .from('driver_weekly_summaries')
      .select('*')
      .eq('driver_id', driver.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .single();

    // Non-blocking: if persisted record doesn't exist yet we still
    // return the RPC result. Log the error for debugging purposes.
    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error al obtener resumen persistido:', summaryError.message);
    }

    // ── Calculate Daily Breakdown ──────────────────────────────
    // We fetch the last 7 days of completed rides to build the chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentRides } = await supabase
      .from('rides')
      .select('driver_earnings, completed_at')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .gte('completed_at', sevenDaysAgo.toISOString());

    const dailyBreakdown = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
    recentRides?.forEach(ride => {
      const day = (new Date(ride.completed_at).getDay() + 6) % 7; // Map Sun=0 to index 6, Mon=0
      dailyBreakdown[day] += ride.driver_earnings || 0;
    });

    const summary = rpcSummary || persistedSummary || {};

    return NextResponse.json({
      success: true,
      driver_id: driver.id,
      summary: {
        total_rides: summary.total_rides ?? 0,
        total_earnings: summary.total_earnings ?? 0,
        total_tips: summary.total_tips ?? 0,
        total_distance_km: summary.total_distance_km ?? 0,
        avg_rating: summary.avg_rating ?? driver.rating ?? 0,
        acceptance_rate: summary.acceptance_rate ?? 100,
        cancellation_rate: summary.cancellation_rate ?? 0,
        active_days: summary.active_days ?? 0,
        peak_hours_rides: summary.peak_hours_rides ?? 0,
        daily_earnings: dailyBreakdown,
      },
      persisted: persistedSummary
        ? {
            week_start: persistedSummary.week_start,
            week_end: persistedSummary.week_end,
            generated_at: persistedSummary.generated_at ?? persistedSummary.created_at,
          }
        : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener el resumen semanal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
