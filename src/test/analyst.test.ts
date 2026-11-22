import { describe, expect, it } from "vitest";
import { ANALYST_INSTRUCTIONS, analystRequestSchema } from "@/lib/analyst";

const facts = {
  location: { label: "Zagreb", lat: 45.81, lon: 15.97 },
  category: "bakery",
  categoryLabel: "Bakery",
  radiusM: 1000,
  competitors: { inRadius: 3, within500m: 1, within1km: 3, within2km: 5, countsAreMinimum: false, nearest: [], brands: [] },
  area: null,
  score: { value: null, band: null, coverage: 0.3, factors: [], warnings: [] },
  sources: [],
};

describe("AI analyst", () => {
  it("instructs the model to use only retrieved data and never guarantee success", () => {
    expect(ANALYST_INSTRUCTIONS).toMatch(/Use ONLY the facts/);
    expect(ANALYST_INSTRUCTIONS).toMatch(/Never guarantee/);
  });

  it("rejects questions longer than 600 characters", () => {
    expect(analystRequestSchema.safeParse({ question: "a".repeat(601), facts }).success).toBe(false);
    expect(analystRequestSchema.safeParse({ question: "Is a bakery here a good idea?", facts }).success).toBe(true);
  });
});
