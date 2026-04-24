import { AlertTriangle, Check, X } from "lucide-react";
import { submitFollowup } from "./followup";

type Props = { prompt: string; action_id: string };

export function Confirmation({ prompt, action_id }: Props) {
  return (
    <div
      className="rounded-[14px] border px-4 py-3"
      style={{
        background: "var(--color-status-warn-bg)",
        borderColor: "color-mix(in oklch, var(--color-status-warn) 30%, var(--color-border))",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          strokeWidth={2}
          style={{ color: "var(--color-status-warn)" }}
        />
        <div className="flex-1 text-[14px] leading-snug text-(--color-ink-1)">{prompt}</div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => submitFollowup(`ja (action ${action_id})`)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
          style={{
            background: "var(--color-ink-1)",
            color: "var(--color-canvas)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <Check className="h-3 w-3" strokeWidth={2.5} />
          JA
        </button>
        <button
          onClick={() => submitFollowup(`nee (action ${action_id})`)}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] text-(--color-ink-1)"
          style={{
            borderColor: "var(--color-border-strong)",
            background: "var(--color-canvas)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
          NEE
        </button>
      </div>
    </div>
  );
}
