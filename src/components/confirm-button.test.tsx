import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmButton } from "./confirm-button";

function setup() {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <ConfirmButton label="Xóa" confirmLabel="Xóa?" />
    </form>,
  );
  return onSubmit;
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("ConfirmButton", () => {
  it("does not submit on the first click, asks to confirm, and submits on the second", async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = setup();

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Xóa?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa?" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("goes back to the first state after a few seconds", async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = setup();
    await user.click(screen.getByRole("button", { name: "Xóa" }));

    await act(() => vi.advanceTimersByTimeAsync(4500));
    expect(screen.getByRole("button", { name: "Xóa" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xóa" }));
    expect(onSubmit).not.toHaveBeenCalled(); // that was a first click again
  });

  it("goes back when focus leaves the button", async () => {
    const user = userEvent.setup({ delay: null });
    setup();
    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Xóa" })).toBeInTheDocument();
  });
});
