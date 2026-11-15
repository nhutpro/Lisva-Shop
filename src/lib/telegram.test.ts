import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatOrderAlert, sendTelegramMessage, type OrderAlertInput } from "./telegram";

const order: OrderAlertInput = {
  code: "LV-2611-7KQ2",
  customerName: "Nguyễn An",
  phone: "0912345678",
  preferredContact: "ZALO",
  province: "TP. Hồ Chí Minh",
  district: "Quận 1",
  ward: "Phường Bến Nghé",
  street: "12 Lê Lợi",
  customerNote: "Giao sau 5h chiều",
  subtotal: 3_670_000,
  items: [
    { productName: "Zoomer Runner", colorName: "Đen", sizeLabel: "42", sku: "ZOOM-RUN-BLK-42", quantity: 1, lineTotal: 2_490_000 },
    { productName: "Tide Digital", colorName: null, sizeLabel: null, sku: "TIDE-DIGI", quantity: 2, lineTotal: 1_180_000 },
  ],
};
const config = { token: "123456:SECRET-TOKEN", chatId: "987654" };

describe("formatOrderAlert", () => {
  it("contains everything the owner needs to call the customer", () => {
    const text = formatOrderAlert(order);
    expect(text).toContain("Đơn mới LV-2611-7KQ2");
    expect(text).toContain("Khách: Nguyễn An");
    expect(text).toContain("SĐT: 0912345678");
    expect(text).toContain("12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh");
    expect(text).toContain("Zoomer Runner – Đen / 42 × 1 — 2.490.000 ₫ (ZOOM-RUN-BLK-42)");
    expect(text).toContain("Tide Digital × 2 — 1.180.000 ₫ (TIDE-DIGI)");
    expect(text).toContain("Tạm tính: <b>3.670.000 ₫</b> (chưa gồm phí vận chuyển)");
    expect(text).toContain("Ghi chú: Giao sau 5h chiều");
  });

  it("links to Zalo when the customer prefers it, and says phone otherwise, with no note line when empty", () => {
    expect(formatOrderAlert(order)).toContain('<a href="https://zalo.me/0912345678">');
    const phone = formatOrderAlert({ ...order, preferredContact: "PHONE", customerNote: null });
    expect(phone).toContain("liên hệ qua điện thoại");
    expect(phone).not.toContain("zalo.me");
    expect(phone).not.toContain("Ghi chú");
  });

  it("escapes customer text so it cannot inject markup", () => {
    const text = formatOrderAlert({
      ...order,
      customerName: '<script>alert(1)</script> & "x"',
      customerNote: "<b>bold</b>",
      items: [{ ...order.items[0], productName: "A<B>" }],
    });
    expect(text).not.toContain("<script>");
    expect(text).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp;");
    expect(text).toContain("Ghi chú: &lt;b&gt;bold&lt;/b&gt;");
    expect(text).toContain("A&lt;B&gt;");
  });

  it("stays within Telegram's message size limit", () => {
    const long = formatOrderAlert({ ...order, customerNote: "x".repeat(6000) });
    expect(long.length).toBeLessThanOrEqual(4096);
  });
});

describe("sendTelegramMessage", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  const ok = () => vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
  const logged = () => warn.mock.calls.flat().join(" ");

  it("posts to the Bot API with the chat id and HTML mode, with a timeout", async () => {
    const fetchImpl = ok();
    await expect(sendTelegramMessage("hello", config, fetchImpl)).resolves.toBe(true);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123456:SECRET-TOKEN/sendMessage");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      chat_id: "987654",
      text: "hello",
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("can post to another API address (a fake server in tests)", async () => {
    const fetchImpl = ok();
    await sendTelegramMessage("hi", { ...config, apiBase: "http://127.0.0.1:8777" }, fetchImpl);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "http://127.0.0.1:8777/bot123456:SECRET-TOKEN/sendMessage",
    );
  });

  it("skips quietly when Telegram is not configured", async () => {
    const fetchImpl = ok();
    await expect(sendTelegramMessage("hello", null, fetchImpl)).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logged()).toContain("not configured");
  });

  it("returns false (and does not throw) when Telegram rejects the message, without logging the token", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"description":"bad token 123456:SECRET-TOKEN"}', { status: 401 })) as unknown as typeof fetch;
    await expect(sendTelegramMessage("hello", config, fetchImpl)).resolves.toBe(false);
    expect(logged()).toContain("HTTP 401");
    expect(logged()).not.toContain("SECRET-TOKEN");
  });

  it("returns false when the network fails or times out, without logging the token", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed https://api.telegram.org/bot123456:SECRET-TOKEN/sendMessage");
    }) as unknown as typeof fetch;
    await expect(sendTelegramMessage("hello", config, failing)).resolves.toBe(false);

    const timedOut = vi.fn(async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    await expect(sendTelegramMessage("hello", config, timedOut)).resolves.toBe(false);

    expect(logged()).toContain("TypeError");
    expect(logged()).toContain("TimeoutError");
    expect(logged()).not.toContain("SECRET-TOKEN");
  });
});
