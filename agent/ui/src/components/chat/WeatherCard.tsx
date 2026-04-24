import { useEffect, useState } from "react";

type Props = {
  entity_id?: string;
  label?: string;
  temp_entity?: string;
  feels_like_entity?: string;
  humidity_entity?: string;
  wind_speed_entity?: string;
  wind_bearing_entity?: string;
  pressure_entity?: string;
  uv_entity?: string;
  show_forecast?: boolean;
};

type WeatherState = {
  state: string; // condition string
  attributes: {
    friendly_name?: string;
    temperature?: number;
    apparent_temperature?: number;
    temperature_unit?: string;
    humidity?: number;
    wind_speed?: number;
    wind_speed_unit?: string;
    wind_bearing?: number;
    pressure?: number;
    pressure_unit?: string;
  };
};

type SensorState = {
  state: string;
  attributes: {
    friendly_name?: string;
    unit_of_measurement?: string;
  };
};

type ForecastItem = {
  datetime?: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
};

const DOW = ["zo", "ma", "di", "wo", "do", "vr", "za"];

export function WeatherCard(props: Props) {
  const {
    entity_id,
    label,
    temp_entity,
    feels_like_entity,
    humidity_entity,
    wind_speed_entity,
    wind_bearing_entity,
    pressure_entity,
    uv_entity,
    show_forecast = true,
  } = props;

  const hasWeatherEntity = !!entity_id && entity_id.startsWith("weather.");

  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [sensors, setSensors] = useState<Record<string, SensorState>>({});

  useEffect(() => {
    let alive = true;
    const sensorEntities = [
      temp_entity,
      feels_like_entity,
      humidity_entity,
      wind_speed_entity,
      wind_bearing_entity,
      pressure_entity,
      uv_entity,
    ].filter((e): e is string => !!e);

    const load = async () => {
      try {
        const jobs: Promise<void>[] = [];

        if (entity_id) {
          jobs.push(
            fetch(`/state/${encodeURIComponent(entity_id)}`).then(async (r) => {
              if (r.ok && alive) setWeather((await r.json()) as WeatherState);
            }),
          );
        }
        if (hasWeatherEntity && show_forecast) {
          jobs.push(
            fetch(`/weather_forecast/${encodeURIComponent(entity_id!)}?type=daily`).then(
              async (r) => {
                if (r.ok && alive) {
                  const body = (await r.json()) as { forecast?: ForecastItem[] };
                  setForecast((body.forecast ?? []).slice(0, 5));
                }
              },
            ),
          );
        }
        for (const eid of sensorEntities) {
          jobs.push(
            fetch(`/state/${encodeURIComponent(eid)}`).then(async (r) => {
              if (r.ok && alive) {
                const body = (await r.json()) as SensorState;
                setSensors((prev) => ({ ...prev, [eid]: body }));
              }
            }),
          );
        }
        await Promise.allSettled(jobs);
      } catch {
        /* ignore */
      }
    };
    void load();
    const t = window.setInterval(load, 120_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [
    entity_id,
    hasWeatherEntity,
    show_forecast,
    temp_entity,
    feels_like_entity,
    humidity_entity,
    wind_speed_entity,
    wind_bearing_entity,
    pressure_entity,
    uv_entity,
  ]);

  // Resolve each value: sensor override first, then weather attribute.
  const tempUnit = weather?.attributes.temperature_unit ?? "°C";
  const temp = numFromSensor(sensors, temp_entity) ?? weather?.attributes.temperature;
  const feels =
    numFromSensor(sensors, feels_like_entity) ?? weather?.attributes.apparent_temperature;
  const humidity = numFromSensor(sensors, humidity_entity) ?? weather?.attributes.humidity;
  const wind = numFromSensor(sensors, wind_speed_entity) ?? weather?.attributes.wind_speed;
  const windUnit =
    sensorUnit(sensors, wind_speed_entity) ?? weather?.attributes.wind_speed_unit ?? "km/h";
  const bearing =
    numFromSensor(sensors, wind_bearing_entity) ?? weather?.attributes.wind_bearing;
  const pressure = numFromSensor(sensors, pressure_entity) ?? weather?.attributes.pressure;
  const pressureUnit =
    sensorUnit(sensors, pressure_entity) ?? weather?.attributes.pressure_unit ?? "hPa";
  const uv = numFromSensor(sensors, uv_entity);

  const cond = hasWeatherEntity ? (weather?.state ?? "") : "";
  const headerLabel =
    label ?? weather?.attributes.friendly_name ?? entity_id ?? "Weer";

  const statsCount =
    (wind !== undefined ? 1 : 0) +
    (humidity !== undefined ? 1 : 0) +
    (pressure !== undefined ? 1 : 0) +
    (uv !== undefined ? 1 : 0);

  return (
    <div
      className="overflow-hidden rounded-[16px] border"
      style={{
        background:
          "linear-gradient(160deg, var(--color-accent-soft) 0%, var(--color-canvas) 55%)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <div
            className="text-[11px] uppercase tracking-[0.16em] text-(--color-ink-3)"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {headerLabel}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="text-[44px] leading-none text-(--color-ink-1)"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
              }}
            >
              {temp === undefined ? "—" : Math.round(temp)}
              <span className="text-[18px] align-top text-(--color-ink-3)">{tempUnit}</span>
            </span>
            {cond && (
              <span className="pb-1 text-[14px] capitalize text-(--color-ink-2)">
                {prettyCondition(cond)}
              </span>
            )}
          </div>
          {feels !== undefined && (
            <div className="mt-1 text-[12px] text-(--color-ink-3)">
              voelt als {Math.round(feels)}
              {tempUnit}
            </div>
          )}
        </div>
        {hasWeatherEntity ? (
          <MeteoIcon condition={cond} className="h-20 w-20 shrink-0" />
        ) : (
          <LocalGlyph />
        )}
      </div>

      {statsCount > 0 && (
        <div
          className="grid gap-0 border-t text-[12px]"
          style={{
            borderColor: "var(--color-border)",
            gridTemplateColumns: `repeat(${statsCount}, minmax(0, 1fr))`,
          }}
        >
          {wind !== undefined && (
            <Stat
              label="wind"
              value={`${Math.round(wind)} ${windUnit}`}
              hint={bearing === undefined ? undefined : degToCompass(bearing)}
            />
          )}
          {humidity !== undefined && (
            <Stat label="vocht" value={`${Math.round(humidity)}%`} />
          )}
          {pressure !== undefined && (
            <Stat label="druk" value={`${Math.round(pressure)} ${pressureUnit}`} />
          )}
          {uv !== undefined && <UvStat value={uv} />}
        </div>
      )}

      {hasWeatherEntity && show_forecast && forecast.length > 0 && (
        <div
          className="grid gap-0 border-t"
          style={{
            borderColor: "var(--color-border)",
            gridTemplateColumns: `repeat(${forecast.length}, minmax(0, 1fr))`,
          }}
        >
          {forecast.map((f, i) => (
            <ForecastCell key={i} item={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function numFromSensor(
  sensors: Record<string, SensorState>,
  entity_id: string | undefined,
): number | undefined {
  if (!entity_id) return undefined;
  const s = sensors[entity_id];
  if (!s) return undefined;
  const n = Number(s.state);
  return Number.isFinite(n) ? n : undefined;
}

function sensorUnit(
  sensors: Record<string, SensorState>,
  entity_id: string | undefined,
): string | undefined {
  if (!entity_id) return undefined;
  return sensors[entity_id]?.attributes.unit_of_measurement;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 border-r px-3 py-2 last:border-r-0"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-(--color-ink-3)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1 text-[13px] text-(--color-ink-1)">
        <span style={{ fontWeight: 500 }}>{value}</span>
        {hint && <span className="text-[11px] text-(--color-ink-3)">{hint}</span>}
      </div>
    </div>
  );
}

function UvStat({ value }: { value: number }) {
  const band = uvBand(value);
  return (
    <div
      className="flex flex-col gap-0.5 border-r px-3 py-2 last:border-r-0"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-(--color-ink-3)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        uv-index
      </div>
      <div className="flex items-center gap-1.5 text-[13px] text-(--color-ink-1)">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: band.color }}
        />
        <span style={{ fontWeight: 500 }}>{value.toFixed(value < 10 ? 1 : 0)}</span>
        <span className="text-[11px] text-(--color-ink-3)">{band.label}</span>
      </div>
    </div>
  );
}

function uvBand(n: number): { label: string; color: string } {
  if (n < 3) return { label: "laag", color: "oklch(0.72 0.15 145)" };
  if (n < 6) return { label: "matig", color: "oklch(0.80 0.15 90)" };
  if (n < 8) return { label: "hoog", color: "oklch(0.72 0.17 55)" };
  if (n < 11) return { label: "zeer hoog", color: "oklch(0.62 0.22 25)" };
  return { label: "extreem", color: "oklch(0.55 0.22 315)" };
}

function LocalGlyph() {
  // Small abstract "measurement" icon — three dashes of decreasing length
  // suggest live gauge/sensor readings without duplicating the weather icon.
  return (
    <span
      className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px]"
      style={{
        background: "var(--color-canvas)",
        boxShadow: "0 1px 2px oklch(0.2 0.01 260 / 0.06)",
      }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 text-(--color-accent-500)">
        <line x1="6" y1="10" x2="26" y2="10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="6" y1="16" x2="22" y2="16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
        <line x1="6" y1="22" x2="18" y2="22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
      </svg>
    </span>
  );
}

function ForecastCell({ item }: { item: ForecastItem }) {
  const d = item.datetime ? new Date(item.datetime) : null;
  const dow = d ? DOW[d.getDay()] : "—";
  return (
    <div
      className="flex flex-col items-center gap-1 border-r px-2 py-2.5 text-[11px] text-(--color-ink-2) last:border-r-0"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span
        className="uppercase tracking-[0.1em] text-(--color-ink-3)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {dow}
      </span>
      <MeteoIcon condition={item.condition ?? ""} className="h-8 w-8" />
      <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
        {item.temperature === undefined ? "—" : Math.round(item.temperature)}°
        {item.templow !== undefined && (
          <span className="text-(--color-ink-3)"> / {Math.round(item.templow)}°</span>
        )}
      </span>
    </div>
  );
}

function MeteoIcon({ condition, className }: { condition: string; className: string }) {
  const name = meteoName(condition);
  return (
    <img
      src={`/weather-icons/${name}.svg`}
      alt={condition}
      className={className}
      draggable={false}
      style={{
        // Drop-shadow on the shape (not the bounding box) so the pastel
        // Meteocons sit cleanly on the light card gradient.
        filter:
          "drop-shadow(0 2px 3px oklch(0.2 0.02 260 / 0.22)) drop-shadow(0 1px 1px oklch(0.2 0.02 260 / 0.12))",
      }}
    />
  );
}

function meteoName(condition: string): string {
  switch (condition) {
    case "sunny":
      return "clear-day";
    case "clear-night":
      return "clear-night";
    case "partlycloudy":
      return "partly-cloudy-day";
    case "cloudy":
      return "cloudy";
    case "rainy":
      return "rain";
    case "pouring":
      return "extreme-rain";
    case "snowy":
      return "snow";
    case "snowy-rainy":
      return "sleet";
    case "lightning":
      return "thunderstorms";
    case "lightning-rainy":
      return "thunderstorms-rain";
    case "fog":
      return "fog";
    case "windy":
    case "windy-variant":
      return "wind";
    case "hail":
      return "hail";
    case "exceptional":
      return "overcast";
    default:
      return "not-available";
  }
}

function prettyCondition(c: string): string {
  return (
    {
      sunny: "zonnig",
      "clear-night": "heldere nacht",
      partlycloudy: "half bewolkt",
      cloudy: "bewolkt",
      rainy: "regen",
      pouring: "hevige regen",
      snowy: "sneeuw",
      "snowy-rainy": "natte sneeuw",
      lightning: "onweer",
      "lightning-rainy": "onweer met regen",
      fog: "mist",
      windy: "winderig",
      "windy-variant": "winderig",
      hail: "hagel",
      exceptional: "bijzonder",
    }[c] ?? c
  );
}

function degToCompass(deg: number): string {
  const dirs = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
