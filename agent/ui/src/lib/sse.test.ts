import { describe, it, expect } from "vitest";
import { parseSSEStream } from "./sse";

describe("parseSSEStream", () => {
  it("yields parsed events from chunked SSE body (CRLF and LF mixed)", async () => {
    // Real servers (sse_starlette, Python) emit CRLF frame terminators.
    // Mix both to cover the normalization path.
    const chunks = [
      'data: {"type":"tool_start","tool":"x","args":{}}\r\n\r\n',
      'data: {"type":"text_delta","delta":"Hoi"}\r\n\r\ndata: {"type":"final","full_text":"Hoi"}\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        const enc = new TextEncoder();
        for (const c of chunks) ctrl.enqueue(enc.encode(c));
        ctrl.close();
      },
    });
    const out: unknown[] = [];
    for await (const evt of parseSSEStream(stream)) out.push(evt);
    expect(out).toHaveLength(3);
    expect((out[2] as { type: string }).type).toBe("final");
  });
});
