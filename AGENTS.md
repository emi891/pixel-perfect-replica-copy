<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Bizmap architecture

- Business and area data come only from real providers in `src/lib/data/providers.ts`; never synthesise business records. Why: the product must never show fake data as real.
- The data layer is isomorphic: `src/lib/data/client.ts` calls public OSM services (Overpass, Photon, Nominatim) from the browser first and falls back to the same providers via server functions in `src/lib/bizmap.functions.ts`. Why: public OSM endpoints are meant for browser use and shared datacenter IPs get throttled.
- New data providers (e.g. Google Places) plug into `providers.ts` and must merge through `dedupeBusinesses`; anything needing an API key runs only server-side. Why: deduplication across sources and key protection.
- Overpass queries hedge across mirrors in order; Photon is the capped backup and must flag `complete: false` when capped. Why: Overpass is frequently overloaded and users must know when counts are minimums.
- Opportunity scoring lives in `src/lib/scoring.ts` as a pure function with tests in `src/test/scoring.test.ts`; missing factors are excluded and reported, never estimated. Why: scores must stay explainable and honest.
- Recent and saved locations are device-local (`src/lib/local-store.ts`) until user accounts exist. Why: no backend yet.
- The MapLibre map (`competitor-map.tsx`) is browser-only: lazy-load it behind `<ClientOnly>` and size it via a wrapper, because MapLibre CSS forces `position: relative` on its container.
- The AI analyst streams from the server route `src/routes/api/analyst.ts` via `@lovable.dev/ai-gateway`; it only receives the facts object defined and validated in `src/lib/analyst.ts`, built from data the page retrieved. Why: answers must rest on real retrieved data, and the public endpoint needs input limits, a same-origin check and a rate limit because each call costs credits.
