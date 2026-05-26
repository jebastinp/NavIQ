import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AppShell from '@/components/AppShell';
import Topbar from '@/components/Topbar';
import { supabase } from '@/lib/supabase';
import { apiOptimize } from '@/lib/api';
import type { Order, Driver, Profile, OptimizeResponse } from '@/lib/types';
import { Zap, Download, AlertTriangle, ArrowRight, Route as RouteIcon, FileText } from 'lucide-react';

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false });

export default function RoutesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [optimization, setOptimization] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverPositions, setDriverPositions] = useState<Record<string, { lat: number; lng: number }>>({});
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const [o, d, p] = await Promise.all([
        sb.from('orders').select('*').eq('geocoded', true),
        sb.from('drivers').select('*'),
        sb.from('profiles').select('*').eq('id', user.id).single(),
      ]);
      setOrders((o.data as Order[]) || []);
      setDrivers((d.data as Driver[]) || []);
      setProfile(p.data as Profile);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const sb = supabase();
    const channel = sb.channel('driver_positions_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_positions' }, (payload: any) => {
        const p = payload.new;
        setDriverPositions((prev) => ({ ...prev, [p.driver_id]: { lat: Number(p.lat), lng: Number(p.lng) } }));
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  async function optimize() {
    if (!profile) return;
    if (orders.length === 0) { setError('No geocoded orders.'); return; }
    if (drivers.length === 0) { setError('Add at least one driver first.'); return; }
    setError(null);
    setOptimizing(true);
    try {
      const body = {
        depot: { lat: Number(profile.depot_lat), lng: Number(profile.depot_lng) },
        orders: orders.map((o) => ({
          id: o.id, customer_name: o.customer_name, address: o.address,
          lat: Number(o.lat), lng: Number(o.lng),
        })),
        drivers: drivers.map((d) => ({
          id: d.id, name: d.name, vehicle: d.vehicle || '',
          capacity: d.capacity, color: d.color,
          start_lat: d.start_lat ? Number(d.start_lat) : null,
          start_lng: d.start_lng ? Number(d.start_lng) : null,
        })),
        avg_speed_kmh: Number(profile.avg_speed_kmh),
        fuel_price_gbp: Number(profile.fuel_price_gbp),
        vehicle_kml: Number(profile.vehicle_kml),
      };
      const result: OptimizeResponse = await apiOptimize(body);
      setOptimization(result);

      const sb = supabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      for (const route of result.routes) {
        if (route.stops.length === 0) continue;
        const { data: routeRow } = await sb.from('routes').insert({
          user_id: user.id,
          driver_id: route.driver_id,
          status: 'planned',
          depot_lat: route.start_lat,
          depot_lng: route.start_lng,
          distance_km: route.distance_km,
          duration_minutes: route.duration_minutes,
          fuel_saved_gbp: result.fuel_saved_gbp / Math.max(1, result.routes.length),
          baseline_km: result.baseline_distance_km / Math.max(1, result.routes.length),
        }).select().single();
        if (routeRow) {
          await sb.from('delivery_stops').insert(route.stops.map((s) => ({
            route_id: routeRow.id, order_id: s.order_id, user_id: user.id,
            sequence: s.sequence, eta_clock: s.eta_clock, status: 'pending',
          })));
          await sb.from('orders').update({ status: 'assigned' })
            .in('id', route.stops.map((s) => s.order_id).filter(Boolean));
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
    setOptimizing(false);
  }

  function exportCSV() {
    if (!optimization) return;
    const date = new Date().toISOString().split('T')[0];
    let csv = 'Driver,Vehicle,Start Lat,Start Lng,Sequence,Customer,Address,ETA,Stop Lat,Stop Lng\n';
    for (const r of optimization.routes) {
      const driver = drivers.find((d) => d.id === r.driver_id);
      const vehicle = driver?.vehicle || '';
      for (const s of r.stops) {
        csv += `"${r.driver_name}","${vehicle}",${r.start_lat},${r.start_lng},${s.sequence},"${s.customer_name}","${s.address.replace(/"/g, '""')}","${s.eta_clock}",${s.lat},${s.lng}\n`;
      }
    }
    downloadFile(csv, `routes-${date}.csv`, 'text/csv');
    setShowDownloadMenu(false);
  }

  function exportJSON() {
    if (!optimization) return;
    const date = new Date().toISOString().split('T')[0];
    const data = {
      generated_at: new Date().toISOString(),
      summary: {
        total_distance_km: optimization.total_distance_km,
        distance_saved_km: optimization.distance_saved_km,
        fuel_saved_gbp: optimization.fuel_saved_gbp,
        algorithm: optimization.algorithm,
      },
      routes: optimization.routes.map((r) => {
        const driver = drivers.find((d) => d.id === r.driver_id);
        return {
          driver: {
            id: r.driver_id, name: r.driver_name, color: r.driver_color,
            phone: driver?.phone, vehicle: driver?.vehicle,
          },
          start: { lat: r.start_lat, lng: r.start_lng },
          distance_km: r.distance_km, duration_minutes: r.duration_minutes,
          stops: r.stops,
        };
      }),
    };
    downloadFile(JSON.stringify(data, null, 2), `routes-${date}.json`, 'application/json');
    setShowDownloadMenu(false);
  }

  function exportPrintable() {
    if (!optimization) return;
    const date = new Date().toLocaleDateString('en-GB', { dateStyle: 'full' } as any);
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NavIQ — Routes</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', Helvetica, sans-serif;
         color: #0A1F3D; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  h1 { font-size: 30px; margin: 0 0 4px; letter-spacing: -0.02em; }
  h2 { font-size: 18px; margin: 32px 0 10px; padding: 10px 14px;
       background: #F0F4FA; border-radius: 8px; border-left: 4px solid currentColor; }
  .meta { color: #5C6E8C; font-size: 13px; margin-bottom: 24px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px;
             padding: 20px; background: #F0F4FA; border-radius: 12px; }
  .summary div { text-align: center; }
  .summary b { display: block; font-size: 22px; font-weight: 600; }
  .summary span { font-size: 11px; color: #5C6E8C; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; background: #FAFAFA; font-weight: 500; color: #5C6E8C;
       border-bottom: 1px solid #E2E8F0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 10px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  .seq { display: inline-block; width: 22px; height: 22px; border-radius: 50%; color: white;
         text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; }
  @media print { body { margin: 20px; } h2 { page-break-after: avoid; } table { page-break-inside: avoid; } }
</style></head><body>
<h1>NavIQ — Optimized Routes</h1>
<div class="meta">${date}</div>
<div class="summary">
  <div><b>${optimization.routes.length}</b><span>Routes</span></div>
  <div><b>${optimization.total_distance_km.toFixed(1)}km</b><span>Total Distance</span></div>
  <div><b>${optimization.distance_saved_km.toFixed(1)}km</b><span>Saved</span></div>
  <div><b>£${optimization.fuel_saved_gbp.toFixed(2)}</b><span>Fuel Saved</span></div>
</div>`;

    for (const r of optimization.routes) {
      if (r.stops.length === 0) continue;
      const driver = drivers.find((d) => d.id === r.driver_id);
      html += `<h2 style="color:${r.driver_color}">${r.driver_name}${driver?.vehicle ? ` · ${driver.vehicle}` : ''}</h2>`;
      html += `<div class="meta">${r.stops.length} stops · ${r.distance_km.toFixed(1)}km · ${r.duration_minutes.toFixed(0)} minutes</div>`;
      html += `<table><thead><tr><th>#</th><th>Customer</th><th>Address</th><th>ETA</th></tr></thead><tbody>`;
      for (const s of r.stops) {
        html += `<tr>
          <td><span class="seq" style="background:${r.driver_color}">${s.sequence}</span></td>
          <td><b>${s.customer_name}</b></td>
          <td>${s.address}</td>
          <td><b>${s.eta_clock}</b></td>
        </tr>`;
      }
      html += `</tbody></table>`;
    }
    html += `</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    setShowDownloadMenu(false);
  }

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const canOptimize = orders.length > 0 && drivers.length > 0 && !loading;

  return (
    <AppShell>
      <Topbar
        title="Routes"
        subtitle={optimization
          ? `${optimization.routes.length} routes · saved ${optimization.distance_saved_km.toFixed(1)}km · £${optimization.fuel_saved_gbp.toFixed(2)}`
          : 'Plan, optimize, dispatch'}
        actions={
          <>
            {optimization && (
              <div className="relative">
                <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="btn btn-glass">
                  <Download size={14} />Download
                </button>
                {showDownloadMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowDownloadMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 z-40 glass-strong p-1.5 min-w-[200px]"
                         style={{ borderRadius: '14px' }}>
                      <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] hover:bg-white/70 transition text-left">
                        <FileText size={14} style={{ color: 'var(--accent)' }} />
                        <div>
                          <div className="font-medium">CSV file</div>
                          <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>For Excel, Sheets</div>
                        </div>
                      </button>
                      <button onClick={exportJSON} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] hover:bg-white/70 transition text-left">
                        <FileText size={14} style={{ color: 'var(--purple)' }} />
                        <div>
                          <div className="font-medium">JSON file</div>
                          <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>For developers</div>
                        </div>
                      </button>
                      <button onClick={exportPrintable} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] hover:bg-white/70 transition text-left">
                        <FileText size={14} style={{ color: 'var(--good)' }} />
                        <div>
                          <div className="font-medium">Printable / PDF</div>
                          <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Save or print</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button onClick={optimize} disabled={optimizing || !canOptimize} className="btn btn-primary">
              <Zap size={14} strokeWidth={2.2} />{optimizing ? 'Optimizing…' : 'Optimize'}
            </button>
          </>
        }
      />

      {error && (
        <div className="mx-5 sm:mx-8 mt-2 mb-2 px-4 py-3 rounded-xl text-[13px] flex items-center gap-2"
          style={{ color: 'var(--bad)', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div
        className="grid grid-cols-1 lg:grid-cols-[380px_1fr]"
        style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}
      >
        <aside
          className="overflow-auto p-4 sm:p-5 space-y-3"
          style={{ borderRight: '1px solid var(--stroke-dark)' }}
        >
          {!optimization ? (
            <div className="text-center py-12 fade-up">
              {loading ? (
                <div className="text-[13px]" style={{ color: 'var(--ink-3)' }}>Loading…</div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--purple))', boxShadow: '0 8px 20px var(--accent-shadow)' }}>
                    <RouteIcon size={22} strokeWidth={1.8} />
                  </div>
                  <div className="title-section mb-1.5">
                    {canOptimize ? 'Ready to optimize' : 'Setup required'}
                  </div>
                  <div className="text-[12.5px] mb-5" style={{ color: 'var(--ink-3)' }}>
                    {orders.length} orders · {drivers.length} drivers
                  </div>
                  {!canOptimize && (
                    <div className="space-y-2">
                      {orders.length === 0 && (
                        <Link href="/orders" className="btn btn-glass text-[12.5px]">Import orders <ArrowRight size={12} /></Link>
                      )}
                      {drivers.length === 0 && (
                        <Link href="/drivers" className="btn btn-glass text-[12.5px]">Add drivers <ArrowRight size={12} /></Link>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="glass-elev p-4 fade-up">
                <div className="text-[10px] uppercase tracking-[0.1em] mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>Summary</div>
                <div className="grid grid-cols-2 gap-3">
                  <KPISmall label="Total km" value={optimization.total_distance_km.toFixed(1)} />
                  <KPISmall label="Saved" value={optimization.distance_saved_km.toFixed(1)} color="var(--good)" />
                  <KPISmall label="Fuel £" value={`£${optimization.fuel_saved_gbp.toFixed(2)}`} color="var(--good)" />
                  <KPISmall label="Algo" value={optimization.algorithm} mono />
                </div>
              </div>

              {optimization.routes.filter((r) => r.stops.length > 0).map((route) => (
                <div key={route.driver_id} className="fade-up">
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-2"
                    style={{ background: 'var(--glass-strong)', border: '1px solid var(--stroke)', borderLeft: `3px solid ${route.driver_color}` }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: route.driver_color }} />
                    <div className="text-[13.5px] font-semibold flex-1" style={{ color: 'var(--ink)' }}>{route.driver_name}</div>
                    <div className="text-[11px] mono" style={{ color: 'var(--ink-3)' }}>
                      {route.stops.length} · {route.distance_km.toFixed(1)}km
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {route.stops.map((s) => (
                      <div key={s.sequence} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px]"
                        style={{ background: 'var(--glass)', border: '1px solid var(--stroke)' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                          style={{ background: route.driver_color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
                          {s.sequence}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" style={{ color: 'var(--ink)' }}>{s.customer_name}</div>
                          <div className="text-[10.5px] truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>{s.address}</div>
                        </div>
                        <div className="text-[10.5px] mono font-medium" style={{ color: 'var(--accent)' }}>{s.eta_clock}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </aside>

        <div className="relative">
          <RouteMap optimization={optimization} profile={profile} drivers={drivers} driverPositions={driverPositions} />
        </div>
      </div>
    </AppShell>
  );
}

function KPISmall({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.08em] font-medium" style={{ color: 'var(--ink-3)' }}>{label}</div>
      <div className={`text-[18px] font-semibold leading-tight mt-1 ${mono ? 'mono text-[12px]' : ''}`}
           style={{ color: color || 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}
