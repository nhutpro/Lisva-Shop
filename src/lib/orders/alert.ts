import { getTelegramConfig } from "../env";
import { formatOrderAlert, sendTelegramMessage, type OrderAlertInput } from "../telegram";

/** Tells the owner about a new order on Telegram. Best effort: never throws. */
export async function sendOrderAlert(order: OrderAlertInput): Promise<void> {
  let config;
  try {
    config = getTelegramConfig();
  } catch {
    console.warn("[telegram] invalid configuration: alert skipped");
    return;
  }
  await sendTelegramMessage(formatOrderAlert(order), config);
}
