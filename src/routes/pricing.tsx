import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Bizmap" },
      { name: "description", content: "Bizmap Free and Premium plans for business location analysis in Croatia." },
      { property: "og:title", content: "Pricing — Bizmap" },
      { property: "og:description", content: "Start free with competitor search. Premium adds AI recommendations and reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pricing,
});

const PLANS = [
  {
    name: "Free",
    tagline: "Explore the market",
    features: ["Basic competitor search", "Limited location analyses", "Basic interactive map", "OpenStreetMap data"],
    cta: "Current plan",
    highlight: false,
  },
  {
    name: "Premium",
    tagline: "Decide with confidence",
    features: [
      "Advanced location analysis",
      "AI business analyst recommendations",
      "Saved reports",
      "Side-by-side location comparisons",
    ],
    cta: "Coming soon",
    highlight: true,
  },
];

function Pricing() {
  return (
    <main className="relative">
      <div className="bg-hero pointer-events-none absolute inset-x-0 top-0 h-96" />
      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <div className="eyebrow">Pricing</div>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Simple plans for serious decisions</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Bizmap is in beta. Everything below the Free plan is in development, and payments are not live yet.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {PLANS.map((p) => (
            <section key={p.name} className={cn("surface flex flex-col p-7", p.highlight && "shadow-glow")}>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">{p.name}</h2>
                {p.highlight && <span className="eyebrow rounded-full border border-primary/40 px-2.5 py-1 text-primary">Planned</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <Check className="size-4 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              {p.highlight ? (
                <Button className="mt-8" disabled>
                  {p.cta}
                </Button>
              ) : (
                <Button asChild variant="outline" className="mt-8">
                  <Link to="/map" search={{ cat: "cafe", r: 1000 }}>Open the map</Link>
                </Button>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
