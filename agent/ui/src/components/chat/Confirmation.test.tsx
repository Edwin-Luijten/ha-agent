import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Confirmation } from "./Confirmation";

describe("Confirmation", () => {
  it("dispatches followup on JA", () => {
    const listener = vi.fn();
    window.addEventListener("ha-agent:followup", (e) => listener((e as CustomEvent).detail));
    const { getByText } = render(<Confirmation prompt="zal ik?" action_id="x" />);
    fireEvent.click(getByText("JA"));
    expect(listener).toHaveBeenCalledWith("ja (action x)");
  });
});
