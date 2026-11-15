import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutoSubmitForm } from "./auto-submit-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const ACTION = "/vi/products";

// delay: null keeps userEvent from waiting on the fake clock; the clock is advanced by hand to test the debounce.
const newUser = () => userEvent.setup({ delay: null });

function setup(auto: boolean) {
  const user = newUser();
  render(
    <AutoSubmitForm action={ACTION} auto={auto}>
      <input type="hidden" name="q" value="giay" />
      <input type="hidden" name="sort" value="" />
      <label>
        <input type="checkbox" name="brand" value="zoomer" /> Zoomer
      </label>
      <label>
        <input type="checkbox" name="brand" value="stride" /> Stride
      </label>
      <label>
        <input type="radio" name="category" value="" defaultChecked /> Tất cả
      </label>
      <input type="number" name="minPrice" aria-label="min" />
      <button type="submit">Áp dụng</button>
    </AutoSubmitForm>,
  );
  return user;
}

beforeEach(() => {
  // Testing Library only recognizes Jest's fake timers, so let this clock also tick in real time;
  // otherwise its internal waits never finish. Time is still moved forward by hand to test the debounce.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  replace.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("AutoSubmitForm with auto on", () => {
  it("applies as soon as an option is ticked, keeps hidden fields, drops empty ones, and does not scroll", async () => {
    const user = setup(true);
    await user.click(screen.getByLabelText("Zoomer"));
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/vi/products?q=giay&brand=zoomer", { scroll: false });
  });

  it("sends several values of the same field", async () => {
    const user = setup(true);
    await user.click(screen.getByLabelText("Zoomer"));
    await user.click(screen.getByLabelText("Stride"));
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(replace).toHaveBeenLastCalledWith("/vi/products?q=giay&brand=zoomer&brand=stride", { scroll: false });
  });

  it("waits until typing pauses for price fields, then applies once", async () => {
    const user = setup(true);
    await user.type(screen.getByLabelText("min"), "2000000");
    expect(replace).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(400)); // still inside the 600 ms pause
    expect(replace).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(400)); // pause is over
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/vi/products?q=giay&minPrice=2000000", { scroll: false });
  });

  it("goes to the plain page when everything is cleared", async () => {
    const user = newUser();
    render(
      <AutoSubmitForm action={ACTION} auto>
        <label>
          <input type="checkbox" name="brand" value="zoomer" defaultChecked /> Zoomer
        </label>
      </AutoSubmitForm>,
    );
    await user.click(screen.getByLabelText("Zoomer"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(replace).toHaveBeenCalledWith(ACTION, { scroll: false });
  });
});

describe("AutoSubmitForm with auto off", () => {
  it("does nothing on change, and applies when the button is pressed (without a full page load)", async () => {
    const user = setup(false);
    await user.click(screen.getByLabelText("Zoomer"));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/vi/products?q=giay&brand=zoomer", { scroll: false });
  });
});

describe("AutoSubmitForm without JavaScript", () => {
  it("is a plain GET form to the page", () => {
    setup(true);
    const form = screen.getByRole("button", { name: "Áp dụng" }).closest("form")!;
    expect(form).toHaveAttribute("action", ACTION);
    expect(form).toHaveAttribute("method", "get");
  });
});
