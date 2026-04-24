import type { UIComponent } from "../../lib/types";
import { EntityCard } from "./EntityCard";
import { LightControl } from "./LightControl";
import { MediaPlayer } from "./MediaPlayer";
import { CameraSnapshot } from "./CameraSnapshot";
import { Confirmation } from "./Confirmation";
import { Plan } from "./Plan";
import { QuickActions } from "./QuickActions";
import { WeatherCard } from "./WeatherCard";

export function renderComponent(c: UIComponent, i: number) {
  const props = c.props;
  switch (c.kind) {
    case "entity_card":
      return <EntityCard key={i} {...(props as { entity_id: string })} />;
    case "light_control":
      return <LightControl key={i} {...(props as { entity_id?: string; area?: string })} />;
    case "media_player":
      return <MediaPlayer key={i} {...(props as { entity_id: string })} />;
    case "camera_snapshot":
      return <CameraSnapshot key={i} {...(props as { entity_id: string; refresh_sec?: number })} />;
    case "confirmation":
      return <Confirmation key={i} {...(props as { prompt: string; action_id: string })} />;
    case "quick_actions":
      return <QuickActions key={i} {...(props as { chips: { label: string; message: string }[] })} />;
    case "weather_card":
      return <WeatherCard key={i} {...(props as { entity_id: string })} />;
    case "plan":
      return (
        <Plan
          key={i}
          {...(props as {
            steps: (string | { label: string; detail?: string })[];
            action_id: string;
            title?: string;
          })}
        />
      );
  }
}
