import { useCallback, useEffect, useState } from "react";
import type { CategoryId } from "@/lib/categories";

/**
 * Device-local history until user accounts exist. Every entry is a location the
 * user actually analysed; nothing here is pre-filled.
 */
export interface StoredLocation {
  id: string;
  label: string;
  lat: number;
  lon: number;
  category: CategoryId;
  radius: number;
  competitors: number | null;
  score: number | null;
  at: string;
}

type Kind = "recent" | "saved";
const KEY: Record<Kind, string> = { recent: "bizmap:recent", saved: "bizmap:saved" };
const LIMIT: Record<Kind, number> = { recent: 8, saved: 50 };
const EVENT = "bizmap:store";

export const locationId = (lat: number, lon: number, category: string) =>
  `${lat.toFixed(4)},${lon.toFixed(4)}:${category}`;

function read(kind: Kind): StoredLocation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY[kind]);
    const parsed = raw ? (JSON.parse(raw) as StoredLocation[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(kind: Kind, items: StoredLocation[]) {
  window.localStorage.setItem(KEY[kind], JSON.stringify(items.slice(0, LIMIT[kind])));
  window.dispatchEvent(new Event(EVENT));
}

export function upsertLocation(kind: Kind, entry: StoredLocation) {
  write(kind, [entry, ...read(kind).filter((e) => e.id !== entry.id)]);
}

export function removeLocation(kind: Kind, id: string) {
  write(kind, read(kind).filter((e) => e.id !== id));
}

export function useStoredLocations(kind: Kind) {
  const [items, setItems] = useState<StoredLocation[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const sync = () => setItems(read(kind));
    sync();
    setLoaded(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [kind]);
  const remove = useCallback((id: string) => removeLocation(kind, id), [kind]);
  return { items, loaded, remove };
}
