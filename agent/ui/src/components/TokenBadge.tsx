import type { TokenUsage } from "../lib/types";

type Props = { tokens: TokenUsage };

export function TokenBadge({ tokens }: Props) {
  const detail =
    `${fmt(tokens.prompt)} in · ${fmt(tokens.completion)} out` +
    (tokens.thoughts > 0 ? ` · ${fmt(tokens.thoughts)} thought` : "") +
    (tokens.cached > 0 ? ` · ${fmt(tokens.cached)} cached` : "") +
    ` · ${tokens.llm_calls} call${tokens.llm_calls === 1 ? "" : "s"}`;
  return (
    <span
      title={detail}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px]"
      style={{
        fontFamily: "var(--font-mono)",
        background: "var(--color-surface)",
        color: "var(--color-ink-3)",
        borderColor: "var(--color-border)",
      }}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--color-accent-500)" }}
      />
      {fmt(tokens.total)}
      <span style={{ color: "var(--color-ink-muted)" }}>tok</span>
    </span>
  );
}

function fmt(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}
