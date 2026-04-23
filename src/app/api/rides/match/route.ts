import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/rides/match
 * Enhanced driver matching using RPC with ETA, destination mode, and rating scoring
 */
export async function POST(request: Request) {
  try {
    const { ride_id } = await request.json();

    if (!ride_id) {
      return NextResponse.json({ error: 'ride_id es requerido' }, { status: 400 });
    }

    // Use enhanced matching RPC
    const { data, error } = await supabase.rpc('enhanced_match_driver', {
      p_ride_id: ride_id,
    });

    if (error) {
      console.error('[Match] RPC error:', error.message);
      return NextResponse.json({ success: false, message: 'Error al buscar conductor' }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message });
    }

    // Fetch driver profile for notifications
    const { data: driverProfile } = await supabase
      .from('drivers')
      .select('id, user_id, profiles(name, phone), vehicles(model, color, plate), rating')
      .eq('id', result.driver_id)
      .single();

    const { data: ride } = await supabase
      .from('rides')
      .select('rider_id, origin, destination, price')
      .eq('id', ride_id)
      .single();

    if (driverProfile && ride) {
      // Notify the driver
      await supabase.from('notifications').insert({
        user_id: (driverProfile as any).user_id,
        title: 'Nuevo viaje asignado',
        message: `Viaje de ${ride.origin} a ${ride.destination}. Precio: ₡${ride.price}. ETA: ${result.eta_minutes} min`,
        type: 'ride',
        data: { ride_id, origin: ride.origin, destination: ride.destination, price: ride.price },
      });

      // Notify the rider
      await supabase.from('notifications').insert({
        user_id: ride.rider_id,
        title: 'Conductor encontrado',
        message: `${(driverProfile as any)?.profiles?.name || 'Conductor'} esta en camino. ETA: ${result.eta_minutes} min`,
        type: 'ride',
        data: { ride_id },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Conductor asignado exitosamente',
      driver: {
        id: result.driver_id,
        name: result.driver_name,
        eta_minutes: result.eta_minutes,
        distance_km: Number(result.distance_km),
        vehicle: (driverProfile as any)?.vehicles
          ? `${(driverProfile as any).vehicles.model} ${(driverProfile as any).vehicles.color}`
          : null,
        rating: (driverProfile as any)?.rating,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al buscar conductor';
    console.error('[Match] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
