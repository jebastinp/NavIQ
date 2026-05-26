import { useEffect, useRef, useState } from 'react';
import type { OptimizeResponse, Profile, Driver } from '@/lib/types';

type Props = {
  optimization: OptimizeResponse | null;
  profile: Profile | null;
  drivers?: Driver[];
  driverPositions?: Record<string, { lat: number; lng: number }>;
};

export default function RouteMap({ optimization, profile, drivers, driverPositions }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
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
          zoomControl: false, preferCanvas: true, fadeAnimation: false,
        }).setView(
          [Number(profile?.depot_lat) || 51.5095, Number(profile?.depot_lng) || -0.1245],
          12,
        );

        const tileLayer = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          {
            maxZoom: 19, subdomains: 'abcd' as any,
            attribution: '© OpenStreetMap, © CARTO',
            updateWhenIdle: false, keepBuffer: 4, crossOrigin: true,
          },
        );

        let errorCount = 0;
        tileLayer.on('tileerror', () => {
          errorCount++;
          if (errorCount > 3) tileLayer.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
        });

        tileLayer.addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapObj.current = map;
        setReady(true);
      } catch (err) {
        console.error('[map] init:', err);
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
  }, []);

  useEffect(() => {
    if (!ready || !mapObj.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const map = mapObj.current;

      layersRef.current.forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      const allPoints: [number, number][] = [];

      if (!optimization || optimization.routes.length === 0) {
        const depotLat = Number(profile?.depot_lat) || 51.5095;
        const depotLng = Number(profile?.depot_lng) || -0.1245;
        const depotIcon = L.divIcon({
          className: '',
          html: '<div class="depot-marker">D</div>',
          iconSize: [32, 32], iconAnchor: [16, 16],
        });
        const m = L.marker([depotLat, depotLng], { icon: depotIcon })
          .addTo(map).bindPopup(`<b>${profile?.depot_address || 'Depot'}</b>`);
        layersRef.current.push(m);
        map.setView([depotLat, depotLng], 12);
        return;
      }

      optimization.routes.forEach((route) => {
        if (route.stops.length === 0) return;
        const startLat = Number(route.start_lat);
        const startLng = Number(route.start_lng);
        const driver = drivers?.find((d) => d.id === route.driver_id);

        const startIcon = L.divIcon({
          className: '',
          html: `<div class="start-marker" style="background:${route.driver_color}">S</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15],
        });
        const startMarker = L.marker([startLat, startLng], { icon: startIcon })
          .addTo(map)
          .bindPopup(`<b>${route.driver_name}</b><br>Starts here<br>${driver?.start_address || ''}`);
        layersRef.current.push(startMarker);
        allPoints.push([startLat, startLng]);

        const coords: [number, number][] = [
          [startLat, startLng],
          ...route.stops.map((s) => [s.lat, s.lng] as [number, number]),
          [startLat, startLng],
        ];
        const polyline = L.polyline(coords, {
          color: route.driver_color, weight: 3.5, opacity: 0.85, smoothFactor: 1.5,
        }).addTo(map);
        layersRef.current.push(polyline);

        route.stops.forEach((stop, sidx) => {
          allPoints.push([stop.lat, stop.lng]);
          const icon = L.divIcon({
            className: '',
            html: `<div class="stop-marker" style="background:${route.driver_color}">${sidx + 1}</div>`,
            iconSize: [30, 30], iconAnchor: [15, 15],
          });
          const m = L.marker([stop.lat, stop.lng], { icon }).addTo(map)
            .bindPopup(`<b>${stop.customer_name}</b><br>${stop.address}<br><br>ETA: <b>${stop.eta_clock}</b><br>Driver: ${route.driver_name}`);
          layersRef.current.push(m);
        });
      });

      if (driverPositions) {
        for (const [driverId, pos] of Object.entries(driverPositions)) {
          const route = optimization.routes.find((r) => r.driver_id === driverId);
          const color = route?.driver_color || '#0071E3';
          const icon = L.divIcon({
            className: '',
            html: `<div class="driver-marker" style="border:3px solid ${color}"></div>`,
            iconSize: [24, 24], iconAnchor: [12, 12],
          });
          const m = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
          layersRef.current.push(m);
        }
      }

      if (allPoints.length > 1) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [60, 60], animate: false });
      }
    })();
  }, [ready, optimization, profile, drivers, driverPositions]);

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
          <div className="text-center max-w-sm px-6">
            <div className="text-[40px] mb-3 opacity-40">🗺️</div>
            <div className="text-[14px] mb-2" style={{ color: 'var(--ink-2)' }}>Map couldn't load</div>
            <div className="text-[12px] mb-4" style={{ color: 'var(--ink-3)' }}>Tile servers may be blocked. Routes are still saved.</div>
            <button onClick={() => window.location.reload()} className="btn btn-glass text-[12px]">Retry</button>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
