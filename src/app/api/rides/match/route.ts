import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/rides/match
 * Finds the nearest available driver and assigns them to a ride.
 * Called after ride creation to perform real matching (no mock data).
 */
export async function POST(request: Request) {
  try {
    const { ride_id } = await request.json();

    if (!ride_id) {
      return NextResponse.json({ error: 'ride_id es requerido' }, { status: 400 });
    }

    // 1. Get the ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', ride_id)
      .eq('status', 'searching')
      .single();

    if (rideError || !ride) {
      return NextResponse.json({ success: false, message: 'Viaje no encontrado o ya no esta buscando' });
    }

    // 2. Find all online, verified drivers
    const { data: drivers, error: driversError } = await supabase
      .from('drivers')
      .select('id, user_id, rating, current_lat, current_lng')
      .eq('status', 'online')
      .eq('is_verified', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

    if (driversError) {
      console.error('[Match] Error fetching drivers:', driversError.message);
      return NextResponse.json({ success: false, message: 'Error al buscar conductores' });
    }

    if (!drivers || drivers.length === 0) {
      return NextResponse.json({ success: false, message: 'No hay conductores disponibles en este momento' });
    }

    // 3. Calculate distance from ride origin to each driver
    const originLat = ride.origin_lat;
    const originLng = ride.origin_lng;

    if (!originLat || !originLng) {
      return NextResponse.json({ success: false, message: 'El viaje no tiene coordenadas de origen' });
    }

    interface DriverWithDistance {
      id: string;
      user_id: string;
      rating: number;
      current_lat: number;
      current_lng: number;
      distance: number;
    }

    const driversWithDistance: DriverWithDistance[] = drivers.map(d => ({
      ...d,
      distance: haversine(originLat, originLng, d.current_lat, d.current_lng),
    }));

    // Sort by nearest first
    driversWithDistance.sort((a, b) => a.distance - b.distance);

    // 4. Pick the nearest driver (within 30km)
    const nearestDriver = driversWithDistance.find(d => d.distance <= 30);

    if (!nearestDriver) {
      return NextResponse.json({ success: false, message: 'No hay conductores cercanos (dentro de 30km)' });
    }

    // 5. Assign driver to ride
    const { error: updateError } = await supabase
      .from('rides')
      .update({
        driver_id: nearestDriver.id,
        status: 'assigned',
      })
      .eq('id', ride_id);

    if (updateError) {
      console.error('[Match] Error assigning driver:', updateError.message);
      return NextResponse.json({ success: false, message: 'Error al asignar conductor' });
    }

    // 6. Set driver to busy
    await supabase
      .from('drivers')
      .update({ status: 'busy' })
      .eq('id', nearestDriver.id);

    // 7. Fetch driver profile info for the response
    const { data: driverProfile } = await supabase
      .from('drivers')
      .select('id, profiles(name, phone), vehicles(model, color, plate), rating, current_lat, current_lng')
      .eq('id', nearestDriver.id)
      .single();

    // 8. Notify the driver
    await supabase.from('notifications').insert({
      user_id: nearestDriver.user_id,
      title: 'Nuevo viaje disponible',
      message: `Viaje de ${ride.origin} a ${ride.destination}. Precio: ₡${ride.price}`,
      type: 'ride',
      data: { ride_id: ride.id, origin: ride.origin, destination: ride.destination, price: ride.price },
    });

    // 9. Notify the rider
    await supabase.from('notifications').insert({
      user_id: ride.rider_id,
      title: 'Conductor encontrado',
      message: `${(driverProfile as any)?.profiles?.name || 'Conductor'} esta en camino. Distancia: ${Math.round(nearestDriver.distance * 10) / 10} km`,
      type: 'ride',
      data: { ride_id: ride.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Conductor asignado exitosamente',
      driver: {
        id: nearestDriver.id,
        name: (driverProfile as any)?.profiles?.name,
        phone: (driverProfile as any)?.profiles?.phone,
        vehicle: (driverProfile as any)?.vehicles
          ? `${(driverProfile as any).vehicles.model} ${(driverProfile as any).vehicles.color}`
          : null,
        rating: (driverProfile as any)?.rating,
        distance: Math.round(nearestDriver.distance * 10) / 10,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al buscar conductor';
    console.error('[Match] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Haversine formula to calculate distance in km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
