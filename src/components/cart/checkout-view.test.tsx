import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCartLines } from "@/app/[lang]/cart/actions";
import { loadCheckoutDefaults, submitOrderAction } from "@/app/[lang]/checkout/actions";
import vi_ from "@/i18n/dictionaries/vi.json";
import { useCartStore } from "@/lib/cart/store";
import type { CartLineData } from "@/lib/catalog/cart-lines";
import type { CheckoutState } from "@/lib/orders/checkout-state";
import { CheckoutView } from "./checkout-view";

vi.mock("next/image", () => import("@/test/next-image-mock"));
vi.mock("@/app/[lang]/cart/actions", () => ({ loadCartLines: vi.fn() }));
vi.mock("@/app/[lang]/checkout/actions", () => ({ submitOrderAction: vi.fn(), loadCheckoutDefaults: vi.fn() }));

const t = vi_.checkout;
const labels = { checkout: vi_.checkout, cart: vi_.cart, orderSuccess: vi_.orderSuccess };
const contact = { hotline: "0900 000 000", zaloUrl: "https://zalo.me/0900000000" };
const load = vi.mocked(loadCartLines);
const submit = vi.mocked(submitOrderAction);
const defaultsLoader = vi.mocked(loadCheckoutDefaults);

const line = (id: string, extra: Partial<CartLineData> = {}): CartLineData => ({
  variantId: id,
  productSlug: `p-${id}`,
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
const shoe = line("v1", { nameVi: "Giày Runner", colorNameVi: "Đen", sizeLabel: "42", unitPrice: 2_000_000 });
const watch = line("v2", { nameVi: "Đồng hồ Digi", unitPrice: 590_000 });

async function setCart(items: { variantId: string; quantity: number }[]) {
  useCartStore.setState({ items });
  await useCartStore.persist.rehydrate();
}
const renderCheckout = () => render(<CheckoutView locale="vi" labels={labels} contact={contact} />);
const cartItems = () => useCartStore.getState().items;
const sent = (call = 0) => submit.mock.calls[call][1];

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(new RegExp(t.fields.customerName)), "Nguyễn An");
  await user.type(screen.getByLabelText(new RegExp(t.fields.phone)), "0912 345 678");
  await user.type(screen.getByLabelText(new RegExp(t.fields.province)), "TP. Hồ Chí Minh");
  await user.type(screen.getByLabelText(new RegExp(t.fields.district)), "Quận 1");
  await user.type(screen.getByLabelText(new RegExp(t.fields.ward)), "Bến Nghé");
  await user.type(screen.getByLabelText(new RegExp(t.fields.street)), "12 Lê Lợi");
}
const submitButton = () => screen.getByRole("button", { name: new RegExp(`${t.submit}|${t.submitting}`) });

beforeEach(async () => {
  localStorage.clear();
  load.mockReset();
  submit.mockReset();
  defaultsLoader.mockReset();
  defaultsLoader.mockResolvedValue(null); // a guest, unless a test says otherwise
  load.mockResolvedValue([shoe, watch]);
  await setCart([
    { variantId: "v1", quantity: 2 },
    { variantId: "v2", quantity: 1 },
  ]);
});

describe("before sending", () => {
  it("shows the order summary, the form and that no payment is needed", async () => {
    renderCheckout();
    expect(await screen.findByText("Giày Runner")).toBeInTheDocument();
    expect(screen.getByText("Đen · 42")).toBeInTheDocument();
    expect(screen.getByText(t.noPayment)).toBeInTheDocument();
    expect(screen.getAllByText(/4\.590\.000/)).toHaveLength(2); // subtotal and total
    expect(screen.getByRole("radio", { name: t.fields.contactPhone })).toBeChecked();
    expect(screen.getByRole("link", { name: t.editCart })).toHaveAttribute("href", "/vi/cart");
  });

  it("shows the empty state, not a form, when the cart is empty", async () => {
    await setCart([]);
    renderCheckout();
    expect(await screen.findByText(vi_.cart.empty.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.submit })).not.toBeInTheDocument();
  });

  it("keeps the send button off and explains why when something in the cart cannot be ordered", async () => {
    load.mockResolvedValue([shoe, { ...watch, available: false }]);
    renderCheckout();
    await screen.findByText("Giày Runner");
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(vi_.cart.summary.blocked, { exact: false })).toBeInTheDocument();
  });

  it("has a hidden trap field that people cannot reach", async () => {
    renderCheckout();
    await screen.findByText("Giày Runner");
    const trap = document.querySelector<HTMLInputElement>('input[name="website"]')!;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest("[aria-hidden=true]")).not.toBeNull();
    expect(trap.value).toBe("");
  });
});

describe("sending the order", () => {
  it("sends only ids and quantities plus a submission key and the language, then shows the confirmation", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "success", code: "LV-2611-7KQ2" });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await fillValid(user);
    await user.click(screen.getByRole("radio", { name: t.fields.contactZalo }));
    await user.click(submitButton());

    const form = sent();
    expect(form.get("customerName")).toBe("Nguyễn An");
    expect(form.get("phone")).toBe("0912 345 678");
    expect(form.get("preferredContact")).toBe("ZALO");
    expect(form.get("locale")).toBe("vi");
    expect(form.get("idempotencyKey")).toMatch(/^[0-9a-f-]{36}$/);
    expect(form.get("website")).toBe("");
    // No names or prices: only what the server needs to look them up.
    expect(JSON.parse(form.get("items") as string)).toEqual([
      { variantId: "v1", quantity: 2 },
      { variantId: "v2", quantity: 1 },
    ]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: vi_.orderSuccess.title })).toBeInTheDocument();
    expect(within(dialog).getByTestId("order-code")).toHaveTextContent("LV-2611-7KQ2");
    expect(within(dialog).getByRole("link", { name: /0900 000 000/ })).toHaveAttribute("href", "tel:0900000000");
    expect(within(dialog).getByRole("link", { name: vi_.orderSuccess.zalo })).toHaveAttribute("href", contact.zaloUrl);
    expect(within(dialog).getByRole("link", { name: vi_.orderSuccess.continue })).toHaveAttribute("href", "/vi/products");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(cartItems()).toEqual([]); // cart cleared
    // The confirmation stays on the page behind the pop-up instead of an "empty cart" message.
    expect(screen.getByTestId("order-sent")).toHaveTextContent("LV-2611-7KQ2");
    expect(screen.queryByText(vi_.cart.empty.title)).not.toBeInTheDocument();
  });

  it("closes the pop-up with the close button", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "success", code: "LV-2611-7KQ2" });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await fillValid(user);
    await user.click(submitButton());

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: vi_.orderSuccess.close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("order-sent")).toBeInTheDocument();
  });

  it("disables the button while sending, so a double click cannot send twice", async () => {
    const user = userEvent.setup();
    let finish!: (state: CheckoutState) => void;
    submit.mockReturnValue(new Promise((r) => (finish = r)));
    renderCheckout();
    await screen.findByText("Giày Runner");
    await fillValid(user);
    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(submitButton()).toHaveTextContent(t.submitting);
    await user.click(submitButton());
    expect(submit).toHaveBeenCalledTimes(1);

    await act(async () => finish({ status: "success", code: "LV-2611-AAAA" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("does not clear the cart when the order was not accepted", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "error", error: { code: "UNKNOWN" }, values: {} });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await fillValid(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(t.formError.UNKNOWN);
    expect(cartItems()).toHaveLength(2);
  });

  it("reuses the same submission key on a retry, so a repeated send cannot create two orders", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "error", error: { code: "UNKNOWN" }, values: {} });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByRole("alert");
    await user.click(submitButton());
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));

    expect(sent(1).get("idempotencyKey")).toBe(sent(0).get("idempotencyKey"));
  });
});

describe("when the server says no", () => {
  it("shows each field problem next to its field in Vietnamese and keeps what was typed", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({
      status: "error",
      error: { code: "INVALID_INPUT", fieldErrors: { phone: "invalid_phone", street: "required", email: "invalid_email" } },
      values: { customerName: "Nguyễn An", phone: "12345", email: "abc", province: "TP. Hồ Chí Minh", street: "" },
    });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await user.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(t.formError.INVALID_INPUT);
    await waitFor(() => expect(alert).toHaveFocus()); // keyboard and screen reader users land on the problem

    const phone = screen.getByLabelText(new RegExp(t.fields.phone));
    expect(phone).toBeInvalid();
    expect(phone).toHaveAccessibleDescription(t.errors.invalid_phone);
    expect(screen.getByLabelText(new RegExp(t.fields.street))).toHaveAccessibleDescription(t.errors.required);
    expect(screen.getByLabelText(new RegExp(t.fields.email))).toHaveAccessibleDescription(t.errors.invalid_email);
    expect(screen.getByLabelText(new RegExp(t.fields.customerName))).toHaveValue("Nguyễn An");
    expect(phone).toHaveValue("12345");
    expect(screen.getByLabelText(new RegExp(t.fields.province))).toHaveValue("TP. Hồ Chí Minh");
    expect(screen.getByLabelText(new RegExp(t.fields.customerName))).not.toBeInvalid();
  });

  it("names the item that is short on stock, offers the cart, and reloads the cart data", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "error", error: { code: "OUT_OF_STOCK", variantId: "v1" }, values: {} });
    renderCheckout();
    await screen.findByText("Giày Runner");
    const loadsBefore = load.mock.calls.length;
    await user.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("“Giày Runner” không đủ hàng");
    expect(within(alert).getByRole("link", { name: t.formError.reviewCart })).toHaveAttribute("href", "/vi/cart");
    await waitFor(() => expect(load.mock.calls.length).toBeGreaterThan(loadsBefore));
  });

  it("tells a client that sent too many requests how long to wait", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "error", error: { code: "RATE_LIMITED", retryAfterSeconds: 400 }, values: {} });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng thử lại sau 7 phút");
  });
});

describe("a guest", () => {
  it("is invited to sign in, with a link that brings them back to the checkout", async () => {
    renderCheckout();
    await screen.findByText("Giày Runner");
    const link = screen.getByRole("link", { name: vi_.checkout.loginLink });
    expect(link).toHaveAttribute("href", `/vi/login?next=${encodeURIComponent("/vi/checkout")}`);
    expect(screen.queryByRole("checkbox", { name: vi_.checkout.saveAddress })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(vi_.checkout.savedAddresses)).not.toBeInTheDocument();
  });

  it("gets no link to an order page in the confirmation", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "success", code: "LV-2611-AAAA" });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await fillValid(user);
    await user.click(submitButton());
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("link", { name: vi_.orderSuccess.viewOrder })).not.toBeInTheDocument();
  });
});

describe("a signed-in shopper", () => {
  const address = (id: string, street: string, extra = {}) => ({
    id, recipientName: `Người nhận ${id}`, phone: "0911111111", province: "Hà Nội", district: "Ba Đình", ward: "Phúc Xá", street, isDefault: false, ...extra,
  });
  const signedIn = (addresses = [address("a1", "1 Phố Huế", { isDefault: true }), address("a2", "2 Cầu Giấy")]) =>
    defaultsLoader.mockResolvedValue({ user: { name: "Nguyễn An", email: "an@example.com", phone: "0900000001" }, addresses });

  it("starts with their details and default address filled in", async () => {
    signedIn();
    renderCheckout();
    await screen.findByText("Giày Runner");

    expect(screen.getByLabelText(new RegExp(t.fields.customerName))).toHaveValue("Người nhận a1");
    expect(screen.getByLabelText(new RegExp(t.fields.phone))).toHaveValue("0911111111");
    expect(screen.getByLabelText(new RegExp(t.fields.email))).toHaveValue("an@example.com");
    expect(screen.getByLabelText(new RegExp(t.fields.street))).toHaveValue("1 Phố Huế");
    expect(screen.getByLabelText(new RegExp(t.fields.province))).toHaveValue("Hà Nội");
    expect(screen.queryByRole("link", { name: vi_.checkout.loginLink })).not.toBeInTheDocument();
  });

  it("uses their profile when they have no saved address yet, and offers to save the new one", async () => {
    signedIn([]);
    renderCheckout();
    await screen.findByText("Giày Runner");

    expect(screen.getByLabelText(new RegExp(t.fields.customerName))).toHaveValue("Nguyễn An");
    expect(screen.getByLabelText(new RegExp(t.fields.phone))).toHaveValue("0900000001");
    expect(screen.getByLabelText(new RegExp(t.fields.street))).toHaveValue("");
    expect(screen.queryByLabelText(vi_.checkout.savedAddresses)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: vi_.checkout.saveAddress })).toBeChecked(); // first address: save by default
  });

  it("fills the fields from another saved address when it is chosen, without changing the email", async () => {
    const user = userEvent.setup();
    signedIn();
    renderCheckout();
    await screen.findByText("Giày Runner");

    await user.selectOptions(screen.getByLabelText(vi_.checkout.savedAddresses), "a2");
    expect(screen.getByLabelText(new RegExp(t.fields.customerName))).toHaveValue("Người nhận a2");
    expect(screen.getByLabelText(new RegExp(t.fields.street))).toHaveValue("2 Cầu Giấy");
    expect(screen.getByLabelText(new RegExp(t.fields.email))).toHaveValue("an@example.com");
    expect(screen.getByRole("checkbox", { name: vi_.checkout.saveAddress })).not.toBeChecked(); // already saved before
  });

  it("sends the saved-address choice and the values, and the picker itself is not part of the order", async () => {
    const user = userEvent.setup();
    signedIn();
    submit.mockResolvedValue({ status: "success", code: "LV-2611-BBBB" });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await user.selectOptions(screen.getByLabelText(vi_.checkout.savedAddresses), "a2");
    await user.click(screen.getByRole("checkbox", { name: vi_.checkout.saveAddress }));
    await user.click(submitButton());

    const form = sent();
    expect(form.get("street")).toBe("2 Cầu Giấy");
    expect(form.get("saveAddress")).toBe("on");
    expect(form.get("email")).toBe("an@example.com");
    expect([...form.keys()]).not.toContain("savedAddress");
  });

  it("is offered a link to the order in the confirmation", async () => {
    const user = userEvent.setup();
    signedIn();
    submit.mockResolvedValue({ status: "success", code: "LV-2611-CCCC" });
    renderCheckout();
    await screen.findByText("Giày Runner");
    await user.click(submitButton());

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: vi_.orderSuccess.viewOrder })).toHaveAttribute("href", "/vi/account/orders/LV-2611-CCCC");
  });
});
