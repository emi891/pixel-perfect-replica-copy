import { formatDistance, formatRadius } from "@/lib/geo";
import type { Business } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export interface CompetitorStatsData {
  inRadius: number;
  within500: number;
  within1k: number;
  within2k: number;
  nearest: Business[];
}

export function computeStats(businesses: Business[], radius: number): CompetitorStatsData {
  return {
    inRadius: businesses.filter((b) => b.distanceM <= radius).length,
    within500: businesses.filter((b) => b.distanceM <= 500).length,
    within1k: businesses.filter((b) => b.distanceM <= 1000).length,
    within2k: businesses.filter((b) => b.distanceM <= 2000).length,
    nearest: businesses.slice(0, 3),
  };
}

const BANDS = [
  { label: "0–250 m", min: 0, max: 250 },
  { label: "250–500 m", min: 250, max: 500 },
  { label: "0.5–1 km", min: 500, max: 1000 },
  { label: "1–2 km", min: 1000, max: 2000 },
  { label: "2–5 km", min: 2000, max: 5000 },
];

export function CompetitorStats({
  stats,
  businesses,
  radius,
  plural,
  complete,
}: {
  stats: CompetitorStatsData;
  businesses: Business[];
  radius: number;
  plural: string;
  complete: boolean;
}) {
  const bands = BANDS.filter((b) => b.min < Math.max(radius, 2000)).map((b) => ({
    ...b,
    count: businesses.filter((x) => x.distanceM > b.min && x.distanceM <= b.max).length,
  }));
  const peak = Math.max(1, ...bands.map((b) => b.count));
  const tone = (n: number) => (n <= 500 ? "text-signal-weak" : n <= 1000 ? "text-signal-mixed" : "text-foreground");

  return (
    <div className="space-y-3">
      <div className="surface p-4">
        <div className="eyebrow">{plural} within {formatRadius(radius)}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-5xl font-semibold tabular-nums">{stats.inRadius}</span>
          {!complete && <span className="text-xs text-signal-mixed">minimum</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "≤ 500 m", v: stats.within500, c: "bg-signal-weak" },
          { l: "≤ 1 km", v: stats.within1k, c: "bg-signal-mixed" },
          { l: "≤ 2 km", v: stats.within2k, c: "bg-signal-neutral" },
        ].map((t) => (
          <div key={t.l} className="surface p-3">
            <div className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", t.c)} />
              <span className="font-mono text-[11px] text-muted-foreground">{t.l}</span>
            </div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{t.v}</div>
          </div>
        ))}
      </div>

      <div className="surface p-4">
        <div className="eyebrow mb-3">Nearest competitors</div>
        {stats.nearest.length === 0 ? (
          <p className="text-sm text-muted-foreground">None found in the searched area.</p>
        ) : (
          <ul className="space-y-2">
            {stats.nearest.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{b.name ?? "Unnamed business"}</span>
                <span className={cn("shrink-0 font-mono text-xs", tone(b.distanceM))}>{formatDistance(b.distanceM)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="surface p-4">
        <div className="eyebrow mb-3">Distribution by distance</div>
        <div className="space-y-2">
          {bands.map((b) => (
            <div key={b.label} className="grid grid-cols-[72px_1fr_28px] items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">{b.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    b.max <= 500 ? "bg-signal-weak" : b.max <= 1000 ? "bg-signal-mixed" : "bg-signal-neutral",
                  )}
                  style={{ width: `${(b.count / peak) * 100}%` }}
                />
              </div>
              <span className="text-right font-mono text-xs tabular-nums">{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
