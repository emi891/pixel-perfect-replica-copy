/**
 * Isomorphic data layer: runs in the browser first (public OSM services are
 * meant for browser use and need no keys) and on the server as a fallback via
 * bizmap.functions.ts. Each provider maps an upstream API onto Bizmap's
 * DTOs (Business, AreaCounts, PlaceResult). To add a provider (e.g. Google
 * Places once licensed), implement the same functions and merge through
 * dedupeBusinesses — never return invented records.
 */
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { destination, haversineMeters, type LatLon } from "@/lib/geo";
import { dedupeBusinesses } from "./dedupe";
import type { AreaContextResult, AreaCounts, Business, CompetitorResult, PlaceResult, SourceInfo } from "./types";

const USER_AGENT = "Bizmap/0.1 (business location intelligence for Croatia)";
const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
/** Start the next mirror if the previous one hasn't answered within this time. */
const OVERPASS_HEDGE_MS = 5_000;
const PHOTON = "https://photon.komoot.io";
const PHOTON_LIMIT = 50;

/* ---------------- tiny per-isolate cache ---------------- */
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 15 * 60 * 1000;
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}

const IS_SERVER = typeof window === "undefined";

async function fetchJson(url: string, init: RequestInit, timeoutMs: number, outer?: AbortSignal): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const onOuter = () => ctrl.abort();
  outer?.addEventListener("abort", onOuter);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      // Browsers set their own User-Agent; adding one there would force a CORS preflight.
      headers: { ...(IS_SERVER ? { "User-Agent": USER_AGENT } : {}), ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
    outer?.removeEventListener("abort", onOuter);
  }
}

/* ---------------- Overpass (OpenStreetMap) ---------------- */
interface OverpassElement {
  type: "node" | "way" | "relation" | "count";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface OverpassResponse {
  osm3s?: { timestamp_osm_base?: string };
  elements: OverpassElement[];
}

/**
 * Query Overpass with hedged mirrors: try the main instance, and if it is slow
 * or fails, start the next mirror. First valid response wins; the rest abort.
 */
async function overpass(query: string): Promise<OverpassResponse> {
  const done = new AbortController();
  const init: RequestInit = {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };
  return new Promise<OverpassResponse>((resolve, reject) => {
    let started = 0;
    let failed = 0;
    let settled = false;
    let hedge: ReturnType<typeof setTimeout> | null = null;
    const startNext = () => {
      if (settled || started >= OVERPASS_ENDPOINTS.length) return;
      const endpoint = OVERPASS_ENDPOINTS[started++]!;
      if (hedge) clearTimeout(hedge);
      hedge = setTimeout(startNext, OVERPASS_HEDGE_MS);
      fetchJson(endpoint, init, 25_000, done.signal)
        .then((json) => {
          const r = json as OverpassResponse;
          if (!Array.isArray(r?.elements)) throw new Error(`${endpoint} returned no elements`);
          if (settled) return;
          settled = true;
          if (hedge) clearTimeout(hedge);
          done.abort();
          resolve(r);
        })
        .catch((e) => {
          if (settled) return;
          console.warn("[overpass] endpoint failed", endpoint, String(e));
          failed++;
          if (failed >= OVERPASS_ENDPOINTS.length) {
            settled = true;
            if (hedge) clearTimeout(hedge);
            reject(e);
          } else startNext();
        });
    };
    startNext();
  });
}

function osmAddress(tags: Record<string, string>): string | null {
  const street = tags["addr:street"];
  const num = tags["addr:housenumber"];
  const city = tags["addr:city"] ?? tags["addr:place"];
  const line = [street && num ? `${street} ${num}` : street, city].filter(Boolean).join(", ");
  return line || tags["addr:full"] || null;
}

function osmKind(tags: Record<string, string>): string {
  for (const k of ["shop", "amenity", "leisure", "craft"]) if (tags[k]) return `${k}=${tags[k]}`;
  return "unknown";
}

function overpassToBusiness(el: OverpassElement, center: LatLon): Business | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  const tags = el.tags ?? {};
  return {
    id: `osm-${el.type}-${el.id}`,
    name: tags["name"] ?? tags["brand"] ?? null,
    lat,
    lon,
    distanceM: haversineMeters(center, { lat, lon }),
    address: osmAddress(tags),
    phone: tags["phone"] ?? tags["contact:phone"] ?? null,
    website: tags["website"] ?? tags["contact:website"] ?? null,
    openingHours: tags["opening_hours"] ?? null,
    brand: tags["brand"] ?? null,
    kind: osmKind(tags),
    sources: ["osm"],
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

async function competitorsFromOverpass(category: CategoryId, center: LatLon, radius: number) {
  const cat = CATEGORIES[category];
  const around = `(around:${radius},${center.lat.toFixed(6)},${center.lon.toFixed(6)})`;
  const body = cat.overpass.map((sel) => `nwr${sel}${around};`).join("");
  const q = `[out:json][timeout:25];(${body});out center tags;`;
  const json = await overpass(q);
  const businesses = json.elements
    .map((el) => overpassToBusiness(el, center))
    .filter((b): b is Business => b !== null && b.distanceM <= radius);
  const source: SourceInfo = {
    provider: "OpenStreetMap via Overpass API",
    attribution: OSM_ATTRIBUTION,
    attributionUrl: OSM_COPYRIGHT,
    fetchedAt: new Date().toISOString(),
    dataUpdatedAt: json.osm3s?.timestamp_osm_base ?? null,
    complete: true,
    note: cat.note ?? null,
  };
  return { businesses, source };
}

/* ---------------- Photon (OpenStreetMap, backup) ---------------- */
interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined> & { osm_id?: number; osm_type?: string; extent?: number[] };
}

async function photonReverse(point: LatLon, radiusKm: number, tags: string[]): Promise<PhotonFeature[]> {
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lon),
    radius: String(radiusKm),
    limit: String(PHOTON_LIMIT),
  });
  for (const t of tags) params.append("osm_tag", t);
  const json = (await fetchJson(`${PHOTON}/reverse?${params}`, {}, 10_000)) as { features?: PhotonFeature[] };
  return json.features ?? [];
}

const PHOTON_TYPE: Record<string, string> = { N: "node", W: "way", R: "relation" };

function photonToBusiness(f: PhotonFeature, center: LatLon): Business {
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties;
  const type = PHOTON_TYPE[p.osm_type ?? ""] ?? "node";
  const street = p["street"];
  const num = p["housenumber"];
  const address = [street && num ? `${street} ${num}` : street, p["city"]].filter(Boolean).join(", ");
  return {
    id: `osm-${type}-${p.osm_id}`,
    name: p["name"] ?? null,
    lat,
    lon,
    distanceM: haversineMeters(center, { lat, lon }),
    address: address || null,
    phone: null,
    website: null,
    openingHours: null,
    brand: null,
    kind: `${p["osm_key"]}=${p["osm_value"]}`,
    sources: ["osm"],
    sourceUrl: p.osm_id ? `https://www.openstreetmap.org/${type}/${p.osm_id}` : null,
  };
}

async function competitorsFromPhoton(category: CategoryId, center: LatLon, radius: number) {
  const cat = CATEGORIES[category];
  const km = radius / 1000;
  let capped = false;
  let features = await photonReverse(center, km, cat.photonTags);
  if (features.length >= PHOTON_LIMIT) {
    // Photon returns at most 50 nearest results: sample a ring of extra points.
    const ring = [0, 60, 120, 180, 240, 300].map((b) => destination(center, radius * 0.6, b));
    const more = await Promise.all(ring.map((p) => photonReverse(p, km * 0.6, cat.photonTags).catch(() => [])));
    capped = true;
    features = features.concat(...more);
  }
  let businesses = features.map((f) => photonToBusiness(f, center)).filter((b) => b.distanceM <= radius);
  if (cat.nameInclude) businesses = businesses.filter((b) => b.name && cat.nameInclude!.test(b.name));
  if (category === "hair_salon") businesses = businesses.filter((b) => !b.name || !/barber|brija/i.test(b.name));
  const source: SourceInfo = {
    provider: "OpenStreetMap via Photon (backup)",
    attribution: OSM_ATTRIBUTION,
    attributionUrl: OSM_COPYRIGHT,
    fetchedAt: new Date().toISOString(),
    dataUpdatedAt: null,
    complete: !capped,
    note: capped
      ? "The primary OpenStreetMap service was busy, so a backup with result limits was used. Counts may be lower than reality in dense areas."
      : "The primary OpenStreetMap service was busy; results come from a backup copy of OpenStreetMap.",
  };
  return { businesses, source };
}

/* ---------------- public operations ---------------- */
export async function findCompetitors(category: CategoryId, center: LatLon, radius: number): Promise<CompetitorResult> {
  const key = `comp:${category}:${center.lat.toFixed(4)}:${center.lon.toFixed(4)}:${radius}`;
  try {
    return await cached(key, async () => {
      let result: { businesses: Business[]; source: SourceInfo };
      try {
        result = await competitorsFromOverpass(category, center, radius);
      } catch (e) {
        console.warn("[competitors] overpass failed, falling back to photon", String(e));
        result = await competitorsFromPhoton(category, center, radius);
      }
      const businesses = dedupeBusinesses(result.businesses.sort((a, b) => a.distanceM - b.distanceM));
      return { category, center, fetchRadius: radius, businesses, source: result.source, error: null };
    });
  } catch (e) {
    console.error("[competitors] all providers failed", e);
    return {
      category,
      center,
      fetchRadius: radius,
      businesses: [],
      source: null,
      error: "Business data services are temporarily unavailable. Please try again in a minute.",
    };
  }
}

async function contextFromOverpass(c: LatLon): Promise<{ counts: AreaCounts; source: SourceInfo }> {
  const p = `${c.lat.toFixed(6)},${c.lon.toFixed(6)}`;
  const q = `[out:json][timeout:25];
nwr["building"~"^(apartments|residential|house|detached|semidetached_house|terrace|dormitory)$"](around:1000,${p});out count;
nwr["amenity"~"^(school|kindergarten|college|university)$"](around:1000,${p});out count;
nwr["office"](around:1000,${p});out count;
(node["highway"="bus_stop"](around:500,${p});node["railway"="tram_stop"](around:500,${p});nwr["railway"="station"](around:500,${p});nwr["amenity"="parking"](around:500,${p}););out count;
nwr["shop"](around:500,${p});out count;`;
  const json = await overpass(q);
  const totals = json.elements
    .filter((e) => e.type === "count")
    .map((e) => Number(e.tags?.["total"] ?? NaN));
  const n = (i: number) => (Number.isFinite(totals[i]) ? (totals[i] as number) : null);
  return {
    counts: { residentialBuildings: n(0), education: n(1), offices: n(2), transit: n(3), shops: n(4) },
    source: {
      provider: "OpenStreetMap via Overpass API",
      attribution: OSM_ATTRIBUTION,
      attributionUrl: OSM_COPYRIGHT,
      fetchedAt: new Date().toISOString(),
      dataUpdatedAt: json.osm3s?.timestamp_osm_base ?? null,
      complete: true,
      note: "Counts reflect what is mapped in OpenStreetMap, which can be incomplete.",
    },
  };
}

async function contextFromPhoton(c: LatLon): Promise<{ counts: AreaCounts; source: SourceInfo }> {
  const count = async (km: number, tags: string[]) => {
    const f = await photonReverse(c, km, tags);
    return f.length;
  };
  const settled = await Promise.allSettled([
    count(1, ["amenity:school", "amenity:kindergarten", "amenity:college", "amenity:university"]),
    count(1, ["office"]),
    count(0.5, ["highway:bus_stop", "railway:tram_stop", "railway:station", "amenity:parking"]),
    count(0.5, ["shop"]),
  ]);
  const [education, offices, transit, shops] = settled.map((r) => (r.status === "fulfilled" ? r.value : null));
  if (settled.every((r) => r.status === "rejected")) throw new Error("Photon unavailable");
  return {
    counts: {
      residentialBuildings: null,
      education: education ?? null,
      offices: offices ?? null,
      transit: transit ?? null,
      shops: shops ?? null,
    },
    source: {
      provider: "OpenStreetMap via Photon (backup)",
      attribution: OSM_ATTRIBUTION,
      attributionUrl: OSM_COPYRIGHT,
      fetchedAt: new Date().toISOString(),
      dataUpdatedAt: null,
      complete: false,
      note: "Backup source: counts are capped at 50 per factor and residential buildings are unavailable.",
    },
  };
}

export async function getAreaContext(center: LatLon): Promise<AreaContextResult> {
  const key = `ctx:${center.lat.toFixed(4)}:${center.lon.toFixed(4)}`;
  try {
    return await cached(key, async () => {
      try {
        const r = await contextFromOverpass(center);
        return { ...r, error: null };
      } catch (e) {
        console.warn("[context] overpass failed, falling back to photon", String(e));
        const r = await contextFromPhoton(center);
        return { ...r, error: null };
      }
    });
  } catch (e) {
    console.error("[context] all providers failed", e);
    return {
      counts: { residentialBuildings: null, education: null, offices: null, transit: null, shops: null },
      source: null,
      error: "Area data is temporarily unavailable.",
    };
  }
}

function photonPlace(f: PhotonFeature): PlaceResult {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  const name =
    p["name"] ?? ([p["street"], p["housenumber"]].filter(Boolean).join(" ") || p["city"] || "Unnamed place");
  const context = [p["district"] ?? p["locality"], p["city"], p["county"]]
    .filter((v, i, arr) => v && v !== name && arr.indexOf(v) === i)
    .join(", ");
  return {
    id: `${p.osm_type}${p.osm_id}`,
    name,
    context,
    lat,
    lon,
    type: p["type"] ?? p["osm_value"] ?? "place",
  };
}

interface NominatimItem {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
  addresstype?: string;
}

/** Nominatim forbids autocomplete, so it is only used for explicit (Enter) searches. */
async function nominatimSearch(q: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q, format: "jsonv2", countrycodes: "hr", limit: "8" });
  const json = (await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`, {}, 8_000)) as NominatimItem[];
  return json.map((i) => {
    const parts = i.display_name.split(", ");
    return {
      id: `${i.osm_type}${i.osm_id}`,
      name: i.name || parts[0] || i.display_name,
      context: parts.slice(1, 4).join(", "),
      lat: Number(i.lat),
      lon: Number(i.lon),
      type: i.addresstype ?? i.type ?? "place",
    };
  });
}

export async function searchPlaces(
  q: string,
  submitted = false,
): Promise<{ places: PlaceResult[]; error: string | null }> {
  try {
    return await cached(`geo:${submitted ? "s:" : ""}${q.toLowerCase()}`, async () => {
      if (submitted) {
        try {
          return { places: await photonSearch(q), error: null };
        } catch (e) {
          console.warn("[geocode] photon failed, using nominatim", String(e));
          return { places: await nominatimSearch(q), error: null };
        }
      }
      return { places: await photonSearch(q), error: null };
    });
  } catch (e) {
    console.error("[geocode] failed", e);
    return {
      places: [],
      error: submitted
        ? "Location search is temporarily unavailable."
        : "Suggestions are unavailable right now — press Enter to search.",
    };
  }
}

async function photonSearch(q: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q, limit: "8", bbox: "13.2,42.2,19.6,46.7", lat: "45.1", lon: "15.6" });
  const json = (await fetchJson(`${PHOTON}/api?${params}`, {}, 8_000)) as { features?: PhotonFeature[] };
  const places = (json.features ?? []).filter((f) => f.properties["countrycode"] === "HR").map(photonPlace);
  // Photon often returns the same place as node, way and relation: keep the first.
  return places.filter(
    (p, i) => places.findIndex((o) => o.name === p.name && o.context === p.context) === i,
  );
}

export async function reversePlace(c: LatLon): Promise<{ label: string | null }> {
  try {
    return await cached(`rev:${c.lat.toFixed(4)}:${c.lon.toFixed(4)}`, async () => {
      const params = new URLSearchParams({ lat: String(c.lat), lon: String(c.lon), limit: "1" });
      const json = (await fetchJson(`${PHOTON}/reverse?${params}`, {}, 6_000)) as { features?: PhotonFeature[] };
      const f = json.features?.[0];
      if (!f) return { label: null };
      return { label: photonLabel(f) };
    });
  } catch {
    try {
      const params = new URLSearchParams({ lat: String(c.lat), lon: String(c.lon), format: "jsonv2", zoom: "18" });
      const json = (await fetchJson(`https://nominatim.openstreetmap.org/reverse?${params}`, {}, 6_000)) as {
        display_name?: string;
      };
      return { label: json.display_name?.split(", ").slice(0, 3).join(", ") ?? null };
    } catch {
      return { label: null };
    }
  }
}

function photonLabel(f: PhotonFeature): string | null {
  const p = f.properties;
  const street = [p["street"], p["housenumber"]].filter(Boolean).join(" ");
  const label = [street || p["name"], p["district"] ?? p["locality"], p["city"]].filter(Boolean).join(", ");
  return label || null;
}
