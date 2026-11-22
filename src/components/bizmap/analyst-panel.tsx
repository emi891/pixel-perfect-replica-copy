import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Bot, Send, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalystFacts } from "@/lib/analyst";
import { cn } from "@/lib/utils";

interface Exchange {
  id: number;
  question: string;
  answer: string;
  status: "streaming" | "done" | "error" | "stopped";
  error?: string;
}

const ERROR_MARK = "[[BIZMAP_ERROR]]";

export function AnalystPanel({ facts, categoryLabel }: { facts: AnalystFacts | null; categoryLabel: string }) {
  const [question, setQuestion] = useState("");
  const [items, setItems] = useState<Exchange[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const busy = items.some((i) => i.status === "streaming");
  const lower = categoryLabel.toLowerCase();

  const suggestions = [
    `Would opening a ${lower} here be a good idea?`,
    `What are the biggest risks for a new ${lower} in this area?`,
    `How could a new ${lower} stand out from nearby competitors?`,
  ];

  const update = (id: number, patch: Partial<Exchange> | ((e: Exchange) => Partial<Exchange>)) =>
    setItems((list) => list.map((e) => (e.id === id ? { ...e, ...(typeof patch === "function" ? patch(e) : patch) } : e)));

  const ask = async (q: string) => {
    const text = q.trim();
    if (!facts || text.length < 3 || busy) return;
    const id = Date.now();
    setItems((list) => [...list, { id, question: text, answer: "", status: "streaming" }]);
    setQuestion("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, facts }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const msg = (await res.text().catch(() => "")) || "The AI analyst is unavailable right now.";
        update(id, { status: "error", error: msg.slice(0, 300) });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        update(id, (e) => ({ answer: e.answer + chunk }));
      }
      update(id, (e) => {
        const i = e.answer.indexOf(ERROR_MARK);
        if (i === -1) return { status: "done" };
        return { status: "error", answer: e.answer.slice(0, i).trim(), error: e.answer.slice(i + ERROR_MARK.length).trim() };
      });
    } catch (err) {
      if (ctrl.signal.aborted) update(id, { status: "stopped" });
      else update(id, { status: "error", error: "Connection lost. Please try again." });
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bot className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">AI business analyst</div>
            <div className="text-xs text-muted-foreground">Premium preview · free during beta</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Answers use only the competitor and area data retrieved for this location. Missing data is reported, not
          estimated.
        </p>
      </div>

      {items.map((e) => (
        <div key={e.id} className="space-y-2 animate-fade-up">
          <div className="ml-8 rounded-xl rounded-tr-sm bg-accent px-3 py-2 text-sm">{e.question}</div>
          <div className="surface p-4">
            {e.answer ? (
              <div className="analyst-answer text-sm">
                <ReactMarkdown>{e.answer}</ReactMarkdown>
              </div>
            ) : e.status === "streaming" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 animate-pulse text-primary" /> Analysing the data for this location…
              </div>
            ) : null}
            {e.status === "error" && (
              <div className="mt-2 flex gap-2 text-xs text-signal-weak">
                <AlertTriangle className="size-4 shrink-0" /> {e.error}
              </div>
            )}
            {e.status === "stopped" && <div className="mt-2 text-xs text-muted-foreground">Stopped.</div>}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!facts}
              onClick={() => ask(s)}
              className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="surface flex items-end gap-2 p-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          void ask(question);
        }}
      >
        <textarea
          value={question}
          onChange={(ev) => setQuestion(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
              ev.preventDefault();
              void ask(question);
            }
          }}
          maxLength={600}
          rows={2}
          aria-label="Ask the AI analyst"
          placeholder={facts ? "Ask about this location…" : "Waiting for location data…"}
          disabled={!facts}
          className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        {busy ? (
          <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!facts || question.trim().length < 3}>
            <Send />
          </Button>
        )}
      </form>
      <p className={cn("text-xs text-muted-foreground")}>
        AI answers can be wrong. They are not financial advice and never guarantee a business will succeed.
      </p>
    </div>
  );
}
