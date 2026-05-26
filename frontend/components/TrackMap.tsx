import { useEffect, useRef, useState } from 'react';

type Props = {
  stopLat: number;
  stopLng: number;
  driverPos: { lat: number; lng: number } | null;
  driverColor: string;
};

export default function TrackMap({ stopLat, stopLng, driverPos, driverColor }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapObj.current) return;
    let cancelled = false;
    let initTimeout: any;

    (async () => {
      try {
        const L = (await import('leaflet')).default;
        if (cancelled || !mapRef.current) return;

        const map = L.map(mapRef.current, {
          zoomControl: true, attributionControl: false,
          preferCanvas: true, fadeAnimation: false,
        }).setView([stopLat, stopLng], 14);

        const tileLayer = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          { maxZoom: 19, subdomains: 'abcd' as any, updateWhenIdle: false, keepBuffer: 4, crossOrigin: true },
        );
        let errorCount = 0;
        tileLayer.on('tileerror', () => {
          errorCount++;
          if (errorCount > 3) tileLayer.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
        });
        tileLayer.addTo(map);

        const stopIcon = L.divIcon({
          className: '',
          html: `<div class="stop-marker" style="background:${driverColor};width:36px;height:36px;font-size:15px">📍</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18],
        });
        L.marker([stopLat, stopLng], { icon: stopIcon }).addTo(map);

        mapObj.current = map;
        setReady(true);
      } catch (err) {
        console.error('[track-map] init:', err);
        setLoadError(true);
      }
    })();

    initTimeout = setTimeout(() => {
      if (!mapObj.current && !cancelled) setLoadError(true);
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(initTimeout);
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; }
    };
  }, [stopLat, stopLng, driverColor]);

  useEffect(() => {
    if (!ready || !mapObj.current || !driverPos) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const icon = L.divIcon({
        className: '',
        html: `<div class="driver-marker" style="border:3px solid ${driverColor}"></div>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      });
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
      } else {
        driverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], { icon }).addTo(mapObj.current);
      }
      const bounds = L.latLngBounds([[stopLat, stopLng], [driverPos.lat, driverPos.lng]]);
      mapObj.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
    })();
  }, [ready, driverPos, stopLat, stopLng, driverColor]);

  return (
    <div className="relative w-full h-full">
      {!ready && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
             style={{ background: 'var(--bg)' }}>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"
                 style={{ color: 'var(--accent)' }} />
            <div className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>Loading map…</div>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--bg)' }}>
          <div className="text-center px-6">
            <div className="text-[32px] mb-2 opacity-40">🗺️</div>
            <div className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>Map couldn't load.</div>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
