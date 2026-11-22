import type { CategoryId } from "@/lib/categories";

export type SourceId = "osm";

/** A real business location returned by a data provider. Never synthesised. */
export interface Business {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  distanceM: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  brand: string | null;
  /** The OSM tag that classified it, e.g. "shop=bakery". */
  kind: string;
  sources: SourceId[];
  sourceUrl: string | null;
}

export interface SourceInfo {
  provider: string;
  attribution: string;
  attributionUrl: string;
  /** When Bizmap fetched the data (ISO). */
  fetchedAt: string;
  /** When the upstream data was last updated, if the provider reports it (ISO). */
  dataUpdatedAt: string | null;
  /** False when the provider capped results, so counts may be lower than reality. */
  complete: boolean;
  note: string | null;
}

export interface CompetitorResult {
  category: CategoryId;
  center: { lat: number; lon: number };
  fetchRadius: number;
  businesses: Business[];
  source: SourceInfo | null;
  error: string | null;
}

export interface AreaCounts {
  residentialBuildings: number | null;
  education: number | null;
  offices: number | null;
  transit: number | null;
  shops: number | null;
}

export interface AreaContextResult {
  counts: AreaCounts;
  source: SourceInfo | null;
  error: string | null;
}

export interface PlaceResult {
  id: string;
  name: string;
  context: string;
  lat: number;
  lon: number;
  type: string;
}
