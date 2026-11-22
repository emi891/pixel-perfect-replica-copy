import { describe, expect, it } from "vitest";
import { haversineMeters } from "@/lib/geo";
import { dedupeBusinesses } from "@/lib/data/dedupe";
import type { Business } from "@/lib/data/types";

const biz = (over: Partial<Business>): Business => ({
  id: "x",
  name: null,
  lat: 45.8131,
  lon: 15.9775,
  distanceM: 0,
  address: null,
  phone: null,
  website: null,
  openingHours: null,
  brand: null,
  kind: "shop=bakery",
  sources: ["osm"],
  sourceUrl: null,
  ...over,
});

describe("distance", () => {
  it("measures ~1.11 km for 0.01° of latitude", () => {
    const d = haversineMeters({ lat: 45, lon: 16 }, { lat: 45.01, lon: 16 });
    expect(d).toBeGreaterThan(1105);
    expect(d).toBeLessThan(1120);
  });
});

describe("deduplication", () => {
  it("merges the same named business within 40 m and keeps missing fields", () => {
    const out = dedupeBusinesses([
      biz({ id: "a", name: "Pekara Dubravica" }),
      biz({ id: "b", name: "PEKARA DUBRAVICA", lat: 45.8133, phone: "+385 1 000" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.phone).toBe("+385 1 000");
  });

  it("keeps same-named branches that are far apart", () => {
    const out = dedupeBusinesses([
      biz({ id: "a", name: "Lidl" }),
      biz({ id: "b", name: "Lidl", lat: 45.82 }),
    ]);
    expect(out).toHaveLength(2);
  });
});
