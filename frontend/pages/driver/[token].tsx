import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { MapPin, Phone, Check, X, Navigation, Play, Pause, CheckCircle2, Truck } from 'lucide-react';

type Stop = {
  id: string;
  sequence: number;
  status: string;
  eta_clock?: string;
  order: { id: string; customer_name: string; address: string; phone?: string; lat?: number; lng?: number };
};

export default function DriverApp() {
  const router = useRouter();
  const { token } = router.query;
  const [driver, setDriver] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const sb = supabase();
        const { data: drv, error: derr } = await sb.from('drivers').select('*').eq('access_token', token).single();
        if (derr || !drv) {
          setError('Invalid driver link. Check the URL.');
          setLoading(false);
          return;
        }
        setDriver(drv);

        const { data: rts } = await sb.from('routes').select('*').eq('driver_id', drv.id)
          .order('created_at', { ascending: false }).limit(1);
        const latestRoute = rts?.[0];
        if (!latestRoute) {
          setLoading(false);
          return;
        }
        setRoute(latestRoute);

        const { data: stopData } = await sb.from('delivery_stops')
          .select('*, order:orders(*)').eq('route_id', latestRoute.id).order('sequence');
        setStops((stopData as any[]) || []);
        setLoading(false);
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    })();
  }, [token]);

  function startTracking() {
    if (!('geolocation' in navigator)) {
      alert('Geolocation not supported on this device.');
      return;
    }
    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentPos({ lat, lng });
        if (driver) {
          const sb = supabase();
          await sb.from('drivers').update({
            current_lat: lat, current_lng: lng, last_seen: new Date().toISOString(),
          }).eq('id', driver.id);
          if (route) {
            await sb.from('driver_positions').insert({
              driver_id: driver.id, route_id: route.id, lat, lng,
            });
          }
        }
      },
      (err) => {
        alert(`Location error: ${err.message}`);
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 27000 },
    );
  }

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }

  async function updateStopStatus(stopId: string, status: 'delivered' | 'failed') {
    const sb = supabase();
    await sb.from('delivery_stops').update({
      status, completed_at: new Date().toISOString(),
    }).eq('id', stopId);
    setStops((prev) => prev.map((s) => s.id === stopId ? { ...s, status } : s));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[13px]" style={{ color: 'var(--ink-3)' }}>Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-strong p-8 text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white"
               style={{ background: 'var(--bad)' }}>
            <X size={24} />
          </div>
          <div className="title-section mb-2">{error}</div>
        </div>
      </div>
    );
  }

  const pending = stops.filter((s) => s.status === 'pending');
  const completed = stops.filter((s) => s.status === 'delivered' || s.status === 'failed');
  const progress = stops.length > 0 ? (completed.length / stops.length) * 100 : 0;

  return (
    <div className="min-h-screen pb-32">
      {/* Floating header */}
      <header className="sticky top-0 z-30 px-4 sm:px-6 pt-4 pb-3 safe-top"
        style={{
          background: 'var(--glass-strong)',
          backdropFilter: 'blur(32px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
          borderBottom: '1px solid var(--stroke-dark)',
        }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-semibold"
                style={{ background: driver?.color || 'var(--accent)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
                {driver?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-[15px] font-semibold leading-tight">{driver?.name}</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  {driver?.vehicle || 'Driver'}
                </div>
              </div>
            </div>
            {tracking && (
              <div className="pill pill-ok flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />
                Live
              </div>
            )}
          </div>

          {stops.length > 0 && (
            <>
              <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                <span style={{ color: 'var(--ink-3)' }}>{completed.length} of {stops.length} done</span>
                <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>{progress.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(10,31,61,0.08)' }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${driver?.color || 'var(--accent)'}, var(--accent-light))`,
                }} />
              </div>
            </>
          )}
        </div>
      </header>

      <main className="px-4 sm:px-6 py-5 max-w-md mx-auto">
        {stops.length === 0 ? (
          <div className="glass-strong p-10 text-center mt-8 fade-up">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--purple))', boxShadow: '0 8px 20px var(--accent-shadow)' }}>
              <Truck size={22} />
            </div>
            <div className="title-section mb-1.5">No active route</div>
            <div className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              Your dispatcher hasn't sent you a route yet.
            </div>
          </div>
        ) : (
          <>
            {/* Start address card */}
            {driver?.start_address && (
              <div className="glass-elev p-4 mb-3 fade-up">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                       style={{ background: driver.color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
                    <MapPin size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10.5px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-3)' }}>
                      Starts at
                    </div>
                    <div className="text-[13px] font-medium mt-0.5 truncate" style={{ color: 'var(--ink)' }}>
                      {driver.start_address}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <>
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2 mt-2 px-1" style={{ color: 'var(--ink-3)' }}>
                  Up next ({pending.length})
                </div>
                <div className="space-y-2.5 mb-5">
                  {pending.map((stop, idx) => (
                    <StopCard key={stop.id} stop={stop} driver={driver} isNext={idx === 0}
                      onComplete={() => updateStopStatus(stop.id, 'delivered')}
                      onFailed={() => updateStopStatus(stop.id, 'failed')} />
                  ))}
                </div>
              </>
            )}

            {completed.length > 0 && (
              <>
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2 px-1" style={{ color: 'var(--ink-3)' }}>
                  Done ({completed.length})
                </div>
                <div className="space-y-2 mb-5">
                  {completed.map((stop) => (
                    <div key={stop.id} className="glass p-3.5 flex items-center gap-3 opacity-70">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
                           style={{ background: stop.status === 'delivered' ? 'var(--good)' : 'var(--bad)' }}>
                        {stop.status === 'delivered' ? <Check size={14} /> : <X size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium line-through" style={{ color: 'var(--ink-3)' }}>
                          {stop.order.customer_name}
                        </div>
                        <div className="text-[11.5px] truncate" style={{ color: 'var(--ink-mute)' }}>
                          {stop.order.address}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {progress === 100 && (
              <div className="glass-strong p-8 text-center fade-up">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white"
                     style={{ background: 'linear-gradient(135deg, var(--good), #34C759)' }}>
                  <CheckCircle2 size={24} />
                </div>
                <div className="title-section mb-1">All stops complete</div>
                <div className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>Great work today!</div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating action bar */}
      {stops.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 sm:px-6 pt-3 pb-5 safe-bottom"
          style={{
            background: 'linear-gradient(to top, var(--bg) 50%, transparent)',
          }}>
          <div className="max-w-md mx-auto">
            <button onClick={tracking ? stopTracking : startTracking}
              className={`btn w-full !py-3.5 !text-[15px] ${tracking ? 'btn-glass' : 'btn-primary'}`}>
              {tracking ? (
                <><Pause size={16} fill="currentColor" />Pause tracking</>
              ) : (
                <><Play size={15} fill="currentColor" />Start route & share location</>
              )}
            </button>
            {tracking && currentPos && (
              <div className="text-center text-[10.5px] mt-2 mono" style={{ color: 'var(--ink-3)' }}>
                {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StopCard({ stop, driver, isNext, onComplete, onFailed }: {
  stop: Stop; driver: any; isNext: boolean; onComplete: () => void; onFailed: () => void;
}) {
  const navUrl = stop.order.lat && stop.order.lng
    ? `https://maps.apple.com/?daddr=${stop.order.lat},${stop.order.lng}`
    : `https://maps.apple.com/?address=${encodeURIComponent(stop.order.address)}`;

  return (
    <div className={isNext ? 'glass-strong p-4' : 'glass-card p-4'} style={isNext ? {
      borderLeft: `4px solid ${driver?.color || 'var(--accent)'}`,
    } : {}}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-semibold text-white shrink-0"
          style={{ background: driver?.color || 'var(--accent)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
          {stop.sequence}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {stop.order.customer_name}
          </div>
          <div className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--ink-3)' }}>
            {stop.order.address}
          </div>
          {stop.eta_clock && (
            <div className="text-[11px] mt-2 inline-flex items-center gap-1 pill pill-info">
              ETA · {stop.eta_clock}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <a href={navUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-1 !py-2.5 !text-[13px]">
          <Navigation size={13} strokeWidth={2.2} />Navigate
        </a>
        {stop.order.phone && (
          <a href={`tel:${stop.order.phone}`} className="btn btn-glass !py-2.5 !px-3.5">
            <Phone size={13} />
          </a>
        )}
      </div>

      {isNext && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={onComplete} className="btn !py-2.5 !text-[12.5px]"
            style={{
              background: 'rgba(48,209,88,0.12)', color: '#15803D',
              border: '1px solid rgba(48,209,88,0.3)',
            }}>
            <Check size={13} />Delivered
          </button>
          <button onClick={onFailed} className="btn !py-2.5 !text-[12.5px]"
            style={{
              background: 'rgba(255,59,48,0.10)', color: '#B91C1C',
              border: '1px solid rgba(255,59,48,0.25)',
            }}>
            <X size={13} />Failed
          </button>
        </div>
      )}
    </div>
  );
}
