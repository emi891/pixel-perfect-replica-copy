import { describe, expect, it } from "vitest";
import { computeOpportunityScore, scoreBand } from "@/lib/scoring";

const fullCounts = { residentialBuildings: 250, education: 8, offices: 40, transit: 12, shops: 40 };

describe("score bands", () => {
  it("labels 80–100 as strong indicators", () => {
    expect(scoreBand(80).label).toBe("Strong indicators");
    expect(scoreBand(100).label).toBe("Strong indicators");
  });
  it("labels 60–79 as promising indicators", () => {
    expect(scoreBand(79).label).toBe("Promising indicators");
    expect(scoreBand(60).label).toBe("Promising indicators");
  });
  it("labels 40–59 as mixed indicators", () => {
    expect(scoreBand(59).label).toBe("Mixed indicators");
    expect(scoreBand(40).label).toBe("Mixed indicators");
  });
  it("labels 20–39 as weak indicators", () => {
    expect(scoreBand(39).label).toBe("Weak indicators");
    expect(scoreBand(20).label).toBe("Weak indicators");
  });
  it("labels 0–19 as very weak indicators", () => {
    expect(scoreBand(19).label).toBe("Very weak indicators");
    expect(scoreBand(0).label).toBe("Very weak indicators");
  });
});

describe("opportunity score", () => {
  it("drops the competition factor to zero at the category saturation (12 bakeries within 1 km)", () => {
    const r = computeOpportunityScore({ category: "bakery", competitors1km: 12, counts: fullCounts });
    expect(r.factors.find((f) => f.key === "competition")?.points).toBe(0);
  });

  it("warns about missing population data instead of inventing it", () => {
    const r = computeOpportunityScore({ category: "cafe", competitors1km: 0, counts: fullCounts });
    expect(r.factors.find((f) => f.key === "population")?.available).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/population density/);
    expect(r.score).toBe(100);
  });

  it("withholds the score when competitor data is missing", () => {
    const r = computeOpportunityScore({ category: "cafe", competitors1km: null, counts: fullCounts });
    expect(r.score).toBeNull();
    expect(r.insufficientData).toBe(true);
  });

  it("withholds the score when less than 60% of factor weight has data", () => {
    const r = computeOpportunityScore({ category: "gym", competitors1km: 2, counts: null });
    expect(r.score).toBeNull();
    expect(r.insufficientData).toBe(true);
  });
});
