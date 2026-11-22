import { Database } from "lucide-react";
import type { SourceInfo } from "@/lib/data/types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function SourceAttribution({ sources }: { sources: (SourceInfo | null | undefined)[] }) {
  const list = sources.filter((s): s is SourceInfo => !!s);
  const unique = list.filter((s, i) => list.findIndex((o) => o.provider === s.provider) === i);
  if (!unique.length) return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-surface/60 p-3 text-xs text-muted-foreground">
      {unique.map((s) => (
        <div key={s.provider} className="flex gap-2">
          <Database className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <span className="text-foreground">{s.provider}</span> ·{" "}
            <a href={s.attributionUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {s.attribution}
            </a>
            <div>
              {s.dataUpdatedAt ? `Map data updated ${fmt(s.dataUpdatedAt)} · ` : ""}Fetched {fmt(s.fetchedAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
