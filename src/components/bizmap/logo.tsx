import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" className="fill-surface-raised stroke-border" strokeWidth="1" />
      <circle cx="16" cy="16" r="9.5" className="fill-none stroke-primary/30" strokeWidth="1" />
      <circle cx="16" cy="16" r="5.5" className="fill-none stroke-primary/60" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="2.4" className="fill-primary" />
      <circle cx="23" cy="10" r="1.4" className="fill-signal-mixed" />
      <circle cx="9.5" cy="21.5" r="1.4" className="fill-signal-weak" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-tight">Bizmap</span>
    </span>
  );
}
