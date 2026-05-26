import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Topbar from '@/components/Topbar';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Route as RouteIcon, Fuel, Clock, Sparkles, Download } from 'lucide-react';
import { downloadRouteCSV } from '@/lib/downloadRoute';

export default function AnalyticsPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().from('routes').select('*').order('created_at', { ascending: false }).limit(100);
      setRoutes(data || []);
      setLoading(false);
    })();
  }, []);

  const totalDistance = routes.reduce((s, r) => s + Number(r.distance_km || 0), 0);
  const totalSaved = routes.reduce((s, r) => s + Number(r.fuel_saved_gbp || 0), 0);
  const totalBaseline = routes.reduce((s, r) => s + Number(r.baseline_km || 0), 0);
  const totalDuration = routes.reduce((s, r) => s + Number(r.duration_minutes || 0), 0);
  const savedPct = totalBaseline > 0 ? ((totalBaseline - totalDistance) / totalBaseline) * 100 : 0;

  return (
    <AppShell>
      <Topbar title="Analytics" subtitle={`Last ${routes.length} routes`} />

      <div className="px-5 sm:px-8 pb-8 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="Routes" value={String(routes.length)} icon={RouteIcon} g="linear-gradient(135deg, #5AC8FA, #0071E3)" />
          <KPI label="Distance" value={`${totalDistance.toFixed(0)}km`} icon={TrendingUp} g="linear-gradient(135deg, #AF52DE, #FF2D55)" />
          <KPI label="Fuel saved" value={`£${totalSaved.toFixed(0)}`} icon={Fuel} g="linear-gradient(135deg, #30D158, #5AC8FA)" highlight />
          <KPI label="Drive time" value={`${(totalDuration / 60).toFixed(0)}h`} icon={Clock} g="linear-gradient(135deg, #FF9500, #FF3B30)" />
        </div>

        <div className="glass-strong p-5 sm:p-7 fade-up">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
            <div className="title-section">Efficiency</div>
          </div>
          <div className="text-[13px] mb-5" style={{ color: 'var(--ink-3)' }}>
            Optimized vs. baseline (unoptimized) routes
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid var(--stroke)' }}>
              <div className="text-[36px] font-semibold leading-none" style={{ color: 'var(--ink-2)' }}>
                {totalBaseline.toFixed(0)}<span className="text-[18px] ml-1" style={{ color: 'var(--ink-3)' }}>km</span>
              </div>
              <div className="text-[11px] uppercase tracking-wider mt-2 font-medium" style={{ color: 'var(--ink-3)' }}>Baseline</div>
            </div>
            <div className="p-5 rounded-2xl text-center" style={{ background: 'var(--accent-tint)', border: '1px solid rgba(0,113,227,0.25)' }}>
              <div className="text-[36px] font-semibold leading-none" style={{ color: 'var(--accent)' }}>
                {totalDistance.toFixed(0)}<span className="text-[18px] ml-1">km</span>
              </div>
              <div className="text-[11px] uppercase tracking-wider mt-2 font-medium" style={{ color: 'var(--accent)' }}>Optimized</div>
            </div>
            <div className="p-5 rounded-2xl text-center" style={{ background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.30)' }}>
              <div className="text-[36px] font-semibold leading-none" style={{
                background: 'linear-gradient(135deg, #30D158, #34C759)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {savedPct.toFixed(0)}<span className="text-[18px] ml-1">%</span>
              </div>
              <div className="text-[11px] uppercase tracking-wider mt-2 font-medium" style={{ color: '#15803D' }}>Saved</div>
            </div>
          </div>
        </div>

        <div className="glass-strong p-5 sm:p-7 fade-up">
          <div className="title-section mb-1">Route history</div>
          <div className="text-[12px] mb-5" style={{ color: 'var(--ink-3)' }}>Most recent 100 routes</div>
          {loading ? (
            <div className="text-[13px] py-12 text-center" style={{ color: 'var(--ink-3)' }}>Loading…</div>
          ) : routes.length === 0 ? (
            <div className="text-center py-12 text-[13px]" style={{ color: 'var(--ink-3)' }}>
              No routes yet. Optimize your first route to see analytics.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th><th>Distance</th><th>Duration</th><th>Fuel saved</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--ink)' }}>
                        {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                          {new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="mono">{Number(r.distance_km || 0).toFixed(1)}km</td>
                      <td className="mono">{Number(r.duration_minutes || 0).toFixed(0)}m</td>
                      <td className="mono" style={{ color: 'var(--good)' }}>£{Number(r.fuel_saved_gbp || 0).toFixed(2)}</td>
                      <td>
                        <span className={`pill ${r.status === 'completed' ? 'pill-ok' : r.status === 'in_progress' ? 'pill-info' : 'pill-neutral'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => downloadRouteCSV(r.id)}
                          className="btn btn-glass !py-1.5 !px-3 !text-[12px]"
                          title="Download this route as CSV"
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
      </div>
    </AppShell>
  );
}

function KPI({ label, value, icon: Icon, g, highlight }: any) {
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
        style={highlight ? {
          background: g, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        } : { color: 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}
