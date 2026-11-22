import { createFileRoute } from "@tanstack/react-router";
import { ANALYST_INSTRUCTIONS, analystRequestSchema, buildAnalystInput } from "@/lib/analyst";

/** Simple per-isolate rate limit: the endpoint is public and every call costs credits. */
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 12;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  return false;
}

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export const Route = createFileRoute("/api/analyst")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Only accept calls from Bizmap pages in a browser.
        const site = request.headers.get("sec-fetch-site");
        if (site && site !== "same-origin") return text("Forbidden", 403);
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(request.url).host) return text("Forbidden", 403);

        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "local";
        if (rateLimited(ip)) return text("You've asked a lot of questions in a short time. Please wait a few minutes.", 429);

        let parsed;
        try {
          parsed = analystRequestSchema.parse(await request.json());
        } catch {
          return text("Invalid request.", 400);
        }

        const { streamResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
        let stream;
        try {
          stream = await streamResponse(
            {
              model: "openai/gpt-6-astra",
              instructions: ANALYST_INSTRUCTIONS,
              input: buildAnalystInput(parsed.question, parsed.facts),
              reasoning: { effort: "low" },
              max_output_tokens: 2500,
            },
            { signal: request.signal },
          );
        } catch (e) {
          console.error("[analyst] start failed", e);
          if (e instanceof GatewayError && e.httpStatus === 402) {
            return text("The AI analyst is out of credits right now.", 402);
          }
          if (e instanceof GatewayError && e.httpStatus === 429) {
            return text("The AI analyst is busy. Please try again in a minute.", 429);
          }
          return text("The AI analyst is unavailable right now. Please try again.", 502);
        }

        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const event of stream) {
                if (event.type === "response.output_text.delta") controller.enqueue(encoder.encode(event.delta));
              }
            } catch (e) {
              console.error("[analyst] stream failed", e);
              controller.enqueue(encoder.encode("\n\n[[BIZMAP_ERROR]] The answer was interrupted. Please try again."));
            } finally {
              controller.close();
            }
          },
        });
        return new Response(body, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
