import { RADII, formatRadius, type Radius } from "@/lib/geo";
import { cn } from "@/lib/utils";

export function RadiusPicker({ value, onChange }: { value: number; onChange: (r: Radius) => void }) {
  return (
    <div role="radiogroup" aria-label="Search radius" className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-surface p-1">
      {RADII.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "rounded-lg py-2 font-mono text-xs transition-all",
            value === r ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {formatRadius(r)}
        </button>
      ))}
    </div>
  );
}
