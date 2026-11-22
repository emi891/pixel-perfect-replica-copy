/**
 * Business categories and how each maps onto OpenStreetMap tags.
 * `overpass` selectors are unioned in one Overpass query; `photonTags` are the
 * backup provider's equivalent filters. `saturation1km` is the competitor count
 * within 1 km at which the competition factor of the opportunity score reaches 0.
 */
export const CATEGORY_IDS = [
  "bakery",
  "cafe",
  "restaurant",
  "barbershop",
  "hair_salon",
  "gym",
  "grocery",
  "clothing",
  "car_repair",
  "car_detailing",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  id: CategoryId;
  label: string;
  plural: string;
  overpass: string[];
  photonTags: string[];
  /** Backup provider only: keep results whose name matches. */
  nameInclude?: RegExp;
  saturation1km: number;
  note?: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  bakery: {
    id: "bakery",
    label: "Bakery",
    plural: "Bakeries",
    overpass: ['["shop"="bakery"]', '["shop"="pastry"]'],
    photonTags: ["shop:bakery", "shop:pastry"],
    saturation1km: 12,
  },
  cafe: {
    id: "cafe",
    label: "Café",
    plural: "Cafés",
    overpass: ['["amenity"="cafe"]'],
    photonTags: ["amenity:cafe"],
    saturation1km: 40,
  },
  restaurant: {
    id: "restaurant",
    label: "Restaurant",
    plural: "Restaurants",
    overpass: ['["amenity"="restaurant"]'],
    photonTags: ["amenity:restaurant"],
    saturation1km: 40,
  },
  barbershop: {
    id: "barbershop",
    label: "Barbershop",
    plural: "Barbershops",
    overpass: [
      '["shop"="hairdresser"]["hairdresser"~"barber|men",i]',
      '["shop"="barber"]',
      '["shop"="hairdresser"]["name"~"barber|brija",i]',
    ],
    photonTags: ["shop:hairdresser", "shop:barber"],
    nameInclude: /barber|brija/i,
    saturation1km: 10,
    note: "Barbershops are OSM hairdressers tagged as barber or named as one.",
  },
  hair_salon: {
    id: "hair_salon",
    label: "Hair salon",
    plural: "Hair salons",
    overpass: ['["shop"="hairdresser"]["hairdresser"!~"^barber$"]'],
    photonTags: ["shop:hairdresser"],
    saturation1km: 15,
  },
  gym: {
    id: "gym",
    label: "Gym",
    plural: "Gyms",
    overpass: ['["leisure"="fitness_centre"]', '["amenity"="gym"]'],
    photonTags: ["leisure:fitness_centre", "amenity:gym"],
    saturation1km: 6,
  },
  grocery: {
    id: "grocery",
    label: "Grocery store",
    plural: "Grocery stores",
    overpass: ['["shop"~"^(supermarket|convenience|greengrocer)$"]'],
    photonTags: ["shop:supermarket", "shop:convenience", "shop:greengrocer"],
    saturation1km: 15,
  },
  clothing: {
    id: "clothing",
    label: "Clothing store",
    plural: "Clothing stores",
    overpass: ['["shop"="clothes"]'],
    photonTags: ["shop:clothes"],
    saturation1km: 30,
  },
  car_repair: {
    id: "car_repair",
    label: "Car repair",
    plural: "Car repair shops",
    overpass: ['["shop"="car_repair"]', '["craft"="car_repair"]'],
    photonTags: ["shop:car_repair"],
    saturation1km: 8,
  },
  car_detailing: {
    id: "car_detailing",
    label: "Car detailing",
    plural: "Car detailing & washes",
    overpass: [
      '["amenity"="car_wash"]',
      '["shop"="car_repair"]["service:vehicle:detailing"="yes"]',
      '["shop"~"^(car_repair|car)$"]["name"~"detail",i]',
    ],
    photonTags: ["amenity:car_wash"],
    saturation1km: 6,
    note: "In OpenStreetMap most detailing businesses are mapped as car washes.",
  },
};

export const CATEGORY_LIST: Category[] = CATEGORY_IDS.map((id) => CATEGORIES[id]);

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}
