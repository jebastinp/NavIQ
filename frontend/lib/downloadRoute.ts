import { supabase } from './supabase';

/**
 * Fetch a saved route + its stops + driver info from Supabase,
 * then build a CSV and trigger download in the browser.
 */
export async function downloadRouteCSV(routeId: string) {
  const sb = supabase();

  // Fetch route with driver info
  const { data: route, error: routeErr } = await sb
    .from('routes')
    .select('*, driver:drivers(id, name, vehicle, phone, color, start_address, start_lat, start_lng)')
    .eq('id', routeId)
    .single();

  if (routeErr || !route) {
    alert(`Could not load route: ${routeErr?.message || 'not found'}`);
    return;
  }

  // Fetch stops with order details
  const { data: stops, error: stopsErr } = await sb
    .from('delivery_stops')
    .select('*, order:orders(customer_name, address, phone, lat, lng)')
    .eq('route_id', routeId)
    .order('sequence');

  if (stopsErr) {
    alert(`Could not load stops: ${stopsErr.message}`);
    return;
  }

  // Build CSV
  const driver = route.driver || {};
  const date = new Date(route.created_at).toISOString().split('T')[0];
  const startLat = driver.start_lat ?? route.depot_lat;
  const startLng = driver.start_lng ?? route.depot_lng;

  let csv = 'Route Date,Driver,Vehicle,Phone,Start Address,Start Lat,Start Lng,';
  csv += 'Sequence,Customer,Address,Customer Phone,ETA,Stop Lat,Stop Lng,Status,Completed At\n';

  for (const s of (stops || [])) {
    const o = s.order || {};
    const row = [
      date,
      driver.name || '',
      driver.vehicle || '',
      driver.phone || '',
      driver.start_address || '',
      startLat ?? '',
      startLng ?? '',
      s.sequence,
      o.customer_name || '',
      o.address || '',
      o.phone || '',
      s.eta_clock || '',
      o.lat ?? '',
      o.lng ?? '',
      s.status || 'pending',
      s.completed_at || '',
    ].map(csvEscape).join(',');
    csv += row + '\n';
  }

  // Summary row at bottom
  csv += '\n';
  csv += `Summary,,,,,,,,Distance ${Number(route.distance_km || 0).toFixed(2)}km,`;
  csv += `Duration ${Number(route.duration_minutes || 0).toFixed(0)}min,`;
  csv += `Fuel saved £${Number(route.fuel_saved_gbp || 0).toFixed(2)}\n`;

  const filename = `route-${(driver.name || 'driver').replace(/\s+/g, '-').toLowerCase()}-${date}.csv`;
  downloadBlob(csv, filename, 'text/csv');
}

function csvEscape(v: any): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
