import { Check, ListTree, X } from "lucide-react";
import { submitFollowup } from "./followup";

type Step = {
  label: string;
  detail?: string;
};

type Props = {
  steps: (string | Step)[];
  action_id: string;
  title?: string;
};

export function Plan({ steps, action_id, title }: Props) {
  const normalized = steps.map(normalize);
  return (
    <div
      className="rounded-[14px] border px-4 py-3"
      style={{
        background: "var(--color-canvas)",
        borderColor: "var(--color-border-strong)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <ListTree
          className="mt-0.5 h-4 w-4 shrink-0"
          strokeWidth={2}
          style={{ color: "var(--color-accent-500)" }}
        />
        <div className="flex-1 text-[14px] leading-snug text-(--color-ink-1)" style={{ fontWeight: 500 }}>
          {title ?? "Plan"}
        </div>
      </div>
      <ol className="mt-2 ml-6 flex flex-col gap-1">
        {normalized.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-(--color-ink-2)">
            <span
              className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]"
              style={{
                background: "var(--color-surface-hover)",
                color: "var(--color-ink-2)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-(--color-ink-1)">{s.label}</div>
              {s.detail && (
                <div
                  className="mt-0.5 truncate text-[11px] text-(--color-ink-3)"
                  style={{ fontFamily: "var(--font-mono)" }}
                  title={s.detail}
                >
                  {s.detail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => submitFollowup(`ja, voer uit (action ${action_id})`)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
          style={{
            background: "var(--color-ink-1)",
            color: "var(--color-canvas)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <Check className="h-3 w-3" strokeWidth={2.5} />
          VOER UIT
        </button>
        <button
          onClick={() => submitFollowup(`annuleer (action ${action_id})`)}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] text-(--color-ink-1)"
          style={{
            borderColor: "var(--color-border-strong)",
            background: "var(--color-canvas)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
          ANNULEER
        </button>
      </div>
    </div>
  );
}

function normalize(s: string | Step): Step {
  if (typeof s === "string") return { label: s };
  return { label: s.label, detail: s.detail };
}
