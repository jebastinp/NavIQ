import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Topbar from '@/components/Topbar';
import { supabase } from '@/lib/supabase';
import { Zap, Upload, Users, Route as RouteIcon, TrendingUp, ArrowUpRight, ArrowRight, Download } from 'lucide-react';
import { downloadRouteCSV } from '@/lib/downloadRoute';

export default function DashboardPage() {
  const [stats, setStats] = useState({ orders: 0, drivers: 0, routes: [] as any[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const [o, d, r] = await Promise.all([
        sb.from('orders').select('id', { count: 'exact', head: true }),
        sb.from('drivers').select('id', { count: 'exact', head: true }),
        sb.from('routes').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      setStats({ orders: o.count || 0, drivers: d.count || 0, routes: r.data || [] });
      setLoading(false);
    })();
  }, []);

  const completed = stats.routes.filter((r) => r.status === 'completed').length;
  const totalFuel = stats.routes.reduce((s, r: any) => s + Number(r.fuel_saved_gbp || 0), 0);
  const totalDistance = stats.routes.reduce((s, r: any) => s + Number(r.distance_km || 0), 0);

  return (
    <AppShell>
      <Topbar
        title="Overview"
        subtitle={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={<Link href="/routes" className="btn btn-primary"><Zap size={14} strokeWidth={2.2} />Optimize</Link>}
      />

      <div className="px-5 sm:px-8 pb-8">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 fade-up">
          <KPI label="Orders" value={String(stats.orders)} icon={Upload} hint="All time" g="linear-gradient(135deg, #5AC8FA, #0071E3)" />
          <KPI label="Drivers" value={String(stats.drivers)} icon={Users} hint="In fleet" g="linear-gradient(135deg, #AF52DE, #FF2D55)" />
          <KPI label="Routes" value={String(stats.routes.length)} icon={RouteIcon} hint={`${completed} done`} g="linear-gradient(135deg, #30D158, #5AC8FA)" />
          <KPI label="Fuel saved" value={`£${totalFuel.toFixed(0)}`} icon={TrendingUp} hint={`${totalDistance.toFixed(0)}km`} g="linear-gradient(135deg, #FF9500, #FF3B30)" highlight />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent routes */}
          <div className="lg:col-span-2 glass-strong p-5 sm:p-6 fade-up">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="title-section">Recent routes</div>
                <div className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>Last 20 optimizations</div>
              </div>
              <Link href="/analytics" className="btn btn-ghost text-[12.5px]">View all <ArrowRight size={12} /></Link>
            </div>

            {loading ? (
              <div className="text-[13px] py-12 text-center" style={{ color: 'var(--ink-3)' }}>Loading…</div>
            ) : stats.routes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid var(--stroke)' }}>
                  <RouteIcon size={22} strokeWidth={1.5} style={{ color: 'var(--ink-mute)' }} />
                </div>
                <div className="text-[14px] font-semibold mb-1.5">No routes yet</div>
                <div className="text-[12.5px] mb-4" style={{ color: 'var(--ink-3)' }}>
                  Import orders and optimize to see results.
                </div>
                <Link href="/orders" className="btn btn-glass">Import orders <ArrowRight size={13} /></Link>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="data px-3 sm:px-0">
                  <thead>
                    <tr><th>Date</th><th>Distance</th><th>Duration</th><th>Saved</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {stats.routes.slice(0, 10).map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ color: 'var(--ink)' }}>
                          {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="mono">{Number(r.distance_km || 0).toFixed(1)} km</td>
                        <td className="mono">{Number(r.duration_minutes || 0).toFixed(0)}m</td>
                        <td className="mono" style={{ color: 'var(--good)' }}>£{Number(r.fuel_saved_gbp || 0).toFixed(2)}</td>
                        <td><span className={`pill ${r.status === 'completed' ? 'pill-ok' : r.status === 'in_progress' ? 'pill-info' : 'pill-neutral'}`}>{r.status}</span></td>
                        <td>
                          <button
                            onClick={() => downloadRouteCSV(r.id)}
                            className="btn btn-glass !py-1.5 !px-3 !text-[12px]"
                            title="Download as CSV"
                          >
                            <Download size={12} />CSV
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick start */}
          <div className="glass-strong p-5 sm:p-6 fade-up">
            <div className="title-section mb-1">Quick start</div>
            <div className="text-[12px] mb-5" style={{ color: 'var(--ink-3)' }}>4 steps to your first route</div>
            <div className="space-y-2">
              {[
                { n: 1, t: 'Add drivers', d: 'Set up your team', href: '/drivers', done: stats.drivers > 0 },
                { n: 2, t: 'Import orders', d: 'Upload CSV', href: '/orders', done: stats.orders > 0 },
                { n: 3, t: 'Optimize', d: 'AI assigns stops', href: '/routes', done: stats.routes.length > 0 },
                { n: 4, t: 'Track live', d: 'Share driver links', href: '/drivers' },
              ].map((s) => (
                <Link key={s.n} href={s.href} className="flex items-center gap-3 p-3 rounded-xl transition-all group"
                  style={{ background: s.done ? 'var(--accent-tint)' : 'rgba(255,255,255,0.4)' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0"
                    style={{
                      background: s.done ? 'var(--accent)' : 'white',
                      color: s.done ? 'white' : 'var(--ink-2)',
                      border: s.done ? 'none' : '1px solid var(--stroke-dark)',
                    }}>{s.done ? '✓' : s.n}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{s.t}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{s.d}</div>
                  </div>
                  <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition" style={{ color: 'var(--ink-3)' }} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function KPI({ label, value, hint, icon: Icon, g, highlight }: {
  label: string; value: string; hint: string; icon: any; g: string; highlight?: boolean;
}) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>{label}</div>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
          style={{ background: g, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
          <Icon size={13} strokeWidth={2.2} />
        </div>
      </div>
      <div className="text-[26px] sm:text-[32px] font-semibold tracking-tight leading-none"
        style={{ color: highlight ? 'transparent' : 'var(--ink)',
                 background: highlight ? g : 'none',
                 WebkitBackgroundClip: highlight ? 'text' : 'unset',
                 WebkitTextFillColor: highlight ? 'transparent' : 'inherit',
                 backgroundClip: highlight ? 'text' : 'unset' }}>
        {value}
      </div>
      <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--ink-3)' }}>{hint}</div>
    </div>
  );
}
