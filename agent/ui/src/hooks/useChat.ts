import { useCallback, useEffect, useRef, useState } from "react";
import { parseSSEStream, postChat } from "../lib/sse";
import type { SSEEvent, TokenUsage, TraceEntry, UIComponent } from "../lib/types";

export type ChatMessage = {
  role: "user" | "agent";
  text: string;
  tools: { name: string; args: Record<string, unknown>; ended: boolean }[];
  components: UIComponent[];
  tokens?: TokenUsage;
  stopped?: boolean;
  error?: string | null;
  createdAt: number;
  durationMs?: number;
};

export type Chat = ReturnType<typeof useChat>;

const STORAGE_KEY = "ha-agent:session:v1";

type Persisted = {
  messages: ChatMessage[];
  conversationId: string;
};

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed?.conversationId || !Array.isArray(parsed.messages)) return null;
    // Never restore with sending=true; in-flight turns can't resume.
    return parsed;
  } catch {
    return null;
  }
}

function savePersisted(p: Persisted) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* quota etc — silent */
  }
}

function clearPersisted() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function useChat() {
  const initial = loadPersisted();
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const [sending, setSending] = useState(false);
  const conversationId = useRef(initial?.conversationId ?? crypto.randomUUID());
  const userId = useRef("panel-user");
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
    savePersisted({ messages, conversationId: conversationId.current });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const ctl = new AbortController();
    abortRef.current = ctl;
    const now = Date.now();
    setMessages((m) => [
      ...m,
      { role: "user", text, tools: [], components: [], createdAt: now },
      { role: "agent", text: "", tools: [], components: [], createdAt: now },
    ]);
    setSending(true);
    try {
      const stream = await postChat(text, conversationId.current, userId.current, ctl.signal);
      for await (const evt of parseSSEStream(stream)) {
        setMessages((m) => applyEvent(m, evt));
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (aborted) {
        setMessages((m) => {
          const copy = m.slice();
          const last = { ...copy[copy.length - 1] };
          last.stopped = true;
          copy[copy.length - 1] = last;
          return copy;
        });
      } else {
        console.error("[ha-agent] stream error:", e);
        setMessages((m) => {
          const copy = m.slice();
          const last = { ...copy[copy.length - 1] };
          last.error = e instanceof Error ? e.name : "NetworkError";
          copy[copy.length - 1] = last;
          return copy;
        });
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    conversationId.current = crypto.randomUUID();
    clearPersisted();
  }, []);

  const regenerate = useCallback(() => {
    const prev = messagesRef.current;
    let idx = prev.length - 1;
    while (idx >= 0 && prev[idx].role !== "user") idx--;
    if (idx < 0) return;
    const lastUserText = prev[idx].text;
    setMessages(prev.slice(0, idx));
    void send(lastUserText);
  }, [send]);

  const loadSession = useCallback(async (sessionId: string) => {
    abortRef.current?.abort();
    try {
      const r = await fetch(`/traces?session_id=${encodeURIComponent(sessionId)}&limit=500`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as { entries: TraceEntry[] };
      // Backend returns newest-first; replay oldest-first to rebuild the turn order.
      const ordered = [...(body.entries ?? [])].reverse();
      const rebuilt: ChatMessage[] = [];
      for (const t of ordered) {
        const ts = Date.parse(t.ts) || Date.now();
        rebuilt.push({
          role: "user",
          text: t.user_message ?? "",
          tools: [],
          components: [],
          createdAt: ts,
        });
        rebuilt.push({
          role: "agent",
          text: t.response_text ?? "",
          tools: (t.tool_calls ?? []).map((c) => ({
            name: c.name,
            args: c.args ?? {},
            ended: true,
          })),
          components: [],
          tokens: t.tokens,
          createdAt: ts,
          durationMs: t.total_latency_ms,
        });
      }
      conversationId.current = sessionId;
      setMessages(rebuilt);
    } catch (e) {
      console.error("[ha-agent] loadSession failed:", e);
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) send(detail);
    };
    window.addEventListener("ha-agent:followup", handler as EventListener);
    return () => window.removeEventListener("ha-agent:followup", handler as EventListener);
  }, [send]);

  return { messages, sending, send, abort, reset, regenerate, loadSession, conversationId: conversationId.current };
}

function applyEvent(messages: ChatMessage[], evt: SSEEvent): ChatMessage[] {
  const copy = messages.slice();
  const last = { ...copy[copy.length - 1] };
  if (evt.type === "tool_start") {
    last.tools = [...last.tools, { name: evt.tool, args: evt.args, ended: false }];
  } else if (evt.type === "tool_end") {
    last.tools = last.tools.map((t) =>
      t.name === evt.tool && !t.ended ? { ...t, ended: true } : t,
    );
  } else if (evt.type === "text_delta") {
    last.text = last.text + evt.delta;
  } else if (evt.type === "component") {
    last.components = [...last.components, evt.component];
  } else if (evt.type === "tokens_delta") {
    last.tokens = {
      prompt: evt.prompt,
      completion: evt.completion,
      thoughts: evt.thoughts,
      cached: evt.cached,
      total: evt.total,
      llm_calls: evt.llm_calls,
    };
  } else if (evt.type === "final") {
    last.text = evt.full_text || last.text;
    if (evt.components) last.components = evt.components;
    if (evt.tokens) last.tokens = evt.tokens;
    last.error = evt.error ?? null;
    last.durationMs = Date.now() - last.createdAt;
  }
  copy[copy.length - 1] = last;
  return copy;
}
