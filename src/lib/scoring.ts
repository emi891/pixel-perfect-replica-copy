import { CATEGORIES, type CategoryId } from "@/lib/categories";
import type { AreaCounts } from "@/lib/data/types";

/**
 * Preliminary opportunity score (0–100). These are heuristic indicator bands,
 * NOT validated probabilities of business success.
 */

export type ScoreBand = "strong" | "promising" | "mixed" | "weak" | "very_weak";

export const SCORE_BANDS: { band: ScoreBand; min: number; max: number; label: string }[] = [
  { band: "strong", min: 80, max: 100, label: "Strong indicators" },
  { band: "promising", min: 60, max: 79, label: "Promising indicators" },
  { band: "mixed", min: 40, max: 59, label: "Mixed indicators" },
  { band: "weak", min: 20, max: 39, label: "Weak indicators" },
  { band: "very_weak", min: 0, max: 19, label: "Very weak indicators" },
];

export function scoreBand(score: number): (typeof SCORE_BANDS)[number] {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return SCORE_BANDS.find((b) => s >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1]!;
}

export type FactorKey =
  | "competition"
  | "residential"
  | "population"
  | "education"
  | "offices"
  | "accessibility"
  | "amenities";

export interface Factor {
  key: FactorKey;
  label: string;
  weight: number;
  available: boolean;
  /** 0–1 contribution ratio, null when unavailable. */
  ratio: number | null;
  points: number | null;
  detail: string;
}

export interface OpportunityScore {
  score: number | null;
  band: (typeof SCORE_BANDS)[number] | null;
  factors: Factor[];
  /** Share of total factor weight that had data (0–1). */
  coverage: number;
  insufficientData: boolean;
  warnings: string[];
}

/** Minimum share of factor weight with data before a score is shown. */
export const MIN_COVERAGE = 0.6;

const WEIGHTS: Record<FactorKey, number> = {
  competition: 30,
  residential: 20,
  population: 15,
  offices: 10,
  accessibility: 10,
  education: 8,
  amenities: 7,
};

const sat = (n: number, full: number) => Math.max(0, Math.min(1, n / full));

export interface ScoreInput {
  category: CategoryId;
  /** Competitors within 1 km, or null if competitor data failed. */
  competitors1km: number | null;
  counts: AreaCounts | null;
  /** Residents per km², when a population source is connected. */
  populationDensity?: number | null;
}

export function computeOpportunityScore(input: ScoreInput): OpportunityScore {
  const c = input.counts;
  const category = CATEGORIES[input.category];
  const factors: Factor[] = [];

  const push = (key: FactorKey, label: string, ratio: number | null, detail: string) => {
    const weight = WEIGHTS[key];
    factors.push({
      key,
      label,
      weight,
      available: ratio !== null,
      ratio,
      points: ratio === null ? null : Math.round(ratio * weight * 10) / 10,
      detail,
    });
  };

  const comp = input.competitors1km;
  push(
    "competition",
    "Competition density",
    comp === null ? null : 1 - sat(comp, category.saturation1km),
    comp === null
      ? "Competitor data unavailable."
      : comp === 0
        ? "No mapped competitors within 1 km — could also mean low demand or incomplete mapping."
        : `${comp} ${comp === 1 ? "competitor" : "competitors"} within 1 km (saturates at ${category.saturation1km}).`,
  );

  const pop = input.populationDensity ?? null;
  push(
    "population",
    "Population density",
    pop === null ? null : sat(pop, 8000),
    pop === null
      ? "Croatian census (DZS) population data is not connected yet."
      : `${Math.round(pop).toLocaleString("en")} residents per km².`,
  );

  const res = c?.residentialBuildings ?? null;
  push(
    "residential",
    "Nearby residential areas",
    res === null ? null : sat(res, 250),
    res === null
      ? "Residential building data unavailable from the current source."
      : `${res} mapped residential buildings within 1 km.`,
  );

  const off = c?.offices ?? null;
  push(
    "offices",
    "Offices & workplaces",
    off === null ? null : sat(off, 40),
    off === null ? "Office data unavailable." : `${off} mapped offices within 1 km.`,
  );

  const tr = c?.transit ?? null;
  push(
    "accessibility",
    "Accessibility",
    tr === null ? null : sat(tr, 12),
    tr === null ? "Transit and parking data unavailable." : `${tr} transit stops and car parks within 500 m.`,
  );

  const edu = c?.education ?? null;
  push(
    "education",
    "Schools & education",
    edu === null ? null : sat(edu, 8),
    edu === null ? "Education data unavailable." : `${edu} schools, kindergartens or faculties within 1 km.`,
  );

  const sh = c?.shops ?? null;
  push(
    "amenities",
    "Relevant nearby amenities",
    sh === null ? null : sat(sh, 40),
    sh === null ? "Amenity data unavailable." : `${sh} shops (foot-traffic generators) within 500 m.`,
  );

  const total = factors.reduce((s, f) => s + f.weight, 0);
  const availableWeight = factors.filter((f) => f.available).reduce((s, f) => s + f.weight, 0);
  const earned = factors.reduce((s, f) => s + (f.ratio ?? 0) * f.weight, 0);
  const coverage = total === 0 ? 0 : availableWeight / total;
  const insufficientData = coverage < MIN_COVERAGE || comp === null;
  const score = insufficientData || availableWeight === 0 ? null : Math.round((earned / availableWeight) * 100);

  const missing = factors.filter((f) => !f.available).map((f) => f.label.toLowerCase());
  const warnings: string[] = [];
  if (missing.length > 0) {
    warnings.push(
      `Insufficient data for: ${missing.join(", ")}. The score is based on the remaining ${Math.round(coverage * 100)}% of factor weight.`,
    );
  }
  if (insufficientData) {
    warnings.push("Not enough data to calculate a reliable score for this location.");
  }

  return { score, band: score === null ? null : scoreBand(score), factors, coverage, insufficientData, warnings };
}
