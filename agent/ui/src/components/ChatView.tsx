import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ArrowUp, Square } from "lucide-react";
import type { Chat } from "../hooks/useChat";
import { useEntityAutocomplete } from "../hooks/useEntityAutocomplete";
import { iconForDomain, parseEntity } from "../lib/entity";
import { Message } from "./Message";

type Props = {
  chat: Chat;
};

export function ChatView({ chat }: Props) {
  const { messages, sending, send, abort } = chat;
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastUserRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCountRef = useRef(0);
  const autocomplete = useEntityAutocomplete({
    textareaRef: inputRef,
    value: draft,
    setValue: setDraft,
  });

  // When a new user message appears (count jumps by 2), pin that message to
  // the top of the scroll viewport. During streaming, let the agent reply
  // grow downward from there — the user's prompt stays visible.
  useLayoutEffect(() => {
    const grew = messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    if (!grew) return;
    const user = lastUserRef.current;
    const scroller = scrollRef.current;
    if (!user || !scroller) return;
    // Align user message with top of scroller, minus a small inset.
    const target = user.offsetTop - 16;
    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: target, behavior: "smooth" });
    } else {
      scroller.scrollTop = target;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

  // Global shortcuts: Cmd/Ctrl+K + `/` focus the input from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = inputRef.current;
      if (!el) return;
      const active = document.activeElement as HTMLElement | null;
      const inField =
        !!active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        el.focus();
      } else if (e.key === "/" && !inField) {
        e.preventDefault();
        el.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;

    // Slash commands — intercepted before reaching the backend.
    if (t.startsWith("/")) {
      const cmd = t.slice(1).split(/\s+/)[0].toLowerCase();
      if (cmd === "nieuw" || cmd === "new") {
        chat.reset();
        setDraft("");
        inputRef.current?.focus();
        return;
      }
      if (cmd === "stop") {
        chat.abort();
        setDraft("");
        inputRef.current?.focus();
        return;
      }
      if (cmd === "opnieuw" || cmd === "regenerate") {
        chat.regenerate();
        setDraft("");
        inputRef.current?.focus();
        return;
      }
    }

    if (sending) return;
    send(t);
    setDraft("");
    inputRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete takes priority — if it handles Arrow/Enter/Tab/Escape, stop here.
    if (autocomplete.handleKeyDown(e)) return;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(e as unknown as FormEvent);
    } else if (e.key === "Escape" && sending) {
      e.preventDefault();
      abort();
    } else if (e.key === "ArrowUp" && draft === "" && !sending) {
      // Terminal-style: empty input + ↑ recalls the last user prompt.
      // With text present, ↑ does the default caret-up.
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (lastUser) {
        e.preventDefault();
        setDraft(lastUser.text);
        // Place the caret at the end after the next render.
        window.requestAnimationFrame(() => {
          const el = inputRef.current;
          if (!el) return;
          const pos = el.value.length;
          el.setSelectionRange(pos, pos);
        });
      }
    }
  };

  const lastIdx = messages.length - 1;
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-8">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-[72ch] flex-col gap-7 pb-[40vh]">
            {messages.map((m, i) => (
              <div key={i} ref={i === lastUserIdx ? lastUserRef : undefined}>
                <Message
                  msg={m}
                  thinking={sending && m.role === "agent" && i === lastIdx}
                  isLastAgent={
                    !sending && m.role === "agent" && i === lastIdx && m.text.length > 0
                  }
                  onRegenerate={chat.regenerate}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mx-auto w-full max-w-[72ch] px-5 pb-6 pt-2">
        <form
          onSubmit={submit}
          className="group relative rounded-[24px] border bg-(--color-canvas) transition-colors focus-within:border-(--color-ink-3)"
          style={{
            borderColor: "var(--color-border-strong)",
            boxShadow:
              "0 1px 2px oklch(0.2 0.01 260 / 0.04), 0 8px 24px -12px oklch(0.2 0.01 260 / 0.08)",
          }}
        >
          {autocomplete.open && (
            <EntityMenu
              options={autocomplete.options}
              highlighted={autocomplete.highlighted}
              onSelect={autocomplete.onSelect}
            />
          )}
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder={sending ? "Aan het werk…" : "Vraag aan ha agent…"}
            rows={1}
            autoFocus
            className="block w-full resize-none bg-transparent px-5 pt-4 text-[15.5px] leading-[1.45] outline-none placeholder:text-(--color-ink-3)"
            style={{
              fieldSizing: "content",
              maxHeight: "40vh",
            } as React.CSSProperties}
          />
          <div className="flex items-center justify-between px-3 pb-3 pt-2">
            <div
              className="pl-2 text-[11px] text-(--color-ink-3)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {sending ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full dot-pulse"
                    style={{ background: "var(--color-accent-500)" }}
                  />
                  bezig… (esc om te stoppen)
                </span>
              ) : (
                <span>
                  ↵ verstuur · ⇧↵ nieuwe regel · ⌘K focus · ↑ vorige vraag · /nieuw /stop /opnieuw
                </span>
              )}
            </div>
            {sending ? (
              <button
                type="button"
                onClick={abort}
                aria-label="Stop generatie"
                title="Stop"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
                style={{
                  background: "var(--color-ink-1)",
                  color: "var(--color-canvas)",
                }}
              >
                <Square className="h-[14px] w-[14px]" strokeWidth={0} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Verstuur"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-25"
                style={{
                  background: draft.trim() ? "var(--color-ink-1)" : "var(--color-surface-hover)",
                  color: draft.trim() ? "var(--color-canvas)" : "var(--color-ink-3)",
                }}
              >
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function EntityMenu({
  options,
  highlighted,
  onSelect,
}: {
  options: import("../hooks/useEntityAutocomplete").EntityOption[];
  highlighted: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-[14px] border"
      style={{
        background: "var(--color-canvas)",
        borderColor: "var(--color-border-strong)",
        boxShadow: "var(--shadow-card)",
      }}
      role="listbox"
      aria-label="Entiteiten"
    >
      {options.map((opt, i) => {
        const { domain } = parseEntity(opt.entity_id);
        const Icon = iconForDomain(domain);
        const active = i === highlighted;
        return (
          <button
            key={opt.entity_id}
            type="button"
            role="option"
            aria-selected={active}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(i);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left"
            style={{
              background: active ? "var(--color-surface-hover)" : "transparent",
            }}
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "var(--color-accent-soft)",
                color: "var(--color-accent-500)",
              }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[13px] text-(--color-ink-1)"
                style={{ fontWeight: 500 }}
              >
                {opt.friendly_name || opt.entity_id}
              </span>
              <span
                className="block truncate text-[11px] text-(--color-ink-3)"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {opt.entity_id}
                {opt.area ? ` · ${opt.area}` : ""}
              </span>
            </span>
            {opt.state && (
              <span
                className="shrink-0 text-[11px] text-(--color-ink-3)"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {opt.state}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState() {
  const suggestions = timelySuggestions();
  return (
    <div className="mx-auto flex h-full max-w-[52ch] flex-col items-center justify-center gap-5 py-20 text-center">
      <h1
        className="text-[42px] leading-[1.05] text-(--color-ink-1)"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
        }}
      >
        Wat wil je <em>regelen</em>?
      </h1>
      <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-(--color-ink-2)">
        Vraag iets in gewone taal. Ik zoek de juiste entiteiten op, roep de juiste services aan en laat je zien wat er veranderd is.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            className="rounded-full border px-3 py-1.5 text-[12px] text-(--color-ink-2) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
            style={{
              fontFamily: "var(--font-mono)",
              borderColor: "var(--color-border)",
              background: "var(--color-canvas)",
            }}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent<string>("ha-agent:followup", { detail: s }),
              )
            }
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function timelySuggestions(): string[] {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) {
    return [
      "hoe wordt het weer vandaag?",
      "wat staat er op de agenda?",
      "zijn alle lampen uit?",
    ];
  }
  if (h >= 10 && h < 17) {
    return [
      "wat speelt er in de woonkamer?",
      "zet de hallway op 40%",
      "hoe warm is het binnen?",
    ];
  }
  if (h >= 17 && h < 22) {
    return [
      "zet sfeerverlichting aan beneden",
      "wat eten we vanavond?",
      "zet edwin spotify aan in de woonkamer",
    ];
  }
  return ["alle lichten beneden uit", "zet het alarm aan", "goedenavond"];
}
