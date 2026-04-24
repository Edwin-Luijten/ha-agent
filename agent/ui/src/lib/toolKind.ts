import { Eye, LayoutPanelLeft, Play, Search, type LucideIcon } from "lucide-react";

export type ToolKind = "search" | "read" | "mutate" | "ui";

export type ToolVisual = {
  kind: ToolKind;
  icon: LucideIcon;
  bg: string;
  ink: string;
};

export function classifyTool(name: string): ToolVisual {
  if (name === "render_ui") {
    return {
      kind: "ui",
      icon: LayoutPanelLeft,
      bg: "var(--color-kind-ui-bg)",
      ink: "var(--color-kind-ui)",
    };
  }
  if (name === "call_service") {
    return {
      kind: "mutate",
      icon: Play,
      bg: "var(--color-kind-mutate-bg)",
      ink: "var(--color-kind-mutate)",
    };
  }
  if (name.includes("search_entities") || name === "list_services") {
    return {
      kind: "search",
      icon: Search,
      bg: "var(--color-kind-search-bg)",
      ink: "var(--color-kind-search)",
    };
  }
  return {
    kind: "read",
    icon: Eye,
    bg: "var(--color-kind-read-bg)",
    ink: "var(--color-kind-read)",
  };
}
