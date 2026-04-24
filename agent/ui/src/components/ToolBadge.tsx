import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { classifyTool } from "../lib/toolKind";

type Props = {
  name: string;
  ended: boolean;
  args?: Record<string, unknown>;
};

export function ToolBadge({ name, ended, args }: Props) {
  const vis = classifyTool(name);
  const Icon = vis.icon;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasArgs = args && Object.keys(args).length > 0;

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11px] transition hover:brightness-95"
        style={{
          fontFamily: "var(--font-mono)",
          background: vis.bg,
          color: vis.ink,
          borderColor: "var(--color-border)",
        }}
      >
        {ended ? (
          <Icon className="h-3 w-3" strokeWidth={2} />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
        )}
        <span>{name}</span>
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-[min(92vw,520px)] rounded-[12px] border p-3 shadow-lg"
          style={{
            background: "var(--color-canvas)",
            borderColor: "var(--color-border-strong)",
            boxShadow: "0 10px 30px -10px oklch(0.2 0.01 260 / 0.18)",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] uppercase tracking-[0.14em] text-(--color-ink-3)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              tool call
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[10px]"
              style={{
                fontFamily: "var(--font-mono)",
                background: ended
                  ? "var(--color-kind-read-bg)"
                  : "var(--color-kind-mutate-bg)",
                color: ended ? "var(--color-status-ok)" : "var(--color-status-warn)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: ended ? "var(--color-status-ok)" : "var(--color-status-warn)",
                }}
              />
              {ended ? "klaar" : "bezig"}
            </span>
          </div>
          <div
            className="mt-1 truncate text-[14px] text-(--color-ink-1)"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {name}
          </div>
          {hasArgs ? (
            <pre
              className="mt-2 max-h-[220px] overflow-auto rounded-[8px] border px-2.5 py-2 text-[11.5px] leading-[1.5] text-(--color-ink-2)"
              style={{
                fontFamily: "var(--font-mono)",
                background: "var(--color-surface-raised)",
                borderColor: "var(--color-border)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {prettyJson(args as Record<string, unknown>)}
            </pre>
          ) : (
            <div className="mt-2 text-[12px] text-(--color-ink-3)">geen argumenten</div>
          )}
        </div>
      )}
    </span>
  );
}

function prettyJson(v: Record<string, unknown>): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
