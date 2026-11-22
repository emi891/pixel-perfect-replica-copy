import { AlertTriangle, Info } from "lucide-react";
import type { OpportunityScore, ScoreBand } from "@/lib/scoring";
import { SCORE_BANDS } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const BAND_TEXT: Record<ScoreBand, string> = {
  strong: "text-signal-strong",
  promising: "text-signal-strong",
  mixed: "text-signal-mixed",
  weak: "text-signal-weak",
  very_weak: "text-signal-weak",
};

const barTone = (r: number) => (r >= 0.6 ? "bg-signal-strong" : r >= 0.35 ? "bg-signal-mixed" : "bg-signal-weak");

export function ScoreGauge({ score, band }: { score: number | null; band: ScoreBand | null }) {
  const pct = score ?? 0;
  const r = 52;
  const circ = Math.PI * r;
  return (
    <svg viewBox="0 0 128 72" className="w-44" aria-hidden>
      <path d="M12 64 A52 52 0 0 1 116 64" className="fill-none stroke-muted" strokeWidth="10" strokeLinecap="round" />
      {score !== null && (
        <path
          d="M12 64 A52 52 0 0 1 116 64"
          className={cn("fill-none transition-all duration-1000", band ? BAND_TEXT[band] : "")}
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        />
      )}
    </svg>
  );
}

export function OpportunityPanel({ result, loading }: { result: OpportunityScore; loading: boolean }) {
  return (
    <div className="space-y-3">
      <div className="surface flex flex-col items-center p-5 text-center">
        <div className="eyebrow">Preliminary opportunity score</div>
        <div className="relative mt-3">
          <ScoreGauge score={result.score} band={result.band?.band ?? null} />
          <div className="absolute inset-x-0 bottom-0 font-display text-4xl font-semibold tabular-nums">
            {loading ? "…" : result.score ?? "—"}
          </div>
        </div>
        <div className={cn("mt-2 text-sm font-medium", result.band ? BAND_TEXT[result.band.band] : "text-muted-foreground")}>
          {loading ? "Analysing area…" : result.band?.label ?? "Insufficient data"}
        </div>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
          Data coverage {Math.round(result.coverage * 100)}%
        </div>
      </div>

      {!loading && result.warnings.length > 0 && (
        <div className="flex gap-2.5 rounded-xl border border-signal-mixed/30 bg-signal-mixed/10 p-3 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-signal-mixed" />
          <div className="space-y-1">
            {result.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        </div>
      )}

      <div className="surface p-4">
        <div className="eyebrow mb-3">How the score is built</div>
        <ul className="space-y-3.5">
          {result.factors.map((f) => (
            <li key={f.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className={cn(!f.available && "text-muted-foreground")}>{f.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {f.available ? `${f.points} / ${f.weight}` : `— / ${f.weight}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                {f.ratio !== null && (
                  <div className={cn("h-full rounded-full transition-all duration-700", barTone(f.ratio))} style={{ width: `${f.ratio * 100}%` }} />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-border p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Scores are preliminary indicator bands built from mapped data, not validated probabilities of business
          success. Bizmap never guarantees that a business will succeed — verify on the ground.
        </p>
      </div>
    </div>
  );
}

export function ScoreBandLegend() {
  return (
    <ul className="space-y-2">
      {SCORE_BANDS.map((b) => (
        <li key={b.band} className="flex items-center justify-between gap-3 text-sm">
          <span className={cn("flex items-center gap-2", BAND_TEXT[b.band])}>
            <span className="size-2 rounded-full bg-current" />
            {b.label}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {b.min}–{b.max}
          </span>
        </li>
      ))}
    </ul>
  );
}
