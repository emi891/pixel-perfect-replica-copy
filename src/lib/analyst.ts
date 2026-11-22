import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/categories";

/**
 * The only facts the AI analyst may use. Built in the browser from data the
 * page actually retrieved; validated and size-limited on the server.
 */
const num = z.number().finite().nullable();

export const analystFactsSchema = z.object({
  location: z.object({ label: z.string().max(200), lat: z.number(), lon: z.number() }),
  category: z.enum(CATEGORY_IDS),
  categoryLabel: z.string().max(60),
  radiusM: z.number().int().positive().max(5000),
  competitors: z.object({
    inRadius: z.number().int().min(0),
    within500m: z.number().int().min(0),
    within1km: z.number().int().min(0),
    within2km: z.number().int().min(0),
    countsAreMinimum: z.boolean(),
    nearest: z
      .array(
        z.object({
          name: z.string().max(120).nullable(),
          distanceM: z.number().min(0),
          address: z.string().max(200).nullable(),
          openingHours: z.string().max(160).nullable(),
          brand: z.string().max(80).nullable(),
        }),
      )
      .max(15),
    brands: z.array(z.object({ name: z.string().max(80), count: z.number().int() })).max(10),
  }),
  area: z
    .object({
      residentialBuildings1km: num,
      education1km: num,
      offices1km: num,
      transitAndParking500m: num,
      shops500m: num,
    })
    .nullable(),
  score: z.object({
    value: num,
    band: z.string().max(40).nullable(),
    coverage: z.number().min(0).max(1),
    factors: z
      .array(z.object({ label: z.string().max(60), points: num, weight: z.number(), detail: z.string().max(240) }))
      .max(10),
    warnings: z.array(z.string().max(300)).max(5),
  }),
  sources: z
    .array(
      z.object({
        provider: z.string().max(80),
        dataUpdatedAt: z.string().max(40).nullable(),
        fetchedAt: z.string().max(40),
        complete: z.boolean(),
      }),
    )
    .max(4),
});

export type AnalystFacts = z.infer<typeof analystFactsSchema>;

export const analystRequestSchema = z.object({
  question: z.string().trim().min(3).max(600),
  facts: analystFactsSchema,
});

export const ANALYST_INSTRUCTIONS = `You are Bizmap's business location analyst for Croatia.

Rules:
- Use ONLY the facts in the JSON provided. Never invent statistics, populations, incomes, rents, footfall, ratings or businesses.
- When you cite a number, it must appear in the facts. If something is not in the facts, say it is missing.
- Population and demographic data (census) is not connected yet: say so instead of estimating it. You may name what mapped proxies exist (residential buildings, schools, offices) and label them as proxies.
- Counts come from OpenStreetMap and can be incomplete; if countsAreMinimum is true, say the counts are minimums.
- The opportunity score is a preliminary indicator band, not a probability of success. Never guarantee or predict success.
- General business knowledge may be used only qualitatively and must be marked as general context, not data.
- Answer in the language of the user's question. Be concise and concrete.

Format the answer in Markdown with exactly these sections as level-3 headings:
### Competition overview
### Population & demographic indicators
### Nearby amenities
### Potential advantages
### Potential disadvantages
### Missing information
### Suggested areas to investigate
### Recommendations
Use short bullet points. Start with a one-sentence direct answer to the question before the first heading.`;

export function buildAnalystInput(question: string, facts: AnalystFacts): string {
  return `User question: ${question}\n\nFacts (JSON, the only data you may use):\n${JSON.stringify(facts)}`;
}
