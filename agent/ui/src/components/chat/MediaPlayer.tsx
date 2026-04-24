import { useEffect, useState } from "react";
import { Disc3, Pause, SkipForward, Square } from "lucide-react";
import { parseEntity } from "../../lib/entity";
import { submitFollowup } from "./followup";

type Props = { entity_id: string };

type State = {
  state: string;
  attributes: {
    friendly_name?: string;
    media_title?: string;
    media_artist?: string;
    media_album_name?: string;
    entity_picture?: string;
  };
};

export function MediaPlayer({ entity_id }: Props) {
  const { displayName } = parseEntity(entity_id);
  const [st, setSt] = useState<State | null>(null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/state/${encodeURIComponent(entity_id)}`);
        if (!r.ok) return;
        const body = (await r.json()) as State;
        if (alive) setSt(body);
      } catch {
        /* ignore */
      }
    };
    void load();
    const t = window.setInterval(load, 6000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [entity_id]);

  const title = st?.attributes.media_title;
  const artist = st?.attributes.media_artist;
  const album = st?.attributes.media_album_name;
  const hasArt = !!st?.attributes.entity_picture && imgOk;
  const playing = st?.state === "playing";
  const headline = st?.attributes.friendly_name ?? displayName;

  return (
    <div
      className="flex items-stretch gap-3 rounded-[14px] border p-2.5"
      style={{
        background: "var(--color-canvas)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <CoverArt
        entity_id={entity_id}
        hasArt={hasArt}
        playing={playing}
        onError={() => setImgOk(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="min-w-0">
          {title ? (
            <>
              <div
                className="truncate text-[14px] text-(--color-ink-1)"
                style={{ fontWeight: 500 }}
                title={title}
              >
                {title}
              </div>
              {(artist || album) && (
                <div className="truncate text-[12px] text-(--color-ink-2)" title={`${artist ?? ""} — ${album ?? ""}`}>
                  {artist}
                  {artist && album ? " — " : ""}
                  {album}
                </div>
              )}
              <div
                className="mt-0.5 truncate text-[11px] text-(--color-ink-3)"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {entity_id}
              </div>
            </>
          ) : (
            <>
              <div className="truncate text-[14px] text-(--color-ink-1)" style={{ fontWeight: 500 }}>
                {headline}
              </div>
              <div
                className="mt-0.5 truncate text-[11px] text-(--color-ink-3)"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {entity_id} · {st?.state ?? "…"}
              </div>
            </>
          )}
        </div>
        <div className="mt-2 flex gap-1.5">
          <TransportButton label="Pauze" icon={Pause} onClick={() => submitFollowup(`pauzeer ${entity_id}`)} />
          <TransportButton
            label="Volgende"
            icon={SkipForward}
            onClick={() => submitFollowup(`volgende nummer op ${entity_id}`)}
          />
          <TransportButton label="Stop" icon={Square} onClick={() => submitFollowup(`stop ${entity_id}`)} />
        </div>
      </div>
    </div>
  );
}

function CoverArt({
  entity_id,
  hasArt,
  playing,
  onError,
}: {
  entity_id: string;
  hasArt: boolean;
  playing: boolean;
  onError: () => void;
}) {
  if (hasArt) {
    return (
      <img
        src={`/media_image/${encodeURIComponent(entity_id)}`}
        alt=""
        onError={onError}
        className="h-16 w-16 shrink-0 rounded-[10px] object-cover"
        style={{
          boxShadow: "0 1px 2px oklch(0.2 0.01 260 / 0.1)",
          background: "var(--color-surface-hover)",
        }}
      />
    );
  }
  return (
    <span
      className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[10px]"
      style={{
        background: "var(--color-accent-soft)",
        color: "var(--color-accent-500)",
      }}
    >
      <Disc3
        className={"h-7 w-7 " + (playing ? "animate-[spin_9s_linear_infinite]" : "")}
        strokeWidth={1.4}
      />
    </span>
  );
}

function TransportButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Pause;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-(--color-ink-2) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-canvas)",
      }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}
