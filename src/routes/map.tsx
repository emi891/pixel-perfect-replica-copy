import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from "react";
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bookmark, BookmarkCheck, Loader2, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategorySelect } from "@/components/bizmap/category-select";
import { RadiusPicker } from "@/components/bizmap/radius-picker";
import { LocationSearch } from "@/components/bizmap/location-search";
import { CompetitorStats, computeStats } from "@/components/bizmap/competitor-stats";
import { CompetitorList } from "@/components/bizmap/competitor-list";
import { OpportunityPanel } from "@/components/bizmap/opportunity-panel";
import { AnalystPanel } from "@/components/bizmap/analyst-panel";
import type { AnalystFacts } from "@/lib/analyst";
import { SourceAttribution } from "@/components/bizmap/source-attribution";
import { CATEGORIES, isCategoryId, type CategoryId } from "@/lib/categories";
import { RADII, formatRadius, isInCroatiaBounds, type Radius } from "@/lib/geo";
import { DEFAULT_LOCATION } from "@/lib/cities";
import { loadAreaContext, loadCompetitors, loadPlaceLabel } from "@/lib/data/client";
import { computeOpportunityScore } from "@/lib/scoring";
import { locationId, upsertLocation, useStoredLocations } from "@/lib/local-store";

const CompetitorMap = lazy(() => import("@/components/bizmap/competitor-map"));

interface MapSearch {
  lat?: number;
  lon?: number;
  label?: string;
  cat: CategoryId;
  r: Radius;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export const Route = createFileRoute("/map")({
  validateSearch: (s: Record<string, unknown>): MapSearch => {
    const lat = num(s["lat"]);
    const lon = num(s["lon"]);
    const r = num(s["r"]);
    const valid = lat !== undefined && lon !== undefined && isInCroatiaBounds({ lat, lon });
    return {
      ...(valid ? { lat, lon } : {}),
      ...(typeof s["label"] === "string" && s["label"] ? { label: s["label"].slice(0, 160) } : {}),
      cat: isCategoryId(s["cat"]) ? s["cat"] : "cafe",
      r: (RADII as readonly number[]).includes(r ?? -1) ? (r as Radius) : 1000,
    };
  },
  head: () => ({
    meta: [
      { title: "Opportunity map — Bizmap" },
      {
        name: "description",
        content: "Interactive map of real competing businesses across Croatia, with radius filters and opportunity scoring.",
      },
      { property: "og:title", content: "Opportunity map — Bizmap" },
      {
        property: "og:description",
        content: "See real competitors around any Croatian address and how the area scores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function MapPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/map" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const usingDefault = search.lat === undefined || search.lon === undefined;
  const lat = search.lat ?? DEFAULT_LOCATION.lat;
  const lon = search.lon ?? DEFAULT_LOCATION.lon;
  const center = useMemo(() => ({ lat, lon }), [lat, lon]);
  const category = CATEGORIES[search.cat];
  const radius = search.r;
  const fetchRadius = Math.max(radius, 2000);
  const key4 = [lat.toFixed(4), lon.toFixed(4)];

  const competitorsQ = useQuery({
    queryKey: ["competitors", search.cat, ...key4, fetchRadius],
    queryFn: () => loadCompetitors(search.cat, { lat, lon }, fetchRadius),
    staleTime: 10 * 60_000,
  });
  const contextQ = useQuery({
    queryKey: ["context", ...key4],
    queryFn: () => loadAreaContext({ lat, lon }),
    staleTime: 10 * 60_000,
  });
  const labelQ = useQuery({
    queryKey: ["reverse", ...key4],
    queryFn: () => loadPlaceLabel({ lat, lon }),
    enabled: !search.label && !usingDefault,
    staleTime: Infinity,
  });

  const label = search.label ?? (usingDefault ? DEFAULT_LOCATION.label : labelQ.data?.label ?? "Selected point");
  const result = competitorsQ.data;
  const all = useMemo(() => (result?.error ? [] : result?.businesses ?? []), [result]);
  const inRadius = useMemo(() => all.filter((b) => b.distanceM <= radius), [all, radius]);
  const stats = computeStats(all, radius);
  const competitorsFailed = !!result?.error || competitorsQ.isError;

  const score = useMemo(
    () =>
      computeOpportunityScore({
        category: search.cat,
        competitors1km: result && !result.error ? stats.within1k : null,
        counts: contextQ.data && !contextQ.data.error ? contextQ.data.counts : null,
      }),
    [search.cat, result, stats.within1k, contextQ.data],
  );
  const scoreLoading = competitorsQ.isPending || contextQ.isPending;

  const facts = useMemo<AnalystFacts | null>(() => {
    if (!result || result.error || scoreLoading) return null;
    const brandCounts = new Map<string, number>();
    for (const b of all) if (b.distanceM <= radius && b.name) brandCounts.set(b.name, (brandCounts.get(b.name) ?? 0) + 1);
    const c = contextQ.data && !contextQ.data.error ? contextQ.data.counts : null;
    return {
      location: { label, lat, lon },
      category: search.cat,
      categoryLabel: category.label,
      radiusM: radius,
      competitors: {
        inRadius: stats.inRadius,
        within500m: stats.within500,
        within1km: stats.within1k,
        within2km: stats.within2k,
        countsAreMinimum: !(result.source?.complete ?? true),
        nearest: all.slice(0, 12).map((b) => ({
          name: b.name,
          distanceM: Math.round(b.distanceM),
          address: b.address,
          openingHours: b.openingHours,
          brand: b.brand,
        })),
        brands: [...brandCounts.entries()]
          .filter(([, n]) => n > 1)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, count]) => ({ name, count })),
      },
      area: c && {
        residentialBuildings1km: c.residentialBuildings,
        education1km: c.education,
        offices1km: c.offices,
        transitAndParking500m: c.transit,
        shops500m: c.shops,
      },
      score: {
        value: score.score,
        band: score.band?.label ?? null,
        coverage: score.coverage,
        factors: score.factors.map((f) => ({ label: f.label, points: f.points, weight: f.weight, detail: f.detail })),
        warnings: score.warnings.slice(0, 5),
      },
      sources: [result.source, contextQ.data?.source]
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map((x) => ({ provider: x.provider, dataUpdatedAt: x.dataUpdatedAt, fetchedAt: x.fetchedAt, complete: x.complete })),
    };
  }, [result, scoreLoading, all, radius, contextQ.data, label, lat, lon, search.cat, category.label, stats, score]);

  const id = locationId(lat, lon, search.cat);
  const saved = useStoredLocations("saved");
  const isSaved = saved.items.some((s) => s.id === id);

  const entry = () => ({
    id,
    label,
    lat,
    lon,
    category: search.cat,
    radius,
    competitors: result && !result.error ? stats.inRadius : null,
    score: scoreLoading ? null : score.score,
    at: new Date().toISOString(),
  });

  // Record real analyses in the device's recent history.
  useEffect(() => {
    if (!result || result.error || scoreLoading) return;
    upsertLocation("recent", entry());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, scoreLoading, radius, label]);

  useEffect(() => setSelectedId(null), [lat, lon, search.cat]);

  const goTo = (p: { lat: number; lon: number; label?: string }) => {
    if (!isInCroatiaBounds(p)) {
      toast.error("Bizmap currently covers Croatia only.");
      return;
    }
    navigate({
      search: (prev) => {
        const { label: _old, ...rest } = prev;
        void _old;
        return {
          ...rest,
          lat: Number(p.lat.toFixed(5)),
          lon: Number(p.lon.toFixed(5)),
          ...(p.label ? { label: p.label } : {}),
        };
      },
    });
  };

  return (
    <main className="grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[440px_1fr]">
      {/* Map */}
      <section className="relative order-1 h-[55vh] min-h-80 border-b border-border lg:order-2 lg:h-full lg:border-b-0">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <CompetitorMap
              center={center}
              radius={radius}
              businesses={inRadius}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPick={(p) => goTo(p)}
            />
          </Suspense>
        </ClientOnly>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs backdrop-blur">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-signal-weak" />≤ 500 m</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-signal-mixed" />≤ 1 km</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-signal-neutral" />farther</span>
          </div>
          {competitorsQ.isFetching && (
            <div className="flex items-center gap-2 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs backdrop-blur">
              <Loader2 className="size-3.5 animate-spin text-primary" /> Loading real business data…
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 hidden rounded-full sm:block border border-border bg-background/85 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          Tap anywhere on the map to analyse that spot
        </div>
      </section>

      {/* Panel */}
      <aside className="order-2 space-y-4 overflow-y-auto border-border p-4 sm:p-5 lg:order-1 lg:border-r">
        <LocationSearch onSelect={(p) => goTo({ lat: p.lat, lon: p.lon, label: [p.name, p.context].filter(Boolean).join(", ") })} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <CategorySelect value={search.cat} onChange={(cat) => navigate({ search: (prev) => ({ ...prev, cat }) })} />
          <RadiusPicker value={radius} onChange={(r) => navigate({ search: (prev) => ({ ...prev, r }) })} />
        </div>

        <div className="flex items-start justify-between gap-3 animate-fade-up">
          <div className="min-w-0">
            <div className="eyebrow">Analysing · {category.plural} · {formatRadius(radius)}</div>
            <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="truncate">{label}</span>
            </h1>
            <div className="font-mono text-[11px] text-muted-foreground">
              {lat.toFixed(5)}, {lon.toFixed(5)}
            </div>
          </div>
          <Button
            variant={isSaved ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              if (isSaved) {
                saved.remove(id);
                toast("Removed from saved locations");
              } else {
                upsertLocation("saved", entry());
                toast.success("Location saved on this device");
              }
            }}
          >
            {isSaved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
            {isSaved ? "Saved" : "Save"}
          </Button>
        </div>

        {competitorsFailed ? (
          <div className="surface space-y-3 p-4">
            <div className="flex gap-2.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-signal-weak" />
              <p>{result?.error ?? "Could not load business data."}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => competitorsQ.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="competitors">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="competitors">Competitors</TabsTrigger>
              <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
              <TabsTrigger value="analyst">AI analyst</TabsTrigger>
            </TabsList>

            <TabsContent value="competitors" className="mt-4 space-y-4">
              {competitorsQ.isPending ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="surface h-24 animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {result?.source && !result.source.complete && (
                    <Notice>{result.source.note}</Notice>
                  )}
                  {category.note && <Notice tone="info">{category.note}</Notice>}
                  <CompetitorStats
                    stats={stats}
                    businesses={all}
                    radius={radius}
                    plural={category.plural}
                    complete={result?.source?.complete ?? true}
                  />
                  <div>
                    <div className="eyebrow mb-2 flex items-center justify-between">
                      <span>All competitors in radius</span>
                      <span>{inRadius.length}</span>
                    </div>
                    <CompetitorList businesses={inRadius} selectedId={selectedId} onSelect={setSelectedId} />
                    <p className="mt-3 text-xs text-muted-foreground">
                      Ratings and reviews are not shown: OpenStreetMap does not publish them, and no licensed
                      review provider is connected yet.
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="opportunity" className="mt-4">
              <OpportunityPanel result={score} loading={scoreLoading} />
              {contextQ.data?.source?.note && <p className="mt-3 text-xs text-muted-foreground">{contextQ.data.source.note}</p>}
            </TabsContent>

            <TabsContent value="analyst" className="mt-4">
              <AnalystPanel key={`${id}:${radius}`} facts={facts} categoryLabel={category.label} />
            </TabsContent>
          </Tabs>
        )}

        <SourceAttribution sources={[result?.source, contextQ.data?.source]} />
      </aside>
    </main>
  );
}

function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "info" }) {
  return (
    <div
      className={
        tone === "warn"
          ? "flex gap-2.5 rounded-xl border border-signal-mixed/30 bg-signal-mixed/10 p-3 text-xs"
          : "flex gap-2.5 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground"
      }
    >
      <AlertTriangle className={tone === "warn" ? "mt-0.5 size-4 shrink-0 text-signal-mixed" : "mt-0.5 size-4 shrink-0"} />
      <p>{children}</p>
    </div>
  );
}
