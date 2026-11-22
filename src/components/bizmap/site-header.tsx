import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Map, Tag } from "lucide-react";
import { Logo } from "./logo";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Opportunity map", icon: Map },
  { to: "/pricing", label: "Pricing", icon: Tag },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Link to="/" aria-label="Bizmap home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <span className="eyebrow rounded-full border border-border px-3 py-1">Croatia · Beta</span>
        </div>
      </div>
    </header>
  );
}
