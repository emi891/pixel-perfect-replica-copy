/**
 * Browser entry to the data layer: query public OpenStreetMap services from
 * the visitor's browser first, then retry through Bizmap's server if that fails.
 */
import type { CategoryId } from "@/lib/categories";
import type { LatLon } from "@/lib/geo";
import { findCompetitorsFn, getAreaContextFn, reversePlaceFn, searchPlacesFn } from "@/lib/bizmap.functions";
import * as providers from "./providers";
import type { AreaContextResult, CompetitorResult, PlaceResult } from "./types";

export async function loadCompetitors(category: CategoryId, c: LatLon, radius: number): Promise<CompetitorResult> {
  const direct = await providers.findCompetitors(category, c, radius);
  if (!direct.error) return direct;
  return findCompetitorsFn({ data: { lat: c.lat, lon: c.lon, category, radius } });
}

export async function loadAreaContext(c: LatLon): Promise<AreaContextResult> {
  const direct = await providers.getAreaContext(c);
  if (!direct.error) return direct;
  return getAreaContextFn({ data: c });
}

export async function loadPlaces(q: string, submitted = false): Promise<{ places: PlaceResult[]; error: string | null }> {
  const direct = await providers.searchPlaces(q, submitted);
  if (!direct.error) return direct;
  try {
    return await searchPlacesFn({ data: { q, submitted } });
  } catch {
    return direct;
  }
}

export async function loadPlaceLabel(c: LatLon): Promise<{ label: string | null }> {
  const direct = await providers.reversePlace(c);
  if (direct.label) return direct;
  return reversePlaceFn({ data: c }).catch(() => direct);
}
