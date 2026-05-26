import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { MapPin, Truck, CheckCircle2, Clock, Package } from 'lucide-react';

const TrackMap = dynamic(() => import('@/components/TrackMap'), { ssr: false });

export default function TrackPage() {
  const router = useRouter();
  const { token } = router.query;
  const [stop, setStop] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const sb = supabase();
        const { data: stopData, error: stopErr } = await sb.from('delivery_stops')
          .select('*, order:orders(*), route:routes(*, driver:drivers(*))')
          .eq('customer_tracking_token', token).single();

        if (stopErr || !stopData) {
          setError('Tracking link is invalid or expired.');
          setLoading(false);
          return;
        }
        setStop(stopData);
        setDriver(stopData.route?.driver);
        if (stopData.route?.driver?.current_lat) {
          setDriverPos({
            lat: Number(stopData.route.driver.current_lat),
            lng: Number(stopData.route.driver.current_lng),
          });
        }
        setLoading(false);
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    })();
  }, [token]);

  // Subscribe to driver position updates
  useEffect(() => {
    if (!driver?.id) return;
    const sb = supabase();
    const channel = sb.channel(`track-${driver.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'driver_positions',
        filter: `driver_id=eq.${driver.id}`,
      }, (payload: any) => {
        setDriverPos({ lat: Number(payload.new.lat), lng: Number(payload.new.lng) });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [driver]);

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
            <Package size={24} />
          </div>
          <div className="title-section mb-2">{error}</div>
        </div>
      </div>
    );
  }

  const status = stop?.status || 'pending';
  const statusInfo: any = {
    pending: { label: 'Out for delivery', color: '#0071E3', icon: Truck },
    delivered: { label: 'Delivered', color: '#30D158', icon: CheckCircle2 },
    failed: { label: 'Delivery failed', color: '#FF3B30', icon: Package },
  }[status] || { label: status, color: '#5C6E8C', icon: Package };

  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen pb-8">
      <header className="px-4 sm:px-6 pt-6 pb-3 safe-top">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 0-8 8c0 1.892.402 3.13 1.5 4.5L12 22l6.5-7.5c1.098-1.37 1.5-2.608 1.5-4.5a8 8 0 0 0-8-8z" />
              </svg>
            </div>
            <div className="text-[12.5px] font-semibold tracking-tight" style={{ color: 'var(--ink-2)' }}>NavIQ</div>
          </div>
          <div className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>Live delivery tracking</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 max-w-md mx-auto space-y-3">
        {/* Status card */}
        <div className="glass-strong p-5 fade-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
              style={{ background: statusInfo.color, boxShadow: `0 6px 14px ${statusInfo.color}40, inset 0 1px 0 rgba(255,255,255,0.3)` }}>
              <StatusIcon size={22} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-3)' }}>Status</div>
              <div className="text-[18px] font-semibold leading-tight" style={{ color: statusInfo.color }}>
                {statusInfo.label}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)' }}>
              <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-3)' }}>For</div>
              <div className="text-[13.5px] font-semibold mt-1 truncate" style={{ color: 'var(--ink)' }}>
                {stop?.order?.customer_name}
              </div>
            </div>
            {stop?.eta_clock && (
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-3)' }}>ETA</div>
                <div className="text-[13.5px] font-semibold mt-1 mono" style={{ color: 'var(--accent)' }}>
                  {stop.eta_clock}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Driver card */}
        {driver && (
          <div className="glass p-4 fade-up">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-semibold text-white shrink-0"
                style={{ background: driver.color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
                {driver.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10.5px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-3)' }}>
                  Your driver
                </div>
                <div className="text-[14px] font-semibold mt-0.5 truncate" style={{ color: 'var(--ink)' }}>
                  {driver.name}
                </div>
                {driver.vehicle && (
                  <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--ink-3)' }}>
                    {driver.vehicle}
                  </div>
                )}
              </div>
              {driverPos && (
                <div className="pill pill-ok flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />
                  Live
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery address */}
        <div className="glass p-4 fade-up">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))' }}>
              <MapPin size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-3)' }}>
                Delivery to
              </div>
              <div className="text-[13.5px] mt-0.5" style={{ color: 'var(--ink)' }}>
                {stop?.order?.address}
              </div>
            </div>
          </div>
        </div>

        {/* Live map */}
        {stop?.order?.lat && stop?.order?.lng && (
          <div className="glass p-2 fade-up" style={{ height: 360 }}>
            <div className="w-full h-full rounded-2xl overflow-hidden">
              <TrackMap
                stopLat={Number(stop.order.lat)}
                stopLng={Number(stop.order.lng)}
                driverPos={driverPos}
                driverColor={driver?.color || '#0071E3'}
              />
            </div>
          </div>
        )}

        <div className="text-center text-[10.5px] pt-3" style={{ color: 'var(--ink-mute)' }}>
          Powered by <span style={{ color: 'var(--accent)' }}>NavIQ</span>
        </div>
      </main>
    </div>
  );
}
