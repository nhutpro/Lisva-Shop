import type { TelegramConfig } from "./env";
import { formatVnd } from "./format";

// Owner alerts on Telegram. Everything here is best effort: a problem with Telegram must never
// fail an order, so nothing throws, and nothing logs the bot token.

const TIMEOUT_MS = 5000;
const MAX_MESSAGE_LENGTH = 4096; // Telegram's limit for one message

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plainSpaces = (s: string) => s.replace(/ /g, " ");

export type OrderAlertInput = {
  code: string;
  customerName: string;
  phone: string;
  preferredContact: "PHONE" | "ZALO";
  province: string;
  district: string;
  ward: string;
  street: string;
  customerNote: string | null;
  subtotal: number;
  items: {
    productName: string;
    colorName: string | null;
    sizeLabel: string | null;
    sku: string;
    quantity: number;
    lineTotal: number;
  }[];
};

/** The message the owner reads (in Vietnamese). All customer text is HTML-escaped. */
export function formatOrderAlert(order: OrderAlertInput): string {
  const contact =
    order.preferredContact === "ZALO"
      ? `liên hệ qua Zalo: <a href="https://zalo.me/${escapeHtml(order.phone)}">zalo.me/${escapeHtml(order.phone)}</a>`
      : "liên hệ qua điện thoại";

  const items = order.items.map((i) => {
    const options = [i.colorName, i.sizeLabel].filter(Boolean).join(" / ");
    const name = escapeHtml(options ? `${i.productName} – ${options}` : i.productName);
    return `• ${name} × ${i.quantity} — ${plainSpaces(formatVnd(i.lineTotal))} (${escapeHtml(i.sku)})`;
  });

  const lines = [
    `🛒 <b>Đơn mới ${escapeHtml(order.code)}</b>`,
    "",
    `Khách: ${escapeHtml(order.customerName)}`,
    `SĐT: ${escapeHtml(order.phone)} (${contact})`,
    `Địa chỉ: ${escapeHtml([order.street, order.ward, order.district, order.province].join(", "))}`,
    "",
    "Sản phẩm:",
    ...items,
    "",
    `Tạm tính: <b>${plainSpaces(formatVnd(order.subtotal))}</b> (chưa gồm phí vận chuyển)`,
  ];
  if (order.customerNote) lines.push("", `Ghi chú: ${escapeHtml(order.customerNote)}`);

  const text = lines.join("\n");
  return text.length <= MAX_MESSAGE_LENGTH ? text : `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…`;
}

/**
 * Sends a message to the owner. Returns true when Telegram accepted it, false otherwise
 * (not configured, network error, timeout, rejected). Never throws.
 */
export async function sendTelegramMessage(
  text: string,
  config: TelegramConfig | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!config) {
    console.warn("[telegram] not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID): alert skipped");
    return false;
  }
  try {
    const response = await fetchImpl(`${config.apiBase ?? "https://api.telegram.org"}/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Log only the status: the response and the request URL can mention the token or the chat.
      console.warn(`[telegram] message rejected with HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    // Error messages can contain the request URL (and so the token): log the kind of error only.
    // (A timeout is a DOMException, which is not always an `instanceof Error`, so read `name` directly.)
    const kind = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "unknown error";
    console.warn(`[telegram] could not send the message (${kind})`);
    return false;
  }
}
