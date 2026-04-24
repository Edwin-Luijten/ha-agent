import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  OctagonX,
  RefreshCw,
  Timer,
} from "lucide-react";
import Markdown from "react-markdown";
import type { ChatMessage } from "../hooks/useChat";
import type { TokenUsage } from "../lib/types";
import { TokenBadge } from "./TokenBadge";
import { ToolBadge } from "./ToolBadge";
import { renderComponent } from "./chat";

type Props = {
  msg: ChatMessage;
  thinking?: boolean;
  isLastAgent?: boolean;
  onRegenerate?: () => void;
};

export function Message({ msg, thinking, isLastAgent, onRegenerate }: Props) {
  const isUser = msg.role === "user";
  return (
    <div className={"msg-in flex " + (isUser ? "justify-end" : "justify-start")}>
      {isUser ? (
        <UserBubble text={msg.text} createdAt={msg.createdAt} />
      ) : (
        <AgentBlock
          msg={msg}
          thinking={!!thinking}
          isLastAgent={!!isLastAgent}
          onRegenerate={onRegenerate}
        />
      )}
    </div>
  );
}

function UserBubble({ text, createdAt }: { text: string; createdAt?: number }) {
  return (
    <div className="flex max-w-[62ch] flex-col items-end">
      <div
        className="rounded-[16px] px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap"
        style={{
          background: "var(--color-surface-raised)",
          color: "var(--color-ink-1)",
          fontWeight: 400,
          border: "1px solid var(--color-border)",
        }}
      >
        {text}
      </div>
      {createdAt && <Timestamp ts={createdAt} className="mr-1 mt-1" />}
    </div>
  );
}

function AgentBlock({
  msg,
  thinking,
  isLastAgent,
  onRegenerate,
}: {
  msg: ChatMessage;
  thinking: boolean;
  isLastAgent: boolean;
  onRegenerate?: () => void;
}) {
  const showCaret = thinking && msg.text.length > 0;
  const canCopy = !thinking && msg.text.length > 0;
  const quota = isQuotaError(msg.error);
  return (
    <div className="group/msg flex min-w-0 max-w-[68ch] flex-1 gap-3">
      <AgentMark />
      <div className="min-w-0 flex-1">
        {(msg.tools.length > 0 || msg.tokens || msg.durationMs) && (
          <ToolPillRow tools={msg.tools} tokens={msg.tokens} durationMs={msg.durationMs} />
        )}
        {thinking && msg.text.length === 0 && msg.components.length === 0 && <TypingDots />}
        {msg.text && (
          <div
            className={"prose text-[15px] leading-[1.6] " + (showCaret ? "caret" : "")}
            style={{ color: "var(--color-ink-1)" }}
            aria-live="polite"
            aria-atomic="false"
          >
            <Markdown
              components={{
                p: ({ children }) => <p>{children}</p>,
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--color-accent-500)", textDecoration: "underline" }}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {msg.text}
            </Markdown>
          </div>
        )}
        {msg.components.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {msg.components.map((c, i) => renderComponent(c, i))}
          </div>
        )}
        {(quota || (msg.error && !msg.stopped)) && (
          <ErrorNotice error={msg.error} quota={quota} />
        )}
        {msg.stopped && (
          <div
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-(--color-ink-3)"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <OctagonX className="h-3 w-3" strokeWidth={2} />
            gestopt
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
          {canCopy && <CopyButton text={msg.text} />}
          {isLastAgent && onRegenerate && <RegenerateButton onClick={onRegenerate} />}
          {msg.createdAt && <Timestamp ts={msg.createdAt} />}
        </div>
      </div>
    </div>
  );
}

function RegenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Antwoord opnieuw genereren"
      title="Opnieuw"
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] text-(--color-ink-3) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-canvas)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <RefreshCw className="h-3 w-3" strokeWidth={2} />
      opnieuw
    </button>
  );
}

function Timestamp({ ts, className }: { ts: number; className?: string }) {
  const d = new Date(ts);
  const str = d.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return (
    <span
      className={"text-[10px] text-(--color-ink-3) " + (className ?? "")}
      style={{ fontFamily: "var(--font-mono)" }}
      title={d.toLocaleString("nl-NL")}
    >
      {str}
    </span>
  );
}

function isQuotaError(error: string | null | undefined): boolean {
  if (!error) return false;
  return /resource.*exhausted|429|quota/i.test(error);
}

function ErrorNotice({ error, quota }: { error: string | null | undefined; quota: boolean }) {
  return (
    <div
      className="mt-3 flex items-start gap-2 rounded-[12px] border px-3 py-2 text-[12.5px]"
      style={{
        background: "var(--color-status-warn-bg)",
        borderColor: "color-mix(in oklch, var(--color-status-warn) 40%, var(--color-border))",
        color: "var(--color-ink-1)",
      }}
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 shrink-0"
        strokeWidth={2}
        style={{ color: "var(--color-status-warn)" }}
      />
      <div>
        <div style={{ fontWeight: 500 }}>
          {quota ? "Gemini-quota bereikt" : "Iets ging mis bij de agent"}
        </div>
        <div className="mt-0.5 text-(--color-ink-2)">
          {quota
            ? "De gratis tier is uitgeput. Probeer over een minuut opnieuw, of gebruik een betaalde Gemini-key."
            : `Oorzaak: ${error ?? "onbekend"}. Probeer het opnieuw of formuleer de vraag anders.`}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard API unavailable */
    }
  };
  return (
    <button
      onClick={copy}
      aria-label="Kopieer antwoord"
      title="Kopieer"
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] text-(--color-ink-3) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-canvas)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" strokeWidth={2} />
          gekopieerd
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" strokeWidth={2} />
          kopieer
        </>
      )}
    </button>
  );
}

const TOOL_COLLAPSE_THRESHOLD = 3;

function ToolPillRow({
  tools,
  tokens,
  durationMs,
}: {
  tools: ChatMessage["tools"];
  tokens?: TokenUsage;
  durationMs?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const tokenBadge = tokens && tokens.total > 0 ? <TokenBadge tokens={tokens} /> : null;
  const latencyBadge = durationMs && durationMs > 0 ? <LatencyBadge ms={durationMs} /> : null;
  const shouldCollapse = tools.length > TOOL_COLLAPSE_THRESHOLD && !expanded;

  if (shouldCollapse) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ToolBadge name={tools[0].name} ended={tools[0].ended} args={tools[0].args} />
        <button
          onClick={() => setExpanded(true)}
          aria-label={`${tools.length - 1} more tools`}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] text-(--color-ink-3) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
          style={{
            fontFamily: "var(--font-mono)",
            borderColor: "var(--color-border)",
            background: "var(--color-canvas)",
          }}
        >
          +{tools.length - 1}
          <ChevronDown className="h-3 w-3" strokeWidth={2} />
        </button>
        {tokenBadge}
        {latencyBadge}
      </div>
    );
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {tools.map((t, i) => (
        <ToolBadge key={i} name={t.name} ended={t.ended} args={t.args} />
      ))}
      {tools.length > TOOL_COLLAPSE_THRESHOLD && (
        <button
          onClick={() => setExpanded(false)}
          aria-label="collapse"
          className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border text-(--color-ink-3) transition hover:border-(--color-border-strong) hover:text-(--color-ink-1)"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-canvas)",
          }}
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2} />
        </button>
      )}
      {tokenBadge}
      {latencyBadge}
    </div>
  );
}

function LatencyBadge({ ms }: { ms: number }) {
  const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] text-(--color-ink-3)"
      style={{
        fontFamily: "var(--font-mono)",
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
      title="Turn latency"
    >
      <Timer className="h-3 w-3" strokeWidth={2} />
      {label}
    </span>
  );
}

function AgentMark() {
  return (
    <span className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center" aria-hidden>
      <svg viewBox="0 0 20 20" className="h-full w-full">
        <rect
          x="2.5"
          y="2.5"
          width="15"
          height="15"
          rx="3.5"
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth="1.4"
          transform="rotate(18 10 10)"
        />
        <rect x="6.5" y="6.5" width="7" height="7" rx="1.5" fill="var(--color-accent-500)" />
      </svg>
    </span>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot inline-block h-1.5 w-1.5 rounded-full"
          style={{
            background: "var(--color-ink-3)",
            animationDelay: `${i * 140}ms`,
          }}
        />
      ))}
    </div>
  );
}
