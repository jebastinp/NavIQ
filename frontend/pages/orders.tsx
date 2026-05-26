import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import AppShell from '@/components/AppShell';
import Topbar from '@/components/Topbar';
import { supabase } from '@/lib/supabase';
import { apiGeocodeBatch } from '@/lib/api';
import type { Order } from '@/lib/types';
import {
  Plus, MapPin, Upload as UploadIcon, Trash2, CheckCircle2, X, FileText,
  AlertCircle, Sparkles,
} from 'lucide-react';

type ParsedRow = {
  customer_name: string;
  address: string;
  phone?: string;
  valid: boolean;
  reasons: string[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customer_name: '', address: '', phone: '' });
  const [adding, setAdding] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase().from('orders').select('*').order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  function validateRow(r: any): ParsedRow {
    const customer_name = (r['Customer Name'] || r['Name'] || r.customer_name || r.name || '').trim();
    const address = (r['Address'] || r.address || '').trim();
    const phone = (r['Phone'] || r['Phone Number'] || r.phone || '').trim();
    const reasons: string[] = [];
    if (!customer_name) reasons.push('missing name');
    if (!address) reasons.push('missing address');
    if (address && address.length < 5) reasons.push('address too short');
    return { customer_name, address, phone, valid: reasons.length === 0, reasons };
  }

  function parseFile(file: File) {
    setUploadMsg(null);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as any[]).map(validateRow);
        setParsed(rows);
        const valid = rows.filter((r) => r.valid).length;
        setUploadMsg(`Parsed ${rows.length} rows · ${valid} valid · ${rows.length - valid} invalid`);
      },
      error: (err) => setUploadMsg(`Parse error: ${err.message}`),
    });
  }

  function loadDemo() {
    fetch('/sample-orders.csv').then((r) => r.text()).then((text) => {
      const file = new File([new Blob([text])], 'sample.csv');
      parseFile(file);
    });
  }

  async function importValid() {
    const valid = parsed.filter((r) => r.valid);
    if (!valid.length) return;
    setImporting(true);
    setUploadMsg('Geocoding addresses…');
    try {
      const sb = supabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('Not signed in');

      let geocoded: Array<{ lat?: number; lng?: number; geocoded: boolean }> = valid.map(() => ({ geocoded: false }));
      try {
        const items = valid.map((r) => ({ address: r.address, country: 'GB' }));
        const result = await apiGeocodeBatch(items);
        geocoded = result.results.map((res: any) => res.result
          ? { lat: res.result.lat, lng: res.result.lng, geocoded: true }
          : { geocoded: false });
      } catch (e: any) {
        setUploadMsg(`Geocoding failed: ${e.message} · saving without coords`);
      }

      setUploadMsg('Saving…');
      const payload = valid.map((r, i) => ({
        customer_name: r.customer_name, address: r.address,
        phone: r.phone || null, ...geocoded[i], user_id: user.id,
      }));
      const { error } = await sb.from('orders').insert(payload);
      if (error) throw error;

      const succeeded = geocoded.filter((g) => g.geocoded).length;
      setUploadMsg(`✓ Imported ${valid.length} · ${succeeded} geocoded`);
      setParsed([]);
      await refresh();
    } catch (e: any) {
      setUploadMsg(`Failed: ${e.message}`);
    }
    setImporting(false);
  }

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setAdding(false); return; }

    let geo: any = { geocoded: false };
    try {
      const result = await apiGeocodeBatch([{ address: form.address, country: 'GB' }]);
      const r = result.results[0]?.result;
      if (r) geo = { lat: r.lat, lng: r.lng, geocoded: true };
    } catch {}

    await sb.from('orders').insert({ ...form, ...geo, user_id: user.id });
    setForm({ customer_name: '', address: '', phone: '' });
    setShowAdd(false);
    await refresh();
    setAdding(false);
  }

  async function geocodeAll() {
    const pending = orders.filter((o) => !o.geocoded);
    if (!pending.length) return;
    setGeocoding(true);
    try {
      const items = pending.map((o) => ({ address: o.address, country: 'GB' }));
      const result = await apiGeocodeBatch(items);
      const sb = supabase();
      for (let i = 0; i < pending.length; i++) {
        const r = result.results[i]?.result;
        if (r) await sb.from('orders').update({ lat: r.lat, lng: r.lng, geocoded: true }).eq('id', pending[i].id);
      }
      await refresh();
    } catch (e: any) { alert(`Geocoding failed: ${e.message}`); }
    setGeocoding(false);
  }

  async function deleteOrder(id: string) {
    if (!confirm('Delete this order?')) return;
    await supabase().from('orders').delete().eq('id', id);
    await refresh();
  }

  async function deleteAll() {
    if (!confirm(`Delete ALL ${orders.length} orders?`)) return;
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from('orders').delete().eq('user_id', user.id);
    await refresh();
  }

  const pendingGeo = orders.filter((o) => !o.geocoded).length;
  const validCount = parsed.filter((r) => r.valid).length;

  return (
    <AppShell>
      <Topbar
        title="Orders"
        subtitle={`${orders.length} total · ${pendingGeo} pending geocoding`}
        actions={
          <>
            <button onClick={() => setShowAdd(!showAdd)} className="btn btn-glass"><Plus size={14} />Add</button>
            {pendingGeo > 0 && (
              <button onClick={geocodeAll} disabled={geocoding} className="btn btn-primary">
                <MapPin size={14} />{geocoding ? 'Geocoding…' : `Geocode ${pendingGeo}`}
              </button>
            )}
          </>
        }
      />

      <div className="px-5 sm:px-8 pb-8 space-y-5">
        {showAdd && (
          <div className="glass-strong p-5 sm:p-6 fade-up">
            <div className="flex items-center justify-between mb-5">
              <div className="title-section">Add order</div>
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost !p-2"><X size={14} /></button>
            </div>
            <form onSubmit={addOrder} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="fld">Customer name</label>
                <input className="input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
              </div>
              <div>
                <label className="fld">Address</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required placeholder="221B Baker St, London" />
              </div>
              <div>
                <label className="fld">Phone <span style={{ color: 'var(--ink-mute)' }}>· optional</span></label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button type="submit" disabled={adding} className="btn btn-primary">
                  {adding ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        )}

        {parsed.length === 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
            onClick={() => fileRef.current?.click()}
            className="p-10 sm:p-12 text-center cursor-pointer transition-all fade-up"
            style={{
              borderStyle: 'dashed',
              borderWidth: '2px',
              borderColor: dragging ? 'var(--accent)' : 'var(--stroke-strong)',
              background: dragging ? 'var(--accent-tint)' : 'var(--glass)',
              backdropFilter: 'blur(20px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
              borderRadius: '24px',
            }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                boxShadow: '0 8px 20px var(--accent-shadow)',
              }}>
              <UploadIcon size={22} strokeWidth={2} />
            </div>
            <div className="title-section mb-1.5">Drop your CSV here</div>
            <div className="text-[12.5px] mb-5" style={{ color: 'var(--ink-3)' }}>
              Required columns: <code className="mono" style={{ color: 'var(--ink-2)' }}>Customer Name</code>,{' '}
              <code className="mono" style={{ color: 'var(--ink-2)' }}>Address</code>,{' '}
              <code className="mono" style={{ color: 'var(--ink-2)' }}>Phone</code>
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              <button type="button" className="btn btn-glass" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                <FileText size={14} />Browse files
              </button>
              <button type="button" className="btn btn-primary" onClick={(e) => { e.stopPropagation(); loadDemo(); }}>
                <Sparkles size={14} />Load demo
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          </div>
        )}

        {parsed.length > 0 && (
          <div className="glass-strong p-5 sm:p-6 fade-up">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <div className="title-section">Verify upload</div>
                <div className="text-[12px] mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="pill pill-ok">{validCount} valid</span>
                  <span className="pill pill-bad">{parsed.length - validCount} invalid</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setParsed([]); setUploadMsg(null); }} className="btn btn-glass"><X size={14} />Cancel</button>
                <button onClick={importValid} disabled={importing || validCount === 0} className="btn btn-primary">
                  <UploadIcon size={14} />{importing ? 'Importing…' : `Import ${validCount}`}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="data">
                <thead>
                  <tr><th style={{ width: 40 }}></th><th>Customer</th><th>Address</th><th>Phone</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td>{r.valid ? <CheckCircle2 size={15} style={{ color: 'var(--good)' }} /> : <AlertCircle size={15} style={{ color: 'var(--bad)' }} />}</td>
                      <td style={{ color: 'var(--ink)' }}>{r.customer_name || '—'}</td>
                      <td>{r.address || '—'}</td>
                      <td className="mono">{r.phone || '—'}</td>
                      <td>{r.valid ? <span className="pill pill-ok">valid</span> : <span className="pill pill-bad">{r.reasons.join(', ')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {uploadMsg && (
          <div className="glass px-4 py-3 text-[13px]" style={{ color: uploadMsg.startsWith('✓') ? 'var(--good)' : 'var(--ink-2)' }}>
            {uploadMsg}
          </div>
        )}

        <div className="glass-strong p-5 sm:p-6 fade-up">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="title-section">All orders</div>
              <div className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>{orders.length} total</div>
            </div>
            {orders.length > 0 && (
              <button onClick={deleteAll} className="btn btn-danger-ghost"><Trash2 size={14} />Clear</button>
            )}
          </div>
          {loading ? (
            <div className="text-[13px] py-12 text-center" style={{ color: 'var(--ink-3)' }}>Loading…</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-[13px]" style={{ color: 'var(--ink-3)' }}>
              No orders yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr><th>Customer</th><th>Address</th><th>Phone</th><th>Geo</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--ink)' }}>{o.customer_name}</td>
                      <td className="max-w-[260px] truncate" title={o.address}>{o.address}</td>
                      <td className="mono">{o.phone || '—'}</td>
                      <td>{o.geocoded ? <span className="pill pill-ok">✓</span> : <span className="pill pill-warn">pending</span>}</td>
                      <td><span className="pill pill-neutral">{o.status}</span></td>
                      <td>
                        <button onClick={() => deleteOrder(o.id)} className="btn-danger-ghost rounded-full !p-2">
                          <Trash2 size={13} />
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
