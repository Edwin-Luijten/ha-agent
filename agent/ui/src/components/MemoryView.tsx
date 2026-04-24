import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import type { EntityOption } from "../hooks/useEntityAutocomplete";
import { iconForDomain, parseEntity } from "../lib/entity";

type Alias = {
  alias: string;
  target: string;
  added_at?: string | null;
};

export function MemoryView() {
  const [aliases, setAliases] = useState<Alias[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/aliases")
      .then((r) => r.json())
      .then((d) => setAliases((d.aliases ?? []) as Alias[]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!aliases) return [];
    const q = query.trim().toLowerCase();
    if (!q) return aliases;
    return aliases.filter(
      (a) => a.alias.includes(q) || a.target.toLowerCase().includes(q),
    );
  }, [aliases, query]);

  const upsert = async (alias: string, target: string) => {
    const r = await fetch("/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias, target }),
    });
    if (!r.ok) return;
    load();
  };

  const remove = async (alias: string) => {
    const r = await fetch(`/aliases/${encodeURIComponent(alias)}`, { method: "DELETE" });
    if (!r.ok) return;
    load();
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-wrap items-center gap-3 border-b px-5 py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="text-[11px] text-(--color-ink-3)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          aliassen · {filtered.length}/{aliases?.length ?? 0}
        </div>
        <div
          className="flex flex-1 items-center gap-1.5 rounded-full border px-3 py-1"
          style={{ borderColor: "var(--color-border)", background: "var(--color-canvas)" }}
        >
          <Search className="h-3 w-3 shrink-0 text-(--color-ink-3)" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="zoek op alias of entity…"
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-(--color-ink-3)"
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </div>
        <button
          onClick={load}
          aria-label="Refresh"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-(--color-ink-2) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
          style={{ borderColor: "var(--color-border)", background: "var(--color-canvas)" }}
        >
          <RefreshCw className={"h-3.5 w-3.5" + (loading ? " animate-spin" : "")} strokeWidth={2} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex max-w-[80ch] flex-col gap-4">
          <Intro />
          <NewAliasForm onSubmit={upsert} />
          {aliases === null ? (
            <div
              className="px-2 py-6 text-center text-sm text-(--color-ink-3)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              loading…
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="px-2 py-6 text-center text-sm text-(--color-ink-3)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {aliases.length === 0
                ? "nog geen aliassen. voeg er één toe hierboven, of zeg in de chat \"onthoud deze lamp als …\"."
                : "geen resultaten."}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((a) => (
                <AliasRow key={a.alias} alias={a} onDelete={() => remove(a.alias)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Intro() {
  return (
    <div
      className="flex items-start gap-3 rounded-[14px] border px-4 py-3"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface-raised)",
      }}
    >
      <Sparkles
        className="mt-0.5 h-4 w-4 shrink-0"
        strokeWidth={2}
        style={{ color: "var(--color-accent-500)" }}
      />
      <div className="text-[13px] leading-snug text-(--color-ink-2)">
        <span className="text-(--color-ink-1)" style={{ fontWeight: 500 }}>
          Persoonlijke woordenschat.
        </span>{" "}
        Koppel een spreektaalnaam aan een entity. De agent gebruikt deze zonder
        nog eens te zoeken — "edwin's spotify" wordt direct{" "}
        <code className="text-(--color-ink-1)">media_player.spotify_edwin</code>.
      </div>
    </div>
  );
}

function NewAliasForm({ onSubmit }: { onSubmit: (alias: string, target: string) => void }) {
  const [alias, setAlias] = useState("");
  const [target, setTarget] = useState("");
  const [suggestions, setSuggestions] = useState<EntityOption[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const q = target.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const tid = window.setTimeout(() => {
      fetch(`/entities?prefix=${encodeURIComponent(q)}&limit=6`)
        .then((r) => r.json())
        .then((d) => setSuggestions((d.entities ?? []) as EntityOption[]))
        .catch(() => setSuggestions([]));
    }, 120);
    return () => window.clearTimeout(tid);
  }, [target]);

  const submit = () => {
    const a = alias.trim();
    const t = target.trim();
    if (!a || !t) return;
    onSubmit(a, t);
    setAlias("");
    setTarget("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  return (
    <div
      className="rounded-[14px] border px-3 py-3"
      style={{
        borderColor: "var(--color-border-strong)",
        background: "var(--color-canvas)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="mb-2 text-[11px] uppercase tracking-[0.12em] text-(--color-ink-3)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        nieuw alias
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          ref={inputRef}
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="edwin's spotify"
          className="rounded-md border bg-(--color-canvas) px-3 py-1.5 text-[13px] outline-none placeholder:text-(--color-ink-3)"
          style={{ borderColor: "var(--color-border)" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="relative">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="media_player.spotify_edwin"
            className="w-full rounded-md border bg-(--color-canvas) px-3 py-1.5 text-[13px] outline-none placeholder:text-(--color-ink-3)"
            style={{
              borderColor: "var(--color-border)",
              fontFamily: "var(--font-mono)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          {suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-md border"
              style={{
                borderColor: "var(--color-border-strong)",
                background: "var(--color-canvas)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {suggestions.map((opt) => {
                const { domain } = parseEntity(opt.entity_id);
                const Icon = iconForDomain(domain);
                return (
                  <button
                    key={opt.entity_id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTarget(opt.entity_id);
                      setSuggestions([]);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition hover:bg-(--color-surface-hover)"
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0 text-(--color-ink-3)"
                      strokeWidth={1.8}
                    />
                    <span
                      className="truncate text-(--color-ink-1)"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {opt.entity_id}
                    </span>
                    <span className="ml-auto shrink-0 truncate text-(--color-ink-3)">
                      {opt.friendly_name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={submit}
          disabled={!alias.trim() || !target.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] transition disabled:opacity-40"
          style={{
            background: "var(--color-ink-1)",
            color: "var(--color-canvas)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          opslaan
        </button>
      </div>
    </div>
  );
}

function AliasRow({ alias, onDelete }: { alias: Alias; onDelete: () => void }) {
  const targets = alias.target.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div
      className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 rounded-md border px-3 py-2"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-canvas)",
      }}
    >
      <div
        className="truncate text-[13px] text-(--color-ink-1)"
        style={{ fontWeight: 500 }}
        title={alias.alias}
      >
        {alias.alias}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {targets.map((t) => {
          const { domain } = parseEntity(t);
          const Icon = iconForDomain(domain);
          return (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11px]"
              style={{
                borderColor: "var(--color-border)",
                fontFamily: "var(--font-mono)",
                color: "var(--color-ink-2)",
              }}
              title={t}
            >
              <Icon className="h-3 w-3" strokeWidth={1.8} />
              {t}
            </span>
          );
        })}
      </div>
      <button
        onClick={onDelete}
        aria-label={`Verwijder ${alias.alias}`}
        title="Verwijder"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-(--color-ink-3) transition hover:bg-(--color-surface-hover) hover:text-(--color-status-err)"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
