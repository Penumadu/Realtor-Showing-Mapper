const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const PHOTON_BASE = "https://photon.komoot.io";
const OSRM_BASE = "https://router.project-osrm.org";

const HEADERS = {
  "User-Agent": "ShowingsRouteMapper/1.0 (real-estate-tool)",
  Accept: "application/json",
};

// Common street type abbreviations → full names
const ABBREV_MAP: Record<string, string> = {
  cres: "Crescent",
  crt: "Court",
  ct: "Court",
  ave: "Avenue",
  av: "Avenue",
  blvd: "Boulevard",
  dr: "Drive",
  rd: "Road",
  st: "Street",
  pl: "Place",
  pkwy: "Parkway",
  ln: "Lane",
  terr: "Terrace",
  ter: "Terrace",
  hwy: "Highway",
  expy: "Expressway",
  sq: "Square",
  trl: "Trail",
  wy: "Way",
  cir: "Circle",
  pt: "Point",
  gt: "Gate",
  gdns: "Gardens",
  grn: "Green",
  hts: "Heights",
  mdws: "Meadows",
  vlg: "Village",
};

function expandAbbreviations(address: string): string {
  // Replace word-boundary abbreviations that appear before a comma, end-of-string, or whitespace+digits/province codes
  return address.replace(/\b([A-Za-z]+)\b/g, (match) => {
    const key = match.toLowerCase();
    return ABBREV_MAP[key] ?? match;
  });
}

/** Extract the most likely "city" tokens from the user's raw address for validation */
function extractCityTokens(address: string): string[] {
  // Split by comma, take the second segment onward — usually "City, Province Country"
  const parts = address.split(",").slice(1).join(" ").toLowerCase();
  return parts
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter((t) => t.length > 2);
}

function photonResultMatchesCity(result: any, cityTokens: string[]): boolean {
  if (cityTokens.length === 0) return true;
  const p = result.properties;
  const resultText = [p.city, p.locality, p.district, p.county, p.state]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return cityTokens.some((token) => resultText.includes(token));
}

// Generic street type words that shouldn't be used for street identity matching
const STREET_TYPE_WORDS = new Set([
  "street", "avenue", "boulevard", "drive", "road", "place", "court", "crescent",
  "lane", "way", "circle", "trail", "terrace", "parkway", "highway", "expressway",
  "square", "gate", "gardens", "green", "heights", "meadows", "village", "point",
  "north", "south", "east", "west", "nw", "ne", "sw", "se",
]);

/** Extract the unique street name portion (excluding house number and street type words) */
function extractStreetTokens(address: string): string[] {
  const streetPart = address.split(",")[0].toLowerCase();
  return streetPart
    .replace(/^\d+\s*/, "")
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter((t) => t.length > 2 && !STREET_TYPE_WORDS.has(t));
}

function photonResultMatchesStreet(result: any, streetTokens: string[]): boolean {
  if (streetTokens.length === 0) return true;
  const street = (result.properties.street ?? "").toLowerCase();
  // At least one significant street token must appear in the result street name
  return streetTokens.some((token) => street.includes(token));
}

export interface GeocodedLocation {
  address: string;
  label?: string;
  lat: number;
  lng: number;
  displayName: string;
}

async function tryNominatim(
  query: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = (await res.json()) as any[];
    if (!data || data.length === 0) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}

async function tryArcGIS(
  query: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(query)}&f=json&maxLocations=1`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    if (!data.candidates || data.candidates.length === 0) return null;
    const candidate = data.candidates[0];
    return {
      lat: candidate.location.y,
      lng: candidate.location.x,
      displayName: candidate.address,
    };
  } catch {
    return null;
  }
}

async function tryPhoton(
  query: string,
  cityTokens: string[],
  streetTokens: string[]
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = `${PHOTON_BASE}/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const features = data?.features;
    if (!features || features.length === 0) return null;

    // Pick the first result that matches both city AND street name
    const match = features.find(
      (f: any) =>
        photonResultMatchesCity(f, cityTokens) && photonResultMatchesStreet(f, streetTokens)
    );
    if (!match) return null;

    const p = match.properties;
    const parts = [
      p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
      p.city || p.locality,
      p.state,
      p.country,
    ].filter(Boolean);
    return {
      lat: match.geometry.coordinates[1],
      lng: match.geometry.coordinates[0],
      displayName: parts.join(", "),
    };
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string, label?: string): Promise<GeocodedLocation> {
  const expanded = expandAbbreviations(address);
  const cityTokens = extractCityTokens(address);
  const streetTokens = extractStreetTokens(expanded);

  // Build query variants: expanded form first, then original if different
  const queries = Array.from(new Set([expanded, address]));

  for (const query of queries) {
    // Try ArcGIS first as it has the best coverage for new addresses
    const arcgisResult = await tryArcGIS(query);
    if (arcgisResult) {
      return { address, label, ...arcgisResult };
    }

    const nominatimResult = await tryNominatim(query);
    if (nominatimResult) {
      return { address, label, ...nominatimResult };
    }

    // Small pause before Photon to avoid hammering services
    await new Promise((resolve) => setTimeout(resolve, 300));

    const photonResult = await tryPhoton(query, cityTokens, streetTokens);
    if (photonResult) {
      return { address, label, ...photonResult };
    }
  }

  throw new Error(
    `"${address}" was not found. Try the full format: street number + full street name + city + province/state + country (e.g. "77 Cattail Crescent, Hamilton, ON, Canada"). If the street is still not found, try entering a nearby intersection or postal code instead.`
  );
}

export async function buildDistanceMatrix(locations: GeocodedLocation[]): Promise<number[][]> {
  const coords = locations.map((l) => `${l.lng},${l.lat}`).join(";");
  const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=duration,distance`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(1500) });
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
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(1500) });
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
