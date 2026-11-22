/** City-centre coordinates used as quick starting points (not business data). */
export const QUICK_CITIES = [
  { name: "Zagreb", lat: 45.8131, lon: 15.9775 },
  { name: "Split", lat: 43.5081, lon: 16.4402 },
  { name: "Rijeka", lat: 45.3271, lon: 14.4422 },
  { name: "Osijek", lat: 45.5605, lon: 18.6756 },
  { name: "Zadar", lat: 44.1157, lon: 15.2264 },
  { name: "Pula", lat: 44.8702, lon: 13.8455 },
  { name: "Dubrovnik", lat: 42.6411, lon: 18.1088 },
  { name: "Varaždin", lat: 46.3086, lon: 16.3365 },
] as const;

export const DEFAULT_LOCATION = { lat: 45.8131, lon: 15.9775, label: "Trg bana Jelačića, Zagreb" };
