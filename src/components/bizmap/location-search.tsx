import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Search } from "lucide-react";
import { loadPlaces } from "@/lib/data/client";
import type { PlaceResult } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function LocationSearch({
  onSelect,
  placeholder = "Search a Croatian city, neighbourhood or address",
  className,
  large,
}: {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  large?: boolean;
}) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q.trim());
      setSubmitted(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["places", term.toLowerCase(), submitted],
    queryFn: () => loadPlaces(term, submitted),
    enabled: term.length >= 2,
    staleTime: 5 * 60_000,
  });
  const places = data?.places ?? [];

  const choose = (p: PlaceResult) => {
    setQ(p.name);
    setOpen(false);
    inputRef.current?.blur();
    onSelect(p);
  };

  const showList = open && term.length >= 2;

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !places.length && q.trim().length >= 2) {
            e.preventDefault();
            setTerm(q.trim());
            setSubmitted(true);
            setOpen(true);
            return;
          }
          if (!places.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % places.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + places.length) % places.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const p = places[active];
            if (p) choose(p);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-label="Search location"
        className={cn(
          "w-full rounded-xl border border-input bg-surface pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/40",
          large ? "h-13 text-base" : "h-11 text-sm",
        )}
      />
      {isFetching && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-2xl animate-fade-up"
        >
          {data?.error && <li className="px-3 py-3 text-sm text-signal-weak">{data.error}</li>}
          {!data?.error && !isFetching && data && places.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">No places in Croatia match “{term}”.</li>
          )}
          {places.map((p, i) => (
            <li
              key={`${p.id}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5",
                i === active && "bg-accent",
              )}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">{p.name}</span>
                {p.context && <span className="block truncate text-xs text-muted-foreground">{p.context}</span>}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] uppercase text-muted-foreground">{p.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
