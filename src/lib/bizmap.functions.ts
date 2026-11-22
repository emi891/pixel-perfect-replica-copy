import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/categories";
import { RADII } from "@/lib/geo";

const point = {
  lat: z.number().min(42).max(47),
  lon: z.number().min(13).max(20),
};

export const searchPlacesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(2).max(120), submitted: z.boolean().default(false) }).parse(d))
  .handler(async ({ data }) => {
    const { searchPlaces } = await import("@/lib/data/providers");
    return searchPlaces(data.q, data.submitted);
  });

export const reversePlaceFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object(point).parse(d))
  .handler(async ({ data }) => {
    const { reversePlace } = await import("@/lib/data/providers");
    return reversePlace(data);
  });

export const findCompetitorsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        ...point,
        category: z.enum(CATEGORY_IDS),
        radius: z.number().refine((r) => (RADII as readonly number[]).includes(r)),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { findCompetitors } = await import("@/lib/data/providers");
    return findCompetitors(data.category, { lat: data.lat, lon: data.lon }, data.radius);
  });

export const getAreaContextFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object(point).parse(d))
  .handler(async ({ data }) => {
    const { getAreaContext } = await import("@/lib/data/providers");
    return getAreaContext(data);
  });
