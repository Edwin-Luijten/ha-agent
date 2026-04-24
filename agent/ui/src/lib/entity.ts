import {
  AirVent,
  Bell,
  Calendar,
  Camera,
  Clapperboard,
  Clock,
  CloudSun,
  Database,
  DoorOpen,
  Flame,
  Gauge,
  Home,
  Lightbulb,
  Lock,
  MapPin,
  Power,
  Radio,
  ShieldCheck,
  Smartphone,
  Speaker,
  Square,
  Sun,
  Thermometer,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";

export type EntityParts = {
  domain: string;
  objectId: string;
  displayName: string;
};

export function parseEntity(entityId: string): EntityParts {
  const [domain, ...rest] = entityId.split(".");
  const objectId = rest.join(".");
  const displayName = objectId
    .split("_")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
  return { domain, objectId, displayName: displayName || entityId };
}

export function iconForDomain(domain: string): LucideIcon {
  switch (domain) {
    case "light":
      return Lightbulb;
    case "switch":
      return ToggleLeft;
    case "sensor":
      return Gauge;
    case "binary_sensor":
      return Bell;
    case "media_player":
      return Speaker;
    case "camera":
      return Camera;
    case "lock":
      return Lock;
    case "cover":
      return Square;
    case "climate":
      return Thermometer;
    case "fan":
      return AirVent;
    case "alarm_control_panel":
      return ShieldCheck;
    case "device_tracker":
    case "person":
      return MapPin;
    case "sun":
      return Sun;
    case "weather":
      return CloudSun;
    case "calendar":
      return Calendar;
    case "zone":
      return Home;
    case "input_boolean":
    case "input_button":
      return Power;
    case "scene":
      return Flame;
    case "automation":
    case "script":
      return Clapperboard;
    case "timer":
      return Clock;
    case "update":
      return Database;
    case "remote":
      return Radio;
    case "mobile_app":
    case "notify":
      return Smartphone;
    default:
      return DoorOpen;
  }
}
