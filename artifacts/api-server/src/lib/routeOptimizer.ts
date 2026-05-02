const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OSRM_BASE = "https://router.project-osrm.org";

const HEADERS = {
  "User-Agent": "ShowingsRouteMapper/1.0 (real-estate-tool)",
  Accept: "application/json",
};

export interface GeocodedLocation {
  address: string;
  label?: string;
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(address: string, label?: string): Promise<GeocodedLocation> {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = (await res.json()) as any[];
  if (!data || data.length === 0) {
    throw new Error(`Could not geocode address: "${address}"`);
  }
  const first = data[0];
  return {
    address,
    label,
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    displayName: first.display_name,
  };
}

export async function buildDistanceMatrix(
  locations: GeocodedLocation[]
): Promise<number[][]> {
  const coords = locations.map((l) => `${l.lng},${l.lat}`).join(";");
  const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=duration,distance`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`OSRM table error: ${res.status}`);
  const data = (await res.json()) as any;
  if (data.code !== "Ok") throw new Error(`OSRM table failed: ${data.code}`);
  return data.distances as number[][];
}

export function nearestNeighborTSP(matrix: number[][], startIdx: number): number[] {
  const n = matrix.length;
  const visited = new Set<number>([startIdx]);
  const order = [startIdx];

  while (visited.size < n) {
    const current = order[order.length - 1];
    let bestNext = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && matrix[current][j] < bestDist) {
        bestDist = matrix[current][j];
        bestNext = j;
      }
    }
    if (bestNext === -1) break;
    visited.add(bestNext);
    order.push(bestNext);
  }

  return order;
}

export interface RouteSegment {
  distanceKm: number;
  durationMinutes: number;
  polyline: number[][];
}

export async function fetchRoutePolyline(
  from: GeocodedLocation,
  to: GeocodedLocation
): Promise<RouteSegment> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`OSRM route error: ${res.status}`);
  const data = (await res.json()) as any;
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`OSRM route failed: ${data.code}`);
  }
  const route = data.routes[0];
  const distanceKm = route.distance / 1000;
  const durationMinutes = route.duration / 60;
  const geojsonCoords: number[][] = route.geometry.coordinates;
  const polyline = geojsonCoords.map(([lng, lat]: number[]) => [lat, lng]);

  return { distanceKm, durationMinutes, polyline };
}
