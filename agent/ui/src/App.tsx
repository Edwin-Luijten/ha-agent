import { useMemo, useState } from "react";
import { ActivityView } from "./components/ActivityView";
import { ChatView } from "./components/ChatView";
import { Header } from "./components/Header";
import { MemoryView } from "./components/MemoryView";
import { SessionDrawer } from "./components/SessionDrawer";
import { useChat } from "./hooks/useChat";
import type { TokenUsage } from "./lib/types";

type Tab = "chat" | "activity" | "memory";

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const chat = useChat();
  const sessionTokens = useMemo(() => sumTokens(chat.messages), [chat.messages]);

  return (
    <div className="flex h-full flex-col">
      <Header
        sending={chat.sending}
        sessionTokens={sessionTokens}
        onNewConversation={chat.reset}
        hasMessages={chat.messages.length > 0}
        onOpenHistory={() => setDrawerOpen(true)}
      />
      <nav
        className="flex gap-4 border-b px-5"
        style={{ borderColor: "var(--color-border)" }}
      >
        <TabButton label="Chat" active={tab === "chat"} onClick={() => setTab("chat")} />
        <TabButton label="Activity" active={tab === "activity"} onClick={() => setTab("activity")} />
        <TabButton label="Memory" active={tab === "memory"} onClick={() => setTab("memory")} />
      </nav>
      <main className="min-h-0 flex-1">
        {tab === "chat" ? (
          <ChatView chat={chat} />
        ) : tab === "activity" ? (
          <ActivityView />
        ) : (
          <MemoryView />
        )}
      </main>
      <SessionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelect={(sid) => {
          void chat.loadSession(sid);
          setTab("chat");
        }}
        currentId={chat.conversationId}
      />
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "relative py-2.5 text-[13px] transition-colors " +
        (active ? "text-(--color-ink-1)" : "text-(--color-ink-3) hover:text-(--color-ink-2)")
      }
    >
      {label}
      {active && (
        <span
          className="absolute inset-x-0 -bottom-px h-[2px] rounded-full"
          style={{ background: "var(--color-ink-1)" }}
          aria-hidden
        />
      )}
    </button>
  );
}

function sumTokens(
  messages: { tokens?: TokenUsage }[],
): TokenUsage | null {
  let has = false;
  const total: TokenUsage = {
    prompt: 0,
    completion: 0,
    thoughts: 0,
    cached: 0,
    total: 0,
    llm_calls: 0,
  };
  for (const m of messages) {
    if (!m.tokens) continue;
    has = true;
    total.prompt += m.tokens.prompt;
    total.completion += m.tokens.completion;
    total.thoughts += m.tokens.thoughts;
    total.cached += m.tokens.cached;
    total.total += m.tokens.total;
    total.llm_calls += m.tokens.llm_calls;
  }
  return has ? total : null;
}
