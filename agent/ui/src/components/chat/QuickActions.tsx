import { submitFollowup } from "./followup";

type Chip = { label: string; message: string };
type Props = { chips: Chip[] };

export function QuickActions({ chips }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={() => submitFollowup(c.message)}
          className="inline-flex items-center rounded-full border px-3 py-1 text-[12px] text-(--color-ink-2) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-canvas)",
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
