import { ExternalLink, Globe } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import type { Business } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function CompetitorList({
  businesses,
  selectedId,
  onSelect,
}: {
  businesses: Business[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (businesses.length === 0) {
    return <p className="px-1 text-sm text-muted-foreground">No competitors mapped in this radius.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {businesses.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            onClick={() => onSelect(b.id)}
            className={cn(
              "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
              selectedId === b.id ? "border-primary/50 bg-accent" : "border-transparent hover:bg-accent/60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={cn("truncate text-sm", !b.name && "italic text-muted-foreground")}>
                  {b.name ?? "Unnamed business"}
                </div>
                <div className="truncate text-xs text-muted-foreground">{b.address ?? "Address not mapped"}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs",
                  b.distanceM <= 500 ? "text-signal-weak" : b.distanceM <= 1000 ? "text-signal-mixed" : "text-muted-foreground",
                )}
              >
                {formatDistance(b.distanceM)}
              </span>
            </div>
            {selectedId === b.id && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{b.kind}</span>
                {b.openingHours && <span>{b.openingHours}</span>}
                {b.phone && <span>{b.phone}</span>}
                {b.website && (
                  <a href={b.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    <Globe className="size-3" /> Website
                  </a>
                )}
                {b.sourceUrl && (
                  <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="size-3" /> OpenStreetMap
                  </a>
                )}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
