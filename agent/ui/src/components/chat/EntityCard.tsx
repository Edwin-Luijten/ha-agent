import { iconForDomain, parseEntity } from "../../lib/entity";

type Props = { entity_id: string };

export function EntityCard({ entity_id }: Props) {
  const { domain, displayName } = parseEntity(entity_id);
  const Icon = iconForDomain(domain);
  return (
    <div
      className="flex items-center gap-3 rounded-[14px] border px-3 py-2.5"
      style={{
        background: "var(--color-canvas)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: "var(--color-accent-soft)",
          color: "var(--color-accent-500)",
        }}
      >
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-(--color-ink-1)" style={{ fontWeight: 500 }}>
          {displayName}
        </div>
        <div
          className="truncate text-[11px] text-(--color-ink-3)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {entity_id}
        </div>
      </div>
    </div>
  );
}
