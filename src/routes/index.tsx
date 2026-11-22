import { useState, type ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Bookmark, Clock, Database, MapPin, Map as MapIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocationSearch } from "@/components/bizmap/location-search";
import { CategorySelect } from "@/components/bizmap/category-select";
import { CategoryIcon } from "@/components/bizmap/category-icon";
import { ScoreBandLegend, BAND_TEXT } from "@/components/bizmap/opportunity-panel";
import { CATEGORIES, CATEGORY_LIST, type CategoryId } from "@/lib/categories";
import { QUICK_CITIES } from "@/lib/cities";
import { formatRadius } from "@/lib/geo";
import { scoreBand } from "@/lib/scoring";
import { useStoredLocations, type StoredLocation } from "@/lib/local-store";
import type { PlaceResult } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bizmap — Find the right place. Build the right business." },
      {
        name: "description",
        content:
          "Bizmap helps entrepreneurs in Croatia find locations for physical businesses using real competitor and area data.",
      },
      { property: "og:title", content: "Bizmap — Find the right place. Build the right business." },
      {
        property: "og:description",
        content: "Real competitor maps and preliminary opportunity scores for any location in Croatia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [category, setCategory] = useState<CategoryId>("bakery");
  const recent = useStoredLocations("recent");
  const saved = useStoredLocations("saved");

  const analyse = (p: { lat: number; lon: number; label?: string }, cat: CategoryId = category) =>
    navigate({
      to: "/map",
      search: { lat: p.lat, lon: p.lon, cat, r: 1000, ...(p.label ? { label: p.label } : {}) },
    });

  return (
    <main className="relative">
      <div className="bg-hero pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" />

      <div className="relative mx-auto max-w-[1400px] px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        {/* Welcome */}
        <section className="max-w-3xl animate-fade-up">
          <div className="eyebrow">Business location intelligence · Croatia</div>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] sm:text-6xl">
            Find the right place.
            <br />
            <span className="text-primary">Build the right business.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            See every mapped competitor around a Croatian address, how close they are, and what the surrounding area
            offers — from real OpenStreetMap data.
          </p>
        </section>

        {/* Search */}
        <section className="surface relative z-10 mt-8 max-w-4xl p-3 sm:p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <LocationSearch large onSelect={setPlace} />
            <CategorySelect value={category} onChange={setCategory} className="h-13" />
            <Button
              size="lg"
              className="h-13 rounded-xl px-6 shadow-glow"
              onClick={() =>
                analyse(
                  place
                    ? { lat: place.lat, lon: place.lon, label: [place.name, place.context].filter(Boolean).join(", ") }
                    : { lat: QUICK_CITIES[0].lat, lon: QUICK_CITIES[0].lon, label: "Zagreb city centre" },
                )
              }
            >
              Analyse <ArrowRight />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground">Quick start:</span>
            {QUICK_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => analyse({ lat: c.lat, lon: c.lon, label: `${c.name} city centre` })}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <LocationsCard
            title="Recently analysed"
            icon={<Clock className="size-4" />}
            items={recent.items}
            loaded={recent.loaded}
            empty="Locations you analyse will appear here."
            onRemove={recent.remove}
          />
          <LocationsCard
            title="Saved locations"
            icon={<Bookmark className="size-4" />}
            items={saved.items}
            loaded={saved.loaded}
            empty="Save a location from the map to compare it later."
            onRemove={saved.remove}
          />
          <section className="surface p-5">
            <h2 className="text-base font-semibold">Opportunity overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every analysis gets a preliminary 0–100 score from competition, residential density, workplaces,
              schools, transit and nearby shops.
            </p>
            <div className="mt-4">
              <ScoreBandLegend />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Bands are preliminary indicators, not validated probabilities of success.
            </p>
          </section>
        </div>

        {/* Competitor map quick access */}
        <section className="surface mt-5 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MapIcon className="size-4 text-primary" /> Competitor map
              </h2>
              <p className="text-sm text-muted-foreground">Jump straight into a category — starts in central Zagreb.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/map" search={{ cat: "cafe", r: 1000 }}>
                Open map <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5">
            {CATEGORY_LIST.map((c) => (
              <Link
                key={c.id}
                to="/map"
                search={{ cat: c.id, r: 1000 }}
                className="group flex items-center gap-3 border-b border-r border-border p-4 transition-colors hover:bg-accent"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <CategoryIcon id={c.id} className="size-4" />
                </span>
                <span className="text-sm">{c.plural}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-5 flex gap-3 rounded-xl border border-border p-4 text-xs text-muted-foreground">
          <Database className="mt-0.5 size-4 shrink-0" />
          <p>
            Business locations come from{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-foreground hover:underline">
              © OpenStreetMap contributors
            </a>{" "}
            (ODbL), retrieved live with the Overpass API and Photon. Bizmap never invents business locations; if
            something isn't mapped in OpenStreetMap it won't appear. Population data from the Croatian Bureau of
            Statistics is planned.
          </p>
        </section>
      </div>
    </main>
  );
}

function LocationsCard({
  title,
  icon,
  items,
  loaded,
  empty,
  onRemove,
}: {
  title: string;
  icon: ReactNode;
  items: StoredLocation[];
  loaded: boolean;
  empty: string;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="surface flex flex-col p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="text-primary">{icon}</span> {title}
      </h2>
      <p className="text-xs text-muted-foreground">Stored on this device</p>
      <div className="mt-4 flex-1">
        {!loaded ? (
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        ) : items.length === 0 ? (
          <div className="flex h-full min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            <MapPin className="mb-2 size-5" />
            {empty}
          </div>
        ) : (
          <ul className="-mx-2 space-y-1">
            {items.slice(0, 5).map((l) => (
              <li key={l.id} className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent">
                <Link
                  to="/map"
                  search={{ lat: l.lat, lon: l.lon, label: l.label, cat: l.category, r: l.radius as 500 | 1000 | 2000 | 5000 }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CategoryIcon id={l.category} className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{l.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {CATEGORIES[l.category].plural} · {formatRadius(l.radius)}
                      {l.competitors !== null && ` · ${l.competitors} found`}
                    </span>
                  </span>
                </Link>
                {l.score !== null && (
                  <span className={cn("font-mono text-sm tabular-nums", BAND_TEXT[scoreBand(l.score).band])}>{l.score}</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${l.label}`}
                  onClick={() => onRemove(l.id)}
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
