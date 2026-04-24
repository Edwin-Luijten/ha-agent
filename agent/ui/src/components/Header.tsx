import { useEffect, useRef, useState } from "react";
import { CloudOff, History, Monitor, Moon, PenSquare, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import type { TokenUsage } from "../lib/types";

type Health = { status: "ok" | "warming_up"; entities: number } | null;

async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  try {
    const r = await fetch("/healthz", { signal });
    if (!r.ok) return null;
    return (await r.json()) as Health;
  } catch {
    return null;
  }
}

type Props = {
  sending: boolean;
  sessionTokens?: TokenUsage | null;
  onNewConversation?: () => void;
  hasMessages?: boolean;
  onOpenHistory?: () => void;
};

export function Header({ sending, sessionTokens, onNewConversation, hasMessages, onOpenHistory }: Props) {
  const theme = useTheme();
  const [health, setHealth] = useState<Health>(null);
  // Only show the "offline" banner after two consecutive failures so the
  // first failed poll during startup doesn't flash a banner.
  const failsRef = useRef(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const h = await fetchHealth();
      if (!alive) return;
      setHealth(h);
      if (h === null) {
        failsRef.current += 1;
        if (failsRef.current >= 2) setOffline(true);
      } else {
        failsRef.current = 0;
        setOffline(false);
      }
    };
    void poll();
    const t = window.setInterval(poll, 8000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const status =
    health === null ? "down" : health.status === "ok" ? "ok" : "warming";
  const dotColor =
    status === "ok"
      ? "var(--color-status-ok)"
      : status === "warming"
        ? "var(--color-status-warn)"
        : "var(--color-status-err)";
  const statusLabel =
    status === "ok"
      ? `online · ${health?.entities ?? 0} entities`
      : status === "warming"
        ? "warming up"
        : "offline";

  return (
    <>
      <header
        className="flex items-center justify-between border-b px-5 py-3.5"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-baseline gap-2.5">
          <svg viewBox="0 0 20 20" className="h-5 w-5 translate-y-[3px]" aria-hidden>
            <rect
              x="2.5"
              y="2.5"
              width="15"
              height="15"
              rx="3.5"
              fill="none"
              stroke="var(--color-accent-500)"
              strokeWidth="1.4"
              transform="rotate(18 10 10)"
              className={sending ? "dot-pulse" : ""}
            />
            <rect x="6.5" y="6.5" width="7" height="7" rx="1.5" fill="var(--color-accent-500)" />
          </svg>
          <span
            className="text-[18px] leading-none"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.005em",
              color: "var(--color-ink-1)",
            }}
          >
            ha agent
          </span>
          <span
            className="text-[11px] text-(--color-ink-3)"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            adk
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              aria-label="Gesprekken"
              title="Gesprekken"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-(--color-ink-2) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-canvas)",
              }}
            >
              <History className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
          <button
            onClick={theme.cycle}
            aria-label={`Thema: ${theme.pref}`}
            title={`Thema: ${theme.pref} (${theme.resolved})`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-(--color-ink-2) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-canvas)",
            }}
          >
            {theme.pref === "dark" ? (
              <Moon className="h-3.5 w-3.5" strokeWidth={2} />
            ) : theme.pref === "light" ? (
              <Sun className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <Monitor className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>
          {onNewConversation && hasMessages && (
            <button
              onClick={onNewConversation}
              aria-label="Nieuw gesprek"
              title="Nieuw gesprek"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] text-(--color-ink-2) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
              style={{
                fontFamily: "var(--font-mono)",
                borderColor: "var(--color-border)",
                background: "var(--color-canvas)",
              }}
            >
              <PenSquare className="h-3.5 w-3.5" strokeWidth={2} />
              nieuw
            </button>
          )}
          {sessionTokens && sessionTokens.total > 0 && (
            <span
              className="hidden items-center gap-1.5 text-[11px] text-(--color-ink-3) sm:inline-flex"
              style={{ fontFamily: "var(--font-mono)" }}
              title={`Session total: ${sessionTokens.prompt} in · ${sessionTokens.completion} out · ${sessionTokens.llm_calls} calls`}
            >
              <span className="text-(--color-accent-500)">◆</span>
              {fmt(sessionTokens.total)} tok · {sessionTokens.llm_calls} calls
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: dotColor }}
              aria-hidden
            />
            <span
              className="text-[11px] text-(--color-ink-3)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {statusLabel}
            </span>
          </span>
        </div>
      </header>
      {offline && <OfflineBanner />}
    </>
  );
}

function OfflineBanner() {
  return (
    <div
      className="flex items-center gap-2 border-b px-5 py-2 text-[12.5px]"
      style={{
        background: "var(--color-status-warn-bg)",
        borderColor: "color-mix(in oklch, var(--color-status-warn) 35%, var(--color-border))",
        color: "var(--color-ink-1)",
      }}
      role="status"
      aria-live="polite"
    >
      <CloudOff
        className="h-4 w-4 shrink-0"
        strokeWidth={2}
        style={{ color: "var(--color-status-warn)" }}
      />
      <span>
        <span style={{ fontWeight: 500 }}>Niet verbonden met de agent.</span>{" "}
        <span className="text-(--color-ink-2)">
          Ingrepen werken pas weer als de add-on reageert.
        </span>
      </span>
    </div>
  );
}

function fmt(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}
