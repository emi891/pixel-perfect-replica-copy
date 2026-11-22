export interface LatLon {
  lat: number;
  lon: number;
}

export const RADII = [500, 1000, 2000, 5000] as const;
export type Radius = (typeof RADII)[number];

/** Rough bounding box of Croatia with a small margin (lon/lat). */
export const CROATIA_BOUNDS: [[number, number], [number, number]] = [
  [13.2, 42.2],
  [19.6, 46.7],
];

export const CROATIA_CENTER: LatLon = { lat: 44.7, lon: 16.4 };

export function isInCroatiaBounds({ lat, lon }: LatLon): boolean {
  const [[w, s], [e, n]] = CROATIA_BOUNDS;
  return lat >= s && lat <= n && lon >= w && lon <= e;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at `distance` metres from `origin` along `bearingDeg`. */
export function destination(origin: LatLon, distance: number, bearingDeg: number): LatLon {
  const δ = distance / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lon);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lon: (λ2 * 180) / Math.PI };
}

/** GeoJSON polygon ring approximating a circle. */
export function circleRing(center: LatLon, radius: number, steps = 96): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const p = destination(center, radius, (i / steps) * 360);
    ring.push([p.lon, p.lat]);
  }
  return ring;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function formatRadius(radius: number): string {
  return radius < 1000 ? `${radius} m` : `${radius / 1000} km`;
}
