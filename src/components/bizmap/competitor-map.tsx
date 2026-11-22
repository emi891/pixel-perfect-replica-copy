/**
 * Browser-only MapLibre map. Load with React.lazy behind <ClientOnly>; never
 * import this module statically from a route.
 */
import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from "maplibre-gl";
import { circleRing, formatDistance, type LatLon } from "@/lib/geo";
import type { Business } from "@/lib/data/types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

/** Resolve a CSS custom property (oklch) to a colour string MapLibre understands. */
function cssColor(name: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.fillStyle = fallback;
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

export type DistanceBand = "near" | "mid" | "far";
export const bandFor = (m: number): DistanceBand => (m <= 500 ? "near" : m <= 1000 ? "mid" : "far");

interface Props {
  center: LatLon;
  radius: number;
  businesses: Business[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPick: (p: LatLon) => void;
}

function bounds(center: LatLon, radius: number): LngLatBoundsLike {
  const ring = circleRing(center, radius, 32);
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

function circleFeature(center: LatLon, radius: number) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [circleRing(center, radius)] },
  };
}

function bizCollection(items: Business[]) {
  return {
    type: "FeatureCollection" as const,
    features: items.map((b) => ({
      type: "Feature" as const,
      properties: { id: b.id, band: bandFor(b.distanceM), name: b.name ?? "" },
      geometry: { type: "Point" as const, coordinates: [b.lon, b.lat] },
    })),
  };
}

function popupNode(b: Business): HTMLElement {
  const el = document.createElement("div");
  el.className = "min-w-48 max-w-64 space-y-1";
  const title = document.createElement("div");
  title.className = "font-display text-sm font-semibold text-foreground";
  title.textContent = b.name ?? "Unnamed business";
  el.appendChild(title);
  const meta = document.createElement("div");
  meta.className = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
  meta.textContent = `${b.kind} · ${formatDistance(b.distanceM)} away`;
  el.appendChild(meta);
  if (b.address) {
    const a = document.createElement("div");
    a.className = "text-xs text-muted-foreground";
    a.textContent = b.address;
    el.appendChild(a);
  }
  if (b.openingHours) {
    const h = document.createElement("div");
    h.className = "text-xs text-muted-foreground";
    h.textContent = `Hours: ${b.openingHours}`;
    el.appendChild(h);
  }
  if (b.sourceUrl) {
    const link = document.createElement("a");
    link.href = b.sourceUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = "block pt-1 text-xs text-primary hover:underline";
    link.textContent = "View on OpenStreetMap ↗";
    el.appendChild(link);
  }
  return el;
}

export default function CompetitorMap({ center, radius, businesses, selectedId, onSelect, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const latest = useRef({ center, radius, businesses, onSelect, onPick });
  latest.current = { center, radius, businesses, onSelect, onPick };

  // Create map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const strong = cssColor("--signal-strong", "#3ddc97");
    const mixed = cssColor("--signal-mixed", "#f5c84c");
    const weak = cssColor("--signal-weak", "#ef5a4c");
    const neutral = cssColor("--signal-neutral", "#8b93a7");
    const bg = cssColor("--background", "#0d111a");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      bounds: bounds(center, radius),
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
      minZoom: 5,
      maxBounds: [
        [10.5, 40.5],
        [22.5, 48.2],
      ],
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const markerEl = document.createElement("div");
    markerEl.className = "relative size-5";
    markerEl.innerHTML =
      '<span class="absolute inset-0 rounded-full bg-primary/50 animate-pulse-ring"></span><span class="absolute inset-[3px] rounded-full border-2 border-background bg-primary shadow-glow"></span>';
    markerRef.current = new maplibregl.Marker({ element: markerEl }).setLngLat([center.lon, center.lat]).addTo(map);

    map.on("load", () => {
      const { center: c, radius: r, businesses: b } = latest.current;
      map.addSource("radius", { type: "geojson", data: circleFeature(c, r) });
      map.addSource("biz", { type: "geojson", data: bizCollection(b) });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": strong, "fill-opacity": 0.07 } });
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: { "line-color": strong, "line-width": 1.5, "line-opacity": 0.8, "line-dasharray": [2, 2] },
      });
      const color = ["match", ["get", "band"], "near", weak, "mid", mixed, neutral] as unknown as string;
      map.addLayer({
        id: "biz-halo",
        type: "circle",
        source: "biz",
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 16, 14], "circle-color": color, "circle-opacity": 0.18 },
      });
      map.addLayer({
        id: "biz-dot",
        type: "circle",
        source: "biz",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 7],
          "circle-color": color,
          "circle-stroke-color": bg,
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "biz-selected",
        type: "circle",
        source: "biz",
        filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": 11, "circle-color": "transparent", "circle-stroke-color": strong, "circle-stroke-width": 2.5 },
      });
      readyRef.current = true;
    });

    map.on("mouseenter", "biz-dot", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "biz-dot", () => (map.getCanvas().style.cursor = ""));
    map.on("click", (e) => {
      const hit = readyRef.current ? map.queryRenderedFeatures(e.point, { layers: ["biz-dot", "biz-halo"] }) : [];
      const id = hit[0]?.properties?.["id"];
      if (typeof id === "string") latest.current.onSelect(id);
      else latest.current.onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center / radius changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.setLngLat([center.lon, center.lat]);
    const apply = () => {
      (map.getSource("radius") as GeoJSONSource | undefined)?.setData(circleFeature(center, radius));
      map.fitBounds(bounds(center, radius), { padding: 40, duration: 900 });
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [center.lat, center.lon, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  // Business markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => (map.getSource("biz") as GeoJSONSource | undefined)?.setData(bizCollection(businesses));
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [businesses]);

  // Selection popup.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const previous = popupRef.current;
    popupRef.current = null;
    previous?.remove();
    if (readyRef.current) map.setFilter("biz-selected", ["==", ["get", "id"], selectedId ?? ""]);
    const b = businesses.find((x) => x.id === selectedId);
    if (!b) return;
    const popup = new maplibregl.Popup({ offset: 12, maxWidth: "280px" })
      .setLngLat([b.lon, b.lat])
      .setDOMContent(popupNode(b))
      .addTo(map);
    popup.on("close", () => {
      if (popupRef.current === popup) latest.current.onSelect(null);
    });
    popupRef.current = popup;
    if (!map.getBounds().contains([b.lon, b.lat])) map.easeTo({ center: [b.lon, b.lat] });
  }, [selectedId, businesses]);

  // MapLibre's own CSS forces `position: relative` on the container, so size it from a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" aria-label="Interactive competitor map of Croatia" />
    </div>
  );
}
