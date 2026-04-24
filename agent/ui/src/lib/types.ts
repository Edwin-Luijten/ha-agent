export type ComponentKind =
  | "entity_card"
  | "light_control"
  | "media_player"
  | "camera_snapshot"
  | "confirmation"
  | "quick_actions"
  | "weather_card"
  | "plan";

export type UIComponent = {
  kind: ComponentKind;
  props: Record<string, unknown>;
};

export type TokenUsage = {
  prompt: number;
  completion: number;
  thoughts: number;
  cached: number;
  total: number;
  llm_calls: number;
};

export type TraceEntry = {
  ts: string;
  session_id: string;
  user_message: string;
  tool_calls: { name: string; args: Record<string, unknown> }[];
  response_text: string;
  total_latency_ms: number;
  tokens?: TokenUsage;
};

export type SessionSummary = {
  session_id: string;
  first_message: string;
  first_ts: string | null;
  last_ts: string | null;
  turn_count: number;
  total_tokens: number;
};

export type SSEEvent =
  | { type: "tool_start"; tool: string; args: Record<string, unknown> }
  | { type: "tool_end"; tool: string; result_summary: string }
  | { type: "component"; component: UIComponent }
  | { type: "text_delta"; delta: string }
  | ({ type: "tokens_delta" } & TokenUsage)
  | {
      type: "final";
      full_text: string;
      components?: UIComponent[];
      error?: string | null;
      tokens?: TokenUsage;
    };
