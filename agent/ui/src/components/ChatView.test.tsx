import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act, screen, fireEvent } from "@testing-library/react";
import { ChatView } from "./ChatView";
import { useChat } from "../hooks/useChat";

// Reproduction of the real SSE trace: tool_start -> tool_end -> text_delta -> final.
// Asserts the reply text lands in the DOM (guards against the CRLF framing bug).

type RawEvt = { data: string };

function makeStream(events: RawEvt[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= events.length) {
        controller.close();
        return;
      }
      // CRLF to match what real servers emit (sse_starlette).
      controller.enqueue(enc.encode(`data: ${events[i].data}\r\n\r\n`));
      i += 1;
    },
  });
}

function Host() {
  const chat = useChat();
  return <ChatView chat={chat} />;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-0000-0000-000000000000");
});

describe("ChatView", () => {
  it("renders the agent's final text after streaming tool + text events", async () => {
    const stream = makeStream([
      { data: JSON.stringify({ type: "tool_start", tool: "semantic_search_entities", args: { query: "lampen" } }) },
      { data: JSON.stringify({ type: "tool_end", tool: "semantic_search_entities", result_summary: "ok" }) },
      { data: JSON.stringify({ type: "text_delta", delta: "Drie lampen in huis zijn …" }) },
      { data: JSON.stringify({ type: "final", full_text: "Drie lampen in huis zijn …", components: [] }) },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body: stream, status: 200 });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { container } = render(<Host />);
    const input = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(input).toBeTruthy();

    await act(async () => {
      fireEvent.change(input, { target: { value: "noem drie lampen in huis" } });
      fireEvent.submit(input.form!);
      for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByText("noem drie lampen in huis")).toBeTruthy();
    expect(screen.getByText(/^Drie lampen in huis zijn/)).toBeTruthy();
    expect(screen.getByText("semantic_search_entities")).toBeTruthy();
  });
});
