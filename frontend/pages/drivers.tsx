import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Topbar from '@/components/Topbar';
import { supabase } from '@/lib/supabase';
import { apiGeocodeBatch } from '@/lib/api';
import type { Driver } from '@/lib/types';
import { Plus, Trash2, Copy, Smartphone, X, Check, Truck, MapPin } from 'lucide-react';

const COLORS = ['#0071E3', '#5AC8FA', '#30D158', '#AF52DE', '#FF9500', '#FF3B30', '#FF2D55', '#5856D6'];

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', vehicle: '', capacity: 30, color: COLORS[0],
    start_address: '',
  });

  async function refresh() {
    const { data } = await supabase().from('drivers').select('*').order('created_at', { ascending: false });
    setDrivers((data as Driver[]) || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setAdding(false); return; }

    // Geocode start address if provided
    let startCoords: any = {};
    if (form.start_address.trim()) {
      try {
        const result = await apiGeocodeBatch([{ address: form.start_address, country: 'GB' }]);
        const r = result.results[0]?.result;
        if (r) {
          startCoords = { start_lat: r.lat, start_lng: r.lng };
        }
      } catch (e: any) {
        console.warn('Geocoding start address failed:', e.message);
      }
    }

    const { error } = await sb.from('drivers').insert({
      name: form.name,
      phone: form.phone || null,
      vehicle: form.vehicle || null,
      capacity: form.capacity,
      color: form.color,
      start_address: form.start_address || null,
      ...startCoords,
      user_id: user.id,
    });
    if (error) {
      alert(`Failed to add driver: ${error.message}`);
      setAdding(false);
      return;
    }

    setForm({
      name: '', phone: '', vehicle: '', capacity: 30,
      color: COLORS[(drivers.length + 1) % COLORS.length],
      start_address: '',
    });
    setShowAdd(false);
    await refresh();
    setAdding(false);
  }

  async function deleteDriver(id: string) {
    if (!confirm('Delete this driver?')) return;
    await supabase().from('drivers').delete().eq('id', id);
    await refresh();
  }

  function copyDriverLink(token: string, id: string) {
    const url = `${location.origin}/driver/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(`d-${id}`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <AppShell>
      <Topbar
        title="Drivers"
        subtitle={`${drivers.length} in fleet · Each has a unique app link`}
        actions={
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary">
            <Plus size={14} />Add driver
          </button>
        }
      />

      <div className="px-5 sm:px-8 pb-8 space-y-5">
        {showAdd && (
          <div className="glass-strong p-5 sm:p-6 fade-up">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="title-section">New driver</div>
                <div className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>
                  Start address is where the driver begins each route
                </div>
              </div>
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost !p-2"><X size={14} /></button>
            </div>

            <form onSubmit={addDriver} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="fld">Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Sarah Johnson" />
              </div>
              <div>
                <label className="fld">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07700 900123" />
              </div>
              <div>
                <label className="fld">Vehicle</label>
                <input className="input" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="VW Crafter" />
              </div>
              <div>
                <label className="fld">Capacity (stops)</label>
                <input type="number" className="input" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 30 })} />
              </div>
              <div className="md:col-span-2">
                <label className="fld">
                  Start address <span style={{ color: 'var(--ink-mute)' }}>· where this driver begins each route</span>
                </label>
                <input className="input" value={form.start_address} onChange={(e) => setForm({ ...form, start_address: e.target.value })}
                  placeholder="123 Warehouse Rd, London SE1 2AB" />
              </div>
              <div className="md:col-span-2">
                <label className="fld">Marker color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className="w-10 h-10 rounded-full transition-all"
                      style={{
                        background: c,
                        transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                        boxShadow: form.color === c
                          ? `0 0 0 3px white, 0 0 0 5px ${c}, 0 8px 16px ${c}40`
                          : '0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3)',
                      }} />
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-glass">Cancel</button>
                <button type="submit" disabled={adding} className="btn btn-primary">
                  {adding ? 'Adding…' : 'Add driver'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-[13px] py-12 text-center" style={{ color: 'var(--ink-3)' }}>Loading…</div>
        ) : drivers.length === 0 ? (
          <div className="glass-strong p-12 sm:p-16 text-center fade-up">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--purple))', boxShadow: '0 8px 20px var(--accent-shadow)' }}>
              <Truck size={26} strokeWidth={1.8} />
            </div>
            <div className="title-section mb-1.5">No drivers yet</div>
            <div className="text-[13px] mb-5" style={{ color: 'var(--ink-3)' }}>
              Add your first driver to start optimizing routes.
            </div>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary mx-auto">
              <Plus size={14} />Add your first driver
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map((d) => {
              const initials = d.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
              return (
                <div key={d.id} className="glass-card p-5 fade-up">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-semibold text-white text-[14px] shrink-0"
                      style={{ background: d.color, boxShadow: `0 6px 14px ${d.color}40, inset 0 1px 0 rgba(255,255,255,0.3)` }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14.5px] truncate" style={{ color: 'var(--ink)' }}>{d.name}</div>
                      <div className="text-[11.5px] truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
                        {d.vehicle || 'Vehicle not set'}
                      </div>
                    </div>
                    <button onClick={() => deleteDriver(d.id)} className="btn-danger-ghost rounded-full !p-2">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {d.start_address && (
                    <div className="mb-3 p-2.5 rounded-xl flex items-start gap-2"
                         style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid var(--stroke)' }}>
                      <MapPin size={13} className="mt-0.5 shrink-0" style={{ color: d.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-3)' }}>Starts at</div>
                        <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--ink-2)' }} title={d.start_address}>
                          {d.start_address}
                          {d.start_lat ? <span className="ml-1.5 pill pill-ok">✓ geocoded</span> : <span className="ml-1.5 pill pill-warn">no coords</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 text-center rounded-xl" style={{ background: 'rgba(255,255,255,0.5)' }}>
                      <div className="text-[22px] font-semibold leading-none">{d.capacity}</div>
                      <div className="text-[10px] uppercase tracking-wider mt-1.5 font-medium" style={{ color: 'var(--ink-3)' }}>Capacity</div>
                    </div>
                    <div className="p-3 text-center rounded-xl" style={{ background: 'rgba(255,255,255,0.5)' }}>
                      <div className="mono text-[13px] truncate" title={d.phone}>{d.phone || '—'}</div>
                      <div className="text-[10px] uppercase tracking-wider mt-1.5 font-medium" style={{ color: 'var(--ink-3)' }}>Phone</div>
                    </div>
                  </div>

                  <button onClick={() => copyDriverLink(d.access_token, d.id)} className="btn btn-glass w-full !py-2.5 !text-[12px]">
                    {copiedId === `d-${d.id}` ? (
                      <><Check size={12} style={{ color: 'var(--good)' }} /> Copied</>
                    ) : (
                      <><Smartphone size={12} /> Copy driver app link <Copy size={11} /></>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
