import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { parseEntity } from "../../lib/entity";
import { submitFollowup } from "./followup";

type Props = { entity_id?: string; area?: string };

type State = {
  state: string;
  attributes: {
    friendly_name?: string;
    brightness?: number; // 0-255
    brightness_pct?: number; // 0-100
  };
};

export function LightControl({ entity_id, area }: Props) {
  const [bright, setBright] = useState(60);
  const [on, setOn] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState(
    entity_id ? parseEntity(entity_id).displayName : (area ?? "Lamp"),
  );
  const target = entity_id ?? area ?? "";
  const interactingRef = useRef(false);

  // Poll /state for real brightness. Only update local value while the user
  // isn't actively dragging the slider, so manual input is never overwritten.
  useEffect(() => {
    if (!entity_id) return; // area-only controls have no authoritative state
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/state/${encodeURIComponent(entity_id)}`);
        if (!r.ok) return;
        const body = (await r.json()) as State;
        if (!alive) return;
        if (body.attributes.friendly_name) setDisplayName(body.attributes.friendly_name);
        setOn(body.state === "on");
        if (interactingRef.current) return;
        const pct =
          body.attributes.brightness_pct ??
          (typeof body.attributes.brightness === "number"
            ? Math.round((body.attributes.brightness / 255) * 100)
            : undefined);
        if (typeof pct === "number") setBright(pct);
      } catch {
        /* ignore */
      }
    };
    void load();
    const t = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [entity_id]);

  const startDrag = () => {
    interactingRef.current = true;
  };
  const endDrag = () => {
    submitFollowup(`zet ${target} op ${bright}% helderheid`);
    // Let polling resume after a short debounce so the round-trip has time
    // to settle before we accept server values again.
    window.setTimeout(() => {
      interactingRef.current = false;
    }, 800);
  };

  return (
    <div
      className="flex items-center gap-4 rounded-[14px] border px-3 py-3"
      style={{
        background: "var(--color-canvas)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <BulbIcon pct={bright} on={on !== false} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-(--color-ink-1)" style={{ fontWeight: 500 }}>
          {displayName}
        </div>
        <div
          className="mb-2 truncate text-[11px] text-(--color-ink-3)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {target}
          {on !== null && <span> · {on ? "aan" : "uit"}</span>}
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={bright}
          onChange={(e) => setBright(parseInt(e.target.value, 10))}
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          onMouseUp={endDrag}
          onTouchEnd={endDrag}
          className="accent-range"
          style={{ "--pct": `${bright}%` } as React.CSSProperties}
          aria-label={`Helderheid ${displayName}`}
        />
      </div>
      <div
        className="shrink-0 text-right tabular-nums"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <div className="text-[16px] leading-none text-(--color-ink-1)">
          {bright}
          <span className="text-[11px] text-(--color-ink-3)">%</span>
        </div>
      </div>
    </div>
  );
}

function BulbIcon({ pct, on }: { pct: number; on: boolean }) {
  const opacity = on ? 0.25 + (pct / 100) * 0.75 : 0.15;
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{
        background: on ? "var(--color-accent-soft)" : "var(--color-surface-hover)",
        color: on ? "var(--color-accent-500)" : "var(--color-ink-3)",
      }}
    >
      <Lightbulb className="h-4 w-4" strokeWidth={1.8} style={{ opacity }} />
    </span>
  );
}
