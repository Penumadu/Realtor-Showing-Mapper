import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { OptimizedRoute } from '@workspace/api-client-react';

// Fix for default marker icons in Leaflet with webpack/vite
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface MapViewProps {
  route: OptimizedRoute | null;
}

export default function MapView({ route }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([39.8283, -98.5795], 4); // Default to US center

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !route) return;

    const map = mapInstanceRef.current;

    // Clear existing markers and polyline
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Add new markers
    route.stops.forEach((stop, index) => {
      const isStart = index === 0;
      const markerHtml = `
        <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 ${isStart ? 'bg-primary border-primary-foreground text-primary-foreground' : 'bg-background border-primary text-primary'} font-bold shadow-md">
          ${index + 1}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon })
        .bindPopup(`<strong>${index + 1}. ${stop.label || stop.address}</strong><br/>${stop.displayName}`)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Add polyline
    if (route.polyline && route.polyline.length > 0) {
      const latLngs = route.polyline.map(p => [p[0], p[1]] as L.LatLngExpression);
      polylineRef.current = L.polyline(latLngs, { color: 'hsl(var(--primary))', weight: 4, opacity: 0.8 }).addTo(map);
    }

    // Fit bounds
    if (route.stops.length > 0) {
      const bounds = L.latLngBounds(route.stops.map(stop => [stop.lat, stop.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [route]);

  return <div ref={mapContainerRef} className="w-full h-full rounded-lg overflow-hidden border bg-muted" />;
}