import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  RefreshCw,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { iconForDomain } from "../lib/entity";
import type { TraceEntry } from "../lib/types";

type AuditEntry = {
  ts: string;
  session_id: string;
  user_id?: string;
  domain: string;
  service: string;
  data: Record<string, unknown>;
  result: string;
  confirmation_required?: boolean;
  response?: unknown;
};

type TopTab = "acties" | "traces";

export function ActivityView() {
  const [tab, setTab] = useState<TopTab>("acties");
  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center gap-1 border-b px-5 py-2"
        style={{ borderColor: "var(--color-border)" }}
      >
        <SegButton label="Acties" active={tab === "acties"} onClick={() => setTab("acties")} />
        <SegButton label="Traces" active={tab === "traces"} onClick={() => setTab("traces")} />
      </div>
      <div className="min-h-0 flex-1">
        {tab === "acties" ? <AuditTab /> : <TracesTab />}
      </div>
    </div>
  );
}

function SegButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1 text-[12px] transition"
      style={{
        fontFamily: "var(--font-mono)",
        background: active ? "var(--color-ink-1)" : "transparent",
        color: active ? "var(--color-canvas)" : "var(--color-ink-3)",
      }}
    >
      {label}
    </button>
  );
}

/* ---------------------- Acties (audit) ---------------------- */

type Filter = "all" | "ok" | "err";

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/audit?limit=500")
      .then((r) => r.json())
      .then((d) => setEntries((d.entries ?? []).reverse()))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const counts = useMemo(() => {
    let ok = 0;
    let err = 0;
    for (const e of entries) {
      if (e.result === "ok") ok++;
      else err++;
    }
    return { ok, err, all: entries.length };
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "ok" && e.result !== "ok") return false;
      if (filter === "err" && e.result === "ok") return false;
      if (!q) return true;
      const hay = `${e.domain}.${e.service} ${JSON.stringify(e.data)} ${e.result}`.toLowerCase();
      return hay.includes(q);
    });
  }, [entries, filter, query]);

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
          audit · {filtered.length}/{counts.all}
        </div>
        <FilterChip label="alles" active={filter === "all"} count={counts.all} onClick={() => setFilter("all")} />
        <FilterChip label="ok" active={filter === "ok"} count={counts.ok} onClick={() => setFilter("ok")} />
        <FilterChip label="fouten" active={filter === "err"} count={counts.err} onClick={() => setFilter("err")} danger />
        <div
          className="flex flex-1 items-center gap-1.5 rounded-full border px-3 py-1"
          style={{ borderColor: "var(--color-border)", background: "var(--color-canvas)" }}
        >
          <Search className="h-3 w-3 shrink-0 text-(--color-ink-3)" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="zoek op entity, service, resultaat…"
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
      {filtered.length === 0 ? (
        <div
          className="flex-1 p-8 text-center text-sm text-(--color-ink-3)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {loading ? "loading…" : entries.length === 0 ? "no activity yet." : "geen resultaten."}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto flex max-w-[80ch] flex-col gap-1.5">
            {filtered.map((e, i) => (
              <AuditRow key={`${e.ts}-${i}`} entry={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  count,
  danger,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] transition"
      style={{
        fontFamily: "var(--font-mono)",
        borderColor: active ? "var(--color-ink-1)" : "var(--color-border)",
        background: active ? "var(--color-ink-1)" : "var(--color-canvas)",
        color: active
          ? "var(--color-canvas)"
          : danger
            ? "var(--color-status-err)"
            : "var(--color-ink-2)",
      }}
    >
      {label}
      <span
        className="tabular-nums"
        style={{
          opacity: 0.7,
          color: active ? "var(--color-canvas)" : "var(--color-ink-3)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const ok = entry.result === "ok";
  const d = new Date(entry.ts);
  const ts = d.toLocaleTimeString("nl-NL", { hour12: false });
  const dateStr = d.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
  });
  const Icon = iconForDomain(entry.domain);

  return (
    <div
      className="rounded-md border transition-colors"
      style={{
        background: "var(--color-canvas)",
        borderColor: open
          ? "var(--color-border-strong)"
          : "var(--color-border)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_auto_auto_1fr_auto_auto] items-center gap-3 rounded-md px-3 py-2 text-left text-[12px] transition hover:bg-(--color-surface-hover)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <ChevronRight
          className={"h-3 w-3 shrink-0 text-(--color-ink-3) transition-transform " + (open ? "rotate-90" : "")}
          strokeWidth={2}
        />
        <span className="text-(--color-ink-3)" title={d.toLocaleString("nl-NL")}>
          {ts}
        </span>
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-(--color-ink-2)">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 truncate">
          <span className="text-(--color-accent-500)">{entry.domain}</span>
          <span className="text-(--color-ink-3)">.</span>
          <span className="text-(--color-ink-1)">{entry.service}</span>
          <span className="ml-2 truncate text-(--color-ink-2)">{summary(entry.data)}</span>
        </span>
        {entry.confirmation_required && (
          <span title="Confirmation was required" className="text-(--color-status-warn)">
            <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        )}
        <span
          className="rounded-full px-2 py-[1px] text-[10px] uppercase tracking-wider"
          style={{
            background: ok ? "var(--color-kind-read-bg)" : "var(--color-kind-mutate-bg)",
            color: ok ? "var(--color-status-ok)" : "var(--color-status-err)",
          }}
        >
          {ok ? "ok" : "err"}
        </span>
      </button>
      {open && (
        <div
          className="border-t px-3 py-2.5 text-[11.5px]"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface-raised)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <DetailGrid entry={entry} dateStr={dateStr} />
          <DetailSection label="data" value={prettyJson(entry.data)} />
          {entry.response !== undefined && (
            <DetailSection label="response" value={prettyJson(entry.response)} />
          )}
          {!ok && <DetailSection label="result" value={entry.result} />}
        </div>
      )}
    </div>
  );
}

function DetailGrid({ entry, dateStr }: { entry: AuditEntry; dateStr: string }) {
  const rows: [string, React.ReactNode][] = [
    ["datum", dateStr],
    ["session", <Trunc key="s" value={entry.session_id} />],
  ];
  if (entry.user_id) rows.push(["user", <Trunc key="u" value={entry.user_id} />]);
  if (entry.confirmation_required) rows.push(["confirm", "ja"]);
  return (
    <div className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <span
            className="uppercase tracking-[0.12em] text-(--color-ink-3)"
            style={{ fontSize: 10 }}
          >
            {k}
          </span>
          <span className="min-w-0 truncate text-(--color-ink-2)">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Trunc({ value }: { value: string }) {
  const short = value.length > 32 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
  return (
    <span title={value} style={{ fontFamily: "var(--font-mono)" }}>
      {short}
    </span>
  );
}

function DetailSection({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="mt-1">
      <div className="mb-0.5 flex items-center justify-between">
        <span
          className="uppercase tracking-[0.12em] text-(--color-ink-3)"
          style={{ fontSize: 10 }}
        >
          {label}
        </span>
        <button
          onClick={doCopy}
          className="inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] text-[10px] text-(--color-ink-3) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Copy className="h-3 w-3" strokeWidth={2} />
          {copied ? "gekopieerd" : "kopieer"}
        </button>
      </div>
      <pre
        className="max-h-[280px] overflow-auto rounded-md border px-2.5 py-2 text-[11px] leading-[1.55] text-(--color-ink-2)"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-canvas)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {value}
      </pre>
    </div>
  );
}

function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function summary(data: Record<string, unknown>): string {
  const eid = data["entity_id"];
  if (typeof eid === "string") {
    const rest = Object.entries(data)
      .filter(([k]) => k !== "entity_id")
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" ");
    return rest ? `${eid}  ${rest}` : eid;
  }
  return JSON.stringify(data);
}

/* ---------------------- Traces ---------------------- */

type SessionGroup = {
  session_id: string;
  first_ts: string;
  last_ts: string;
  entries: TraceEntry[];
  totalTokens: number;
  totalLatency: number;
  totalTools: number;
};

function TracesTab() {
  const [entries, setEntries] = useState<TraceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/traces?limit=1000&days=7")
      .then((r) => r.json())
      .then((d) => setEntries((d.entries ?? []) as TraceEntry[]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const groups = useMemo(() => groupBySession(entries), [entries]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) =>
      g.entries.some((e) => {
        const tools = (e.tool_calls ?? []).map((t) => t.name).join(" ");
        return (
          e.user_message.toLowerCase().includes(q) ||
          e.response_text.toLowerCase().includes(q) ||
          tools.toLowerCase().includes(q) ||
          g.session_id.toLowerCase().includes(q)
        );
      }),
    );
  }, [groups, query]);

  const totals = useMemo(() => {
    let turns = 0;
    let tokens = 0;
    for (const g of groups) {
      turns += g.entries.length;
      tokens += g.totalTokens;
    }
    return { sessions: groups.length, turns, tokens };
  }, [groups]);

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
          traces · {totals.sessions} gesprekken · {totals.turns} turns · {fmtTokens(totals.tokens)} tok
        </div>
        <div
          className="flex flex-1 items-center gap-1.5 rounded-full border px-3 py-1"
          style={{ borderColor: "var(--color-border)", background: "var(--color-canvas)" }}
        >
          <Search className="h-3 w-3 shrink-0 text-(--color-ink-3)" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="zoek in vragen, antwoorden, tools…"
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
      {filtered.length === 0 ? (
        <div
          className="flex-1 p-8 text-center text-sm text-(--color-ink-3)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {loading ? "loading…" : entries.length === 0 ? "no traces yet." : "geen resultaten."}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto flex max-w-[80ch] flex-col gap-3">
            {filtered.map((g) => (
              <SessionGroupCard key={g.session_id} group={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionGroupCard({ group }: { group: SessionGroup }) {
  const [open, setOpen] = useState(false);
  const first = group.entries[0];
  const headline = first?.user_message || "(leeg gesprek)";
  const startedAt = new Date(group.first_ts);
  const lastAt = new Date(group.last_ts);
  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{
        background: "var(--color-canvas)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3 text-left transition hover:bg-(--color-surface-hover)"
      >
        <ChevronRight
          className={"mt-1 h-3.5 w-3.5 text-(--color-ink-3) transition-transform " + (open ? "rotate-90" : "")}
          strokeWidth={2}
        />
        <div className="min-w-0">
          <div
            className="truncate text-[14px] text-(--color-ink-1)"
            style={{ fontWeight: 500 }}
            title={headline}
          >
            {headline}
          </div>
          <div
            className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-(--color-ink-3)"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span>
              {startedAt.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" })}
              {" "}
              {startedAt.toLocaleTimeString("nl-NL", { hour12: false, hour: "2-digit", minute: "2-digit" })}
              {" → "}
              {lastAt.toLocaleTimeString("nl-NL", { hour12: false, hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>·</span>
            <span>{group.entries.length} turns</span>
            <span>·</span>
            <span>{group.totalTools} tools</span>
            <span>·</span>
            <span>{fmtTokens(group.totalTokens)} tok</span>
            <span>·</span>
            <span>{fmtMs(group.totalLatency)}</span>
          </div>
        </div>
        <span
          className="shrink-0 truncate text-[10px] text-(--color-ink-3)"
          style={{ fontFamily: "var(--font-mono)", maxWidth: 120 }}
          title={group.session_id}
        >
          {shortId(group.session_id)}
        </span>
      </button>
      {open && (
        <div
          className="border-t px-4 pb-3 pt-2"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)" }}
        >
          <div className="flex flex-col gap-2.5">
            {group.entries.map((t, i) => (
              <TurnRow key={`${t.ts}-${i}`} entry={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TurnRow({ entry }: { entry: TraceEntry }) {
  const [open, setOpen] = useState(false);
  const ts = new Date(entry.ts);
  const hhmm = ts.toLocaleTimeString("nl-NL", { hour12: false });
  const toolNames = (entry.tool_calls ?? []).map((t) => t.name);
  const toolSummary = toolNames.length === 0
    ? "—"
    : toolNames.slice(0, 3).join(", ") + (toolNames.length > 3 ? ` +${toolNames.length - 3}` : "");

  return (
    <div
      className="rounded-md border"
      style={{
        background: "var(--color-canvas)",
        borderColor: open ? "var(--color-border-strong)" : "var(--color-border)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-3 py-2 text-left text-[12px] transition hover:bg-(--color-surface-hover)"
      >
        <ChevronRight
          className={"h-3 w-3 text-(--color-ink-3) transition-transform " + (open ? "rotate-90" : "")}
          strokeWidth={2}
        />
        <span className="text-(--color-ink-3)" style={{ fontFamily: "var(--font-mono)" }}>
          {hhmm}
        </span>
        <span className="min-w-0 truncate text-(--color-ink-1)">{entry.user_message}</span>
        <span
          className="flex items-center gap-2.5 text-[10.5px] text-(--color-ink-3)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="inline-flex items-center gap-1">
            <Wrench className="h-3 w-3" strokeWidth={2} />
            {toolSummary}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={2} />
            {fmtMs(entry.total_latency_ms)}
          </span>
          {entry.tokens && (
            <span className="inline-flex items-center gap-1">
              <Cpu className="h-3 w-3" strokeWidth={2} />
              {fmtTokens(entry.tokens.total)}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div
          className="border-t px-3 py-2.5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)" }}
        >
          {entry.response_text && (
            <TurnBlock label="antwoord" body={entry.response_text} />
          )}
          {entry.tool_calls && entry.tool_calls.length > 0 && (
            <TurnBlock label={`tools (${entry.tool_calls.length})`} body={prettyJson(entry.tool_calls)} mono />
          )}
          {entry.tokens && (
            <div
              className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-(--color-ink-3)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="inline-flex items-center gap-1 text-(--color-ink-2)">
                <Brain className="h-3 w-3" strokeWidth={2} />
                {entry.tokens.llm_calls} calls
              </span>
              <span>in {entry.tokens.prompt}</span>
              <span>out {entry.tokens.completion}</span>
              {entry.tokens.thoughts > 0 && <span>denk {entry.tokens.thoughts}</span>}
              {entry.tokens.cached > 0 && <span>cache {entry.tokens.cached}</span>}
              <span>totaal {entry.tokens.total}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TurnBlock({ label, body, mono }: { label: string; body: string; mono?: boolean }) {
  return (
    <div className="mt-1">
      <div
        className="mb-0.5 uppercase tracking-[0.12em] text-(--color-ink-3)"
        style={{ fontSize: 10 }}
      >
        {label}
      </div>
      <pre
        className="max-h-[260px] overflow-auto rounded-md border px-2.5 py-2 text-[11.5px] leading-[1.55] text-(--color-ink-2)"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-canvas)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
        }}
      >
        {body}
      </pre>
    </div>
  );
}

function groupBySession(entries: TraceEntry[]): SessionGroup[] {
  const map = new Map<string, TraceEntry[]>();
  for (const e of entries) {
    const list = map.get(e.session_id) ?? [];
    list.push(e);
    map.set(e.session_id, list);
  }
  const groups: SessionGroup[] = [];
  for (const [session_id, list] of map) {
    // entries arrive newest-first; turns inside a session should read oldest-first.
    const sorted = [...list].sort((a, b) => (a.ts < b.ts ? -1 : 1));
    let tokens = 0;
    let latency = 0;
    let tools = 0;
    for (const t of sorted) {
      tokens += t.tokens?.total ?? 0;
      latency += t.total_latency_ms ?? 0;
      tools += t.tool_calls?.length ?? 0;
    }
    groups.push({
      session_id,
      first_ts: sorted[0].ts,
      last_ts: sorted[sorted.length - 1].ts,
      entries: sorted,
      totalTokens: tokens,
      totalLatency: latency,
      totalTools: tools,
    });
  }
  groups.sort((a, b) => (a.last_ts < b.last_ts ? 1 : -1));
  return groups;
}

function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return (ms / 1000).toFixed(1) + "s";
}

function shortId(s: string): string {
  if (s.length <= 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
