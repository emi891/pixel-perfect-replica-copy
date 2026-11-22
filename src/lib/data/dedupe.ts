import { haversineMeters } from "@/lib/geo";
import type { Business } from "./types";

const normalise = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Merge records that describe the same business (e.g. an OSM node and building
 * way, or the same place from two providers): same normalised name within
 * `nameRadiusM`, or unnamed records within `unnamedRadiusM` of each other.
 * The first record wins; missing fields are filled from duplicates.
 */
export function dedupeBusinesses(
  items: Business[],
  { nameRadiusM = 40, unnamedRadiusM = 5 } = {},
): Business[] {
  const kept: Business[] = [];
  for (const item of items) {
    const key = item.name ? normalise(item.name) : null;
    const dup = kept.find((k) => {
      const kKey = k.name ? normalise(k.name) : null;
      const d = haversineMeters(k, item);
      if (key && kKey) return key === kKey && d <= nameRadiusM;
      if (!key && !kKey) return d <= unnamedRadiusM;
      return false;
    });
    if (!dup) {
      kept.push({ ...item, sources: [...item.sources] });
      continue;
    }
    dup.address ??= item.address;
    dup.phone ??= item.phone;
    dup.website ??= item.website;
    dup.openingHours ??= item.openingHours;
    dup.brand ??= item.brand;
    for (const s of item.sources) if (!dup.sources.includes(s)) dup.sources.push(s);
  }
  return kept;
}
