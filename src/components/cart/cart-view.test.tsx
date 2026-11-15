import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCartLines } from "@/app/[lang]/cart/actions";
import vi_ from "@/i18n/dictionaries/vi.json";
import { useCartStore } from "@/lib/cart/store";
import type { CartLineData } from "@/lib/catalog/cart-lines";
import { CartView } from "./cart-view";

vi.mock("next/image", () => import("@/test/next-image-mock"));
vi.mock("@/app/[lang]/cart/actions", () => ({ loadCartLines: vi.fn() }));

const labels = vi_.cart;
const load = vi.mocked(loadCartLines);

const line = (id: string, extra: Partial<CartLineData> = {}): CartLineData => ({
  variantId: id,
  productSlug: `product-${id}`,
  nameVi: `Sản phẩm ${id}`,
  nameEn: null,
  brandName: "Zoomer",
  colorNameVi: null,
  colorNameEn: null,
  sizeLabel: null,
  sku: `SKU-${id}`,
  unitPrice: 1_000_000,
  stock: 10,
  available: true,
  image: null,
  ...extra,
});

const shoe = line("v1", { nameVi: "Giày Runner", colorNameVi: "Đen", sizeLabel: "42", unitPrice: 2_000_000, stock: 8 });
const watch = line("v2", { nameVi: "Đồng hồ Digi", unitPrice: 590_000, stock: 3 });

async function setCart(items: { variantId: string; quantity: number }[]) {
  useCartStore.setState({ items });
  await useCartStore.persist.rehydrate(); // the saved cart is loaded, as CartHydrator does in the app
}
const renderCart = () => render(<CartView locale="vi" labels={labels} />);
const cart = () => useCartStore.getState().items;
const money = (n: string) => screen.getAllByText(new RegExp(n.replace(/\./g, "\\.")));

beforeEach(async () => {
  localStorage.clear();
  load.mockReset();
  await setCart([]);
});

describe("loading and empty states", () => {
  it("shows a loading state first, then the lines with the shop's current data", async () => {
    let resolve!: (lines: CartLineData[]) => void;
    load.mockReturnValue(new Promise((r) => (resolve = r)));
    await setCart([{ variantId: "v1", quantity: 1 }]);
    renderCart();

    expect(screen.getByRole("status")).toHaveTextContent(labels.loading);
    expect(screen.queryByText(labels.empty.title)).not.toBeInTheDocument();

    resolve([shoe]);
    expect(await screen.findByText("Giày Runner")).toBeInTheDocument();
    expect(screen.getByText("Đen · 42")).toBeInTheDocument();
    expect(money("2.000.000").length).toBeGreaterThan(0);
  });

  it("shows the empty state without asking the server", async () => {
    renderCart();
    expect(await screen.findByText(labels.empty.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: labels.empty.cta })).toHaveAttribute("href", "/vi/products");
    expect(load).not.toHaveBeenCalled();
  });

  it("offers a retry when loading fails", async () => {
    const user = userEvent.setup();
    load.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([shoe]);
    await setCart([{ variantId: "v1", quantity: 1 }]);
    renderCart();

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.loadError);
    await user.click(screen.getByRole("button", { name: labels.retry }));
    expect(await screen.findByText("Giày Runner")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("totals and quantities", () => {
  beforeEach(async () => {
    load.mockResolvedValue([shoe, watch]);
    await setCart([
      { variantId: "v1", quantity: 2 },
      { variantId: "v2", quantity: 1 },
    ]);
  });

  it("asks for the ids once, sorted, and sums the lines using server prices", async () => {
    renderCart();
    await screen.findByText("Giày Runner");

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(["v1", "v2"]);
    // 2 x 2.000.000 + 590.000, shown as subtotal and total
    expect(money("4.590.000")).toHaveLength(2);
    expect(screen.getByText("3 sản phẩm")).toBeInTheDocument();
    expect(screen.getByText(labels.summary.shippingNote)).toBeInTheDocument();
  });

  it("changes quantity and totals when the buttons are used, without asking the server again", async () => {
    const user = userEvent.setup();
    renderCart();
    await screen.findByText("Giày Runner");

    await user.click(screen.getByRole("button", { name: "Tăng số lượng của Giày Runner" }));
    expect(cart().find((i) => i.variantId === "v1")?.quantity).toBe(3);
    expect(money("6.590.000")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Giảm số lượng của Giày Runner" }));
    await user.click(screen.getByRole("button", { name: "Giảm số lượng của Giày Runner" }));
    expect(cart().find((i) => i.variantId === "v1")?.quantity).toBe(1);
    expect(screen.getByRole("button", { name: "Giảm số lượng của Giày Runner" })).toBeDisabled(); // 1 is the minimum
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("stops increasing at the available stock", async () => {
    const user = userEvent.setup();
    await setCart([{ variantId: "v2", quantity: 2 }]);
    renderCart();
    await screen.findByText("Đồng hồ Digi");

    const plus = screen.getByRole("button", { name: "Tăng số lượng của Đồng hồ Digi" });
    await user.click(plus); // 3 = stock
    expect(plus).toBeDisabled();
    expect(plus).toHaveAttribute("title", labels.line.maxReached);
    expect(cart()[0].quantity).toBe(3);
    expect(screen.getByText("Chỉ còn 3 sản phẩm")).toBeInTheDocument();
  });

  it("removes a line, and shows the empty state after the last one", async () => {
    const user = userEvent.setup();
    renderCart();
    await screen.findByText("Giày Runner");

    await user.click(screen.getByRole("button", { name: "Xóa Giày Runner khỏi giỏ hàng" }));
    expect(screen.queryByText("Giày Runner")).not.toBeInTheDocument();
    expect(money("590.000")).toHaveLength(4); // the watch's unit price and line total, then subtotal and total
    expect(cart().map((i) => i.variantId)).toEqual(["v2"]);

    await user.click(screen.getByRole("button", { name: "Xóa Đồng hồ Digi khỏi giỏ hàng" }));
    expect(await screen.findByText(labels.empty.title)).toBeInTheDocument();
    expect(cart()).toEqual([]);
  });

  it("links to the checkout when everything can be ordered", async () => {
    renderCart();
    await screen.findByText("Giày Runner");
    expect(screen.getByRole("link", { name: labels.summary.checkout })).toHaveAttribute("href", "/vi/checkout");
  });
});

describe("items that cannot be ordered", () => {
  it("flags them, leaves them out of the total and blocks checkout until they are removed", async () => {
    const user = userEvent.setup();
    const hidden = line("v3", { nameVi: "Đã ngừng bán", available: false });
    const soldOut = line("v4", { nameVi: "Hết sạch", stock: 0 });
    load.mockResolvedValue([shoe, hidden, soldOut]);
    await setCart([
      { variantId: "v1", quantity: 1 },
      { variantId: "v3", quantity: 1 },
      { variantId: "v4", quantity: 4 },
    ]);
    renderCart();
    await screen.findByText("Giày Runner");

    expect(screen.getAllByText(labels.unavailable.title)).toHaveLength(2);
    // Only the shoe counts: its unit price and line total, plus subtotal and total. The others add nothing.
    expect(money("2.000.000")).toHaveLength(4);
    expect(screen.getByRole("button", { name: labels.summary.checkout })).toBeDisabled();
    expect(screen.queryByRole("link", { name: labels.summary.checkout })).not.toBeInTheDocument();
    expect(screen.getByText(labels.summary.blocked)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa Đã ngừng bán khỏi giỏ hàng" }));
    await user.click(screen.getByRole("button", { name: "Xóa Hết sạch khỏi giỏ hàng" }));
    expect(screen.getByRole("link", { name: labels.summary.checkout })).toHaveAttribute("href", "/vi/checkout");
  });

  it("shows a variant that no longer exists as removable", async () => {
    const user = userEvent.setup();
    load.mockResolvedValue([shoe]); // "gone" is not returned
    await setCart([
      { variantId: "v1", quantity: 1 },
      { variantId: "gone", quantity: 1 },
    ]);
    renderCart();
    await screen.findByText("Giày Runner");

    expect(screen.getByText(labels.unavailable.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.summary.checkout })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: labels.line.removeUnavailable }));
    expect(cart().map((i) => i.variantId)).toEqual(["v1"]);
  });
});

describe("stock changes since the item was added", () => {
  it("lowers a quantity above the stock, tells the shopper, and keeps the cart consistent", async () => {
    load.mockResolvedValue([watch]); // stock 3
    await setCart([{ variantId: "v2", quantity: 5 }]);
    renderCart();

    expect(await screen.findByText("Số lượng đã được giảm còn 3 theo tồn kho.")).toBeInTheDocument();
    expect(cart()).toEqual([{ variantId: "v2", quantity: 3 }]);
    expect(within(screen.getByRole("group", { name: "Số lượng của Đồng hồ Digi" })).getByRole("status")).toHaveTextContent("3");
    expect(money("1.770.000")).toHaveLength(3); // 3 x 590.000: line total, subtotal, total
  });

  it("uses the new price, not anything remembered from when the item was added", async () => {
    load.mockResolvedValue([{ ...watch, unitPrice: 700_000 }]);
    await setCart([{ variantId: "v2", quantity: 1 }]);
    renderCart();
    await waitFor(() => expect(money("700.000").length).toBeGreaterThan(0));
    expect(screen.queryByText(/590\.000/)).not.toBeInTheDocument();
  });
});
