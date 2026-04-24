import { useEffect, useRef, useState } from "react";
import { Clock, MessageSquare, X } from "lucide-react";

type Session = {
  session_id: string;
  first_message: string;
  first_ts: string | null;
  last_ts: string | null;
  turn_count: number;
  total_tokens: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (session_id: string) => void;
  currentId?: string;
};

export function SessionDrawer({ open, onClose, onSelect, currentId }: Props) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetch("/sessions?limit=50")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSessions(d.sessions ?? []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="Gesprekken"
    >
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          background: "color-mix(in oklch, var(--color-ink-1) 35%, transparent)",
        }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="absolute left-0 top-0 h-full w-[min(360px,92vw)] border-r"
        style={{
          background: "var(--color-canvas)",
          borderColor: "var(--color-border)",
          boxShadow:
            "0 0 0 1px oklch(0 0 0 / 0.03), 10px 0 40px -16px oklch(0 0 0 / 0.25)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span
            className="text-[13px] text-(--color-ink-1)"
            style={{ fontWeight: 500 }}
          >
            Gesprekken
          </span>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-(--color-ink-3) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink-1)"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        <div className="h-[calc(100%-49px)] overflow-y-auto px-2 py-2">
          {loading && !sessions ? (
            <div
              className="px-3 py-8 text-center text-[12px] text-(--color-ink-3)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              loading…
            </div>
          ) : sessions && sessions.length === 0 ? (
            <div
              className="px-3 py-8 text-center text-[12px] text-(--color-ink-3)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              geen gesprekken.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {sessions?.map((s) => (
                <SessionRow
                  key={s.session_id}
                  s={s}
                  current={s.session_id === currentId}
                  onClick={() => {
                    onSelect(s.session_id);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionRow({
  s,
  current,
  onClick,
}: {
  s: Session;
  current: boolean;
  onClick: () => void;
}) {
  const title = s.first_message.trim() || "(leeg gesprek)";
  const rel = relTime(s.last_ts);
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md px-3 py-2 text-left transition hover:bg-(--color-surface-hover)"
      style={{
        background: current ? "var(--color-surface-hover)" : "transparent",
      }}
    >
      <div
        className="truncate text-[13px] text-(--color-ink-1)"
        style={{ fontWeight: current ? 500 : 400 }}
        title={title}
      >
        {title}
      </div>
      <div
        className="mt-0.5 flex items-center gap-2 text-[11px] text-(--color-ink-3)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" strokeWidth={2} />
          {rel}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" strokeWidth={2} />
          {s.turn_count}
        </span>
        {s.total_tokens > 0 && (
          <>
            <span>·</span>
            <span>{fmtTokens(s.total_tokens)} tok</span>
          </>
        )}
      </div>
    </button>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "zojuist";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} u`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(ts).toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
}

function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}
