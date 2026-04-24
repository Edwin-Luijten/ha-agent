import { Camera } from "lucide-react";
import { parseEntity } from "../../lib/entity";

type Props = { entity_id: string; refresh_sec?: number };

export function CameraSnapshot({ entity_id, refresh_sec }: Props) {
  const { displayName } = parseEntity(entity_id);
  const src = `/api/camera_proxy/${entity_id}?t=${Date.now()}`;
  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{
        background: "var(--color-canvas)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="relative">
        <img
          src={src}
          alt={displayName}
          className="block w-full object-cover"
          style={{ maxHeight: 320 }}
        />
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]"
          style={{
            fontFamily: "var(--font-mono)",
            background: "color-mix(in oklch, black 55%, transparent)",
            color: "white",
            backdropFilter: "blur(6px)",
          }}
        >
          <Camera className="h-3 w-3" strokeWidth={2.25} />
          live
        </span>
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="truncate text-[13px] text-(--color-ink-1)" style={{ fontWeight: 500 }}>
          {displayName}
        </div>
        <div
          className="text-[11px] text-(--color-ink-3)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {refresh_sec ? `every ${refresh_sec}s` : entity_id}
        </div>
      </div>
    </div>
  );
}
